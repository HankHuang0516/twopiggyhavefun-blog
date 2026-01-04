/**
 * fix_tags.js
 * Restores original Chinese tags from Pixnet articles
 * Merges them with existing English categorization tags
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');

const POSTS_DIR = path.join(__dirname, 'src/content/posts');
const LOG_FILE = path.join(__dirname, 'fix_tags.log');
const BATCH_SIZE = 5;
const DELAY_MS = 1000;

// Clear log file
fs.writeFileSync(LOG_FILE, `Tag Restoration Started: ${new Date().toISOString()}\n\n`);

function log(message) {
    console.log(message);
    fs.appendFileSync(LOG_FILE, message + '\n');
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchOriginalTags(url) {
    try {
        const response = await axios.get(url, {
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        const $ = cheerio.load(response.data);
        const tags = [];

        // ONLY use article-specific tag selectors - NOT meta keywords or sidebar content
        // Pixnet article tags are in .article-tags section within the article content
        const articleContent = $('.article-content, .article-content-inner, #article-content');

        // Method 1: Look for tag links within article content area ONLY
        articleContent.find('.article-keyword-link, .tag-link, a[rel="tag"]').each((_, el) => {
            const tag = $(el).text().trim();
            if (tag && tag.length > 1 && tag.length < 30 && !isExcludedTag(tag)) {
                tags.push(tag);
            }
        });

        // Method 2: Article footer tags (common Pixnet pattern)
        if (tags.length === 0) {
            $('.article-tag a, .article-tags a, .article-footer a[href*="/tag/"]').each((_, el) => {
                const tag = $(el).text().trim();
                if (tag && tag.length > 1 && tag.length < 30 && !isExcludedTag(tag)) {
                    tags.push(tag);
                }
            });
        }

        // Method 3: Structured data (JSON-LD) - most reliable
        if (tags.length === 0) {
            $('script[type="application/ld+json"]').each((_, el) => {
                try {
                    const jsonData = JSON.parse($(el).html());
                    if (jsonData.keywords) {
                        const keywords = Array.isArray(jsonData.keywords)
                            ? jsonData.keywords
                            : jsonData.keywords.split(',').map(k => k.trim());
                        keywords.forEach(k => {
                            if (k && k.length > 1 && k.length < 30 && !isExcludedTag(k)) {
                                tags.push(k);
                            }
                        });
                    }
                } catch (e) { }
            });
        }

        // Deduplicate and return
        return [...new Set(tags)];
    } catch (error) {
        return null;
    }
}

// Tags to exclude - these are generic location tags that appear site-wide, not article-specific
function isExcludedTag(tag) {
    const excludedTags = [
        '美食', '旅遊', '生活', '日本', '台北', '新北', '桃園', '台中', '高雄',
        '台南', '基隆', '新竹', '嘉義', '彰化', '宜蘭', '花蓮', '台東', '屏東',
        '苗栗', '雲林', '南投', '澎湖', '金門', '馬祖', 'pixnet'
    ];
    return excludedTags.includes(tag);
}

async function processFile(filePath, fileName) {
    let content = fs.readFileSync(filePath, 'utf-8');

    // Extract originalUrl
    const urlMatch = content.match(/originalUrl:\s*["'](.+?)["']/);
    if (!urlMatch) {
        log(`⚠️ ${fileName}: No originalUrl found`);
        return false;
    }

    const originalUrl = urlMatch[1];

    // Fetch original tags
    const originalTags = await fetchOriginalTags(originalUrl);
    if (!originalTags || originalTags.length === 0) {
        log(`⚠️ ${fileName}: Could not fetch tags from ${originalUrl}`);
        return false;
    }

    // Extract current tags
    const tagsMatch = content.match(/tags:\s*\[(.*?)\]/s);
    let currentTags = [];
    if (tagsMatch) {
        currentTags = tagsMatch[1].split(',').map(t => t.trim().replace(/^['"]|['"]$/g, '')).filter(t => t);
    }

    // Merge tags (keep English system tags + add Chinese original tags)
    const englishTags = currentTags.filter(t => /^[a-z]+$/.test(t)); // Keep system tags like 'food', 'pixnet'
    const mergedTags = [...new Set([...englishTags, ...originalTags])];

    // Check if update needed
    const currentSet = new Set(currentTags);
    const mergedSet = new Set(mergedTags);
    const hasNewTags = [...mergedSet].some(t => !currentSet.has(t));

    if (!hasNewTags) {
        log(`✓ ${fileName}: Tags already up to date`);
        return false;
    }

    // Update frontmatter
    const newTagsStr = mergedTags.map(t => `"${t}"`).join(', ');
    if (tagsMatch) {
        content = content.replace(/tags:\s*\[.*?\]/s, `tags: [${newTagsStr}]`);
    } else {
        const frontmatterEnd = content.indexOf('---', 3);
        if (frontmatterEnd !== -1) {
            content = content.slice(0, frontmatterEnd) + `tags: [${newTagsStr}]\n` + content.slice(frontmatterEnd);
        }
    }

    fs.writeFileSync(filePath, content, 'utf-8');
    log(`✅ ${fileName}: Added tags: ${originalTags.join(', ')}`);
    return true;
}

async function main() {
    log('══════════════════════════════════════════════════');
    log('🏷️  Restoring Original Chinese Tags from Pixnet');
    log('══════════════════════════════════════════════════\n');

    const files = fs.readdirSync(POSTS_DIR).filter(f => f.endsWith('.md'));
    let processed = 0;
    let updated = 0;

    log(`Found ${files.length} articles to process\n`);

    // Process in batches
    for (let i = 0; i < files.length; i += BATCH_SIZE) {
        const batch = files.slice(i, i + BATCH_SIZE);

        const promises = batch.map(async (file) => {
            const filePath = path.join(POSTS_DIR, file);
            const result = await processFile(filePath, file);
            if (result) updated++;
            processed++;
        });

        await Promise.all(promises);

        log(`\n📊 Progress: ${processed}/${files.length} (${updated} updated)\n`);

        if (i + BATCH_SIZE < files.length) {
            await sleep(DELAY_MS);
        }
    }

    log('\n══════════════════════════════════════════════════');
    log(`✅ Completed: ${updated}/${files.length} articles updated with Chinese tags`);
    log('══════════════════════════════════════════════════');
}

main().catch(console.error);
