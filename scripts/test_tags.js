const { fetchUrl } = require('./pixnet_sync');
const path = require('path');
const fs = require('fs');

async function testTags() {
    const url = 'https://lolwarden.pixnet.net/blog';
    console.log(`Fetching ${url}...`);
    try {
        const html = await fetchUrl(url);
        console.log(`Fetched ${html.length} bytes.`);

        // Debug regex
        const postsMatch = html.match(/"posts":\s*\[([\s\S]*?)\],"blog"/);
        if (postsMatch) {
            console.log('Regex matched.');
            const postsJson = '[' + postsMatch[1] + ']';
            // Write JSON to file for inspection
            fs.writeFileSync('debug_posts.json', postsJson);

            try {
                const posts = JSON.parse(postsJson);
                console.log(`Parsed ${posts.length} posts.`);

                const targetId = '855315645961059971';
                const post = posts.find(p => String(p.id) === targetId);

                if (post) {
                    console.log(`Found target post: ${post.title}`);
                    console.log('Tags:', post.tags.map(t => t.name));
                } else {
                    console.log('Target post not found in JSON.');
                }

            } catch (e) {
                console.error('JSON parse error:', e.message);
            }
        } else {
            console.log('Regex did NOT match.');
        }

    } catch (e) {
        console.error(e);
    }
}

testTags();
