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
// Clean up business hours string but keep raw format
function normalizeBusinessHours(hoursStr) {
    if (!hoursStr) return null;
    let cleaned = hoursStr.trim();
    // Remove invisible characters or excessive spacing if needed, 
    // but keep the full text structure (e.g. "週一～週五 11:00-14:00")
    return cleaned.length > 0 ? cleaned : null;
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

    // Merge pixnetCategories into tags
    if (updates.pixnetCategories && updates.pixnetCategories.length > 0) {
        // Extract existing tags
        const tagsMatch = frontmatter.match(/tags:\s*\[(.*?)\]/s);
        let existingTags = [];
        if (tagsMatch) {
            try {
                // Parse existing JSON array or simple list
                // If simple list, might be quoted or not. Best to assume strict JSON-like or quoted strings
                // But let's simple split by comma and clean
                const inner = tagsMatch[1];
                if (inner.trim()) {
                    existingTags = inner.split(',').map(t => t.trim().replace(/^['"]|['"]$/g, ''));
                }
            } catch (e) { }
        }

        // Merge
        const newTags = updates.pixnetCategories;
        const combined = [...new Set([...existingTags, ...newTags])];

        // Remove "unread" if other tags exist? Maybe not, allow "unread" for now unless user wants it gone.
        // But user said "Sync Article Source Tags". Usually implies source is truth.
        // Let's keep existing tags (like local manual ones) and add new ones.

        // Check if different
        const isDifferent = JSON.stringify(existingTags.sort()) !== JSON.stringify(combined.sort());

        if (isDifferent) {
            const newTagsStr = `[${combined.map(t => `"${t}"`).join(', ')}]`;
            if (tagsMatch) {
                frontmatter = frontmatter.replace(/tags:\s*\[.*?\]/s, `tags: ${newTagsStr}`);
            } else {
                frontmatter += `\ntags: ${newTagsStr}`;
            }
            modified = true;
        }
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

        // Sync pixnetCategories AND pixnetTags to tags
        const sourceTags = [];
        if (articleData.pixnetCategories) sourceTags.push(...articleData.pixnetCategories);
        if (articleData.pixnetTags) sourceTags.push(...articleData.pixnetTags);

        if (sourceTags.length > 0) {
            updates.pixnetCategories = [...new Set(sourceTags)];
        }

        if (Object.keys(updates).length > 0) {
            const result = updateFrontmatter(path.join(POSTS_DIR, file), updates);
            if (result.modified) {
                console.log(`✅ Updated: ${file} - tags synced: ${!!updates.pixnetCategories}`);
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
