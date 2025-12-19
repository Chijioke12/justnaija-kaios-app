
const API_BASE = "https://justnaija-kaios-app.vercel.app/api/scraper";
let songs = [];
let idx = 0;
let page = 1;
let currentMode = 'list';
let currentQuery = '';

// PLAYER STATE
let currentAudio = null;
let playingIndex = -1;
let isShuffle = false;

const listEl = document.getElementById('list');
const centerKey = document.getElementById('sk-center');
const leftKey = document.getElementById('sk-left');
const headerEl = document.querySelector('header');
const progressBar = document.getElementById('progress-bar');

function kaiosFetch(url, callback, errorCallback) {
    const xhr = new XMLHttpRequest({ mozSystem: true });
    xhr.open('GET', url, true);
    xhr.timeout = 40000;
    xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
            if (xhr.status === 200) {
                try {
                    const data = JSON.parse(xhr.responseText);
                    if (data && (Array.isArray(data) || data.url || data.error)) callback(data);
                    else errorCallback("Invalid Data");
                } catch (e) { errorCallback("Bad JSON"); }
            } else { errorCallback("Err: " + xhr.status); }
        }
    };
    xhr.onerror = () => errorCallback("No Net");
    xhr.ontimeout = () => errorCallback("Timeout");
    xhr.send();
}

loadData('list', '', 1);

function loadData(type, query, pg) {
    if(pg === 1) listEl.innerHTML = '<div style="padding:20px; text-align:center;">Loading...</div>';
    let url = API_BASE + '?type=' + type + '&page=' + pg;
    if(query) url += '&q=' + encodeURIComponent(query);
    kaiosFetch(url, 
        (data) => {
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
        item.className = 'item' + (i === idx ? ' focused' : '') + (i === playingIndex ? ' playing' : '');
        let imgUrl = s.img || 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
        item.innerHTML = `<img class="thumb" src="${imgUrl}" loading="lazy"><div class="info"><div class="title">${s.title}</div><div class="sub">Song ${i === playingIndex ? '(Playing)' : ''}</div></div>`;
        listEl.appendChild(item);
    });
    const moreBtn = document.createElement('div');
    moreBtn.className = 'load-more' + (idx === songs.length ? ' focused' : '');
    moreBtn.innerText = "LOAD MORE...";
    listEl.appendChild(moreBtn);
    scrollToFocused();
    updateSoftKeys();
}

function scrollToFocused() {
    const focusedEl = document.querySelector('.focused');
    if (!focusedEl) return;
    listEl.scrollTop = focusedEl.offsetTop - (listEl.offsetHeight / 2) + (focusedEl.offsetHeight / 2);
}

function updateSoftKeys() {
    if (idx === songs.length) {
        centerKey.innerText = "LOAD";
    } else {
        if (idx === playingIndex && currentAudio) {
            centerKey.innerText = currentAudio.paused ? "RESUME" : "PAUSE";
        } else {
            centerKey.innerText = "PLAY";
        }
    }
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
                handleCenterKey(); 
            }
            break;
        case 'SoftRight': 
            const q = prompt("Search Song or Artist:");
            if(q && q.trim().length > 0) {
                currentMode = 'search'; currentQuery = q; page = 1; loadData('search', q, 1);
            }
            break;
        case 'SoftLeft':
            if(idx < songs.length) triggerNativeDownload(songs[idx]);
            break;
        case '4': if(playingIndex > 0) playSong(playingIndex - 1); break;
        case '6': playNext(); break;
        case '5': 
            isShuffle = !isShuffle; 
            headerEl.innerText = isShuffle ? "JustNaija (Shuffle)" : "JustNaija"; 
            break;
    }
});

function handleCenterKey() {
    if (idx === playingIndex && currentAudio) {
        if (currentAudio.paused) {
            currentAudio.play();
            centerKey.innerText = "PAUSE";
        } else {
            currentAudio.pause();
            centerKey.innerText = "RESUME";
        }
        return;
    }
    playSong(idx);
}

function playNext() {
    if(songs.length === 0) return;
    let nextIndex = isShuffle ? Math.floor(Math.random() * songs.length) : playingIndex + 1;
    if(nextIndex < songs.length) playSong(nextIndex);
}

function playSong(index) {
    const song = songs[index];
    if(!song) return;

    centerKey.innerText = "WAIT...";
    playingIndex = index;
    render(); 
    
    if (currentAudio) { currentAudio.pause(); currentAudio = null; }
    progressBar.style.width = "0%";

    kaiosFetch(API_BASE + '?type=stream&url=' + encodeURIComponent(song.link),
        (data) => {
            if(!data.url) { alert("Link not found"); centerKey.innerText = "PLAY"; return; }
            
            centerKey.innerText = "PAUSE";
            currentAudio = new Audio(data.url);
            currentAudio.mozAudioChannelType = 'content';
            
            currentAudio.ontimeupdate = () => {
                const pct = (currentAudio.currentTime / currentAudio.duration) * 100;
                progressBar.style.width = pct + "%";
            };

            currentAudio.onended = () => playNext();
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
                a.href = data.url; a.download = song.title + ".mp3"; a.target = "_blank";
                document.body.appendChild(a); a.click(); document.body.removeChild(a);
                alert("Started!");
            } catch(e) { alert("DL Error: " + e.message); }
            leftKey.innerText = "Download";
        },
        (err) => { alert(err); leftKey.innerText = "Download"; }
    );
}
