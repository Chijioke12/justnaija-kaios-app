
const axios = require('axios');
const cheerio = require('cheerio');

// FAKE BROWSER HEADERS (Fixes 403 Forbidden / Net Error)
const AXIOS_CONFIG = {
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Referer': 'https://justnaija.com/'
    },
    timeout: 9000 // 9 second timeout (prevents Vercel hanging)
};

const allowCors = fn => async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  return await fn(req, res);
};

const handler = async (req, res) => {
    const { type, url, q, page } = req.query;
    const pageNum = page ? '/page/' + page : '';

    try {
        // 1. LIST SONGS
        if (type === 'list') {
            const { data } = await axios.get('https://justnaija.com' + pageNum, AXIOS_CONFIG);
            return res.status(200).json(scrapeList(data));
        }
        
        // 2. SEARCH
        if (type === 'search' && q) {
            const searchUrl = 'https://justnaija.com' + pageNum + '/?s=' + encodeURIComponent(q);
            const { data } = await axios.get(searchUrl, AXIOS_CONFIG);
            return res.status(200).json(scrapeList(data));
        }

        // 3. STREAM (Optimized)
        if (type === 'stream' && url) {
            try {
                let response = await axios.get(url, AXIOS_CONFIG);
                let $ = cheerio.load(response.data);
                let candidates = [];
                
                // Fast Scan for links
                $('a').each((i, el) => {
                    const h = $(el).attr('href');
                    if (!h) return;
                    // Strict Bad Link Filters
                    if (h.includes('ainouzaudre') || h.includes('adsterra') || h.includes('google') || h.includes('facebook') || h.includes('whatsapp')) return; 
                    
                    if (h.endsWith('.mp3')) candidates.unshift(h); // High priority
                    else if ($(el).text().toLowerCase().includes('download')) candidates.push(h); // Low priority
                });

                if (candidates.length === 0) return res.status(404).json({ error: "No valid link found" });

                let bestLink = candidates[0];

                // Single Hop check (only if not MP3)
                if (!bestLink.endsWith('.mp3')) {
                     try {
                        const page2 = await axios.get(bestLink, AXIOS_CONFIG);
                        const $2 = cheerio.load(page2.data);
                        let finalMp3 = "";
                        $2('a').each((i, el) => {
                            if ($(el).attr('href')?.endsWith('.mp3')) finalMp3 = $(el).attr('href');
                        });
                        if (finalMp3) bestLink = finalMp3;
                     } catch(err) {
                         // If hop fails, return original link (might be direct anyway)
                     }
                }
                return res.status(200).json({ url: bestLink });
            } catch (err) {
                return res.status(500).json({ error: "Source timeout: " + err.message });
            }
        }
        res.status(400).json({ error: "Bad Request" });
    } catch (e) { 
        // Always return JSON error, never crash
        res.status(500).json({ error: e.message }); 
    }
};

function scrapeList(html) {
    const $ = cheerio.load(html);
    const songs = [];
    
    // Generic selector to catch everything
    $('article, .post, .type-post, .search-result, .entry').each((i, el) => {
        try {
            const titleEl = $(el).find('h2 a, h3 a, .entry-title a').first();
            const title = titleEl.text().trim();
            const link = titleEl.attr('href');
            
            // Try multiple image sources
            let img = $(el).find('img').first().attr('data-src') || 
                      $(el).find('img').first().attr('src');
            
            if (title && link) {
                songs.push({ title, link, img });
            }
        } catch(e) {}
    });
    return songs;
}
module.exports = allowCors(handler);
