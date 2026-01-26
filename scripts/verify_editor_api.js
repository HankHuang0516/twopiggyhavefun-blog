// Native fetch in Node 24+


const API_BASE = 'http://localhost:3456';

async function test() {
    console.log('Testing GET /api/posts/20260104-example (mock slug)...');

    // First list posts to get a real slug
    try {
        const listRes = await fetch(`${API_BASE}/api/posts`);
        const posts = await listRes.json();
        if (posts.length === 0) {
            console.log('No posts to test.');
            return;
        }

        const slug = posts[0].filename.replace('.md', '');
        console.log(`Testing with slug: ${slug}`);

        const res = await fetch(`${API_BASE}/api/posts/${slug}`);
        if (!res.ok) {
            console.error(`Failed: ${res.status}`);
            const txt = await res.text();
            console.error(txt);
        } else {
            const data = await res.json();
            console.log('Success! Data keys:', Object.keys(data));
            console.log('Title:', data.title);
            console.log('Content length:', data.content ? data.content.length : 0);
            if (data.content && data.content.length > 0) {
                console.log('✅ Content retrieved successfully');
            } else {
                console.log('⚠️ Content empty?');
            }
        }

    } catch (e) {
        console.error('Error:', e);
    }
}

test();
