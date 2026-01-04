/**
 * auto_categorize.js
 * Automatically categorizes articles based on title keywords
 * and updates the tags in frontmatter (matches Sidebar categorization)
 */

const fs = require('fs');
const path = require('path');

const POSTS_DIR = path.join(__dirname, 'src/content/posts');

// Category keywords mapping - matches Sidebar.astro logic
const CATEGORIES = {
    // Main category detection keywords
    unboxing: {
        keywords: ['開箱', '團購', '保健', '滋補', '宅配', '伴手禮', '鍋具', '包款', '手錶', '鞋款', '居家好物', '軟糖', '膠原蛋白', '魚油', '滴雞精', '滴魚精', '維他命', '益生菌'],
        tag: 'unboxing'
    },
    parenting: {
        keywords: ['親子', '育兒', '寶寶', '嬰兒', '月子', '哺乳', '尿布', '奶瓶', '親子餐廳', '親子民宿'],
        tag: 'parenting'
    },
    foreign: {
        keywords: ['香港自由行', '沖繩自由行', '日本自由行', '沖繩親子', '香港一日遊', '北海道', '東京', '大阪', '京都'],
        tag: 'foreign'
    },
    hotel: {
        keywords: ['住宿', '飯店', '民宿', '酒店', '旅館', '旅宿'],
        tag: 'hotel'
    },
    food: {
        keywords: ['美食', '餐廳', '小吃', '火鍋', '燒烤', '燒肉', '吃到飽', '早午餐', '咖啡', '甜點', '拉麵', '牛肉麵', '牛排', '居酒屋', '料理', '飲茶', '港點', '義大利麵', '披薩', '韓式', '泰式', '日式', '冰品', '鍋物', '串燒', '鐵板燒', '壽司', '生魚片', '烤肉', '鰻魚', '和牛', '龍蝦', '海鮮', '早餐', '漢堡'],
        tag: 'food'
    },
    travel: {
        keywords: ['景點', '一日遊', '二日遊', '兩日遊', '旅遊', '行程', '步道', '農場', '博物館', '老街', '公園', '樂園', '打卡', '攻略'],
        tag: 'travel'
    },
    wedding: {
        keywords: ['婚', '新娘', '婚紗'],
        tag: 'wedding'
    }
};

// Region keywords
const REGIONS = {
    taipei: ['台北', '北投', '士林', '天母', '西門', '中山', '信義', '大安', '內湖', '松山', '中正', '萬華'],
    newtaipei: ['新北', '板橋', '新莊', '三重', '淡水', '三峽', '中和', '永和', '蘆洲', '林口', '萬里', '瑞芳', '九份', '烏來', '八里', '土城', '樹林'],
    taoyuan: ['桃園', '大溪', '中壢', '龍潭', '復興'],
    yilan: ['宜蘭', '礁溪', '羅東', '頭城', '冬山', '五結', '員山', '三星'],
    hsinchu: ['新竹', '竹東', '寶山'],
    miaoli: ['苗栗', '三義', '頭屋', '南庄'],
    taichung: ['台中', '逢甲', '梧棲'],
    nantou: ['南投', '清境', '日月潭', '埔里'],
    changhua: ['彰化', '鹿港'],
    chiayi: ['嘉義', '阿里山'],
    yunlin: ['雲林'],
    tainan: ['台南', '玉井', '赤崁'],
    kaohsiung: ['高雄'],
    pingtung: ['屏東', '墾丁'],
    hualien: ['花蓮'],
    taitung: ['台東'],
    keelung: ['基隆']
};

function categorizePost(title, content) {
    const tags = new Set(['pixnet']); // Always include pixnet tag
    const text = title;

    // Detect region
    for (const [region, keywords] of Object.entries(REGIONS)) {
        for (const keyword of keywords) {
            if (text.includes(keyword)) {
                tags.add(region);
                break;
            }
        }
    }

    // Check for foreign first (priority)
    const hasDomesticKeywords = Object.values(REGIONS).flat().some(kw => text.includes(kw));

    if (!hasDomesticKeywords) {
        for (const kw of CATEGORIES.foreign.keywords) {
            if (text.includes(kw)) {
                tags.add('foreign');
                return Array.from(tags);
            }
        }
    }

    // Check for specific categories (priority order)
    const priorityOrder = ['unboxing', 'parenting', 'wedding', 'hotel', 'food', 'travel'];

    for (const catKey of priorityOrder) {
        const cat = CATEGORIES[catKey];
        for (const keyword of cat.keywords) {
            if (text.includes(keyword)) {
                tags.add(cat.tag);
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
    console.log('📂 Auto-Categorize Posts (Enhanced)');
    console.log('═'.repeat(50) + '\n');

    const files = fs.readdirSync(POSTS_DIR).filter(f => f.endsWith('.md'));
    let modifiedCount = 0;
    const categorized = { food: 0, travel: 0, hotel: 0, unboxing: 0, parenting: 0, foreign: 0, wedding: 0 };

    for (const file of files) {
        const result = processPost(path.join(POSTS_DIR, file));
        if (result.modified) {
            console.log(`✅ ${file.slice(0, 20)}...: ${result.tags.join(', ')}`);
            modifiedCount++;
        }

        // Count categories
        if (result.tags) {
            for (const tag of result.tags) {
                if (categorized.hasOwnProperty(tag)) {
                    categorized[tag]++;
                }
            }
        }
    }

    console.log('\n' + '═'.repeat(50));
    console.log('📊 Category Summary');
    console.log('═'.repeat(50));
    console.log(`Food:      ${categorized.food}`);
    console.log(`Travel:    ${categorized.travel}`);
    console.log(`Hotel:     ${categorized.hotel}`);
    console.log(`Unboxing:  ${categorized.unboxing}`);
    console.log(`Parenting: ${categorized.parenting}`);
    console.log(`Foreign:   ${categorized.foreign}`);
    console.log(`Wedding:   ${categorized.wedding}`);
    console.log(`\n📝 Modified ${modifiedCount} / ${files.length} articles`);
    console.log('✅ Done!');
}

main();
