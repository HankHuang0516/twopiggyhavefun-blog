const axios = require('axios');

async function test(url) {
    console.log(`Scraping ${url}...`);
    try {
        const { data } = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });

        // Debug: Find where "標籤" or "Tags" appears
        const keywordIndex = data.indexOf('標籤');
        if (keywordIndex !== -1) {
            console.log('Found "標籤" at:', keywordIndex);
            console.log('Context:', data.substring(keywordIndex - 100, keywordIndex + 200).replace(/\n/g, ' '));
        } else {
            console.log('Keyword "標籤" not found in HTML.');
        }

        const categoryIndex = data.indexOf('分類');
        if (categoryIndex !== -1) {
            console.log('Found "分類" at:', categoryIndex);
            console.log('Context:', data.substring(categoryIndex - 100, categoryIndex + 200).replace(/\n/g, ' '));
        }

        // Check for specific class
        if (data.includes('article-keyword')) {
            console.log('Found class "article-keyword"');
        } else {
            console.log('Class "article-keyword" NOT found');
        }

    } catch (e) {
        console.error(e.message);
    }
}

test('https://lolwarden.pixnet.net/blog/posts/12177133849');
