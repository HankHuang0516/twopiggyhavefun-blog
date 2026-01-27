/**
 * Pixnet Blog Sync Script
 * 
 * This script fetches articles from the Pixnet blog and syncs new ones
 * to the Astro blog as markdown files.
 * 
 * Usage: node pixnet_sync.js
 * Can be scheduled via n8n Execute Command node or system cron.
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
    pixnetBlogUrl: 'https://lolwarden.pixnet.net/blog',
    postsDir: path.join(__dirname, '..', 'src', 'content', 'posts'),
    syncStateFile: path.join(__dirname, 'last_sync.json'),
    maxArticles: 10 // Maximum articles to check per run
};

// Category mapping from Pixnet to Astro categories
const CATEGORY_MAPPING = {
    '桃園美食': 'taoyuan-food',
    '桃園景點': 'taoyuan-attractions',
    '新竹美食': 'hsinchu-food',
    '新竹景點': 'hsinchu-attractions',
    '台北美食': 'taipei-food',
    '台北景點': 'taipei-attractions',
    '苗栗美食': 'miaoli-food',
    '苗栗景點': 'miaoli-attractions',
    '宜蘭美食': 'yilan-food',
    '宜蘭景點': 'yilan-attractions',
    '新北美食': 'newtaipei-food',
    '新北景點': 'newtaipei-attractions',
    '基隆美食': 'keelung-food',
    '基隆景點': 'keelung-attractions',
    '南投美食': 'nantou-food',
    '南投景點': 'nantou-attractions',
    '台中美食': 'taichung-food',
    '台中景點': 'taichung-attractions',
    // Default fallback
    'default': 'travel'
};

// --- Geocoding Helpers ---

function cleanAddress(addr) {
    if (!addr) return '';
    return addr
        .replace(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}.*$/, '')
        .replace(/^\d{3,5}/g, '')
        .replace(/\(.*?\)/g, '')
        .replace(/（.*?）/g, '')
        .replace(/[，,、。.]+$/, '')
        .replace(/附近.*$/g, '')
        .replace(/\s+/g, '')
        .trim();
}

function geocode(address) {
    return new Promise((resolve, reject) => {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1&countrycodes=tw`;
        const options = {
            headers: { 'User-Agent': 'TwoPiggyBlogSync/1.0 (twopiggyhavefun@gmail.com)' }
        };
        const req = https.get(url, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode !== 200) { resolve(null); return; }
                try {
                    const json = JSON.parse(data);
                    if (json && json.length > 0) {
                        resolve({
                            lat: parseFloat(json[0].lat),
                            lng: parseFloat(json[0].lon)
                        });
                    } else { resolve(null); }
                } catch (e) { resolve(null); }
            });
        });
        req.on('error', (e) => resolve(null)); // Resolve null on error to not break sync
        req.setTimeout(10000, () => req.destroy());
    });
}


/**
 * Fetch URL content using Node.js built-in modules
 */
function fetchUrl(url) {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;

        const req = protocol.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                // Handle redirect
                fetchUrl(res.headers.location).then(resolve).catch(reject);
                return;
            }

            let data = '';
            res.setEncoding('utf8');
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        });

        req.on('error', reject);
        req.setTimeout(30000, () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
    });
}

/**
 * Extract article ID from Pixnet URL
 */
function extractArticleId(url) {
    // Handle both formats: /blog/post/ID and /blog/posts/ID
    const match = url.match(/blog\/posts?\/(\d+)/);
    return match ? match[1] : null;
}

/**
 * Parse articles from Pixnet's Next.js JSON-embedded HTML
 */
function parseArticlesFromHtml(html) {
    const articles = [];

    try {
        // Pixnet uses Next.js with embedded JSON data in script tags
        // Look for the posts array in the self.__next_f.push data
        const postsMatch = html.match(/"posts":\s*\[([\s\S]*?)\],"blog"/);

        if (postsMatch) {
            // Try to extract from the matched posts array
            const postsJson = '[' + postsMatch[1] + ']';
            try {
                const posts = JSON.parse(postsJson);
                for (const post of posts) {
                    if (post.id && post.title && post.post_url) {
                        articles.push({
                            id: String(post.id),
                            link: post.post_url,
                            title: post.title,
                            category: post.category?.name || 'travel',
                            date: post.published_at ? new Date(post.published_at * 1000).toISOString() : new Date().toISOString(),
                            tags: post.tags?.map(t => t.name) || []
                        });
                    }
                }
            } catch (jsonErr) {
                console.log('Could not parse posts JSON, falling back to regex');
            }
        }

        // Fallback: parse from HTML article elements
        if (articles.length === 0) {
            // Match article divs with their post URLs
            const articleDivRegex = /<div[^>]*class="article"[^>]*id="article-(\d+)"[\s\S]*?<a[^>]*href="(https?:\/\/[^"]+\/blog\/posts?\/\d+)"[^>]*>([^<]+)<\/a>/g;
            let match;

            while ((match = articleDivRegex.exec(html)) !== null) {
                const [_, id, link, title] = match;
                if (!articles.find(a => a.id === id)) {
                    articles.push({
                        id: id,
                        link: link,
                        title: title.trim(),
                        category: 'travel',
                        date: new Date().toISOString(),
                        tags: []
                    });
                }
            }
        }

        // Another fallback: find article links with titles
        if (articles.length === 0) {
            const simpleLinkRegex = /<a[^>]*href="(https?:\/\/lolwarden\.pixnet\.net\/blog\/posts?\/(\d+)[^"]*)"[^>]*>([^<]{10,})<\/a>/g;
            let match;
            const seenIds = new Set();

            while ((match = simpleLinkRegex.exec(html)) !== null) {
                const [_, link, id, title] = match;
                if (!seenIds.has(id) && title.length > 10 && !title.includes('繼續閱讀')) {
                    seenIds.add(id);
                    articles.push({
                        id: id,
                        link: link,
                        title: title.trim(),
                        category: 'travel',
                        date: new Date().toISOString(),
                        tags: []
                    });
                }
            }
        }

    } catch (err) {
        console.error('Error parsing articles:', err.message);
    }

    console.log(`Parsed ${articles.length} articles from page`);
    return articles.slice(0, CONFIG.maxArticles);
}


/**
 * Extract category and content from article page
 */
function parseArticleContent(html) {
    // Extract category
    let category = 'travel';
    const categoryMatch = html.match(/<a[^>]*class="[^"]*refer[^"]*"[^>]*>([^<]+)<\/a>/);
    if (categoryMatch) {
        const pixnetCategory = categoryMatch[1].trim();
        category = CATEGORY_MAPPING[pixnetCategory] || CATEGORY_MAPPING['default'];
    }

    // Try alternative category patterns
    if (category === 'travel') {
        for (const [key, value] of Object.entries(CATEGORY_MAPPING)) {
            if (key !== 'default' && html.includes(key)) {
                category = value;
                break;
            }
        }
    }

    // Extract content
    // Handle cases where div has other attributes (like id)
    let contentPreview = html.match(/<div[^>]*class="[^"]*article-content-inner[^"]*"[^>]*>([\s\S]*?)<div[^>]*class="[^"]*article-footer[^"]*"[^>]*>/)?.[1]
        || html.match(/<div[^>]*id="article-content"[^>]*>([\s\S]*?)<\/div>/)?.[1]
        || '';

    // Clean up content
    contentPreview = contentPreview
        .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gm, '')
        .replace(/<div class="author-profile"[\s\S]*?<\/div>/g, '')
        .replace(/<div id="pixnet-ad-[^"]*">[\s\S]*?<\/div>/g, '')
        .replace(/<iframe\b[^>]*>([\s\S]*?)<\/iframe>/gm, '')
        .trim();

    // Limit length for preview if needed, but we probably want full content for migration
    // contentPreview = contentPreview.substring(0, 500);

    // Extract Address
    let address = null;
    const addressMatch = html.match(/(?:地址|店址|地點|位置|Add|Address)[：:]\s*([^<>\n\r]+)/i);
    if (addressMatch) {
        address = cleanAddress(addressMatch[1]);
        // Filter out IPs or too short/long
        if (address.length < 3 || address.length > 100 || /^\d+\./.test(address)) {
            address = null;
        }
    }

    // Extract Tags from meta keywords
    let tags = [];
    const keywordsMatch = html.match(/<meta name="keywords" content="([^"]+)"/i);
    if (keywordsMatch) {
        tags = keywordsMatch[1].split(',').map(t => t.trim()).filter(t => t);
    }

    return { category, contentPreview, address, tags };
}

/**
 * Load sync state from file
 */
function loadSyncState() {
    try {
        if (fs.existsSync(CONFIG.syncStateFile)) {
            return JSON.parse(fs.readFileSync(CONFIG.syncStateFile, 'utf8'));
        }
    } catch (e) {
        console.log('Warning: Could not load sync state, starting fresh');
    }
    return { syncedArticles: [], lastSyncTime: null };
}

/**
 * Save sync state to file
 */
function saveSyncState(state) {
    fs.writeFileSync(CONFIG.syncStateFile, JSON.stringify(state, null, 2));
}

/**
 * Generate markdown file for an article
 */
function generateMarkdown(article, contentInfo, coords) {
    const slug = article.id;
    const filename = `pixnet-${slug}.md`;
    const filepath = path.join(CONFIG.postsDir, filename);

    // Escape title for YAML
    const escapedTitle = article.title.replace(/'/g, "''");

    let frontmatter = `---
title: '${escapedTitle}'
date: '${article.date}'
category: ${contentInfo.category}
tags:
  - pixnet-sync
  - auto-imported${article.tags && article.tags.length > 0 ? '\n' + article.tags.map(t => `  - ${t}`).join('\n') : ''}
originalUrl: ${article.link}`;

    if (coords) {
        frontmatter += `
lat: ${coords.lat}
lng: ${coords.lng}`;
    }
    if (contentInfo.address) {
        frontmatter += `
address: '${contentInfo.address}'`;
    }

    frontmatter += `
---`;

    const markdown = `${frontmatter}

## ${article.title}

> 本文同步自 [痞客邦](${article.link})

${contentInfo.contentPreview}

---

📖 [閱讀完整文章](${article.link})
`;

    return { filepath, markdown, filename };
}

/**
 * Main sync function
 */
async function syncArticles() {
    console.log('='.repeat(50));
    console.log('Pixnet Blog Sync - Starting at', new Date().toISOString());
    console.log('='.repeat(50));

    // Load current state
    const state = loadSyncState();
    const syncedIds = new Set(state.syncedArticles);

    console.log(`Previously synced articles: ${syncedIds.size}`);

    try {
        // Fetch blog page
        console.log('\nFetching Pixnet blog...');
        const html = await fetchUrl(CONFIG.pixnetBlogUrl);
        console.log(`Received ${html.length} bytes`);

        // Parse articles
        const articles = parseArticlesFromHtml(html);
        console.log(`Found ${articles.length} articles on the page`);

        // Filter new articles
        const newArticles = articles.filter(a => !syncedIds.has(a.id));
        console.log(`New articles to sync: ${newArticles.length}`);

        if (newArticles.length === 0) {
            console.log('\nNo new articles found. Sync complete.');
            return { synced: 0, total: articles.length };
        }

        // Process each new article
        let successCount = 0;
        for (const article of newArticles) {
            console.log(`\nProcessing: ${article.title}`);

            try {
                // Fetch full article page for category and content
                const articleHtml = await fetchUrl(article.link);
                const contentInfo = parseArticleContent(articleHtml);

                console.log(`  Category: ${contentInfo.category}`);

                // Geocode if address found
                let coords = null;
                if (contentInfo.address) {
                    console.log(`  Address found: ${contentInfo.address}... Geocoding`);
                    // Sleep to be nice to API
                    await new Promise(r => setTimeout(r, 1200));
                    coords = await geocode(contentInfo.address);
                    if (coords) console.log(`  -> Lat: ${coords.lat}, Lng: ${coords.lng}`);
                }

                // Merge tags: prefer contentInfo.tags (from article page) over article.tags (from list page)
                // The list page tags often include global site tags giving incorrect results
                if (contentInfo.tags && contentInfo.tags.length > 0) {
                    article.tags = contentInfo.tags;
                }

                // Generate and save markdown
                const { filepath, markdown, filename } = generateMarkdown(article, contentInfo, coords);

                // Ensure posts directory exists
                if (!fs.existsSync(CONFIG.postsDir)) {
                    fs.mkdirSync(CONFIG.postsDir, { recursive: true });
                }

                fs.writeFileSync(filepath, markdown, 'utf8');
                console.log(`  Saved: ${filename}`);

                // Update state
                state.syncedArticles.push(article.id);
                successCount++;

                // Small delay between requests
                await new Promise(r => setTimeout(r, 1000));

            } catch (err) {
                console.error(`  Error processing article: ${err.message}`);
            }
        }

        // Save updated state
        state.lastSyncTime = new Date().toISOString();
        saveSyncState(state);

        console.log('\n' + '='.repeat(50));
        console.log(`Sync complete! Synced ${successCount} new articles.`);
        console.log('='.repeat(50));

        return { synced: successCount, total: articles.length };

    } catch (err) {
        console.error('Sync failed:', err.message);
        throw err;
    }
}

// Run if called directly
if (require.main === module) {
    syncArticles()
        .then(result => {
            console.log('\nResult:', JSON.stringify(result));
            process.exit(0);
        })
        .catch(err => {
            console.error('\nFailed:', err);
            process.exit(1);
        });
}

module.exports = { syncArticles };
