/**
 * scrape_pixnet_full.js
 * Enhanced Pixnet scraper that extracts:
 * - Article ID, title, URL
 * - Pixnet categories/tags
 * - Migration status
 * - Business info placeholder
 */

const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const PIXNET_BLOG_URL = 'https://lolwarden.pixnet.net/blog';
const POSTS_DIR = path.join(__dirname, 'src/content/posts');
const OUTPUT_FILE = path.join(__dirname, 'pixnet_articles_db.json');

async function scrapeArticleDetails(url, articleId) {
    try {
        const { data } = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
            timeout: 10000
        });

        const $ = cheerio.load(data);

        // Extract categories/tags
        const categories = [];
        $('.tags a, .article-tag a, .tag a, a[rel="tag"]').each((i, el) => {
            const tag = $(el).text().trim();
            if (tag && !categories.includes(tag)) {
                categories.push(tag);
            }
        });

        // Extract category from breadcrumb or header
        $('.breadcrumb a, .category a').each((i, el) => {
            const cat = $(el).text().trim();
            if (cat && cat !== '首頁' && cat !== 'HOME' && !categories.includes(cat)) {
                categories.push(cat);
            }
        });

        return { categories };
    } catch (error) {
        console.log(`  ⚠️ Could not fetch details for ${articleId}`);
        return { categories: [] };
    }
}

async function getAllPixnetArticles() {
    const articles = [];
    let page = 1;
    let hasMore = true;
    const MAX_PAGES = 80;

    console.log('🔍 Crawling Pixnet blog...\n');

    while (hasMore && page <= MAX_PAGES) {
        try {
            const url = page === 1 ? PIXNET_BLOG_URL : `${PIXNET_BLOG_URL}?page=${page}`;
            console.log(`📄 Page ${page}...`);

            const { data } = await axios.get(url, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
                timeout: 15000
            });

            const $ = cheerio.load(data);
            const articleLinks = $('a[href*="/blog/posts/"]');
            let foundOnPage = 0;

            articleLinks.each((i, el) => {
                const href = $(el).attr('href');
                const title = $(el).text().trim();

                const match = href.match(/\/blog\/posts\/(\d+)/);
                if (match && title && title.length > 5) {
                    const id = match[1];
                    if (!articles.find(a => a.id === id)) {
                        articles.push({
                            id,
                            title: title.substring(0, 150),
                            url: href.startsWith('http') ? href : `https://lolwarden.pixnet.net${href}`,
                            pixnetCategories: [],
                            migrated: false,
                            business: null
                        });
                        foundOnPage++;
                    }
                }
            });

            console.log(`   Found ${foundOnPage} articles`);

            const nextPage = $('a.next');
            if (nextPage.length === 0 || foundOnPage === 0) {
                hasMore = false;
            } else {
                page++;
            }

            await new Promise(r => setTimeout(r, 200));

        } catch (error) {
            console.error(`  ❌ Error on page ${page}:`, error.message);
            if (page > 5) hasMore = false;
            else page++;
        }
    }

    console.log(`\n✅ Total found: ${articles.length} articles\n`);
    return articles;
}

function getExistingPosts() {
    const files = fs.readdirSync(POSTS_DIR).filter(f => f.endsWith('.md'));
    const posts = {};

    for (const file of files) {
        const id = file.replace('.md', '');
        const content = fs.readFileSync(path.join(POSTS_DIR, file), 'utf-8');

        // Extract tags
        const tagsMatch = content.match(/tags:\s*\[(.+?)\]/);
        const tags = tagsMatch
            ? tagsMatch[1].split(',').map(t => t.trim().replace(/["']/g, ''))
            : [];

        // Extract title
        const titleMatch = content.match(/title:\s*["']?(.+?)["']?\s*\n/);
        const title = titleMatch ? titleMatch[1] : '';

        posts[id] = { tags, title };
    }

    return posts;
}

async function main() {
    console.log('═'.repeat(60));
    console.log('📚 Enhanced Pixnet Article Scraper');
    console.log('═'.repeat(60) + '\n');

    // Load existing database if exists
    let existingDb = { articles: [], lastUpdated: null };
    if (fs.existsSync(OUTPUT_FILE)) {
        existingDb = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf-8'));
        console.log(`📂 Loaded existing database with ${existingDb.articles.length} articles\n`);
    }

    // Get Pixnet articles
    const pixnetArticles = await getAllPixnetArticles();

    // Get existing migrated posts
    const existingPosts = getExistingPosts();
    const existingIds = Object.keys(existingPosts);
    console.log(`📁 Found ${existingIds.length} migrated posts\n`);

    // Merge and update
    const mergedArticles = [];

    for (const article of pixnetArticles) {
        const existing = existingDb.articles.find(a => a.id === article.id);
        const isMigrated = existingIds.includes(article.id);

        mergedArticles.push({
            id: article.id,
            title: article.title,
            url: article.url,
            pixnetCategories: existing?.pixnetCategories || [],
            migrated: isMigrated,
            localTags: isMigrated ? existingPosts[article.id].tags : [],
            business: existing?.business || null
        });
    }

    // Summary stats
    const migratedCount = mergedArticles.filter(a => a.migrated).length;
    const missingCount = mergedArticles.filter(a => !a.migrated).length;

    // Save database
    const db = {
        lastUpdated: new Date().toISOString(),
        stats: {
            total: mergedArticles.length,
            migrated: migratedCount,
            missing: missingCount
        },
        articles: mergedArticles
    };

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(db, null, 2));

    // Print summary
    console.log('═'.repeat(60));
    console.log('📊 SUMMARY');
    console.log('═'.repeat(60));
    console.log(`Total Pixnet articles:  ${mergedArticles.length}`);
    console.log(`Already migrated:       ${migratedCount}`);
    console.log(`Not yet migrated:       ${missingCount}`);
    console.log('═'.repeat(60));

    // Save missing articles to a separate file
    const missing = mergedArticles.filter(a => !a.migrated);
    if (missing.length > 0) {
        const missingList = missing.map((a, i) =>
            `${i + 1}. [${a.id}] ${a.title}\n   ${a.url}`
        ).join('\n\n');
        fs.writeFileSync('missing_posts.txt', missingList);
        console.log(`\n📄 Missing list saved to: missing_posts.txt`);
    }

    console.log(`📄 Database saved to: pixnet_articles_db.json`);
    console.log('\n✅ Done!');
}

main().catch(console.error);
