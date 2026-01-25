const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/pages/editor.astro');
const content = fs.readFileSync(filePath, 'utf8');

// 1. Check if loginBtn is defined in els object
if (!content.includes('loginBtn: document.getElementById(\'login-btn\')')) {
    console.error('❌ Login Button logic missing: `loginBtn` not defined in `els` object.');
    process.exit(1);
}

// 2. Check if event listener is attached
if (!content.includes('els.loginBtn.addEventListener(\'click\', handleLogin)')) {
    console.error('❌ Login Button logic missing: Event listener not attached.');
    process.exit(1);
}

// 3. Check for dangerous top-level initialization
if (content.match(/const\s+turndownService\s*=\s*new\s+TurndownService/)) {
    console.error('❌ Failure: `const turndownService = new ...` found at top-level. This can break script execution if lib fails to load.');
    process.exit(1);
}

console.log('✅ Login Button Verification Passed.');
process.exit(0);
