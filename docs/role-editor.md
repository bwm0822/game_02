# 角色編輯器（tools/role）

視覺化編輯 `public/assets/json/role.json`（手寫來源檔，沒有 xlsx）。`npm run dev` 後開 `/tools/` 的「角色」分頁（殼見 [tools-shell.md](tools-shell.md)）。核心跟道具編輯器共用 `tools/common/`，讀寫／undo／合併／收合框／JSON 框／combo 的行為都一樣，見 [item-editor.md](item-editor.md)，這裡只寫角色專屬的。

## 讀寫

- 專案資料夾由殼給（專案根目錄，自動找 `public/assets`），改名／刪除會一起掃 `src/`。
- 唯讀參考資料走 dev server（不經資料夾 handle）：`item.json`（道具名、裝備圖）、`ability.json`（技能）、`navgraph.json`（作息的地圖／目的地）、`com_ai.js?raw`（性格）。殼裡別的分頁存了 `item.json` 會自動重抓；其他的改了要重新整理頁面。
- 存檔前三方合併：紙娃娃之後會「存到 role.json」（body/head/hand 擺放），合併是角色層級。

## 介面

- 左：清單依 `kind` 分組（玩家、NPC、盜賊、怪物、動物、頭目、無分類），NPC 再依 `loc` 分組，每組可收合（見 [tools-shell.md](tools-shell.md) 的 `fold.js`）。`kind`／`loc` 只給編輯器分類，遊戲不讀。
- 表單（`schema.js`）分「基本／戰鬥／外觀／物品／作息」幾段；顯示的欄位＝基本＋該 kind 建議的（`KIND_FIELDS`）＋已經有值的，其他從「加欄位」叫出來。遊戲沒在讀的 `stats`/`states`/`weapon`/`type` 不在 schema 裡，放最下面「其他欄位」原樣保留。
  - 性格 `style` 的選項從 `com_ai.js` 的 `wTBL` 解析（註解掉的不算，行尾註解當說明），不在表上的會警告「遊戲會當成 passive_fighter」。
  - 物品欄：`inv.storage.capacity`（-1 = 無限）、`inv.storage.items`（道具格子，有數量）、`inv.equips`（裝備格子）。**保留原寫法**：字串留字串，數量改成不是 1 才變 `{id, count}`；物件留物件。格子打 id 有道具清單可選，不存在的道具格子標紅。
  - 作息：一筆一張卡片，標題是一行摘要。時間分「出發 HH:MM／抵達 @HH:MM」；地圖、目的地的選項來自 `navgraph.json`（節點 key `地圖:物件`），目的地只列該地圖的物件；活動選巡邏才出現路線（逗號分隔、可重複）跟停留。路網沒有的地圖／物件、時間格式錯、巡邏沒 route 都會警告（新地圖要先跑 `node scripts/navgraph.js`）。
- 右側固定的靜態合成預覽（`preview.js`）：照 `RoleView` 的規則畫——view 中心＝錨點 −`anchor`，部件放在 view 中心 +(x, y)、origin `(ox ?? 0.5, oy ?? 1)`、`scale`、角度 `a`，依 depth 疊（body 0、胸甲／靴 1、head 2、hair 2.5、頭盔 3、武器 4、hand 5、手套／ext 6，同 `_addPart`）；裝備從 `inv.equips` 查 `item.json` 的 `equip`，有一件 `equip.hideHair` 就不畫 hair。虛線是 view（w×h），黃十字是錨點，紅／綠／藍框是物理 b／佔格 g／互動區 z（算法同 `View._resolveAxis`）。可切換框、裝備、翻面、放大倍率（記在頁面，換角色保留）。不播動畫、不打光。
- 總覽：全部＋6 個 kind 共 7 頁，欄位可以是 `attrs.atk` 這種路徑；NPC 頁有地點篩選。

## 新增／複製／改名／刪除

- 新角色：輸入 id 跟 kind，套 `template(kind)`（人形或獸形的外觀＋該 kind 常用欄位），排在同 kind 最後；要照現有角色改就用「複製」。
- role.json 裡沒有角色互相引用的欄位，改名只動 key；其他地方（`story.json` 的 who、`dialog.json` 的 NPC key、Tiled 地圖、`src/` 寫死的 id…）只列不改。改名會讓翻譯情境 `role.<id>` 變 orphan，到翻譯分頁處理（[lang-tool.md](lang-tool.md)）。

## 檢查

`lab`、`w`/`h`/`anchor`（RoleView 直接讀，沒有會出錯）、數字／布林型別、kind、style、sprite／icon 在 textures.json、`meat`/`skin`/物品欄／裝備的道具存在（裝備還要有 `equip`）、物品數超過容量、技能存在、作息（上面）。只警告不擋存檔。

## 程式結構

| 檔案 | 內容 |
|---|---|
| `schema.js` | 欄位定義（`FIELDS`、`SECTIONS`、`KIND_FIELDS`、`STYLES`、`TABS`、`DEPTH`）、`template()`、`schSummary()` |
| `preview.js` | 靜態合成預覽 `previewEl(role, items)` |
| `main.js` | 檢查、表單（物品欄格子、作息卡片）、清單分組、總覽表、新增 |
| `role.css` | 預覽、分段標題、道具格子 |

測試：`node scripts/test/role.mjs`（OPFS 當假的專案根目錄，含 `src/`：原樣往返、根目錄模式、物品欄寫法保留、作息增刪與檢查、預覽有畫出部件與裝備、改名掃 assets/src、新增範本、分組、總覽與地點篩選、合併）。

不做的：翻譯（`lab`/`des` 的譯文在翻譯分頁編，見 [lang-tool.md](lang-tool.md)）、改其他檔案的引用、預覽動畫／打光、調零件擺放（用試穿分頁調數字，見 [fit-tool.md](fit-tool.md)）。
