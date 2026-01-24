const fs = require('fs');
const path = require('path');

const DIST_DIR = path.resolve(__dirname, '../dist');

function verify404Fix() {
    console.log('🚀 Running 404 Bug Fix Deployment Test...');

    if (!fs.existsSync(DIST_DIR)) {
        console.error('❌ dist directory not found. Build the project first.');
        process.exit(1);
    }

    const issues = [];

    function walk(dir) {
        const files = fs.readdirSync(dir);
        for (const file of files) {
            const filePath = path.join(dir, file);
            const relativePath = path.relative(DIST_DIR, filePath);
            const stat = fs.statSync(filePath);

            // Warning for non-ASCII characters in paths (can be tricky on some hosts)
            if (/[^\x00-\x7F]/.test(relativePath)) {
                console.warn(`  ⚠️ Warning: Non-ASCII characters in path: ${relativePath}`);
            }

            // Check for special characters that strictly break URLs or file systems
            if (/[\*\?<>\|]/.test(file)) {
                issues.push(`Invalid character found in filename: ${relativePath}`);
            }


            if (stat.isDirectory()) {
                walk(filePath);
            }
        }
    }

    walk(DIST_DIR);

    // Specific sanity checks
    const criticalFiles = [
        'index.html',
        '404.html',
        'sitemap-index.xml',
        'search.json'
    ];

    criticalFiles.forEach(file => {
        if (!fs.existsSync(path.join(DIST_DIR, file))) {
            issues.push(`Critical file missing: ${file}`);
        }
    });

    console.log('\n📊 Test Results:');
    if (issues.length > 0) {
        console.error(`❌ Found ${issues.length} issues:`);
        issues.forEach(issue => console.error(`  - ${issue}`));
        process.exit(1);
    } else {
        console.log('✨ All 404 fix checks passed! No illegal characters found in build output.');
        process.exit(0);
    }
}

verify404Fix();
