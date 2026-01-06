const fs = require('fs');
const path = require('path');
const https = require('https');

const JSON_FILE = 'found_addresses.json';
const POSTS_DIR = 'src/content/posts';

// Helper: Sleep
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Helper: Clean Address
function cleanAddress(addr) {
    if (!addr) return '';
    return addr
        .replace(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}.*$/, '')
        .replace(/^\d{3,5}/g, '')
        .replace(/\(.*?\)/g, '')
        .replace(/（.*?）/g, '')
        .replace(/[，,、。.]+$/, '')
        .replace(/附近.*$/g, '')
        .replace(/旁邊.*$/g, '')
        .replace(/對面.*$/g, '')
        .replace(/\s+/g, '')
        .trim();
}

/**
 * Check if address is likely in Taiwan
 */
function isTaiwanAddress(address) {
    const twKeywords = [
        '台北', '新北', '桃園', '新竹', '苗栗', '台中', '彰化', '南投', '雲林', '嘉義',
        '台南', '高雄', '屏東', '宜蘭', '花蓮', '台東', '基隆', '澎湖', '金門', '連江',
        '台灣', 'Taiwan'
    ];
    return twKeywords.some(kw => address.includes(kw));
}

/**
 * Geocode with smart fallback and global support (V3)
 */
function geocode(address, level = 0) {
    return new Promise((resolve, reject) => {
        const isTw = isTaiwanAddress(address);

        let url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`;
        if (isTw) {
            url += '&countrycodes=tw';
        }

        const options = {
            headers: { 'User-Agent': 'TwoPiggyBlogHelper/3.0 (twopiggyhavefun@gmail.com)' }
        };

        const req = https.get(url, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', async () => {
                if (res.statusCode !== 200) { resolve(null); return; }
                try {
                    const json = JSON.parse(data);
                    if (json && json.length > 0) {
                        resolve({
                            lat: parseFloat(json[0].lat),
                            lng: parseFloat(json[0].lon),
                            foundAddress: address,
                            isTw: isTw
                        });
                    } else {
                        // Fallback Logic
                        if (level < 3) {
                            let nextAddress = address;
                            if (level === 0) {
                                // Remove 號
                                nextAddress = address.replace(/\d+[-~～之]?\d*號.*/, '');
                            } else if (level === 1) {
                                // Remove 弄
                                nextAddress = address.replace(/\d+弄.*/, '');
                            } else if (level === 2) {
                                // Remove 巷
                                nextAddress = address.replace(/\d+巷.*/, '');
                            }

                            if (nextAddress !== address && nextAddress.length > 3) {
                                // Only retry if still specific enough or if we are not in TW mode (foreign addresses might be short)
                                // But for foreign, we usually don't have "號弄巷". This is mostly for TW fallback.
                                console.log(`    -> Recursing level ${level + 1}: ${nextAddress}`);
                                await sleep(1000);
                                resolve(geocode(nextAddress, level + 1));
                                return;
                            }
                        }
                        resolve(null);
                    }
                } catch (e) { resolve(null); }
            });
        });

        req.on('error', (e) => resolve(null));
        req.setTimeout(10000, () => req.destroy());
    });
}

async function run() {
    if (!fs.existsSync(JSON_FILE)) {
        console.error(`${JSON_FILE} not found.`);
        return;
    }

    const items = JSON.parse(fs.readFileSync(JSON_FILE, 'utf-8'));
    console.log(`Loaded ${items.length} addresses.`);
    console.log('Starting V3 Hybrid Geocoding (Global + TW Aware)...');

    let updatedCount = 0;

    for (let i = 0; i < items.length; i++) {
        const { file, address } = items[i];
        const filePath = path.join(POSTS_DIR, file);

        if (!fs.existsSync(filePath)) continue;

        // Check if processed
        let content = fs.readFileSync(filePath, 'utf-8');
        if (content.match(/^lat:/m) && content.match(/^lng:/m)) {
            continue;
        }

        const cleanedAddr = cleanAddress(address);
        if (!cleanedAddr || cleanedAddr.length < 2) continue;

        console.log(`\n[${i + 1}/${items.length}] Processing: ${cleanedAddr} (${file})`);

        try {
            await sleep(1000);
            const coords = await geocode(cleanedAddr);

            if (coords) {
                console.log(`  -> Found: ${coords.lat}, ${coords.lng} [TW_Mode:${coords.isTw}]`);

                const injection = `lat: ${coords.lat}\nlng: ${coords.lng}\naddress: "${cleanedAddr}"\n`;
                if (content.match(/^category: .*/m)) {
                    content = content.replace(/^(category: .*)$/m, `$1\n${injection}`);
                } else {
                    const endMatch = content.indexOf('\n---', 4);
                    content = content.slice(0, endMatch) + '\n' + injection + content.slice(endMatch);
                }
                fs.writeFileSync(filePath, content, 'utf8');
                updatedCount++;
            } else {
                console.log('  -> Not Found.');
            }
        } catch (err) {
            console.error(`  -> Error: ${err.message}`);
        }
    }

    console.log(`\nJob Complete. Updated ${updatedCount} files.`);
}

run();
