const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');

const POSTS_DIR = 'src/content/posts';

// Helper to delay
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function fixDates() {
    const files = fs.readdirSync(POSTS_DIR).filter(f => f.endsWith('.md'));

    console.log(`Checking dates for ${files.length} posts...`);

    for (const file of files) {
        const filePath = path.join(POSTS_DIR, file);
        let content = fs.readFileSync(filePath, 'utf-8');

        // Extract original URL
        const urlMatch = content.match(/originalUrl: "(.*)"/);
        if (!urlMatch) continue;
        const originalUrl = urlMatch[1];

        console.log(`[${file}] Fetching date from ${originalUrl}...`);

        try {
            const { data } = await axios.get(originalUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                },
                timeout: 10000
            });
            const $ = cheerio.load(data);

            // Try different selectors for date
            // Pixnet usually has .publish-date or .article-date inside .article-header
            let dateStr = $('.publish-date').text().trim() ||
                $('.article-date').text().trim() ||
                $('.date').text().trim() ||
                $('span.time').text().trim(); // sometimes it's just a span with time class

            // Sometimes date is in the format "Oct 12 2023" or "2023-10-12"
            // We need to parse it.
            if (dateStr) {
                // Prepare date object
                const date = new Date(dateStr);
                if (!isNaN(date.getTime())) {
                    // Update frontmatter
                    const newDateISO = date.toISOString();
                    content = content.replace(/date: ".*"/, `date: "${newDateISO}"`);
                    fs.writeFileSync(filePath, content);
                    console.log(`  Updated to ${newDateISO}`);
                } else {
                    console.log(`  Could not parse date: ${dateStr}`);
                }
            } else {
                console.log(`  No date found in HTML.`);
            }

            await sleep(1000); // polite delay

        } catch (e) {
            console.error(`  Failed: ${e.message}`);
        }
    }
}

fixDates();
