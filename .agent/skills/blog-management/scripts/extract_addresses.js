const fs = require('fs');
const path = require('path');

const postsDir = path.join(__dirname, '../src/content/posts');
const outputFile = path.join(__dirname, '../audit_addresses.json');

// Regex patterns to find addresses
const addressLabelPatterns = [
    /地址[:：]\s*(.*?)(?:<|\r?\n)/i,
    /店址[:：]\s*(.*?)(?:<|\r?\n)/i,
    /位置[:：]\s*(.*?)(?:<|\r?\n)/i,
    /地點[:：]\s*(.*?)(?:<|\r?\n)/i
];

// Regex for raw taiwan addresses (capture County/City + District + Road/St)
// e.g. 台南市下營區營前村文明街45巷26號
const rawAddressPattern = /([\u4e00-\u9fa5]+[縣市][\u4e00-\u9fa5]+[鄉鎮市區][\u4e00-\u9fa5]+[路街][\u4e00-\u9fa50-9\-\s號]+)/;

// Regex for Iframe coordinates
// e.g. http://my.ctrlq.org/maps/#street|1.66...|25.044773|121.538638...
const iframeCoordPattern = /maps\/#.*?\|(\d+\.\d+)\|(\d+\.\d+)/;

function extractAddresses() {
    const files = fs.readdirSync(postsDir);
    const results = [];
    let count = 0;
    let iframeCount = 0;

    console.log(`Scanning ${files.length} files...`);

    files.forEach(file => {
        if (!file.endsWith('.md')) return;

        const filePath = path.join(postsDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');

        // Extract frontmatter
        const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
        if (!frontmatterMatch) return;

        const frontmatter = frontmatterMatch[1];
        const titleMatch = frontmatter.match(/title:\s*['"]?(.*?)['"]?$/m);
        const title = titleMatch ? titleMatch[1] : 'Unknown Title';

        // Skip if already has lat/lng
        if (frontmatter.includes('lat:') && frontmatter.includes('lng:')) {
            return;
        }

        // 1. Try to find coordinates in Iframe
        const iframeMatch = content.match(iframeCoordPattern);
        if (iframeMatch) {
            results.push({
                file: file,
                title: title,
                directLat: parseFloat(iframeMatch[1]),
                directLng: parseFloat(iframeMatch[2]),
                source: 'iframe'
            });
            iframeCount++;
            count++;
            return; // Found coords, done for this file
        }

        // 2. Search for address with Label
        let address = null;
        for (const pattern of addressLabelPatterns) {
            const match = content.match(pattern);
            if (match && match[1]) {
                let cleanAddr = match[1].trim()
                    .replace(/&nbsp;/g, '')
                    .replace(/<.*?>/g, '');

                if (cleanAddr.length > 5 && (cleanAddr.includes('市') || cleanAddr.includes('縣'))) {
                    address = cleanAddr;
                    break;
                }
            }
        }

        // 3. Fallback: Search for raw address pattern
        if (!address) {
            const rawMatch = content.match(rawAddressPattern);
            if (rawMatch && rawMatch[1]) {
                // Double check length to avoid short fragments
                if (rawMatch[1].length > 8) {
                    address = rawMatch[1].trim();
                }
            }
        }

        if (address) {
            results.push({
                file: file,
                title: title,
                address: address,
                source: 'text'
            });
            count++;
        }
    });

    fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
    console.log(`Found ${count} items (Direct Coords: ${iframeCount}). Saved to ${outputFile}`);
}

extractAddresses();
