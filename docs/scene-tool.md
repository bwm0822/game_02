# 場景分頁（tools/scene）

模擬場景的整合驗收台：在遊戲本身裡擺角色、播動作、掛特效、放擺設、調日夜，看到的＝玩家會看到的。

> 狀態：2026-11-15 定案；第 1 步（骨架）、第 2 步（角色）完成，3～6 步未做（計畫見最後）。

## 架構

- 業界 gym／sandbox level 做法：分頁的 iframe 載**遊戲本身**（開發版 `/?sandbox=1`），Boot → Preloader → 開發版專用 `Sandbox` 場景（`src/scenes/Sandbox.js`，繼承 `GameScene`），`findPath`、`Light2D`、`roles`／`gos` 都是真的。
  - `src/main.js`：`SANDBOX`＝`import.meta.env.DEV` 且網址有 `sandbox`，才把 `Sandbox` 加進場景清單、畫布改 `Scale.RESIZE` 填滿 iframe；Preloader 看到有 `Sandbox` 場景就直接進它（不經主選單）。正式版 `SANDBOX` 是 false，`Sandbox` 類別被 tree-shake 掉。
  - `Sandbox.create()` 自己跑主選單那份 `loadData()`（`MainMenu.js` export，`DB.load` 等）、`Record.game` 換成全新的 `game_def`、`TimeSystem.load()`；不建玩家、不 launch UI／Top、不跑回合／作息／劇情、不建地圖邊界出口；`update()` 空的（GameScene 的遮擋／游標都靠玩家）。
  - `GameScene` 的 constructor 收 key（預設 `'GameScene'`），`Sandbox` 用 `'Sandbox'`。
  - `map.js`：`scene.sandbox` 時不建 `type:npc` 物件、跳過 `@群組` 圖層（不碰存檔）。
- 分頁的 HTML 面板用 postMessage 操作 iframe 裡的 sandbox（同無頭測試走 `window.__dbg` 的精神）。訊息都帶 `sb` 欄位：
  - 分頁 → sandbox：`load {scene}`（底圖不同就 `scene.restart` 帶著 scene 重開，同一張直接套用）、`grid {on}`、`home`（整張地圖放進畫面）、`select {key}`（選取框）、`hide {keys}`（👁）。
  - sandbox → 分頁：`ready`（剛開好、還沒有場景，分頁收到就送 `load`）、`loaded {map, w, h}`（套用完；w/h＝地圖格數，「＋」放在中間用）、`error {msg}`（地圖載入失敗、角色 id 不存在，顯示在狀態列）、`select {key}`（左鍵點到的角色，空白處＝null）、`move {key, tx, ty}`（拖曳放開）、`ctx {tx, ty, key, cx, cy}`（右鍵，cx/cy 是 iframe 裡的 client 座標）、`key {key, ctrl, shift, alt}`（iframe 有焦點時的鍵盤，分頁照自己的快捷鍵處理）。
- 角色、物品、部位等遊戲資料（`role.json`、`item.json`、`part.json`、`anim.json`、`fx.json`、`particle.json`、`ability.json`、`local.json`、`textures.json`）在別的分頁存檔時，sandbox 的 DB 就舊了：分頁收到廣播就整個重開 iframe（工具列「重開」同）。
- **sandbox 絕不寫遊戲存檔**：`Record.noSave = true`（`saveGame()` 直接 return），`Record.game` 是 sandbox 自己的一份。
- 鏡頭：滾輪以游標為中心縮放（0.25～8）、中鍵拖曳平移；每張底圖的鏡頭記在 sandbox 的記憶體，換場景回同一張圖接著看；第一次看＝整張放進畫面（工具列「置中」同）。開發版掛 `window.__sb`（Sandbox 場景）給測試。

## 資料：`tools/scenes.json`

手寫來源檔（工具寫），進 git，`{<場景名>: {...}}` 可多組；遊戲不讀。存：底圖、時間（＋自訂環境色）、角色實例、擺設、粒子發射點、角色身上的狀態特效。

- 一筆＝`{map, roles?}`（之後的步驟再加欄位）：
  - `map`：相對 `maps/`、不含 `.json`，新增預設 `sandbox`。
  - `roles`：`[{key, id, tx, ty, face?, equip?}]`；`key`＝場景裡的編號（`r1`、`r2`…取最小空號），`id`＝role.json，`tx/ty`＝格子，`face`＝`l`/`r`（沒寫＝角色預設面向），`equip`＝裝備覆寫 `{CAT_WEAPON: 'sword-1', CAT_HELMET: ''}`（有寫的格子換掉、`''`＝空著，沒寫的照 role.json 的 `inv.equips`）；沒有角色時整個欄位拿掉。
- 讀寫在 `tools/scene/store.js`：每次改都現讀硬碟 → 改 → 寫回（2 格縮排＋換行），回傳前後全文給 undo；undo／redo 要硬碟現在等於預期的全文才寫（別處改過就擋、提示、步驟留著），同地圖分頁。寫完廣播 `scenes.json`，別的分頁收到重讀。
- 沒有檔＝空的、不建檔，第一次新增才建 `tools/scenes.json`。

## 底圖

- 預設 `public/assets/maps/sandbox.json`（24×16 格草地，`terrain_tiles_v2` 的 52 號、一個空的 `objects` 物件層；不進 `main.world`、不進總覽地圖；地圖分頁的「其他」組看得到它）。
- 可切任一現有地圖；sandbox 只建地形＋靜態物件（門、床、燈、井…，燈照常、門點了不切換），不建 NPC／怪物／動物／作息角色、不跑 `@群組`。
- 沒有預設玩家；鏡頭自由（滾輪以游標為中心縮放、中鍵拖曳平移）。

## 角色

- 從 role.json 挑 id（照 kind／grp 分組），同 id 可多隻。
- 實例可覆寫：裝備五格（武器／頭盔／護甲／手套／靴子，空＝用 role.json 的）、面向、位置；不寫回 role.json。
- 位置永遠在格子中心（遊戲的走路／擊退靠它）。
- 木偶：`src/roles/puppet.js`（`Puppet`，照 `Dummy` 木樁的組法）掛 `RoleView`＋`COM_Inventory`＋`COM_Anim`＋`COM_Stats`＋`COM_Disp`，不掛 AI／作息／感知、不進回合、不讀寫存檔、`bb.interactive=false`（點選是 sandbox 自己判斷：身體方塊包住游標的最上面那個，沒有就看站在那格的）；`bb.meta` 是 role.json 那筆的淺拷貝、`inv.equips` 換成套完覆寫的（`Puppet.equipsOf()`）。只在 Sandbox 用到，正式版一起被 tree-shake 掉。
- sandbox 套場景時照 `key` 比對：那筆資料（JSON）沒變的角色留著，變了（換角色、格子、面向、裝備）或不見的就 `dismiss()` 重建（重新登記路網權重）。
- 操作：畫面上左鍵點選（綠框）＋拖曳（跟著格子跳、放開才寫檔）、右鍵「在這裡放角色…」（挑角色對話框：照 kind／grp 分組、搜尋、雙擊確定、預設上次挑的 `tools.scene.lastRole`）／「刪除」；左欄角色清單（👁 暫藏只在這次開著時、不寫檔、藏著點不到；右鍵刪除；「＋」放在地圖中間）；右欄 角色（換 id）、格子、面向、裝備五格（下拉＝（原本：…）／（空）／那一類有 `equip` 的道具，限定性別不符的不列）、刪除；Del 刪選中的（分頁或 sandbox 有焦點都行）。

## 動作（表演，不進 undo、不改場景檔）

- 選施放者 → 普攻（照武器近戰／遠程）或 ability.json 任一技能（不管學沒學）→ 點目標（角色或空格，區域技能照遊戲範圍）。
- 忽略 MP、冷卻、射程；近戰射程外原地揮，不自動走過去。
- 走真的 com_action 編排與**真的傷害路徑**（數字、MISS／閃避、擊退換格子），sandbox 角色打完自動補滿、不會死。
- 另有：走路（點格子，沿路徑走）、被打、倒地／復活。
- 空白鍵重播上一個動作；「重置」回到場景檔的狀態。

## 特效

- 狀態特效：選角色加 fx.json 的效果，常駐到移除，可「tick 一下」「解除」，**存檔**。
- 粒子：particle.json 常駐發射點（stream 持續、burst 照間隔重噴），可拖、可跟隨角色，**存檔**。
- 區域（火牆等）走技能施放。

## 擺設

- 圖：textures 圖（icon 選圖器，支援 sheet／atlas frame）或外部 png（拖檔或從專案 `images/` 挑，不必先放進 textures/，存相對專案路徑）。
- 屬性：scale、左右翻轉、旋轉、錨點 ox／oy（預設 0.5／1）、depth 偏移、Light2D、可選發光光源（半徑／顏色）。
- 深度照錨點 y 自動排，跟角色互相遮擋；不擋路。

## 格線與吸附

- 32×32 格線（`GM.TILE_W/H`），可開關（localStorage）。
- 角色一律吸格子中心。
- 擺設／粒子自由拖，按住 Shift 錨點吸 16px（格子交點＋中心）。
- 方向鍵 1px（設定分頁 `xy` 步進），Shift＋方向鍵一格。

## 日夜

- 時間滑桿 00:00～23:59 設 sandbox 的真 `TimeSystem` 時鐘（`lutAmbient`、燈亮度都跟遊戲一樣），▶ 播放＋倍速。
- 「自訂環境色」勾選＋色票／亮度，勾了蓋掉 LUT。
- 時間存檔。

## 編輯

- 立刻寫檔＋undo（Ctrl+Z／Ctrl+Y），拖曳放開才寫，存檔廣播。

## 版面（三欄，排在「粒子」後面）

- 左：場景清單（＋ 新增；右鍵 改名／複製／刪除，雙擊改名；點選中的再點一次＝取消選取＝空白 sandbox；選取記 `tools.scene.sel`）＋目前場景物件樹（角色／擺設／粒子，👁 暫藏、Del 刪；第 2 步起）；下方 ↶／↷（Ctrl+Z／Ctrl+Y）。
- 中：iframe＋工具列（底圖、格線、時間／▶／倍速／自訂色、重置、全部停止）；左鍵選取拖曳、右鍵選單放東西。
- 右：選中物件的屬性；角色下方是動作區。

## 實作順序（每步 commit＋`scripts/test/scene-tool.mjs`＋更新本文件）

1. ✅ 骨架：`?sandbox=1` 路由＋`Sandbox` 場景（不存檔）＋`sandbox.json`；分頁殼、iframe、postMessage 協定、場景清單、scenes.json 讀寫＋undo、鏡頭、格線
2. ✅ 角色：放置／拖曳／刪除、裝備覆寫、面向、木偶化
3. 動作：普攻／技能／走路／被打／倒地／重播／重置、自動補血
4. 擺設：選圖、全部屬性、吸附、方向鍵、發光
5. 特效：狀態特效、粒子發射點
6. 日夜＋底圖：時鐘滑桿／播放／自訂色、切現有地圖（濾掉角色）
