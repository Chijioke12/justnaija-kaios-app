
const axios = require('axios');
const cheerio = require('cheerio');

// Helper to handle CORS
const allowCors = fn => async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  return await fn(req, res);
};

const handler = async (req, res) => {
    const { type, url } = req.query;
    try {
        if (type === 'list') {
            const { data } = await axios.get('https://justnaija.com');
            const $ = cheerio.load(data);
            const songs = [];
            $('article').each((i, el) => {
                const title = $(el).find('h2 a').text() || $(el).find('h3 a').text();
                const link = $(el).find('h2 a').attr('href') || $(el).find('h3 a').attr('href');
                if (title && link) songs.push({ title: title.trim(), link });
            });
            return res.status(200).json(songs);
        } 
        if (type === 'stream' && url) {
            const { data } = await axios.get(url);
            const $ = cheerio.load(data);
            let mp3 = "";
            $('a').each((i, el) => {
                const h = $(el).attr('href');
                if (h && (h.endsWith('.mp3') || $(el).text().toLowerCase().includes('download'))) mp3 = h;
            });
            return mp3 ? res.status(200).json({ url: mp3 }) : res.status(404).json({ error: "Not found" });
        }
        res.status(400).json({ error: "Bad Request" });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

module.exports = allowCors(handler);
