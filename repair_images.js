const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');

const POSTS_DIR = 'src/content/posts';
const PUBLIC_DIR = 'public';

// Helper to delay
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function downloadImage(url, filepath) {
    try {
        const response = await axios({
            url,
            method: 'GET',
            responseType: 'stream',
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Referer': 'https://www.pixnet.net/'
            }
        });
        return new Promise((resolve, reject) => {
            const writer = fs.createWriteStream(filepath);
            response.data.pipe(writer);
            writer.on('finish', () => resolve(true));
            writer.on('error', (err) => {
                console.error(`Write error for ${filepath}: ${err.message}`);
                resolve(false);
            });
        });
    } catch (e) {
        if (e.response && e.response.status === 429) {
            console.log(`  [429] Rate limited on ${url}. Waiting...`);
            await sleep(5000); // Wait 5s on 429
            return 'retry';
        }
        console.error(`  [Fail] ${url}: ${e.message}`);
        return false;
    }
}

async function processFile(file) {
    const filePath = path.join(POSTS_DIR, file);
    let content = fs.readFileSync(filePath, 'utf-8');
    const OriginalUrlMatch = content.match(/originalUrl: "(.*)"/);
    const originalUrl = OriginalUrlMatch ? OriginalUrlMatch[1] : null;

    if (!originalUrl) return;

    // Use regex to find image paths in the content: src="/images/posts/..."
    const imgRegex = /src="(\/images\/posts\/[^"]+)"/g;
    let match;
    let missingCount = 0;

    // We need to re-parse the original specific article to get the source URLs again 
    // because we didn't save the source URL mapping map in the MD file, only the local path.
    // However, if we simply want to fallback to remote, we need the original HTML.
    // Actually, simply checking if file exists is step 1.

    // Better strategy:
    // 1. Identify missing local files.
    // 2. If missing, we need to fetch the original article again to find the mapping? 
    //    Or we can try to guess? No, guessing is impossible.
    //    We MUST fetch the article again if we want to repair it properly.

    // Let's optimize: Only fetch if we detect missing images.

    const requiredImages = [];
    while ((match = imgRegex.exec(content)) !== null) {
        const localRelPath = match[1]; // /images/posts/post-ID/filename.jpg
        const localAbsPath = path.join(PUBLIC_DIR, localRelPath);

        if (!fs.existsSync(localAbsPath) || fs.statSync(localAbsPath).size === 0) {
            missingCount++;
            requiredImages.push({
                localRel: localRelPath,
                localAbs: localAbsPath,
                filename: path.basename(localRelPath)
            });
        }
    }

    if (missingCount > 0) {
        console.log(`[${file}] Found ${missingCount} missing images. Re-fetching original...`);

        try {
            const { data } = await axios.get(originalUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });
            const $ = cheerio.load(data);
            const contentContainer = $('#article-content-inner');
            const imgs = contentContainer.find('img').toArray();

            // We need to map original src to our local filename logic.
            // In scrape_pixnet.js, we used index: const filename = `${i}${ext}`;
            // So we can assume the i-th image corresponds to filename "i.jpg" etc.

            for (let i = 0; i < imgs.length; i++) {
                const el = imgs[i];
                const src = $(el).attr('src');
                if (!src) continue;

                const cleanSrc = src.startsWith('//') ? 'https:' + src : src;
                const ext = path.extname(cleanSrc.split('?')[0]) || '.jpg';
                const expectedFilename = `${i}${ext}`;

                // Check if this image corresponds to one we are missing
                const target = requiredImages.find(img => img.filename === expectedFilename);

                if (target) {
                    if (cleanSrc.includes('flickr.com')) {
                        console.log(`  [Flickr] Skipping download, reverting to remote: ${cleanSrc}`);
                        content = content.replace(target.localRel, cleanSrc);
                        continue;
                    }
                    console.log(`  Downloading ${expectedFilename} from ${cleanSrc}...`);

                    // Modify: Create dir if not exists (should exist)
                    const dir = path.dirname(target.localAbs);
                    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

                    let result = await downloadImage(cleanSrc, target.localAbs);

                    // Retry once if 429
                    if (result === 'retry') {
                        result = await downloadImage(cleanSrc, target.localAbs);
                    }

                    if (!result) {
                        // Fallback: Replace local path in content with Remote URL
                        console.log(`  Failed to download. Reverting to remote URL: ${cleanSrc}`);
                        content = content.replace(target.localRel, cleanSrc);
                    }

                    await sleep(1000); // Polite delay
                }
            }

            // If we did text replacements
            fs.writeFileSync(filePath, content);

        } catch (e) {
            console.error(`Failed to re-fetch ${originalUrl}: ${e.message}`);
        }
    }
}

async function main() {
    const files = fs.readdirSync(POSTS_DIR).filter(f => f.endsWith('.md'));

    console.log(`Checking ${files.length} posts for missing images...`);

    for (const file of files) {
        await processFile(file);
    }

    console.log('Repair complete.');
}

main();
