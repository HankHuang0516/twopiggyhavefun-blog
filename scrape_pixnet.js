const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');

const INPUT_DB = 'pixnet_articles_db.json';
const OUTPUT_DIR = 'src/content/posts';
const IMAGE_DIR = 'public/images/posts';

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
if (!fs.existsSync(IMAGE_DIR)) fs.mkdirSync(IMAGE_DIR, { recursive: true });

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function downloadImage(url, filepath) {
    if (fs.existsSync(filepath)) return; // Skip if exists
    try {
        const response = await axios({
            url,
            method: 'GET',
            responseType: 'stream',
            timeout: 10000
        });
        return new Promise((resolve, reject) => {
            const writer = fs.createWriteStream(filepath);
            response.data.pipe(writer);
            writer.on('finish', resolve);
            writer.on('error', reject);
        });
    } catch (e) {
        console.error(`  [Image Error] ${url}: ${e.message}`);
        // Create a dummy file or just ignore? Best to ignore but log.
        // Return null to allow script to continue.
        return null;
    }
}

async function scrapeArticle(article, index) {
    const { articleUrl } = article;
    const postId = articleUrl.split('/').pop().split('-')[0] || `post-${index}`;
    const mdPath = path.join(OUTPUT_DIR, `${postId}.md`);

    // Check if MD exists (optional: skip?)
    // if (fs.existsSync(mdPath)) { console.log(`[${index}] Skipping ${postId} (exists)`); return; }

    console.log(`[${index}] Scraping ${postId} (${articleUrl})...`);

    try {
        const { data } = await axios.get(articleUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Referer': 'https://www.pixnet.net/'
            },
            timeout: 15000
        });
        const $ = cheerio.load(data);

        const title = $('.title h2 a').text().trim() || $('h2').first().text().trim() || 'Untitled';
        const dateStr = $('.publish-date').text().trim() || $('.article-date').text().trim() || new Date().toISOString();
        let date = new Date(dateStr);
        if (isNaN(date.getTime())) date = new Date();

        const contentContainer = $('#article-content-inner');
        if (!contentContainer.length) {
            console.warn(`  [Warn] No content found for ${postId}`);
            return;
        }

        const localImageDir = path.join(IMAGE_DIR, postId);
        if (!fs.existsSync(localImageDir)) fs.mkdirSync(localImageDir, { recursive: true });

        const coverImage = contentContainer.find('img').first().attr('src');
        let localCoverVal = '';

        const imgs = contentContainer.find('img').toArray();
        for (let i = 0; i < imgs.length; i++) {
            const el = imgs[i];
            const src = $(el).attr('src');
            if (src) {
                let cleanSrc = src.startsWith('//') ? 'https:' + src : src;
                if (!cleanSrc.startsWith('http')) continue;

                // Sanitize filename
                const ext = path.extname(cleanSrc.split('?')[0]) || '.jpg';
                const filename = `${i}${ext}`;
                const localPath = path.join(localImageDir, filename);
                const publicPath = `/images/posts/${postId}/${filename}`;

                // Download sequentially
                await downloadImage(cleanSrc, localPath);

                // Update src
                $(el).attr('src', publicPath);

                // Remove lazy loading attrs if any
                $(el).removeAttr('loading');

                if (src === coverImage) localCoverVal = publicPath;

                // Small delay between images to be nice
                await sleep(200);
            }
        }

        const htmlContent = contentContainer.html();

        const mdContent = `---
title: "${title.replace(/"/g, '\\"').replace(/\n/g, ' ')}"
date: "${date.toISOString()}"
cover: "${localCoverVal}"
tags: ["pixnet"]
originalUrl: "${articleUrl}"
---

<div class="pixnet-article prose max-w-none">
${htmlContent}
</div>
`;

        fs.writeFileSync(mdPath, mdContent);
        console.log(`  Saved ${postId}.md`);

    } catch (e) {
        console.error(`  [Error] Failed to scrape ${articleUrl}: ${e.message}`);
    }
}

async function main() {
    const rawData = fs.readFileSync(INPUT_DB);
    const db = JSON.parse(rawData);

    let articles = [];
    db.forEach(page => { if (page.articles) articles = articles.concat(page.articles); });

    console.log(`Found ${articles.length} articles.`);

    for (let i = 0; i < articles.length; i++) {
        await scrapeArticle(articles[i], i);
        // Generous delay between articles
        await sleep(3000);
    }
}

main();
