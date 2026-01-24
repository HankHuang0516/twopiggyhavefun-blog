#!/usr/bin/env node
/**
 * Build Verification Test
 * 檢查所有可能導致構建失敗的問題
 *
 * Usage: node tests/verify_build.js
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 構建驗證測試\n');
console.log('='.repeat(60));

let errors = 0;
let warnings = 0;

// 測試結果收集
const results = {
    passed: [],
    failed: [],
    warnings: []
};

// ============================================
// Test 1: 檢查 slugify 函數導出
// ============================================
console.log('\n📋 Test 1: 檢查 slugify 函數導出');
console.log('-'.repeat(60));

try {
    const categoriesContent = fs.readFileSync('src/utils/categories.ts', 'utf-8');

    // 檢查函數是否存在
    const hasSluggifyFunction = categoriesContent.includes('function slugify');
    const hasSluggifyExport = categoriesContent.includes('export function slugify');

    if (!hasSluggifyFunction) {
        errors++;
        results.failed.push('❌ slugify 函數未定義');
        console.log('❌ FAIL: slugify 函數未定義');
    } else if (!hasSluggifyExport) {
        errors++;
        results.failed.push('❌ slugify 函數未導出（缺少 export 關鍵字）');
        console.log('❌ FAIL: slugify 函數未導出（缺少 export 關鍵字）');
    } else {
        results.passed.push('✅ slugify 函數已正確導出');
        console.log('✅ PASS: slugify 函數已正確導出');
    }

    // 檢查函數簽名
    const slugifyMatch = categoriesContent.match(/export function slugify\s*\(\s*(\w+)\s*:\s*string\s*\)/);
    if (slugifyMatch) {
        console.log(`   參數: ${slugifyMatch[1]}: string`);
    }

} catch (error) {
    errors++;
    results.failed.push(`❌ 無法讀取 categories.ts: ${error.message}`);
    console.log(`❌ ERROR: 無法讀取 categories.ts: ${error.message}`);
}

// ============================================
// Test 2: 檢查 PostCard 的 import 語句
// ============================================
console.log('\n📋 Test 2: 檢查 PostCard.astro 的 import 語句');
console.log('-'.repeat(60));

try {
    const postCardContent = fs.readFileSync('src/components/PostCard.astro', 'utf-8');

    // 檢查是否導入 slugify
    const hasSlugifyImport = postCardContent.includes("import { slugify } from '../utils/categories'");
    const usesSlugify = postCardContent.includes('slugify(');

    if (usesSlugify && !hasSlugifyImport) {
        errors++;
        results.failed.push('❌ PostCard.astro 使用 slugify 但未導入');
        console.log('❌ FAIL: PostCard.astro 使用 slugify 但未導入');
    } else if (hasSlugifyImport && !usesSlugify) {
        warnings++;
        results.warnings.push('⚠️  PostCard.astro 導入了 slugify 但未使用');
        console.log('⚠️  WARNING: PostCard.astro 導入了 slugify 但未使用');
    } else if (hasSlugifyImport && usesSlugify) {
        results.passed.push('✅ PostCard.astro 正確導入並使用 slugify');
        console.log('✅ PASS: PostCard.astro 正確導入並使用 slugify');
    } else {
        results.passed.push('✅ PostCard.astro 未使用 slugify（無需導入）');
        console.log('✅ PASS: PostCard.astro 未使用 slugify（無需導入）');
    }

} catch (error) {
    errors++;
    results.failed.push(`❌ 無法讀取 PostCard.astro: ${error.message}`);
    console.log(`❌ ERROR: 無法讀取 PostCard.astro: ${error.message}`);
}

// ============================================
// Test 3: 檢查其他常見的 import 問題
// ============================================
console.log('\n📋 Test 3: 檢查其他組件的 import 語句');
console.log('-'.repeat(60));

const componentsToCheck = [
    { file: 'src/components/Sidebar.astro', imports: ['slugify', 'getCategorySlug'] },
    { file: 'src/pages/posts/[...slug].astro', imports: ['getCategorySlug', 'slugify'] },
    { file: 'src/pages/category/[...slug].astro', imports: ['getCategorySlug'] }
];

componentsToCheck.forEach(({ file, imports }) => {
    try {
        if (!fs.existsSync(file)) {
            console.log(`   ⏭️  SKIP: ${file} 不存在`);
            return;
        }

        const content = fs.readFileSync(file, 'utf-8');
        let fileHasIssues = false;

        imports.forEach(importName => {
            const usesImport = content.includes(`${importName}(`);
            const hasImport = content.match(new RegExp(`import\\s+{[^}]*${importName}[^}]*}\\s+from\\s+['"].*categories`));

            if (usesImport && !hasImport) {
                errors++;
                fileHasIssues = true;
                results.failed.push(`❌ ${path.basename(file)} 使用 ${importName} 但未導入`);
                console.log(`   ❌ ${path.basename(file)}: 使用 ${importName} 但未導入`);
            }
        });

        if (!fileHasIssues) {
            console.log(`   ✅ ${path.basename(file)}: import 語句正確`);
        }

    } catch (error) {
        warnings++;
        console.log(`   ⚠️  ${path.basename(file)}: 無法讀取 - ${error.message}`);
    }
});

// ============================================
// Test 4: 檢查 TypeScript 類型導出
// ============================================
console.log('\n📋 Test 4: 檢查 TypeScript 類型導出');
console.log('-'.repeat(60));

try {
    const categoriesContent = fs.readFileSync('src/utils/categories.ts', 'utf-8');

    const requiredExports = [
        'PIXNET_CATEGORY_HIERARCHY',
        'getCategorySlug',
        'slugify',
        'getParentCategoryName'
    ];

    let allExported = true;
    requiredExports.forEach(exportName => {
        const isExported = categoriesContent.match(new RegExp(`export\\s+(const|function|type)\\s+${exportName}`));
        if (!isExported) {
            errors++;
            allExported = false;
            results.failed.push(`❌ ${exportName} 未導出`);
            console.log(`   ❌ ${exportName} 未導出`);
        }
    });

    if (allExported) {
        results.passed.push('✅ 所有必需的導出都存在');
        console.log('   ✅ 所有必需的導出都存在');
    }

} catch (error) {
    errors++;
    console.log(`   ❌ ERROR: ${error.message}`);
}

// ============================================
// Test 5: 檢查文件路徑和引用
// ============================================
console.log('\n📋 Test 5: 檢查文件路徑正確性');
console.log('-'.repeat(60));

const criticalFiles = [
    'src/utils/categories.ts',
    'src/utils/date.ts',
    'src/components/PostCard.astro',
    'src/components/Sidebar.astro',
    'src/layouts/Layout.astro'
];

criticalFiles.forEach(file => {
    if (fs.existsSync(file)) {
        console.log(`   ✅ ${file} 存在`);
    } else {
        errors++;
        results.failed.push(`❌ 缺少關鍵文件: ${file}`);
        console.log(`   ❌ 缺少關鍵文件: ${file}`);
    }
});

// ============================================
// Test 6: 檢查 Lightbox 代碼正確性
// ============================================
console.log('\n📋 Test 6: 檢查 Lightbox 修復代碼');
console.log('-'.repeat(60));

try {
    const layoutContent = fs.readFileSync('src/layouts/Layout.astro', 'utf-8');

    // 檢查是否使用 style.display 而非 classList
    const hasStyleDisplay = layoutContent.includes('lightbox.style.display');
    const hasOldHiddenClass = layoutContent.match(/lightbox\.classList\.(add|remove)\(['"]hidden['"]\)/);

    if (hasOldHiddenClass) {
        warnings++;
        results.warnings.push('⚠️  Lightbox 仍使用舊的 classList.add("hidden") 方法');
        console.log('   ⚠️  WARNING: Lightbox 仍使用舊的 classList.add("hidden") 方法');
    }

    if (hasStyleDisplay) {
        results.passed.push('✅ Lightbox 使用 style.display 方法（已修復）');
        console.log('   ✅ Lightbox 使用 style.display 方法（已修復）');

        // 檢查具體的實現
        const hasDisplayNone = layoutContent.includes('lightbox.style.display = \'none\'') ||
                               layoutContent.includes('lightbox.style.display = "none"');
        const hasDisplayFlex = layoutContent.includes('lightbox.style.display = \'flex\'') ||
                               layoutContent.includes('lightbox.style.display = "flex"');

        if (hasDisplayNone && hasDisplayFlex) {
            console.log('   ✅ Lightbox 顯示/隱藏邏輯完整');
        } else {
            warnings++;
            results.warnings.push('⚠️  Lightbox 顯示/隱藏邏輯可能不完整');
            console.log('   ⚠️  WARNING: Lightbox 顯示/隱藏邏輯可能不完整');
        }
    } else {
        errors++;
        results.failed.push('❌ Lightbox 未使用 style.display 修復');
        console.log('   ❌ FAIL: Lightbox 未使用 style.display 修復');
    }

    // 檢查是否有衝突的 CSS 類別
    const hasConflictingClasses = layoutContent.match(/className\s*=\s*['"][^'"]*hidden[^'"]*flex[^'"]*['"]|className\s*=\s*['"][^'"]*flex[^'"]*hidden[^'"]*['"]/);
    if (hasConflictingClasses) {
        errors++;
        results.failed.push('❌ Lightbox 仍有 hidden + flex 衝突的 CSS 類別');
        console.log('   ❌ FAIL: Lightbox 仍有 hidden + flex 衝突的 CSS 類別');
    }

} catch (error) {
    errors++;
    console.log(`   ❌ ERROR: ${error.message}`);
}

// ============================================
// Test 7: 檢查 package.json 依賴
// ============================================
console.log('\n📋 Test 7: 檢查 package.json');
console.log('-'.repeat(60));

try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));

    if (packageJson.scripts && packageJson.scripts.build) {
        results.passed.push('✅ package.json 包含 build 腳本');
        console.log('   ✅ package.json 包含 build 腳本');
        console.log(`   Build 命令: ${packageJson.scripts.build}`);
    } else {
        errors++;
        results.failed.push('❌ package.json 缺少 build 腳本');
        console.log('   ❌ package.json 缺少 build 腳本');
    }

    // 檢查 Astro 版本
    if (packageJson.dependencies && packageJson.dependencies.astro) {
        console.log(`   ✅ Astro 版本: ${packageJson.dependencies.astro}`);
    }

} catch (error) {
    errors++;
    console.log(`   ❌ ERROR: 無法讀取 package.json - ${error.message}`);
}

// ============================================
// 總結報告
// ============================================
console.log('\n' + '='.repeat(60));
console.log('📊 驗證結果總結');
console.log('='.repeat(60));

console.log(`\n✅ 通過的測試: ${results.passed.length}`);
results.passed.forEach(msg => console.log(`   ${msg}`));

if (results.warnings.length > 0) {
    console.log(`\n⚠️  警告: ${results.warnings.length}`);
    results.warnings.forEach(msg => console.log(`   ${msg}`));
}

if (results.failed.length > 0) {
    console.log(`\n❌ 失敗的測試: ${results.failed.length}`);
    results.failed.forEach(msg => console.log(`   ${msg}`));
}

console.log('\n' + '='.repeat(60));
console.log(`錯誤: ${errors}, 警告: ${warnings}`);

if (errors > 0) {
    console.log('\n❌ 構建驗證失敗！請修復上述錯誤後再嘗試構建。');
    process.exit(1);
} else if (warnings > 0) {
    console.log('\n⚠️  構建驗證通過，但有警告項目需要注意。');
    process.exit(0);
} else {
    console.log('\n✅ 構建驗證全部通過！可以安全構建。');
    process.exit(0);
}
