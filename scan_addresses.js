const fs = require('fs');
const path = require('path');

const POSTS_DIR = 'src/content/posts';

// Common patterns for address in generic blog posts (especially Pixnet migrations)
// We look for "Token:", then capture until newline or HTML tag start
const ADDRESS_PATTERNS = [
    /(?:地址|店址|地點|位置|Add|Address)[：:]\s*([^<>\n\r]+)/i,
    /Address[：:]\s*([^<>\n\r]+)/i,
    /Add[：:]\s*([^<>\n\r]+)/i,
];

function scanAddresses() {
    if (!fs.existsSync(POSTS_DIR)) {
        console.error(`Directory not found: ${POSTS_DIR}`);
        return;
    }

    const files = fs.readdirSync(POSTS_DIR).filter(f => f.endsWith('.md'));

    let stats = {
        total: files.length,
        found: 0,
        missing: 0,
        alreadyHas: 0
    };

    const results = [];

    files.forEach(file => {
        const filePath = path.join(POSTS_DIR, file);
        const content = fs.readFileSync(filePath, 'utf-8');

        const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
        if (!frontmatterMatch) {
            console.warn(`No frontmatter found in ${file}`);
            return;
        }

        const frontmatter = frontmatterMatch[1];

        // Check if address already exists in frontmatter
        if (frontmatter.match(/^address:/m)) {
            stats.alreadyHas++;
            return;
        }

        // Try to find address in content
        let foundAddress = null;
        let matchedPattern = null;

        // 1. Regex Match
        for (const pattern of ADDRESS_PATTERNS) {
            const match = content.match(pattern);
            if (match && match[1]) {
                let candidate = match[1].trim();
                // Basic cleanup
                candidate = candidate.replace(/&nbsp;/g, ' ');
                if (candidate.length > 2 && candidate.length < 100) {
                    foundAddress = candidate;
                    matchedPattern = pattern.toString();
                    break;
                }
            }
        }

        // 2. Google Maps Embed Fallback (if regex failed)
        // src="https://www.google.com/maps/embed?..."
        // This is harder to parse for a generic address, skipping for now to keep it fast.

        if (foundAddress) {
            stats.found++;
            results.push({
                file,
                address: foundAddress
            });
        } else {
            stats.missing++;
        }
    });

    console.log('--- Address Scan Report ---');
    console.log(`Total Posts: ${stats.total}`);
    console.log(`Already Has Address: ${stats.alreadyHas}`);
    console.log(`Found via Scan: ${stats.found}`);
    console.log(`Still Missing: ${stats.missing}`);
    console.log('---------------------------');

    if (results.length > 0) {
        console.log('\nPreview of found addresses (first 10):');
        results.slice(0, 10).forEach(r => {
            console.log(`[${r.file}] => ${r.address}`);
        });

        // Write to file for potential applying
        fs.writeFileSync('found_addresses.json', JSON.stringify(results, null, 2));
        console.log(`\nFull list saved to 'found_addresses.json'. You can review this and then apply it.`);
    }
}

scanAddresses();
