/**
 * auto_categorize.js
 * Automatically categorizes articles based on title keywords
 * and updates the tags in frontmatter
 */

const fs = require('fs');
const path = require('path');

const POSTS_DIR = path.join(__dirname, 'src/content/posts');

// Category keywords mapping
const CATEGORY_KEYWORDS = {
    // Regions
    'taipei': ['台北', '北投', '士林', '天母', '西門', '中山', '信義', '大安', '內湖', '松山', '中正', '萬華'],
    'newtaipei': ['新北', '板橋', '新莊', '三重', '淡水', '三峽', '中和', '永和', '蘆洲', '林口', '萬里', '瑞芳', '九份', '烏來'],
    'taoyuan': ['桃園', '大溪', '中壢', '龍潭', '復興'],
    'yilan': ['宜蘭', '礁溪', '羅東', '頭城', '冬山', '五結', '員山', '三星'],
    'hsinchu': ['新竹', '竹東', '寶山'],
    'miaoli': ['苗栗', '三義', '頭屋', '南庄'],
    'taichung': ['台中', '逢甲', '梧棲'],
    'nantou': ['南投', '清境', '日月潭', '埔里'],
    'changhua': ['彰化', '鹿港'],
    'chiayi': ['嘉義', '阿里山'],
    'yunlin': ['雲林'],
    'tainan': ['台南', '玉井', '赤崁'],
    'kaohsiung': ['高雄'],
    'pingtung': ['屏東', '墾丁'],
    'hualien': ['花蓮'],
    'taitung': ['台東'],

    // Content types
    'food': ['美食', '餐廳', '小吃', '火鍋', '燒烤', '燒肉', '吃到飽', '早午餐', '咖啡', '甜點', '拉麵', '牛肉麵', '牛排', '居酒屋', '料理', '飲茶', '港點', '義大利麵', '披薩', '韓式', '泰式', '日式', '冰品', '鍋物', '串燒'],
    'travel': ['景點', '一日遊', '二日遊', '兩日遊', '旅遊', '行程', '步道', '農場', '博物館', '老街', '公園', '樂園', '打卡'],
    'life': ['生活', '育兒', '親子', '住宿', '飯店', '民宿', '月子', '嬰兒', '寶寶', '婚紗', '染髮', '髮型', '保健', '推薦', '開箱', '團購'],

    // Foreign
    'japan': ['日本', '東京', '大阪', '京都', '沖繩', '北海道', '九州', '福岡'],
    'hongkong': ['香港', '港澳'],
    'singapore': ['新加坡'],
};

function categorizePost(title, content) {
    const tags = new Set(['pixnet']); // Always include pixnet tag
    const text = title + ' ' + content.substring(0, 500); // Check title and first 500 chars

    for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
        for (const keyword of keywords) {
            if (text.includes(keyword)) {
                tags.add(category);
                break;
            }
        }
    }

    return Array.from(tags);
}

function processPost(filePath) {
    let content = fs.readFileSync(filePath, 'utf-8');

    // Extract title
    const titleMatch = content.match(/title:\s*["']?(.+?)["']?\s*\n/);
    if (!titleMatch) return { modified: false };

    const title = titleMatch[1];

    // Get current tags
    const tagsMatch = content.match(/tags:\s*\[(.+?)\]/);
    const currentTags = tagsMatch
        ? tagsMatch[1].split(',').map(t => t.trim().replace(/["']/g, ''))
        : ['pixnet'];

    // Calculate new tags
    const newTags = categorizePost(title, content);

    // Merge tags (keep existing, add new)
    const mergedTags = [...new Set([...currentTags, ...newTags])];

    // Check if tags changed
    if (JSON.stringify(currentTags.sort()) === JSON.stringify(mergedTags.sort())) {
        return { modified: false, tags: currentTags };
    }

    // Update tags in frontmatter
    const newTagsStr = mergedTags.map(t => `"${t}"`).join(', ');

    if (tagsMatch) {
        content = content.replace(/tags:\s*\[.+?\]/, `tags: [${newTagsStr}]`);
    } else {
        // Add tags after date line
        content = content.replace(/(date:\s*.+?\n)/, `$1tags: [${newTagsStr}]\n`);
    }

    fs.writeFileSync(filePath, content);
    return { modified: true, tags: mergedTags, title };
}

function main() {
    console.log('═'.repeat(50));
    console.log('📂 Auto-Categorize Posts');
    console.log('═'.repeat(50) + '\n');

    const files = fs.readdirSync(POSTS_DIR).filter(f => f.endsWith('.md'));
    let modifiedCount = 0;

    for (const file of files) {
        const result = processPost(path.join(POSTS_DIR, file));
        if (result.modified) {
            console.log(`✅ ${file}: ${result.tags.join(', ')}`);
            modifiedCount++;
        }
    }

    console.log(`\n📝 Modified ${modifiedCount} / ${files.length} articles`);
    console.log('✅ Done!');
}

main();
