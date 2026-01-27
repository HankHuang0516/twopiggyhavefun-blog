const https = require('https');
const fs = require('fs');

const url = 'https://lolwarden.pixnet.net/blog/posts/852549836922664544';

https.get(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
}, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        fs.writeFileSync('debug_output.html', data);
        console.log('Downloaded debug_output.html');
    });
}).on('error', (e) => console.error(e));
