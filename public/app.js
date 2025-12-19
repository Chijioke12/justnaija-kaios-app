
const API_BASE = "https://justnaija-kaios-app.vercel.app/api/scraper";

let songs = [];
let idx = 0;
let page = 1;
let currentMode = 'list'; // 'list' or 'search'
let currentQuery = '';
let currentAudio = null;

const listEl = document.getElementById('list');
const centerKey = document.getElementById('sk-center');
const leftKey = document.getElementById('sk-left');

// --- NETWORK HELPER ---
function kaiosFetch(url, callback, errorCallback) {
    const xhr = new XMLHttpRequest({ mozSystem: true });
    xhr.open('GET', url, true);
    xhr.timeout = 45000; // 45s timeout
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

// 1. Load Initial Data
loadData('list', '', 1);

function loadData(type, query, pg) {
    if(pg === 1) listEl.innerHTML = '<div style="padding:20px; text-align:center;">Loading...</div>';
    
    let url = API_BASE + '?type=' + type + '&page=' + pg;
    if(query) url += '&q=' + encodeURIComponent(query);

    kaiosFetch(url, 
        (data) => {
            if(pg === 1) {
                songs = data; // New List
                idx = 0;
            } else {
                songs = songs.concat(data); // Append
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
    
    // Render Songs
    songs.forEach((s, i) => {
        const item = document.createElement('div');
        item.className = 'item' + (i === idx ? ' focused' : '');
        
        // Image Fallback
        const imgUrl = s.img ? s.img : 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
        
        item.innerHTML = `
            <img class="thumb" src="${imgUrl}" loading="lazy">
            <div class="info">
                <div class="title">${s.title}</div>
                <div class="sub">Song</div>
            </div>
        `;
        listEl.appendChild(item);
    });

    // Render "Load More" button at bottom
    const moreBtn = document.createElement('div');
    moreBtn.className = 'load-more' + (idx === songs.length ? ' focused' : '');
    moreBtn.innerText = "LOAD MORE SONGS...";
    listEl.appendChild(moreBtn);
    
    scrollToFocused();
}

function scrollToFocused() {
    const focusedEl = document.querySelector('.focused');
    if (!focusedEl) return;
    // Align to center
    listEl.scrollTop = focusedEl.offsetTop - (listEl.offsetHeight / 2) + (focusedEl.offsetHeight / 2);
}

// --- CONTROLS ---
document.addEventListener('keydown', e => {
    switch(e.key) {
        case 'ArrowDown': 
            if(idx < songs.length) { idx++; render(); } // Allows going to "Load More" (idx = length)
            break;
        case 'ArrowUp': 
            if(idx > 0) { idx--; render(); } 
            break;
        case 'Enter': 
            if(idx === songs.length) {
                // Clicked Load More
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
            if(idx < songs.length) downloadSong(songs[idx]);
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

// --- DOWNLOAD FUNCTION ---
function downloadSong(song) {
    if(!confirm("Download " + song.title + "?")) return;
    
    leftKey.innerText = "DL...";
    
    // 1. Get MP3 Link first
    kaiosFetch(API_BASE + '?type=stream&url=' + encodeURIComponent(song.link),
        (data) => {
            if(!data.url) { alert("Cannot find DL link"); leftKey.innerText = "Download"; return; }
            
            // 2. Download the actual file
            const xhr = new XMLHttpRequest({ mozSystem: true });
            xhr.open('GET', data.url, true);
            xhr.responseType = 'blob'; // Important for files
            
            xhr.onload = function() {
                if (xhr.status === 200) {
                    // 3. Save to SD Card
                    const storage = navigator.getDeviceStorage('sdcard');
                    // Clean filename
                    const cleanTitle = song.title.replace(/[^a-z0-9]/gi, '_').substring(0, 30);
                    const file = new Blob([xhr.response], { type: "audio/mpeg" });
                    
                    const request = storage.addNamed(file, "Music/JustNaija/" + cleanTitle + ".mp3");
                    
                    request.onsuccess = () => { alert("Saved to Music/JustNaija!"); leftKey.innerText = "Download"; };
                    request.onerror = () => { alert("Storage Error: " + this.error.name); leftKey.innerText = "Download"; };
                } else {
                    alert("Download Failed");
                    leftKey.innerText = "Download";
                }
            };
            xhr.send();
        },
        (err) => { alert("Net Error"); leftKey.innerText = "Download"; }
    );
}
