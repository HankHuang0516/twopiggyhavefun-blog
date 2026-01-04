/**
 * Article API Server
 * 
 * 一個簡單的 HTTP API 伺服器，用於接收文章資料並建立 Markdown 檔案。
 * n8n 可以透過 HTTP Request 節點呼叫此 API。
 * 
 * 啟動方式: node article_api_server.js
 * 預設埠號: 3456
 * 
 * API 端點:
 *   POST /api/article - 新增文章
 *   GET /api/health   - 健康檢查
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

// 設定
const PORT = process.env.PORT || 3456;
const POSTS_DIR = path.join(__dirname, 'src', 'content', 'posts');

// 有效的分類
const VALID_CATEGORIES = [
    'taipei-food', 'taipei-attractions',
    'newtaipei-food', 'newtaipei-attractions',
    'taoyuan-food', 'taoyuan-attractions',
    'hsinchu-food', 'hsinchu-attractions',
    'miaoli-food', 'miaoli-attractions',
    'taichung-food', 'taichung-attractions',
    'nantou-food', 'nantou-attractions',
    'yilan-food', 'yilan-attractions',
    'keelung-food', 'keelung-attractions',
    'tainan-food', 'tainan-attractions',
    'kaohsiung-food', 'kaohsiung-attractions',
    'travel', 'food', 'parenting', 'life', 'hotel'
];

// 中文分類對照表
const CATEGORY_MAPPING = {
    '台北美食': 'taipei-food',
    '台北景點': 'taipei-attractions',
    '新北美食': 'newtaipei-food',
    '新北市美食': 'newtaipei-food',
    '新北景點': 'newtaipei-attractions',
    '新北市景點': 'newtaipei-attractions',
    '桃園美食': 'taoyuan-food',
    '桃園景點': 'taoyuan-attractions',
    '新竹美食': 'hsinchu-food',
    '新竹景點': 'hsinchu-attractions',
    '苗栗美食': 'miaoli-food',
    '苗栗景點': 'miaoli-attractions',
    '台中美食': 'taichung-food',
    '台中景點': 'taichung-attractions',
    '南投美食': 'nantou-food',
    '南投景點': 'nantou-attractions',
    '宜蘭美食': 'yilan-food',
    '宜蘭景點': 'yilan-attractions',
    '基隆美食': 'keelung-food',
    '基隆景點': 'keelung-attractions',
    '台南美食': 'tainan-food',
    '台南景點': 'tainan-attractions',
    '高雄美食': 'kaohsiung-food',
    '高雄景點': 'kaohsiung-attractions',
    '旅遊': 'travel',
    '美食': 'food',
    '親子': 'parenting',
    '生活': 'life',
    '住宿': 'hotel',
    '保健食品': 'life',
    '居家好物': 'life',
    '滋補養身食品': 'food',
    '創作': 'life'
};

/**
 * 標準化分類
 */
function normalizeCategory(category) {
    if (CATEGORY_MAPPING[category]) {
        return CATEGORY_MAPPING[category];
    }
    if (VALID_CATEGORIES.includes(category)) {
        return category;
    }
    return 'travel';
}

/**
 * 生成 slug
 */
function generateSlug(date) {
    const dateStr = new Date(date).toISOString().split('T')[0].replace(/-/g, '');
    const hash = Math.random().toString(36).substring(2, 8);
    return `${dateStr}-${hash}`;
}

/**
 * 清理內容
 */
function cleanContent(content) {
    if (!content) return '';
    return content
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&#13;/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

/**
 * 建立文章
 */
function createArticle(data) {
    const { title, content, link, date, category, tags = '' } = data;

    // 驗證必填欄位
    if (!title || !content || !link || !category) {
        return {
            success: false,
            error: '缺少必填欄位',
            required: ['title', 'content', 'link', 'category']
        };
    }

    // 處理標籤
    const tagList = typeof tags === 'string'
        ? tags.split(',').map(t => t.trim()).filter(t => t.length > 0)
        : Array.isArray(tags) ? tags : [];

    // 標準化分類
    const normalizedCategory = normalizeCategory(category);

    // 生成 slug 和日期
    const articleDate = date || new Date().toISOString().split('T')[0];
    const slug = generateSlug(articleDate);
    const formattedDate = new Date(articleDate).toISOString();

    // 清理內容
    const cleanedContent = cleanContent(content);

    // 轉義標題
    const escapedTitle = title.replace(/'/g, "''");

    // 組合標籤 YAML
    const tagsYaml = tagList.length > 0
        ? `tags:\n${tagList.map(t => `  - ${t}`).join('\n')}`
        : 'tags: []';

    // 生成 Markdown
    const markdown = `---
title: '${escapedTitle}'
date: '${formattedDate}'
category: ${normalizedCategory}
${tagsYaml}
originalUrl: ${link}
---

${cleanedContent}

---

📖 [閱讀完整文章](${link})
`;

    // 確保目錄存在
    if (!fs.existsSync(POSTS_DIR)) {
        fs.mkdirSync(POSTS_DIR, { recursive: true });
    }

    // 儲存檔案
    const filename = `${slug}.md`;
    const filepath = path.join(POSTS_DIR, filename);
    fs.writeFileSync(filepath, markdown, 'utf8');

    return {
        success: true,
        message: '文章已建立',
        file: filename,
        path: filepath,
        slug: slug,
        category: normalizedCategory,
        title: title
    };
}

/**
 * 處理 CORS
 */
function setCorsHeaders(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

/**
 * 回傳 JSON
 */
function sendJson(res, statusCode, data) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(data, null, 2));
}

/**
 * 解析 JSON body
 */
function parseBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch (e) {
                reject(new Error('Invalid JSON'));
            }
        });
        req.on('error', reject);
    });
}

/**
 * 建立伺服器
 */
const server = http.createServer(async (req, res) => {
    setCorsHeaders(res);

    // 處理 CORS preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    const url = req.url.split('?')[0];

    console.log(`${new Date().toISOString()} - ${req.method} ${url}`);

    // 健康檢查
    if (url === '/api/health' && req.method === 'GET') {
        sendJson(res, 200, { status: 'ok', timestamp: new Date().toISOString() });
        return;
    }

    // 新增文章
    if (url === '/api/article' && req.method === 'POST') {
        try {
            const data = await parseBody(req);
            const result = createArticle(data);

            if (result.success) {
                console.log(`✅ 文章已建立: ${result.file}`);
                sendJson(res, 200, result);
            } else {
                console.log(`❌ 建立失敗: ${result.error}`);
                sendJson(res, 400, result);
            }
        } catch (err) {
            console.error(`❌ 錯誤: ${err.message}`);
            sendJson(res, 500, { success: false, error: err.message });
        }
        return;
    }

    // 404
    sendJson(res, 404, { error: 'Not found' });
});

// 啟動伺服器
server.listen(PORT, () => {
    console.log('='.repeat(50));
    console.log('📝 Article API Server');
    console.log('='.repeat(50));
    console.log(`🚀 伺服器運行於: http://localhost:${PORT}`);
    console.log(`📁 文章儲存目錄: ${POSTS_DIR}`);
    console.log('');
    console.log('可用端點:');
    console.log(`  POST http://localhost:${PORT}/api/article - 新增文章`);
    console.log(`  GET  http://localhost:${PORT}/api/health  - 健康檢查`);
    console.log('');
    console.log('按 Ctrl+C 停止伺服器');
    console.log('='.repeat(50));
});
