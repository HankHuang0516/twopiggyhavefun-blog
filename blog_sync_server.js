/**
 * Pixnet Blog Sync Server
 * 
 * 全自動部落格同步伺服器：
 * 1. 定時檢查 Pixnet 新文章並自動同步
 * 2. 提供 API 手動新增文章
 * 3. 可選擇自動 git push 部署
 * 
 * 啟動方式: node blog_sync_server.js
 * 預設埠號: 3456
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// ============================================
// 設定
// ============================================
const CONFIG = {
    port: process.env.PORT || 3456,
    postsDir: path.join(__dirname, 'src', 'content', 'posts'),
    syncStateFile: path.join(__dirname, 'scripts', 'last_sync.json'),
    pixnetBlogUrl: 'https://lolwarden.pixnet.net/blog',

    // 同步設定
    syncIntervalMinutes: 60,  // 每60分鐘檢查一次
    maxArticlesPerSync: 10,   // 每次最多同步10篇
    autoDeploy: true,         // 是否自動 git push

    // 同步時間 (24小時制)
    scheduledHour: 21,        // 晚上9點
    scheduledMinute: 0
};

// ============================================
// 分類對照表
// ============================================
const CATEGORY_MAPPING = {
    '台北美食': 'taipei-food',
    '台北景點': 'taipei-attractions',
    '新北美食': 'newtaipei-food',
    '新北市美食': 'newtaipei-food',
    '新北景點': 'newtaipei-attractions',
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
    '創作': 'life',
    'default': 'travel'
};

// ============================================
// 工具函數
// ============================================

function log(message, type = 'INFO') {
    const timestamp = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
    const prefix = { INFO: '📝', SUCCESS: '✅', ERROR: '❌', SYNC: '🔄', WARN: '⚠️' };
    console.log(`[${timestamp}] ${prefix[type] || '📝'} ${message}`);
}

function normalizeCategory(category) {
    if (CATEGORY_MAPPING[category]) return CATEGORY_MAPPING[category];
    return CATEGORY_MAPPING['default'];
}

function generateSlug(date) {
    const dateStr = new Date(date).toISOString().split('T')[0].replace(/-/g, '');
    const hash = Math.random().toString(36).substring(2, 8);
    return `${dateStr}-${hash}`;
}

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
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

// ============================================
// 同步狀態管理
// ============================================

function loadSyncState() {
    try {
        if (fs.existsSync(CONFIG.syncStateFile)) {
            return JSON.parse(fs.readFileSync(CONFIG.syncStateFile, 'utf8'));
        }
    } catch (e) {
        log('無法讀取同步狀態，建立新狀態', 'WARN');
    }
    return { syncedArticles: [], lastSyncTime: null };
}

function saveSyncState(state) {
    const dir = path.dirname(CONFIG.syncStateFile);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(CONFIG.syncStateFile, JSON.stringify(state, null, 2));
}

// ============================================
// HTTP 請求
// ============================================

function fetchUrl(url) {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;
        const req = protocol.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                fetchUrl(res.headers.location).then(resolve).catch(reject);
                return;
            }
            let data = '';
            res.setEncoding('utf8');
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        });
        req.on('error', reject);
        req.setTimeout(30000, () => { req.destroy(); reject(new Error('Timeout')); });
    });
}

// ============================================
// Pixnet 文章解析
// ============================================

function parsePixnetArticles(html) {
    const articles = [];

    try {
        // 從 Next.js JSON 中提取文章
        const postsMatch = html.match(/"posts":\s*\[([\s\S]*?)\],"blog"/);
        if (postsMatch) {
            try {
                const posts = JSON.parse('[' + postsMatch[1] + ']');
                for (const post of posts) {
                    if (post.id && post.title && post.post_url) {
                        articles.push({
                            id: String(post.id),
                            link: post.post_url,
                            title: post.title,
                            category: post.category?.name || 'travel',
                            date: post.published_at ? new Date(post.published_at * 1000).toISOString() : new Date().toISOString(),
                            tags: post.tags?.map(t => t.name) || []
                        });
                    }
                }
            } catch (e) {
                log('JSON 解析失敗，嘗試 regex', 'WARN');
            }
        }

        // Fallback: regex
        if (articles.length === 0) {
            const regex = /<a[^>]*href="(https?:\/\/lolwarden\.pixnet\.net\/blog\/posts?\/(\d+)[^"]*)"[^>]*>([^<]{10,})<\/a>/g;
            let match;
            const seen = new Set();
            while ((match = regex.exec(html)) !== null) {
                const [_, link, id, title] = match;
                if (!seen.has(id) && !title.includes('繼續閱讀')) {
                    seen.add(id);
                    articles.push({
                        id, link, title: title.trim(),
                        category: 'travel',
                        date: new Date().toISOString(),
                        tags: []
                    });
                }
            }
        }
    } catch (e) {
        log(`解析錯誤: ${e.message}`, 'ERROR');
    }

    return articles.slice(0, CONFIG.maxArticlesPerSync);
}

function parseArticleContent(html) {
    let category = 'travel';

    // 從 HTML 中找分類
    for (const [key, value] of Object.entries(CATEGORY_MAPPING)) {
        if (key !== 'default' && html.includes(key)) {
            category = value;
            break;
        }
    }

    // 提取內容預覽
    let contentPreview = '';
    const contentMatch = html.match(/<div[^>]*class="[^"]*article-content[^"]*"[^>]*>([\s\S]*?)<\/div>/);
    if (contentMatch) {
        contentPreview = cleanContent(contentMatch[1]).substring(0, 500);
    }

    return { category, contentPreview };
}

// ============================================
// 文章建立
// ============================================

function createArticle(data) {
    const { title, content, link, date, category, tags = '' } = data;

    if (!title || !link || !category) {
        return { success: false, error: '缺少必填欄位' };
    }

    const tagList = typeof tags === 'string'
        ? tags.split(',').map(t => t.trim()).filter(t => t)
        : Array.isArray(tags) ? tags : [];

    const normalizedCategory = normalizeCategory(category);
    const articleDate = date || new Date().toISOString().split('T')[0];
    const slug = generateSlug(articleDate);
    const formattedDate = new Date(articleDate).toISOString();
    const escapedTitle = title.replace(/'/g, "''");

    const tagsYaml = tagList.length > 0
        ? `tags:\n${tagList.map(t => `  - ${t}`).join('\n')}`
        : 'tags: []';

    const markdown = `---
title: '${escapedTitle}'
date: '${formattedDate}'
category: ${normalizedCategory}
${tagsYaml}
originalUrl: ${link}
---

${cleanContent(content) || ''}

---

📖 [閱讀完整文章](${link})
`;

    if (!fs.existsSync(CONFIG.postsDir)) {
        fs.mkdirSync(CONFIG.postsDir, { recursive: true });
    }

    const filename = `${slug}.md`;
    const filepath = path.join(CONFIG.postsDir, filename);
    fs.writeFileSync(filepath, markdown, 'utf8');

    return { success: true, file: filename, path: filepath, slug, category: normalizedCategory, title };
}

// ============================================
// Pixnet 同步
// ============================================

async function syncPixnetArticles() {
    log('開始同步 Pixnet 文章...', 'SYNC');

    const state = loadSyncState();
    const syncedIds = new Set(state.syncedArticles);

    try {
        const html = await fetchUrl(CONFIG.pixnetBlogUrl);
        const articles = parsePixnetArticles(html);
        log(`找到 ${articles.length} 篇文章`, 'INFO');

        const newArticles = articles.filter(a => !syncedIds.has(a.id));
        log(`新文章: ${newArticles.length} 篇`, 'INFO');

        if (newArticles.length === 0) {
            log('沒有新文章需要同步', 'INFO');
            return { synced: 0, total: articles.length };
        }

        let successCount = 0;
        for (const article of newArticles) {
            try {
                log(`處理: ${article.title}`, 'INFO');

                // 取得完整文章內容
                const articleHtml = await fetchUrl(article.link);
                const contentInfo = parseArticleContent(articleHtml);

                const result = createArticle({
                    title: article.title,
                    content: contentInfo.contentPreview,
                    link: article.link,
                    date: article.date,
                    category: contentInfo.category,
                    tags: article.tags.join(',')
                });

                if (result.success) {
                    log(`已建立: ${result.file}`, 'SUCCESS');
                    state.syncedArticles.push(article.id);
                    successCount++;
                }

                // 延遲避免請求過快
                await new Promise(r => setTimeout(r, 1500));

            } catch (err) {
                log(`處理失敗: ${err.message}`, 'ERROR');
            }
        }

        state.lastSyncTime = new Date().toISOString();
        saveSyncState(state);

        log(`同步完成！成功 ${successCount} 篇`, 'SUCCESS');

        // 自動部署
        if (CONFIG.autoDeploy && successCount > 0) {
            await triggerDeploy();
        }

        return { synced: successCount, total: articles.length };

    } catch (err) {
        log(`同步失敗: ${err.message}`, 'ERROR');
        throw err;
    }
}

async function triggerDeploy() {
    log('觸發部署...', 'SYNC');
    return new Promise((resolve) => {
        const commands = 'git add . && git commit -m "Auto sync from Pixnet" && git push';
        exec(commands, { cwd: __dirname }, (error, stdout, stderr) => {
            if (error) {
                log(`部署失敗: ${stderr || error.message}`, 'ERROR');
            } else {
                log('部署成功！', 'SUCCESS');
            }
            resolve();
        });
    });
}

// ============================================
// 排程器
// ============================================

function startScheduler() {
    // 每分鐘檢查是否到同步時間
    setInterval(() => {
        const now = new Date();
        const hours = now.getHours();
        const minutes = now.getMinutes();

        if (hours === CONFIG.scheduledHour && minutes === CONFIG.scheduledMinute) {
            syncPixnetArticles().catch(err => log(`定時同步失敗: ${err.message}`, 'ERROR'));
        }
    }, 60 * 1000);

    log(`排程已設定: 每天 ${CONFIG.scheduledHour}:${String(CONFIG.scheduledMinute).padStart(2, '0')} 自動同步`, 'INFO');

    // 也可以設定固定間隔同步
    if (CONFIG.syncIntervalMinutes > 0) {
        setInterval(() => {
            syncPixnetArticles().catch(err => log(`定時同步失敗: ${err.message}`, 'ERROR'));
        }, CONFIG.syncIntervalMinutes * 60 * 1000);

        log(`間隔同步: 每 ${CONFIG.syncIntervalMinutes} 分鐘`, 'INFO');
    }
}

// ============================================
// HTTP 伺服器
// ============================================

function setCorsHeaders(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function sendJson(res, statusCode, data) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(data, null, 2));
}

function parseBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try { resolve(body ? JSON.parse(body) : {}); }
            catch (e) { reject(new Error('Invalid JSON')); }
        });
        req.on('error', reject);
    });
}

const server = http.createServer(async (req, res) => {
    setCorsHeaders(res);

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    const url = req.url.split('?')[0];
    log(`${req.method} ${url}`, 'INFO');

    // 健康檢查
    if (url === '/api/health' && req.method === 'GET') {
        const state = loadSyncState();
        sendJson(res, 200, {
            status: 'ok',
            lastSync: state.lastSyncTime,
            syncedCount: state.syncedArticles.length,
            timestamp: new Date().toISOString()
        });
        return;
    }

    // 手動新增文章
    if (url === '/api/article' && req.method === 'POST') {
        try {
            const data = await parseBody(req);
            const result = createArticle(data);
            sendJson(res, result.success ? 200 : 400, result);
        } catch (err) {
            sendJson(res, 500, { success: false, error: err.message });
        }
        return;
    }

    // 手動觸發同步
    if (url === '/api/sync' && req.method === 'POST') {
        try {
            const result = await syncPixnetArticles();
            sendJson(res, 200, { success: true, ...result });
        } catch (err) {
            sendJson(res, 500, { success: false, error: err.message });
        }
        return;
    }

    // 查看同步狀態
    if (url === '/api/status' && req.method === 'GET') {
        const state = loadSyncState();
        sendJson(res, 200, state);
        return;
    }

    sendJson(res, 404, { error: 'Not found' });
});

// ============================================
// 啟動
// ============================================

server.listen(CONFIG.port, () => {
    console.log('');
    console.log('='.repeat(55));
    console.log('🚀 Pixnet Blog Sync Server');
    console.log('='.repeat(55));
    console.log(`📡 伺服器: http://localhost:${CONFIG.port}`);
    console.log(`📁 文章目錄: ${CONFIG.postsDir}`);
    console.log('');
    console.log('可用 API:');
    console.log(`  GET  /api/health   - 健康檢查`);
    console.log(`  GET  /api/status   - 同步狀態`);
    console.log(`  POST /api/article  - 手動新增文章`);
    console.log(`  POST /api/sync     - 手動觸發同步`);
    console.log('');
    console.log('='.repeat(55));

    // 啟動排程
    startScheduler();

    // 啟動時立即執行一次同步
    log('啟動時執行同步...', 'SYNC');
    syncPixnetArticles().catch(err => log(`啟動同步失敗: ${err.message}`, 'ERROR'));
});
