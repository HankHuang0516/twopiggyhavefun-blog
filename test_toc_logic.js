const cheerio = require('cheerio');
const fs = require('fs');

const html = `
<div id="article-content-inner">
    <p><strong>文章目錄</strong></p>
    <table>
        <tr><td>桃園南法玫瑰莊園｜在哪裡？怎麼去？</td></tr>
        <tr><td>桃園南法玫瑰莊園｜花園景觀</td></tr>
    </table>
    <h2>桃園南法玫瑰莊園｜在哪裡？怎麼去？</h2>
    <p>內容內容</p>
    <h2>桃園南法玫瑰莊園｜花園景觀</h2>
    <p>內容內容</p>
</div>
`;

function debugTOC(contentHtml) {
    const $clean = cheerio.load(contentHtml, { decodeEntities: false });

    let tocFound = false;
    $clean('strong, b, p').each((i, el) => {
        if (tocFound) return;
        if ($clean(el).text().includes('文章目錄')) {
            const headers = $clean('h2, h3, strong').toArray();
            console.log(`Found ${headers.length} headers`);

            headers.forEach((header, index) => {
                const $header = $clean(header);
                const text = $header.text().trim();
                if (text.length > 2 && text !== '文章目錄' && !text.includes('文章目錄')) {
                    const id = 'toc-' + index;
                    console.log(`Processing header ${index}: "${text}"`);

                    if (!$header.attr('id') && $header.prev('span.toc-anchor').length === 0) {
                        console.log(`  Adding anchor ${id} to "${text}"`);
                        $header.before(`<span id="${id}" class="toc-anchor"></span>`);

                        $clean('td').each((j, td) => {
                            const $td = $clean(td);
                            if ($td.text().trim() === text) {
                                console.log(`  Linking td to #${id}`);
                                $td.html(`<a href="#${id}">${$td.html()}</a>`);
                            }
                        });
                    } else {
                        console.log(`  Skipping anchor for "${text}" (ID: ${$header.attr('id')}, PrevSpan: ${$header.prev('span.toc-anchor').length})`);
                    }
                }
            });
            tocFound = true;
        }
    });

    console.log('\n--- Resulting HTML ---');
    console.log($clean.html());
}

debugTOC(html);
