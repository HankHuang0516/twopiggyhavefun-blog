const fs = require('fs');
const cheerio = require('cheerio');

const html = fs.readFileSync('debug_output.html', 'utf8');
const $ = cheerio.load(html);

// Find JSON-LD
const scripts = $('script[type="application/ld+json"]');
let found = false;

scripts.each((i, el) => {
    try {
        const json = JSON.parse($(el).html());
        if (json['@type'] === 'BlogPosting' && json.articleBody) {
            console.log('Found BlogPosting!');
            const body = json.articleBody;
            const idx = body.indexOf('文章目錄');
            if (idx !== -1) {
                console.log('--- TOC Context ---');
                console.log(body.substring(idx - 100, idx + 500));
                console.log('-------------------');
            } else {
                console.log('TOC "文章目錄" not found in articleBody.');
            }
            found = true;
        }
    } catch (e) {
        console.error('Error parsing JSON:', e.message);
    }
});

if (!found) {
    console.log('No BlogPosting JSON-LD found.');
}
