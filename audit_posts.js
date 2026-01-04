/**
 * audit_posts.js - Compare Pixnet blog with migrated Astro posts
 * Correct selectors based on actual Pixnet page structure
 */

const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const PIXNET_BLOG_URL = 'https://lolwarden.pixnet.net/blog';
const POSTS_DIR = path.join(__dirname, 'src/content/posts');

async function getAllPixnetArticles() {
    const articles = [];
    let page = 1;
    let hasMore = true;
    const MAX_PAGES = 80; // Safety limit

    console.log('🔍 Crawling Pixnet blog...');

    while (hasMore && page <= MAX_PAGES) {
        try {
            const url = page === 1 ? PIXNET_BLOG_URL : `${PIXNET_BLOG_URL}?page=${page}`;
            console.log(`  Fetching page ${page}...`);

            const { data } = await axios.get(url, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
                timeout: 15000
            });

            const $ = cheerio.load(data);

            // Correct selector: a[href*="/blog/posts/"] - note the 's' in 'posts'
            const articleLinks = $('a[href*="/blog/posts/"]');
            let foundOnPage = 0;

            articleLinks.each((i, el) => {
                const href = $(el).attr('href');
                const title = $(el).text().trim();

                // Extract ID from URL pattern /blog/posts/{ID}
                const match = href.match(/\/blog\/posts\/(\d+)/);
                if (match && title) {
                    const id = match[1];
                    // Avoid duplicates
                    if (!articles.find(a => a.id === id)) {
                        articles.push({
                            id,
                            title: title.substring(0, 100), // Truncate long titles
                            url: href.startsWith('http') ? href : `https://lolwarden.pixnet.net${href}`
                        });
                        foundOnPage++;
                    }
                }
            });

            console.log(`    Found ${foundOnPage} new articles on page ${page}`);

            // Check for next page
            const nextPage = $('a.next');
            if (nextPage.length === 0 || foundOnPage === 0) {
                hasMore = false;
            } else {
                page++;
            }

            // Polite delay
            await new Promise(r => setTimeout(r, 300));

        } catch (error) {
            console.error(`  Error on page ${page}:`, error.message);
            if (page > 5) { // If we've scraped a few pages, stop on error
                hasMore = false;
            } else {
                page++;
            }
        }
    }

    console.log(`\n✅ Total found: ${articles.length} articles on Pixnet\n`);
    return articles;
}

function getExistingPosts() {
    const files = fs.readdirSync(POSTS_DIR).filter(f => f.endsWith('.md'));
    return files.map(f => f.replace('.md', ''));
}

async function main() {
    console.log('═'.repeat(60));
    console.log('📊 Blog Post Audit Tool');
    console.log('═'.repeat(60) + '\n');

    // Get Pixnet articles
    const pixnetArticles = await getAllPixnetArticles();

    // Get existing posts
    const existingIds = getExistingPosts();
    console.log(`📁 Found ${existingIds.length} existing posts in Astro\n`);

    // Find missing articles
    const missingArticles = pixnetArticles.filter(a => !existingIds.includes(a.id));

    // Find existing but maybe need updating
    const migratedArticles = pixnetArticles.filter(a => existingIds.includes(a.id));

    // Generate report
    const report = {
        crawledAt: new Date().toISOString(),
        totalPixnet: pixnetArticles.length,
        totalMigrated: existingIds.length,
        matched: migratedArticles.length,
        missing: missingArticles.length,
        missingArticles: missingArticles,
        allPixnetArticles: pixnetArticles
    };

    // Save full report
    fs.writeFileSync('post_audit_report.json', JSON.stringify(report, null, 2));

    // Print summary
    console.log('═'.repeat(60));
    console.log('📋 AUDIT SUMMARY');
    console.log('═'.repeat(60));
    console.log(`Total on Pixnet:     ${pixnetArticles.length}`);
    console.log(`Already migrated:    ${report.matched}`);
    console.log(`Missing articles:    ${missingArticles.length}`);
    console.log('═'.repeat(60));

    if (missingArticles.length > 0) {
        console.log('\n❌ MISSING ARTICLES (not yet migrated):');
        console.log('-'.repeat(60));
        missingArticles.forEach((a, i) => {
            console.log(`${(i + 1).toString().padStart(3)}. [${a.id}] ${a.title}`);
        });

        // Save missing list as simple text
        const missingList = missingArticles.map((a, i) =>
            `${i + 1}. [${a.id}] ${a.title}\n   ${a.url}`
        ).join('\n\n');
        fs.writeFileSync('missing_posts.txt', missingList);
        console.log('\n📄 Missing list saved to: missing_posts.txt');
    } else {
        console.log('\n✅ All articles have been migrated!');
    }

    console.log('\n📄 Full report saved to: post_audit_report.json');
}

main().catch(console.error);
