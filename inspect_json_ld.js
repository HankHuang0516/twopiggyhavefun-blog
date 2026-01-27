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
            console.log('articleBody length:', json.articleBody.length);
            console.log('Start:', json.articleBody.substring(0, 100));
            console.log('End:', json.articleBody.substring(json.articleBody.length - 100));
            found = true;
        }
    } catch (e) {
        console.error('Error parsing JSON:', e.message);
    }
});

if (!found) {
    console.log('No BlogPosting JSON-LD found.');
}
