# Railway Project Information

## Project Details
- **Project Name:** twopiggy-blog-v2
- **Workspace:** hankhuang0516's Projects
- **Dashboard:** https://railway.com/project/6f0d1867-a4b3-4262-a303-5a6cff2308c3
- **API URL:** https://twopiggyhavefun-blog-production.up.railway.app

## Deployment Method
**使用 GitHub 連接部署**（推薦）
- Railway 直接從 GitHub repo 拉取程式碼
- 自動尊重 `.gitignore` 排除大型檔案
- Push 到 GitHub 時自動觸發部署

## Deployment Notes
- Railway 會在部署時自動執行 `npm install`
- 圖片資料夾 (`gen_ai_picture_*`) 已在 `.gitignore` 中排除
- `railway up` CLI 上傳有 100MB 限制，不建議使用

## Project Structure
- `src/` - 源碼
- `public/` - 靜態資源
- `package.json` - 依賴設定
- `astro.config.mjs` - Astro 設定
- `article_api_server.js` - API 伺服器
- `blog_sync_server.js` - 同步伺服器
- `Procfile` - Railway 啟動指令
