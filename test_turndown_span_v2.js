const cheerio = require('cheerio');
const TurndownService = require('turndown');

const turndownService = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced'
});
turndownService.keep(['span', 'iframe']);

const html = `
<div id="article-content-inner">
    <h2>桃園南法玫瑰莊園｜在哪裡？怎麼去？</h2>
</div>
`;

function testTurndown(contentHtml) {
    const $clean = cheerio.load(contentHtml, { decodeEntities: false });

    const headers = $clean('h2').toArray();
    headers.forEach((header, index) => {
        const id = 'toc-' + index;
        const $header = $clean(header);

        // Test with non-empty span
        $header.before(`<span id="${id}" class="toc-anchor">&#x200B;</span>`);
    });

    const modifiedHtml = $clean.html();
    console.log('--- Modified HTML ---');
    console.log(modifiedHtml);

    const markdown = turndownService.turndown(modifiedHtml);
    console.log('\n--- Resulting Markdown ---');
    console.log(markdown);
}

testTurndown(html);
