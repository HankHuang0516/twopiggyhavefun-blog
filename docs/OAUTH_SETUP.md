# OAuth 授權流程說明

為了讀取 Private 相簿，後端已升級為 Express + OAuth 架構。

## 使用步驟

1.  **啟動授權**:
    開啟瀏覽器訪問: `https://twopiggyhavefun-blog-production.up.railway.app/api/auth/start`
    (本地開發用: `http://localhost:3456/api/auth/start`)

2.  **Flickr 登入與授權**:
    系統會導向 Flickr，請點擊 "OK, I'll allow it"。

3.  **取得 Token**:
    授權後會跳轉回 `/api/auth/callback`，畫面會顯示：
    > ✅ Flickr 授權成功！
    > FLICKR_OAUTH_TOKEN=...
    > FLICKR_OAUTH_TOKEN_SECRET=...

4.  **設定環境變數**:
    將上述兩個 Token 複製，貼到 Railway 的 Variables 設定中。
    Re-deploy 後即可永久生效。

## 為什麼需要這樣做？
Flickr API 的 `flickr.photosets.getList` 對於完全公開的相簿有時也需要簽名權限才能列出，或者使用者的相簿權限其實是 "Friends/Family"。
透過 OAuth，我們可以確保後端擁有與您登入時相同的讀取權限。
