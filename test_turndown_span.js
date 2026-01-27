const cheerio = require('cheerio');
const TurndownService = require('turndown');

const turndownService = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced'
});
turndownService.keep(['span', 'iframe']);

const html = `
<div id="article-content-inner">
    <p><strong>文章目錄</strong></p>
    <table>
        <tr><td>桃園南法玫瑰莊園｜在哪裡？怎麼去？</td></tr>
    </table>
    <h2>桃園南法玫瑰莊園｜在哪裡？怎麼去？</h2>
</div>
`;

function testTurndown(contentHtml) {
    const $clean = cheerio.load(contentHtml, { decodeEntities: false });

    const headers = $clean('h2, h3, strong').toArray();
    headers.forEach((header, index) => {
        const id = 'toc-' + index;
        const $header = $clean(header);
        if ($header.text().includes('文章目錄')) return;

        // Test with empty span
        $header.before(`<span id="${id}" class="toc-anchor"></span>`);
    });

    const modifiedHtml = $clean.html();
    console.log('--- Modified HTML ---');
    console.log(modifiedHtml);

    const markdown = turndownService.turndown(modifiedHtml);
    console.log('\n--- Resulting Markdown ---');
    console.log(markdown);
}

testTurndown(html);
