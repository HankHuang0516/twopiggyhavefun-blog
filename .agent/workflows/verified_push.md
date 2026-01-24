---
description: Build, Verify, and Push
---

This workflow automatically builds the project, runs the internal verification script to check for broken links and legacy paths, and if successful, pushes the changes to the remote repository.

* 用繁體中文與用戶溝通

* 如果有任何Bug經過驗證被修復了，請立即為Bug建立部屬測試。

* 我現在已經把git網頁轉到https://twopiggyhavefun.uk/的網域，所以要驗證修復請用此連結

* 實施bug修復或新功能前，請確定你看過整個專案的Repo

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

3. Push to repository
   > git push