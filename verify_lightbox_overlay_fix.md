# Lightbox 覆蓋層攔截點擊修復 - 部署測試清單

**修復日期：** 2026-01-24
**測試網域：** https://twopiggyhavefun.uk/
**關聯 TODO：** UI Bug: Clickable Whitespace causing unintended navigation

---

## 🐛 已修復的關鍵 Bug

### Bug: Lightbox 隱形覆蓋層攔截文章頁面所有點擊
**嚴重度：** 🔴 極高（導致網站核心功能失效）

**問題描述：**
- 用戶在文章頁面點擊空白區域（段落間距、邊距等）會觸發意外導航
- Lightbox 模態框的隱形覆蓋層一直存在於頁面上
- 覆蓋層使用 `z-index: 60`，優先級高於所有內容
- 雖然設置為不可見，但仍然攔截點擊事件

**根本原因：**
```javascript
// 問題代碼 (src/layouts/Layout.astro:447)
lightbox.className = 'fixed inset-0 z-[60] bg-black/90 hidden flex items-center justify-center ...';
```

**CSS 類別衝突：**
1. `hidden` = `display: none` (Tailwind CSS)
2. `flex` = `display: flex` (Tailwind CSS)
3. 兩個類別同時存在時，CSS 層疊規則可能讓 `flex` 覆蓋 `hidden`
4. 結果：元素實際上是 `display: flex`，但透明度為 0（看不見但可點擊）
5. `pointer-events` 未設置為 `none`，導致隱形層攔截所有點擊

**影響範圍：**
- ✅ 首頁文章卡片（已在前次修復）
- ✅ 文章頁面內容區域（本次修復）
- ✅ 所有包含 Lightbox 功能的頁面

---

## 🔧 修復內容

### 1. 移除 CSS 類別衝突
**位置：** [src/layouts/Layout.astro:447-448](src/layouts/Layout.astro#L447-L448)

**修改前：**
```javascript
lightbox.className = '... hidden flex ...';
```

**修改後：**
```javascript
lightbox.className = '... items-center justify-center ...'; // 移除 hidden 和 flex
lightbox.style.display = 'none'; // 使用內聯樣式確保隱藏
```

### 2. 更新關閉 Lightbox 邏輯
**位置：** [src/layouts/Layout.astro:466](src/layouts/Layout.astro#L466)

**修改前：**
```javascript
lightbox.classList.add('hidden'); // 可能無效
```

**修改後：**
```javascript
lightbox.style.display = 'none'; // 可靠的隱藏方式
```

### 3. 更新打開 Lightbox 邏輯
**位置：** [src/layouts/Layout.astro:520](src/layouts/Layout.astro#L520)

**修改前：**
```javascript
lightbox.classList.remove('hidden'); // 可能無效
```

**修改後：**
```javascript
lightbox.style.display = 'flex'; // 明確顯示為 flex 容器
```

---

## 📋 完整測試清單

### 🌐 線上測試（必須）
**測試網址：** https://twopiggyhavefun.uk/

#### 桌面端測試
- [ ] **文章頁面空白點擊測試**
  1. 進入任一文章頁面
  2. 在文章段落之間的空白處點擊
  3. ✅ 預期：不應觸發任何導航或鏈接
  4. 在文章側邊空白處點擊
  5. ✅ 預期：不應觸發任何導航

- [ ] **Lightbox 功能測試**
  1. 進入包含圖片的文章頁面
  2. 點擊文章內的獨立圖片（非連結內的圖片）
  3. ✅ 預期：應該打開 Lightbox 放大顯示
  4. 點擊 Lightbox 背景或關閉按鈕
  5. ✅ 預期：Lightbox 應該關閉
  6. 按 ESC 鍵
  7. ✅ 預期：Lightbox 應該關閉

- [ ] **文章內連結點擊測試**
  1. 點擊文章內的超連結
  2. ✅ 預期：應該正常跳轉，不被攔截
  3. 點擊文章內帶連結的圖片
  4. ✅ 預期：應該跳轉到連結目標（不打開 Lightbox）

- [ ] **導航功能測試**
  1. 點擊文章底部的「上一篇」「下一篇」按鈕
  2. ✅ 預期：應該正常導航
  3. 點擊文章標籤
  4. ✅ 預期：應該跳轉到分類頁面
  5. 點擊麵包屑導航
  6. ✅ 預期：應該正常跳轉

#### 移動端測試
- [ ] **觸摸點擊測試**
  1. 在手機上訪問文章頁面
  2. 在文章內容區域隨意點擊空白處
  3. ✅ 預期：不應觸發意外跳轉
  4. 觸摸底部分享欄以外的區域
  5. ✅ 預期：分享欄不應攔截點擊

- [ ] **移動端 Lightbox 測試**
  1. 點擊文章圖片
  2. ✅ 預期：Lightbox 應該正常打開
  3. 點擊背景關閉
  4. ✅ 預期：應該正常關閉

#### 跨瀏覽器測試
- [ ] Chrome / Edge
- [ ] Firefox
- [ ] Safari (桌面 + iOS)
- [ ] 移動端瀏覽器 (Chrome Mobile, Safari Mobile)

---

## 🔍 開發者工具驗證

### 檢查 Lightbox 初始狀態
1. 打開任一文章頁面
2. 按 F12 打開開發者工具
3. 在 Console 執行：
   ```javascript
   const lightbox = document.getElementById('lightbox-modal');
   console.log('Display:', lightbox.style.display); // 應該是 'none'
   console.log('Computed display:', getComputedStyle(lightbox).display); // 應該是 'none'
   console.log('Pointer events:', getComputedStyle(lightbox).pointerEvents); // 應該是 'auto' 或未設置
   ```
4. ✅ 預期：`display` 應該是 `'none'`，不應該是 `'flex'`

### 檢查點擊事件目標
1. 在文章空白處點擊前，在 Console 執行：
   ```javascript
   document.addEventListener('click', (e) => {
     console.log('Clicked element:', e.target);
     console.log('Tag name:', e.target.tagName);
     console.log('Classes:', e.target.className);
   }, { once: true });
   ```
2. 點擊文章空白處
3. ✅ 預期：被點擊的元素應該是 `<div>`、`<article>` 或 `<main>`，**不應該是** Lightbox 相關元素

---

## 📝 回歸測試

確保之前的修復沒有被影響：

- [ ] 首頁文章卡片點擊正常（PostCard 修復）
- [ ] 文章卡片標籤可以點擊
- [ ] 卡片圖片點擊導航到文章頁
- [ ] 側邊欄展開/收合功能正常

---

## 🎯 驗證成功標準

1. ✅ 文章頁面任何空白區域點擊都不會觸發導航
2. ✅ Lightbox 在關閉狀態下 `display: none`
3. ✅ Lightbox 開啟/關閉功能正常
4. ✅ 文章內的所有連結和按鈕可以正常點擊
5. ✅ 桌面端和移動端行為一致

---

## 📊 技術細節

### CSS 優先級問題說明
```css
/* Tailwind 生成的 CSS (簡化) */
.hidden { display: none !important; }
.flex { display: flex !important; }
```

當兩個 class 同時存在且都有 `!important` 時：
- CSS 規則按**定義順序**決定優先級
- 如果 `.flex` 在樣式表中位於 `.hidden` 之後，`flex` 會生效
- 即使元素看起來透明（opacity: 0），但 `display: flex` 會讓元素佔據空間並響應點擊

### 解決方案優點
使用內聯樣式 `style.display` 的優點：
1. **優先級最高**：內聯樣式優先於所有 CSS 類別
2. **明確可控**：JavaScript 直接控制，不受 CSS 層疊影響
3. **可靠性高**：不依賴 Tailwind CSS 的類別順序

---

## 🚀 部署後驗證

部署完成後 1-3 分鐘，執行以下快速測試：

1. 訪問 https://twopiggyhavefun.uk/
2. 進入任一文章（例如：最新文章）
3. **快速測試**：在文章標題下方、段落之間點擊 5 次空白處
4. ✅ 如果沒有任何意外跳轉 → 修復成功！
5. 點擊一張圖片測試 Lightbox
6. ✅ 如果 Lightbox 正常開啟和關閉 → 功能正常！

---

## 📂 相關文件

- **修復代碼：** src/layouts/Layout.astro
- **診斷工具：** diagnose_click_issue.js
- **測試清單：** verify_lightbox_overlay_fix.md (本文件)
- **前次修復：** verify_css_click_fix.md (PostCard 覆蓋層修復)
- **TODO 追蹤：** TODO.md

---

**修復狀態：** ✅ 已推送至 main 分支
**Commit ID：** bf0cfad
**等待部署：** GitHub Pages 自動部署（約 1-3 分鐘）
