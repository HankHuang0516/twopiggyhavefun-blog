/**
 * migrate_missing_posts.js
 * Reads post_audit_report.json and migrates missing articles
 */

const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const REPORT_FILE = 'post_audit_report.json';
const POSTS_DIR = path.join(__dirname, 'src/content/posts');
const DELAY_MS = 1000; // 1 second delay between requests

// Business hours patterns to extract
const HOURS_PATTERNS = [
    /營業時間[：:]\s*(.+?)(?:\n|$)/,
    /開放時間[：:]\s*(.+?)(?:\n|$)/,
    /時間[：:]\s*(.+?)(?:\n|$)/,
    /(\d{1,2}:\d{2})\s*[-~]\s*(\d{1,2}:\d{2})/,
];

async function fetchArticle(article) {
    try {
        console.log(`Fetching ${article.url}...`);
        const { data } = await axios.get(article.url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
            timeout: 15000
        });
        return data;
    } catch (error) {
        console.error(`Failed to fetch ${article.url}: ${error.message}`);
        return null;
    }
}

function extractData(html, articleId, articleUrl) {
    const $ = cheerio.load(html);

    // 1. Title
    const title = $('h1').first().text().trim() || $('.article-title').text().trim() || 'Untitled';

    // 2. Date
    // Try .publish, .date, .post-date, etc.
    let dateStr = $('.publish').text().trim() || $('.date').text().trim() || $('.post-date').text().trim();
    // Try to normalize date. If fail, use current date or scrape date.
    let date = new Date().toISOString();
    if (dateStr) {
        // Cleaning date string (removing parens, etc)
        dateStr = dateStr.replace(/[()]/g, '').trim();
        const parsed = Date.parse(dateStr);
        if (!isNaN(parsed)) {
            date = new Date(parsed).toISOString();
        }
    }

    // 3. Tags / Categories
    const tags = [];
    $('.article-keyword a, .article-categories a').each((i, el) => {
        const tag = $(el).text().trim();
        if (tag) tags.push(tag);
    });
    // Add default if empty
    if (tags.length === 0) tags.push('unread');

    // 4. Content
    // Select the main content container. Pixnet usually uses #article-content-inner or .article-content
    let contentHtml = $('#article-content-inner').html() || $('.article-content').html() || $('.entry-content').html();

    if (!contentHtml) {
        contentHtml = '<p>Content extraction failed. Please check original link.</p>';
    }

    // 5. Cover Image
    // Try meta og:image first
    let cover = $('meta[property="og:image"]').attr('content');
    if (!cover) {
        // Try first image in content
        const firstImg = $('#article-content-inner img').first().attr('src');
        if (firstImg) cover = firstImg;
    }

    // 6. Business Hours
    const contentText = $('#article-content-inner').text() || $('.article-content').text();
    let businessHours = ''; // Empty string if not found, or null? Existing posts use null or string.

    for (const pattern of HOURS_PATTERNS) {
        const match = contentText.match(pattern);
        if (match) {
            businessHours = match[1] || `${match[1]}-${match[2]}`;
            break;
        }
    }

    // 7. Check Closed
    const isPermanentlyClosed = title.includes('已歇業') || title.includes('已停業') ||
        contentText.includes('已歇業') || contentText.includes('店家已停業');

    return {
        title,
        date,
        tags,
        cover,
        businessHours: businessHours || null,
        isPermanentlyClosed,
        contentHtml
    };
}

function createMarkdown(id, data, originalUrl) {
    // Escape quotes in title only if needed, mostly handled by JSON.stringify style or simple escaping?
    // Using JSON.stringify for strings helps handle special chars safely

    const frontmatter = [
        '---',
        `title: ${JSON.stringify(data.title)}`,
        `date: "${data.date}"`,
        `cover: "${data.cover || ''}"`,
        `tags: ${JSON.stringify(data.tags)}`,
        `originalUrl: "${originalUrl}"`,
        `businessHours: ${data.businessHours ? JSON.stringify(data.businessHours) : 'null'}`,
        `isPermanentlyClosed: ${data.isPermanentlyClosed}`,
        '---',
        '',
        '<div class="pixnet-article prose max-w-none">',
        data.contentHtml,
        '</div>'
    ].join('\n');

    return frontmatter;
}

async function main() {
    console.log('🚀 Starting Pixnet Migration...');

    if (!fs.existsSync(REPORT_FILE)) {
        console.error(`❌ Report file ${REPORT_FILE} not found. Run audit_posts.js first.`);
        return;
    }

    const report = JSON.parse(fs.readFileSync(REPORT_FILE, 'utf-8'));
    const missing = report.missingArticles || [];

    console.log(`📋 Found ${missing.length} missing articles.`);

    if (missing.length === 0) {
        console.log('✅ Nothing to migrate.');
        return;
    }

    let successCount = 0;
    let failCount = 0;

    // Create posts directory if not exists
    if (!fs.existsSync(POSTS_DIR)) {
        fs.mkdirSync(POSTS_DIR, { recursive: true });
    }

    // Iterate
    for (let i = 0; i < missing.length; i++) {
        const article = missing[i];
        console.log(`\n[${i + 1}/${missing.length}] Processing ${article.id}...`);

        const html = await fetchArticle(article);
        if (!html) {
            failCount++;
            continue;
        }

        try {
            const data = extractData(html, article.id, article.url);
            const markdown = createMarkdown(article.id, data, article.url);

            const filePath = path.join(POSTS_DIR, `${article.id}.md`);
            fs.writeFileSync(filePath, markdown);

            console.log(`✅ Save ${article.id}: ${data.title.substring(0, 20)}...`);
            successCount++;
        } catch (err) {
            console.error(`❌ Failed to process ${article.id}: ${err.message}`);
            failCount++;
        }

        // Delay
        await new Promise(r => setTimeout(r, DELAY_MS));
    }

    console.log('\n' + '═'.repeat(60));
    console.log('🎉 MIGRATION COMPLETE');
    console.log('═'.repeat(60));
    console.log(`Success: ${successCount}`);
    console.log(`Failed:  ${failCount}`);
}

main().catch(console.error);
