const fs = require('fs');
const path = require('path');
const https = require('https');

// Configuration
const POSTS_DIR = path.join(__dirname, '..', 'src', 'content', 'posts');
const MAX_ARTICLES = 30;

// Helper to fetch URL
function fetchUrl(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', (err) => reject(err));
    });
}

// Helper to parse frontmatter without external deps if possible, or assume format
function parseFrontmatter(content) {
    const match = content.match(/^---\s*([\s\S]*?)\s*---/);
    if (!match) return null;
    const fm = match[1];

    // Extract originalUrl - handle quotes
    const urlMatch = fm.match(/originalUrl:\s*(?:"|')?([^"'\s\n]+)(?:"|')?/);
    const originalUrl = urlMatch ? urlMatch[1] : null;

    // Extract tags
    let tags = [];

    // Try JSON-like array syntax first: tags: ["a", "b"]
    const jsonTagsMatch = fm.match(/tags:\s*\[(.*?)\]/s); // s flag for dotAll
    if (jsonTagsMatch) {
        // Simple CSV split for quoted strings
        // This is a naive parser but should work for this specific use case
        tags = jsonTagsMatch[1].split(',')
            .map(t => t.trim().replace(/^["']|["']$/g, ''))
            .filter(t => t);
    } else {
        // Try YAML list syntax
        const tagsMatch = fm.match(/tags:\s*([\s\S]*?)(?:\n[a-zA-Z]|$)/);
        if (tagsMatch) {
            const lines = tagsMatch[1].split('\n');
            for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed.startsWith('- ')) {
                    tags.push(trimmed.substring(2).trim());
                }
            }
        }
    }

    return { originalUrl, tags };
}

async function verifyTags() {
    console.log('Verifying tags for the last 30 articles...');

    // 1. Find markdown files
    const files = fs.readdirSync(POSTS_DIR)
        .filter(f => f.endsWith('.md'))
        .map(f => ({
            name: f,
            path: path.join(POSTS_DIR, f),
            mtime: fs.statSync(path.join(POSTS_DIR, f)).mtime
        }))
        .sort((a, b) => b.mtime - a.mtime) // Sort by newest first
        .slice(0, MAX_ARTICLES);

    console.log(`Checking ${files.length} files...`);

    let failureCount = 0;

    for (const file of files) {
        const content = fs.readFileSync(file.path, 'utf8');
        const meta = parseFrontmatter(content);

        if (!meta || !meta.originalUrl) {
            console.log(`Skipping ${file.name}: No originalUrl found.`);
            continue;
        }

        if (!meta.originalUrl.includes('pixnet.net')) {
            // Not a pixnet article
            continue;
        }

        try {
            // console.log(`Fetching ${meta.originalUrl}...`);
            const html = await fetchUrl(meta.originalUrl);

            // Extract tags from Pixnet (from data-tag attributes)
            let remoteTags = [];
            const tagMatches = html.matchAll(/data-tag="([^"]+)"/g);
            for (const match of tagMatches) {
                if (!remoteTags.includes(match[1])) {
                    remoteTags.push(match[1]);
                }
            }

            // Compare
            const systemTags = ['pixnet-sync', 'auto-imported', 'pixnet', 'unread'];
            const localContentTags = meta.tags.filter(t => !systemTags.includes(t));
            const localSet = new Set(localContentTags);

            // Only check if Pixnet tags are present in local
            // Extra local tags are allowed (they're manual SEO tags)
            const missingInLocal = remoteTags.filter(t => !localSet.has(t));

            if (remoteTags.length === 0) {
                // Pixnet has no tags - local SEO tags are OK
                console.log(`[PASS] ${file.name} (Pixnet無標籤, 本地有${localContentTags.length}個SEO標籤)`);
            } else if (missingInLocal.length > 0) {
                // Pixnet has tags but local is missing some
                console.log(`[FAIL] ${file.name}`);
                console.log(`  Source: ${meta.originalUrl}`);
                console.log(`  Missing in local: ${missingInLocal.join(', ')}`);
                failureCount++;
            } else {
                console.log(`[PASS] ${file.name}`);
            }

            // Rate limit
            await new Promise(r => setTimeout(r, 500));

        } catch (e) {
            console.error(`[ERROR] processing ${file.name}: ${e.message}`);
        }
    }

    if (failureCount > 0) {
        console.error(`\nverification failed: ${failureCount} articles have mismatched tags.`);
        // Don't exit with error code yet, just report
        // process.exit(1); 
    } else {
        console.log('\nAll checked articles match source tags!');
    }
}

verifyTags();
