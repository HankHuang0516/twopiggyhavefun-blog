# 文章目錄（TOC）功能修復 - 驗證清單

**修復日期：** 2026-01-24
**Commit ID：** 0c3eaf0
**測試網址：** https://twopiggyhavefun.uk/

---

## 🐛 已修復的問題

### 問題 1：目錄錨點連結無法跳轉
**嚴重度：** 🔴 高

**問題描述：**
- 點擊目錄中的連結後，頁面不會滾動到對應位置
- 所有包含目錄的文章都受影響

**根本原因：**
1. **標題缺少 ID 屬性**
   - 文章中的 h2, h3 標題沒有 `id` 屬性
   - Astro 的 `headings` 有 slug，但沒有應用到實際 HTML

2. **錨點格式異常**
   - 目錄連結使用 `#"文字"` 格式（包含引號）
   - 瀏覽器無法正確解析這種格式

**修復方案：**
```javascript
// 自動為標題添加 ID
const tocLinks = document.querySelectorAll('.toc-link');
const articleContent = document.querySelector('.pixnet-content');

// 匹配 TOC 連結與標題的文字內容
tocLinks.forEach(link => {
    const linkText = link.textContent?.trim();
    headings.forEach(heading => {
        const headingText = heading.textContent?.trim();
        if (headingText === linkText) {
            heading.id = slug; // 添加 ID
        }
    });
});
```

**新增功能：**
- ✅ 平滑滾動效果
- ✅ 處理固定 header 的偏移量（80px）
- ✅ 更新 URL hash

---

### 問題 2：目錄容器需要下拉才能查看
**嚴重度：** 🟡 中

**問題描述：**
- 目錄使用 `<details>/<summary>` 折疊結構
- 默認為收起狀態，用戶需要手動展開
- 對於長目錄，用戶體驗不佳

**修復方案：**
```html
<!-- 修改前 -->
<details class="group bg-gray-50">
    <summary>📖 文章目錄</summary>
    <nav>...</nav>
</details>

<!-- 修改後 -->
<div class="bg-white">
    <div class="bg-gray-50 p-4">📖 文章目錄</div>
    <nav class="max-h-96 overflow-y-auto">...</nav>
</div>
```

**新增功能：**
- ✅ 目錄永久展開
- ✅ 最大高度限制（max-h-96 = 24rem = 384px）
- ✅ 超過高度時可垂直滾動

---

## 🔧 技術實現

### 1. 自動 ID 生成
**位置：** src/pages/posts/[...slug].astro:395-420

**邏輯：**
1. 獲取所有目錄連結（`.toc-link`）
2. 獲取文章中的所有標題（`h1-h6`）
3. 通過文字內容匹配連結和標題
4. 為匹配的標題設置 `id` 屬性

### 2. 平滑滾動
**位置：** src/pages/posts/[...slug].astro:422-447

**功能：**
- 攔截錨點連結的點擊事件
- 計算目標元素位置（考慮固定 header）
- 使用 `window.scrollTo()` 平滑滾動
- 使用 `history.pushState()` 更新 URL

### 3. 目錄 UI
**位置：** src/pages/posts/[...slug].astro:182-200

**改進：**
- 移除折疊功能
- 添加滾動功能（長目錄）
- 改善視覺層次

---

## 📋 測試清單

### 桌面端測試

1. **基本功能**
   - [ ] 訪問測試文章：https://twopiggyhavefun.uk/posts/20260105-3yqjih/
   - [ ] 目錄應該完全展開（不需要點擊展開按鈕）
   - [ ] 所有目錄項目都可見（或可滾動查看）

2. **錨點跳轉**
   - [ ] 點擊第一個目錄項目
   - [ ] ✅ 頁面應該平滑滾動到對應標題
   - [ ] ✅ URL 應該更新（加上 hash）
   - [ ] ✅ 標題應該顯示在視窗頂部（不被 header 遮擋）

3. **多次點擊**
   - [ ] 點擊不同的目錄項目 3-5 次
   - [ ] ✅ 每次都應該正確跳轉
   - [ ] ✅ 滾動應該流暢

4. **長目錄測試**
   - [ ] 找一篇有 10+ 個標題的文章
   - [ ] 目錄容器應該有滾動條
   - [ ] 可以滾動查看所有目錄項目

### 移動端測試

1. **觸摸操作**
   - [ ] 在手機上訪問測試文章
   - [ ] 點擊目錄項目應該正常跳轉
   - [ ] 滾動應該流暢

2. **目錄顯示**
   - [ ] 目錄應該完全展開
   - [ ] 長目錄可以在容器內滾動

### 瀏覽器測試

- [ ] Chrome / Edge
- [ ] Firefox
- [ ] Safari
- [ ] 移動端瀏覽器

---

## 🧪 開發者工具驗證

### 檢查標題 ID

1. 打開測試文章
2. 按 F12 打開開發者工具
3. 在 Console 執行：
   ```javascript
   // 檢查標題是否有 ID
   const headings = document.querySelectorAll('.pixnet-content h1, .pixnet-content h2, .pixnet-content h3');
   console.log('標題數量:', headings.length);

   headings.forEach((h, i) => {
     console.log(`${i+1}. ${h.tagName} ID="${h.id}" 文字="${h.textContent.trim()}"`);
   });
   ```

4. **預期輸出：**
   - 每個標題都應該有 `id` 屬性
   - ID 應該是 Astro 生成的 slug 格式

### 檢查目錄連結

```javascript
// 檢查目錄連結
const tocLinks = document.querySelectorAll('.toc-link');
console.log('目錄連結數量:', tocLinks.length);

tocLinks.forEach((link, i) => {
  const href = link.getAttribute('href');
  const targetId = href.replace('#', '');
  const target = document.getElementById(targetId);
  console.log(`${i+1}. href="${href}" 目標存在: ${!!target}`);
});
```

5. **預期輸出：**
   - 每個連結的目標都應該存在（true）

---

## 📊 測試場景

### 場景 1：標準文章
**URL：** https://twopiggyhavefun.uk/posts/20260105-3yqjih/

**測試步驟：**
1. 訪問文章
2. 向下滾動查看目錄
3. 點擊「為什麼要補充膠原蛋白？我需要嗎？」
4. ✅ 應該滾動到對應標題
5. 點擊其他目錄項目
6. ✅ 應該正確跳轉

### 場景 2：長目錄文章
**測試：** 找一篇有超過 10 個標題的文章

**測試步驟：**
1. 訪問文章
2. 檢查目錄容器
3. ✅ 應該有垂直滾動條
4. 滾動目錄查看所有項目
5. 點擊最後一個項目
6. ✅ 應該跳轉到文章末尾

### 場景 3：直接訪問 Hash URL
**測試：** 直接訪問帶 hash 的 URL

**測試步驟：**
1. 複製一個目錄連結的完整 URL（例如：`https://twopiggyhavefun.uk/posts/20260105-3yqjih/#為什麼要補充膠原蛋白？我需要嗎？`）
2. 在新分頁中打開這個 URL
3. ✅ 頁面應該載入並滾動到對應標題

---

## 🔍 已知限制

1. **標題文字必須完全匹配**
   - JavaScript 通過文字內容匹配標題和目錄
   - 如果標題文字和目錄文字不一致，ID 不會被設置

2. **依賴 DOM 順序**
   - 假設目錄和文章中的標題順序一致
   - 如果順序不同，可能匹配錯誤

3. **客戶端處理**
   - ID 是在客戶端 JavaScript 中添加的
   - 如果 JavaScript 被禁用，功能不可用

---

## 🎯 成功標準

測試**全部通過**以下條件即為成功：

1. ✅ 目錄永久展開（不需要手動點擊）
2. ✅ 點擊目錄項目會滾動到對應標題
3. ✅ 滾動是平滑的（smooth scroll）
4. ✅ 標題不會被 header 遮擋
5. ✅ URL hash 會更新
6. ✅ 長目錄可以在容器內滾動
7. ✅ 桌面端和移動端都正常工作

---

## 📝 相關文件

- **修改的文件：** src/pages/posts/[...slug].astro
- **Commit：** 0c3eaf0
- **測試 URL：** https://twopiggyhavefun.uk/posts/20260105-3yqjih/

---

## 🚀 部署後驗證

**等待時間：** GitHub Pages 部署約 3-5 分鐘

**快速驗證步驟：**
1. 使用無痕模式訪問測試 URL
2. 點擊任一目錄項目
3. ✅ 如果頁面滾動到對應位置 → 修復成功！
4. ❌ 如果沒有滾動 → 清除緩存重試或檢查錯誤日誌

---

**修復狀態：** ✅ 已推送至 main 分支
**等待部署：** GitHub Pages 自動部署中
