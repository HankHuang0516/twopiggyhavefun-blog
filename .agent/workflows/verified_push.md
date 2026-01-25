---
description: Build, Verify, and Push
---

This workflow automatically builds the project, runs the internal verification script to check for broken links and legacy paths, and if successful, pushes the changes to the remote repository.

* 用繁體中文與用戶溝通

* 如果有任何Bug經過驗證被修復了，請立即為Bug建立部屬測試。

* 我現在已經把git網頁轉到https://twopiggyhavefun.uk/的網域，所以要驗證修復請用此連結

* 實施 bug 修復或新功能前，請確定你看過整個專案的 Repo

* **開發與驗證原則**：用戶所有操作皆直接在 `https://twopiggyhavefun.uk/` 進行，以貼近真實用戶習慣。非必要不使用 `localhost` 進行操作。

1. Build the project
   > npm run build

2. Run verification scripts
   > node tests/verify_build.js
   > node tests/verify_sidebar_fix.js
   > node tests/verify_crud_api.js
   > node tests/verify_404_bug_fix.js
   > node tests/verify_business_status.js
   > node tests/verify_site.js --internal-only
   > node tests/verify_regression.js
   > node tests/verify_titles.js

3. Sync with Remote (Crucial for Auto-Deploy)
   > git pull --rebase

4. Push to repository
   > git push

5. Verify Git Active (Confirm Push)
   > git log -n 1 --stat origin/main

4. Deploy to Railway
   - **自動部署**: Push 到 GitHub 後 Railway 會自動部署（推薦）
   - **手動部署**: `railway up` (有 100MB 限制，不建議使用)

## Railway Project Info
- **Project Name:** twopiggy-blog-v2
- **Workspace:** hankhuang0516's Projects
- **Dashboard:** https://railway.com/project/6f0d1867-a4b3-4262-a303-5a6cff2308c3
- **API URL:** https://twopiggyhavefun-blog-production.up.railway.app
- **部署方式:** GitHub 連接自動部署
- **注意事項:**
  - `.gitignore` 已排除 `gen_*`, `node_modules`, `dist`, `nul`
  - Railway 會自動執行 `npm install`
  - 圖片資料夾不會上傳到 Railway