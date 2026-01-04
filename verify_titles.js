const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');
const matter = require('gray-matter');

const postsDir = path.join(__dirname, 'src', 'content', 'posts');

// Helper to wait
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function verifyTitles() {
    console.log('Starting regression test: Verifying 15 random articles...');

    const files = fs.readdirSync(postsDir).filter(f => f.endsWith('.md'));
    const totalFiles = files.length;

    // Shuffle and pick 15
    const selectedFiles = files.sort(() => 0.5 - Math.random()).slice(0, 15);

    let passed = 0;
    let failed = 0;

    for (const file of selectedFiles) {
        const filePath = path.join(postsDir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        const parsed = matter(content);
        const data = parsed.data;

        if (!data.originalUrl || !data.originalUrl.includes('pixnet.net')) {
            console.log(`⚠️ Skipping ${file}: No valid Pixnet URL`);
            continue;
        }

        try {
            console.log(`Checking ${file} (${data.category || 'No Category'})...`);
            console.log(`  Current Title: ${data.title}`);

            const response = await axios.get(data.originalUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                },
                timeout: 10000
            });

            const $ = cheerio.load(response.data);

            let pixnetTitle = $('meta[property="og:title"]').attr('content');
            if (!pixnetTitle) pixnetTitle = $('.article-content-title').text().trim();
            if (!pixnetTitle) pixnetTitle = $('title').text().trim().split('::')[0].trim().split('@')[0].trim();

            if (pixnetTitle) {
                // Clean suffixes
                pixnetTitle = pixnetTitle.replace(/ @ 兩隻小豬 :: 痞客邦 ::.*/, '').trim();

                // Validation
                // We allow minor differences (like whitespace), but the main text should match.
                // Or rather, we expect exact match if our fix script worked perfectly.

                if (data.title === pixnetTitle) {
                    console.log(`  ✅ Match!`);
                    passed++;
                } else {
                    console.warn(`  ❌ Mismatch!`);
                    console.warn(`     Expected: ${pixnetTitle}`);
                    console.warn(`     Actual:   ${data.title}`);
                    failed++;
                }
            } else {
                console.warn(`  ⚠️ Could not fetch title from Pixnet for verification.`);
            }

            await sleep(500);

        } catch (error) {
            console.error(`  ❌ Error verifying ${file}: ${error.message}`);
            failed++;
        }
    }

    console.log('\n--- Test Results ---');
    console.log(`Total: ${passed + failed}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);

    if (failed === 0) {
        console.log('✨ Regression Test PASSED!');
    } else {
        console.log('🚨 Regression Test FAILED!');
    }
}

verifyTitles();
