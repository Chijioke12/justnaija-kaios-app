
const API_BASE = "https://justnaija-kaios-app.vercel.app/api/scraper";

let songs = [];
let idx = 0;
let page = 1;
let currentMode = 'list';
let currentQuery = '';
let currentAudio = null;

const listEl = document.getElementById('list');
const centerKey = document.getElementById('sk-center');
const leftKey = document.getElementById('sk-left');

// Helper for KaiOS XHR
function kaiosFetch(url, callback, errorCallback) {
    const xhr = new XMLHttpRequest({ mozSystem: true });
    xhr.open('GET', url, true);
    xhr.timeout = 40000;
    xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
            if (xhr.status === 200) {
                try {
                    const data = JSON.parse(xhr.responseText);
                    // SAFETY CHECK: Ensure data is valid before sending back
                    if (data && (Array.isArray(data) || data.url || data.error)) {
                        callback(data);
                    } else {
                        errorCallback("Invalid response format");
                    }
                } 
                catch (e) { errorCallback("Bad Data (JSON)"); }
            } else { errorCallback("Server Error: " + xhr.status); }
        }
    };
    xhr.onerror = () => errorCallback("Network Error");
    xhr.ontimeout = () => errorCallback("Timeout");
    xhr.send();
}

// Start
loadData('list', '', 1);

function loadData(type, query, pg) {
    if(pg === 1) listEl.innerHTML = '<div style="padding:20px; text-align:center;">Loading...</div>';
    
    let url = API_BASE + '?type=' + type + '&page=' + pg;
    if(query) url += '&q=' + encodeURIComponent(query);

    kaiosFetch(url, 
        (data) => {
            // Check for backend errors
            if(data.error) {
                if(pg===1) listEl.innerHTML = '<div style="padding:20px; color:red; text-align:center;">' + data.error + '</div>';
                else alert(data.error);
                return;
            }

            if(pg === 1) {
                songs = Array.isArray(data) ? data : []; 
                idx = 0;
            } else {
                if(Array.isArray(data)) songs = songs.concat(data);
            }

            if(songs.length === 0) listEl.innerHTML = '<div style="padding:20px; text-align:center;">No Results Found</div>';
            else render();
        }, 
        (err) => {
            if(pg === 1) listEl.innerHTML = '<div style="padding:20px; text-align:center; color:#ff5555;">' + err + '</div>';
            else alert("Error: " + err);
        }
    );
}

function render() {
    listEl.innerHTML = '';
    songs.forEach((s, i) => {
        const item = document.createElement('div');
        item.className = 'item' + (i === idx ? ' focused' : '');
        
        let imgUrl = s.img;
        if (!imgUrl || imgUrl.indexOf('http') === -1) {
            imgUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
        }
        
        item.innerHTML = `
            <img class="thumb" src="${imgUrl}" loading="lazy">
            <div class="info">
                <div class="title">${s.title}</div>
                <div class="sub">Song</div>
            </div>
        `;
        listEl.appendChild(item);
    });

    const moreBtn = document.createElement('div');
    moreBtn.className = 'load-more' + (idx === songs.length ? ' focused' : '');
    moreBtn.innerText = "LOAD MORE...";
    listEl.appendChild(moreBtn);
    
    scrollToFocused();
}

function scrollToFocused() {
    const focusedEl = document.querySelector('.focused');
    if (!focusedEl) return;
    listEl.scrollTop = focusedEl.offsetTop - (listEl.offsetHeight / 2) + (focusedEl.offsetHeight / 2);
}

document.addEventListener('keydown', e => {
    switch(e.key) {
        case 'ArrowDown': 
            if(idx < songs.length) { idx++; render(); } 
            break;
        case 'ArrowUp': 
            if(idx > 0) { idx--; render(); } 
            break;
        case 'Enter': 
            if(idx === songs.length) {
                page++;
                loadData(currentMode, currentQuery, page);
            } else {
                playSong(songs[idx]); 
            }
            break;
        case 'SoftRight': 
            const q = prompt("Search Artist:");
            if(q && q.trim().length > 0) {
                currentMode = 'search';
                currentQuery = q;
                page = 1;
                loadData('search', q, 1);
            }
            break;
        case 'SoftLeft':
            if(idx < songs.length) triggerNativeDownload(songs[idx]);
            break;
    }
});

function playSong(song) {
    centerKey.innerText = "WAIT...";
    if (currentAudio) { currentAudio.pause(); currentAudio = null; }

    kaiosFetch(API_BASE + '?type=stream&url=' + encodeURIComponent(song.link),
        (data) => {
            if(!data.url) { alert("Link not found"); centerKey.innerText = "PLAY"; return; }
            centerKey.innerText = "PLAYING";
            currentAudio = new Audio(data.url);
            currentAudio.mozAudioChannelType = 'content';
            currentAudio.onended = () => centerKey.innerText = "PLAY";
            currentAudio.onerror = () => { alert("Format Error"); centerKey.innerText = "PLAY"; };
            currentAudio.play();
        },
        (err) => { alert(err); centerKey.innerText = "PLAY"; }
    );
}

function triggerNativeDownload(song) {
    if(!confirm("Download " + song.title + "?")) return;
    leftKey.innerText = "DL...";
    
    kaiosFetch(API_BASE + '?type=stream&url=' + encodeURIComponent(song.link),
        (data) => {
            if(!data.url) { alert("Link not found"); leftKey.innerText = "Download"; return; }
            try {
                var a = document.createElement("a");
                a.href = data.url;
                a.download = song.title + ".mp3";
                a.target = "_blank";
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                alert("Started! Check Notifications.");
            } catch(e) { alert("DL Error: " + e.message); }
            leftKey.innerText = "Download";
        },
        (err) => { alert(err); leftKey.innerText = "Download"; }
    );
}
