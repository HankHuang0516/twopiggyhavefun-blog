/**
 * clean_location_tags.js
 * Removes location tags that don't match the article's actual content
 * Only keeps location tags if they appear in the title or address
 */

const fs = require('fs');
const path = require('path');

const POSTS_DIR = path.join(__dirname, 'src/content/posts');

// Location tags that need verification
const LOCATION_TAGS = ['台北', '新北', '桃園', '台中', '高雄', '台南', '基隆', '新竹', '嘉義', '彰化', '宜蘭', '花蓮', '台東', '屏東', '苗栗', '雲林', '南投', '澎湖', '金門', '馬祖', '日本', '韓國', '泰國', '香港', '澳門'];

// Generic tags to always remove (not article-specific)
const GENERIC_TAGS = ['美食', '旅遊', '生活'];

function processFile(filePath, fileName) {
    let content = fs.readFileSync(filePath, 'utf-8');

    // Extract frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) return false;

    const frontmatter = frontmatterMatch[1];

    // Extract title
    const titleMatch = frontmatter.match(/title:\s*["'](.+?)["']/);
    const title = titleMatch ? titleMatch[1] : '';

    // Extract current tags
    const tagsMatch = frontmatter.match(/tags:\s*\[(.*?)\]/s);
    if (!tagsMatch) return false;

    const currentTags = tagsMatch[1]
        .split(',')
        .map(t => t.trim().replace(/^["']|["']$/g, ''))
        .filter(t => t);

    // Get article body for content checking
    const bodyStart = content.indexOf('---', 4) + 3;
    const body = content.slice(bodyStart, bodyStart + 2000); // First 2000 chars

    // Filter tags
    const filteredTags = currentTags.filter(tag => {
        // Always remove generic tags
        if (GENERIC_TAGS.includes(tag)) {
            return false;
        }

        // For location tags, verify they appear in title
        if (LOCATION_TAGS.includes(tag)) {
            // Keep if in title
            if (title.includes(tag)) {
                return true;
            }
            // Remove if not in title (likely scraped from wrong place)
            console.log(`  Removing "${tag}" from "${fileName}" - not in title`);
            return false;
        }

        // Keep all other tags
        return true;
    });

    // Check if anything changed
    if (filteredTags.length === currentTags.length) {
        return false;
    }

    // Update tags in content
    const newTagsStr = filteredTags.map(t => `"${t}"`).join(', ');
    content = content.replace(/tags:\s*\[.*?\]/s, `tags: [${newTagsStr}]`);

    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`✅ ${fileName}: Cleaned tags (${currentTags.length} -> ${filteredTags.length})`);
    return true;
}

function main() {
    console.log('══════════════════════════════════════════════════');
    console.log('🧹 Cleaning Invalid Location Tags');
    console.log('══════════════════════════════════════════════════\n');

    const files = fs.readdirSync(POSTS_DIR).filter(f => f.endsWith('.md'));
    let cleaned = 0;

    for (const file of files) {
        const filePath = path.join(POSTS_DIR, file);
        if (processFile(filePath, file)) {
            cleaned++;
        }
    }

    console.log('\n══════════════════════════════════════════════════');
    console.log(`✅ Cleaned ${cleaned}/${files.length} articles`);
    console.log('══════════════════════════════════════════════════');
}

main();
