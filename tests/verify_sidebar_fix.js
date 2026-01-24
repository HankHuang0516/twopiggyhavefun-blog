#!/usr/bin/env node
/**
 * Sidebar Fix Verification
 * Checks if Sidebar.astro contains the robust fix (is:inline, !important, etc.)
 */
const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying Sidebar Collapse Fix...');

const sidebarPath = path.join(process.cwd(), 'src/components/Sidebar.astro');
if (!fs.existsSync(sidebarPath)) {
    console.error('❌ Sidebar.astro not found!');
    process.exit(1);
}

const content = fs.readFileSync(sidebarPath, 'utf-8');
const results = [];
let failed = false;

// 1. Check for is:inline script
if (content.includes('<script is:inline>')) {
    results.push('✅ Found <script is:inline>');
} else {
    results.push('❌ Missing <script is:inline>');
    failed = true;
}

// 2. Check for !important max-height
if (content.includes('max-height: 5000px !important')) {
    results.push('✅ Found max-height: 5000px !important');
} else {
    results.push('❌ Missing max-height: 5000px !important');
    failed = true;
}

// 3. Check for Event Delegation
if (content.includes('document.addEventListener(\'click\'') && content.includes('closest(\'.toggle-btn\')')) {
    results.push('✅ Found Event Delegation for .toggle-btn');
} else {
    results.push('❌ Missing Event Delegation or .closest(\'.toggle-btn\')');
    failed = true;
}

// 4. Check for Expand/Collapse All delegators
if (content.includes('closest(\'#expandAll\')') && content.includes('closest(\'#collapseAll\')')) {
    results.push('✅ Found Expand/Collapse All delegators');
} else {
    results.push('❌ Missing Expand/Collapse All delegators');
    failed = true;
}

console.log('\nResults:');
results.forEach(r => console.log(r));

if (failed) {
    console.log('\n❌ Verification FAILED!');
    process.exit(1);
} else {
    console.log('\n✨ Verification PASSED!');
    process.exit(0);
}
