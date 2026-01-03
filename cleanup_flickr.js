const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');

const POSTS_DIR = 'src/content/posts';
const PUBLIC_DIR = 'public';

// Helper to delay
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function processFile(file) {
    const filePath = path.join(POSTS_DIR, file);
    let content = fs.readFileSync(filePath, 'utf-8');

    // Extract Metadata
    const OriginalUrlMatch = content.match(/originalUrl: "(.*)"/);
    const originalUrl = OriginalUrlMatch ? OriginalUrlMatch[1] : null;

    if (!originalUrl) return;

    console.log(`[Processing] ${file} -> ${originalUrl}`);

    try {
        const { data } = await axios.get(originalUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Referer': 'https://www.pixnet.net/'
            }
        });

        const $ = cheerio.load(data);
        const contentContainer = $('#article-content-inner');
        const imgs = contentContainer.find('img').toArray();

        let modified = false;
        let deletedCount = 0;

        for (let i = 0; i < imgs.length; i++) {
            const el = imgs[i];
            const src = $(el).attr('src');
            if (!src) continue;

            const cleanSrc = src.startsWith('//') ? 'https:' + src : src;

            // Check if it's a Flickr image
            if (cleanSrc.includes('flickr.com')) {
                // Determine local filename logic matching scrape_pixnet.js
                // const filename = `${i}${ext}`;
                const ext = path.extname(cleanSrc.split('?')[0]) || '.jpg';
                const expectedFilename = `${i}${ext}`;
                const postId = path.basename(file, '.md'); // e.g., 12189377245

                const localRelPath = `/images/posts/${postId}/${expectedFilename}`;
                const localAbsPath = path.join(PUBLIC_DIR, 'images', 'posts', postId, expectedFilename);

                // 1. Replace in Content
                if (content.includes(localRelPath)) {
                    content = content.replace(localRelPath, cleanSrc);
                    modified = true;
                    // console.log(`  [Link] Replaced ${localRelPath} with ${cleanSrc}`);
                }

                // 2. Delete Local File
                if (fs.existsSync(localAbsPath)) {
                    fs.unlinkSync(localAbsPath);
                    deletedCount++;
                    // console.log(`  [Delete] Removed ${localAbsPath}`);
                }
            }
        }

        if (modified) {
            fs.writeFileSync(filePath, content);
            console.log(`  => Updated MD file. Removed ${deletedCount} local images.`);
        } else {
            console.log(`  => No Flickr images found/replaced.`);
        }

        await sleep(1000); // Polite delay

    } catch (e) {
        if (e.response && e.response.status === 429) {
            console.log(`  [429] Rate limited. Sleeping 10s...`);
            await sleep(10000);
        } else {
            console.error(`  [Error] ${e.message}`);
        }
    }
}

async function main() {
    const files = fs.readdirSync(POSTS_DIR).filter(f => f.endsWith('.md'));
    console.log(`Scanning ${files.length} posts...`);

    for (const file of files) {
        await processFile(file);
    }
    console.log('Cleanup complete.');
}

main();
