const TurndownService = require('turndown');
const turndownService = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced'
});

const html1 = '<h2 id="test">Header</h2>';
const html2 = '<a id="test"></a><h2>Header</h2>';
const html3 = '<div id="test"></div><h2>Header</h2>';

console.log('--- 1. Header with ID ---');
console.log(turndownService.turndown(html1));

console.log('--- 2. Anchor with ID ---');
console.log(turndownService.turndown(html2));

console.log('--- 3. Div with ID ---');
console.log(turndownService.turndown(html3));
