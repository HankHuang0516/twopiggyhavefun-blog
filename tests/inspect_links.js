const fs = require('fs');
const cheerio = require('cheerio');

const html = fs.readFileSync('debug_page.html', 'utf8');
const $ = cheerio.load(html);

console.log('--- Links Inspection ---');
$('a').each((i, el) => {
    const $el = $(el);
    const href = $el.attr('href');
    const text = $el.text().trim().substring(0, 50);
    const cls = $el.attr('class') || '';
    const style = $el.attr('style') || '';

    // Check if it wraps block elements
    const hasBlockChildren = $el.find('div, p, h1, h2, h3, article, section').length > 0;

    console.log(`[${i}] Text: "${text}" | Href: ${href} | Class: ${cls} | BlockChildren: ${hasBlockChildren}`);
});
console.log('--- End Inspection ---');
