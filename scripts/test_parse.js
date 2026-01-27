const { parseArticleContent, fetchUrl } = require('./pixnet_sync');
const path = require('path');
const fs = require('fs');

async function test() {
    const url = 'https://lolwarden.pixnet.net/blog/posts/855315645961059971';
    let output = `Fetching ${url}...\n`;

    try {
        const html = await fetchUrl(url);
        output += `Fetched ${html.length} bytes.\n`;

        const result = parseArticleContent(html);
        output += '--- Category ---\n';
        output += result.category + '\n';
        output += '--- Content Preview (First 500 chars) ---\n';
        output += result.contentPreview.substring(0, 500) + '\n';
        output += '--- Address ---\n';
        output += result.address + '\n';

        // Debugging: dump surrounding html if match fails
        const startIdx = html.indexOf('article-content-inner');
        if (startIdx !== -1) {
            output += `DEBUG: Found 'article-content-inner' at ${startIdx}. Surrounding:\n`;
            output += html.substring(startIdx - 50, startIdx + 100) + '\n...\n';

            // Look for closing div or footer
            const footerIdx = html.indexOf('article-footer', startIdx);
            output += `DEBUG: Found 'article-footer' at ${footerIdx}.\n`;
        } else {
            output += `DEBUG: 'article-content-inner' NOT FOUND.\n`;
        }

        if (result.contentPreview.includes('class="article-content-inner"')) {
            output += 'FAIL: Content still contains wrapper div\n';
        } else if (result.contentPreview.length < 100) {
            output += 'FAIL: Content suspiciously short\n';
        } else {
            output += 'PASS: Content extraction seems matched\n';
        }

    } catch (e) {
        output += e.stack + '\n';
    }

    fs.writeFileSync('test_output.txt', output);
}

test();
