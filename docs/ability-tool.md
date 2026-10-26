# 能力編輯器（tools/ability）

視覺化編輯技能跟技能樹。純 HTML＋JS，`npm run dev` 後開 `/tools/` 的「能力」分頁（殼見 [tools-shell.md](tools-shell.md)）。

## 資料

同時編四份手寫來源檔（`xls/ability.xlsx`／`ab_tree.xlsx`／`local.xlsx` 已不同步，`run_all` 不跑它們的轉檔腳本）：

| 檔案 | 內容 |
|---|---|
| `ability.json` | 技能本體，前置是技能自己的 `refs`（陣列，空了就整個拿掉） |
| `ab_tree.json` | `{樹 id: [{id, x, y}]}`，key 順序＝遊戲技能頁的分頁順序，x/y 是整數格 |
| `local.json` | 樹名 `<樹 id>.lab`（遊戲 `tree.lab()`） |
| `role.json` | 只在技能改名／刪除時改 `abilities` |

- undo／redo 四份一起記（整份快照，跟著記選到的樹／技能）。存檔只寫有改的檔，每份各自比對外部修改、問「合併後存檔／直接覆蓋／取消」，合併是第一層 id 的三方合併（同試穿工具）。存完廣播，角色分頁會重讀 `role.json`。
- 存檔前跑檢查，只警告不擋。
- 輸入框在 `change` 才寫入。

## 介面

- 左：樹清單（技能數、● 未存、⚠ 有警告），最下面固定一列「未分類」（不在任何樹上，`S.tree` 是 `UNCAT`），底下列出未分類的技能；點「未分類」畫布只顯示提示。搜尋時結果列在最上面，樹列照樣顯示（未分類底下不展開）。樹列右鍵：改名、上移、下移、新增樹、刪除。「＋ 新技能」放進目前的樹最下面一列的下一列、x=0（選未分類就只加技能不上樹）。
- **拖技能**（左鍵，畫布節點、左欄技能列都行，`dragAb()`）：放到畫布＝游標所在的格子（虛線框，有人的格子紅框、放了不動，畫布外夾在 0）；放到左欄樹列＝換分類，放進那棵樹最下面一列的下一列、x=0（畫布不跟著換）；放到「未分類」＝移出樹。節點拖出畫布、或從左欄拖時游標旁有影子。前置照留，跨樹的由檢查標紅。拖不到 4px 當作點一下；拖過的話接著來的 click 吃掉（300ms 內或下一次按下前），免得左欄那列被選取、畫布跳走。右鍵只跳選單。
- 中：樹畫布，照遊戲 `uiability.js` 畫（一格 50px 放大成 64px、父往下拐直角到子、有 `refs` 的技能上方一小段短線）。上方可改樹名。
  - 節點底下的藍點拉到另一個節點：被拉到的那個多一個前置。點線選取（黃色），Del 刪掉、Esc 取消。
  - 上方一行操作提示。
  - 空格右鍵：新增技能（排在 `ability.json` 裡這棵樹最後一個技能後面）、把未分類的技能放上來。節點右鍵：改名、複製（放在右邊第一個空格）、移出這棵樹、刪除。
- 右：技能表單，欄位定義在 `schema.js`（遊戲加新欄位改這裡）。顯示＝基本（lab/icon/mode/tag/des）＋有值的已知欄位，其他從「加欄位」叫出來。
  - `hits`、`effects` 一筆一張卡片（↑↓⧉×），卡片標題是一行摘要；effects 欄位沿用道具編輯器的 `EFF_FIELDS`／`EFF_BY_TYPE`／`effSummary`，多一個 `reqClass`。卡片裡 schema 沒有的 key 在「額外欄位（JSON）」。
  - `travel`／`fx`／`cast`／`zone*` 等沒列到的 key 在最下面「其他欄位」原始 JSON。
  - 前置只唯讀顯示，要在畫布拉線改。
  - 說明預覽：照遊戲 `utility.js` 的 `fmt_Des()` 展開 token，拿不到施放者屬性，所以 `{#fmt}` 顯示成公式（`10+1.5×智力`）；元素、屬性名查 `local.json` 的 `lab`。

## 檢查

- 技能：沒有 lab、icon 找不到、數字／enum／bool 欄位型別、hits/effects 不是陣列或卡片欄位型別錯、前置重複／不存在／在別棵樹／**沒有在上面**（遊戲的線只往下畫，會畫歪，線也標紅）、前置繞成一圈、不在任何一棵樹上。
- 說明 token：`{#fmt}`／`{#formula}`／`{#elm}` 的索引超出 hits 筆數（沒有 hits 的技能算 1 筆）、`{#wh}` 沒有 w/h（或 zoneW/zoneH）、其他 token 帶索引、其他 token 對應的欄位沒有值（遊戲顯示空白）。
- 樹：沒有名稱、節點指到不存在的技能、座標不是非負整數、兩個技能疊同一格、同一技能在兩棵樹。

## 改名／刪除

- 技能改名：`ability.json` 的 key（位置不變）、別人的 `refs`、樹節點、`role.json` 的 `abilities` 一起改；其他檔案用 `doc.js` 的 `scanRefsIn()` 掃（`public/assets` 的 json、`xls/`、`src/`，跳過這三份工具自己改的）只列不改。翻譯情境 `ability.<id>` 會變 orphan，跑 `node scripts/lang.js` 處理。
- 技能刪除：別人的 `refs`、樹節點、`role.json` 的 `abilities` 一起拿掉，外部引用只列。
- 樹改名：`ab_tree.json` 跟 `local.json` 的 key 一起改（`local.json` 已經有新名字就不給改），外部引用只列；翻譯情境 `ui.<樹>` 會變 orphan。
- 樹刪除：技能留在 `ability.json` 變「不在樹上」，`local.json` 的樹名一起拿掉。

## 程式結構

| 檔案 | 內容 |
|---|---|
| `schema.js` | 欄位定義（`FIELDS`、`HIT_FIELDS`、`EFF_FIELDS`、`CARDS`）、`hitSummary()`、`template()` |
| `main.js` | 多檔讀寫／undo／合併、檢查、左欄、樹畫布（拖拉、拉線、右鍵選單）、表單（卡片、說明預覽）、增刪改名 |
| `../common/doc.js` | 借用 `ID_RE`、`scanRefsIn()`（不走 `createDoc`，它只管一份檔） |

測試：`node scripts/test/ability.mjs`（透過 `window.__ab`，OPFS 假專案：讀檔、畫布節點／連線、表單改值保留 key 順序、樹名、存檔只寫有改的檔、外部修改合併、樹的檢查、拖節點、拉線／刪線、前置警告、卡片增刪、說明預覽與 token 檢查、技能／樹的增刪改名與連動）。

不做的：翻譯、技能數值試算、遊戲內實際外觀預覽。
