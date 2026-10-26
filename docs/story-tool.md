# 任務／對話工具（tools/story、tools/dialog）

視覺化編輯 `public/assets/json/story.json`（任務分頁）跟 `dialog.json`（對話分頁），兩個都是手寫來源檔（xlsx 已刪除）。資料格式見 [story-architecture.md](story-architecture.md) §5、§6。`npm run dev` 後開 `/tools/#story`、`/tools/#dialog`（殼見 [tools-shell.md](tools-shell.md)）。讀寫／undo／三方合併沿用 `tools/common/doc.js`，跟道具、角色編輯器一樣，見 [item-editor.md](item-editor.md)。

## 讀寫

- 任務分頁用 `doc.js` 的 `decode`／`encode`，把 story.json 攤成 `{@qualities, <劇情線>...}` 來編，undo、存檔前三方合併都以劇情線（跟整份 qualities）為單位；存檔照原結構寫回 `{qualities, lines}`。
- 對話分頁的 dialog.json 本來就是 `{_common, <npc>...}`，直接用。
- 唯讀參考資料走 dev server：`role.json`、`item.json`、`navgraph.json`（地圖清單），還有**另一個分頁的檔案**（任務分頁讀 dialog.json、對話分頁讀 story.json），用來檢查跟列出節點。殼裡別的分頁存了這幾個檔就自動重抓。

## 介面

### 任務分頁

- 左欄：「quality 宣告」加上各劇情線。
- quality 宣告頁：一個 quality 一列（名稱、scope、預設、show、顯示名稱），名稱可以改名（見下面「改名」）。
- 劇情線一頁，由上到下：
  - **任務日誌**（threads）：標題、說明、quality，加上「值 → 日誌／地圖／結束／獎勵提示」表格。
  - **劇情卡**（storylets）：一張卡收成一列摘要（對話／事件、who、label 或 text），點開才是表單；可以上移、下移、複製、刪除。事件卡不顯示 label／hint／mood。
  - **長對話節點**：照 NPC 分，用共用節點編輯器。
  - **spawn**：`@群組` 加出現條件。
- 總覽：劇情線各有幾個 thread／卡／節點／spawn。

### 對話分頁

- 左欄：`_common`、有自己對話的 NPC，還有「只用 _common」的 unique NPC。選後者會顯示「建立這個 NPC 自己的對話」按鈕，按了就新增一個空的 `{}`。
- 一頁：
  - **入口**（entries）：自己的入口，加上沿用 `_common` 的（灰色、唯讀，同節點的用自己的）。
  - **台詞**（lines）。
  - **節點**：同名節點會蓋過 `_common` 的，沿用的節點列成小標籤，點名字跳到 `_common` 那個節點，按「覆寫」會複製一份到這個 NPC 身上。
  - **加掛選項**（extend）。
  - **劇情**：story.json 裡 who 對到這個 NPC（含 `job:`、`*`）的劇情卡，以及這個 NPC 的長對話節點；唯讀，點了跳到任務分頁。

### 共用（`tools/common/storyform.js`）

- **節點編輯器**：台詞（`{條件: 台詞}` 一句一列，條件空白＝無條件）、進入時（actions）、沿用（next）、選項表格（文字／條件／做什麼／接著到／排序）、離開時（posts）。對話分頁還多 cards、mood 兩欄，任務分頁的節點有值時才顯示。
- **條件、指令欄**：純文字，指令一行一個（存成陣列）。用 `combo.js` 的 `data-expr` 模式自動完成，只補游標前那個字：打字就開清單，Ctrl+空白鍵也能開，Tab／Enter 選。清單內容有 quality、`<npc>.favor`、情境事實、`item:<id>:1`、`kill.<id>`、指令（give/take/count/stop/trade/close/goto/approach、gold+）、道具 id、節點 id。
- **連結**：`next`、`@節點`、entry 旁邊的「→」會跳到節點。節點在同一個檔案就直接跳；在另一個檔案就切到另一個分頁跳過去（`shell.js` 的 `gotoTab`／`onGoto`，殼轉送；分頁還沒載入就等它 ready 再送）。
- **檢查**：每次重畫都跑 `src/data/storycheck.js` 的 `checkStory()`，結果分兩處顯示：
  - 欄位標紅框（錯誤）或黃框（警告）。欄位找不到就往上一層標，例如收起來的卡片、整個 effects 框；欄位的 `data-k` 是資料路徑的 JSON 字串。
  - 底部檢查面板列出全部結果，點一下會展開路徑上的每一層、捲過去並閃一下。另一個檔案的問題點了就跳到另一個分頁。
  - 跟其他編輯器一樣只警告、不擋存檔。spawn 對不上地圖圖層只在 `node scripts/story.js` 檢查。

## 改名

`tools/common/storyrename.js`（純函式）走訪條件、指令、next、entry、extend、`@節點`、thread.quality、日誌的 `{佔位符}`，用 token 比對，所以 `wolf_hunt` 不會誤改到 `wolf_hunt.kills`、`@n_x`、`item:x:1`。

- **quality**：條件、指令裡的名稱一起改；scope=npc 的話，`<npc>.名稱` 也一起改。
- **節點**：引用只算同一個 NPC 情境下的（storylet 的 who、節點所屬的 NPC）。對話分頁改 `_common` 的節點時，所有「沒有自己同名節點」的 NPC 的引用都會一起改。
- **spawn 群組**：story.json 裡沒有引用，地圖的 `@群組` 圖層只列出來。
- 改名前會先跳確認框，列出這個檔案裡會一起改的地方，以及其他檔案（`doc.js` 的 `scanRefs`：public/assets 底下的 json、`src/`）裡只列不改的引用。確定之後整個改名是一步 undo。
- 劇情線、thread、storylet 的 id 只改 key（沒有別的資料引用它們；劇情線 id 用 `doc.js` 的改名）。改名之後漏掉的引用，檢查面板會抓出來。

## 程式結構

| 檔案 | 內容 |
|---|---|
| `tools/story/main.js` | 任務分頁：decode/encode、quality 宣告頁、thread／劇情卡／spawn 表單、新增、改名接線 |
| `tools/dialog/main.js` | 對話分頁：入口／台詞／節點／加掛選項、沿用 `_common`、唯讀劇情區、建立 NPC 對話 |
| `tools/common/storyform.js` | 參考資料、自動完成清單、輸入框、節點編輯器、`markIssues`、`jumpTo`、`listenGoto`、`renderChecks`、`renameWithRefs` |
| `tools/common/storyrename.js` | 改名的引用改寫（`rewriteStory`／`rewriteDialog`、`qualityRenamer`、`nodeRenamer`） |
| `tools/common/story.css` | 兩個分頁共用的樣式 |
| `src/data/storydata.js` | 執行期的攤平、合併（工具也用來算節點清單） |
| `src/data/storycheck.js` | 靜態檢查 |

測試：`node scripts/test/story-tool.mjs`（原樣往返、標紅、面板跳轉、`@節點` 連結、節點／選項編輯與 undo、新增卡、自動完成、三方合併、quality／節點／spawn 改名）、`node scripts/test/dialog-tool.mjs`（原樣往返、沿用 `_common` 的入口與節點、覆寫、加掛選項、建立 NPC 對話、`_common` 節點改名、殼裡任務↔對話互跳）。

不做的：試玩模擬器（之後的待辦，要測流程就進遊戲用 debug 的 `q` 指令）、翻譯（譯文在翻譯分頁編，見 [lang-tool.md](lang-tool.md)）、改其他檔案的引用、節點圖。
