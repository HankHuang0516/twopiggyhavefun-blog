/**
 * update_frontmatter.js
 * Updates article frontmatter with business hours and categories
 * from pixnet_categories.json data
 */

const fs = require('fs');
const path = require('path');

const POSTS_DIR = path.join(__dirname, 'src/content/posts');
const PIXNET_DATA = path.join(__dirname, 'pixnet_categories.json');

// Parse various business hours formats
function normalizeBusinessHours(hoursStr) {
    if (!hoursStr) return null;

    // Clean up the string
    let cleaned = hoursStr.trim();

    // Extract time range patterns
    const timeRangePatterns = [
        // 11:30-21:00 or 11:30～21:00
        /(\d{1,2}:\d{2})\s*[-~～]\s*(\d{1,2}:\d{2})/,
        // 11:30至21:00
        /(\d{1,2}:\d{2})\s*至\s*(\d{1,2}:\d{2})/,
    ];

    for (const pattern of timeRangePatterns) {
        const match = cleaned.match(pattern);
        if (match) {
            return `${match[1]}-${match[2]}`;
        }
    }

    // Return original if can't normalize
    return cleaned.length < 100 ? cleaned : null;
}

function updateFrontmatter(filePath, updates) {
    let content = fs.readFileSync(filePath, 'utf-8');

    // Check if frontmatter exists
    if (!content.startsWith('---')) {
        return { modified: false, reason: 'No frontmatter' };
    }

    const endOfFrontmatter = content.indexOf('---', 3);
    if (endOfFrontmatter === -1) {
        return { modified: false, reason: 'Invalid frontmatter' };
    }

    let frontmatter = content.substring(3, endOfFrontmatter).trim();
    const body = content.substring(endOfFrontmatter);

    let modified = false;

    // Add businessHours if provided and not exists
    if (updates.businessHours && !frontmatter.includes('businessHours:')) {
        frontmatter += `\nbusinessHours: "${updates.businessHours}"`;
        modified = true;
    }

    // Add isPermanentlyClosed if provided and not exists
    if (updates.isPermanentlyClosed && !frontmatter.includes('isPermanentlyClosed:')) {
        frontmatter += `\nisPermanentlyClosed: true`;
        modified = true;
    }

    // Add pixnetCategory if provided and not exists
    if (updates.pixnetCategory && !frontmatter.includes('pixnetCategory:')) {
        frontmatter += `\npixnetCategory: "${updates.pixnetCategory}"`;
        modified = true;
    }

    if (modified) {
        const newContent = `---\n${frontmatter}\n${body}`;
        fs.writeFileSync(filePath, newContent);
    }

    return { modified };
}

function main() {
    console.log('═'.repeat(60));
    console.log('📝 Update Frontmatter with Business Hours & Categories');
    console.log('═'.repeat(60) + '\n');

    // Read pixnet data
    if (!fs.existsSync(PIXNET_DATA)) {
        console.log('❌ pixnet_categories.json not found. Run scrape_pixnet_categories.js first.');
        return;
    }

    const pixnetData = JSON.parse(fs.readFileSync(PIXNET_DATA, 'utf-8'));
    const articles = pixnetData.articles || [];

    console.log(`📂 Found ${articles.length} articles in pixnet_categories.json`);

    // Create lookup map by ID
    const dataMap = new Map();
    for (const article of articles) {
        dataMap.set(article.id, article);
    }

    // Process local posts
    const posts = fs.readdirSync(POSTS_DIR).filter(f => f.endsWith('.md'));
    let updated = 0;
    let withHours = 0;
    let withClosed = 0;

    for (const file of posts) {
        const id = file.replace('.md', '');
        const articleData = dataMap.get(id);

        if (!articleData) continue;

        const updates = {};

        if (articleData.businessHours) {
            const normalizedHours = normalizeBusinessHours(articleData.businessHours);
            if (normalizedHours) {
                updates.businessHours = normalizedHours;
                withHours++;
            }
        }

        if (articleData.isPermanentlyClosed) {
            updates.isPermanentlyClosed = true;
            withClosed++;
        }

        // Try to extract main category from pixnetCategories
        if (articleData.pixnetCategories && articleData.pixnetCategories.length > 0) {
            // Find the category with the most specific match (not all sidebar categories)
            // For now, skip as the scraper returns all sidebar categories
        }

        if (Object.keys(updates).length > 0) {
            const result = updateFrontmatter(path.join(POSTS_DIR, file), updates);
            if (result.modified) {
                console.log(`✅ Updated: ${file} - hours: ${updates.businessHours || 'N/A'}`);
                updated++;
            }
        }
    }

    console.log('\n' + '═'.repeat(60));
    console.log('📊 Summary');
    console.log('═'.repeat(60));
    console.log(`Total posts checked:    ${posts.length}`);
    console.log(`Posts updated:          ${updated}`);
    console.log(`With business hours:    ${withHours}`);
    console.log(`Permanently closed:     ${withClosed}`);
    console.log('✅ Done!');
}

main();
