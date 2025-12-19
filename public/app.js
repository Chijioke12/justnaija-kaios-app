
// HARDCODED API URL
const VERCEL_URL = "https://justnaija-kaios-app.vercel.app";
const API_BASE = VERCEL_URL + '/api/scraper';

let songs = [];
let idx = 0;
let currentAudio = null;

const listEl = document.getElementById('list');
const centerKey = document.getElementById('sk-center');

// Start App
fetchSongs('list');

function fetchSongs(type, query) {
    listEl.innerHTML = '<div style="padding:20px; text-align:center;">Loading...</div>';
    let url = API_BASE + '?type=' + type;
    if(query) url += '&q=' + encodeURIComponent(query);

    fetch(url).then(r => r.json()).then(d => { 
        songs = d; 
        idx = 0;
        if(songs.length === 0) listEl.innerHTML = '<div style="padding:20px; text-align:center;">No Results</div>';
        else render(); 
    }).catch(e => {
        listEl.innerHTML = '<div style="padding:20px; text-align:center; color:red;">Network Error</div>';
    });
}

function render() {
    listEl.innerHTML = '';
    songs.forEach((s, i) => {
        const d = document.createElement('div');
        d.className = 'item' + (i === idx ? ' focused' : '');
        d.innerText = s.title;
        listEl.appendChild(d);
    });
    scrollToFocused();
}

function scrollToFocused() {
    const focusedEl = document.querySelector('.focused');
    if (!focusedEl) return;
    focusedEl.scrollIntoView({block: "center", behavior: "auto"});
}

document.addEventListener('keydown', e => {
    switch(e.key) {
        case 'ArrowDown': if(idx < songs.length-1) { idx++; render(); } break;
        case 'ArrowUp': if(idx > 0) { idx--; render(); } break;
        case 'Enter': playSong(songs[idx]); break;
        case 'SoftRight': 
            const q = prompt("Search Artist:");
            if(q) fetchSongs('search', q);
            break;
    }
});

function playSong(song) {
    if(!song) return;
    centerKey.innerText = "WAIT...";
    
    // FIX: Stop previous song
    if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
    }

    fetch(API_BASE + '?type=stream&url=' + encodeURIComponent(song.link))
        .then(r => r.json())
        .then(d => {
            if(!d.url) {
                alert("Link Not Found (Try another)");
                centerKey.innerText = "PLAY";
                return;
            }
            centerKey.innerText = "PLAYING";
            currentAudio = new Audio(d.url);
            currentAudio.mozAudioChannelType = 'content';
            
            currentAudio.onerror = (e) => {
                // Show specific error for debugging
                alert("Format Error: Server sent HTML or bad MP3.");
                centerKey.innerText = "PLAY";
            };
            
            currentAudio.onended = () => centerKey.innerText = "PLAY";
            currentAudio.play();
        })
        .catch(e => {
            alert("Network Error");
            centerKey.innerText = "PLAY";
        });
}
