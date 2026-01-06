const https = require('https');

function geocode(address) {
    return new Promise((resolve, reject) => {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1&countrycodes=tw`;
        console.log(`Querying: ${address}`);
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
                        resolve({ lat: json[0].lat, lng: json[0].lon, display_name: json[0].display_name });
                    } else {
                        resolve(null);
                    }
                } catch (e) { resolve(null); }
            });
        });
    });
}

async function test() {
    // Failed: 台北市中山區林森北路119巷63號
    const full = '台北市中山區林森北路119巷63號';
    let res = await geocode(full);
    console.log(`Full address (${full}):`, res ? 'FOUND' : 'NOT FOUND');

    if (!res) {
        // Try removing 號 number
        // Strategy: Remove anything after last "巷", "路", "街", "段" + number?
        // Or simpler: remove number+號
        const shorter = full.replace(/\d+號.*/, '');
        console.log(`Trying: ${shorter}`);
        res = await geocode(shorter);
        console.log(`Result:`, res ? `FOUND (${res.lat}, ${res.lng})` : 'NOT FOUND');
    }

    // Another fail: 台北市松山區南京東路四段53巷3弄5號
    const full2 = '台北市松山區南京東路四段53巷3弄5號';
    // Logic: Remove last number+號
    const part2 = full2.replace(/\d+號.*/, '');
    // -> 台北市松山區南京東路四段53巷3弄
    let res2 = await geocode(part2);
    console.log(`\nAddress 2 fallback (${part2}):`, res2 ? 'FOUND' : 'NOT FOUND');

    // What if we remove "弄"?
    if (!res2) {
        const part3 = part2.replace(/\d+弄.*/, '');
        // -> 台北市松山區南京東路四段53巷
        console.log(`Address 2 fallback Level 2 (${part3}):`);
        let res3 = await geocode(part3);
        console.log('Result:', res3 ? 'FOUND' : 'NOT FOUND');
    }
}

test();
