const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'pixnet_categories.json');
const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));

const total = db.articles.length;
const withCats = db.articles.filter(a => a.pixnetCategories && a.pixnetCategories.length > 0).length;
const withTags = db.articles.filter(a => a.pixnetTags && a.pixnetTags.length > 0).length;

console.log(`Total: ${total}`);
console.log(`With Categories: ${withCats}`);
console.log(`With Tags: ${withTags}`);

if (withCats > 0) {
    console.log('Sample Category:', db.articles.find(a => a.pixnetCategories.length > 0).pixnetCategories);
}
