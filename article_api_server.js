/**
 * Article API Server (Express + OAuth Edition)
 * 
 * 功能:
 * 1. 雙豬部落格後端 (文章管理、自動部署)
 * 2. Flickr OAuth 認證與代理 (支援私有相簿讀取)
 * 
 * 參考架構: Timehut Server (v5.0-UNIFIED)
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const https = require('https');
const { OAuth } = require('oauth');

// 初始化 Express
const app = express();
const PORT = process.env.PORT || 3456;
const POSTS_DIR = path.join(__dirname, 'src', 'content', 'posts');
const DIST_DIR = path.join(__dirname, 'dist');
const VERSION = "20260125-Refactor-Express";

// 網誌設定
const AUTH_PASSWORD = process.env.AUTH_PASSWORD || 'asasas123';
const GIT_TOKEN = process.env.GIT_TOKEN || '';
const GIT_REPO = 'HankHuang0516/twopiggyhavefun-blog';

// ==================== Middleware ====================
app.use(cors());
app.use(express.json({ limit: '50mb' })); // 支援大 payload

// ==================== Flickr OAuth Setup ====================
const oauth = new OAuth(
    'https://www.flickr.com/services/oauth/request_token',
    'https://www.flickr.com/services/oauth/access_token',
    process.env.FLICKR_API_KEY,
    process.env.FLICKR_API_SECRET,
    '1.0A',
    null,
    'HMAC-SHA1'
);

// 暫存 Token (生產環境建議改用 DB 或 Redis，但在 Railway 重新部署會重置是可接受的)
let oauthTokens = {
    accessToken: process.env.FLICKR_OAUTH_TOKEN || '',
    accessTokenSecret: process.env.FLICKR_OAUTH_TOKEN_SECRET || ''
};
let tempRequestTokens = {};

// ==================== Helper Functions ====================

// 簽名與建立請求 URL helper (from Timehut)
function buildBaseString(method, url, params) {
    const sortedParams = Object.keys(params)
        .sort()
        .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
        .join('&');
    return `${method}&${encodeURIComponent(url)}&${encodeURIComponent(sortedParams)}`;
}

// GitHub API Helper
async function githubApi(method, endpoint, body = null) {
    const url = `https://api.github.com${endpoint}`;
    console.log(`[GitHub] ${method} ${url}`);

    const options = {
        method,
        headers: {
            'Authorization': `Bearer ${GIT_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'NodeJS-Deploy-Bot',
            'Content-Type': 'application/json'
        }
    };

    if (body) {
        options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    const data = await response.json();

    if (!response.ok) {
        throw new Error(`GitHub API Error: ${response.status} - ${data.message}`);
    }
    return data;
}

// 自動部署邏輯
async function autoDeploy(action, filename) {
    if (!GIT_TOKEN) {
        console.log('⚠️ GIT_TOKEN 未設定，跳過自動部署');
        return { skipped: true };
    }

    const repoPath = `src/content/posts/${filename}`;
    const commitMsg = `[Auto] ${action}: ${filename}`;
    const localFilePath = path.join(POSTS_DIR, filename);

    console.log(`🚀 開始自動部署: ${action} ${filename}`);

    try {
        let currentSha = null;
        try {
            const fileData = await githubApi('GET', `/repos/${GIT_REPO}/contents/${repoPath}`);
            currentSha = fileData.sha;
        } catch (e) {
            if (!e.message.includes('404')) throw e;
        }

        if (action === 'Delete') {
            if (!currentSha) return { skipped: true };
            await githubApi('DELETE', `/repos/${GIT_REPO}/contents/${repoPath}`, {
                message: commitMsg, sha: currentSha,
                committer: { name: 'Railway Bot', email: 'bot@railway.app' }
            });
        } else {
            if (!fs.existsSync(localFilePath)) throw new Error(`找不到本地檔案: ${localFilePath}`);
            const content = fs.readFileSync(localFilePath).toString('base64');
            const payload = {
                message: commitMsg, content: content,
                committer: { name: 'Railway Bot', email: 'bot@railway.app' }
            };
            if (currentSha) payload.sha = currentSha;
            await githubApi('PUT', `/repos/${GIT_REPO}/contents/${repoPath}`, payload);
        }
        console.log(`✅ 自動部署成功: ${filename}`);
        return { success: true };
    } catch (error) {
        console.error(`❌ 自動部署失敗: ${error.message}`);
        return { success: false, error: error.message };
    }
}

function slugify(text) {
    return text.toString().toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^\w\u4e00-\u9fa5\-]+/g, '')
        .replace(/\-\-+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '');
}

// ==================== Flickr Auth Routes ====================

// 檢查授權狀態
app.get('/api/auth/status', (req, res) => {
    res.json({
        authenticated: !!oauthTokens.accessToken,
        userId: process.env.FLICKR_USER_ID,
        version: VERSION
    });
});

// 信任 Proxy (Railway Load Balancer)
app.set('trust proxy', 1);

// 開始 OAuth 流程
app.get('/api/auth/start', (req, res) => {
    if (!process.env.FLICKR_API_KEY || !process.env.FLICKR_API_SECRET) {
        console.error('❌ Missing FLICKR_API_KEY or FLICKR_API_SECRET');
        return res.status(500).json({ error: 'Flickr API Key/Secret 未設定' });
    }

    // 強制使用 HTTPS (若是 Railway environment)
    const host = req.get('host');
    const isRailway = host && host.includes('railway.app');
    const protocol = isRailway ? 'https' : (req.headers['x-forwarded-proto'] || 'http');

    const callbackUrl = `${protocol}://${host}/api/auth/callback`;
    console.log(`[OAuth] Starting auth with callback: ${callbackUrl}`);

    oauth.getOAuthRequestToken({ oauth_callback: callbackUrl }, (error, token, tokenSecret) => {
        if (error) {
            console.error('OAuth Request Token Error:', error);
            return res.status(500).json({ error: '無法開始授權流程 (OAuth Request Failed)' });
        }
        tempRequestTokens[token] = tokenSecret;
        res.json({ authUrl: `https://www.flickr.com/services/oauth/authorize?oauth_token=${token}&perms=delete` });
    });
});

// OAuth Callback
app.get('/api/auth/callback', (req, res) => {
    const { oauth_token, oauth_verifier } = req.query;
    const tokenSecret = tempRequestTokens[oauth_token];

    if (!tokenSecret) return res.status(400).send('無效的授權請求');

    oauth.getOAuthAccessToken(oauth_token, tokenSecret, oauth_verifier, (error, accessToken, accessTokenSecret) => {
        if (error) {
            console.error('OAuth Access Token Error:', error);
            return res.status(500).send('授權失敗');
        }

        oauthTokens.accessToken = accessToken;
        oauthTokens.accessTokenSecret = accessTokenSecret;
        delete tempRequestTokens[oauth_token];

        console.log('✅ Flickr 授權成功！');

        // 回傳 HTML 讓使用者複製 Token
        res.send(`
            <html>
            <body style="font-family: sans-serif; text-align: center; padding: 50px;">
                <h1 style="color: #28a745;">✅ Flickr 授權成功！</h1>
                <p>請將以下 Token 加入 Railway 環境變數以永久生效：</p>
                <div style="background: #f5f5f5; padding: 20px; text-align: left; display: inline-block;">
                    <p><code>FLICKR_OAUTH_TOKEN=${accessToken}</code></p>
                    <p><code>FLICKR_OAUTH_TOKEN_SECRET=${accessTokenSecret}</code></p>
                </div>
                <script>
                    if (window.opener) window.opener.postMessage({ type: 'FLICKR_AUTH_SUCCESS' }, '*');
                </script>
            </body>
            </html>
        `);
    });
});

// ==================== Flickr Proxy Routes (Authenticated) ====================

// 取得相簿列表
app.get('/api/flickr/albums', (req, res) => {
    if (!oauthTokens.accessToken) return res.status(401).json({ error: '尚未授權 Flickr (需 OAuth)' });

    const url = `https://api.flickr.com/services/rest/?method=flickr.photosets.getList&api_key=${process.env.FLICKR_API_KEY}&user_id=${process.env.FLICKR_USER_ID}&format=json&nojsoncallback=1&primary_photo_extras=url_m`;

    console.log('[Proxy] Fetching Albums via OAuth...');
    oauth.get(url, oauthTokens.accessToken, oauthTokens.accessTokenSecret, (err, data) => {
        if (err) {
            console.error('[Proxy] OAuth Error:', err);
            return res.status(500).json({ error: 'Flickr API Error' });
        }
        try {
            const json = JSON.parse(data);
            // DEBUG: Log body to verify fix
            console.log(`[Proxy] Response Body (Albums):`, JSON.stringify(json, null, 2));
            res.json(json);
        } catch (e) {
            res.status(500).json({ error: 'Parse Error' });
        }
    });
});

// 取得最近相片
app.get('/api/flickr/recent', (req, res) => {
    if (!oauthTokens.accessToken) return res.status(401).json({ error: '尚未授權 Flickr (需 OAuth)' });

    const url = `https://api.flickr.com/services/rest/?method=flickr.people.getPublicPhotos&api_key=${process.env.FLICKR_API_KEY}&user_id=${process.env.FLICKR_USER_ID}&format=json&nojsoncallback=1&extras=url_m,url_o,date_upload`;

    oauth.get(url, oauthTokens.accessToken, oauthTokens.accessTokenSecret, (err, data) => {
        if (err) return res.status(500).json({ error: err });
        res.json(JSON.parse(data));
    });
});

// 取得單一相簿內容 (Proxy)
app.get('/api/flickr/album/:id/photos', (req, res) => {
    const { id } = req.params;

    // 如果沒有 Token，嘗試用公開 API (但不保證能讀取)
    if (!oauthTokens.accessToken) {
        // Fallback to public call if needed, or error. Timehut requires auth.
        // Let's require auth for consistency.
        return res.status(401).json({ error: '尚未授權 Flickr (需 OAuth)' });
    }

    const url = `https://api.flickr.com/services/rest/?method=flickr.photosets.getPhotos&api_key=${process.env.FLICKR_API_KEY}&user_id=${process.env.FLICKR_USER_ID}&photoset_id=${id}&extras=url_m,url_o,date_upload&format=json&nojsoncallback=1`;

    oauth.get(url, oauthTokens.accessToken, oauthTokens.accessTokenSecret, (err, data) => {
        if (err) return res.status(500).json({ error: err });
        res.json(JSON.parse(data));
    });
});

// ==================== Blog API Routes ====================

app.get('/api/health', (req, res) => res.json({ status: 'ok', version: VERSION }));

// 建立/更新文章
app.post('/api/article', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${AUTH_PASSWORD}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const { title, content, category, tags, slug: userSlug, date, coverImage } = req.body;
        if (!title || !content) return res.status(400).json({ error: 'Missing title or content' });

        const postDate = date ? new Date(date) : new Date();
        const dateStr = postDate.toISOString().split('T')[0];
        const slug = userSlug || slugify(title);
        const filename = `${slug}.md`;
        const filePath = path.join(POSTS_DIR, filename);

        // 建構 Frontmatter
        let fileContent = `---
title: "${title}"
date: ${postDate.toISOString()}
category: "${category || 'Uncategorized'}"
tags: [${(tags || []).map(t => `"${t}"`).join(', ')}]
input_slug: "${slug}"`;

        if (coverImage) fileContent += `\nimage: "${coverImage}"`;
        fileContent += `\n---\n\n${content}`;

        if (!fs.existsSync(POSTS_DIR)) fs.mkdirSync(POSTS_DIR, { recursive: true });

        fs.writeFileSync(filePath, fileContent);
        console.log(`✅ 文章已儲存: ${filename}`);

        // 觸發自動部署
        const deployResult = await autoDeploy('Update', filename);

        res.json({
            success: true,
            message: 'Article created/updated',
            filename,
            deploy: deployResult
        });
    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// 刪除文章
app.delete('/api/posts/:filename', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${AUTH_PASSWORD}`) return res.status(401).json({ error: 'Unauthorized' });

    const { filename } = req.params;
    const filePath = path.join(POSTS_DIR, filename);

    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });

    try {
        fs.unlinkSync(filePath);
        await autoDeploy('Delete', filename);
        res.json({ success: true, message: 'Deleted' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 讀取文章 (List)
app.get('/api/posts', (req, res) => {
    try {
        if (!fs.existsSync(POSTS_DIR)) return res.json([]);
        const files = fs.readdirSync(POSTS_DIR).filter(f => f.endsWith('.md'));
        const posts = files.map(f => {
            const content = fs.readFileSync(path.join(POSTS_DIR, f), 'utf8');
            // 簡易解析 Frontmatter (不依賴 gray-matter 以減少依賴，或可之後加)
            const titleMatch = content.match(/title:\s*"(.*?)"/);
            const dateMatch = content.match(/date:\s*(.*)/);
            return {
                filename: f,
                title: titleMatch ? titleMatch[1] : f,
                date: dateMatch ? dateMatch[1] : ''
            };
        });
        // Sort by date desc
        posts.sort((a, b) => new Date(b.date) - new Date(a.date));
        res.json(posts);
    } catch (e) {
        res.json([]);
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Version: ${VERSION}`);
    console.log(`OAuth Enabled: ${!!oauthTokens.accessToken}`);
});
