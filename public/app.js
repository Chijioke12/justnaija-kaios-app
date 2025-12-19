
const API = window.location.hostname === 'localhost' ? 'http://localhost:3000/api/scraper' : '/api/scraper';
let songs = [], idx = 0;

function log(msg) { document.getElementById('status').innerText = msg; }

// 1. Fetch Songs
fetch(API + '?type=list')
    .then(r => r.json())
    .then(d => { songs = d; render(); log("Loaded " + songs.length); })
    .catch(e => log("Error: " + e.message));

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
    if(e.key === 'Enter') playOrDownload(songs[idx]);
});

function playOrDownload(song) {
    log("Getting Link...");
    fetch(API + '?type=stream&url=' + encodeURIComponent(song.link))
        .then(r => r.json())
        .then(d => {
            if(!d.url) return log("No MP3 found");
            
            // Ask user preference (Simple toggle for now: Stream)
            log("Playing: " + song.title);
            const a = new Audio(d.url);
            a.mozAudioChannelType = 'content';
            a.play();
            
            // To Download instead, un-comment this:
            /*
            log("Downloading...");
            const xhr = new XMLHttpRequest({mozSystem: true});
            xhr.open('GET', d.url, true);
            xhr.responseType = 'blob';
            xhr.onload = () => {
                if(xhr.status === 200) {
                    navigator.getDeviceStorage('sdcard').addNamed(xhr.response, "Music/"+song.title+".mp3");
                    log("Saved to SD!");
                }
            };
            xhr.send();
            */
        })
        .catch(e => log("Stream Error"));
}
