const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');

const postsDir = path.join(__dirname, 'src/content/posts');

async function repairImages() {
    const files = fs.readdirSync(postsDir).filter(f => f.endsWith('.md'));

    // Targeted slugs
    const targetSlugs = ['12227428963', '844792553451008760'];

    console.log(`Scanning ${files.length} posts. Targeting: ${targetSlugs.join(', ')}`);

    for (const file of files) {
        const slug = file.replace('.md', '');

        // Skip if not a target
        if (!targetSlugs.includes(slug)) continue;

        console.log(`\nProcessing ${slug}...`);
        const filePath = path.join(postsDir, file);
        let content = fs.readFileSync(filePath, 'utf-8');

        // Extract Original URL
        const urlMatch = content.match(/originalUrl: "(.*)"/);
        if (!urlMatch) {
            console.log('  No originalUrl found.');
            continue;
        }
        const originalUrl = urlMatch[1];
        console.log(`  Fetching: ${originalUrl}`);

        try {
            const { data } = await axios.get(originalUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });
            const $ = cheerio.load(data);

            // Collect remote images
            const remoteImages = [];
            $('.article-content-inner img').each((i, el) => {
                const src = $(el).attr('src');
                if (src && !src.includes('pixel') && !src.includes('clear.png')) {
                    remoteImages.push(src);
                }
            });

            console.log(`  Found ${remoteImages.length} remote images.`);

            // Replace logic
            // Local images format: /images/posts/{slug}/{index}.jpg
            const imgRegex = /src="(\/images\/posts\/[^"]+)"/g;
            let replacements = 0;

            content = content.replace(imgRegex, (match, localPath) => {
                const basename = path.basename(localPath); // "0.jpg"
                const index = parseInt(basename.replace('.jpg', ''), 10);

                if (!isNaN(index) && index < remoteImages.length) {
                    const remoteUrl = remoteImages[index];
                    console.log(`  [${index}] Replacing ${localPath} -> ${remoteUrl}`);
                    replacements++;
                    return `src="${remoteUrl}"`;
                } else {
                    console.log(`  [${index}] No remote image found (Out of bounds).`);
                    return match;
                }
            });

            if (replacements > 0) {
                fs.writeFileSync(filePath, content);
                console.log(`  Saved ${replacements} changes.`);
            } else {
                console.log('  No changes made.');
            }

        } catch (e) {
            console.error(`  Error: ${e.message}`);
        }
    }
}

repairImages();
