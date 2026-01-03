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

        // Skip if date is trying to be fixed but already looks "good" (not today's date)? 
        // No, user said ALL are wrong.

        console.log(`[${file}] Fetching...`);

        try {
            const { data } = await axios.get(originalUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                },
                timeout: 10000
            });
            const $ = cheerio.load(data);

            let newDate = null;
            let method = '';

            // Strategy 1: JSON-LD
            const jsonLd = $('script[type="application/ld+json"]').html();
            if (jsonLd) {
                try {
                    const jsonData = JSON.parse(jsonLd);
                    const rawDate = jsonData.datePublished || (jsonData['@graph'] ? jsonData['@graph'].find(i => i.datePublished)?.datePublished : null);
                    if (rawDate) {
                        newDate = new Date(rawDate);
                        method = 'JSON-LD';
                    }
                } catch (e) { }
            }

            // Strategy 2: Meta Tag
            if (!newDate) {
                const metaDate = $('meta[property="article:published_time"]').attr('content');
                if (metaDate) {
                    newDate = new Date(metaDate);
                    method = 'Meta Tag';
                }
            }

            // Strategy 3: Pixnet Specific HTML structure
            if (!newDate) {
                const month = $('.publish-date .month').text().trim(); // "Oct"
                const day = $('.publish-date .day').text().trim();     // "23"
                const year = $('.publish-date .year').text().trim();   // "2020"
                const time = $('.publish-date .time').text().trim();   // "15:52"

                if (month && day && year) {
                    const dateStr = `${month} ${day} ${year} ${time}`;
                    newDate = new Date(dateStr);
                    method = 'Pixnet HTML (.publish-date)';
                }
            }

            // Strategy 4: Fallback .publish-date text
            if (!newDate) {
                const rawText = $('.publish-date').text().trim();
                if (rawText.length > 5) {
                    newDate = new Date(rawText);
                    method = 'Pixnet HTML (text)';
                }
            }

            if (newDate && !isNaN(newDate.getTime())) {
                const newDateISO = newDate.toISOString();
                content = content.replace(/date: ".*"/, `date: "${newDateISO}"`);
                fs.writeFileSync(filePath, content);
                console.log(`  -> Fixed: ${newDateISO} (${method})`);
            } else {
                console.log(`  -> Failed to find valid date. HTML of .publish-date:`);
                console.log('     ', $('.publish-date').html()?.substring(0, 100));
            }

            await sleep(500); // polite delay

        } catch (e) {
            console.error(`  -> Network/Parse Error: ${e.message}`);
        }
    }
}

fixDates();
