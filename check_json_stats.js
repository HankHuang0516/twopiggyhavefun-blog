const fs = require('fs');

const db = JSON.parse(fs.readFileSync('pixnet_articles_db.json', 'utf8'));
const done = JSON.parse(fs.readFileSync('two_piggy_mark_done.json', 'utf8'));

const totalArticles = db[0].articles.length;
const doneUrls = new Set();

done.forEach(item => {
    if (item.urls) {
        item.urls.forEach(url => doneUrls.add(url));
    }
});

console.log(`Total Articles in DB: ${totalArticles}`);
console.log(`Total Done URLs: ${doneUrls.size}`);

const dbUrls = new Set(db[0].articles.map(a => a.articleUrl));
const pending = [...dbUrls].filter(url => !doneUrls.has(url));

console.log(`Pending Articles: ${pending.length}`);

if (pending.length > 0) {
    console.log('First 5 pending URLs:');
    console.log(pending.slice(0, 5));
}
