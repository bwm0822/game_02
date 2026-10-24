# 工具殼（tools/）

`npm run dev` 後開 `/tools/`（只支援 Chrome／Edge，File System Access API）。一個網址、上方分頁切換 道具／角色／紙娃娃／試穿，各工具的細節見 [item-editor.md](item-editor.md)、[role-editor.md](role-editor.md)、[paperdoll-tool.md](paperdoll-tool.md)、[fit-tool.md](fit-tool.md)。

## 結構

- `tools/index.html`＋`tools/main.js`：殼。分頁列、選專案資料夾、每個工具一個 iframe（`./item/` 等原本的頁面），**第一次點分頁才建 iframe**，之後切分頁只是 `hidden`，工具狀態（未存修改、紙娃娃圖層）都留著。網址 hash 記目前分頁（`/tools/#role`）。
- `tools/common/shell.js`：工具端的接線，`onProject(fn)`／`notifySaved(file)`／`onSaved(fn)`／`setDirty(bool)`。
- `tools/common/scrollbar.css`：所有工具共用的深色捲軸（`::-webkit-scrollbar`），`common/style.css` 用 `@import` 引入；紙娃娃不載 `common/style.css`，自己 `<link>` 它。
- `tools/common/splitter.js`：左欄寬度可調，main.js `import '../common/splitter.js'` 就會在 `#left` 後面插一個把手（兄弟元素，`#left` 自己捲動也不會被捲走）；拖拉改寬（80px～60vw）、雙擊回 CSS 預設，寬度記在 `localStorage` 的 `tools.left.<工具資料夾>`，各工具分開記。道具／角色／試穿用它；紙娃娃有自己的左右分隔線（見 [paperdoll-tool.md](paperdoll-tool.md)），不載。
- 工具頁不在 iframe 裡（直接開 `/tools/item/`）時沒有資料夾來源，頂端顯示「要從 /tools/ 開」；頁面照常初始化，`window.__ie`／`__re`／`__pd` 還在，無頭測試靠這個直接開工具頁、把 OPFS 假資料夾丟給 `setAssets()`／`setRoot()`。

## 專案資料夾

- 殼只讓人選 **專案根目錄**（game_02，要有 `public/assets/json/item.json`），handle 存在 IndexedDB `tools`（key `root`），Chrome 重開後按「重新授權」。各工具以前各自的 IndexedDB（`item`／`role`／`paperdoll`）不再使用。
- 交接：iframe 載入後 `postMessage({type:'ready'})` 給殼，殼回 `{type:'project', dir}`（handle 可以 structured clone；同 origin，殼授權過工具就能直接用）。殼重選資料夾時會再送給所有已載入的 iframe。
- 各工具往下找：道具／角色／試穿 `public/assets`（改名／刪除會掃 `xls/`、`src/`）；紙娃娃遊戲資料 `public/assets`、工作資料夾固定 `images/`（沒有就在狀態列提示）。

## 更新圖片清單

殼上方的「更新圖片清單」：`POST /__tools/textures`（`vite/config.dev.mjs` 的 `tools-api` plugin，server 端直接呼叫 `scripts/textures.js` 的 `run()`），成功就廣播 `{type:'saved', file:'textures.json'}`，各工具的選圖器（`icons.js`）重讀；失敗（撞名、格子衝突…）把錯誤顯示在狀態列，不寫檔。不用專案資料夾。遊戲要重新整理才會載到新圖。

平常不用按：`tools-api` 也掛 `server.watcher`，`textures/` 底下（不含 `tbd/`、`minimap/`、`maps/`）的圖／`_sheet.json`／`_atlas.json` 新增、刪除、修改時 debounce 300ms 跑 `run()`，結果用 vite ws 自訂事件 `tools:textures` 推給殼（`import.meta.hot.on`），殼照按鈕的流程廣播。`run()` 回報 `changed`，清單內容沒變就不寫檔、狀態列不吭聲，但仍廣播讓選圖器重載被覆蓋的圖。按鈕留著當備援。

同一個 watcher 也看紙娃娃的工作資料夾 `images/`：`.png`、`.pdproj.json` 新增／刪除／修改跟資料夾新增／刪除，debounce 300ms 推 `tools:images` `{dirs, changed}`（相對 `images/`；`dirs` 是要重列的資料夾＝變動的上一層，`changed` 是內容改了的檔），紙娃娃自己 `import.meta.hot.on` 收（不經過殼），見 [paperdoll-tool.md](paperdoll-tool.md)。

## 存檔廣播與未存檔

- `BroadcastChannel('tools')`，訊息 `{type:'saved', file}`，`file` 是 `public/assets/json` 底下的檔名。發送：`doc.js` 存檔後、紙娃娃「存到遊戲資料」寫了 `item.json`／`role.json` 後。
- 接收（`doc.js`）：是自己的檔且沒有未存修改 → 自動重讀；有未存修改 → 狀態列提示，存檔時照舊三方合併。角色編輯器另外在 `item.json` 存過時重抓唯讀參考資料（`loadRefs()`）。紙娃娃每次存都現讀 json，不用聽。
- 工具用 `setDirty()` 把未存狀態回報給殼（道具／角色＝`isDirty()`，紙娃娃＝專案標題有沒有 `*`），殼在分頁標籤加 ● 並統一處理關頁警告（`doc.js` 自己的 `beforeunload` 拿掉了；紙娃娃變形／像素模式中的那個還在）。

測試：`node scripts/test/tools.mjs`（OPFS 假專案丟給殼，驗證各分頁拿到資料夾、lazy 載入、hash、存檔廣播重讀／提示／合併、圓點、單獨開的提示）。
