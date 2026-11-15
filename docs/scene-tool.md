# 場景分頁（tools/scene）

模擬場景的整合驗收台：在遊戲本身裡擺角色、播動作、掛特效、放擺設、調日夜，看到的＝玩家會看到的。

> 狀態：2026-11-15 定案；第 1 步（骨架）完成，2～6 步未做（計畫見最後）。

## 架構

- 業界 gym／sandbox level 做法：分頁的 iframe 載**遊戲本身**（開發版 `/?sandbox=1`），Boot → Preloader → 開發版專用 `Sandbox` 場景（`src/scenes/Sandbox.js`，繼承 `GameScene`），`findPath`、`Light2D`、`roles`／`gos` 都是真的。
  - `src/main.js`：`SANDBOX`＝`import.meta.env.DEV` 且網址有 `sandbox`，才把 `Sandbox` 加進場景清單、畫布改 `Scale.RESIZE` 填滿 iframe；Preloader 看到有 `Sandbox` 場景就直接進它（不經主選單）。正式版 `SANDBOX` 是 false，`Sandbox` 類別被 tree-shake 掉。
  - `Sandbox.create()` 自己跑主選單那份 `loadData()`（`MainMenu.js` export，`DB.load` 等）、`Record.game` 換成全新的 `game_def`、`TimeSystem.load()`；不建玩家、不 launch UI／Top、不跑回合／作息／劇情、不建地圖邊界出口；`update()` 空的（GameScene 的遮擋／游標都靠玩家）。
  - `GameScene` 的 constructor 收 key（預設 `'GameScene'`），`Sandbox` 用 `'Sandbox'`。
  - `map.js`：`scene.sandbox` 時不建 `type:npc` 物件、跳過 `@群組` 圖層（不碰存檔）。
- 分頁的 HTML 面板用 postMessage 操作 iframe 裡的 sandbox（同無頭測試走 `window.__dbg` 的精神）。訊息都帶 `sb` 欄位：
  - 分頁 → sandbox：`load {scene}`（底圖不同就 `scene.restart` 帶著 scene 重開，同一張直接套用）、`grid {on}`、`home`（整張地圖放進畫面）。
  - sandbox → 分頁：`ready`（剛開好、還沒有場景，分頁收到就送 `load`）、`loaded {map}`（套用完）、`error {msg}`（地圖載入失敗，顯示在狀態列）。
- **sandbox 絕不寫遊戲存檔**：`Record.noSave = true`（`saveGame()` 直接 return），`Record.game` 是 sandbox 自己的一份。
- 鏡頭：滾輪以游標為中心縮放（0.25～8）、中鍵拖曳平移；每張底圖的鏡頭記在 sandbox 的記憶體，換場景回同一張圖接著看；第一次看＝整張放進畫面（工具列「置中」同）。開發版掛 `window.__sb`（Sandbox 場景）給測試。

## 資料：`tools/scenes.json`

手寫來源檔（工具寫），進 git，`{<場景名>: {...}}` 可多組；遊戲不讀。存：底圖、時間（＋自訂環境色）、角色實例、擺設、粒子發射點、角色身上的狀態特效。

- 目前（第 1 步）一筆只有 `{map}`（相對 `maps/`、不含 `.json`，新增預設 `sandbox`），之後的步驟再加欄位。
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
- 木偶：不掛 AI／作息／感知、不進回合。

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
2. 角色：放置／拖曳／刪除、裝備覆寫、面向、木偶化
3. 動作：普攻／技能／走路／被打／倒地／重播／重置、自動補血
4. 擺設：選圖、全部屬性、吸附、方向鍵、發光
5. 特效：狀態特效、粒子發射點
6. 日夜＋底圖：時鐘滑桿／播放／自訂色、切現有地圖（濾掉角色）
