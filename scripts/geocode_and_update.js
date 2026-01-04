const fs = require('fs');
const path = require('path');
const https = require('https');

const addressesFile = path.join(__dirname, '../audit_addresses.json');
const postsDir = path.join(__dirname, '../src/content/posts');
const failedFile = path.join(__dirname, '../audit_failed.json');

// Helper to sleep
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Clean address string for better geocoding
function cleanAddress(addr) {
    if (!addr) return '';
    return addr
        .replace(/^\d{3,5}/g, '')        // Remove postal codes at start
        .replace(/\(.*?\)/g, '')          // Remove parentheses content
        .replace(/（.*?）/g, '')            // Remove full-width parentheses
        .replace(/[，,、。.]+$/, '')        // Remove trailing punctuation
        .replace(/附近.*$/g, '')           // Remove "附近" and everything after
        .replace(/\s+/g, '')              // Remove all whitespace
        .trim();
}

// Helper to make request
function geocode(address) {
    return new Promise((resolve, reject) => {
        // Only use countrycodes=tw, avoid viewbox issues
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1&countrycodes=tw`;
        const options = {
            headers: {
                'User-Agent': 'TwoPiggyBlogHelper/1.1 (twopiggyhavefun@gmail.com)'
            }
        };

        https.get(url, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json && json.length > 0) {
                        resolve({
                            lat: parseFloat(json[0].lat),
                            lng: parseFloat(json[0].lon)
                        });
                    } else {
                        resolve(null);
                    }
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

async function run() {
    if (!fs.existsSync(addressesFile)) {
        console.error('audit_addresses.json not found!');
        return;
    }

    const tasks = JSON.parse(fs.readFileSync(addressesFile, 'utf-8'));
    console.log(`Loaded ${tasks.length} items to process.`);

    // Process all
    const batch = tasks;
    let successCount = 0;
    let failCount = 0;
    const failures = [];

    for (let i = 0; i < batch.length; i++) {
        const item = batch[i];
        const { file, address, title, source, directLat, directLng } = item;

        console.log(`[${i + 1}/${batch.length}] Processing: ${title} ${address} (${source})`);

        let coords = null;

        // If source is iframe, we already have coords
        if (source === 'iframe' && directLat && directLng) {
            console.log(`  -> Using direct coords: ${directLat}, ${directLng}`);
            coords = { lat: directLat, lng: directLng };
        }
        // Otherwise, geocode the address
        else if (address) {
            try {
                // Rate limit for Nominatim
                await sleep(1500);
                const cleaned = cleanAddress(address);
                console.log(`  -> Cleaned: ${cleaned}`);
                coords = await geocode(cleaned);
                if (coords) {
                    console.log(`  -> Found: ${coords.lat}, ${coords.lng}`);
                } else {
                    console.log('  -> Not found (Nominatim)');
                    failures.push({ file, title, address, reason: 'Nominatim not found' });
                    failCount++;
                    continue;
                }
            } catch (err) {
                console.error('  -> Error:', err.message);
                failures.push({ file, title, address, reason: 'Request error' });
                failCount++;
                continue;
            }
        }

        if (coords) {
            // Update file
            const filePath = path.join(postsDir, file);
            let content = fs.readFileSync(filePath, 'utf-8');

            // Add to frontmatter
            if (!content.includes('lat:') && !content.includes('lng:')) {
                // Ensure we insert it safely into frontmatter
                // Look for 'category: ...' or end of frontmatter
                if (content.match(/^category: .*/m)) {
                    content = content.replace(/^category: (.*)$/m, `category: $1\nlat: ${coords.lat}\nlng: ${coords.lng}`);
                } else {
                    // Fallback insertion before closing ---
                    content = content.replace(/^---$/m, `lat: ${coords.lat}\nlng: ${coords.lng}\n---`);
                }

                fs.writeFileSync(filePath, content);
                successCount++;
            } else {
                console.log('  -> Already has coordinates, skipping update.');
            }
        }
    }

    fs.writeFileSync(failedFile, JSON.stringify(failures, null, 2));
    console.log(`Done! Success: ${successCount}, Failed: ${failCount}. Failures saved to audit_failed.json`);
}

run();
