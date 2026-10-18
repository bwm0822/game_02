# CLAUDE.md

## 專案概覽

以 **Phaser 3** 和 **Vite** 為基礎的 2D RPG 瀏覽器遊戲，支援 Electron 桌面版本打包。

## 建置與開發指令

```bash
# 啟動開發伺服器（含 log.js，port 8080）
npm run dev

# 啟動開發伺服器（含 Electron 視窗）
npm run dev-app

# 啟動開發伺服器（不含 log.js）
npm run dev-nolog

# 生產版建置（輸出至 dist/）
npm run build

# 建置 Electron 應用程式版本
npm run build-app

# 打包 Electron 安裝檔
npm run dist

# 部署至 GitHub Pages
npm run deploy

# 無頭瀏覽器測試（自己開 vite + 無頭 Chrome，只印 ✔/✘，失敗時截圖到 scripts/test/out/）
node scripts/test/rogue.mjs     # 另有 events.mjs（事件卡）、dialog.mjs（_common/line/n_cold）、approach.mjs（see/approach）、wolf.mjs（狼患岔路）、lang.mjs（多國語言 tr()/qps）、paperdoll.mjs（紙娃娃編輯器）、item.mjs（道具編輯器）
```

無頭測試：`scripts/test/harness.mjs` 提供 `newGame()`／`gotoMap()`／`talk()`／`kill()`／`give()`／`q()` 等工具，透過 `src/main.js` 只在開發版掛的 `window.__dbg` 操作遊戲（不走路、不戰鬥，直接呼叫遊戲函式）；角色在 `scene.roles`、其他物件在 `scene.gos`，工具裡的 `d.objs()` 兩者都包含。用的是電腦裡現有的 Chrome（`puppeteer-core`，不下載 Chromium）。改了劇情、地圖生成相關的東西後，優先跑對應的測試而不是請使用者手動玩。

## 目錄結構

```
src/
  core/         # 核心工具：gameobject、event、setting、debug、tilemap、combat
  scenes/       # Phaser 場景：Boot, Preloader, MainMenu, Game, GameMap, GameArea, UI, Top
  components/   # 可組合元件：ai/、sleep、door、port、stats、anim 等
  ui/           # UI 類別與面板：uiclass、uiinfo、uiinv、uiprofile、uitrade 等
  roles/        # 角色類別（繼承 GameObject）
  items/        # 地圖物件類別（bed、door、port、well 等）
  manager/      # 管理器：quest、audio、minimap、schedule
  systems/      # 系統：time
  services/     # 服務：dragService、pressService
  infra/        # 基礎設施：record（存讀檔）、local（localStorage）
  data/         # 靜態資料：db.js（集中載入 JSON 資料）
  old/          # 廢棄程式碼（勿修改、勿引用）

public/         # 靜態資源（圖片、音效、地圖、JSON 資料）
vite/           # Vite 設定檔（config.dev.mjs、config.prod.mjs、config.prod_app.mjs）
electron/       # Electron 主程序
dist/           # 建置輸出（勿手動修改）
```

## 架構重點

### GameObject（src/core/gameobject.js）
遊戲場景中所有物件的基底類別，繼承自 `Phaser.GameObjects.Container`。

- `_coms`：元件庫，透過 `addCom()` 掛載行為元件
- `_bb`（blackboard）：元件之間的共享資料中心
- `uid`：由 `map.createMap()` 自動設定；`-1` 表示玩家
- `ctx`：傳遞給元件的上下文物件（含 `root`、`bb`、`scene`）

### 元件系統（src/components/）
功能以元件形式附加在 `GameObject` 上，例如 AI、睡眠、製造、感知等。元件透過 `bb`（blackboard）共享資料，不直接耦合。
- com 之間禁止互相 import；要用其他元件的功能，由該元件在 `bind()` 掛到 root（`root.xxx = ...`），呼叫端走 `this.root.xxx()`
- com 以外的程式（ui、scene、manager…）禁止 import com，一律透過 GameObject 呼叫（如 `GM.player.xxx()`）；唯一例外是 `roles/`、`items/` 這些組裝者 import `COM_*` 來 `addCom()`

### 場景流程
`Boot` → `Preloader` → `MainMenu` → `Game`（讀取存檔）→ `GameMap` 或 `GameArea`  
`UI` 和 `Top` 場景與遊戲場景並行運作（`scene.launch()`）。

### 資料（src/data/db.js）
所有 JSON 資料（item、role、dialog、quest、skill、sk_tree）在 `Preloader` 載入後，統一由 `DB.load(scene)` 解析。

### 存讀檔（src/infra/record.js）
`Record.loadGame()` 在 `Game` 場景執行一次，其他場景不需重複呼叫。存檔資料存於 `localStorage`。

## 代碼規範

- **語言**：JavaScript ES Module（`type: "module"`），禁止使用 CommonJS
- **類別命名**：PascalCase（`class GameMap`、`class UiProfile`）
- **檔案命名**：小寫無底線（`uiprofile.js`、`gameobject.js`）；UI 檔以 `ui` 開頭
- **場景類別**：放於 `src/scenes/`，名稱以大寫字母開頭
- **UI 類別**：放於 `src/ui/`，繼承自 `src/ui/uiframe.js` 的 `UiFrame` 基底類別（`uicommon.js` 的 `Ui` 是靜態全域註冊表，非繼承用基底類別）；修改或新增 UI 面板前請先參考 [docs/ui-architecture.md](docs/ui-architecture.md)
- **Story（storylet + quality，取代 Quest/Dialog 中）**：劇情狀態統一存在 quality 庫（`src/systems/quality.js`，`Record.game.q`），條件／指令由 `src/systems/script.js` 共用；quality 名稱要先在 `xls/story.xlsx` 的 `qualities` sheet 宣告，`node scripts/story.js` 轉成 `story.json` 並檢查未宣告名稱／節點／who；任務（thread 日誌）、對話卡、事件卡都寫在 `xls/story.xlsx`（一條劇情線一個 sheet），執行期是 `src/systems/story.js`（`Story`），舊的 QuestManager/quest.xlsx 已退休；分 5 階段實作（已全部完成），修改任務、對話、好感度或劇情相關程式碼前請先參考 [docs/story-architecture.md](docs/story-architecture.md)
- **Dialog**：資料為 `public/assets/json/dialog.json`（由 `xls/dialog.xlsx` 透過 `node scripts/dialog.js` 產生，非 npm script，要在 `scripts/story.js` 之前跑）；對話元件為 `com_talk.js`（`COM_Talk`），會把 story 的對話卡插進 entry 節點；`_common` sheet 是所有 NPC 共用的節點與 rule-based 台詞（`line`，`src/systems/line.js`），格式見 [docs/story-architecture.md §6](docs/story-architecture.md)，xlsx 樣式規範見 [docs/quest-dialog-architecture.md §8](docs/quest-dialog-architecture.md)
- **地圖邊界出口**：`public/assets/maps/main.world`（Tiled World 檔）定義地圖間的相對座標，`GameScene.js` 的 `_createEdgeExits()`/`_findAdjacentMap()` 依此在地圖邊界建立可點擊的 `Port` 出口物件（點擊觸發切換，不是自動偵測）；修改邊界轉場邏輯前請先參考 [docs/map-seamless-transition.md](docs/map-seamless-transition.md)
- **總覽地圖（縮圖拼接）**：選單「地圖」頁籤（`PMap`）用 `scripts/minimap.js` 產生的各地圖縮圖，依 `main.world` 座標合成顯示（`MiniMap`），不是獨立設計的地圖；修改總覽地圖顯示或縮圖產生流程前請先參考 [docs/minimap-overview.md](docs/minimap-overview.md)
- **存讀檔**：`Record.game.scenes` 分 `prefab`（Tiled 物件層、固定 uid）跟 `runtime`（動態建立、`uid===-1`，用陣列)兩種資料；修改存讀檔相關程式碼前請先參考 [docs/record-save-architecture.md](docs/record-save-architecture.md)
- **戰鬥系統**：傷害公式在 `src/core/combat.js`（`computeDamage()`）、屬性計算在 `src/components/com_stats.js`（`getTotalStats()`）、技能資料為 `public/assets/json/ability.json`（`DB.ability()`，目前只有 `fireball`/`firewall` 有完整戰鬥數值，其餘是文案佔位）；修改戰鬥相關程式碼前請先參考 [docs/combat-architecture.md](docs/combat-architecture.md)
- **Ability**：`ability.json` 跟 quest/dialog 一樣是產出檔，來源是 `xls/ability.xlsx`（多分頁：general/sword/archery/fire/ice/poison/support/enhancement），透過 `node scripts/ability.js` 產生（非 npm script）；xlsx 的 `meta` 欄位是物件字面量字串，轉檔時會展開合併進技能物件最上層（`cd`/`range`/`pow`/`flat`/`elm`/`src`/`sprite`/`cast` 等純量或物件欄位都走這裡），新增這類欄位優先塞進 `meta`、不要新開 xlsx 欄位（除非是 `icon`/`type`/`tag` 這種每筆都會填的簡單字串欄，才需要改 `scripts/ability.js` 的 `STR_COLS`）；程式編輯這份 xlsx 一律用 `exceljs` 寫入，不要用 `xlsx`（SheetJS），理由同 [quest-dialog-architecture.md §8](docs/quest-dialog-architecture.md) 提到的 `zeroHeight` corruption 問題
- **狀態特效（buff/dot…）**：`public/assets/json/fx.json` 是產出檔，來源 `xls/fx.xlsx`，透過 `node scripts/fx.js` 產生；依 effect 的 `id` 查表（`DB.fx(id)`，查不到就不顯示），欄位 `img`/`cell`/`spawn`/`idle`/`tick`/`end`/`body`，後五者是 Phaser tween 設定（`body` 套在角色身體 `view.shape` 上，目前只支援 `angle`，以 view 底部為支點轉，特效結束時轉回 0、位置歸位）；`cell.flash:true` 的特效不常駐，只在 `fxTick`（DOT/HOT 扣血那一下）時臨時播 spawn→tick→end，並併入 `root.wait()` 一起等；單格動畫共用 `src/core/fxcell.js`（`FxCell`，火牆 `ZoneView` 也用它）
- **NPC 作息**：`role.json` 的 `schedule` 是「時間（`HH:MM` 出發 / `@HH:MM` 抵達）→ `map`+`go` 目的地」，路線由 `scripts/navgraph.js` 產生的 `navgraph.json` 算（改了 Tiled 地圖要重跑）；`ScheduleManager` 在背景推進所有 NPC 的抽象狀態（`Record.game.schedule`），NPC 在玩家地圖時才由 `COM_Schedule` 實體負責走路；修改作息相關程式碼前請先參考 [docs/schedule-architecture.md](docs/schedule-architecture.md)
- **NPC AI**：`src/components/ai/` 的 `COM_AI` 每回合讓各 `Beh*` 用 `score()` 評分、取最高分的那個執行 `act()`（平手時陣列中排前面的贏）；感知是 `COM_Sense` 寫入 `bb.sensePlayer`；性格權重依 `role.json` 的 `style`，動物用 `animal:true`（不會開門）；行為裡移動用 `findPath`+`move`，不用 `cmd_move`，而且要處理 `PATH.NONE`（沒有 `pts`）；修改 AI 相關程式碼前請先參考 [docs/ai-architecture.md](docs/ai-architecture.md)
- **多國語言**：資料 xlsx 只寫原文（中文），顯示文字一律走 `tr(情境, 原文, args)`（`src/infra/lang.js`）或 `'key'.lab()`（local.xlsx）；識別字（quality、節點、storylet、spawn…）一律 ASCII；開發版設定頁可切偽語系 `qps` 抓爆版與漏接；譯文在 `xls/lang/<lang>.xlsx`（人只填「譯文」「審核」欄），`node scripts/lang.js` 抽原文、merge、產出 `public/assets/lang/<lang>.json`（run_all 最後一步；`--add <lang>` 加語言、`--prune` 刪 orphan）；分階段實作中，修改顯示文字或語言相關程式碼前請先參考 [docs/i18n-architecture.md](docs/i18n-architecture.md)
- **紙娃娃編輯器**：`tools/paperdoll/`（純 HTML + Canvas 2D，`npm run dev` 後開 `/tools/paperdoll/`）調整零件圖的裁切／縮放／透明清除，裝備的擺放數字由存檔對話框「存到 item.json」直接寫進 `item.json` 的 `equip`（PNG 同時覆蓋 `roles_64x64/`），其他零件存成同名 `.json` 給人抄進 `role.xlsx`；**`item.json` 是手寫來源檔**，`run_all` 不跑 `scripts/item.js`，`xls/item.xlsx` 已不同步，其他欄位用道具編輯器改；遊戲零件的 origin 讀 `part.ox ?? 0.5`、`part.oy ?? 1`；修改前請先參考 [docs/paperdoll-tool.md](docs/paperdoll-tool.md)
- **道具編輯器**：`tools/item/`（`npm run dev` 後開 `/tools/item/`）視覺化編輯 `item.json`，欄位定義在 `tools/item/schema.js`（遊戲加新欄位改這裡，沒列到的 key 會原樣保留），icon 選圖器解析 `Preloader.js`；存檔保留 key 順序、存前偵測外部修改做道具層級合併、檢查只警告不擋；`tools/common/fs.js` 跟紙娃娃共用；修改前請先參考 [docs/item-editor.md](docs/item-editor.md)
- **全域常數**：集中定義於 `src/core/setting.js`（`GM`、`ORDER`、`UI` 等）
- **Debug 輸出**：使用 `dlog(tag, ...)` 搭配 `T` 旗標（定義於 `src/core/debug.js`）；正式版不留 `console.log`
- **`src/old/`**：廢棄程式碼，不可引用也不可修改
- **不寫多餘的 comments**：除非有隱藏的約束或不直覺的行為，否則不加註解

## 主要依賴

| 套件 | 用途 |
|------|------|
| `phaser` ^3.86 | 遊戲引擎 |
| `phaser3-rex-plugins` ^1.80 | UI plugin、BBCode text、行為元件 |
| `vite` ^5.3 | 打包工具（開發 / 生產） |
| `electron` ^35 | 桌面版打包 |
| `electron-builder` ^26 | Electron 安裝檔產生 |
| `gh-pages` ^6 | GitHub Pages 部署 |
