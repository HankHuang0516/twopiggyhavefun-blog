const fs = require('fs');
const path = require('path');

const POSTS_DIR = 'src/content/posts';

const categories = {
    food: ['美食', '好吃', '美味', '食記', '餐廳', '蛋糕', '甜點', '咖啡', '火鍋', '燒肉', '小吃', '板橋', '新北', '台北'],
    travel: ['旅遊', '遊記', '一日遊', '景點', '住宿', '飯店', '民宿', '觀光', '宜蘭', '花蓮', '台南', '台中'],
    life: ['開箱', '生活', '日常', '推薦', '好物', '髮廊', '體驗', '親子']
};

function getCategory(title) {
    let matched = new Set();
    matched.add('pixnet'); // Keep original tag

    for (const [cat, keywords] of Object.entries(categories)) {
        if (keywords.some(k => title.includes(k))) {
            matched.add(cat);
        }
    }

    // Default to life if no specific match but it looks like a blog post
    if (matched.size === 1) matched.add('life');

    return Array.from(matched);
}

function processFiles() {
    const files = fs.readdirSync(POSTS_DIR);

    files.forEach(file => {
        if (!file.endsWith('.md')) return;

        const filePath = path.join(POSTS_DIR, file);
        const content = fs.readFileSync(filePath, 'utf-8');

        // Parse frontmatter
        const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
        const match = content.match(frontmatterRegex);

        if (match) {
            const frontmatter = match[1];
            const titleMatch = frontmatter.match(/title: "(.*)"/);

            if (titleMatch) {
                const title = titleMatch[1];
                const newTags = getCategory(title);

                // Replace tags line
                const newFrontmatter = frontmatter.replace(/tags: \[.*\]/, `tags: ${JSON.stringify(newTags)}`);
                const newContent = content.replace(frontmatter, newFrontmatter);

                fs.writeFileSync(filePath, newContent);
                console.log(`Updated ${file}: ${newTags.join(', ')}`);
            }
        }
    });
}

processFiles();
