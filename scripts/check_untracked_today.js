const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const postsDir = path.join(__dirname, '..', 'src', 'content', 'posts');

try {
    const files = fs.readdirSync(postsDir);
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    console.log(`Checking files in ${postsDir} for date ${todayStr}`);

    const untrackedFiles = [];
    const trackedFiles = new Set(execSync('git ls-files src/content/posts', { encoding: 'utf8' }).split('\n'));

    files.forEach(file => {
        if (!file.endsWith('.md')) return;

        const filePath = path.join(postsDir, file);
        const stats = fs.statSync(filePath);
        const mtime = stats.mtime.toISOString().split('T')[0];

        // List all untracked files
        const relPath = `src/content/posts/${file}`;
        if (!trackedFiles.has(relPath)) {
            untrackedFiles.push({ file, mtime });
        }
    });

    console.log('All Untracked files:');
    if (untrackedFiles.length === 0) {
        console.log('(None)');
    } else {
        untrackedFiles.forEach(f => console.log(`${f.file} (${f.mtime})`));
    }

} catch (e) {
    console.error('Error:', e);
}
