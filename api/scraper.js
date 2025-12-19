
const axios = require('axios');
const cheerio = require('cheerio');

const allowCors = fn => async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  return await fn(req, res);
};

const handler = async (req, res) => {
    const { type, url, q } = req.query;

    try {
        // 1. LIST SONGS
        if (type === 'list') {
            const { data } = await axios.get('https://justnaija.com');
            return res.status(200).json(scrapeList(data));
        }
        
        // 2. SEARCH
        if (type === 'search' && q) {
            const { data } = await axios.get('https://justnaija.com/?s=' + encodeURIComponent(q));
            return res.status(200).json(scrapeList(data));
        }

        // 3. GET MP3 (DEEP SEARCH)
        if (type === 'stream' && url) {
            // First Hop: Visit the Song Page
            let response = await axios.get(url);
            let $ = cheerio.load(response.data);
            let targetLink = "";

            // Find the "Download" button
            $('a').each((i, el) => {
                const h = $(el).attr('href');
                const t = $(el).text().toLowerCase();
                if (h && (t.includes('download mp3') || t.includes('download audio'))) {
                    targetLink = h;
                }
            });

            if (!targetLink) return res.status(404).json({ error: "No download link found" });

            // CHECK: Is it already an MP3?
            if (targetLink.endsWith('.mp3')) {
                return res.status(200).json({ url: targetLink });
            }

            // Second Hop: It's a "Download Page", visit it!
            try {
                const page2 = await axios.get(targetLink);
                $ = cheerio.load(page2.data);
                let finalMp3 = "";
                
                // Find the raw .mp3 link on this second page
                $('a').each((i, el) => {
                    const h = $(el).attr('href');
                    if (h && h.endsWith('.mp3')) finalMp3 = h;
                });

                if (finalMp3) return res.status(200).json({ url: finalMp3 });
                
            } catch(err) {
                // If second hop fails, maybe the first link was a redirect to mp3?
                return res.status(200).json({ url: targetLink });
            }

            return res.status(404).json({ error: "MP3 extraction failed" });
        }
        
        res.status(400).json({ error: "Bad Request" });

    } catch (e) { res.status(500).json({ error: e.message }); }
};

function scrapeList(html) {
    const $ = cheerio.load(html);
    const songs = [];
    $('article').each((i, el) => {
        const title = $(el).find('h2 a').text() || $(el).find('h3 a').text();
        const link = $(el).find('h2 a').attr('href') || $(el).find('h3 a').attr('href');
        if (title && link) songs.push({ title: title.trim(), link });
    });
    return songs;
}

module.exports = allowCors(handler);
