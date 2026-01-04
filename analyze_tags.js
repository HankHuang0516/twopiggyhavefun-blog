const fs = require('fs');
const path = require('path');

const POSTS_DIR = path.join(__dirname, 'src/content/posts');

// Simplified category logic to detecting "Uncategorized"
const CATEGORIES = ['food', 'travel', 'hotel', 'unboxing', 'parenting', 'foreign', 'wedding']; // simplistic check just for recognized tags

function main() {
    const files = fs.readdirSync(POSTS_DIR).filter(f => f.endsWith('.md'));
    const tagCounts = {};
    let uncategorizedCount = 0;

    for (const file of files) {
        const content = fs.readFileSync(path.join(POSTS_DIR, file), 'utf-8');
        const tagsMatch = content.match(/tags:\s*\[(.+?)\]/);

        const tags = tagsMatch
            ? tagsMatch[1].split(',').map(t => t.trim().replace(/["']/g, ''))
            : [];

        // Check if any tag matches a main category (simplistic check)
        // In reality, categorizer maps specific region tags too.
        // But let's seeing what raw tags reside in files that DON'T have a clear category tag yet.

        // This is tricky because `auto_categorize.js` adds the category tag (e.g. "food") *if* it finds it.
        // If it didn't modify the file, it means it didn't find "food".
        // So checking if "food" is in tags is a good proxy.

        const hasCategory = tags.some(t => CATEGORIES.includes(t) || ['taipei', 'newtaipei', 'yilan'].includes(t)); // incomplete list but okay for analysis

        if (!hasCategory) {
            uncategorizedCount++;
            tags.forEach(t => {
                if (t === 'pixnet') return;
                tagCounts[t] = (tagCounts[t] || 0) + 1;
            });
        }
    }

    console.log(`Uncategorized Files: ${uncategorizedCount}`);

    // Print titles of uncategorized
    console.log('--- Sample Uncategorized Titles ---');
    let titleCount = 0;
    for (const file of files) {
        if (titleCount >= 50) break;
        const content = fs.readFileSync(path.join(POSTS_DIR, file), 'utf-8');
        const tagsMatch = content.match(/tags:\s*\[(.+?)\]/);
        const tags = tagsMatch ? tagsMatch[1].split(',').map(t => t.trim().replace(/["']/g, '')) : [];
        const hasCategory = tags.some(t => CATEGORIES.includes(t) || ['taipei', 'newtaipei', 'yilan'].includes(t)); // simplistic check

        if (!hasCategory) {
            const titleMatch = content.match(/title:\s*["']?(.+?)["']?\s*\n/);
            if (titleMatch) {
                console.log(titleMatch[1]);
                titleCount++;
            }
        }
    }

    const sorted = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]);
    console.log('Top 50 Unmapped Tags:');
    sorted.slice(0, 50).forEach(([tag, count]) => {
        console.log(`${tag}: ${count}`);
    });
}

main();
