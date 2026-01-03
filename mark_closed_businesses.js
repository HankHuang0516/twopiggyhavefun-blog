const fs = require('fs');
const path = require('path');

const BUSINESS_STATUS_FILE = 'C:/Users/z004rx2h/.gemini/antigravity/brain/b623c93d-fd04-4b4c-ad62-5be35b7b78e6/business_status.md';
const BUSINESS_LIST_FILE = 'business_list.json';
const POSTS_DIR = 'src/content/posts';

// Helper to parse the MD table (very basic)
function getClosedBusinesses() {
    const content = fs.readFileSync(BUSINESS_STATUS_FILE, 'utf-8');
    const lines = content.split('\n');
    const closedList = [];

    console.log(`Read ${lines.length} lines.`);

    for (const line of lines) {
        // Skip empty lines or non-table lines efficiently
        if (!line.trim().startsWith('|')) continue;

        // Skip header or separator
        if (line.includes('店家名稱') || line.includes('---')) continue;

        const parts = line.split('|').map(p => p.trim());
        // parts[0] is empty (because line starts with |), [1] is name, [2] is status
        // parts[0] is empty, [1] is name, [2] is status, [3] is note
        if (parts.length < 4) continue;

        const name = parts[1].replace(/\*\*/g, '').trim();
        const status = parts[2].replace(/\*\*/g, '').trim();

        console.log(`Checking: ${name} / Status: ${status}`);

        if (status.includes('歇業') || status.includes('停業') || status.includes('已關閉')) {
            closedList.push({ name, status, note: parts[3] });
        }
    }
    return closedList;
}

function processFiles() {
    const closedBusinesses = getClosedBusinesses();
    const businessList = JSON.parse(fs.readFileSync(BUSINESS_LIST_FILE, 'utf-8'));

    console.log('Found closed businesses:', closedBusinesses.map(b => b.name));

    for (const biz of closedBusinesses) {
        // Find which file contains this business.
        // The business_list.json maps file -> list of names, but our status report uses a specific name.
        // We simplified the status report to use the name from the checklist. 
        // But we need to map back to the file.
        // Actually, the user wants "precision", but our list in business_status.md has simplified names.
        // Let's try to find partial matches in business_list.json or just scan files for the name.

        // Strategy: 
        // 1. Identify keywords from the closed business name (e.g., "点心道").
        // 2. Find files in business_list.json that match this name.

        const keyword = biz.name.split(' ')[0].split('(')[0]; // "点心道"

        const targets = businessList.filter(item => {
            // item.name is what we extracted originally. 
            // biz.name is what we wrote in the MD file.
            return biz.name.includes(item.name) || item.title.includes(keyword) || item.name.includes(keyword);
        });

        for (const target of targets) {
            const filePath = path.join(POSTS_DIR, target.file);
            if (!fs.existsSync(filePath)) continue;

            let content = fs.readFileSync(filePath, 'utf-8');

            // Check if already marked
            if (content.includes('warn-closed')) {
                console.log(`[Skip] Already marked: ${target.file}`);
                continue;
            }

            const warningBlock = `
<div class="warn-closed p-4 bg-red-100 border-l-4 border-red-500 text-red-700 mb-4 rounded shadow-md">
    <p class="font-bold flex items-center">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        注意：店家已歇業 / Note: This business is permanently closed.
    </p>
    <p>文章中提及的 <strong>${biz.name}</strong> 經確認已停止營業，請勿前往。</p>
</div>
`;
            // Insert after frontmatter (--- ... ---)
            const parts = content.split('---');
            if (parts.length >= 3) {
                // parts[0] is empty, parts[1] is frontmatter, parts[2...] is content
                // We want to insert at the beginning of content
                const frontmatter = parts[1];
                const cleanContent = parts.slice(2).join('---');

                const newContent = `---${frontmatter}---\n${warningBlock}${cleanContent}`;
                fs.writeFileSync(filePath, newContent, 'utf-8');
                console.log(`[Marked] Added warning to ${target.file} for ${biz.name}`);
            }
        }
    }
}

processFiles();
