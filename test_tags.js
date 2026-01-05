const https = require('https');

https.get('https://lolwarden.pixnet.net/blog', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
}, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        const postsMatch = data.match(/"posts":\s*\[([\s\S]*?)\],"blog"/);
        if (postsMatch) {
            try {
                const posts = JSON.parse('[' + postsMatch[1] + ']');
                console.log('Posts count:', posts.length);
                console.log('\n=== First article ===');
                const p = posts[0];
                console.log('ID:', p.id);
                console.log('Title:', p.title);
                console.log('Tags type:', typeof p.tags, Array.isArray(p.tags));
                console.log('Tags:', JSON.stringify(p.tags, null, 2));
                console.log('Category:', p.category?.name);
            } catch (e) {
                console.error('Parse error:', e.message);
            }
        } else {
            console.log('No posts JSON found');
        }
    });
}).on('error', e => console.error('Error:', e.message));
