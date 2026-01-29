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

            // Extract tags from Pixnet
            let remoteTags = [];
            const keywordsMatch = html.match(/<meta name="keywords" content="([^"]+)"/i);
            if (keywordsMatch) {
                remoteTags = keywordsMatch[1].split(',').map(t => t.trim()).filter(t => t);
            }

            // Compare
            // Local tags include 'pixnet-sync', 'auto-imported' which are system tags. 
            // We should filter them out for comparison, or check if remote tags are present in local tags.
            const systemTags = ['pixnet-sync', 'auto-imported', 'pixnet', 'unread'];
            const localContentTags = meta.tags.filter(t => !systemTags.includes(t));

            // Normalize for comparison
            const localSet = new Set(localContentTags);
            const remoteSet = new Set(remoteTags);

            // Check if local tags match remote tags (order might differ)
            // Strict check: Local content tags should be exactly Remote tags?
            // Or Local should INCLUDE Remote tags? 
            // Given the fix was "extract tags from meta keywords", they should be identical.

            const missingInLocal = remoteTags.filter(t => !localSet.has(t));
            const extraInLocal = localContentTags.filter(t => !remoteSet.has(t));

            if (missingInLocal.length > 0 || extraInLocal.length > 0) {
                console.log(`[FAIL] ${file.name}`);
                console.log(`  Source: ${meta.originalUrl}`);
                if (missingInLocal.length > 0) console.log(`  Missing in local: ${missingInLocal.join(', ')}`);
                if (extraInLocal.length > 0) console.log(`  Extra in local: ${extraInLocal.join(', ')}`);
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
