import re
import json
import requests
from pymongo import MongoClient
from bson.codec_options import CodecOptions
from bson.objectid import ObjectId
from collections import OrderedDict
from datetime import datetime, timedelta, timezone
from pprint import pformat

with open('.mongourl') as fh:
    MONGO_URL = fh.read().strip()

# from https://github.com/BTDev/Berrymotes/blob/master/js/berrymotes.core.js
EMOTE_REGEX = r'\[([^\]]*)\]\(\/([\w:!#\/]+)([-\w!]*)([^)]*)\)'

def handle_usercolors(environ, start_response):
    response = requests.get('https://btc.berrytube.tv/wut/wutColors/usercolors.js')
    response.raise_for_status()

    data = json.loads(re.sub(r'^[^=]+=', '', response.text))
    
    start_response('200 OK', [('Content-Type', 'text/css')])
    return '\n'.join(
        f'tr[data-id="{nick}"] {{ --usercolor: {attrs["color"]}; }}'
        for nick, attrs in data.items()
        if attrs.get('color')
    )

def suffix(field='count', length=10):
    return [
        { '$sort': OrderedDict([(field, -1), ('latest', -1)]) },
        { '$limit': length },
    ]

ACTIONS = {
    'videos': {
        'collection': 'forceVideoChange',
        'pipeline': [
            { '$group': {
                '_id': '$video.videotitle',
                'count': { '$sum': 1 },
                'latest': { '$max': '$_time' },
                'videoid': { '$first': '$video.videoid' },
                'videotype': { '$first': '$video.videotype' },
            } },
        ] + suffix()
    },
    'drinks': {
        'collection': 'chatMsg',
        'pipeline': [
            { '$match': { 'msg.emote': 'drink' } },
            { '$group': {
                '_id': { '$toLower': '$msg.msg' },
                'count': { '$sum': 1 },
                'latest': { '$max': '$_time' },
            } },
        ] + suffix()
    },
    'emotes': {
        'collection': 'chatMsg',
        'pipeline': [
            { '$project': {
                '_id': False,
                '_time': True,
                'emotes': { '$regexFindAll': {
                    'input': '$msg.msg',
                    'regex': EMOTE_REGEX,
                    'options': 'i',
                } },
            } },
            { '$unwind': '$emotes' },
            { '$group': {
                '_id': { '$arrayElemAt': ['$emotes.captures', 1] },
                'count': { '$sum': 1 },
                'latest': { '$max': '$_time' },
            } },
        ] + suffix()
    },
    'chatters': {
        'collection': 'chatMsg',
        'postprocess': next,
        'pipeline': [
            { '$match': { 'msg.emote': False } },
            { '$group': {
                '_id': '$msg.nick',
                'latest': { '$max': '$_time' },
                'lines': { '$sum': 1 },
                'characters': { '$sum': { '$strLenBytes': '$msg.msg' } },
                'emotes': { '$sum': { '$size': { '$regexFindAll': {
                    'input': '$msg.msg',
                    'regex': EMOTE_REGEX,
                    'options': 'i',
                } } } },
                'fav': { '$push': { '$regexFindAll': {
                    'input': '$msg.msg',
                    'regex': EMOTE_REGEX,
                    'options': 'i',
                } } },
            } },
            # favorite emote:
            { '$unwind': '$fav' },
            { '$unwind': '$fav' },
            { '$group': {
                '_id': {
                    'nick': '$_id',
                    'fav': { '$arrayElemAt': ['$fav.captures', 1] },
                },
                'latest': { '$first': '$latest' },
                'lines': { '$first': '$lines' },
                'characters': { '$first': '$characters' },
                'emotes': { '$first': '$emotes' },
                'favCount': { '$sum': 1 },
            } },
            { '$sort': OrderedDict([('_id.nick', 1), ('favCount', -1)]) },
            { '$group': {
                '_id': '$_id.nick',
                'latest': { '$first': '$latest' },
                'lines': { '$first': '$lines' },
                'characters': { '$first': '$characters' },
                'emotes': { '$first': '$emotes' },
                'favCount': { '$first': '$favCount' },
                'fav': { '$first': '$_id.fav' },
            } },
            { '$facet': {
                'lines': suffix('lines'),
                'characters': suffix('characters'),
                'emotes': suffix('emotes'),
            } },
        ]
    },
    'connected': {
        'collection': 'numConnected',
        'postprocess': lambda cursor: [[doc['_id'], doc['count']] for doc in cursor],
        'pipeline': [
            { '$group': {
                '_id': { '$dateToString': {
                    'date': {
                        '$dateFromParts': {
                            'year': { '$year': '$_time' },
                            'month': { '$month': '$_time' },
                            'day': { '$dayOfMonth': '$_time' },
                            'hour': { '$hour': '$_time' },
                            'minute': { '$subtract': [
                                { '$minute': '$_time' },
                                { '$mod': [{'$minute': '$_time'}, 5] }
                            ] },
                        }
                    },
                    'format': '%Y-%m-%dT%H:%MZ',
                } },
                'count': { '$max': '$num' },
            } },
            { '$sort': { '_id': 1 } },
        ]
    },
    'usercolors': {
        'handler': handle_usercolors,
    },
}

def json_serializer(val):
    if isinstance(val, datetime):
        return val.isoformat(timespec='seconds')
    if isinstance(val, ObjectId):
        return str(val)
    raise TypeError(f"can't JSON serialize a {type(val)}")

def application(environ, start_response):
    action = ACTIONS[environ['query']['action'][0]]

    handler = action.get('handler')
    if handler:
        return handler(environ, start_response)

    prefix = [
        { '$match': { '_time': { '$gte': datetime.now() - timedelta(days=7) } } },
    ]

    results = action.get('postprocess', list)(
        MongoClient(MONGO_URL)
            .btlogs
            .get_collection(action['collection'], codec_options=CodecOptions(tz_aware=True))
            .aggregate(prefix + action['pipeline'])
    )

    start_response('200 OK', [('Content-Type', 'application/json')])
    return json.dumps(
        results,
        default=json_serializer,
        ensure_ascii=False,
        check_circular=False,
        separators=(',', ':'),
    )
