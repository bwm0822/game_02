# 道具編輯器（tools/item）

視覺化編輯 `public/assets/json/item.json`（手寫來源檔，沒有 xlsx）。純 HTML＋JS，`npm run dev` 後開 `/tools/item/`。

## 讀寫

- 上方「選擇遊戲資料夾」選 `public/assets`，handle 存在 IndexedDB `item`（跟紙娃娃分開），Chrome 重開後按「重新授權」。
- Ctrl+S 存檔，整份 `JSON.stringify(items, null, 2)`（沒有結尾換行，跟紙娃娃同格式）；沒改就存檔內容一字不差。
- key 順序保留：改值不動位置、新 key 接在物件最後、清空的欄位整個刪 key，刪完變空的子物件（`cook: {}`）也一起刪。
- 存檔前重新讀檔，跟上次讀／存時的原文比；被改過（例如紙娃娃「存到 item.json」）就問「合併後存檔／直接覆蓋／取消」。合併是**道具層級**三方合併：只有一邊改的取那邊，兩邊都改的以編輯器為準並列出來。
- 存檔前跑檢查，有問題列出來但**只警告、仍然可以存**（暫定值常是故意的）。
- undo／redo（Ctrl+Z／Y，焦點在輸入框時交給瀏覽器）是整份快照，跨道具、只在記憶體。清單上 ● 是未存檔、⚠ 是有警告；有未存檔修改時關分頁會擋。
- 輸入框在 `change`（離開或 Enter）才寫入，一次修改一步 undo。

## 介面

- 左：依 cat 分組的清單（可搜尋 id／名稱）、＋新道具。
- 表單：依 `schema.js` 畫。顯示的欄位＝基本（lab/cat/icon/gold/des）＋該 cat 建議的＋已經有值的已知欄位；其他已知欄位從「加欄位」叫出來。
  - `obj` 欄位（equip/drop/light/cook/make/device）是一個框，子欄位之外的 key（`swing`、`ext`…）放框裡的「其他」JSON。
  - effects 一條一張卡片：標題是 `effSummary()` 的一行人話（不是遊戲內說明文字），欄位依 `type` 決定（`EFF_BY_TYPE`），schema 沒有的 key 在「額外欄位（JSON）」。
  - 最下面「其他欄位」是道具層級不認識的 key（`bb` 等）的原始 JSON，JSON 格式錯就不套用。
  - 這三種 JSON 框都是 `jsonedit.js`（透明 textarea 疊在上色的 `<pre>` 上，不用套件）：打字即時解析，只把第一個出錯的 token 標紅、原因在 title；裸 key 跟結尾逗號不算錯（打 `:` 時裸 key 自動補引號、字串外打 `'` 換成 `"`），失焦沒錯才套用並整理成標準 JSON；有錯就把原文留在 `S.drafts`（重繪不會不見、框角標「未套用」、存檔時警告），換道具就丟掉。按鍵輔助一律走 `execCommand('insertText')`，Ctrl+Z 才退得回去。
- 總覽：依 `TABS` 分頁籤，欄位跟著頁籤變；點標題排序（升→降→取消），雙擊格子直接改，點 icon 開選圖器，點 id 跳回表單。
- icon／sprite 選圖器：`icons.js` 用 `?raw` 讀 `src/scenes/Preloader.js`，解析 `load.image`／`load.spritesheet`（frameWidth/Height、margin、spacing）／`load.atlas`，註解掉的行不算；新增 sheet 不用改工具。四種寫法：`sheet:格子`、單張圖 key、相對 `public/assets` 的路徑（含 `/`）、emoji（不是 ASCII 識別字就當文字）。atlas 只認 key 不畫圖。圖走 dev server 的 `/assets/…`，不經資料夾 handle。

## 新增／複製／改名／刪除

- 新道具：輸入 id（英數字、底線、減號）和 cat，套 `template(cat)`，排在**同 cat 最後一個的後面**。
- 複製：`<id>_copy`（重複就加數字），排在原道具後面。
- 改名、刪除前掃 `public/assets` 底下所有 `.json/.world/.tmj/.tsj`（`json/item.json` 除外），id 以獨立單字出現（前後不是 `\w`）在字串值或 key 裡都列出來，所以 `item.raw_meat`、`has:raw_meat:2` 會中、`raw_meat_2` 不會；`icons_atlas.json` 這種同名 frame 也會列，自己判斷。
- 改名時 item.json 裡的引用（`ITEM_REFS`：`cook.id`、`bb.harvest.id`、`make.items` 的 key）一起改，其他檔案只列不改（很多是 xlsx 轉出來的產出檔，改了下次轉檔會被蓋）。改名也會讓翻譯的情境 `item.<id>` 變 orphan，要跑 `node scripts/lang.js` 後到 en.xlsx 處理。
- 刪除不改任何引用，只列出來。

## 檢查（validate）

數字欄位不是數字／該整數不是整數、enum 不認識的值、`itemref`／`make.items`／`bb.harvest.id` 指到不存在的道具、icon／sprite 的 key 沒在 Preloader、sheet 格子超出範圍（圖載完才判斷）、路徑圖載入失敗、有 cat 卻沒 lab／icon。

## 程式結構

| 檔案 | 內容 |
|---|---|
| `schema.js` | 欄位定義（`FIELDS`、`CAT_FIELDS`、`EFF_FIELDS`、`EFF_BY_TYPE`、`TABS`、`ITEM_REFS`、`template`）、`effSummary()`；遊戲加了新欄位改這裡 |
| `icons.js` | 解析 Preloader、`resolve()`／`check()`／`iconEl()`、選圖器 `pickIcon()` |
| `main.js` | 狀態、undo、讀寫與合併、檢查、表單、總覽表、清單、新增／改名／刪除 |
| `../common/fs.js` | 跟紙娃娃共用的 File System Access 工具（`dirStore(app)`） |

測試：`node scripts/test/item.mjs`（透過 `window.__ie`，OPFS 當假的 `public/assets`：原樣往返、key 順序、清空刪 key、undo/redo、effects 增刪、未知欄位保留、改名連動與引用掃描、刪除、新增位置、複製、檢查只警告、外部修改合併、Preloader 解析、總覽表）。

不做的：翻譯（`lab`/`des` 的譯文還是 `xls/lang/en.xlsx`＋`scripts/lang.js`）、裝備疊圖預覽（紙娃娃的事）、改其他 json、自動改外部引用。
