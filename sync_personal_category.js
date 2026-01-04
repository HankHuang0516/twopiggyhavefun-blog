/**
 * sync_personal_category.js
 * Syncs "個人分類" (Personal Category) from Pixnet articles to markdown frontmatter
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');

const POSTS_DIR = path.join(__dirname, 'src/content/posts');
const LOG_FILE = path.join(__dirname, 'sync_category.log');
const BATCH_SIZE = 5;
const DELAY_MS = 1000;

// Clear log file
fs.writeFileSync(LOG_FILE, `Category Sync Started: ${new Date().toISOString()}\n\n`);

function log(message) {
    console.log(message);
    fs.appendFileSync(LOG_FILE, message + '\n');
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchPersonalCategory(url) {
    try {
        const response = await axios.get(url, {
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        const $ = cheerio.load(response.data);

        // Method 1: Look for "個人分類：" in article footer
        let category = null;

        // Find all li elements in .refer section
        $('.refer li, .article-footer li').each((_, el) => {
            const text = $(el).text();
            if (text.includes('個人分類：') || text.includes('個人分類:')) {
                const link = $(el).find('a');
                if (link.length) {
                    category = link.text().trim();
                }
            }
        });

        // Method 2: Look for category link pattern
        if (!category) {
            $('a[href*="/blog/category/"]').each((_, el) => {
                const parent = $(el).parent();
                if (parent.text().includes('個人分類')) {
                    category = $(el).text().trim();
                    return false; // break
                }
            });
        }

        // Method 3: Meta or structured data
        if (!category) {
            const articleCategory = $('meta[property="article:section"]').attr('content');
            if (articleCategory) {
                category = articleCategory;
            }
        }

        return category;
    } catch (error) {
        return null;
    }
}

async function processFile(filePath, fileName) {
    let content = fs.readFileSync(filePath, 'utf-8');

    // Check if category already exists
    if (content.match(/^category:/m)) {
        return { status: 'skip', reason: 'already has category' };
    }

    // Extract originalUrl
    const urlMatch = content.match(/originalUrl:\s*["'](.+?)["']/);
    if (!urlMatch) {
        return { status: 'skip', reason: 'no originalUrl' };
    }

    const originalUrl = urlMatch[1];

    // Fetch personal category
    const category = await fetchPersonalCategory(originalUrl);
    if (!category) {
        // Add "其他" as default
        const frontmatterEnd = content.indexOf('---', 3);
        if (frontmatterEnd !== -1) {
            content = content.slice(0, frontmatterEnd) + `category: "其他"\n` + content.slice(frontmatterEnd);
            fs.writeFileSync(filePath, content, 'utf-8');
            log(`⚠️ ${fileName}: Set to "其他" (could not fetch from ${originalUrl})`);
            return { status: 'default', category: '其他' };
        }
        return { status: 'error', reason: 'could not update' };
    }

    // Add category to frontmatter
    const frontmatterEnd = content.indexOf('---', 3);
    if (frontmatterEnd !== -1) {
        content = content.slice(0, frontmatterEnd) + `category: "${category}"\n` + content.slice(frontmatterEnd);
        fs.writeFileSync(filePath, content, 'utf-8');
        log(`✅ ${fileName}: "${category}"`);
        return { status: 'success', category };
    }

    return { status: 'error', reason: 'could not update' };
}

async function main() {
    log('══════════════════════════════════════════════════');
    log('📂 Syncing Personal Categories from Pixnet');
    log('══════════════════════════════════════════════════\n');

    const files = fs.readdirSync(POSTS_DIR).filter(f => f.endsWith('.md'));
    let processed = 0;
    let success = 0;
    let defaults = 0;
    let skipped = 0;
    const categoryStats = {};

    log(`Found ${files.length} articles to process\n`);

    // Process in batches
    for (let i = 0; i < files.length; i += BATCH_SIZE) {
        const batch = files.slice(i, i + BATCH_SIZE);

        const promises = batch.map(async (file) => {
            const filePath = path.join(POSTS_DIR, file);
            const result = await processFile(filePath, file);

            if (result.status === 'success') {
                success++;
                categoryStats[result.category] = (categoryStats[result.category] || 0) + 1;
            } else if (result.status === 'default') {
                defaults++;
            } else {
                skipped++;
            }
            processed++;
        });

        await Promise.all(promises);

        if ((i + BATCH_SIZE) % 50 === 0 || i + BATCH_SIZE >= files.length) {
            log(`\n📊 Progress: ${processed}/${files.length} (${success} synced, ${defaults} defaults, ${skipped} skipped)\n`);
        }

        if (i + BATCH_SIZE < files.length) {
            await sleep(DELAY_MS);
        }
    }

    log('\n══════════════════════════════════════════════════');
    log('📊 Category Distribution:');
    log('══════════════════════════════════════════════════');

    const sorted = Object.entries(categoryStats).sort((a, b) => b[1] - a[1]);
    for (const [cat, count] of sorted) {
        log(`  ${cat}: ${count}`);
    }

    log('\n══════════════════════════════════════════════════');
    log(`✅ Completed: ${success} synced, ${defaults} defaults, ${skipped} skipped`);
    log('══════════════════════════════════════════════════');
}

main().catch(console.error);
