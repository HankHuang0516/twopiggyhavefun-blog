
const fs = require('fs');
const path = require('path');

const POSTS_DIR = path.join(__dirname, 'src/content/posts');

// List of files to force close (e.g. found via search)
const FORCE_CLOSE_FILES = [
    '12086408307.md', // Honey Pig
    '12088665150.md', // Tiger Topoki
    '12142269550.md'  // So Free Pizza
];

function fixClosedStores() {
    if (!fs.existsSync(POSTS_DIR)) {
        console.error("Posts dir not found!");
        return;
    }

    const files = fs.readdirSync(POSTS_DIR).filter(f => f.endsWith('.md'));
    let updatedCount = 0;

    for (const file of files) {
        const filePath = path.join(POSTS_DIR, file);
        let content = fs.readFileSync(filePath, 'utf8');

        const hasClosedInTitle = content.match(/title:.*\((已歇業|已結束|停業)\)/);
        const isForceClose = FORCE_CLOSE_FILES.includes(file);

        if (hasClosedInTitle || isForceClose) {
            // Check if already marked
            if (!content.includes('isPermanentlyClosed: true')) {
                // Check if isPermanentlyClosed exists
                if (content.match(/isPermanentlyClosed:/)) {
                    content = content.replace(/isPermanentlyClosed:\s*.*(\r?\n)/, 'isPermanentlyClosed: true$1');
                } else {
                    // Add it after businessHours or title
                    if (content.match(/businessHours:/)) {
                        content = content.replace(/(businessHours:.*$)/m, '$1\nisPermanentlyClosed: true');
                    } else {
                        content = content.replace(/(title:.*$)/m, '$1\nisPermanentlyClosed: true');
                    }
                }

                fs.writeFileSync(filePath, content, 'utf8');
                console.log(`Updated ${file} to Permanently Closed.`);
                updatedCount++;
            }
        }
    }

    console.log(`Total files updated: ${updatedCount}`);
}

fixClosedStores();
