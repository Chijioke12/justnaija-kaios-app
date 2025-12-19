
const axios = require('axios');
const cheerio = require('cheerio');
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
        // 1. LIST SONGS (Home)
        if (type === 'list') {
            const { data } = await axios.get('https://justnaija.com' + pageNum);
            return res.status(200).json(scrapeList(data));
        }
        
        // 2. SEARCH (Updated Selectors)
        if (type === 'search' && q) {
            // Standard WordPress Search URL
            const searchUrl = 'https://justnaija.com' + pageNum + '/?s=' + encodeURIComponent(q);
            const { data } = await axios.get(searchUrl);
            return res.status(200).json(scrapeList(data));
        }

        // 3. STREAM (Previous working logic)
        if (type === 'stream' && url) {
            let response = await axios.get(url);
            let $ = cheerio.load(response.data);
            let candidates = [];
            $('a').each((i, el) => {
                const h = $(el).attr('href');
                const t = $(el).text().toLowerCase();
                if (!h) return;
                if (h.includes('ainouzaudre') || h.includes('adsterra') || h.includes('google')) return; 
                if (h.endsWith('.mp3') || t.includes('download mp3') || t.includes('download audio')) candidates.push(h);
            });

            if (candidates.length === 0) return res.status(404).json({ error: "No link" });
            let bestLink = candidates.find(link => link.endsWith('.mp3')) || candidates[0];
            
            // Redirect check
            if (!bestLink.endsWith('.mp3')) {
                try {
                    const page2 = await axios.get(bestLink);
                    const $2 = cheerio.load(page2.data);
                    let finalMp3 = "";
                    $2('a').each((i, el) => {
                        const h = $(el).attr('href');
                        if (h && h.endsWith('.mp3')) finalMp3 = h;
                    });
                    if (finalMp3) bestLink = finalMp3;
                } catch(e) {}
            }
            return res.status(200).json({ url: bestLink });
        }
        res.status(400).json({ error: "Bad Request" });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

function scrapeList(html) {
    const $ = cheerio.load(html);
    const songs = [];
    
    // BROAD SELECTOR: Matches Articles, Search Results, Posts, etc.
    $('article, .post, .type-post, .search-result').each((i, el) => {
        const title = $(el).find('h2 a').text() || $(el).find('h3 a').text() || $(el).find('.entry-title a').text();
        const link = $(el).find('h2 a').attr('href') || $(el).find('h3 a').attr('href') || $(el).find('.entry-title a').attr('href');
        
        // Image finder
        let img = $(el).find('img').attr('data-src') || 
                  $(el).find('img').attr('data-lazy-src') || 
                  $(el).find('img').attr('src');
        
        if (title && link) {
            songs.push({ title: title.trim(), link, img });
        }
    });
    return songs;
}
module.exports = allowCors(handler);
