# 場景分頁（tools/scene）

模擬場景的整合驗收台：在遊戲本身裡擺角色、播動作、掛特效、放擺設、調日夜，看到的＝玩家會看到的。

> 狀態：2026-11-15 定案，同日 6 步全部完成（計畫見最後），剩實用調整。

## 架構

- 業界 gym／sandbox level 做法：分頁的 iframe 載**遊戲本身**（開發版 `/?sandbox=1`），Boot → Preloader → 開發版專用 `Sandbox` 場景（`src/scenes/Sandbox.js`，繼承 `GameScene`），`findPath`、`Light2D`、`roles`／`gos` 都是真的。
  - `src/main.js`：`SANDBOX`＝`import.meta.env.DEV` 且網址有 `sandbox`，才把 `Sandbox` 加進場景清單、畫布改 `Scale.RESIZE` 填滿 iframe；Preloader 看到有 `Sandbox` 場景就直接進它（不經主選單）。正式版 `SANDBOX` 是 false，`Sandbox` 類別被 tree-shake 掉。
  - `Sandbox.create()` 自己跑主選單那份 `loadData()`（`MainMenu.js` export，`DB.load` 等）、`Record.game` 換成全新的 `game_def`、`TimeSystem.load()`；不建玩家、不 launch UI／Top、不跑回合／作息／劇情、不建地圖邊界出口；`update()` 空的（GameScene 的遮擋／游標都靠玩家）。
  - `GameScene` 的 constructor 收 key（預設 `'GameScene'`），`Sandbox` 用 `'Sandbox'`。
  - `map.js`：`scene.sandbox` 時不建 `type:npc` 物件、跳過 `@群組` 圖層（不碰存檔）。
- 分頁的 HTML 面板用 postMessage 操作 iframe 裡的 sandbox（同無頭測試走 `window.__dbg` 的精神）。訊息都帶 `sb` 欄位：
  - sandbox → 分頁另有 `zone {key, k, z}`（拖完發射點的 emitZone／deathZone）、`moveInst {key, x, y}`／`dropPrefab {id, wx, wy}`／`part {key, i}`／`movePart {key, i, x, y}`（prefab 實例，見 prefab.md）。
  - 分頁 → sandbox 另有 `inspect {inspect:{key, boxes, part}｜null}`（選中的 prefab 實例畫錨點／方塊／展開零件的外框）、`focus {key}`（鏡頭移到實例）。
- 分頁 → sandbox：`load {scene}`（底圖不同就 `scene.restart` 帶著 scene 重開，同一張直接套用）、`grid {on}`、`anchor {on}`、`icons {light, particle}`（記號開關）、`home`（整張地圖放進畫面）、`select {key}`（選取框）、`hide {keys}`（👁）、`arm {act}`（指定目標，null＝取消）、`do {act}`、`replay`、`reset`、`hit`／`die`／`revive {key}`、`fxTick {key, id}`、`time {t}`（預覽時間）、`ambient {color}`（預覽環境色）、`play {speed}`（0＝停）、`textures`（圖片清單更新，見下）。
  - `act`＝`{key（誰做）, kind:'attack'|'ability'|'walk', id（技能）, tx, ty（目標格子）, tkey（點到的角色）}`。
  - sandbox → 分頁：`ready`（剛開好、還沒有場景，分頁收到就送 `load`）、`loaded {map, w, h}`（套用完；w/h＝地圖格數，「＋」放在中間用）、`error {msg}`（地圖載入失敗、角色 id 不存在，顯示在狀態列）、`select {key}`（左鍵點到的角色，空白處＝null）、`move {key, tx, ty}`（角色拖曳放開）、`moveProp {key, x, y}`（擺設拖曳放開）、`moveEmitter {key, x, y}`（粒子發射點拖曳放開，跟著角色／擺設時是相對位置）、`resizeProp {key, patch}`（擺設大小把手放開）、`moveLight {key, x, y}`／`radiusLight {key, r, dir?}`／`arcLight {key, arc}`（光源拖曳／半徑把手（聚光燈連方向）／弧端把手放開）、`ctx {tx, ty, wx, wy, key, cx, cy}`（右鍵，wx/wy 世界座標，cx/cy 是 iframe 裡的 client 座標）、`key {key, ctrl, shift, alt}`（iframe 有焦點時的鍵盤，分頁照自己的快捷鍵處理）、`disarm`（指定中按右鍵）、`time {t}`（▶ 播放中的時鐘）。
- 角色、物品、部位等遊戲資料（`role.json`、`item.json`、`part.json`、`anim.json`、`fx.json`、`particle.json`、`ability.json`、`local.json`）在別的分頁存檔時，sandbox 的 DB 就舊了：分頁收到廣播就整個重開 iframe（工具列「重開」同）。
- `textures.json` 例外，不重開（擺設「存檔…」存進 `textures/` 也會觸發：vite watcher → 殼廣播；分頁自己發的廣播收不到）：分頁送 `textures`，sandbox 重抓 `json/textures.json`、用 `src/core/texlist.js` 的 `queueTextures()`（Preloader 同一支）只補載還沒有的 key；載到東西才把「之前缺圖」的木偶（身上有 `__MISSING` 貼圖）跟 prefab 實例（零件 `img` 的 key 不存在）拿掉，再跑一次非 force 的 `_apply()` 重建（缺圖的擺設本來就會重試），其他東西、鏡頭、時間、表演狀態都不動；連續來幾次排隊處理。同一個 key 換了內容（覆蓋）不會換新，要按「重開」。
- **sandbox 絕不寫遊戲存檔**：`Record.noSave = true`（`saveGame()` 直接 return），`Record.game` 是 sandbox 自己的一份。
- 鏡頭：滾輪以游標為中心縮放（0.25～8）、中鍵拖曳平移；每張底圖的鏡頭記在 sandbox 的記憶體，換場景回同一張圖接著看；第一次看＝整張放進畫面（工具列「置中」同）。拉左／右欄、縮放視窗（iframe 變大小或移位）時場景裡的東西在螢幕上不動、zoom 不變（`_onResize` 讀 `frameElement` 位置扣回去；舊寬高自己記，因為 CameraManager 會先改好鏡頭大小）。開發版掛 `window.__sb`（Sandbox 場景）給測試。

## 資料：`tools/scenes.json`

手寫來源檔（工具寫），進 git，`{<場景名>: {...}}` 可多組；遊戲不讀。存：底圖、時間（＋自訂環境色）、角色實例、擺設、粒子發射點、角色身上的狀態特效。

- 一筆＝`{map, time?, ambient?, roles?, props?, particles?, lights?, prefabs?}`（`time`／`ambient` 見「日夜」）；角色 key 是 `r<n>`、擺設是 `p<n>`、粒子發射點是 `e<n>`、光源是 `l<n>`、prefab 實例是 `f<n>`，選取／👁／Del 共用同一套 key：
  - `prefabs`：`[{key, prefab, x, y, look?}]`（x/y＝錨點），見 [prefab.md](prefab.md)；prefab.json 本身也由這個分頁寫（選中實例時右欄改、先存草稿，按儲存才寫），跟 scenes.json 同一個 undo。
  - `particles`：見「特效」；角色另有 `fx: [fx.json id]`。
  - `props`：`[{key, img, x, y, sx?, sy?, pct?, flip?, angle?, ox?, oy?, depth?}]`，見「擺設」。
  - `lights`：`[{key, x, y, r, color, i?, follow?, dir?, arc?, soft?}]`，見「光源」。
  - `map`：相對 `maps/`、不含 `.json`，新增預設 `sandbox`。
  - `roles`：`[{key, id, tx, ty, face?, equip?}]`；`key`＝場景裡的編號（`r1`、`r2`…取最小空號），`id`＝role.json，`tx/ty`＝格子，`face`＝`l`/`r`（沒寫＝角色預設面向），`equip`＝裝備覆寫 `{CAT_WEAPON: 'sword-1', CAT_HELMET: ''}`（有寫的格子換掉、`''`＝空著，沒寫的照 role.json 的 `inv.equips`）；沒有角色時整個欄位拿掉。
- 讀寫在 `tools/scene/store.js`：每次改都現讀硬碟 → 改 → 寫回（2 格縮排＋換行），回傳前後全文給 undo；undo／redo 要硬碟現在等於預期的全文才寫（別處改過就擋、提示、步驟留著），同地圖分頁。寫完廣播 `scenes.json`，別的分頁收到重讀。
- 沒有檔＝空的、不建檔，第一次新增才建 `tools/scenes.json`。

## 底圖

- 預設 `public/assets/maps/sandbox.json`（24×16 格草地，`terrain_tiles_v2` 的 52 號、一個空的 `objects` 物件層；不進 `main.world`、不進總覽地圖；地圖分頁的「其他」組看得到它）。
- 工具列「底圖」下拉（`maps/` 底下所有 .json，含子資料夾，`sandbox` 排第一；寫場景的 `map`，sandbox 帶著場景 `scene.restart`）可切任一現有地圖；角色、擺設、粒子照場景檔的座標建（不會因為換圖搬位置）；sandbox 只建地形＋靜態物件（門、床、燈、井…，燈照常、門點了不切換），不建 NPC／怪物／動物／作息角色、不跑 `@群組`。
- 沒有預設玩家；鏡頭自由（滾輪以游標為中心縮放、中鍵拖曳平移）。

## 角色

- 從 role.json 挑 id（照 kind／grp 分組），同 id 可多隻。
- 實例可覆寫：裝備五格（武器／頭盔／護甲／手套／靴子，空＝用 role.json 的）、面向、位置；不寫回 role.json。
- 位置永遠在格子中心（遊戲的走路／擊退靠它）。
- 木偶：`src/roles/puppet.js`（`Puppet`，照 `Dummy` 木樁的組法）掛 `RoleView`＋`COM_Inventory`＋`COM_Anim`＋`COM_Action`＋`COM_Nav`＋`COM_Stats`＋`COM_Disp`＋`COM_Ability`，不掛 AI／作息／感知、不進回合、不讀寫存檔、`bb.interactive=false`（點選是 sandbox 自己判斷：身體方塊包住游標的最上面那個，沒有就看站在那格的）；`bb.meta` 是 role.json 那筆的淺拷貝、`inv.equips` 換成套完覆寫的（`Puppet.equipsOf()`）。只在 Sandbox 用到，正式版一起被 tree-shake 掉。
- sandbox 套場景時照 `key` 比對：那筆資料（JSON）沒變的角色留著，變了（換角色、格子、面向、裝備）或不見的就 `dismiss()` 重建（重新登記路網權重）。
- 操作：畫面上左鍵點選（綠框）＋拖曳（跟著格子跳、放開才寫檔）、右鍵「在這裡放角色…」（挑角色對話框：照 kind／grp 分組、搜尋、雙擊確定、預設上次挑的 `tools.scene.lastRole`）／「刪除」；左欄角色清單（👁 暫藏只在這次開著時、不寫檔、藏著點不到；右鍵刪除；「＋」放在地圖中間）；右欄 角色（換 id）、格子、面向、裝備五格（下拉＝（原本：…）／（空）／那一類有 `equip` 的道具，限定性別不符的不列）、刪除；Del 刪選中的（分頁或 sandbox 有焦點都行）。

## 動作（表演，不進 undo、不改場景檔）

- 選施放者 → 右欄「動作」下拉：普攻（照武器近戰／遠程）、走路、ability.json 任一技能（不管學沒學）→ 按「🎯 指定目標」→ 點畫面上的角色或格子（橘框跟著游標）；指定中每點一下做一次，右鍵／Esc 取消，換選別的角色也取消；指定中左鍵不選取、不拖曳。
- 普攻：點到別的角色＝`root.attack([目標])`（真的命中），點空格／自己＝`anim_melee` 只揮不打。遠的照樣原地揮、照樣命中，不自動走過去。
- 技能：`useAb(目標, id, 點的格子, {...技能, range: 地圖長邊})`（`com_ability._use()` 的第 4 個參數＝用這份資料代替 `DB.ability(id)`，sandbox 拿來忽略射程；遮擋照算），治療沒點到角色＝自己；冷卻會記但不擋、MP 不檢查；要特定武器（`reqClass`）的沒拿就提示；放不出來（單體沒點到角色等）提示在狀態列。
- 走路：`findPath` → 一直 `move()` 到抵達（真的佔格子、走路晃動）；走不到提示。
- 同一個角色動作還沒做完再叫它做＝提示「還在動」。
- 走真的 com_action 編排與**真的傷害路徑**（數字、MISS／閃避、擊退換格子）：`Puppet` 包住 `takeDamage`，扣血前把 HP 墊到「滿血＋這次傷害」，打完剛好滿血、不會死（致命一擊照樣不死）；`bb.noCombat` 不切戰鬥模式。
- 被打（`anim_hit`，只閃白）、倒地（HP 歸 0、`ONDEAD`）／復活（補滿、`ONREVIVE`，有 `corpse` 的角色不支援）。
- 空白鍵重播上一個動作（sandbox 記著，分頁或 sandbox 有焦點都行）；工具列「重置」＝`reset`：所有角色照場景檔重建（回原位、站起來）、表演生出來的 `uid===-1` 物件（火牆區域、屍體…）清掉。

## 特效

- 狀態特效：角色右欄「狀態特效」下拉加 fx.json 的 id（存在角色的 `fx` 陣列），常駐到「解除」（從陣列拿掉）；「tick」播一次 tick（表演，`fxTick`）。sandbox 走 `com_disp` 的 `fxOn`／`fxOff`／`fxTick`（同遊戲）；角色資料比對不含 `fx`（`Sandbox._sig()`），加減狀態不重建角色，新的 `fxOn`、拿掉的 `fxOff`（播 end）。倒著的角色不動它的狀態。
- 粒子發射點：`particles: [{key:'e<n>', id, x, y, follow?, every?, def?}]`（particle.json 的 id；stream 持續噴、burst 每 `every` ms（預設 1000）重噴一次）；`follow`＝角色或擺設 key（見「跟隨」），x/y 變成相對它（`playParticle` 的 `target`＋`ox/oy`）；角色／擺設重建（換裝、移格子、改擺設）後發射點跟著重建。
- 發射點自己那份粒子 `def`（整筆 particle.json 條目）：沒有＝照 particle.json 的 `id` 播（sandbox `e.def ?? DB.particle(e.id)`）；**不寫 particle.json**。右欄「粒子內容」是粒子分頁同一份表單（`tools/particle/pform.js` 的 `createPForm()`，假 doc `PS`：`data` 只放選中那個發射點，`pCommit()` 改完 `setEmitter(key, {def})` 立刻寫 scenes.json＋場景 undo；樣式 `tools/particle/pform.css` 的 `.pform`），含四框、其他 Phaser 欄位、整筆 JSON、檢查警告。表單第一次改、拖 zone、或按「複製」才把那筆整筆拷成 `def`，之後跟 particle.json 脫鉤（右欄標「自訂（從 X 複製）」、物件樹 id 後面 ✎）；「丟掉自訂」拿掉 `def`；「粒子」下拉換別筆＝丟掉 `def`，`def` 跟來源不一樣時先問（取消不換）。數值欄連按 ↑↓ 併成一步 undo（`commit()` 看 `hist.js` 的 `take()`、而且上一步的 after＝這次的 before 才併），右欄重畫後焦點還給同一個 `data-k`。
- zone：選中的發射點（👁 藏著不畫）在 sandbox 畫 emitZone（綠）／deathZone（紅虛線），原點＝發射位置＋粒子自己的 x/y（`_zoneOrigin()`）。左鍵點選優先順序：選中 zone 的把手 → 發射點／光源記號 → **zone 框線**（螢幕上框線內外各 6px，`pzone.js` 的 `edgeZone()`，蓋過角色／擺設，zone 跟擺設重疊時點框就選得到）→ 角色／擺設（`_pickAt()`）→ 都沒點到才算 zone 內部（大片 zone 不擋底下的東西）；疊在一起都挑面積小的；右鍵不受框線影響，照舊給底下的東西；游標照同樣順序（框線上＝`move`）；拖本體移動、拖白色把手改大小／半徑／端點（把手挑最近的），Shift 吸 4px，放開送 `zone {key, k, z}`，分頁寫進 `def`（沒有就先整筆複製）。幾何純函式在 `src/core/pzone.js`（粒子分頁 schema.js 轉出口）。

## 光源

- `lights: [{key:'l<n>', x, y, r, color, i?, follow?, dir?, arc?, soft?}]`：Light2D 光源（擺設、角色、地形都是 Light2D）。`arc`（光錐全寬，度）有填且 <360＝聚光燈，`dir`＝方向（度，0 右、順時針）、`soft`＝錐邊淡出比例（0～1，預設 0.2），沒填＝點光源；`Light2D` 已換成 `src/core/spotlight.js` 的 pipeline（`light.spot`，sandbox `_lightSpot()` 寫）。跟著角色時資料＝角色朝右的樣子，角色 `faceDir()` 是 −1 就鏡像（x 偏移取負、方向 `180−dir`，`_mirror()`；拖曳／把手寫回的是鏡像前的數字），跟著擺設不翻。`i` 沒寫＝`GM.LIGHT`（1，同 `com_lamp`／`com_light`），寫了用它；強度不跟日夜變，天越亮燈越加不上去是 shader 的柔性壓縮做的（見下面）。新的預設 `{r:120, color:'#ffcc88'}`。擺設原本的 `light`（黏在圖上的發光）拿掉了，燈＝擺設＋跟著它的光源。
- 畫面：每個光源一個光色圓點（黑框，選中綠框，固定 6 螢幕 px）；選中時畫虛線圈＝半徑、圈右邊一個白色把手拖 `r`（游標到圓心的距離，整數、最少 1，Shift 吸 16 的倍數，放開送 `radiusLight`）；聚光燈改畫扇形虛線（兩條邊＋弧，中線淡淡的），半徑把手在中線末端、拖它連 `dir` 一起改（Shift 吸 15°），弧兩端各一個把手拖 `arc`（＝兩倍的游標跟中線夾角，1～359，Shift 吸 15°，放開送 `arcLight`）。點選優先於角色／擺設（排在發射點後面）、拖曳（Shift 吸 16px）、方向鍵、Del、👁（藏＝強度 0、點不到）。右鍵「在這裡放光源」、左欄「光源（n）」＋（地圖中間），不問東西直接放。
- 右欄：位置（跟著時是相對）、半徑、光錐／方向／柔和（光錐空白＝點光源，方向跟柔和反灰）、顏色、強度（空白＝自動）、跟著。
- 遊戲裡 Tiled 的燈（`com_lamp`）照讀自訂屬性 `dir`／`arc`／`soft`（不能叫 `angle`：Phaser 會直接設到 Container 本身的 angle）；`com_light`（道具 `light`）還沒支援。shader 另外把「環境光＋燈光」每通道超過起壓點（0.8 跟環境光取大的）的部分柔性壓縮、不超過 1（疊燈不爆白、環境光本身不被壓暗、白天燈自然加不上去）；燈的強度因此固定 `GM.LIGHT`，不再照環境光算（舊的 `GM.LIGHT − 環境光.r`、`regTS`／`UPDATETIME` 重算都拿掉了）。

## 記號開關（光源、粒子）

- 工具列「☑ 光源記號」「☑ 粒子記號」（預設勾、記 `tools.scene.lightIcon`／`tools.scene.particleIcon`、送 `icons {light, particle}`，`syncGame()` 一開就送）：沒勾時光色圓點／橘色菱形不畫、畫面上點不到（點擊落到底下的角色／擺設），**選中的那一個例外**（從左欄選）：照樣畫記號（光源連虛線圈＋半徑把手）、能拖、方向鍵、Del，取消選取又藏。只管記號，光照跟粒子照常；👁 藏的照舊什麼都不畫。不寫 scenes.json、不進 undo（`Sandbox._markOn(kind, key)`）。

## 跟隨（粒子、光源）

- `follow` 可以是角色 key（相對 root＝站的格子中心，分頁換算用 `tx*32+16`）或擺設 key（相對擺設的錨點 x/y）。sandbox 用 `_target(key)`（木偶或擺設的 sprite）；擺設是非同步建的（外部圖要載），所以 `_apply()` 等擺設套完才套粒子跟光源，對象換了（重建）就跟著重建。跟著的光每幀在 `update()` 跟上（`_syncLights()`），粒子用 `playParticle` 的 `target`。
- 右欄「跟著」下拉（`followSelect()`）：（不跟）／角色／擺設，換對象時位置換算（`refollow()`），畫面上不動。
- 刪掉被跟的角色／擺設：跟著它的粒子、光源改成不跟、位置加回去變絕對（`deleteObj()`，同一筆 undo）。
- 畫面上每個發射點畫一個橘色菱形（選中變綠，只在 sandbox 裡）：點選優先於角色／擺設、拖曳（同擺設，Shift 吸 16px）、方向鍵、Del、👁（藏粒子＋記號、點不到）。右鍵「在這裡放粒子…」、左欄「＋」（地圖中間；挑粒子對話框預設上次挑的 `tools.scene.lastParticle`）。
- 區域（火牆等）走技能施放。

## 擺設

- 圖：「textures 圖…」（icon 選圖器 `IC.pickIcon`，支援 sheet／atlas frame）或「外部 png…」（`showOpenFilePicker`；在專案裡的直接記 `file:<相對專案路徑>`，專案外的先複製到 `images/scene/`，重名加 `-2`），不必先放進 textures/。拖檔進畫面沒做（iframe 會吃掉 drag 事件）。
- sandbox 載外部圖：texture key 就是 `file:…` 字串，第一次用到才 `load.image`（完整網址 `location.origin/…`，不然 loader 會接在 Preloader 設的 `assets/` 後面；`public/` 底下的檔 vite 放在網址根目錄，要去掉 `public/`）；載不到提示「載不到圖」、不建。
- 屬性：位置（錨點的世界座標 x／y，整數 px）、大小（見下）、左右翻轉、角度、錨點 ox／oy（預設 0.5／1）、深度偏移（depth＝y＋它）、一律 Light2D；要發光另外放光源跟著它（見「光源」）。
- 大小（同紙娃娃兩段）：`sx`／`sy`＝擺放（預設 1、等於 1 不存），`pct`＝只有 `file:` 圖有、「存檔…」烤成原圖的幾 %（100 不存；換圖成 textures 圖時拿掉）；畫面＝原圖像素 × pct% × sx／sy（sandbox `setScale(k·sx, k·sy)`，不真的縮圖），`%` 跟 scale 不互相換算。面板三列：`%`（一格，說明在 title，右邊灰字「原圖 W×H」）、`scale`（☐ 等比：勾著＝sx＝sy 只有一格，狀態從資料推，sx＝sy 時取消勾選記在記憶體 `freeRatio`；勾回去 sy＝sx；右邊灰字 file 圖＝「縮放後 W×H」＝原圖×%（烤完那張的大小，還沒乘 scale）、textures 圖＝「原圖 W×H」）、`寬高`（畫面 px＝四捨五入；file 圖多「鎖 [%｜scale ▾]」下拉記 `tools.scene.sizeLock`：鎖 %＝改寬→sx、改高→sy（等比勾著兩個一起），鎖 scale＝改寬或高→反算 pct、另一邊等比跟著變；textures 圖永遠是鎖 %）。原圖尺寸：file 圖載 `<img>`、textures 圖 `IC.frameOf()`（sheet／atlas 是格子大小），快取在 `sizes`。
- 「存檔…」（只有 file: 圖）：把原圖縮成 pct%（Canvas `imageSmoothingQuality:'high'`，只等比、sx/sy 不烤）**另存一份 PNG，場景完全不動**（img／pct／sx／sy 不換、不寫 scenes.json、不進 undo），pct 100 也能存（＝原尺寸收編）。對話框切「存到 textures」（資料夾樹只列 `textures/`，不列 `.tbd`／`minimap`，預設上次選的 `tools.scene.exportDir`）／「存到原始路徑」（整個專案的資料夾樹，預設原圖的資料夾），模式記 `tools.scene.exportMode`；樹裡每個資料夾在子資料夾後面列出 `.png`（純文字、照名字排），點檔案＝選它的資料夾＋把檔名（去 `.png`）填進檔名欄（還能改），擺設正在用的原圖標灰；檔名預設存到 textures＝`<原檔名>`、存到原始路徑＝`<原檔名>-copy`，切模式時檔名還是上個模式的預設才跟著換（改過、點檔案填過就不動）。同資料夾有同名檔先 `confirm` 問要不要覆蓋；擺設自己的原圖一律擋（覆蓋會讓 pct 縮兩次）；存進 textures/ 裡的還要檢查整個 textures/ texture key 撞名（大小寫不分，覆蓋的那張自己不算）、寫完打 `POST /__tools/textures` 更新圖片清單＋廣播 `textures.json`。核心是 `bakeProp(key, 資料夾, 檔名, overwrite)`（無頭測試直接呼叫，樹是 `folderTree(root, cur, onPick, self)`）。場景分頁的 `#dlgAsk` 外框不捲（`index.html` 覆寫共用 `style.css` 的 `.body` 60vh 捲動）：視窗矮時只有 body 裡的 `.treebox` 縮（最少 80px、自己捲），沒有 treebox 才讓 body 捲，按鈕一定看得到。
- 深度照錨點 y 自動排，跟角色互相遮擋；不擋路。
- 錨點：工具列「☑ 錨點」（預設勾、記 `tools.scene.anchor`、送 `anchor {on}`）勾著時選中的擺設（sprite x/y）或角色（root x/y＝套用 `role.anchor` 後站的點）畫黃點黑框＋十字（半徑 4 螢幕 px；原本的綠點跟綠框同色、壓在框線下邊上看不出來），沒勾不畫；只畫選中的那個（`_anchorPt()`）。
- 操作：右鍵「在這裡放擺設…」（錨點＝點的位置）、左欄「＋」（地圖中間）；左鍵點選（綠框＋錨點黃點；角色跟擺設重疊時點到深度高的）、自由拖（整數 px，按住 Shift 錨點吸 16px＝格子交點＋格子中心，圖跟光一起動，放開才寫檔）；方向鍵 1px、Shift＋方向鍵 32px（每按一下一筆 undo）；Del 刪。
- 畫面上拉大小：選中的擺設綠框上 8 個白色把手（4 角＋4 邊中點，固定 6 螢幕 px，游標換 resize；`angle≠0` 不出把手，用面板調），把手優先於點選。拉邊改一軸、拉角兩軸，**對邊（對角）固定**、錨點 x/y 重算（取到 0.01）；改什麼照面板：鎖 %＝`sx`/`sy`（等比勾著兩軸等比：角照拖得多的那軸、邊的另一軸繞錨點長），鎖 scale（file 圖）＝`pct`（一定等比）。Shift＝被拉的邊吸 16px（½ 格），等比時另一軸照比例。最小 1px、拉過對邊不翻面；拖曳中 sandbox 直接改 sprite 預覽，放開送 `resizeProp {key, patch}`、分頁 `setProp` 一筆 undo（sx/sy＝1、pct＝100 拿掉）。鎖跟等比狀態由分頁在 `select {key, lock, ratio}` 帶給 sandbox（`selMsg()`），切換鎖／等比時重送。sandbox：`_handles()`／`_handleAt()`／`_startResize()`／`_resizeTo()`。

## 格線與吸附

- 32×32 格線（`GM.TILE_W/H`），可開關（localStorage）。
- 角色一律吸格子中心。
- 擺設／粒子自由拖，按住 Shift 錨點吸 16px（格子交點＋中心）。
- 游標（`Sandbox._cursor()`，pointermove／down／up、`arm` 時重算）：🎯 指定中＝`crosshair`；拉大小／半徑中照把手；拖曳（角色／擺設／粒子／光源）或中鍵平移中＝`grabbing`；hover 擺設大小把手＝對應雙箭頭、光源半徑把手＝`ew-resize`；hover `_pickAt()` 點得到的（記號藏著、👁 藏著的不算）＝`grab`；其他預設。
- 方向鍵 1px（固定，沒接設定分頁的步進），Shift＋方向鍵一格。

## 日夜

- 工具列第二排：🕒 時間滑桿 00:00～23:59（1 分）、▶／⏸、倍速（每秒走 10／60／240 分鐘遊戲時間）、「自訂環境色」勾選＋色票。
- 時間是 sandbox 的真 `TimeSystem` 時鐘：設 `TimeSystem.time` 再 `emit(0)`；sandbox 在 `TimeSystem.load()` 後第一個註冊自己的環境光（`GameScene.getAmbientColor()`＝`lutAmbient[小時]`，整點換，同遊戲）。木偶不註冊時間（不會扣裝備耐久）。
- 拖滑桿＝即時預覽（`time {t}`，不寫檔），放開才寫場景的 `time`（`'HH:MM'`，等於 `08:00`＝`Record.game_def` 的開局時間就拿掉欄位）。
- ▶ 播放：sandbox 每 100ms 推時鐘、回報 `time {t}` 給分頁（滑桿跟著動），不寫檔；⏸ 把停下來的時間寫進場景。播放中編輯別的東西不會把時間拉回去（sandbox 只在場景檔的 `time` 變了才跳）。sandbox 重開（換底圖、重開鈕）後分頁會再送一次播放狀態。
- 自訂環境色：場景的 `ambient`（`'#rrggbb'`）蓋掉 LUT，時間照走（燈照樣算）；調色票時即時預覽（`ambient {color}`），放開寫檔；取消勾選拿掉欄位。

## 編輯

- 立刻寫檔＋undo（Ctrl+Z／Ctrl+Y），拖曳放開才寫，存檔廣播。

## 版面（三欄，排在「粒子」後面）

- 左：最上面 prefab 庫（見 prefab.md）；每段標題點一下摺疊（記 `tools.scene.fold`）；場景清單（＋ 新增；右鍵 改名／複製／刪除，雙擊改名；點選中的再點一次＝取消選取＝空白 sandbox；選取記 `tools.scene.sel`）＋目前場景物件樹（角色／擺設／粒子，👁 暫藏、Del 刪；第 2 步起）；下方 ↶／↷（Ctrl+Z／Ctrl+Y）。
- 中：iframe＋工具列（底圖、格線、置中、重置、重開）＋第二排（時間／▶／倍速／自訂環境色）；左鍵選取拖曳、右鍵選單放東西。
- 右：選中物件的屬性；角色下方是動作區。左邊框可拖拉改寬（`data-resize-right`，記 `tools.right.scene`，雙擊回預設 320px），遊戲畫面吃剩下的。

## 實作順序（每步 commit＋`scripts/test/scene-tool.mjs`＋更新本文件）

1. ✅ 骨架：`?sandbox=1` 路由＋`Sandbox` 場景（不存檔）＋`sandbox.json`；分頁殼、iframe、postMessage 協定、場景清單、scenes.json 讀寫＋undo、鏡頭、格線
2. ✅ 角色：放置／拖曳／刪除、裝備覆寫、面向、木偶化
3. ✅ 動作：普攻／技能／走路／被打／倒地／重播／重置、自動補血
4. ✅ 擺設：選圖、全部屬性、吸附、方向鍵（發光後來拆成獨立光源）
5. ✅ 特效：狀態特效、粒子發射點
6. ✅ 日夜＋底圖：時鐘滑桿／播放／自訂色、切現有地圖（濾掉角色）
