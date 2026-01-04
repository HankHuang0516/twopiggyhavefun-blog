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

const regionNames = {
    'taipei': '台北', 'newtaipei': '新北', 'keelung': '基隆', 'taoyuan': '桃園',
    'hsinchu': '新竹', 'miaoli': '苗栗', 'taichung': '台中', 'nantou': '南投',
    'changhua': '彰化', 'yunlin': '雲林', 'chiayi': '嘉義', 'tainan': '台南',
    'kaohsiung': '高雄', 'pingtung': '屏東', 'yilan': '宜蘭', 'hualien': '花蓮',
    'taitung': '台東'
};

function categorizePost(title, content, existingTags = []) {
    const tags = new Set(['pixnet']); // Always include pixnet tag
    // Use title and a portion of content for keyword matching (to avoid noise from footer/sidebar if present)
    // Taking first 3000 chars of content should cover the intro where keywords usually appear.
    // Fix Generic Titles or Broken Titles (starting with &nbsp;)
    let newTitle = title;
    if (title.trim() === '兩隻小豬' || title.trim() === 'Uncategorized' || title.includes('&nbsp;') || title.match(/^&[a-z]+;/)) {
        // Strip frontmatter first
        const bodyContent = content.replace(/^---[\s\S]+?---\s*/, '');
        // Remove HTML tags and entities
        const plainText = bodyContent
            .replace(/<[^>]+>/g, ' ')
            .replace(/&nbsp;/g, ' ')
            .replace(/&[a-zA-Z0-9#]+;/g, ' ') // Remove other entities
            .replace(/\s+/g, ' ')
            .trim();

        if (plainText.length > 0) {
            let extracted = plainText.substring(0, 50);
            // Ensure we don't cut words or sentences weirdly? Just simple truncate for now.
            if (plainText.length > 50) extracted += '...';
            newTitle = extracted;
        }
    }

    // Determine category based on NEW title + content + tags
    // Use title and a portion of content for keyword matching (to avoid noise from footer/sidebar if present)
    // Taking first 3000 chars of content should cover the intro where keywords usually appear.
    const text = newTitle + ' ' + (content || '').substring(0, 3000);

    // Combine title and existing tags for keyword search
    const searchTerms = [newTitle, ...existingTags];

    // Detect region (Tags priority, then Title)
    for (const [region, keywords] of Object.entries(REGIONS)) {
        // Check tags first
        if (existingTags.some(t => keywords.includes(t) || t.includes(regionNames[region] || ''))) {
            tags.add(region);
        }
        // Then Check Title
        else {
            for (const keyword of keywords) {
                if (text.includes(keyword)) {
                    tags.add(region);
                    break;
                }
            }
        }
    }

    // Check for foreign (Specific logic)
    const hasDomesticKeywords = Object.values(REGIONS).flat().some(kw => text.includes(kw)) ||
        existingTags.some(t => Object.values(REGIONS).flat().includes(t));

    if (!hasDomesticKeywords) {
        for (const kw of CATEGORIES.foreign.keywords) {
            if (text.includes(kw) || existingTags.includes(kw)) {
                tags.add('foreign');
                // return Array.from(tags); // Don't return early, allowing multi-cat
            }
        }
    }

    // Check for specific categories
    const priorityOrder = ['unboxing', 'parenting', 'wedding', 'hotel', 'food', 'travel'];

    for (const catKey of priorityOrder) {
        const cat = CATEGORIES[catKey];
        // Check Tags
        if (existingTags.some(t => cat.keywords.includes(t) || t === cat.tag || t === catKey)) {
            tags.add(cat.tag);
            continue;
        }

        // Check Title
        for (const keyword of cat.keywords) {
            if (text.includes(keyword)) {
                tags.add(cat.tag);
                break;
            }
        }
    }

    return { tags: Array.from(tags), newTitle };
}



function main() {
    console.log('══════════════════════════════════════════════════');
    console.log('📂 Auto-Categorize & Fix Titles');
    console.log('══════════════════════════════════════════════════\n');

    const files = fs.readdirSync(POSTS_DIR).filter(f => f.endsWith('.md'));
    let modifiedCount = 0;
    const categorized = { food: 0, travel: 0, hotel: 0, unboxing: 0, parenting: 0, foreign: 0, wedding: 0 };

    for (const file of files) {
        const filePath = path.join(POSTS_DIR, file);
        let content = fs.readFileSync(filePath, 'utf-8');

        // Parse frontmatter
        const titleMatch = content.match(/title:\s*["']?(.+?)["']?\s*\n/);
        const title = titleMatch ? titleMatch[1] : '';

        // Extract tags to pass to function
        const tagsMatch = content.match(/tags:\s*\[(.*?)\]/s);
        let currentTags = [];
        if (tagsMatch) {
            currentTags = tagsMatch[1].split(',').map(t => t.trim().replace(/^['"]|['"]$/g, ''));
        }

        const { tags: newTags, newTitle } = categorizePost(title, content, currentTags);

        // Merge tags
        const mergedTags = [...new Set([...currentTags, ...newTags])];
        const isTagsChanged = JSON.stringify(currentTags.sort()) !== JSON.stringify(mergedTags.sort());
        const isTitleChanged = newTitle !== title;

        if (isTagsChanged || isTitleChanged) {
            if (isTitleChanged) {
                content = content.replace(/title:\s*["'].+?["']?(\s*\n)/, `title: "${newTitle.replace(/"/g, '\\"')}"$1`);
            }

            if (isTagsChanged) {
                const newTagsStr = mergedTags.map(t => `"${t}"`).join(', ');
                if (content.match(/tags:\s*\[.*?\]/s)) {
                    content = content.replace(/tags:\s*\[.*?\]/s, `tags: [${newTagsStr}]`);
                } else {
                    // Find the end of the frontmatter (second '---')
                    const frontmatterEndIndex = content.indexOf('---', 3);
                    if (frontmatterEndIndex !== -1) {
                        // Insert tags before the closing '---'
                        content = content.slice(0, frontmatterEndIndex) + `tags: [${newTagsStr}]\n` + content.slice(frontmatterEndIndex);
                    } else {
                        // Fallback if no closing '---' found, add after date if present
                        content = content.replace(/(date:\s*.+?\n)/, `$1tags: [${newTagsStr}]\n`);
                    }
                }
            }

            fs.writeFileSync(filePath, content, 'utf-8');
            console.log(`✅ ${file.slice(0, 20)}...: Title: ${isTitleChanged ? newTitle : '(same)'}, Tags: ${newTags.join(', ')}`);
            modifiedCount++;
        }

        // Count categories for summary
        if (newTags) {
            for (const tag of newTags) {
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
