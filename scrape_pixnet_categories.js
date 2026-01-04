/**
 * scrape_pixnet_categories.js
 * Scrapes Pixnet blog to extract article categories and business hours
 * Then updates local markdown files with proper categorization
 */

const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const PIXNET_BLOG_URL = 'https://lolwarden.pixnet.net/blog';
const POSTS_DIR = path.join(__dirname, 'src/content/posts');
const CATEGORY_DB = path.join(__dirname, 'pixnet_categories.json');

// Pixnet category mapping (from user's HTML)
const CATEGORY_STRUCTURE = {
    '國內美食': {
        id: 'domestic-food',
        children: {
            '台北美食': 'taipei-food',
            '新北市美食': 'newtaipei-food',
            '基隆美食': 'keelung-food',
            '桃園美食': 'taoyuan-food',
            '新竹美食': 'hsinchu-food',
            '苗栗美食': 'miaoli-food',
            '台中美食': 'taichung-food',
            '南投美食': 'nantou-food',
            '彰化美食': 'changhua-food',
            '台南美食': 'tainan-food',
            '雲林美食': 'yunlin-food',
            '宜蘭美食': 'yilan-food',
            '花蓮美食': 'hualien-food',
            '台東美食': 'taitung-food',
            '甜點分享': 'dessert',
        }
    },
    '國內旅遊': {
        id: 'domestic-travel',
        children: {
            '新北市景點': 'newtaipei-travel',
            '台北景點': 'taipei-travel',
            '基隆景點': 'keelung-travel',
            '宜蘭景點': 'yilan-travel',
            '新竹景點': 'hsinchu-travel',
            '桃園景點': 'taoyuan-travel',
            '苗栗景點': 'miaoli-travel',
            '台中景點': 'taichung-travel',
            '彰化景點': 'changhua-travel',
            '台南景點': 'tainan-travel',
            '花蓮景點': 'hualien-travel',
            '征服小百岳全紀錄': 'hiking',
            '展覽': 'exhibition',
        }
    },
    '國內住宿': {
        id: 'domestic-hotel',
        children: {
            '烏來住宿': 'wulai-hotel',
            '基隆住宿': 'keelung-hotel',
            '板橋住宿': 'banqiao-hotel',
            '桃園住宿': 'taoyuan-hotel',
            '宜蘭住宿': 'yilan-hotel',
            '花蓮住宿': 'hualien-hotel',
            '台南住宿': 'tainan-hotel',
            '台中住宿': 'taichung-hotel',
            '南投住宿': 'nantou-hotel',
            '彰化住宿': 'changhua-hotel',
            '台東住宿': 'taitung-hotel',
        }
    },
    '國外旅遊': {
        id: 'foreign-travel',
        children: {
            '2025香港自由行': 'hongkong-2025',
            '2025沖繩親子自由行': 'okinawa-2025',
            '2019年2月-日本北海道跟團遊': 'hokkaido-2019',
            '2019年5月-中國湖北': 'hubei-2019',
        }
    },
    '時尚流行': {
        id: 'fashion',
        children: {
            '包款推薦': 'bags',
            '鞋款/手錶推薦': 'shoes-watches',
            '美容美髮': 'beauty',
        }
    },
    '開箱': {
        id: 'unboxing',
        children: {
            '滋補養身食品': 'health-food',
            '宅配伴手禮': 'gift',
            '保健食品': 'supplements',
            '居家好物': 'home-goods',
            '孕媽咪日記': 'pregnancy',
            '鍋具': 'cookware',
        }
    },
    '親子育兒': {
        id: 'parenting',
        children: {
            '月子中心推薦': 'postpartum-care',
            '育兒好物': 'baby-goods',
        }
    },
    '婚禮大小事': {
        id: 'wedding',
        children: {
            '婚禮活動': 'wedding-events',
            '婚紗攝影': 'wedding-photo',
        }
    },
    '生活綜合': {
        id: 'lifestyle',
        children: {
            '懶人減肥法': 'weight-loss',
            '居家生活': 'home-life',
            '英文線上課程': 'english-course',
            '韓式照相館': 'korean-photo',
            '數位生活': 'digital',
            '創作': 'creation',
            '食譜分享': 'recipes',
        }
    },
    '股票投資/房地產': {
        id: 'investment',
        children: {
            '建案賞屋心得': 'real-estate',
            '投資經濟學': 'economics',
        }
    },
    'Arduino應用': {
        id: 'arduino',
        children: {
            '教學': 'tutorial',
            'DIY': 'diy',
        }
    },
};

// Business hours patterns to extract
const HOURS_PATTERNS = [
    /營業時間[：:]\s*(.+?)(?:\n|$)/,
    /開放時間[：:]\s*(.+?)(?:\n|$)/,
    /時間[：:]\s*(.+?)(?:\n|$)/,
    /(\d{1,2}:\d{2})\s*[-~]\s*(\d{1,2}:\d{2})/,
];

async function scrapeArticleCategory(articleUrl) {
    try {
        const { data } = await axios.get(articleUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
            timeout: 10000
        });

        const $ = cheerio.load(data);
        const categories = [];

        // Try different selectors for category
        $('.article-categories a, .breadcrumb a, .category a, a[href*="/blog/categories/"]').each((i, el) => {
            const text = $(el).text().trim();
            if (text && text !== '首頁' && text !== 'HOME' && !categories.includes(text)) {
                categories.push(text);
            }
        });

        // Extract business hours from content
        const content = $('.article-content, .article-content-inner, .entry-content').text();
        let businessHours = null;

        for (const pattern of HOURS_PATTERNS) {
            const match = content.match(pattern);
            if (match) {
                businessHours = match[1] || `${match[1]}-${match[2]}`;
                break;
            }
        }

        // Check for closed status
        const title = $('h1, .article-title').text();
        const isPermanentlyClosed = title.includes('已歇業') || title.includes('已停業') ||
            content.includes('已歇業') || content.includes('店家已停業');

        return { categories, businessHours, isPermanentlyClosed };
    } catch (error) {
        return { categories: [], businessHours: null, isPermanentlyClosed: false };
    }
}

async function main() {
    console.log('═'.repeat(60));
    console.log('📂 Pixnet Category Scraper');
    console.log('═'.repeat(60) + '\n');

    // Read existing posts
    const posts = fs.readdirSync(POSTS_DIR).filter(f => f.endsWith('.md'));
    console.log(`Found ${posts.length} local posts\n`);

    const categoryData = [];
    let progress = 0;

    for (const file of posts) {
        const id = file.replace('.md', '');
        const content = fs.readFileSync(path.join(POSTS_DIR, file), 'utf-8');

        // Extract originalUrl from frontmatter
        const urlMatch = content.match(/originalUrl:\s*["']?(.+?)["']?\s*\n/);
        const originalUrl = urlMatch ? urlMatch[1] : `https://lolwarden.pixnet.net/blog/posts/${id}`;

        progress++;
        console.log(`[${progress}/${posts.length}] Scraping ${id}...`);

        const { categories, businessHours, isPermanentlyClosed } = await scrapeArticleCategory(originalUrl);

        categoryData.push({
            id,
            originalUrl,
            pixnetCategories: categories,
            businessHours,
            isPermanentlyClosed,
            scrapedAt: new Date().toISOString()
        });

        // Small delay to be polite
        await new Promise(r => setTimeout(r, 300));
    }

    // Save category data
    fs.writeFileSync(CATEGORY_DB, JSON.stringify({
        lastUpdated: new Date().toISOString(),
        categoryStructure: CATEGORY_STRUCTURE,
        articles: categoryData
    }, null, 2));

    console.log(`\n✅ Saved category data to pixnet_categories.json`);

    // Summary
    const withCategories = categoryData.filter(a => a.pixnetCategories.length > 0).length;
    const withHours = categoryData.filter(a => a.businessHours).length;
    const closed = categoryData.filter(a => a.isPermanentlyClosed).length;

    console.log('\n📊 Summary');
    console.log(`Total articles:     ${categoryData.length}`);
    console.log(`With categories:    ${withCategories}`);
    console.log(`With business hrs:  ${withHours}`);
    console.log(`Permanently closed: ${closed}`);
}

main().catch(console.error);
