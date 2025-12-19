
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
    xhr.timeout = 45000;
    xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
            if (xhr.status === 200) {
                try { callback(JSON.parse(xhr.responseText)); } 
                catch (e) { errorCallback("Bad Data"); }
            } else { errorCallback("Err: " + xhr.status); }
        }
    };
    xhr.onerror = () => errorCallback("No Net");
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
            if(pg === 1) {
                songs = data; 
                idx = 0;
            } else {
                songs = songs.concat(data);
            }
            if(songs.length === 0) listEl.innerHTML = '<div style="padding:20px; text-align:center;">No Results</div>';
            else render();
        }, 
        (err) => {
            if(pg === 1) listEl.innerHTML = '<div style="padding:20px; text-align:center; color:#ff5555;">' + err + '</div>';
            else alert("Could not load more.");
        }
    );
}

function render() {
    listEl.innerHTML = '';
    songs.forEach((s, i) => {
        const item = document.createElement('div');
        item.className = 'item' + (i === idx ? ' focused' : '');
        
        // Image logic: if img is undefined or error, use placeholder
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

    // Load More Button
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
            if(q) {
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
            if(!data.url) { alert("Link Error"); centerKey.innerText = "PLAY"; return; }
            centerKey.innerText = "PLAYING";
            currentAudio = new Audio(data.url);
            currentAudio.mozAudioChannelType = 'content';
            currentAudio.onended = () => centerKey.innerText = "PLAY";
            currentAudio.onerror = () => { alert("Format Error"); centerKey.innerText = "PLAY"; };
            currentAudio.play();
        },
        (err) => { alert("Net Error"); centerKey.innerText = "PLAY"; }
    );
}

// --- NATIVE DOWNLOAD (Browser API) ---
function triggerNativeDownload(song) {
    if(!confirm("Download " + song.title + "?")) return;
    
    leftKey.innerText = "DL...";
    
    // 1. Get MP3 Link first
    kaiosFetch(API_BASE + '?type=stream&url=' + encodeURIComponent(song.link),
        (data) => {
            if(!data.url) { alert("Cannot find link"); leftKey.innerText = "Download"; return; }
            
            // 2. USE NATIVE BROWSER DOWNLOAD (Shows Progress Bar)
            try {
                // This creates a hidden link and clicks it.
                // On KaiOS, this triggers the System Download Manager.
                var a = document.createElement("a");
                a.href = data.url;
                a.download = song.title + ".mp3"; // Hint filename
                a.target = "_blank"; // Open in background
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                
                alert("Download Started! Check Notification Panel.");
            } catch(e) {
                alert("Download Error: " + e.message);
            }
            leftKey.innerText = "Download";
        },
        (err) => { alert("Net Error"); leftKey.innerText = "Download"; }
    );
}
