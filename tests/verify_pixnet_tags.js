const https = require('https');
const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
    reset: "\x1b[0m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    cyan: "\x1b[36m"
};

const POSTS_DIR = path.join(__dirname, '..', 'src', 'content', 'posts');

// Helper to fetch URL (copied from pixnet_sync.js structure)
function fetchUrl(url) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        const req = client.get(url, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                fetchUrl(res.headers.location).then(resolve).catch(reject);
                return;
            }
            if (res.statusCode !== 200) {
                reject(new Error(`Failed to fetch ${url}: ${res.statusCode}`));
                return;
            }
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        });
        req.on('error', reject);
    });
}

// Function to parse frontmatter manually (avoiding dependencies)
function parseFrontmatter(content) {
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!match) return null;

    const frontmatter = {};
    const lines = match[1].split('\n');
    let currentKey = null;

    for (const line of lines) {
        if (!line.trim()) continue;

        // List item
        if (line.trim().startsWith('- ') && currentKey) {
            if (!Array.isArray(frontmatter[currentKey])) {
                frontmatter[currentKey] = [];
            }
            frontmatter[currentKey].push(line.trim().substring(2).trim());
        }
        // Key-value pair
        else if (line.includes(':')) {
            const [key, ...values] = line.split(':');
            currentKey = key.trim();
            const value = values.join(':').trim();
            if (value) {
                // Remove quotes if present
                frontmatter[currentKey] = value.replace(/^['"](.*)['"]$/, '$1');
            }
        }
    }
    return frontmatter;
}

async function verifyTags() {
    console.log(`${colors.cyan}Starting Pixnet Tag Verification (Last 30 Posts)...${colors.reset}`);

    // 1. Get last 30 posts
    const files = fs.readdirSync(POSTS_DIR)
        .filter(f => f.endsWith('.md'))
        .sort((a, b) => b.localeCompare(a)) // Sort desc (assuming filename starts with date or id)
        .slice(0, 30);

    console.log(`Found ${files.length} posts to verify.`);

    let passCount = 0;
    let failCount = 0;

    for (const file of files) {
        const filePath = path.join(POSTS_DIR, file);
        const content = fs.readFileSync(filePath, 'utf8');
        const frontmatter = parseFrontmatter(content);

        if (!frontmatter || !frontmatter.originalUrl || !frontmatter.originalUrl.includes('pixnet.net')) {
            console.log(`${colors.yellow}Skipping ${file}: Not a Pixnet post or missing frontmatter.${colors.reset}`);
            continue;
        }

        const url = frontmatter.originalUrl;
        console.log(`\nVerifying ${file}...`);
        console.log(`  Source: ${url}`);

        try {
            // Fetch live Pixnet content
            const html = await fetchUrl(url);

            // Extract remote tags
            let remoteTags = [];
            const keywordsMatch = html.match(/<meta name="keywords" content="([^"]+)"/i);
            if (keywordsMatch) {
                remoteTags = keywordsMatch[1].split(',').map(t => t.trim()).filter(t => t);
            }

            // Get local tags
            const localTags = frontmatter.tags || [];

            // Compare
            // Filter out internal tags like 'pixnet-sync', 'auto-imported'
            const filteredLocalTags = localTags.filter(t => t !== 'pixnet-sync' && t !== 'auto-imported');

            const localSet = new Set(filteredLocalTags);
            const remoteSet = new Set(remoteTags);

            // Check for missing or extra tags
            const missing = [...remoteSet].filter(x => !localSet.has(x));
            const extra = [...localSet].filter(x => !remoteSet.has(x));

            if (missing.length === 0 && extra.length === 0) {
                console.log(`  ${colors.green}PASS: Tags match perfectly.${colors.reset}`);
                passCount++;
            } else {
                console.log(`  ${colors.red}FAIL: Tag mismatch.${colors.reset}`);
                if (missing.length > 0) console.log(`    Missing locally: ${missing.join(', ')}`);
                if (extra.length > 0) console.log(`    Extra locally: ${extra.join(', ')}`);

                // Allow some tolerance? Maybe not for now.
                // If it's the article we just fixed, it should match.
                // Interactive fix? No, just report.
                failCount++;
            }

            // Be nice to the server
            await new Promise(r => setTimeout(r, 500));

        } catch (e) {
            console.log(`  ${colors.red}ERROR: Could not fetch/parse ${url}: ${e.message}${colors.reset}`);
            failCount++;
        }
    }

    console.log('\n' + '='.repeat(30));
    console.log(`Verification Complete.`);
    console.log(`${colors.green}Passed: ${passCount}${colors.reset}`);
    console.log(`${colors.red}Failed: ${failCount}${colors.reset}`);

    if (failCount > 0) {
        process.exit(1);
    } else {
        process.exit(0);
    }
}

verifyTags();
