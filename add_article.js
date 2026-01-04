/**
 * Article Creation API Script
 * 
 * 透過 n8n Execute Command 調用此腳本來新增文章
 * 
 * 必備參數 (Required):
 *   --title      文章標題
 *   --content    文章內容 (可以是 HTML 或純文字)
 *   --link       原始文章連結
 *   --date       發布日期 (YYYY-MM-DD 或 ISO 格式)
 *   --category   個人分類 (例如: taipei-food, taoyuan-attractions)
 * 
 * 選用參數 (Optional):
 *   --tags       標籤，逗號分隔 (例如: "美食,旅遊,親子")
 *   --slug       自訂網址 slug (預設自動生成)
 *   --deploy     是否觸發部署 (true/false，預設 false)
 *   --json       以 JSON 格式輸入所有參數
 * 
 * 使用範例:
 *   node add_article.js --title "文章標題" --content "內容..." --link "https://..." --date "2026-01-04" --category "taipei-food" --tags "美食,推薦"
 *   node add_article.js --json '{"title":"標題","content":"內容","link":"url","date":"2026-01-04","category":"food"}'
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// 設定
const CONFIG = {
    postsDir: path.join(__dirname, 'src', 'content', 'posts'),
    projectDir: __dirname
};

// 有效的分類列表
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
    '滋補養身食品': 'food'
};

/**
 * 解析命令行參數
 */
function parseArgs() {
    const args = process.argv.slice(2);
    const params = {};

    // 檢查是否使用 JSON 輸入
    const jsonIndex = args.indexOf('--json');
    if (jsonIndex !== -1 && args[jsonIndex + 1]) {
        try {
            return JSON.parse(args[jsonIndex + 1]);
        } catch (e) {
            console.error('❌ JSON 解析錯誤:', e.message);
            process.exit(1);
        }
    }

    // 解析 key-value 參數
    for (let i = 0; i < args.length; i++) {
        if (args[i].startsWith('--')) {
            const key = args[i].substring(2);
            const value = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true;
            params[key] = value;
            if (value !== true) i++;
        }
    }

    return params;
}

/**
 * 驗證必備參數
 */
function validateParams(params) {
    const required = ['title', 'content', 'link', 'date', 'category'];
    const missing = required.filter(field => !params[field]);

    if (missing.length > 0) {
        console.error('❌ 缺少必備參數:', missing.join(', '));
        console.error('\n必備參數:');
        console.error('  --title      文章標題');
        console.error('  --content    文章內容');
        console.error('  --link       原始文章連結');
        console.error('  --date       發布日期 (YYYY-MM-DD)');
        console.error('  --category   個人分類');
        console.error('\n選用參數:');
        console.error('  --tags       標籤 (逗號分隔)');
        console.error('  --slug       自訂網址 slug');
        console.error('  --deploy     觸發部署 (true/false)');
        process.exit(1);
    }

    return true;
}

/**
 * 標準化分類
 */
function normalizeCategory(category) {
    // 如果是中文分類，轉換為英文
    if (CATEGORY_MAPPING[category]) {
        return CATEGORY_MAPPING[category];
    }
    // 如果已經是有效的英文分類
    if (VALID_CATEGORIES.includes(category)) {
        return category;
    }
    // 預設為 travel
    console.warn(`⚠️ 未知分類 "${category}"，使用預設分類 "travel"`);
    return 'travel';
}

/**
 * 生成 slug
 */
function generateSlug(title, date) {
    const dateStr = new Date(date).toISOString().split('T')[0].replace(/-/g, '');
    const hash = Math.random().toString(36).substring(2, 8);
    return `${dateStr}-${hash}`;
}

/**
 * 清理 HTML 內容
 */
function cleanContent(content) {
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
 * 生成 Markdown 文件
 */
function generateMarkdown(params) {
    const {
        title,
        content,
        link,
        date,
        category,
        tags = '',
        slug
    } = params;

    // 處理標籤
    const tagList = typeof tags === 'string'
        ? tags.split(',').map(t => t.trim()).filter(t => t.length > 0)
        : Array.isArray(tags) ? tags : [];

    // 標準化分類
    const normalizedCategory = normalizeCategory(category);

    // 生成 slug
    const finalSlug = slug || generateSlug(title, date);

    // 清理內容
    const cleanedContent = cleanContent(content);

    // 轉義 YAML 字串
    const escapedTitle = title.replace(/'/g, "''");

    // 格式化日期
    const formattedDate = new Date(date).toISOString();

    // 組合標籤 YAML
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

${cleanedContent}

---

📖 [閱讀完整文章](${link})
`;

    return { markdown, slug: finalSlug, category: normalizedCategory };
}

/**
 * 儲存文章
 */
function saveArticle(params) {
    const { markdown, slug, category } = generateMarkdown(params);
    const filename = `${slug}.md`;
    const filepath = path.join(CONFIG.postsDir, filename);

    // 確保目錄存在
    if (!fs.existsSync(CONFIG.postsDir)) {
        fs.mkdirSync(CONFIG.postsDir, { recursive: true });
    }

    // 寫入檔案
    fs.writeFileSync(filepath, markdown, 'utf8');

    return { filepath, filename, slug, category };
}

/**
 * 觸發部署
 */
function triggerDeploy() {
    return new Promise((resolve, reject) => {
        console.log('🚀 正在觸發部署...');

        // 執行 git add, commit, push
        const commands = [
            'git add .',
            `git commit -m "Add new article via API - ${new Date().toISOString()}"`,
            'git push'
        ].join(' && ');

        exec(commands, { cwd: CONFIG.projectDir }, (error, stdout, stderr) => {
            if (error) {
                console.error('❌ 部署失敗:', stderr || error.message);
                reject(error);
                return;
            }
            console.log('✅ 部署成功!');
            console.log(stdout);
            resolve(true);
        });
    });
}

/**
 * 主函數
 */
async function main() {
    console.log('📝 Article Creation API');
    console.log('========================');

    // 解析參數
    const params = parseArgs();

    // 驗證參數
    validateParams(params);

    console.log('\n📄 文章資訊:');
    console.log(`  標題: ${params.title}`);
    console.log(`  分類: ${params.category}`);
    console.log(`  日期: ${params.date}`);
    console.log(`  連結: ${params.link}`);
    if (params.tags) console.log(`  標籤: ${params.tags}`);

    // 儲存文章
    const result = saveArticle(params);

    console.log('\n✅ 文章已建立!');
    console.log(`  檔案: ${result.filename}`);
    console.log(`  路徑: ${result.filepath}`);
    console.log(`  分類: ${result.category}`);

    // 如果需要部署
    if (params.deploy === true || params.deploy === 'true') {
        await triggerDeploy();
    }

    // 輸出 JSON 結果 (方便 n8n 解析)
    const output = {
        success: true,
        file: result.filename,
        path: result.filepath,
        slug: result.slug,
        category: result.category,
        title: params.title,
        deployed: params.deploy === true || params.deploy === 'true'
    };

    console.log('\n📦 JSON Output:');
    console.log(JSON.stringify(output, null, 2));

    return output;
}

// 執行
main().catch(err => {
    console.error('❌ 錯誤:', err.message);
    process.exit(1);
});
