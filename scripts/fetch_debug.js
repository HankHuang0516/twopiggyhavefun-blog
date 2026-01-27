const { fetchUrl } = require('./pixnet_sync');
const fs = require('fs');

async function fetchArticle() {
    const url = 'https://lolwarden.pixnet.net/blog/posts/855315645961059971';
    console.log(`Fetching ${url}...`);
    try {
        const html = await fetchUrl(url);
        fs.writeFileSync('article_debug.html', html);
        console.log('Saved article_debug.html');
    } catch (e) {
        console.error(e);
    }
}

fetchArticle();
