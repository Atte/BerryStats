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

const postprocess = {
    chatters({ table, tbody, data }) {
        const row = tbody.querySelector('tr:last-child');

        const input = document.createElement('input');
        input.className = 'form-control form-control-sm';
        input.placeholder = 'Write nickname and press enter';
        input.value = row.querySelector('td.nick').textContent;

        input.addEventListener('focus', () => {
            input.select();
        });

        input.addEventListener('keypress', async event => {
            if (event.key !== 'Enter') {
                return;
            }

            event.preventDefault();
            input.disabled = true;

            const response = await fetch('api.py?action=chatters&nick=' + encodeURIComponent(input.value));
            const nickData = await response.json();

            if (nickData && nickData.lines && nickData.lines[0]) {
                nickData.lines[0].index = '??';
                renderTable(table, data.slice(0, 20).concat(nickData.lines));
            } else {
                input.value = '';
                input.disabled = false;
            }
        });

        row.querySelector('td.nick').innerHTML = '';
        row.querySelector('td.nick').appendChild(input);
    }
};

function renderTable(table, data) {
    const tbody = table.querySelector('tbody');
    const rowTemplate = document.querySelector(`template[data-action="${table.dataset.action}"]`);
    tbody.innerHTML = '';

    // no data -> render placeholder rows
    if (!data) {
        for (let index = 0; index < parseInt(table.dataset.rows || 10, 10); ++index) {
            const row = rowTemplate.content.cloneNode(true);
            row.querySelector('th').textContent = index + 1;
            tbody.appendChild(row);
        }
        return;
    }

    for (const [index, el] of data.entries()) {
        const row = rowTemplate.content.cloneNode(true);
        row.querySelector('tr').dataset.id = el._id;
        row.querySelector('th').textContent = el.index || (index + 1);

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
                td.title = el[td.dataset.titleProp] + (td.title || '');
            }
        }
        tbody.appendChild(row);
    }

    if (postprocess.hasOwnProperty(table.dataset.action)) {
        postprocess[table.dataset.action]({ table, tbody, rowTemplate, data });
    }

    table.classList.add('loaded');
}

async function initTable(table) {
    renderTable(table, null);

    const response = await fetch('api.py?action=' + table.dataset.action);
    const data = await response.json();

    if (table.dataset.variant) {
        renderTable(table, data[table.dataset.variant]);
        table.querySelector('thead tr').addEventListener('click', event => {
            const th = event.target.closest('th[data-variant]');
            if (!th) {
                return;
            }

            event.preventDefault();
            table.dataset.variant = th.dataset.variant;
            renderTable(table, data[table.dataset.variant]);

            th.parentNode.querySelector('th.current-variant').classList.remove('current-variant');
            th.classList.add('current-variant');
        });
    } else {
        renderTable(table, data);
    }
}

for (const table of document.querySelectorAll('table[data-action]')) {
    initTable(table);
}
