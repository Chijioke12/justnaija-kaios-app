
const axios = require('axios');
const cheerio = require('cheerio');

// CONFIG
const AXIOS_CONFIG = {
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://wap.justnaija.com/'
    },
    timeout: 10000 
};

const allowCors = fn => async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  return await fn(req, res);
};

const handler = async (req, res) => {
    const { type, url, q, page } = req.query;
    // JustNaija pagination style: /page/2
    const pageNum = page ? '/page/' + page : '';

    try {
        // 1. LIST SONGS (Home)
        if (type === 'list') {
            const { data } = await axios.get('https://wap.justnaija.com' + pageNum, AXIOS_CONFIG);
            return res.status(200).json(scrapeList(data));
        }
        
        // 2. SEARCH (FIXED: Using the form action from your HTML)
        if (type === 'search' && q) {
            // Your HTML showed: action="https://wap.justnaija.com/search" name="q"
            // Pagination for search usually appends to the query or follows standard pattern.
            // We will try standard query param first.
            const searchUrl = 'https://wap.justnaija.com/search' + pageNum + '?q=' + encodeURIComponent(q);
            const { data } = await axios.get(searchUrl, AXIOS_CONFIG);
            return res.status(200).json(scrapeList(data));
        }

        // 3. STREAM (Link Extractor)
        if (type === 'stream' && url) {
            try {
                let response = await axios.get(url, AXIOS_CONFIG);
                let $ = cheerio.load(response.data);
                let candidates = [];
                
                $('a').each((i, el) => {
                    const h = $(el).attr('href');
                    if (!h) return;
                    if (h.includes('ainouzaudre') || h.includes('adsterra') || h.includes('google')) return; 
                    
                    if (h.endsWith('.mp3')) candidates.unshift(h); 
                    else if ($(el).text().toLowerCase().includes('download')) candidates.push(h); 
                });

                if (candidates.length === 0) return res.status(404).json({ error: "No valid link" });

                let bestLink = candidates[0];

                // Single Hop (if not MP3)
                if (!bestLink.endsWith('.mp3')) {
                     try {
                        const page2 = await axios.get(bestLink, AXIOS_CONFIG);
                        const $2 = cheerio.load(page2.data);
                        let finalMp3 = "";
                        $2('a').each((i, el) => {
                            if ($(el).attr('href')?.endsWith('.mp3')) finalMp3 = $(el).attr('href');
                        });
                        if (finalMp3) bestLink = finalMp3;
                     } catch(err) {}
                }
                return res.status(200).json({ url: bestLink });
            } catch (err) {
                return res.status(500).json({ error: "Timeout: " + err.message });
            }
        }
        res.status(400).json({ error: "Bad Request" });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

function scrapeList(html) {
    const $ = cheerio.load(html);
    const songs = [];
    
    // Broad selector for Wap site
    $('article, .post, .type-post, .search-result, .entry, .list-item').each((i, el) => {
        try {
            const titleEl = $(el).find('h2 a, h3 a, .entry-title a, a').first();
            let title = titleEl.text().trim();
            const link = titleEl.attr('href');
            
            // Cleanup Title
            title = title.replace(/download mp3/gi, '').replace(/[music]/gi, '').replace(/[album]/gi, '').trim();

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
