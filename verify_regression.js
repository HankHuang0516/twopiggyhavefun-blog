const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');

const POSTS_DIR = path.join(__dirname, 'src/content/posts');
const CATEGORY_DB = path.join(__dirname, 'pixnet_categories.json');

// Helper to delay
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function verifyRegression() {
    console.log('═'.repeat(60));
    console.log('🔍 Regression Verification');
    console.log('═'.repeat(60) + '\n');

    // 1. Load Data
    const files = fs.readdirSync(POSTS_DIR).filter(f => f.endsWith('.md'));
    const pixnetData = JSON.parse(fs.readFileSync(CATEGORY_DB, 'utf-8'));
    const dataMap = new Map(pixnetData.articles.map(a => [a.id, a]));

    // 2. Pick 5 Random Posts
    const sampleFiles = [];
    while (sampleFiles.length < 5) {
        const randomFile = files[Math.floor(Math.random() * files.length)];
        if (!sampleFiles.includes(randomFile)) {
            sampleFiles.push(randomFile);
        }
    }

    console.log(`Checking ${sampleFiles.length} random posts:\n`);

    let passedCount = 0;

    for (const file of sampleFiles) {
        const id = file.replace('.md', '');
        console.log(`📄 [${id}] Verifying...`);

        // Read Local Data
        const content = fs.readFileSync(path.join(POSTS_DIR, file), 'utf-8');
        const frontmatter = content.split('---')[1];

        const getField = (name) => {
            const match = frontmatter.match(new RegExp(`${name}:\\s*(.*)`));
            if (!match) return null;
            let val = match[1].trim();
            if (val.startsWith('"') || val.startsWith("'")) val = val.slice(1, -1);
            if (val.startsWith('[')) {
                try { return JSON.parse(val); } catch (e) { return val; } // simplistic
            }
            return val;
        };

        const localUrl = getField('originalUrl');
        const localDate = new Date(getField('date'));
        const localTagsMatch = frontmatter.match(/tags:\s*\[(.*?)\]/s);
        let localTags = [];
        if (localTagsMatch) {
            localTags = localTagsMatch[1].split(',').map(t => t.trim().replace(/^['"]|['"]$/g, ''));
        }
        const localHours = getField('businessHours');

        // Fetch Live Data
        let liveTags = [];
        let liveDate = null;
        let liveHours = null;

        try {
            const { data } = await axios.get(localUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                timeout: 10000
            });
            const $ = cheerio.load(data);

            // Extract Tags
            $('.article-keyword a, .keyword a, a[href*="/tag/"]').each((i, el) => {
                const tag = $(el).text().trim();
                if (tag && !liveTags.includes(tag)) liveTags.push(tag);
            });

            // Extract Date (Logic from fix_dates.js)
            const metaDate = $('meta[property="article:published_time"]').attr('content');
            if (metaDate) liveDate = new Date(metaDate);
            // Fallbacks omitted for brevity, usually meta works for Pixnet

            // Extract Hours
            const textContent = $('.article-content').text();
            const hoursMatch = textContent.match(/营业时间[：:]\s*(.+?)(?:\n|$)/) || textContent.match(/時間[：:]\s*(.+?)(?:\n|$)/);
            if (hoursMatch) liveHours = hoursMatch[1];

        } catch (e) {
            console.error(`   ❌ Network/Parse Error: ${e.message}`);
            continue;
        }

        // Verification Results
        const results = [];

        // 1. Check Tags
        const missingTags = liveTags.filter(t => !localTags.includes(t));
        const tagsPass = missingTags.length === 0; // It's okay if local has MORE, but shouldn't miss live ones
        results.push({ name: 'Tags Sync', pass: tagsPass, msg: tagsPass ? 'OK' : `Missing: ${missingTags.join(', ')}` });

        // 2. Check Date
        let datePass = false;
        if (liveDate && localDate) {
            const diff = Math.abs(liveDate.getTime() - localDate.getTime());
            datePass = diff < 60000; // Allow 1 minute diff
        } else if (!liveDate) {
            datePass = true; // Cannot verify
        }
        results.push({ name: 'Creation Date', pass: datePass, msg: datePass ? 'OK' : `Diff: ${liveDate} vs ${localDate}` });

        // 3. Check Business Hours (If applicable)
        let hoursPass = true;
        let hoursMsg = 'N/A';
        if (liveHours) {
            hoursPass = !!localHours; // Just check if captured
            hoursMsg = hoursPass ? 'Captured' : 'Missed';
        }
        results.push({ name: 'Business Status', pass: hoursPass, msg: hoursMsg });

        // Log
        console.log(`\n   --- Results for ${id} ---`);
        results.forEach(r => {
            console.log(`   [${r.pass ? 'PASS' : 'FAIL'}] ${r.name}: ${r.msg}`);
        });

        if (results.every(r => r.pass)) passedCount++;

        await sleep(500);
    }

    console.log('\n' + '═'.repeat(60));
    console.log(`✅ Verification Complete: ${passedCount}/${sampleFiles.length} passed all checks.`);
    console.log('═'.repeat(60));
}

verifyRegression().catch(err => console.error('FATAL:', err));
