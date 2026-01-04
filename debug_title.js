const fs = require('fs');
const path = require('path');

const FILE = 'src/content/posts/12087470730.md';

function categorizePost(title, content, existingTags = []) {
    const text = title + ' ' + (content || '').substring(0, 3000);

    // Fix Generic Titles
    let newTitle = title;
    // Log what we compare
    console.log(`Checking title check: '${title.trim()}' === '兩隻小豬' ? ${title.trim() === '兩隻小豬'}`);

    if (title.trim() === '兩隻小豬' || title.trim() === 'Uncategorized') {
        const plainText = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        if (plainText.length > 0) {
            let extracted = plainText.substring(0, 50);
            if (plainText.length > 50) extracted += '...';
            newTitle = extracted;
            console.log(`Extracted new title: ${newTitle}`);
        } else {
            console.log('Plain text length 0');
        }
    }
    return { newTitle };
}

function main() {
    let content = fs.readFileSync(FILE, 'utf-8');
    const titleMatch = content.match(/title:\s*["']?(.+?)["']?\s*\n/);
    const title = titleMatch ? titleMatch[1] : '';

    console.log(`Original Title from regex: '${title}'`);

    const result = categorizePost(title, content);
    console.log(`Result New Title: '${result.newTitle}'`);
}

main();
