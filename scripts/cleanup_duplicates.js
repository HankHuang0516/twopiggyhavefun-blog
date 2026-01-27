const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

const postsDir = path.join(__dirname, '..', 'src', 'content', 'posts');

function cleanupDuplicates() {
    console.log('Scanning for duplicates in:', postsDir);

    if (!fs.existsSync(postsDir)) {
        console.log('Posts directory not found.');
        return;
    }

    const files = fs.readdirSync(postsDir).filter(f => f.endsWith('.md'));
    const urlMap = new Map(); // originalUrl -> [{ file, mtime }]

    files.forEach(file => {
        const filePath = path.join(postsDir, file);
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const parsed = matter(content);

            if (parsed.data.originalUrl) {
                const url = parsed.data.originalUrl;
                if (!urlMap.has(url)) {
                    urlMap.set(url, []);
                }
                urlMap.get(url).push({
                    file,
                    path: filePath,
                    mtime: fs.statSync(filePath).mtime
                });
            }
        } catch (e) {
            console.error(`Error reading ${file}:`, e.message);
        }
    });

    let removedCount = 0;

    urlMap.forEach((entries, url) => {
        if (entries.length > 1) {
            console.log(`\nFound duplicates for URL: ${url}`);

            // Sort: Prefer files starting with 'pixnet-' then '2026', then by mtime desc
            entries.sort((a, b) => {
                const aIsPixnet = a.file.startsWith('pixnet-');
                const bIsPixnet = b.file.startsWith('pixnet-');
                if (aIsPixnet && !bIsPixnet) return -1; // Keep a
                if (!aIsPixnet && bIsPixnet) return 1;  // Keep b
                return b.mtime - a.mtime; // Keep newest
            });

            // Keep the first one, delete the rest
            const keep = entries[0];
            const remove = entries.slice(1);

            console.log(`  Keeping: ${keep.file}`);
            remove.forEach(entry => {
                console.log(`  Removing: ${entry.file}`);
                fs.unlinkSync(entry.path);
                removedCount++;
            });
        }
    });

    console.log(`\nCleanup complete. Removed ${removedCount} duplicate files.`);
}

cleanupDuplicates();
