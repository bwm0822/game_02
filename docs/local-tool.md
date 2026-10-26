# 文字工具（tools/local/）

殼的「文字」分頁，編 `public/assets/json/local.json`（UI 原文表）。殼見 [tools-shell.md](tools-shell.md)，翻譯見 [lang-tool.md](lang-tool.md)。

## 資料

- `local.json` = `{key: {lab, des?, grp?}}`，手寫來源檔（`xls/local.xlsx`、`scripts/local.js` 已不同步）。遊戲用 `'key'.lab(args)`／`'key'.des()`／`Local.name(key)` 讀，查不到 `lab` 顯示紅字 key；翻譯情境是 `ui.<key>`。
- `grp` 只給這個工具分組，遊戲跟翻譯都不讀。2026-10-26 從舊 `local.xlsx` 的分頁名一次填好：`general` 一般、`items` 道具、`jobs` 職業、`stat` 屬性、`tag` 標籤、`other` 其他、`quest` 任務、`ability` 能力樹、`option` 互動選項、`msg` 訊息（同一個 key 在多頁時取先出現的）。
- 能力分頁也寫 `local.json`（樹名 `<樹>.lab`），新增樹名時帶 `grp: "ability"`；兩個分頁同時開靠存檔廣播＋三方合併。

## 畫面

- 左欄：全部、各分組（未知的 `grp` 照原樣列、沒有 `grp` 的列在「未分組」）、「⚠ 缺少」、「未使用」。
- 表格：key、lab、des（直接編，Enter 套用並跳到下一列同一欄、Ctrl+Enter 上一列、Shift+Enter 換行、Esc 還原；改完只就地更新那一列）、分組下拉、引用數（點了看位置）、`⋯`（改名／刪除／翻譯 ↗）。清空 `des` 就拿掉欄位；沒有 `lab` 的存檔時警告。
- 搜尋 key、lab、des，跨全部分組。「＋ 新增」：key（英數字、`_`、`-`）、lab、分組（預設目前分組），新的一筆插在同組最後一筆後面。
- 存檔、undo、外部修改合併走 `tools/common/doc.js`。

## 掃描（tools/local/scan.js）

開工具、按「重新掃描」、別的分頁存了 json 時重掃。

- **引用（寬鬆）**：`src/`（不含 `src/old`、跳過 `//` 開頭的行）裡的字串字面量剛好等於 key，或 `public/assets/json/*.json`（不含 `local.json`、`textures.json`、`navgraph.json`）的值／key 剛好等於 key，就算一次。用來算引用數跟「未使用」。`` `${x}`.lab() ``、`GM.EVA.lab()` 這種動態組出來的抓不到，所以「未使用」只是參考，只標灰不刪。
- **缺少（嚴格）**：`'x'.lab()`／`'x'.des()`／`Local.lab|name|des('x')`、`role.json` 的 `job`、`ab_tree.json` 的樹名，但 `local.json` 沒有的 key。「＋ 補上」開新增框、預填 key、分組照規則猜（`_` 開頭→msg、job→jobs、樹名→ability）。
- 沒有專案根目錄（無頭測試直接給 `public/assets`）時不掃 `src/`，「未使用」不算。

## 改名、刪除

- 改名（`doc.js` 的 `rename()`）：`local.json` 的 key 原地改；**存檔後**把每個 `lang/*.json` 的情境 `ui.<舊>` 改成 `ui.<新>`（位置不變，新情境已存在就合併），並廣播讓翻譯分頁重讀，譯文不會變 orphan。改名又 undo 回來再存的不動翻譯檔（存檔時才看最終的 key 是否真的換了）。程式碼、資料 json 的引用只列不改。
- 刪除：只刪 `local.json` 那筆，翻譯檔的 `ui.<key>` 變 orphan，到翻譯分頁處理。

## 互跳

- 翻譯分頁 `ui.*` 列的 `↗` → 文字分頁：path `[key]`，切到那筆的分組、閃一下那列。
- 文字分頁 `⋯` →「翻譯 ↗」→ 翻譯分頁：path `[ui.<key>]`，翻譯分頁把它填進搜尋（清掉狀態篩選）。

## 測試

`node scripts/test/local-tool.mjs`：OPFS 假專案（含一支假的 `src/ui/x.js`），驗證讀檔／沒改就存一字不差、缺少與未使用、分組、就地編輯與 Enter 跳列、換分組、補上、改名連動翻譯檔（含 undo 不動），最後在殼裡測兩個分頁互跳。

待辦：用「未使用」跟 `items` 分組逐筆確認後清掉舊殘留（22 筆道具 id 跟 `item.json` 的 `lab` 重複、`armor`／`durability`／`conditions` 沒人用），另外 commit。
