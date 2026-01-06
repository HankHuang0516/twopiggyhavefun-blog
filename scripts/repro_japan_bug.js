const https = require('https');

function cleanAddress(addr) {
    if (!addr) return '';
    return addr
        .replace(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}.*$/, '')
        .replace(/^\d{3,5}/g, '')
        .replace(/\(.*?\)/g, '')
        .replace(/（.*?）/g, '')
        .replace(/[，,、。.]+$/, '')
        .replace(/附近.*$/g, '')
        .replace(/\s+/g, '')
        .trim();
}

function geocode(address) {
    return new Promise((resolve, reject) => {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1&countrycodes=tw&addressdetails=1`;
        console.log(`Querying: ${url}`);
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
                        console.log(`COORDS:${json[0].lat},${json[0].lon}`);
                        resolve(json[0]);
                    } else {
                        console.log('Not found');
                        resolve(null);
                    }
                } catch (e) { resolve(null); }
            });
        });
    });
}

async function run() {
    const rawAddress = '台南市玉井區望明里附近';
    const cleaned = cleanAddress(rawAddress);
    console.log(`Cleaned address: ${cleaned}`);

    await geocode(cleaned);
}

run();
