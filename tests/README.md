# 構建驗證測試

這個目錄包含用於驗證專案構建的測試腳本，可以在實際構建前發現潛在問題。

## 測試文件

### `verify_build.js`
**用途：** 檢查所有可能導致構建失敗的問題

**檢查項目：**
1. ✅ **slugify 函數導出** - 確保 categories.ts 正確導出 slugify 函數
2. ✅ **PostCard.astro import** - 檢查 import 語句是否正確
3. ✅ **其他組件 import** - 驗證 Sidebar、文章頁等組件的 import
4. ✅ **TypeScript 類型導出** - 確保所有必需的類型和函數都已導出
5. ✅ **關鍵文件存在** - 檢查必需的文件是否存在
6. ✅ **Lightbox 修復** - 驗證 Lightbox 覆蓋層修復是否正確實施
7. ✅ **package.json** - 檢查構建腳本配置

## 使用方法

### 方法 1：直接運行
```bash
node tests/verify_build.js
```

### 方法 2：使用 npm 腳本（推薦）
```bash
npm run test:build
```

### 方法 3：在構建前自動運行
```bash
npm run prebuild
```

## 輸出示例

### ✅ 成功的輸出
```
🔧 構建驗證測試

============================================================

📋 Test 1: 檢查 slugify 函數導出
------------------------------------------------------------
✅ PASS: slugify 函數已正確導出
   參數: text: string

📋 Test 2: 檢查 PostCard.astro 的 import 語句
------------------------------------------------------------
✅ PASS: PostCard.astro 正確導入並使用 slugify

...

============================================================
📊 驗證結果總結
============================================================

✅ 通過的測試: 8
   ✅ slugify 函數已正確導出
   ✅ PostCard.astro 正確導入並使用 slugify
   ...

============================================================
錯誤: 0, 警告: 0

✅ 構建驗證全部通過！可以安全構建。
```

### ❌ 失敗的輸出
```
📋 Test 1: 檢查 slugify 函數導出
------------------------------------------------------------
❌ FAIL: slugify 函數未導出（缺少 export 關鍵字）

============================================================
📊 驗證結果總結
============================================================

❌ 失敗的測試: 1
   ❌ slugify 函數未導出（缺少 export 關鍵字）

============================================================
錯誤: 1, 警告: 0

❌ 構建驗證失敗！請修復上述錯誤後再嘗試構建。
```

## 整合到 CI/CD

### GitHub Actions 整合
在 `.github/workflows/deploy.yml` 中添加驗證步驟：

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm install

      - name: Run build verification
        run: node tests/verify_build.js

      - name: Build
        run: npm run build
```

### 本地 Git Hook
在 `.git/hooks/pre-commit` 中添加：

```bash
#!/bin/sh
echo "Running build verification..."
node tests/verify_build.js
if [ $? -ne 0 ]; then
  echo "Build verification failed. Commit aborted."
  exit 1
fi
```

## 常見問題修復

### 問題 1：slugify 未導出
**錯誤：** `"slugify" is not exported by "src/utils/categories.ts"`

**修復：**
在 `src/utils/categories.ts` 中確保 slugify 函數有 `export` 關鍵字：
```typescript
export function slugify(text: string): string {
  // ...
}
```

### 問題 2：Lightbox 覆蓋層問題
**錯誤：** Lightbox 仍使用舊的 `classList.add("hidden")` 方法

**修復：**
在 `src/layouts/Layout.astro` 中使用 `style.display`：
```javascript
// 初始化
lightbox.style.display = 'none';

// 打開
lightbox.style.display = 'flex';

// 關閉
lightbox.style.display = 'none';
```

### 問題 3：import 路徑錯誤
**錯誤：** 組件使用某個函數但未導入

**修復：**
在組件頂部添加正確的 import 語句：
```typescript
import { slugify, getCategorySlug } from '../utils/categories';
```

## 添加新測試

如果需要添加新的驗證測試，請在 `verify_build.js` 中按照以下模式添加：

```javascript
// ============================================
// Test X: 測試名稱
// ============================================
console.log('\n📋 Test X: 測試名稱');
console.log('-'.repeat(60));

try {
    // 測試邏輯
    const testCondition = true; // 你的測試條件

    if (testCondition) {
        results.passed.push('✅ 測試通過訊息');
        console.log('✅ PASS: 測試通過訊息');
    } else {
        errors++;
        results.failed.push('❌ 測試失敗訊息');
        console.log('❌ FAIL: 測試失敗訊息');
    }
} catch (error) {
    errors++;
    console.log(`❌ ERROR: ${error.message}`);
}
```

## 測試覆蓋率

目前測試覆蓋的構建失敗場景：
- ✅ Import/Export 錯誤
- ✅ 文件缺失
- ✅ TypeScript 類型錯誤
- ✅ CSS/UX 修復驗證
- ✅ 配置文件問題

## 維護說明

當專案結構或依賴關係發生變化時，請更新此測試文件：
1. 新增組件時，添加到 `componentsToCheck` 列表
2. 新增關鍵文件時，添加到 `criticalFiles` 列表
3. 新增必需的導出時，添加到 `requiredExports` 列表

## 相關文件

- `verify_build.js` - 主要驗證腳本
- `../FINAL_TEST_CHECKLIST.md` - 線上測試清單
- `../verify_lightbox_overlay_fix.md` - Lightbox 修復驗證
- `../.github/workflows/deploy.yml` - CI/CD 配置
