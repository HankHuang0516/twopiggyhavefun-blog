const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/pages/editor.astro');
const content = fs.readFileSync(filePath, 'utf8');

// Simple regex to find CSS blocks (not perfect but sufficient for this specific file structure)
// Looking for .sidebar { ... }
const sidebarMatch = content.match(/\.sidebar\s*\{([^}]+)\}/);

if (!sidebarMatch) {
    console.error('❌ Could not find .sidebar CSS rule');
    process.exit(1);
}

const cssBody = sidebarMatch[1];
console.log('Found .sidebar CSS:', cssBody.replace(/\s+/g, ' ').trim());

// Check z-index
const zIndexMatch = cssBody.match(/z-index:\s*(\d+)/);
if (!zIndexMatch) {
    console.error('❌ .sidebar is missing z-index');
    process.exit(1);
}

const zIndex = parseInt(zIndexMatch[1], 10);
if (zIndex < 2000) {
    console.error(`❌ .sidebar z-index is too low (${zIndex}). Expected >= 2000`);
    process.exit(1);
}

// Check top
const topMatch = cssBody.match(/top:\s*(\d+)/);
if (!topMatch) {
    // Check if it's top: 0 (without unit)
    if (!cssBody.includes('top: 0')) {
        console.error('❌ .sidebar is missing top: 0');
        process.exit(1);
    }
}

console.log('✅ Sidebar Layout Verification Passed: z-index is sufficient.');
process.exit(0);
