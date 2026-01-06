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

// --- Geocoding Helpers ---

function cleanAddress(addr) {
    if (!addr) return '';
    return addr
        .replace(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}.*$/, '')
        .replace(/^\d{3,5}/g, '')
        .replace(/\(.*?\)/g, '')
        .replace(/（.*?）/g, '')
        .replace(/[，,、。.]+$/, '')
        .replace(/附近.*$/g, '')
        .replace(/\s+/g, '')
        .trim();
}

function geocode(address) {
    return new Promise((resolve, reject) => {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1&countrycodes=tw`;
        const options = {
            headers: { 'User-Agent': 'TwoPiggyBlogSyncServer/1.0 (twopiggyhavefun@gmail.com)' }
        };
        const req = https.get(url, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode !== 200) { resolve(null); return; }
                try {
                    const json = JSON.parse(data);
                    if (json && json.length > 0) {
                        resolve({
                            lat: parseFloat(json[0].lat),
                            lng: parseFloat(json[0].lon)
                        });
                    } else { resolve(null); }
                } catch (e) { resolve(null); }
            });
        });
        req.on('error', (e) => resolve(null));
        req.setTimeout(10000, () => req.destroy());
    });
}


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

/**
 * HTML 轉 Markdown（完整版）
 * 保留圖片、連結、格式
 */
function htmlToMarkdown(html) {
    if (!html) return '';

    let md = html;

    // 處理圖片 - 保留原始 URL
    md = md.replace(/<img[^>]*src=["']([^"']+)["'][^>]*alt=["']([^"']*)["'][^>]*>/gi,
        (match, src, alt) => `![${alt || ''}](${src})\n\n`);
    md = md.replace(/<img[^>]*alt=["']([^"']*)["'][^>]*src=["']([^"']+)["'][^>]*>/gi,
        (match, alt, src) => `![${alt || ''}](${src})\n\n`);
    md = md.replace(/<img[^>]*src=["']([^"']+)["'][^>]*>/gi,
        (match, src) => `![](${src})\n\n`);

    // 處理連結
    md = md.replace(/<a[^>]*href=["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi, '[$2]($1)');

    // 處理標題
    md = md.replace(/<h1[^>]*>([^<]*)<\/h1>/gi, '\n# $1\n\n');
    md = md.replace(/<h2[^>]*>([^<]*)<\/h2>/gi, '\n## $1\n\n');
    md = md.replace(/<h3[^>]*>([^<]*)<\/h3>/gi, '\n### $1\n\n');
    md = md.replace(/<h4[^>]*>([^<]*)<\/h4>/gi, '\n#### $1\n\n');

    // 處理粗體和斜體
    md = md.replace(/<strong[^>]*>([^<]*)<\/strong>/gi, '**$1**');
    md = md.replace(/<b[^>]*>([^<]*)<\/b>/gi, '**$1**');
    md = md.replace(/<em[^>]*>([^<]*)<\/em>/gi, '*$1*');
    md = md.replace(/<i[^>]*>([^<]*)<\/i>/gi, '*$1*');

    // 處理換行和分隔線
    md = md.replace(/<br\s*\/?>/gi, '\n');
    md = md.replace(/<hr\s*\/?>/gi, '\n---\n\n');

    // 處理段落
    md = md.replace(/<p[^>]*>/gi, '\n');
    md = md.replace(/<\/p>/gi, '\n\n');

    // 處理列表
    md = md.replace(/<li[^>]*>/gi, '- ');
    md = md.replace(/<\/li>/gi, '\n');
    md = md.replace(/<\/?ul[^>]*>/gi, '\n');
    md = md.replace(/<\/?ol[^>]*>/gi, '\n');

    // 處理區塊引用
    md = md.replace(/<blockquote[^>]*>/gi, '\n> ');
    md = md.replace(/<\/blockquote>/gi, '\n\n');

    // 移除其他 HTML 標籤
    md = md.replace(/<div[^>]*>/gi, '\n');
    md = md.replace(/<\/div>/gi, '\n');
    md = md.replace(/<span[^>]*>/gi, '');
    md = md.replace(/<\/span>/gi, '');
    md = md.replace(/<[^>]+>/g, '');

    // HTML 實體解碼
    md = md.replace(/&nbsp;/g, ' ');
    md = md.replace(/&amp;/g, '&');
    md = md.replace(/&lt;/g, '<');
    md = md.replace(/&gt;/g, '>');
    md = md.replace(/&quot;/g, '"');
    md = md.replace(/&#39;/g, "'");
    md = md.replace(/&#(\d+);/g, (match, code) => String.fromCharCode(code));

    // 清理多餘空白和換行
    md = md.replace(/\n{4,}/g, '\n\n\n');
    md = md.replace(/[ \t]+$/gm, '');
    md = md.trim();

    return md;
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

/**
 * 從文章頁面提取完整內容、標籤、分類、封面圖
 * 支援 Next.js RSC (React Server Components) 格式
 * 格式參考 migrate_missing_posts.js
 */
function parseArticleContent(html) {
    const result = {
        category: '',
        tags: [],
        contentHtml: '',  // 保留原始 HTML
        cover: '',        // 封面圖片
        images: [],
        businessHours: null
    };

    // 1. 提取封面圖片 (從 og:image meta tag)
    const coverMatch = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i) ||
        html.match(/<meta[^>]*content="([^"]+)"[^>]*property="og:image"/i);
    if (coverMatch) {
        result.cover = coverMatch[1];
    }

    // 2. 從 RSC 資料中提取標籤 (優先)
    // Pixnet 使用 Next.js RSC，標籤在 self.__next_f.push() 中
    // 格式: "tags":[{"id":8925,"name":"台北約會餐廳"},...]
    const rscTagMatch = html.match(/\\?"tags\\?":\s*\[\s*\{[^[\]]*?"name\\?":\s*\\?"([^"\\]+)\\?"/);
    if (rscTagMatch) {
        // 找到 RSC 格式，提取所有標籤
        const rscTagsRegex = /\\?"tags\\?":\s*\[((?:\{[^{}]*\},?\s*)*)\]/g;
        let rscMatch;
        while ((rscMatch = rscTagsRegex.exec(html)) !== null) {
            const tagsJson = rscMatch[1];
            // 從 JSON 中提取標籤名稱
            const nameMatches = tagsJson.matchAll(/\\?"name\\?":\s*\\?"([^"\\]+)\\?"/g);
            for (const m of nameMatches) {
                const tag = m[1].trim();
                if (tag && !result.tags.includes(tag)) {
                    result.tags.push(tag);
                }
            }
        }
    }

    // 3. 提取個人分類 (優先從 RSC 資料，保留中文原始名稱)
    const rscCategoryMatch = html.match(/\\?"category\\?":\s*\{[^{}]*?"name\\?":\s*\\?"([^"\\]+)\\?"/);
    if (rscCategoryMatch) {
        result.category = rscCategoryMatch[1].trim();
    } else {
        // Fallback: 從 HTML 連結提取
        const categoryMatch = html.match(/<a[^>]*href="[^"]*\/blog\/category\/[^"]*"[^>]*>([^<]+)<\/a>/i);
        if (categoryMatch) {
            result.category = categoryMatch[1].trim();
        }
    }

    // 4. Fallback: 從 HTML tag 連結提取標籤
    if (result.tags.length === 0) {
        const tagRegex = /<a[^>]*href="[^"]*\/blog\/tag\/[^"]*"[^>]*>([^<]+)<\/a>/gi;
        let tagMatch;
        const seenTags = new Set();
        while ((tagMatch = tagRegex.exec(html)) !== null) {
            const tag = tagMatch[1].trim();
            if (tag && !seenTags.has(tag)) {
                seenTags.add(tag);
                result.tags.push(tag);
            }
        }
    }

    // 5. 提取完整文章內容 (保留原始 HTML)
    let contentHtml = '';

    // 優先使用 cheerio-like 選擇器：#article-content-inner 或 .article-content
    const innerMatch = html.match(/<div[^>]*id="article-content-inner"[^>]*>([\s\S]*?)<\/div>\s*<div[^>]*class="[^"]*article/i);
    if (innerMatch) {
        contentHtml = innerMatch[1];
    } else {
        // 嘗試 class="article-content-inner"
        const classMatch = html.match(/<div[^>]*class="[^"]*article-content-inner[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<div[^>]*class="[^"]*article/i);
        if (classMatch) {
            contentHtml = classMatch[1];
        } else {
            // 最後嘗試：找 article-content-inner 到結尾
            const simpleMatch = html.match(/<div[^>]*class="[^"]*article-content-inner[^"]*"[^>]*>([\s\S]*)/i);
            if (simpleMatch) {
                let content = simpleMatch[1];
                const endPos = content.search(/<div[^>]*class="[^"]*(?:article-footer|article-keyword|tag-container)/i);
                if (endPos > 0) {
                    content = content.substring(0, endPos);
                }
                contentHtml = content;
            }
        }
    }

    // 6. 如果沒有封面圖，從內容中取第一張圖
    if (!result.cover && contentHtml) {
        const firstImgMatch = contentHtml.match(/<img[^>]*src="([^"]+)"/i);
        if (firstImgMatch) {
            result.cover = firstImgMatch[1];
        }
    }

    // 7. 提取圖片 URLs
    const imgRegex = /<img[^>]*src=["']([^"']+)["'][^>]*>/gi;
    let imgMatch;
    while ((imgMatch = imgRegex.exec(contentHtml)) !== null) {
        const src = imgMatch[1];
        if (src && !src.includes('data:') && !src.includes('pixel')) {
            result.images.push(src);
        }
    }

    // 8. 保留原始 HTML（不做 Markdown 轉換）
    result.contentHtml = contentHtml;

    // 9. 提取營業時間（可選）
    const hoursMatch = contentHtml.match(/營業時間[：:]\s*([^\n<]+)/);
    if (hoursMatch) {
        result.businessHours = hoursMatch[1].trim();
    }

    // 10. 提取地址 (New)
    const addressMatch = html.match(/(?:地址|店址|地點|位置|Add|Address)[：:]\s*([^<>\n\r]+)/i);
    if (addressMatch) {
        let addr = cleanAddress(addressMatch[1]);
        if (addr.length >= 3 && addr.length <= 100 && !/^\d+\./.test(addr)) {
            result.address = addr;
        }
    }

    return result;
}

// ============================================
// 文章建立
// ============================================

/**
 * 建立文章 Markdown 檔案
 * 格式參考 migrate_missing_posts.js
 */
function createArticle(data) {
    const { title, contentHtml, link, date, category, tags = [], cover = '', businessHours = null, address = null, lat = null, lng = null } = data;

    if (!title || !link) {
        return { success: false, error: '缺少必填欄位' };
    }

    const tagList = typeof tags === 'string'
        ? tags.split(',').map(t => t.trim()).filter(t => t)
        : Array.isArray(tags) ? tags : [];

    const articleDate = date || new Date().toISOString().split('T')[0];
    const slug = generateSlug(articleDate);
    const formattedDate = new Date(articleDate).toISOString();

    // 使用與 migrate_missing_posts.js 相同的 frontmatter 格式
    const frontmatter = [
        '---',
        `title: ${JSON.stringify(title)}`,
        `date: "${formattedDate}"`,
        `cover: "${cover || ''}"`,
        `tags: ${JSON.stringify(tagList)}`,
        `originalUrl: "${link}"`,
        `businessHours: ${businessHours ? JSON.stringify(businessHours) : 'null'}`,
        `category: "${category || ''}"`,
        address ? `address: "${address}"` : null,
        lat ? `lat: ${lat}` : null,
        lng ? `lng: ${lng}` : null,
    ].filter(Boolean); // Filter nulls

    const frontmatterString = frontmatter.concat([
        '---',
        '',
        '<div class="pixnet-article prose max-w-none">',
        contentHtml || '',
        '</div>'
    ]).join('\n');

    if (!fs.existsSync(CONFIG.postsDir)) {
        fs.mkdirSync(CONFIG.postsDir, { recursive: true });
    }

    const filename = `${slug}.md`;
    const filepath = path.join(CONFIG.postsDir, filename);
    fs.writeFileSync(filepath, frontmatterString, 'utf8');

    return { success: true, file: filename, path: filepath, slug, category, title };
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

                // 標籤來自列表頁 JSON (article.tags)，分類優先使用文章頁面提取的
                const finalTags = article.tags.length > 0 ? article.tags : contentInfo.tags;
                const finalCategory = contentInfo.category || article.category;

                log(`  分類: ${finalCategory}`, 'INFO');
                log(`  標籤: ${finalTags.length} 個 - ${finalTags.join(', ')}`, 'INFO');
                log(`  封面: ${contentInfo.cover ? '有' : '無'}`, 'INFO');
                log(`  圖片: ${contentInfo.images.length} 張`, 'INFO');

                // Geocode
                let coords = null;
                if (contentInfo.address) {
                    log(`  地址: ${contentInfo.address} (Geocoding...)`, 'INFO');
                    try {
                        await new Promise(r => setTimeout(r, 1200)); // Rate limit
                        coords = await geocode(contentInfo.address);
                        if (coords) log(`    -> 座標: ${coords.lat}, ${coords.lng}`, 'INFO');
                    } catch (e) { /* ignore */ }
                }

                const result = createArticle({
                    title: article.title,
                    contentHtml: contentInfo.contentHtml,  // 使用原始 HTML
                    link: article.link,
                    date: article.date,
                    category: finalCategory,
                    tags: finalTags,
                    tags: finalTags,
                    cover: contentInfo.cover,              // 封面圖片
                    businessHours: contentInfo.businessHours,  // 營業時間
                    address: contentInfo.address,
                    lat: coords ? coords.lat : null,
                    lng: coords ? coords.lng : null
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
    console.log('🚀 Pixnet Blog Sync Server (Full Content Edition)');
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
