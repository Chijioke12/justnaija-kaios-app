
/**
 * CONFIGURATION
 * 1. Deploy to Vercel.
 * 2. Copy your URL (e.g., https://my-app.vercel.app).
 * 3. Paste it below inside the quotes.
 */
const VERCEL_URL = ""; // <--- PASTE YOUR URL HERE

// Automatic fallback for testing in browser
const API_BASE = (VERCEL_URL === "") 
    ? (window.location.hostname === 'localhost' ? 'http://localhost:3000/api/scraper' : '/api/scraper')
    : VERCEL_URL + '/api/scraper';

let songs = [], idx = 0;

function log(msg) { document.getElementById('status').innerText = msg; }

// 1. Fetch Songs
fetch(API_BASE + '?type=list')
    .then(r => r.json())
    .then(d => { 
        songs = d; 
        render(); 
        log("Loaded " + songs.length + " songs"); 
        if(songs.length === 0) log("No songs found (Check API)");
    })
    .catch(e => {
        log("Connection Error!");
        console.error(e);
        // If Vercel URL is missing
        if(VERCEL_URL === "" && window.location.protocol === "app:") {
            alert("Please edit app.js and add your Vercel URL!");
        }
    });

// 2. Render List
function render() {
    const list = document.getElementById('list');
    list.innerHTML = '';
    songs.forEach((s, i) => {
        const d = document.createElement('div');
        d.className = 'item' + (i === idx ? ' focused' : '');
        d.innerText = s.title;
        list.appendChild(d);
    });
    document.querySelector('.focused')?.scrollIntoView({block:"center"});
}

// 3. Controls
document.addEventListener('keydown', e => {
    if(e.key === 'ArrowDown' && idx < songs.length-1) { idx++; render(); }
    if(e.key === 'ArrowUp' && idx > 0) { idx--; render(); }
    if(e.key === 'Enter') playSong(songs[idx]);
});

function playSong(song) {
    log("Fetching MP3...");
    fetch(API_BASE + '?type=stream&url=' + encodeURIComponent(song.link))
        .then(r => r.json())
        .then(d => {
            if(!d.url) return log("No MP3 found");
            
            log("Playing: " + song.title);
            const a = new Audio(d.url);
            a.mozAudioChannelType = 'content'; // Background Audio
            a.play();
            
            a.onerror = (err) => log("Playback Error");
        })
        .catch(e => log("Stream Error"));
}
