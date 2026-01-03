const fs = require('fs');
const path = require('path');

const POSTS_DIR = 'src/content/posts';

function extractBusinessNames() {
    const files = fs.readdirSync(POSTS_DIR).filter(f => f.endsWith('.md'));
    const businesses = [];

    files.forEach(file => {
        const content = fs.readFileSync(path.join(POSTS_DIR, file), 'utf-8');
        const frontmatter = content.match(/^---\n([\s\S]*?)\n---/)[1];
        const titleMatch = frontmatter.match(/title: "(.*)"/);
        const title = titleMatch ? titleMatch[1] : file;

        // Common patterns for business info in food blogs
        const patterns = [
            /店名：(.*?)(?:\n|<br)/,
            /店家名稱：(.*?)(?:\n|<br)/,
            /餐廳名稱：(.*?)(?:\n|<br)/,
            /商家名稱：(.*?)(?:\n|<br)/,
            /【(.*?)(?:】)/ // Some users put name in brackets like 【Name】
        ];

        let foundName = null;
        for (const p of patterns) {
            const match = content.match(p);
            if (match) {
                let candidate = match[1].trim();
                // Filter out non-names like "店家資訊" or common words if regex was too loose
                if (candidate.length > 1 && !candidate.includes('資訊') && !candidate.includes('更多')) {
                    foundName = candidate.replace(/<.*?>/g, '').trim();
                    break;
                }
            }
        }

        if (foundName) {
            businesses.push({ file, title, name: foundName });
        }
    });

    fs.writeFileSync('business_list.json', JSON.stringify(businesses, null, 2));
    console.log(`Extracted ${businesses.length} businesses.`);
}

extractBusinessNames();
