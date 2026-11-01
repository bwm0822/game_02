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
node scripts/test/rogue.mjs     # 另有 textures.mjs（自動載圖）、events.mjs（事件卡）、dialog.mjs（_common/line/n_cold）、approach.mjs（see/approach）、wolf.mjs（狼患岔路）、lang.mjs（多國語言 tr()/qps）、paperdoll.mjs（紙娃娃編輯器）、item.mjs（道具編輯器）、role.mjs（角色編輯器）、ability.mjs（能力編輯器）、fx-tool.mjs（特效工具）、fit.mjs（試穿／動畫分頁）、anim.mjs（遊戲裡播武器動畫）、tools.mjs（工具殼接線、左欄寬度）、debuger.mjs（除錯面板指令表單）、prompt.mjs（提示詞工具）、story-tool.mjs（任務編輯器）、dialog-tool.mjs（對話編輯器＋殼裡互跳）、lang-tool.mjs（翻譯工具＋↗ 跳來源分頁）、local-tool.mjs（文字工具）、texture.mjs（圖片工具）、settings.mjs（設定分頁）、select.mjs（選角）、part.mjs（部位 part.json、藏部位規則）、role-part.mjs（角色編輯器的部位選圖器／由頭髮產生）、part-tool.mjs（部位分頁）、sex.mjs（道具／部位 sex 限定）
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

public/         # 靜態資源（音效、地圖、JSON 資料）
  assets/textures/  # 所有圖檔：icons/props/natures/equips/items/roles{parts,npcs,monsters,animals,boss}/others、maps/{tiles,buildings}；
                    # 第三方素材包保留包資料夾（如 items/32rogues/）；minimap/ 是 scripts/minimap.js 產出；
                    # .tbd/ 放沒用到的圖（保留原相對路徑，prod build 由 vite/droptbd.mjs 刪掉不打包）
                    # texture key 一律是檔名（去副檔名），整個 textures/（含 maps/、不含 .tbd/、minimap/）不能撞名；資料只寫 key 不寫路徑
  assets/tilesets/  # Tiled 外部 tileset（*.tsj）：圖片來源＋格子屬性 collide/weight/block；image 相對 .tsj（../textures/...），
                    # src/core/tilemap.js 解析成相對 assets 的路徑（Phaser 不支援外部 tileset 跟 template，由 tilemap.js 合併）
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
- **Story（storylet + quality，取代 Quest/Dialog 中）**：劇情狀態統一存在 quality 庫（`src/systems/quality.js`，`Record.game.q`），條件／指令由 `src/systems/script.js` 共用；**`story.json` 是手寫來源檔**（`{qualities, lines:{<劇情線>:{title, threads, storylets, nodes, spawns}}}`，`DB.load` 用 `src/data/storydata.js` 的 `flattenStory()` 攤平；xlsx 已刪除），quality 名稱要先在 `qualities` 宣告，`node scripts/story.js` 只做靜態檢查（邏輯在 `src/data/storycheck.js`，工具共用）；任務（thread 日誌）、對話卡、事件卡都寫在劇情線裡，執行期是 `src/systems/story.js`（`Story`），舊的 QuestManager/quest.xlsx 已退休；分 5 階段實作（已全部完成），修改任務、對話、好感度或劇情相關程式碼前請先參考 [docs/story-architecture.md](docs/story-architecture.md)
- **Dialog**：**`public/assets/json/dialog.json` 是手寫來源檔**（合併前的 `{_common, <npc>:{entries, lines, nodes, extend}}`，`DB.load` 用 `mergeDialog()` 合併 `_common`、算翻譯 `ctx`；`scripts/lang.js`／翻譯工具也用同一支）；對話元件為 `com_talk.js`（`COM_Talk`），會把 story 的對話卡插進 entry 節點；`_common` 是所有 NPC 共用的節點與 rule-based 台詞（`line`，`src/systems/line.js`），格式見 [docs/story-architecture.md §6](docs/story-architecture.md)
- **任務／對話工具**：`tools/story/`（殼的「任務」分頁，編 story.json）、`tools/dialog/`（「對話」分頁，編 dialog.json），共用 `tools/common/storyform.js`（節點編輯器、條件／指令自動完成 `combo.js` 的 `data-expr`、`checkStory()` 欄位標紅＋底部檢查面板、`shell.js` 的 `gotoTab` 跨分頁跳）；改名用 `tools/common/storyrename.js` 連帶改同檔引用（token 比對），其他檔案只列；修改前請先參考 [docs/story-tool.md](docs/story-tool.md)
- **地圖邊界出口**：`public/assets/maps/main.world`（Tiled World 檔）定義地圖間的相對座標，`GameScene.js` 的 `_createEdgeExits()`/`_findAdjacentMap()` 依此在地圖邊界建立可點擊的 `Port` 出口物件（點擊觸發切換，不是自動偵測）；修改邊界轉場邏輯前請先參考 [docs/map-seamless-transition.md](docs/map-seamless-transition.md)
- **總覽地圖（縮圖拼接）**：選單「地圖」頁籤（`PMap`）用 `scripts/minimap.js` 產生的各地圖縮圖，依 `main.world` 座標合成顯示（`MiniMap`），不是獨立設計的地圖；修改總覽地圖顯示或縮圖產生流程前請先參考 [docs/minimap-overview.md](docs/minimap-overview.md)
- **存讀檔**：`Record.game.scenes` 分 `prefab`（Tiled 物件層、固定 uid）跟 `runtime`（動態建立、`uid===-1`，用陣列)兩種資料；修改存讀檔相關程式碼前請先參考 [docs/record-save-architecture.md](docs/record-save-architecture.md)
- **戰鬥系統**：傷害公式在 `src/core/combat.js`（`computeDamage()`）、屬性計算在 `src/components/com_stats.js`（`getTotalStats()`）、技能資料為 `public/assets/json/ability.json`（`DB.ability()`，目前只有 `fireball`/`firewall` 有完整戰鬥數值，其餘是文案佔位）；修改戰鬥相關程式碼前請先參考 [docs/combat-architecture.md](docs/combat-architecture.md)
- **Ability**：**`ability.json`（技能本體＋前置 `refs`）跟 `ab_tree.json`（`{樹:[{id,x,y}]}`，樹名是 `local.json` 的 `<樹>.lab`）是手寫來源檔**，沒有轉檔腳本（舊 xlsx 已刪除）；技能欄位直接寫在技能物件最上層（舊 xlsx 的 `meta` 欄已攤平），文件裡提到「填在 `ability.xlsx` 的 `meta`」一律改看 json
- **狀態特效（buff/dot…）**：**`public/assets/json/fx.json` 是手寫來源檔**（沒有轉檔腳本，用工具殼「特效」分頁編）；依 effect 的 `id` 查表（`DB.fx(id)`，查不到就不顯示），欄位 `img`/`cell`/`spawn`/`idle`/`tick`/`end`/`body`，後五者是 Phaser tween 設定（`body` 套在角色身體 `view.shape` 上，目前只支援 `angle`，以 view 底部為支點轉，特效結束時轉回 0、位置歸位）；`cell.flash:true` 的特效不常駐，只在 `fxTick`（DOT/HOT 扣血那一下）時臨時播 spawn→tick→end，並併入 `root.wait()` 一起等；區域（火牆）的外觀也在 fx.json，技能用 `zoneFx` 指 id（`HazardZone`→`ZoneView`，另有 `cell.jitter`、`spawn.stagger`/`from`）；單格動畫跟擺放邏輯共用 `src/core/fxcell.js`（`FxCell`、`attachCell`、`bodyTween`、`zoneDelays`，遊戲跟特效工具的預覽都呼叫它）
- **特效工具**：`tools/fx/`（殼的「特效」分頁）編 fx.json；左欄特效／未使用／缺特效（effects 或 zoneFx 指到、fx.json 沒有），種類由引用決定（effects＝效果特效、zoneFx＝區域特效）；cell 表單＋各階段半結構化 tween 表單（可切 JSON）；右邊 Phaser 預覽直接跑遊戲的 fxcell.js（角色照 `partsOf()` 合成、區域照技能 zoneW×zoneH 排格子），上身／tick／解除／重播＋自動循環＋速度倍率；修改前請先參考 [docs/fx-tool.md](docs/fx-tool.md)
- **角色資料**：**`role.json` 是手寫來源檔**（沒有轉檔腳本，舊 xlsx 已刪除）；名字／說明是 `lab`/`des`（原文，情境 `role.<id>`，程式用 `role.label`/`role.des`，不再放 local.xlsx）；`kind`（`player`/`npc`/`monster`/`animal`/`boss`/`rogue`）跟 npc 的 `loc`（地名，如 `brooklyn`）主要給編輯器分類，遊戲只讀 `kind:"player"`（＝可選玩家角色，見下面「玩家選角」），`sex`（`m`/`f`，缺＝`m`）決定裝備擺放：`item.json` 的 `equip.f = {scale,x,y}` 只在 `sex:"f"` 時蓋掉基準（`src/core/equip.js` 的 `equipFor()`，遊戲 `RoleView`／角色面板、角色編輯器預覽、試穿共用）；道具／部位條目最上層可寫 `sex`（限定性別，`sexOk()`：遊戲裝備格擋不符的、資訊框顯示限男性／限女性，NPC／舊存檔不擋；有 `sex` 就不套 `f`、基準就是那個性別的數字，工具挑選只列符合的、不符標 ⚠ 警告），行為旗標還是 `animal`/`unique`/`trade` 等；基礎屬性是 `GM.BASE_DEF` 被 `attrs` 覆蓋，`stats` 欄位遊戲不讀
- **部位（part.json）**：`role.json` 的 `body`/`shoes`/`cloth`/`head`/`hair`/`handF`/`handB`（前手／後手）寫的是 **`public/assets/json/part.json`（手寫來源檔）** 的 id，條目 `{kind, sprite, scale, x, y, a?, ox?, oy?, f?:{scale,x,y}}`（跟 `equip` 同格式，女角套 `f`），遊戲 `DB.rolePart(meta, kind)`（`src/core/equip.js` 的 `partFor()`，查不到不畫＋`dlog`），`ROLE_PARTS`／`setting.js` 的 `ROLE_PART` 對 `GM.PART`（鞋子 0.2 ＜ 靴子 0.5 ＜ 衣服 0.7 ＜ 護甲 1）；穿任何護甲藏衣服、任何靴子藏鞋子、任何手套藏兩隻手、`hideHair` 藏頭髮（`hiddenParts()`，遊戲／角色面板／角色編輯器預覽／試穿共用）；**rig**：`RoleView` 結構是 `_shape`（翻面＋執行期動畫：攻擊位移、fx `body` tween、倒地，照舊）→ `rig`（看不見的 container，位置／角度＝body 條目的 `x`/`y`/`a`，執行期不碰）→ 身體圖（在 rig 的 0,0，只吃 body 的 `scale`/`ox`/`oy`）＋其他部位＋三個支點節點，**調 body 的 x/y/a 整個人跟著動**、只挪身體圖改 `ox`/`oy`；衣服／鞋子／護甲／靴子跟支點的 x/y 相對 rig（人形 body 都是 `y:32`＝腳底，`anim.json` 影格也是 rig 座標）；**支點節點**：`rig` 裡建三個看不見的子 container `neck`（頭、頭髮、頭盔＋後片）／`wristF`（武器＋暫拿工具、前手、手套）／`wristB`（後手、手套的 `back`＝後手套），位置寫在 body 條目的 `neck`/`wristF`/`wristB` `{x,y,a}`（`a`＝節點靜止角度，子部位繞支點轉、自己的 a 疊上去；支點不分男女寫在基準、不放 `f`（男女各有自己的身體條目），沒寫＝0；**武器**的 `equip.wristF`/`wristB` `{x,y,a}` 是疊上去的位移（如弓前伸，男女共用不放 `f`，只認武器、暫拿工具時用工具的，`equip.js` 的 `pivotOf(body, k, held)`／`weaponOf()`，試穿「拖十字改：身體｜武器」調），**掛在上面的部位／裝備 x/y 相對支點**（拖支點整組跟著走；手套後片照前片的 wristF 擺、換算進 wristB），靜態合成用 `equip.js` 的 `flatPart()`（支點＋rig）換回 shape 座標（`unflatPart()` 反過來；body 自己不換），紙娃娃存讀 item／pool 自動換算（同性別參考身體的條目，沒有＝男 `body-man`、女 `body-woman` 的 `f`）；depth 只在節點裡排，節點整組用 `setting.js` 的 `NODE_DEPTH`（neck 1.5、wristF 4、wristB -1＝body 後面），對照在 `PART_NODE`／`BACK_NODE`，靜態合成（角色面板、ghost、工具預覽）用 `flatDepth()` 攤成一層（工具的對照表在 `tools/role/schema.js`，要一致）；條目從紙娃娃「存到 pool…」新增，角色編輯器的選圖器挑（右鍵改名／刪除）、試穿挑＋調數字；只做靜態挑選（路人隨機長相還沒做）
- **部位工具**：`tools/part/`（殼的「部位」分頁，排在角色後面）是 `part.json` 的總覽與整理，三欄：左樹照 kind 分組（同道具的 `fold.js` 收合＋`splitter.js` 拖寬，搜尋＋篩選 全部／未使用／壞的，未使用標灰只標示、壞的＝圖不存在／kind 不認識／被放錯欄位標 ⚠）、中間沒選＝縮圖總覽（上方部位分頁 全部／身體／…，記住）／選了＝詳細（動作鈕、原圖、擺放數字欄、身體的支點表、使用者 ↗）、右欄 `男｜女` 切換套在 `body-man`／`body-woman` 的合成（女有 `f` 就套、沒有用基準；`preview.js`，底色可換、記 `tools.preview.bg`）；改名／改 kind（有人用擋）／換圖／新增（數字抄同 kind 第一筆）／複製／刪除（有人用擋）**立刻寫檔＋廣播**；擺放數字（女改 `f`）跟身體的 neck／wristF／wristB 支點（表格＋右欄十字拖位置、白點轉 a，男女都寫基準）也立刻寫，只有這兩種有條目層級 undo；右欄只有身體支點十字能拖，部件本身不拖；身體沒有男女切換（不讀寫 `f`）；改名／刪除跟角色選圖器共用 `tools/common/part.js`，改名前廣播 `partRenamed` 讓角色／試穿分頁的未存修改在記憶體跟著改；修改前請先參考 [docs/part-tool.md](docs/part-tool.md)
- **玩家選角**：主選單「繼續遊戲」（有存檔才顯示）／「新遊戲」→ `UiSelect`（`src/ui/uiselect.js`，主選單自己 new，連同 `UiConfirm`）列 `DB.playerIds()`；按「開始」有存檔先確認覆蓋，再 `Record.newGame(pid)`（存 `Record.game.pid`＋quality `pc.<id>`=1，劇情用 `pc.mary` 之類分歧）；`GameScene.setPosition()` 照 `pid` 建玩家，舊存檔沒有 `pid` 補成第一個玩家角色；無頭測試 `t.newGame(pid?)` 走選角面板、有存檔自動按確認
- **NPC 作息**：`role.json` 的 `schedule` 是「時間（`HH:MM` 出發 / `@HH:MM` 抵達）→ `map`+`go` 目的地」，路線由 `scripts/navgraph.js` 產生的 `navgraph.json` 算（改了 Tiled 地圖要重跑）；`ScheduleManager` 在背景推進所有 NPC 的抽象狀態（`Record.game.schedule`），NPC 在玩家地圖時才由 `COM_Schedule` 實體負責走路；修改作息相關程式碼前請先參考 [docs/schedule-architecture.md](docs/schedule-architecture.md)
- **NPC AI**：`src/components/ai/` 的 `COM_AI` 每回合讓各 `Beh*` 用 `score()` 評分、取最高分的那個執行 `act()`（平手時陣列中排前面的贏）；感知是 `COM_Sense` 寫入 `bb.sensePlayer`；性格權重依 `role.json` 的 `style`，動物用 `animal:true`（不會開門）；行為裡移動用 `findPath`+`move`，不用 `cmd_move`，而且要處理 `PATH.NONE`（沒有 `pts`）；修改 AI 相關程式碼前請先參考 [docs/ai-architecture.md](docs/ai-architecture.md)
- **多國語言**：資料只寫原文（中文），顯示文字一律走 `tr(情境, 原文, args)`（`src/infra/lang.js`）或 `'key'.lab()`（**`local.json` 手寫來源檔**，沒有轉檔腳本）；識別字（quality、節點、storylet、spawn…）一律 ASCII；開發版設定頁可切偽語系 `qps` 抓爆版與漏接；**譯文 `public/assets/lang/<lang>.json` 是手寫來源檔＝執行期檔**（`{_meta, _shared, <情境>:{原文:{t, r}}}`，`r`＝審核 `mt`/`ok`，只存有譯文的列，用工具殼「翻譯」分頁編；舊的 `xls/` 已整個刪除），抽取／檢查／`compile()` 在 `src/data/langdata.js`，`node scripts/lang.js` 只檢查印統計不寫檔（run_all 最後一步）；修改顯示文字或語言相關程式碼前請先參考 [docs/i18n-architecture.md](docs/i18n-architecture.md)
- **文字工具**：`tools/local/`（殼的「文字」分頁）編 `local.json`，每筆的 `grp` 只給工具分組（遊戲不讀）；一張可就地編輯的表格，`scan.js` 掃 `src/`＋資料 json 算引用、「缺少」（明確 `'x'.lab()` 卻沒列）一鍵補上、「未使用」只標灰；改名存檔後連帶改 `lang/*.json` 的 `ui.<key>` 情境；修改前請先參考 [docs/local-tool.md](docs/local-tool.md)
- **翻譯工具**：`tools/lang/`（殼的「翻譯」分頁）左情境樹（＋`_shared`／`orphan`）右表格直接編譯文、點審核切換、搜尋跨整棵樹；new 列的建議欄點一下把同情境 orphan 的舊譯文搬過來（標 `mt`）、右鍵「升為 shared」；每列 ↗ 跳到來源分頁（道具／角色／能力／對話／任務，`doc.js` 的 `listenGoto()`）；「複製待翻」「貼上譯文」給 AI 翻（不打 API）；修改前請先參考 [docs/lang-tool.md](docs/lang-tool.md)
- **工具殼**：`tools/index.html`（`npm run dev` 後開 `/tools/`）用分頁＋iframe 裝道具／角色／紙娃娃編輯器，專案根目錄只在殼選一次（工具頁不再有選資料夾 UI，直接開只會提示從 `/tools/` 開），存 json 用 `BroadcastChannel('tools')` 通知其他分頁重讀，工具端接線在 `tools/common/shell.js`；修改前請先參考 [docs/tools-shell.md](docs/tools-shell.md)
- **紙娃娃編輯器**：`tools/paperdoll/`（純 HTML + Canvas 2D，殼的「紙娃娃」分頁，工作資料夾固定是專案的 `images/`）調整零件圖的裁切／縮放／透明清除，存讀的按鈕集中在工具列「存讀」模式（`存檔…`｜存到／載入 item＋`☐ 女版`｜存到／載入 pool＋`☐ 女版`，item 作用在選取圖層所屬的自動組、載入一筆全域 undo，header／自動面板／屬性欄不放存讀鈕），只有「存到 item…」會寫遊戲資料（`item.json` 的 `equip`/`icon`/`drop`＋`textures/equips|weapons/` 的 PNG，新圖要按殼的「更新圖片清單」；旁邊的「載入 item」反過來照 `equip.sprite` 把 scale/x/y 載回零件、照遊戲 PNG 尺寸反推存檔%（要重烤先問）），一般存檔存工作資料夾（只寫 PNG，同名 `.json` 拿掉了）；畫布座標＝遊戲單位、每層自己的 `scale`（預設 0.25，像素×scale＝畫面大小，沒有全域 scale）；自動零件大小分兩段：存檔%（`pct`，原圖縮成幾 % 烤成 PNG）＋scale（＝`equip.scale`，只改擺放），兩個不互相換算，縮放模式拉自動零件改的是存檔%，「存檔…」／icon 存檔也能選 `textures/` 匯出（只寫 PNG、圖層不動、texture key 撞名擋），角色零件擺放用試穿分頁調；**`item.json` 是手寫來源檔**（沒有轉檔腳本），其他欄位用道具編輯器改；遊戲零件的 origin 讀 `part.ox ?? 0.5`、`part.oy ?? 1`；頭盔可用「前後片」模式拆成原圖 `X`／`X-front`／`X-back` 三層，存成 `equip.sprite`=`X-front`、`equip.back`=`X-back`、`icon`=`X`（共用 equip 擺放、後片深度 `PART_DEPTH[GM.PART.BACK]`=1.5），或選「挖除」只產生 `X-front`（沒有 `back`）；輪廓線＝亮度 `<` 門檻；「存成」（前後片／挖除）跟「切割」（沿線 `PX.splitTrace()`／魔術棒 `PX.splitCut()`：淹水→閉運算→往下／往右 X px 內碰到透明才收線→描外圈）分開，切換存成單向帶切法（前後片＝沿線、挖除＝魔術棒＋下）；「自動」分護具（綠底整套拆頭盔／護甲／靴子，有標記頭的參考人偶時照遊戲深度插在頭上下）跟武器（透明底單把，一個零件，多調 a/ox/oy、拖橘色十字改支點、存 `textures/weapons/`、a＝待機角度寫進 `equip.a`、icon 另產斜 45° 100×100 的 `<名>-icon`）兩種，武器數字照分類（`sword`/`axe`/`hammer`/`dagger`/`staff`/`bow`/`default`，從檔名第一個 `-`/`_` 前猜、下拉可改、記在零件 `auto.cls`）各存一組，武器另可在檔案樹多選 PNG 右鍵「批次存武器到 item…」（不建圖層、每列套自己分類的全域預設）；第三種「頭像」（透明底左光頭右頭髮、臉是綠洞）拆成 `head-<原圖名>`／`hair-<原圖名>`（🔗 共用存檔%＋scale），零件自動標 pool，存走「存到 pool…」／「載入 pool」（反推存檔%），不再寫 role.json、不合成頭像（頭像在角色編輯器「由頭髮產生」）；第四種「服飾」（綠底，版面同護具：左上頭丟掉、左下衣服、右下鞋子）拆成 `cloth-<原圖名>`／`shoes-<原圖名>`，自動標 pool，數字跟護具一樣分男女兩組（`S.auto.cloth/shoes`＋`f.cloth/shoes`）；圖層右鍵另有 pool 部位標記（`L.pool`＝身體／鞋子／衣服／頭／頭髮／手，跟人偶 tag 分開、數量不限），「存到 pool…」把標了的層（預設勾 👁 顯示中的、可改 id）存成 `part.json` 條目＋`roles/parts/<id>.png`（新條目接在同 kind 後面、已有的保留其他 key），服飾零件一定存男版＋`☐ 女版` 勾了寫 `f`、沒勾刪 `f`，頭像／手動層只有一組、存基準不碰 `f`，「載入 pool」照 `poolId ?? 圖層名` 套回基準（服飾的 `f` 進女版那組）；「icon」模式把選取圖層轉角度、等比置中存成 N×N（尺寸／角度／佔比是全域設定，自動零件用縮小前的圖）；header「關閉」清掉全部圖層（未存先問、清 undo）；圖層右鍵標成男／女的髮／頭／身體（`tag`，同 tag 只能一層；`poolId ?? 圖層名` 對到 `part.json` 同名條目就照條目擺、鎖擺放（點不到、不能拖），別的分頁存 part.json 跟著重擺、其他零件不動只提示，對不到／圖跟遊戲 PNG 不一樣大標 ⚠；存讀換算的 rig／支點用同性別參考身體的條目，沒有才退回 `body-man`／`body-woman`），header `男｜女`＋`☐ 頭髮` 當下批次改 👁（不進 undo，tag／狀態跟著專案存）；`男｜女` 同時切自動護具的男女兩組數字（`S.auto` 男版／`S.auto.f` 女版＝只有 scale/x/y，PNG 男女共用一張、存檔% 共用，拆過就照新那組重擺），「存到 item」一定存男版（女模式下照男版數字重擺、存完復原），旁邊 `☐ 女版` 勾了寫 `equip.f`（女版那組 scale/x/y）、沒勾刪 `equip.f`（確認），載入 item 女模式讀 `equip.f`；修改前請先參考 [docs/paperdoll-tool.md](docs/paperdoll-tool.md)
- **道具編輯器**：`tools/item/`（殼的「道具」分頁）視覺化編輯 `item.json`，欄位定義在 `tools/item/schema.js`（遊戲加新欄位改這裡，沒列到的 key 會原樣保留；`equip` 的女版 `f`／前後手腕是 `nums` 型別一排數字，這三個跟後片／藏頭髮是選填 `opt`：沒值就藏、從框裡的「加欄位」叫出來、有值有刪除鈕），右欄是穿上這件的預覽（角色分頁的 `previewEl()`，人偶＝第一個男／女玩家角色的長相，`男｜女` 切換、只看不調），icon 選圖器讀 `textures.json`（分頁＝`textures/` 第一層資料夾、檔案總管式瀏覽，支援 `sheet:格子`／`atlas:frame`；dev server 監看 `textures/` 自動重產清單）；存檔保留 key 順序、存前偵測外部修改做道具層級合併、檢查只警告不擋；`tools/common/`（`doc.js` 讀寫/undo/合併/改名核心、`form.js`、`views.js`、icon 選圖器、JSON 框…）給各編輯器共用，`fs.js` 紙娃娃也用；修改前請先參考 [docs/item-editor.md](docs/item-editor.md)
- **角色編輯器**：`tools/role/`（殼的「角色」分頁）視覺化編輯 `role.json`，欄位定義在 `tools/role/schema.js`，性格選項從 `com_ai.js` 的 `wTBL` 解析、作息選項從 `navgraph.json`；表單分段可收合（預設全收、跨角色記在頁面）、「JSON」鈕切整筆 JSON 模式（`form.js` 共用，道具編輯器也有）；右側是照 `RoleView` 規則的靜態合成預覽；部位欄是 pool 選圖器（照 kind 列 `part.json`，右鍵改名＝`part.json` 立刻寫＋role.json 引用一起改並存檔、刪除＝有人用就擋），icon 旁「由頭髮產生」用 `tools/common/portrait.js` 合成頭＋頭髮寫 `roles/portraits/portrait-<id>.png`（尺寸看設定的 `portrait`）；改名／刪除會多掃 `src/`（只列不改）；修改前請先參考 [docs/role-editor.md](docs/role-editor.md)
- **能力編輯器**：`tools/ability/`（殼的「能力」分頁）同時編 `ability.json`／`ab_tree.json`／`local.json`（樹名）／`role.json`（只在技能改名刪除時），左樹清單、中樹畫布（照 `uiability.js` 畫，拖節點移格子、拖到左欄樹列／「未分類」換分類、藍點拉線加 `refs`、點線 Del 刪、空格／節點／樹列右鍵增刪改名、「＋ 新技能」）、右技能表單（`tools/ability/schema.js`，`hits`/`effects` 卡片、說明 token 預覽與檢查）；前置要在子的上面（遊戲的線只往下畫）；修改前請先參考 [docs/ability-tool.md](docs/ability-tool.md)
- **試穿**：`tools/fit/`（殼的「試穿」分頁）選紙娃娃型角色、五格（武器/頭盔/護甲/手套/靴子）試穿（不寫回 `inv.equips`），七個部位各一個下拉挑 `part.json` 條目（寫 role.json），body 的三個支點用數字或畫布拖十字調（白點轉 a；預覽的「顯示 ▾」下拉 `tools/common/showmenu.js` 多選 view／錨點／b／g／z／三個支點，預設全不勾、記在 `tools.preview.show` 跟角色／部位分頁共用，沒勾的支點不畫也拖不動），畫布上的部件／裝備不能點選、不能拖（只有支點十字能拖，擺放用數字調；`tools/common/handles.js` 跟部位分頁共用），用數字調部位條目（`part.json`，全角色共用、標共用幾個）和 `item.json` 的 `equip` 擺放（女角改 `f` 的 scale/x/y，第一次改從基準複製，有「刪除女版」）；「動畫」分頁編 **`anim.json`（手寫來源檔）** 的武器動畫（動的是 `wristF` 節點：關鍵影格＝前手腕的絕對位置＋角度、收回到支點跟它的靜止角度，手／武器／手套跟著動、空手也能播，`follow`/`pivot`/`ready`/`hit`/`hold`/`back`），畫布拖武器／旋轉把手／支點、時間軸拖影格；四檔一起 undo、各自合併存檔；動畫數學在 `src/core/pose.js`（純函式，`COM_Anim.anim_play()` 跟工具共用，改動作改這裡），普攻看武器 `item.json` 的 `anim`（如匕首 `stab`），技能用 `anim` 選動畫（近戰／遠程型沒寫退回武器的，預設見 `com_action.js`）；換武器自動切到它的動畫、改名連帶改道具 `anim`；修改前請先參考 [docs/fit-tool.md](docs/fit-tool.md)
- **提示詞**：`tools/prompt/`（殼的「提示詞」分頁）管理 AI 生圖提示詞，檔案路徑可設（預設 `prompts/prompt.json`，`{items:{分類路徑:[{name,file,desc,common}]}, common:{名稱:文字}}`，分類路徑用 `/` 分層、存檔補齊祖先照前序排，`file`＝生圖存檔名不含副檔名），common 支援 `{desc}`/`{name}`/`{file}` 佔位符（沒填 file 時含 `{file}` 的行整行拿掉）、沒有就 `desc+'\n'+common`，只複製不打 API；修改前請先參考 [docs/prompt-tool.md](docs/prompt-tool.md)
- **圖片工具**：`tools/texture/`（殼的「圖片」分頁）看 `textures/` 哪些圖沒人引用、被誰引用（只認放圖的地方：資料 json 的 `icon`/`sprite`/`back`/`img` 欄位（`scan.js` 的 `FIELDS`，加了放圖的新欄位要補）、Tiled 屬性 `value`、tsj 的 `image` 比路徑、src 字串要是 `key:frame` 或同行有圖片相關字），一般資料夾「搬到 .tbd」（保留相對路徑、`_sheet`/`_atlas.json` 一起搬），`.tbd/` 裡才能「搬回原位」或真的刪；`.tbd/` 裡還被引用的標紅；修改前請先參考 [docs/texture-tool.md](docs/texture-tool.md)
- **設定分頁**：`tools/settings/`（殼的「設定」分頁）看／改 **`tools/settings.json`（不進 git）**：工具共用的數字欄步進（`pct`/`scale`/`xy`/`o`/`a`，`xy` 也是紙娃娃方向鍵、拖曳吸附；`form.js` 的數字欄也照它 ↑↓，同一格連按併成一步 undo＝`tools/common/hist.js`）＋紙娃娃自動拆圖的數字（各部位、武器分類、頭像、女版）＋角色編輯器由頭髮產生的頭像尺寸（`portrait`）；只存跟內建值不一樣的（內建值 `DEF` 在 `tools/common/settings.js`），空白＝內建、清空＝回內建；紙娃娃調的數字直接寫這份（localStorage 只剩介面狀態、專案檔不存數字），改了延遲寫檔＋廣播；數字欄用 `data-step`＋`ST.applySteps()`；修改前請先參考 [docs/settings-tool.md](docs/settings-tool.md)
- **圖片載入（自動）**：Preloader 不手寫 `load.image`／`spritesheet`／`atlas`，改讀 `public/assets/json/textures.json`（產出檔，`node scripts/textures.js` 掃 `textures/` 產生；`predev*`／`prebuild*` 自動跑、run_all 也跑、工具殼「更新圖片清單」按鈕走 vite dev 的 `POST /__tools/textures`）；同資料夾有 `<key>_atlas.json` 是 atlas，有手寫的 `<key>_sheet.json`（`{w, h?, margin?, spacing?}`）是 spritesheet，其他是單張圖（json 配不到圖、兩個都有、`maps/` 底下放 `_sheet.json` 都會報錯）；`textures/maps/` 不進清單，由 `tilemap.js` 進地圖時照 *.tsj 載（tsj 的 `name` 要等於檔名，集合型 tile 用檔名當 key，Preloader 載過的 Phaser 會跳過不重載）；撞名、`_sheet.json` 跟 tsj 格子不一致、tsj name 不等於檔名都會報錯不產出；Phaser 的 spritesheet 只扣一次 margin、tileset 扣兩次，有 margin 的圖要補邊讓兩邊格數一樣（如 `cursors.png`）
- **全域常數**：集中定義於 `src/core/setting.js`（`GM`、`ORDER`、`UI` 等）
- **Debug 輸出**：使用 `dlog(tag, ...)` 搭配 `T` 旗標（定義於 `src/core/debug.js`）；正式版不留 `console.log`
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
