/**
 * convert_tags_to_chinese.js
 * Converts English tags to Chinese equivalents in all article frontmatter
 */

const fs = require('fs');
const path = require('path');

const POSTS_DIR = path.join(__dirname, 'src/content/posts');

// English to Chinese tag mapping
const TAG_MAPPING = {
    // Content types
    'food': '美食',
    'travel': '旅遊',
    'hotel': '住宿',
    'unboxing': '開箱',
    'parenting': '親子',
    'foreign': '國外旅遊',
    'wedding': '婚禮',
    'life': '生活',
    'japan': '日本',

    // Regions
    'taipei': '台北',
    'newtaipei': '新北',
    'taoyuan': '桃園',
    'yilan': '宜蘭',
    'hsinchu': '新竹',
    'miaoli': '苗栗',
    'taichung': '台中',
    'nantou': '南投',
    'changhua': '彰化',
    'chiayi': '嘉義',
    'yunlin': '雲林',
    'tainan': '台南',
    'kaohsiung': '高雄',
    'pingtung': '屏東',
    'hualien': '花蓮',
    'taitung': '台東',
    'keelung': '基隆',

    // Keep pixnet as is (identifier tag)
    'pixnet': 'pixnet'
};

function convertTags(filePath) {
    let content = fs.readFileSync(filePath, 'utf-8');

    // Extract tags
    const tagsMatch = content.match(/tags:\s*\[(.*?)\]/s);
    if (!tagsMatch) return false;

    const tagsStr = tagsMatch[1];
    const currentTags = tagsStr.split(',').map(t => t.trim().replace(/^['"]|['"]$/g, '')).filter(t => t);

    // Convert tags
    const convertedTags = currentTags.map(tag => {
        const lowerTag = tag.toLowerCase();
        if (TAG_MAPPING[lowerTag]) {
            return TAG_MAPPING[lowerTag];
        }
        // If already Chinese or not in mapping, keep as is
        return tag;
    });

    // Remove duplicates
    const uniqueTags = [...new Set(convertedTags)];

    // Check if any changes were made
    const originalSet = new Set(currentTags);
    const newSet = new Set(uniqueTags);
    if (currentTags.length === uniqueTags.length &&
        currentTags.every(t => uniqueTags.includes(t) || TAG_MAPPING[t.toLowerCase()])) {
        // Check if any actual conversion happened
        const hasConversion = currentTags.some(t => TAG_MAPPING[t.toLowerCase()] && TAG_MAPPING[t.toLowerCase()] !== t);
        if (!hasConversion) return false;
    }

    // Update frontmatter
    const newTagsStr = uniqueTags.map(t => `"${t}"`).join(', ');
    content = content.replace(/tags:\s*\[.*?\]/s, `tags: [${newTagsStr}]`);

    fs.writeFileSync(filePath, content, 'utf-8');
    return true;
}

function main() {
    console.log('══════════════════════════════════════════════════');
    console.log('🏷️  Converting English Tags to Chinese');
    console.log('══════════════════════════════════════════════════\n');

    const files = fs.readdirSync(POSTS_DIR).filter(f => f.endsWith('.md'));
    let converted = 0;

    for (const file of files) {
        const filePath = path.join(POSTS_DIR, file);
        if (convertTags(filePath)) {
            converted++;
            if (converted <= 10) {
                console.log(`✅ ${file}`);
            }
        }
    }

    if (converted > 10) {
        console.log(`... and ${converted - 10} more files`);
    }

    console.log(`\n📝 Converted ${converted} / ${files.length} articles`);
    console.log('✅ Done!');
}

main();
