const fs = require('fs');
const path = require('path');
const https = require('https');

const postsDir = path.join(__dirname, '../src/content/posts');

async function checkMapData() {
    const files = fs.readdirSync(postsDir);
    let totalWithCoords = 0;
    let japanCount = 0;

    console.log('Checking map data integrity...');

    for (const file of files) {
        if (!file.endsWith('.md')) continue;
        const filePath = path.join(postsDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');

        const latMatch = content.match(/lat:\s*([0-9.]+)/);
        const lngMatch = content.match(/lng:\s*([0-9.]+)/);
        const titleMatch = content.match(/title:\s*['"]?(.*?)['"]?$/m);
        const title = titleMatch ? titleMatch[1] : 'Unknown';

        if (latMatch && lngMatch) {
            const lat = parseFloat(latMatch[1]);
            const lng = parseFloat(lngMatch[1]);
            totalWithCoords++;

            // Rough check for Japan bounds (Lat 30+, Lng 128+) vs Taiwan (Lat 21-26, Lng 119-122)
            if (lat > 30 || lng > 128) {
                console.warn(`[WARNING] Suspicious location (Japan?): ${title} (${lat}, ${lng}) - ${file}`);
                japanCount++;
            }
        }
    }

    console.log(`Total posts with coordinates: ${totalWithCoords}`);
    console.log(`Suspicious locations found: ${japanCount}`);
}

checkMapData();
