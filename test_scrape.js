const axios = require('axios');
const cheerio = require('cheerio');

async function test(url) {
    console.log(`Scraping ${url}...`);
    try {
        const { data } = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        const $ = cheerio.load(data);
        console.log('Page Title:', $('title').text());

        const bodyText = $('body').text();
        console.log('Body length:', bodyText.length);

        const idx = data.indexOf('分類');
        if (idx !== -1) {
            console.log('Found "分類" at', idx);
            console.log('Context:', data.substring(idx - 100, idx + 200).replace(/\n/g, ' '));
        } else {
            console.log('"分類" NOT found in raw HTML');
        }

        const listIdx = data.indexOf('article-list');
        if (listIdx !== -1) {
            console.log('Found "article-list" at', listIdx);
            console.log('Context:', data.substring(listIdx - 100, listIdx + 200).replace(/\n/g, ' '));
        }


        console.log('Meta Keywords:', $('meta[name="keywords"]').attr('content'));
        console.log('Article Tag:', $('meta[property="article:tag"]').map((i, el) => $(el).attr('content')).get());

        // Also check "keyword" class again
        console.log('Class .keyword count:', $('.keyword').length);

    } catch (e) {
        console.error(e.message);
    }
}

test('https://lolwarden.pixnet.net/blog/posts/12177133849');
test('https://lolwarden.pixnet.net/blog/posts/12082031214');
