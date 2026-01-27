const fs = require('fs');
const path = require('path');

const POSTS_DIR = path.join(__dirname, '../src/content/posts');

const article1 = 'pixnet-852549836922664544.md';
const article2 = 'pixnet-855315645961059971.md';

let hasError = false;

function checkDetails(file, checks) {
    const filePath = path.join(POSTS_DIR, file);
    if (!fs.existsSync(filePath)) {
        console.error(`❌ File not found: ${file}`);
        hasError = true;
        return;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    let errors = [];

    checks.forEach(check => {
        if (!check.fn(content)) {
            errors.push(check.msg);
        }
    });

    if (errors.length > 0) {
        console.error(`❌ Verification failed for ${file}:`);
        errors.forEach(e => console.error(`   - ${e}`));
        hasError = true;
    } else {
        console.log(`✅ ${file} passed verification.`);
    }
}

console.log('🔍 Verifying fixed articles...');

// 1. Outlet Article - Must have images
checkDetails(article1, [
    {
        fn: c => /!\[.*?\]\(http/.test(c) || /<img src=/.test(c),
        msg: 'Missing images (expected markdown image or HTML img tag)'
    },
    {
        fn: c => c.length > 1000,
        msg: 'Content seemingly too short'
    }
]);

// 2. WishlistAI Article - Must NOT have raw CSS/JSON artifacts
checkDetails(article2, [
    {
        fn: c => !c.includes('body { font-family'),
        msg: 'Contains raw CSS code (body { ...)'
    },
    {
        fn: c => !c.includes('application/ld+json'),
        msg: 'Contains raw JSON-LD script tag'
    },
    {
        fn: c => !c.includes('.feature-card'),
        msg: 'Contains CSS class definitions (.feature-card)'
    }
]);

if (hasError) {
    console.error('FAILED: Critical articles are not correct.');
    process.exit(1);
} else {
    console.log('SUCCESS: All critical articles look correct.');
}
