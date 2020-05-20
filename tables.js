// from https://btc.berrytube.tv/wut/wutColors/wutColors.js
function wutHashCode(str){
    var hash = 0;
    for (var i = 0; i < str.length; i++) {
        var char = str.charCodeAt(i);
        hash = char + (hash << 6) + (hash << 16) - hash;
    }
    return hash;
}
function wutGetUsercolor(nick){
    var h,s,l,a,c;
    h = Math.abs(wutHashCode(nick))%360
    , s = Math.abs(wutHashCode(nick))%25 + 70
    , l = Math.abs(wutHashCode(nick))%15 + 35
    , a = 1
    , c = "hsla("+h+","+s+"%,"+l+"%,"+a+")"
    ;
    return c;
}

// from https://github.com/Atte/berrytweaks/blob/master/js/lib/video.js
function getVideoLink(vid, timeStr=null) {
    switch (vid.videotype){
        case 'dm':
            return 'https://www.dailymotion.com/video/' + vid.videoid + (timeStr ? '?start='+time : '');
        case 'yt':
            return 'https://www.youtube.com/watch?v=' + vid.videoid + (timeStr ? '#t='+timeStr : '');
        case 'vimeo':
            return 'https://vimeo.com/' + vid.videoid + (timeStr ? '#t='+timeStr : '');
        case 'soundcloud':
            return 'https://atte.fi/soundcloud/?' + vid.videoid.substr(2);
        case 'twitch':
            return 'https://www.twitch.tv/' + vid.videoid + (vid.videoid.startsWith('videos/') && timeStr ? '?t='+timeStr : '');
        case 'twitchclip':
            return 'https://clips.twitch.tv/' + vid.videoid;
        default:
            return vid.videoid && vid.videoid.includes('//') ? vid.videoid : null;
    }
}

async function fillTable(table) {
    const tbody = table.querySelector('tbody');
    const rowTemplate = document.querySelector(`template[data-action=${table.dataset.action}]`);

    // placeholder rows
    tbody.innerHTML = '';
    for (let index = 0; index < 10; ++index) {
        const row = rowTemplate.content.cloneNode(true);
        row.querySelector('th').textContent = index + 1;
        tbody.appendChild(row);
    }

    const response = await fetch('api.py?action=' + table.dataset.action);
    const data = await response.json();

    tbody.innerHTML = '';
    for (const [index, el] of data.entries()) {
        const row = rowTemplate.content.cloneNode(true);
        row.querySelector('tr').dataset.id = el._id;
        row.querySelector('th').textContent = index + 1;

        for (const td of row.querySelectorAll('td[data-prop]')) {
            const value = td.dataset.value = el[td.dataset.prop];
            if (td.classList.contains('num')) {
                // separate thousands with thin space character
                td.textContent = value.toString().replace(/\d{1,3}(?=(\d{3})+(?!\d))/g, '$&\u2009');
            } else if (td.classList.contains('videolink') && value !== '~ Raw Livestream ~') {
                const link = getVideoLink(el);
                if (link) {
                    const a = document.createElement('a');
                    a.href = link;
                    a.textContent = value;
                    a.rel = 'noreferrer noopener';
                    //a.target = '_blank';
                    td.appendChild(a);
                } else {
                    td.textContent = value;
                }
            } else if (td.classList.contains('emote')) {
                const img = document.createElement('img');
                img.src = 'https://atte.fi/berrymotes/render.php?emote=' + value;
                td.appendChild(img);
            } else if (td.classList.contains('usercolor')) {
                document.getElementById('usercolors').sheet.insertRule(
                    `tr[data-id="${value}"] { --usercolor: ${wutGetUsercolor(value)}; }`
                );
            } else {
                td.textContent = value;
            }

            if (td.dataset.titleProp) {
                td.title = el[td.dataset.titleProp];
            }
        }
        tbody.appendChild(row);
    }
}

for (const table of document.querySelectorAll('table[data-action]')) {
    fillTable(table);
}
