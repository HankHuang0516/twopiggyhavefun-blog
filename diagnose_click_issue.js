#!/usr/bin/env node
/**
 * 診斷文章頁面點擊空白區域觸發超連結的問題
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 診斷文章頁面點擊問題...\n');

// 檢查可能的問題源
const issuesFound = [];

// 1. 檢查 PostCard.astro 是否還有覆蓋層
console.log('1️⃣ 檢查 PostCard.astro...');
const postCardContent = fs.readFileSync('src/components/PostCard.astro', 'utf-8');
if (postCardContent.includes('absolute inset-0')) {
    issuesFound.push('❌ PostCard 仍包含全卡片覆蓋層 (absolute inset-0)');
} else {
    console.log('   ✅ PostCard 無全卡片覆蓋層');
}

// 2. 檢查文章頁面是否有可疑的 fixed/absolute 元素
console.log('\n2️⃣ 檢查文章頁面 ([...slug].astro)...');
const articlePageContent = fs.readFileSync('src/pages/posts/[...slug].astro', 'utf-8');

// 檢查 fixed 元素
const fixedElements = articlePageContent.match(/class="[^"]*fixed[^"]*"/g) || [];
console.log(`   找到 ${fixedElements.length} 個 fixed 定位元素:`);
fixedElements.forEach(el => console.log(`   - ${el}`));

// 檢查 absolute 元素
const absoluteElements = articlePageContent.match(/class="[^"]*absolute[^"]*"/g) || [];
console.log(`   找到 ${absoluteElements.length} 個 absolute 定位元素:`);
absoluteElements.forEach(el => console.log(`   - ${el}`));

// 3. 檢查是否有未關閉的 <a> 標籤
console.log('\n3️⃣ 檢查未關閉的 <a> 標籤...');
const openATags = (articlePageContent.match(/<a\s/g) || []).length;
const closeATags = (articlePageContent.match(/<\/a>/g) || []).length;
console.log(`   開啟的 <a> 標籤: ${openATags}`);
console.log(`   關閉的 </a> 標籤: ${closeATags}`);
if (openATags !== closeATags) {
    issuesFound.push(`❌ <a> 標籤不匹配！開啟: ${openATags}, 關閉: ${closeATags}`);
} else {
    console.log('   ✅ <a> 標籤數量匹配');
}

// 4. 檢查 Layout.astro 中的潛在問題
console.log('\n4️⃣ 檢查 Layout.astro...');
const layoutContent = fs.readFileSync('src/layouts/Layout.astro', 'utf-8');

// 檢查是否有大範圍的點擊事件監聽
if (layoutContent.includes('document.addEventListener') || layoutContent.includes('body.addEventListener')) {
    console.log('   ⚠️  發現文檔級別的事件監聽器');
    const eventListeners = layoutContent.match(/(?:document|body)\.addEventListener\([^)]+\)/g) || [];
    eventListeners.forEach(listener => console.log(`   - ${listener}`));
}

// 檢查是否有 pointer-events: none/all 的 CSS
if (layoutContent.includes('pointer-events')) {
    console.log('   ⚠️  發現 pointer-events CSS 屬性');
}

// 5. 分析潛在的覆蓋層
console.log('\n5️⃣ 分析可能的覆蓋層問題...');
const potentialOverlays = [
    { file: 'posts/[...slug].astro', pattern: /class="[^"]*fixed[^"]*bottom-0[^"]*left-0[^"]*right-0/g },
    { file: 'posts/[...slug].astro', pattern: /class="[^"]*fixed[^"]*inset-0/g },
    { file: 'Layout.astro', pattern: /class="[^"]*fixed[^"]*inset-0/g }
];

potentialOverlays.forEach(({ file, pattern }) => {
    const content = file.includes('slug') ? articlePageContent : layoutContent;
    const matches = content.match(pattern) || [];
    if (matches.length > 0) {
        console.log(`   ⚠️  在 ${file} 發現潛在覆蓋層: ${matches.length} 個`);
        matches.forEach(m => console.log(`      ${m}`));
    }
});

// 6. 檢查行243-264的導航連結
console.log('\n6️⃣ 檢查上一篇/下一篇導航連結...');
const navLinks = articlePageContent.substring(
    articlePageContent.indexOf('<!-- Next/Prev Custom Navigation -->'),
    articlePageContent.indexOf('<!-- Related Posts')
);
if (navLinks.includes('h-full') || navLinks.includes('flex-col')) {
    console.log('   ⚠️  導航連結使用 h-full/flex-col，可能影響佈局');
}

// 總結
console.log('\n' + '='.repeat(60));
console.log('📊 診斷摘要:');
console.log('='.repeat(60));

if (issuesFound.length === 0) {
    console.log('✅ 未發現明顯的代碼問題');
    console.log('\n💡 建議:');
    console.log('   1. 在瀏覽器中使用開發者工具 (F12) 檢查');
    console.log('   2. 點擊空白處時，在 Elements 面板查看是哪個元素被點擊');
    console.log('   3. 檢查該元素的 computed styles 和 z-index');
    console.log('   4. 查看 Event Listeners 面板確認事件綁定');
} else {
    console.log('⚠️  發現以下問題:');
    issuesFound.forEach(issue => console.log(`   ${issue}`));
}

console.log('\n🌐 線上測試步驟:');
console.log('   1. 訪問: https://twopiggyhavefun.uk/');
console.log('   2. 點擊任一文章進入文章頁');
console.log('   3. 按 F12 打開開發者工具');
console.log('   4. 在文章內容區域點擊空白處');
console.log('   5. 在 Elements 面板查看被點擊的元素');
console.log('   6. 檢查該元素是否為 <a> 標籤或其子元素');
