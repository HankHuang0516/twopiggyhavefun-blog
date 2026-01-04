/**
 * mark_closed_businesses.js
 * Reads business_status.md and injects warning banners into articles
 * mentioning closed businesses.
 */

const fs = require('fs');
const path = require('path');

const BUSINESS_STATUS_FILE = path.join(__dirname, 'business_status.md');
const POSTS_DIR = path.join(__dirname, 'src/content/posts');

// Warning banner to inject (HTML format for markdown)
const CLOSED_BANNER_HTML = `
<div class="closed-business-warning" style="background: #fff3cd; border: 1px solid #ffc107; border-left: 4px solid #ff6b6b; padding: 16px; margin: 16px 0; border-radius: 4px;">
  <p style="margin: 0; color: #856404; font-weight: bold;">
    ⚠️ 注意：此店家已歇業/停業
  </p>
  <p style="margin: 8px 0 0 0; color: #856404; font-size: 14px;">
    本文僅供參考，店家目前已不再營業。
  </p>
</div>

`;

function parseBusinessStatus() {
    if (!fs.existsSync(BUSINESS_STATUS_FILE)) {
        console.log('❌ business_status.md not found');
        return [];
    }

    const content = fs.readFileSync(BUSINESS_STATUS_FILE, 'utf-8');
    const lines = content.split('\n');
    const closedBusinesses = [];

    let inTable = false;
    for (const line of lines) {
        if (line.includes('商家名稱') && line.includes('狀態')) {
            inTable = true;
            continue;
        }
        if (inTable && line.startsWith('|---')) {
            continue;
        }
        if (inTable && line.startsWith('|')) {
            const parts = line.split('|').map(p => p.trim()).filter(Boolean);
            if (parts.length >= 3) {
                const [name, status, articleId] = parts;
                if (status === '已歇業' || status === '已停業') {
                    closedBusinesses.push({
                        name,
                        status,
                        articleId: articleId.trim(),
                    });
                }
            }
        } else if (inTable && !line.startsWith('|')) {
            inTable = false;
        }
    }

    return closedBusinesses;
}

function markClosedBusinesses() {
    console.log('🔍 Parsing business_status.md...');
    const closedBusinesses = parseBusinessStatus();

    if (closedBusinesses.length === 0) {
        console.log('No closed businesses found in status file.');
        return;
    }

    console.log(`Found ${closedBusinesses.length} closed businesses:`);
    closedBusinesses.forEach(b => console.log(`  - ${b.name} (${b.status})`));

    let modifiedCount = 0;

    for (const business of closedBusinesses) {
        const articlePath = path.join(POSTS_DIR, `${business.articleId}.md`);

        if (!fs.existsSync(articlePath)) {
            console.log(`⚠️ Article ${business.articleId}.md not found, skipping...`);
            continue;
        }

        let content = fs.readFileSync(articlePath, 'utf-8');

        if (content.includes('店家已歇業') || content.includes('closed-business-warning')) {
            console.log(`✓ ${business.articleId}.md already has warning`);
            continue;
        }

        const frontmatterEnd = content.indexOf('---', 3);
        if (frontmatterEnd === -1) {
            console.log(`⚠️ ${business.articleId}.md has invalid frontmatter`);
            continue;
        }

        const insertPosition = frontmatterEnd + 3;
        const before = content.substring(0, insertPosition);
        const after = content.substring(insertPosition);

        content = before + '\n\n' + CLOSED_BANNER_HTML + after;

        fs.writeFileSync(articlePath, content);
        console.log(`✅ Added warning to ${business.articleId}.md (${business.name})`);
        modifiedCount++;
    }

    console.log(`\n📝 Modified ${modifiedCount} articles from business_status.md`);
}

function scanForClosedInTitles() {
    console.log('\n🔍 Scanning for articles with 已歇業/已停業 in title...');

    const files = fs.readdirSync(POSTS_DIR).filter(f => f.endsWith('.md'));
    const found = [];
    let autoMarked = 0;

    for (const file of files) {
        const content = fs.readFileSync(path.join(POSTS_DIR, file), 'utf-8');
        const titleMatch = content.match(/title:\s*["']?(.+?)["']?\s*\n/);

        if (titleMatch) {
            const title = titleMatch[1];
            if (title.includes('已歇業') || title.includes('已停業')) {
                const id = file.replace('.md', '');
                found.push({ id, title });

                if (!content.includes('店家已歇業') && !content.includes('closed-business-warning')) {
                    const frontmatterEnd = content.indexOf('---', 3);
                    if (frontmatterEnd !== -1) {
                        const insertPosition = frontmatterEnd + 3;
                        const newContent = content.substring(0, insertPosition) + '\n\n' + CLOSED_BANNER_HTML + content.substring(insertPosition);
                        fs.writeFileSync(path.join(POSTS_DIR, file), newContent);
                        console.log(`✅ Auto-marked: ${file}`);
                        autoMarked++;
                    }
                }
            }
        }
    }

    if (found.length > 0) {
        console.log(`Found ${found.length} articles with closed status in title:`);
        found.forEach(f => console.log(`  - [${f.id}] ${f.title}`));
    }

    console.log(`\n📝 Auto-marked ${autoMarked} articles from title scan`);
}

// Main
console.log('═'.repeat(50));
console.log('🏪 Closed Business Marker');
console.log('═'.repeat(50) + '\n');

markClosedBusinesses();
scanForClosedInTitles();

console.log('\n✅ Done!');
