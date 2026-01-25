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
const DIST_DIR = path.join(__dirname, 'dist');
const VERSION = "20260125-AutoDeploy"; // 版本標記

const AUTH_PASSWORD = process.env.AUTH_PASSWORD || 'asasas123';
const GIT_TOKEN = process.env.GIT_TOKEN || '';
const GIT_REPO = 'HankHuang0516/twopiggyhavefun-blog';

/**
 * 自動部署到 GitHub (使用 GitHub API)
 */
async function autoDeploy(action, filename) {
    if (!GIT_TOKEN) {
        console.log('⚠️ GIT_TOKEN 未設定，跳過自動部署');
        return { skipped: true };
    }

    const commitMsg = `[Auto] ${action}: ${filename}`;

    console.log(`🚀 開始自動部署: ${action} ${filename}`);

    try {
        const refData = await githubApi('GET', `/repos/${GIT_REPO}/git/ref/heads/main`);
        const latestCommitSha = refData.object.sha;

        // 2. 取得目前的 tree
        const commitData = await githubApi('GET', `/repos/${GIT_REPO}/git/commits/${latestCommitSha}`);
        const baseTreeSha = commitData.tree.sha;

        // 3. 讀取所有 posts 檔案並建立新的 tree
        const postsFiles = fs.readdirSync(POSTS_DIR).filter(f => f.endsWith('.md'));
        const treeItems = postsFiles.map(file => {
            const content = fs.readFileSync(path.join(POSTS_DIR, file), 'utf8');
            return {
                path: `src/content/posts/${file}`,
                mode: '100644',
                type: 'blob',
                content: content
            };
        });

        // 4. 建立新的 tree
        const newTree = await githubApi('POST', `/repos/${GIT_REPO}/git/trees`, {
            base_tree: baseTreeSha,
            tree: treeItems
        });

        // 5. 建立新的 commit
        const newCommit = await githubApi('POST', `/repos/${GIT_REPO}/git/commits`, {
            message: commitMsg,
            tree: newTree.sha,
            parents: [latestCommitSha],
            author: {
                name: 'Railway Bot',
                email: 'bot@railway.app',
                date: new Date().toISOString()
            }
        });

        // 6. 更新 ref 指向新的 commit
        await githubApi('PATCH', `/repos/${GIT_REPO}/git/refs/heads/main`, {
            sha: newCommit.sha
        });

        console.log(`✅ 自動部署成功: ${newCommit.sha.substring(0, 7)}`);
        return { success: true, sha: newCommit.sha };

    } catch (err) {
        console.error(`❌ 部署失敗: ${err.message}`);
        throw err;
    }
}

/**
 * GitHub API 請求工具
 */
function githubApi(method, endpoint, data = null) {
    return new Promise((resolve, reject) => {
        const https = require('https');
        const options = {
            hostname: 'api.github.com',
            path: endpoint,
            method: method,
            headers: {
                'Authorization': `token ${GIT_TOKEN}`,
                'User-Agent': 'Railway-Bot',
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(body);
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(json);
                    } else {
                        reject(new Error(json.message || `GitHub API error: ${res.statusCode}`));
                    }
                } catch (e) {
                    reject(new Error(`Failed to parse response: ${body}`));
                }
            });
        });

        req.on('error', reject);

        if (data) {
            req.write(JSON.stringify(data));
        }
        req.end();
    });
}

function checkAuth(req, res) {
    const auth = req.headers['x-auth-password'];
    if (auth !== AUTH_PASSWORD) {
        res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, error: 'Unauthorized' }));
        return false;
    }
    return true;
}

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
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Auth-Password');
}

/**
 * 回傳 JSON
 */
function sendJson(res, statusCode, data) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(data, null, 2));
}

/**
 * 伺服器靜態檔案
 */
const MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.txt': 'text/plain',
    '.xml': 'application/xml'
};

function serveStatic(req, res) {
    let url = req.url.split('?')[0];
    console.log(`Debug serveStatic: url=${url}, startsWith(/api/)=${url.startsWith('/api/')}`);
    if (url.startsWith('/api/')) return false; // 不要將 API 路徑當作靜態檔案處理
    if (url === '/') url = '/index.html';

    // 如果路徑不含副檔名，且不是以 / 結尾，可能是 Astro 路由，試著尋找 .html 檔案
    let filePath = path.join(DIST_DIR, url);

    if (!path.extname(filePath)) {
        // 嘗試目錄下的 index.html 或 直接加 .html
        const dirIndex = path.join(filePath, 'index.html');
        if (fs.existsSync(dirIndex)) {
            filePath = dirIndex;
        } else if (fs.existsSync(filePath + '.html')) {
            filePath = filePath + '.html';
        }
    }

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        res.writeHead(200, { 'Content-Type': contentType });
        const stream = fs.createReadStream(filePath);
        stream.pipe(res);
        return true;
    }
    return false;
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

    let url = req.url.split('?')[0];
    // 標準化 URL: 移除結尾斜線 (除非只是 /)
    if (url.length > 1 && url.endsWith('/')) {
        url = url.slice(0, -1);
    }

    console.log(`${new Date().toISOString()} - [${req.method}] ${url}`);

    // 健康檢查
    if (url === '/api/health' && req.method === 'GET') {
        sendJson(res, 200, { status: 'ok', timestamp: new Date().toISOString() });
        return;
    }

    // 新增文章 (Original endpoint)
    if (url === '/api/article' && req.method === 'POST') {
        if (!checkAuth(req, res)) return;
        try {
            const data = await parseBody(req);
            const result = createArticle(data);

            if (result.success) {
                console.log(`✅ 文章已建立: ${result.file}`);

                // 自動部署
                autoDeploy('Create', result.file).catch(err => {
                    console.error('自動部署失敗:', err.message);
                });

                sendJson(res, 200, { ...result, deploying: !!GIT_TOKEN });
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
    if (url === '/api/posts' && req.method === 'GET') {
        try {
            if (!fs.existsSync(POSTS_DIR)) return sendJson(res, 200, []);
            const files = fs.readdirSync(POSTS_DIR).filter(f => f.endsWith('.md'));
            const posts = files.map(filename => {
                const content = fs.readFileSync(path.join(POSTS_DIR, filename), 'utf8');
                const titleMatch = content.match(/title:\s*['"](.*?)['"]/);
                const dateMatch = content.match(/date:\s*['"](.*?)['"]/);
                const catMatch = content.match(/category:\s*(.*)/);
                return {
                    filename,
                    slug: filename.replace('.md', ''),
                    title: titleMatch ? titleMatch[1] : filename,
                    date: dateMatch ? dateMatch[1] : null,
                    category: catMatch ? catMatch[1].trim() : 'travel'
                };
            }).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
            sendJson(res, 200, posts);
        } catch (err) {
            sendJson(res, 500, { error: err.message });
        }
        return;
    }

    // Get specific article
    if (url.startsWith('/api/posts/') && req.method === 'GET') {
        if (!checkAuth(req, res)) return;
        const slug = url.replace('/api/posts/', '');
        const filepath = path.join(POSTS_DIR, `${slug}.md`);
        if (!fs.existsSync(filepath)) return sendJson(res, 404, { error: 'Not found' });

        try {
            const content = fs.readFileSync(filepath, 'utf8');
            sendJson(res, 200, { slug, content });
        } catch (err) {
            sendJson(res, 500, { error: err.message });
        }
        return;
    }

    // Update article
    if (url.startsWith('/api/posts/') && req.method === 'PUT') {
        if (!checkAuth(req, res)) return;
        const slug = url.replace('/api/posts/', '');
        const filepath = path.join(POSTS_DIR, `${slug}.md`);
        if (!fs.existsSync(filepath)) return sendJson(res, 404, { error: 'Not found' });

        try {
            const { content } = await parseBody(req);
            if (!content) return sendJson(res, 400, { error: 'Content required' });

            fs.writeFileSync(filepath, content, 'utf8');
            console.log(`✅ 文章已更新: ${slug}.md`);

            // 自動部署
            autoDeploy('Update', `${slug}.md`).catch(err => {
                console.error('自動部署失敗:', err.message);
            });

            sendJson(res, 200, { success: true, slug, deploying: !!GIT_TOKEN });
        } catch (err) {
            sendJson(res, 500, { error: err.message });
        }
        return;
    }

    // Delete article
    if (url.startsWith('/api/posts/') && req.method === 'DELETE') {
        if (!checkAuth(req, res)) return;
        const slug = url.replace('/api/posts/', '');
        const filepath = path.join(POSTS_DIR, `${slug}.md`);
        if (!fs.existsSync(filepath)) return sendJson(res, 404, { error: 'Not found' });

        try {
            fs.unlinkSync(filepath);
            console.log(`🗑️ 文章已刪除: ${slug}.md`);

            // 自動部署
            autoDeploy('Delete', `${slug}.md`).catch(err => {
                console.error('自動部署失敗:', err.message);
            });

            sendJson(res, 200, { success: true, slug, deploying: !!GIT_TOKEN });
        } catch (err) {
            sendJson(res, 500, { error: err.message });
        }
        return;
    }

    // Flickr OEmbed Proxy
    if (url === '/api/flickr-proxy' && req.method === 'GET') {
        const urlObj = new URL(req.url, `http://${req.headers.host}`);
        const targetUrl = urlObj.searchParams.get('url');

        if (!targetUrl) return sendJson(res, 400, { error: 'Missing url parameter' });

        const flickrApi = `https://www.flickr.com/services/oembed/?format=json&url=${encodeURIComponent(targetUrl)}`;

        const https = require('https');
        https.get(flickrApi, (resp) => {
            let data = '';
            resp.on('data', (chunk) => data += chunk);
            resp.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    sendJson(res, 200, json);
                } catch (e) {
                    sendJson(res, 500, { error: 'Failed to parse Flickr response' + data });
                }
            });
        }).on('error', (err) => {
            sendJson(res, 500, { error: err.message });
        });
        return;
    }

    // Trigger Deploy (Git Push)
    if (url === '/api/deploy' && req.method === 'POST') {
        if (!checkAuth(req, res)) return;
        const { exec } = require('child_process');
        exec('git add . && git commit -m "Manual content update via API" && git push', (err, stdout, stderr) => {
            if (err) {
                console.error(`❌ 部署失敗: ${stderr}`);
                return sendJson(res, 500, { success: false, error: stderr });
            }
            console.log('🚀 部署成功');
            sendJson(res, 200, { success: true });
        });
        return;
    }

    // 404 or Static Files
    console.log(`Debug: Calling serveStatic for ${url}`);
    if (serveStatic(req, res)) {
        console.log(`Debug: serveStatic returned true for ${url}`);
        return;
    }

    console.log(`Debug: match failed, sending 404 JSON for ${url}`);
    sendJson(res, 404, { error: 'Not found' });
});

// 啟動伺服器
server.listen(PORT, '0.0.0.0', () => {
    console.log(`==========================================`);
    console.log(`Article API Server (Unified) is running`);
    console.log(`Version: ${VERSION}`);
    console.log(`Local: http://localhost:${PORT}`);
    console.log(`Serving static files from: ${DIST_DIR}`);
    console.log(`==========================================`);
    console.log('');
    console.log('可用端點:');
    console.log(`  POST http://localhost:${PORT}/api/article - 新增文章`);
    console.log(`  GET  http://localhost:${PORT}/api/health  - 健康檢查`);
    console.log('');
    console.log('按 Ctrl+C 停止伺服器');
});
