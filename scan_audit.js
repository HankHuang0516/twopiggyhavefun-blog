
const fs = require('fs');
const path = require('path');

const POSTS_DIR = path.join(__dirname, 'src/content/posts');
const REPORT_FILE = 'C:\\Users\\z004rx2h\\.gemini\\antigravity\\brain\\b623c93d-fd04-4b4c-ad62-5be35b7b78e6\\business_status.md';

// Helper to parse frontmatter simply
function parseFrontmatter(content) {
    const match = content.match(/^---\s*([\s\S]*?)\s*---/);
    if (!match) return {};
    const fm = match[1];
    const data = {};

    // Extract title
    const titleMatch = fm.match(/title:\s*(.*)/);
    if (titleMatch) data.title = titleMatch[1].trim().replace(/^['"]|['"]$/g, '');

    // Extract businessHours
    const hoursMatch = fm.match(/businessHours:\s*(.*)/);
    if (hoursMatch) data.businessHours = hoursMatch[1].trim().replace(/^['"]|['"]$/g, '');

    return data;
}

function getCheckedStores() {
    if (!fs.existsSync(REPORT_FILE)) return new Set();
    const content = fs.readFileSync(REPORT_FILE, 'utf8');
    const checked = new Set();
    const lines = content.split('\n');
    for (const line of lines) {
        if (line.trim().startsWith('|') && !line.includes('店家名稱')) {
            const parts = line.split('|');
            if (parts.length > 2) {
                const name = parts[1].trim().replace(/\*\*/g, '');
                checked.add(name);
            }
        }
    }
    return checked;
}

function scan() {
    const checked = getCheckedStores();
    console.log(`Already checked: ${checked.size} stores.`);

    if (!fs.existsSync(POSTS_DIR)) {
        console.error("Posts dir not found!");
        return;
    }

    const files = fs.readdirSync(POSTS_DIR).filter(f => f.endsWith('.md'));
    const candidates = [];

    for (const file of files) {
        const content = fs.readFileSync(path.join(POSTS_DIR, file), 'utf8');
        const data = parseFrontmatter(content);

        if (data.businessHours && data.title) {
            // Clean title for matching
            const cleanTitle = data.title;
            if (!checked.has(cleanTitle)) {
                candidates.push({
                    file,
                    title: cleanTitle,
                    hours: data.businessHours
                });
            }
        }
    }

    console.log(`Found ${candidates.length} stores with hours needing verification.`);

    // Output top 5 for immediate action
    if (candidates.length > 0) {
        console.log("\nTop 5 Candidates:");
        candidates.slice(0, 5).forEach(c => {
            console.log(`- ${c.title} (File: ${c.file}) [Hours: ${c.hours}]`);
        });

        // Save to temp file for the agent to read
        fs.writeFileSync('audit_candidates.json', JSON.stringify(candidates, null, 2));
    }
}

scan();
