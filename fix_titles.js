const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');
const matter = require('gray-matter');

const postsDir = path.join(__dirname, 'src', 'content', 'posts');

// Helper to wait
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fixTitles() {
    const files = fs.readdirSync(postsDir).filter(f => f.endsWith('.md'));
    console.log(`Found ${files.length} posts to check.`);

    let updatedCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    // Concurrency control
    const CONCURRENCY = 15;
    let activeRequests = 0;

    // Process queue
    const queue = [...files];
    const promises = [];

    const processFile = async (file) => {
        const filePath = path.join(postsDir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        const parsed = matter(content);
        const data = parsed.data;

        // Validations
        if (!data.originalUrl || !data.originalUrl.includes('pixnet.net')) {
            skippedCount++;
            return;
        }

        // Optimization: Check if title is likely already correct
        // If it DOES NOT start with "**", it might be correct?
        // But let's verify everything to be safe as user demanded consistency.
        // Actually, preventing re-scraping of "already fixed" files is good.
        // Let's assume if we just updated it, it's fine. 
        // But since I killed the previous process, I don't know which ones are 100% done except by checking the file content.

        try {
            // console.log(`Processing ${file} ...`); // Too noisy
            const response = await axios.get(data.originalUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                },
                timeout: 10000
            });

            const $ = cheerio.load(response.data);

            let newTitle = $('meta[property="og:title"]').attr('content');

            if (!newTitle) {
                newTitle = $('.article-content-title').text().trim();
            }

            if (!newTitle) {
                newTitle = $('title').text().trim();
                // Remove site name if present "Title @ Site Name"
                if (newTitle.includes('::')) newTitle = newTitle.split('::')[0].trim();
                if (newTitle.includes('@')) newTitle = newTitle.split('@')[0].trim();
            }

            if (newTitle) {
                // Clean suffix
                newTitle = newTitle.replace(/ @ 兩隻小豬 :: 痞客邦 ::.*/, '').trim();

                // Clean prefixes if any (Pixnet sometimes adds them in og:title too?)
                // e.g. "*桃園冰品*" is fine, keep it.

                if (newTitle !== data.title) {
                    process.stdout.write('+'); // Indicate update
                    data.title = newTitle;
                    const newContent = matter.stringify(parsed.content, data);
                    fs.writeFileSync(filePath, newContent);
                    updatedCount++;
                } else {
                    process.stdout.write('.'); // Indicate skip
                    skippedCount++;
                }
            } else {
                process.stdout.write('?'); // Indicate missing title
                console.warn(`\n⚠️ Could not find title for ${file}`);
            }

        } catch (error) {
            process.stdout.write('x'); // Indicate error
            // console.error(`\n❌ Error processing ${file}: ${error.message}`);
            errorCount++;
        }
    };

    // Worker loop
    const workers = [];
    for (let i = 0; i < CONCURRENCY; i++) {
        workers.push((async () => {
            while (queue.length > 0) {
                const file = queue.shift();
                await processFile(file);
                // Tiny delay to spread out requests slightly
                await sleep(100);
            }
        })());
    }

    await Promise.all(workers);

    console.log(`\n\nFinished!`);
    console.log(`Updated: ${updatedCount}`);
    console.log(`Skipped: ${skippedCount}`);
    console.log(`Errors:  ${errorCount}`);
}

fixTitles();
