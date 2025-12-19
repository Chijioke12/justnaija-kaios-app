
const axios = require('axios');
const cheerio = require('cheerio');

// Use a MOBILE User-Agent because we are accessing 'wap.justnaija.com'
const AXIOS_CONFIG = {
    headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
        'Referer': 'https://wap.justnaija.com/',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
    },
    timeout: 15000 // 15 seconds
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
            const { data } = await axios.get('https://wap.justnaija.com' + pageNum, AXIOS_CONFIG);
            return res.status(200).json(scrapeList(data));
        }
        
        // 2. SEARCH
        if (type === 'search' && q) {
            const searchUrl = 'https://wap.justnaija.com/search' + pageNum + '?q=' + encodeURIComponent(q);
            const { data } = await axios.get(searchUrl, AXIOS_CONFIG);
            return res.status(200).json(scrapeList(data));
        }

        // 3. STREAM
        if (type === 'stream' && url) {
            let response = await axios.get(url, AXIOS_CONFIG);
            let $ = cheerio.load(response.data);
            let candidates = [];
            $('a').each((i, el) => {
                const h = $(el).attr('href');
                if (!h) return;
                if (h.includes('ainouzaudre') || h.includes('adsterra')) return; 
                if (h.endsWith('.mp3')) candidates.unshift(h); 
                else if ($(el).text().toLowerCase().includes('download')) candidates.push(h); 
            });

            if (candidates.length === 0) return res.status(200).json({ error: "No MP3 link found on page" });

            let bestLink = candidates[0];
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
        }
        res.status(400).json({ error: "Bad Request" });

    } catch (e) {
        // CATCH ALL ERRORS AND RETURN AS JSON (Prevents Err 500)
        console.error(e);
        const msg = e.response ? ("Server Error: " + e.response.status) : e.message;
        res.status(200).json({ error: msg }); 
    }
};

function scrapeList(html) {
    const $ = cheerio.load(html);
    const songs = [];
    $('article, .post, .type-post, .search-result, .entry, .list-item').each((i, el) => {
        try {
            const titleEl = $(el).find('h2 a, h3 a, .entry-title a, a').first();
            let title = titleEl.text().trim().replace(/download mp3/gi, '').replace(/[music]/gi, '').trim();
            const link = titleEl.attr('href');
            let img = $(el).find('img').first().attr('data-src') || $(el).find('img').first().attr('src');
            if (title && link) songs.push({ title, link, img });
        } catch(e) {}
    });
    return songs;
}
module.exports = allowCors(handler);
