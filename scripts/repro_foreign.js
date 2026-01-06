const https = require('https');

function geocode(address, useTwLimit) {
    return new Promise((resolve, reject) => {
        let url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`;
        if (useTwLimit) {
            url += '&countrycodes=tw';
        }

        console.log(`Querying (${useTwLimit ? 'TW Only' : 'Global'}): ${address}`);
        const options = {
            headers: { 'User-Agent': 'TwoPiggyTest/1.0' }
        };

        https.get(url, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json && json.length > 0) {
                        console.log(`  -> FOUND: ${json[0].lat}, ${json[0].lon} (${json[0].display_name})`);
                        resolve(json[0]);
                    } else {
                        console.log('  -> Not found');
                        resolve(null);
                    }
                } catch (e) { resolve(null); }
            });
        });
    });
}

async function run() {
    // Example: A probable Japanese address
    const foreignAddr = '大阪府大阪市中央區道頓堀';

    console.log('--- Test 1: With TW Limit ---');
    await geocode(foreignAddr, true);

    console.log('\n--- Test 2: Global Search ---');
    await geocode(foreignAddr, false);
}

run();
