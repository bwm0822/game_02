# Prefab（png＋粒子＋光源＋fx 組成的物件）

2026-11-17 定案，同日 6 步全部完成。在場景分頁把 png／粒子／光源（png 可掛 fx）組成可重複使用的物件，存成資料，遊戲（Tiled 地圖、放置道具）跟場景分頁共用。

## 資料：`public/assets/json/prefab.json`（手寫來源檔，`DB.prefab(id)`）

```json
"forge": {
  "look": "off",
  "acts": {"fan": "on", "douse": "off"},
  "defAct": "fan",
  "body": {}, "grid": {}, "zone": {},
  "thumb": {"x": -40, "y": 8, "w": 80, "h": 96},
  "parts": [
    {"img": "forge", "x": 0, "y": 0, "sx": 1, "sy": 1, "depth": 0},
    {"img": "forge-fire", "x": 0, "y": -20, "look": "on", "fx": "flicker"},
    {"particle": "smoke", "x": 30, "y": -44, "look": "on"},
    {"light": {"r": 120, "color": "#ffcc88", "dir": 0, "arc": 360, "soft": 0.2}, "x": 0, "y": -16, "look": "on"}
  ]
}
```

- id 一律 ASCII。座標全部相對**錨點**（＝GameObject 位置、ItemView 原點、y 排序基準）。
- **狀態**：自由命名的單一狀態，存 `bb.look`（不用 `bb.sta`，那是現有的物件狀態）。零件沒寫 `look`＝永遠出現；寫了＝只在那個狀態出現。`look` 只能一個名稱，三狀態以上真的需要時再擴充成陣列。狀態名稱沒有任何零件用到 → `dlog` 警告、只顯示沒寫 `look` 的零件，不當掉。零件寫 `off: true`＝停用（2026-11-22，場景分頁零件列的勾選框）：資料留著，遊戲跟 sandbox 都不建、縮圖（`thumbImgs()`／`thumbBoxImgs()`）跟 ghost（`defaultImgs()`）都不算。
- `acts`：右鍵選單動作 id → 切到的狀態。按鈕文字＝`'<id>'.lab()`（local.json）；目標狀態＝目前狀態的那個 act 藏起來。也可以用現有的 key（`turn_on`/`turn_off`）。
- `defAct`：選填，左鍵預設動作；沒寫的話 acts 不進左鍵預設（`ORDER`）。
- `grid`／`zone`：占地方塊（相對錨點的 `{x,y,w,h}`，見 [anchor.md](anchor.md)），**沒寫＝沒有**（沒 grid＝不佔格、沒 zone＝點不到）；Tiled 物件寫了量邊的 `gl…`／`zl…`（量縮圖外框）就整組蓋掉。body 已拿掉。
- `thumb`：縮圖範圍＝**所有狀態**的 png 零件（停用 `off` 的不算）旋轉後外接框的聯集，相對錨點的 `{x,y,w,h}`；Tiled tile 物件座標換算回錨點、`view.rect`（遮擋、點選、fx 對齊）都用它，所以要包住任何狀態會出現的 png。沒有 png＝不寫（`thumbOf()` 預設 32×32、錨點在底部中間）。工具算（`thumbFor()`），不要手改。
- **縮圖圖**（`textures/prefabs/prefab-<id>.png`＝Tiled 圖示＝場景分頁 prefab 庫的圖示）：只畫**永遠出現**（沒寫 `look`、沒 `off`）的 png 照 depth 合成（`src/core/prefab.js` 的 `thumbImgs()`），所以掛 `look` 的零件佔範圍但不畫（留透明邊）；一張都畫不出來＝半透明底＋1px 外框。不人工挑選、沒有欄位（2026-11-24 定案）。放置道具的 ghost 不跟縮圖，照舊畫預設狀態的 png（`defaultImgs()`）。
- 零件：
  - `img`：texture key，`sx`/`sy`/`angle`/`flip`/`ox`/`oy`/`depth`（只排 prefab 內部前後），選填 `fx`（fx.json id，跑 `fxcell.js` 的 idle，切狀態時 spawn／end）。
  - 粒子（2026-11-22 改）**只能是 `{particle: id}`**＝參照 particle.json，內容一律集中在 particle.json（粒子分頁的引用／未使用／缺粒子才算得準、方便 mod 蓋）。零件自己的 `{def}`（11-21～11-22 有過）已拿掉：遊戲只播 `DB.particle(particle)`、查不到不噴＋dlog，`{def}` 零件不建；場景分頁零件列標「⚠ 零件自己的粒子（已不支援）」、表單只能換成一個 id。原本 forge 的兩個 `{def}` 搬成 `forge-smoke`／`forge-fire`。粒子零件也能寫 `depth`（2026-11-21）：粒子勾 `local` 時跟 png 一起照零件 `depth`（同值照清單順序）排，**不管粒子自己的 `depth:'under'`**；沒勾 local 的粒子不能插在 png 中間，整個在 prefab 前面（root depth +0.5）、粒子 `depth:'under'`＝整個在後面（−0.5），零件 `depth` 無效（右欄反灰）。光源不是畫面物件、沒有前後，只照亮 Light2D 的 png（粒子不吃燈）。
  - `light`：寫在 prefab 裡（`r`/`color`/`i?`/`dir`/`arc`/`soft`）。光源閃爍以後再說。
- png 零件可以在場景分頁切前後片（展開的零件表單「切前後片…」，見 [scene-tool.md](scene-tool.md)「切前後片」）：切成兩個獨立的 png 零件，後片插在前面、其他欄位照抄，遊戲照一般零件畫。
- 實例不能覆寫零件；要不一樣就另做一個 prefab。

## 遊戲

- `ItemView`（`src/components/view.js`）看到 `bb.prefab` 就整個接手（不另開 com，所有掛 ItemView 的物件自動支援）：`_setData()` 套縮圖大小、錨點、沒被 Tiled 覆寫的占地方塊；`_addShape()` 不建單張圖，`_shape`＝放在錨點的 container，png 零件各包一個 holder（fx tween 動 holder）照 `depth` 排；粒子 `playParticle({target:root, parent:_shape, followDepth:true})`：local 的 emitter 進 `_shape`，`_sortParts()` 照零件順序 `bringToTop` 排回去（一開始就有的跟切 look 才出現的同一個位置；以前加進 root 時 view 還沒加進 root，所以被 png 蓋住、切 look 出現的又跑到上面），world 的 depth 每幀跟著 root；光源 `scene.lights.addLight`＋`setSpot`（`i` 沒寫＝`GM.LIGHT`）。outline／遮擋半透明照舊作用在 `_shape`。`root.setTexture`／`setShape` 對 prefab 無效。
- `root.setLook(x)`／`root.getLook()` 切狀態（遊戲中切換播 fx 的 spawn／end，讀檔直接建不播）；ItemView 的 `save()`／`load()` 存讀 `look`（`Item` 也補了 `this.load()`）。
- 純裝飾的 prefab 用現有的 `type:"item"`（`Item`：不可互動、SOLID 遮擋）。
- `acts`：ItemView `_bindActs()` 用 `_setAct` 註冊、`root.on(<act>)` → `setLook`；有 acts 的 prefab 自動 `interactive`（純裝飾的 `item` 也點得到）。`defAct` 存 `root._defAct`，`GameObject.act`（左鍵／游標）先看它可用就用，否則照舊 `ORDER`（所以 acts 預設不搶左鍵）。
- 有 prefab 的 lamp：光源跟開關都由 prefab 管，`com_lamp` 看到 `bb.prefab` 整個不動作（`lit` 也忽略，初始狀態看 prefab 的 `look`／Tiled 的 `look`），prefab 要自己寫 `acts:{turn_on, turn_off}`。
- `UiOption.checkItem()`：沒見過的 act key 第一次要顯示時才建按鈕（建一次重用），文字 `key.lab()`（local.json 沒有＝紅字 key）；游標沒對應圖示＝預設游標。
- 存檔：`bb.look` 跟著 prefab／runtime 存檔。
- 來源：
  - Tiled：物件屬性 `prefab`（自動產生的 template 帶），可覆寫 `look`、`type`（行為照舊由 `type` 決定）。
  - 放置道具：`item.json` 的 `bb.prefab`（`init_runtime` 本來就 `Object.assign(bb, dat.bb)`），runtime 存檔帶 `look`，放置 ghost 用縮圖。
- 不做（以後再談）：story 指令／條件控制狀態、使用中自動切換、runtime 用程式任意 spawn、光源閃爍、`look` 陣列、`drop.prefab`。

### 拿在手上：`equip.prefab`（2026-11-24）

- 手持道具（武器、`CAT_EQUIP` 如火把）的 `item.json` `equip.prefab: "<id>"`：**疊在** `equip.sprite` 上（本體照舊是紙娃娃拆的 png，prefab 放火焰粒子、光源，也可以有 png）。
- `RoleView._addEquipPrefab()`：錨點＝握點（equip 的 x/y/a，掛在同一個手腕節點的 holder），**跟著道具轉、翻面、播動畫**；零件座標是道具直立時的、遊戲單位、**不乘 `equip.scale`**。
  - png 零件進 holder（排在道具前面）。
  - 粒子：local 的進 holder（跟著道具轉）；其他的 emitter 進角色的 `rig`、緊接在那隻手的節點上面（depth＝節點＋0.01，`moveAbove`）＝蓋過道具、被身體擋，播動畫節點搬前後時跟著；發射點每幀（`scene` 的 `update`，`_trackEquipPrefabs()`）把零件點從 holder 換到 rig 座標，粒子設定不跟著道具轉（火焰往上冒，翻面由 shape 鏡像）。代價：已噴出的粒子在角色容器裡，走路時跟著角色、沒有拖尾。（第一版是世界座標＋排在整個角色前／後，後手時火焰被火把一起蓋住，2026-11-24 改掉）
  - 光源每幀挪到零件的世界位置。
  - 只用 prefab 的預設 `look`（不切狀態），`off` 不建。
  - 卸下／換裝（`_removeEquips()`）、`_remove()` 清掉粒子、光源、update 監聽；跟武器撞手不畫的道具不建。部位範圍 `_measure()` 不算手持道具跟它的 prefab。
- `equip.particle: {particle, x, y}`（2026-11-24）：只掛一個粒子時不用另開 prefab，`equip.js` 的 `equipPrefab()` 把它當成只有一個粒子零件的 prefab 走同一條路；跟 `equip.prefab` 二選一（都寫：遊戲用 prefab＋dlog）。沒有光源，所以 `com_light` 照舊開燈。
- `com_light`：有 `equip.prefab` 的道具不再開角色中心那盞燈（光交給 prefab 的光源零件）；沒有 prefab 的發光道具照舊。
- 工具：
  - 場景分頁木偶有第六格「道具」（sandbox 跑真的 `RoleView`，看得到火焰／光跟著手）。
  - **道具實例**（2026-11-24，取代之前選中 prefab 實例時畫的半透明參考圖 `_syncEquipRef()`）：左欄「道具」庫（有 equip 的武器／CAT_EQUIP）拖進畫面＝`scenes.json` 的 `items:[{key:'i<n>', item, x, y}]`，錨點＝握點。分頁裡 `instOf()` 把它當 prefab 實例（`prefab`＝編的那筆：`equip.prefab` 的 id，或 `@<道具>`＝`equip.particle` 合成的單零件 prefab `synPf()`），sandbox 收到的是 `@item:<道具>`＝那筆的零件＋**最後**墊一張直立的 `equip.sprite`（`scale`／`ox`／`oy`，depth −1e4，零件 index 不變，`itemSandboxPf()`），所以選取／拖零件／zone／光源把手全部沿用 prefab 實例那套；沒有占地方塊。右欄「手上：無｜prefab｜粒子」直接編（草稿，儲存一筆寫 item.json＋prefab.json＋particle.json）、發射點／prefab 實例右鍵「加到道具 ▸」，見 [scene-tool.md](scene-tool.md)「道具實例」。
  - 刪 prefab 時有道具的 `equip.prefab` 在用就擋，改名只提示要去道具分頁改；粒子分頁刪粒子時有道具的 `equip.particle` 在用也擋（改名只列）。
  - 試穿只畫記號（粒子橘菱形、光源黃圓、png 藍小方塊，跟著道具轉；`equip.particle` 一樣畫），跑不了粒子。
  - 道具分頁 equip 多「手上 prefab」「手上粒子」（`opt`，只給武器／`CAT_EQUIP`；兩個都寫、指到不存在的標 ⚠），表單標題列「↗ 場景」跳到場景分頁打開這個道具。

## Tiled

存 prefab 時自動產生：
1. 縮圖 `textures/prefabs/prefab-<id>.png`（預設狀態的 png 零件合成，不畫粒子／光源）
2. 圖片集合型 tileset `tilesets/prefabs.tsj`
3. template `templates/prefabs/<id>.tj`（`gid`＝縮圖、屬性 `prefab`、寬高＝縮圖）

遊戲裡 ItemView 有 `prefab` 就不畫 gid 那張縮圖，錨點用 `thumb` 從 tile 物件左下角換算。

在 Tiled 放：template 面板把 `templates/prefabs/<id>.tj` 拖進物件層存檔就好。Tiled 只把 tileset 記在 template 裡、**不會**加進地圖的 tilesets，讀取端自己補：遊戲 `TileMap._preload_TemplateTileset()`、工具／腳本 `navgrid.js` 的 `loadMap()`（地圖沒列的 template tileset 在記憶體接到最後，firstgid＝現有最大＋佔用數，集合型＝最大 tile id＋1；不寫回地圖），gid 換算＝地圖那份的 firstgid＋template gid−template 自己的 firstgid。

路網／mapcheck（`navgrid.js` 的 `placeObject()`）照 ItemView 同規則算 prefab：`loadMap()` 讀 `json/prefab.json` 掛到物件的 `pf`，錨點＝縮圖中心往回挪 thumb 中心、grid 相對錨點、沒 grid＝不佔格，Tiled 寫了 `gl…` 才照縮圖量。改了 prefab 的 grid／thumb 要重跑路網。驗證：`scripts/test/prefab.mjs` 最後一段（`m/m_04x05` 的 forge）。

外觀＋行為：template 的 `type` 決定 class（如 `forge.tj` 是 `stove`＋`isBlock`），prefab 的 `acts` 只切外觀、跟 class 的動作並列在右鍵選單，左鍵照 `ORDER`（forge＝烹飪）；狀態不限制別的動作（點火／熄火跟烹飪不綁，2026-11-21 決定，要綁是另一題）。`look` 跟 `COM_Manu` 的存檔並存不互蓋，`prefab.mjs` 有驗（熄火＋放東西 → 換地圖回來）。

## 場景分頁

- 左欄（每段都可摺疊，記住）：
  - 最上方「prefab 庫 ＋」：列出 prefab.json 全部（縮圖），點一下＝選目前場景第一個用它的實例、鏡頭移過去（sandbox `focus {key}`，沒有就提示拖進畫面），拖進畫面＝放實例；右鍵 改名…／複製…／刪除；＋＝新增空白 prefab（取 id → 立刻寫空的一筆 → 畫面中央放實例並選中）；有草稿的那筆標紅 ●。
  - 場景清單、角色／擺設／粒子／光源，多一段「prefab 實例 ＋」（＋ 選單挑 id、放地圖中間；畫面右鍵「放 prefab ▸」）。
- 實例（scenes.json）：`{key, prefab, x, y, look?}`；是真正的遊戲物件（同遊戲程式）。
- 組成：多選擺設／粒子／光源 → 右鍵「組成 prefab…」：錨點預設第一個擺設的錨點；`file:` 圖照 pct 烤成 `textures/prefabs/<id>/<檔名>.png`（撞名加 `-2`）、改寫 texture key、自動更新圖片清單；有自己那份 `def`（✎）的發射點在對話框每個一列（2026-11-22）：「另存新 id」（預設 `<prefab>-<原 id>`、跟著 prefab id 欄改預設，手改過就不動；撞名／彼此重複擋）或「覆寫 <原 id>」（標共用幾處），內容寫進 particle.json、零件寫 `{particle: id}`，跟 scenes.json＋prefab.json 同一筆 undo（測試用 `composePrefab(start, {keys, id, particles: {發射點 key: {mode: 'new'|'over', id?}}})`，沒給＝另存預設 id）；沒自己那份的直接 `{particle: id}`。原本那幾個東西換成一個實例。
- **加到 prefab**（2026-11-24）：擺設／粒子／光源右鍵（左欄或畫面）「加到 prefab ▸」→ 子選單列目前場景的實例（沒有實例＝反灰），**不開對話框**：加點的那個，點的是擺設就連跟著它的粒子／光源一起；位置換成相對那個實例的錨點（畫面不動）、新零件沒有 `look`、`depth` 原樣；`file:` 圖照 pct 烤、✎ 的發射點自動另存 `<prefab>-<原 id>`（撞名加 `-2`…）進 particle.json；**立刻寫** prefab.json＋scenes.json，收尾（`finishEdit()`）併成一筆 undo；有草稿先問 儲存／放棄／取消；完成後選中實例、新零件設成選取、零件區打開（`addToPrefab(key, 實例 key)`；`toParts()`／`dropFromScene()` 跟組成共用）。
- **移到場景**（2026-11-24，**沒有複製**）：零件搬成場景的擺設／發射點／光源（絕對位置＝實例錨點＋零件 x/y、不跟著東西；粒子零件變 `{id}`），prefab 拿掉它們；場景沒有的 `look`／`off`／`fx` 丟掉、狀態列列出；`depth` 原樣；舊的 `{def}` 零件不能移；**立刻寫**一筆 undo、有草稿先問（放棄後零件跟按的時候不一樣就不移）；最後一個零件也能移（prefab 變空）；完成後選中新的第一個。入口：展開的零件表單最上面「移到場景」、畫面上對選取的零件右鍵（多選＝全部，sandbox 的 `ctx` 訊息多帶 `part`）、左欄零件列右鍵（`partsToScene(實例 key, [i…])`）。
- **左欄 prefab 庫展開**（2026-11-24）：每筆 ▸/▾（可同時展開多筆，記在 `tools.scene.fold` 的 `libOpen:<id>`，改名跟著改，選實例不自動展開），零件列照草稿畫（同右欄的縮圖／🔥／💡＋名稱＋狀態，`off` 標灰）；點一下＝選那個 prefab 的實例（選中的實例是它就用它，不然場景第一個；沒有就提示）＋選取並展開那個零件，右鍵＝移到場景。
- **沒有編輯模式**（2026-11-18 拿掉）：選中實例時右欄三區，見下面「右欄編輯＋草稿」。
- scenes.json 的改動（含實例自己的欄位）立刻寫檔＋廣播；prefab.json＋scenes.json＋產生的檔案共用一個 undo 堆疊，一次動作＝一筆。

### 右欄編輯＋草稿

- 選中實例＝右欄三區，**每區可摺疊**（2026-11-18，標題 ▸/▾，跟左欄共用 `secHead()`／`foldSec()`，摺起來的記在 localStorage `tools.scene.fold` 的 `right.inst`／`right.props`／`right.parts`，全域一份、預設全展開；屬性裡的小段不再分層摺；不放操作說明字，操作看本文件）：
  1. **實例 `f<n>`**（scenes.json，立刻寫、不算草稿）：換 prefab（草稿中先問）、**位置**（錨點在場景的座標）、狀態（這個實例的初始狀態，兼當下面零件清單的篩選）。
  - 有草稿時「實例 `f<n>`」標題列右邊「● 未存［儲存］［放棄］」（`secHead()` 的 btn，摺著也在，按了不摺／不開）；沒草稿時什麼都沒有（2026-11-19 從實例跟屬性中間的草稿列搬上來、拿掉「Ctrl+Z 退草稿裡的步驟」提示字）。
  2. **屬性**（草稿；摺起來時 acts 有 local.json 沒有的 id 標 ⚠）：預設狀態、左鍵動作、右鍵動作 acts（local.json 沒有標 ⚠＋↗ 文字分頁）、占地方塊勾選＋x/y/w/h、縮圖外框（唯讀）。**錨點不能改**（2026-11-22 拿掉「移動錨點」＋錨點模式下拉）：錨點在組成 prefab 時就定了，之後要調就改零件跟方塊的數字。
  3. **零件（n）**（草稿；零件摺著時 `openPart()` 開一個零件（sandbox 點到）會自動打開並記住，收起零件不摺回）：一列一個（縮圖／🔥／💡（光源，滑鼠移上去看光色）＋名稱＋狀態），不屬於實例目前狀態的標灰；點一列在下面展開表單（一次一個，`S.part`＝index），↑↓ 排序、✕ 刪除，「零件」標題列右邊「＋png／＋粒子／＋光源」（摺著也在，按了自動打開；新零件放錨點、沒有 look）。png 表單同擺設（換圖可選 textures 或 `file:`、%／scale／寬高、翻轉、角度、錨點、深度＝prefab 內部前後、狀態、特效 fx.json）；粒子（2026-11-22 改）＝「粒子」下拉（最上面 `[新增]`，下面是 particle.json 的 id＋草稿裡新建、還有零件在用的 id；換 id 不問）＋↗ 粒子分頁（particle.json 有的才出）＋位置＋狀態＋「粒子內容：<id>」（這行是摺疊標題 `right.partParticle`，記在 `tools.scene.fold`、預設展開、所有粒子零件共用；標題後面：還沒進 particle.json 的標「新的」、草稿改過的 ●、別處也在用的「共用 n 處」（`particleUsers()`：prefab（照草稿）／能力／道具／特效，滑鼠移上去列出來，不掃地圖）；右邊「另存新 id…」＋JSON 鈕，摺著也在）＋嵌粒子分頁同一份表單（`pform.js`，狀態 `PQ`／`ppCommit()`，**改的是那個 id 的草稿副本 `S.draft.ps[id]`**，儲存時寫進 particle.json、共用的地方一起變）。`[新增]`（下拉或「＋粒子」，`NEW_PARTICLE`）先問新 id（預設 `<prefab>-<n>` 最小空號，英數字＿－、跟 particle.json／草稿撞名擋），範本 `SC.template()` 放進草稿副本；「另存新 id…」問 id（預設 `<prefab>-<原 id>`），把目前內容（含草稿改的）複製成新 id、這個零件改用它（測試用 `addPart(id, 'particle', '[新增]', 新 id)`、`changePartParticle(id, i, v, 新 id)`、`forkPartParticle(id, i, 新 id)`）；光源＝位置、半徑、光錐、方向、柔和、顏色、強度、狀態（`setPart()` 把 r/color/i/dir/arc/soft 寫進 `light`）。位置都相對錨點。
- **草稿**（`S.draft＝{id, key, base, pf, ps, pbase, thumb, undo, redo}`）：第一次改 prefab 內容才開始（`editPf(id, (pf, ps) => …)`），改的是記憶體副本，`pfOf(id)` 有草稿回傳草稿；`ps`＝粒子副本 `{粒子 id: def}`（`pDef(id)` 有副本用副本），`pbase`＝各粒子第一次碰時 particle.json 那筆的 JSON。送 sandbox 的 prefab.json 換成草稿（`prefabsMsg()`，同場景同 prefab 的其他實例也照草稿畫），particle.json 蓋上粒子副本（`particlesMsg()`，load 訊息的 `particles`，sandbox 直接換 `DB._particleDB`、不重開；實例／發射點的簽名含用到的粒子內容，變了就重建）。右欄「● 未存［儲存］［放棄］」。
  - 儲存（按鈕或 Ctrl+S，輸入框有焦點也行）：`saveDraft()` 寫 prefab.json＋粒子副本裡**還有零件在用的**（`livePs()`；`[新增]` 後換掉／刪掉零件的不寫）寫進 particle.json（同一次 commit），接著 `finishEdit()` 收尾（算 `thumb`、Tiled 縮圖／tsj／template、`file:` 圖照 pct 烤成 `textures/prefabs/<id>/<id>-<檔名>.png` 改寫 key），`mergeUndo()` 併成全域一筆。
  - 草稿自己一疊 undo（快照 `{pf, ps, part}`）：草稿中 Ctrl+Z／Y 只退草稿的步驟，退不到草稿之前的全域步驟。
  - 離開草稿：取消選取（`pickRole`）、換場景、會選到別的東西的編輯（`commit()` 的 sel／pick 換了）、換 prefab、刪掉／改名這筆、↗ 跳過來 → `leaveDraft()` 問「儲存／放棄／取消」。
  - 別的分頁改了 prefab.json 或 particle.json：重讀後比對 `base`／`pbase`（只看還有零件在用的粒子），那筆 prefab 或碰過的粒子變了就一起問（列出哪些）「保留我的草稿／放棄草稿用新的」（`draftConflict()`）；保留＝更新 base，儲存時蓋過去。
  - 草稿中拖實例／改實例位置：照樣立刻寫 scenes.json（實例位置不算草稿），草稿不影響實例座標。
  - 以前的「移動錨點」（零件＋方塊＋thumb 反向挪、草稿記 `dx/dy`、實例畫在存檔位置＋d）跟錨點模式下拉（◌／👁／✎）2026-11-22 整個拿掉，沒有替代品；選中實例的錨點一律＝拖實例。
  - sandbox 收到的草稿可能有還沒烤的 `file:` 零件：`Sandbox._pfFiles()` 把 img 換成 `file|<路徑>`（ItemView 用 `:` 切 frame）、pct 乘進 sx/sy，`_loadPartFiles()` 先載圖。
- **勾選＋選取**（2026-11-22，取代 2026-11-19 起的 ◌ hide／👁 show／✎ edit 模式下拉；`tools.scene.boxMode`、`setHiddenParts`／`_syncPartHide()` 都拿掉了）：
  - **勾選＝作用（寫草稿）**：占地方塊的勾選框照舊＝資料有沒有那個方塊；零件列最前面的勾選框＝零件作用，沒勾寫 `off: true`（遊戲 ItemView 不建、sandbox 也不建，`defaultImgs()`／縮圖外框／點選框都不算，資料留著；停用的列標灰、不能選取，停用時順便取消選取）。
  - **左鍵＝選取**（2026-11-22 從右鍵換過來；`togglePartSel(i)`／`toggleBoxSel(k)`，點一下切換、不用 Ctrl 就能多選，選取的列藍底 `picked`；點勾選框、數字欄、↑↓✕ 不算）：選取的方塊才在 sandbox 畫（不透明框＋4 邊把手），沒選的不畫；選取的零件才有外框、點得到、拖得動，沒選的照常顯示、沒外框、點不到。沒勾的方塊點了沒反應。選取只在記憶體（`S.psel {key, boxes, parts}`，`pselOf()` 只認目前選中的實例），取消選取／換實例／換場景清掉，↑↓／✕ 時跟著零件搬（`remapSel()`）。
  - **右鍵**：零件列＝展開／收起表單（一次一個，**不會選取**；展開的列沒有標記，靠下面的表單；展開的零件換了（收起→展開、換一個、↑↓ 搬、換實例，來源不限）才自動捲右欄一次（2026-11-23，`scrollOpened()`，直接跳不平滑）：列＋表單都看得到就不動、底部超出捲到剛好看到底、表單比右欄高就讓那一列貼頂；改數字等重畫不捲）；方塊列右鍵沒作用（數字欄一直在）。sandbox 裡點一下選取的零件（沒拖動）＝展開它。
- **畫面**（`inspect {key, boxes, boxSel:[k…], partSel:[i…], part}`，`inspectMsg()`；`partSel` 不含停用的）：選中的實例畫選取的占地方塊（grid 藍／zone 綠）、選取的零件外框（藍；png 照圖框不算角度、粒子／光源畫點，光源加範圍；只畫目前狀態看得到的）；`_drawSel()` 最後才 `_drawInspect()`。
  - **光源零件的半徑／方向／光錐把手**（2026-11-23）：每個選取的光源零件（目前狀態看得到＝有建燈的）都畫範圍＋把手，跟場景光源同一套（`Sandbox._lightHandles()`／`_drawLightRange()`／`_radiusFrom()`／`_arcFrom()` 共用），只是線跟把手都是藍色：點光源＝虛線圈＋圈右邊一個半徑把手；聚光燈＝扇形（淡中線），中線末端的把手連 `dir` 一起改、弧兩端的把手改 `arc`（1～359）；Shift 吸 16px／15°，游標 `pointer`。點光源／聚光燈只能在右欄切（光錐欄），把手不切。多選時只改被拖的那一盞。拖的時候直接改燈（`_partLightTo()`），每次移動送 `dragLive {key, part, light:{r, dir?}|{arc}}`（右欄 r／dir／arc 即時跟著＋黃框，零件沒展開就展開），放開有變才送 `partLight {key, i, patch}` → `setPart()` 寫草稿的 `light`，一次拖曳一筆 undo。
- **prefab 實例沒有白色選取框，點錨點或點選框**：工具列「☑ 錨點」勾著時**每個**實例都畫錨點**準星**（2026-11-22，`_drawInstAnchor()`：空心圓半徑 5＋十字伸到 9 螢幕 px、穿出圓，黃線 1.5px 外描黑邊；選中的不透明、其他 0.5；跟擺設／角色的黃點分開＝看到準星就是抓得起來），點錨點 8 螢幕 px 內選取（`_instAt()`，重疊取 depth 高的，優先於角色／擺設，在發射點／光源記號之後）；沒勾＝準星全部不畫、錨點點不到。擺設／角色不受影響（只畫選中的黃點、照舊點圖）。
  - **點選框**（2026-11-21，`_instBox()`／`_instBoxAt()`，只在 sandbox 算、不寫檔、跟 `zone` 無關、不管「☑ 錨點」）：目前看得見的 png 零件（照現在的 look、停用 off 的不算）外接框（含 angle）；沒有＝看得見的粒子／光源點外擴 16px、最少 32×32；連點都沒有＝錨點正中 32×32。排在最後：發射點／光源記號＞錨點＞角色／擺設的圖＞**點選框**＞角色站的格子（`_pickAt()`），重疊取 depth 高的；按下去一下選取＋拖（同錨點拖曳）。滑鼠 hover 到的實例（`_pickAt` 得到 inst，拖曳中＝拖的那個）畫白色淡虛線點選框、游標 `move`（`_drawInstHover()`）。已選中實例的選取零件照下面順序先吃到。
  - 選取的方塊：4 邊中點各一個把手（方塊顏色、壓在框線上，沒有角落把手、不能整塊拖），拖哪邊只改那邊、對邊固定（左＝x＋w、上＝y＋h），不能拉過對邊（最少 1px），整數 px、Shift 吸 16px（世界座標），游標 ew／ns-resize；放開回報 `box {key, k, box}` → `setPf` 寫草稿（一次拖曳一筆 undo）。把手疊在一起照 body → grid → zone 搶（`_boxHandles()`／`_boxHandleAt()`／`_boxTo()`）。
  - **粒子零件的 zone**（2026-11-21）：選取的粒子零件（`{particle}` 也算）畫 emitZone 綠框／deathZone 紅虛線（`_partZoneOwners()`，原點＝錨點＋零件 x/y＋粒子自己的 x/y，畫法共用 `_drawZoneList()`），點框線選起那個 zone（`_pzsel {key, i, k}`，同時展開那個零件）出白色把手，拖本體／把手同發射點（`pzone.js`），放開送 `partZone {key, i, k, z}` → 分頁寫進那個粒子 id 的草稿副本（`ps[id]`），拖的時候右欄數字不即時跟。粒子零件一律跟著物件（follow），用 deathZone 要勾 `local`，不然粒子一出生就被殺掉（表單會出 ⚠，見 particle-tool.md 的陷阱）。
  - 按下的順序：選取的方塊把手 → **選取的光源零件把手** → **選中 zone 的白色把手** → **選取的粒子／光源的點**（8 螢幕 px）→ **錨點**（8 螢幕 px，拖實例）→ **zone 框線**（6 螢幕 px，選起 zone、可拖）→ **選取的 png 圖框**（照 depth 取最上面）→ **選中 zone 的框內**（拖本體）→ 其他照一般點選（`_partAt()` 只認選取的）。點到選取的零件＝拖零件，**所有選取的一起動**（`_drag.sel`；png holder／光源照同一個位移跟著動，放開回報 `moveParts {key, moves:[{i, x, y}]}` 相對錨點、一筆 undo，Shift 照被拖的那個吸 16px；沒拖動＝回報 `part {key, i}` 展開它）。所以 png 蓋住錨點時照樣能從錨點拖實例；光源壓在錨點上又要拖實例，把光源取消選取。縮得很小時選取的方塊把手可能蓋到錨點（把手優先）。
  - 展開零件（`S.part`）只管右欄表單，不決定畫框、拖曳、鍵盤。
  - 拖曳中右欄數字跟著變：sandbox 每次移動送 `dragLive {key, k, side, box}`（方塊）／`{key, part, x, y}`（被拖的那個零件），第一則帶 `start`，放開送 `{end}`；分頁 `dragLive()` 直接改欄位值（不重畫、不寫草稿、不進 undo），正在變的欄位加黃框（`input.live`，方塊照拉的邊：左＝x、w，上＝y、h，右＝w，下＝h）；`start` 時屬性區摺著自動打開、零件沒展開就 `openPart()`、那格 `scrollIntoView({block:'nearest'})`；放開照舊 `box`／`moveParts` 寫草稿。
- 鍵盤：有選取的零件時 Del 刪掉所有選取的（`delParts()`，一筆 undo）、方向鍵一起移（`nudgeParts()`，1px、Shift 一格，連按併一步 undo）；沒選零件時作用在實例。Esc 一層一層退：收起展開的零件 → 清掉所有選取（零件＋方塊）→ 取消選取實例（有草稿先問）。
- 改名：連帶改 template／縮圖／tsj／所有地圖跟 template 的 `prefab`、scenes.json、item.json，一筆 undo。刪除：地圖或道具有用到就擋（列出來）；只有 scenes.json 用到就連實例一起拿掉。
- `textures/prefabs/` 不再被用到的圖不自動刪，交給圖片分頁的「未使用」。
- **prefab 的圖改名／刪除**（2026-11-24）：場景分頁的選圖器（「換圖…」／＋png／放擺設 →「textures 圖…」，`IC.pickIcon(cur, {menu: texMenu})`，別的分頁的選圖器沒有）對 `textures/prefabs/<id>/` 的單張圖右鍵「改名…／刪除（搬到 .tbd）」；`prefabs/` 底下直接放的 Tiled 縮圖 `prefab-<id>.png`、其他資料夾沒有選單（`pfTexDir()`）。
  - 引用（`texRefs()`）：圖片分頁的 `scan.js`（資料 json、地圖／template／tsj、src）＋scenes.json＋草稿。prefab.json 零件的 `img`、scenes.json 擺設的 `img`、草稿（含草稿 undo 快照）的零件＝改名會跟著改；其他地方（item／particle／fx／地圖、scenes.json 其他欄位、草稿的粒子副本）有引用就**擋**、列出來。刪除＝任何引用都擋。
  - 改名：只改檔名（資料夾不變）＝改 texture key；不能空白／有空白或 `\ / : * ? " < > |`／`prefab-` 開頭／只差大小寫／撞任何 texture key（不分大小寫），不合法標紅、確定反灰。png 先改名，再改 prefab.json＋scenes.json（同一次寫），草稿的 `pf`／`base`／undo 快照裡的舊 key 一起換、草稿留著；更新圖片清單、sandbox 重開。
  - 刪除：搬到 `textures/.tbd/prefabs/<id>/`（圖片分頁能搬回原位）。
  - undo：這一步記在全域 undo、多一個 `fops: [{from, to}]`（檔案路徑相對專案）；undo／redo 先確定搬得動（`checkMove()`）、退／進 json、再搬檔（`moveTex()`）。草稿中 Ctrl+Z 只退草稿，所以草稿中做的改名要離開草稿後才退得到。
  - 測試：`scripts/test/prefab-tex.mjs`。

> 下面「實作順序」第 4 步的編輯模式（`S.edit`／`editView()`／`locked`／拖錨點十字與方塊）2026-11-18 已整個換成上面的右欄編輯＋草稿，留著當紀錄。

## 其他工具連動

- `src/data/mapcheck.js`：`prefab` 指到不存在＝錯誤（地圖分頁、`node scripts/maps.js`）。
- 粒子／特效分頁的使用者與未使用、圖片分頁的引用掃描（`scan.js` 的 `FIELDS`）算進 prefab.json。
- 道具分頁 `bb` 多一個 prefab 選擇器。

## 實作順序（每步 commit＋無頭測試＋更新本文件）

1. ✅ 資料＋遊戲核心：prefab.json、`DB.prefab`、ItemView 多圖＋狀態／粒子／光源／fx、存檔；測試 `scripts/test/prefab.mjs`（測試裡臨時塞一筆進 `DB._prefabDB`，prefab.json 目前是空的）。
2. ✅ 互動：acts＋動態 UiOption＋`defAct`、lamp 交接（測試同 prefab.mjs）。
3. ✅ 場景分頁：prefab 庫＋實例（放置／拖曳／狀態預覽）＋左欄摺疊（測試 `scripts/test/prefab-tool.mjs`）。
   - `tools/scene/store.js` 改成多檔：`edit(fn, [scenes.json, prefab.json])`＝一筆 undo（undo 項目 `{files:{檔名:{before, after}}}`）；prefab.json 不在專案就當 `{}`、寫的時候才建資料夾。
   - prefab.json 跟著 `load` 訊息送進 sandbox（`m.prefabs` 蓋掉 `DB._prefabDB`），自己改 prefab.json 不重開 iframe；別的分頁存 prefab.json（廣播）＝重讀＋重送。
   - sandbox `_applyInsts()`：實例建成 `Item`（位置＝錨點換回縮圖中心，同 Tiled），簽名含那筆 prefab 跟 👁，變了就重建；點選用 `getShapeRect()`（縮圖框）、拖曳搬 root＋`view._syncLights()`、放開送 `moveInst`；左欄 prefab 庫 HTML5 拖放，sandbox canvas 收 `drop`（`application/x-prefab`）回 `dropPrefab {id, wx, wy}`。
   - 實例 key `f<n>`；右欄：換 prefab、錨點 x/y、狀態下拉（預設＋零件 look＋acts 的狀態）。
   - 左欄每段標題點一下摺疊（`tools.scene.fold`＝摺起來的段名陣列：`lib`／`scenes`／`roles`／`props`／`particles`／`lights`／`prefabs`）。
   - 這一步 prefab 庫的右鍵只有刪除（只檢查 scenes.json；地圖／道具的引用在第 5、6 步補），改名／複製在第 4 步。
4. ✅ 場景分頁：組成 prefab（烤圖、粒子另存）＋編輯模式（零件、錨點、方塊、acts）＋改名／複製／刪除。拆成：
   - ✅ 4a 編輯模式（測試同 prefab-tool.mjs）：`S.edit＝{id, key（實例）, look（篩選）}`；`scene()` 在編輯時回傳 `editView()`＝那筆 prefab 攤成的假場景（png→擺設 `p<n>`、粒子→發射點 `e<n>`、光源 `l<n>`，座標＝實例錨點＋零件 x/y，篩掉的標 `_off`），所以原本的擺設／粒子／光源面板、拖曳、把手、Del 全部照用；`editScene()` 在編輯時走 `editParts()`：在假場景上跑同一個 fn 再 `fromSyn()` 寫回 prefab.json（新零件標成篩選中的狀態）。場景本身的欄位（底圖、時間）用 `editRealScene()`。
     送 sandbox 的是 `gameScene()`：場景本身的東西 key 前面加 `x`、列在 `locked`（sandbox `_dimLocked()` 變暗、`_pickAt`／記號跳過），不含正在編的實例，再加上沒篩掉的零件。
     右欄沒選＝prefab 面板（預設狀態、左鍵動作、右鍵動作 acts 表（local.json 沒有標 ⚠＋↗ 文字分頁）、占地方塊勾選＋x/y/w/h、縮圖外框唯讀）；擺設面板多「狀態」「特效（fx.json）」、深度改成 prefab 內部前後；發射點面板只剩粒子 id／位置／狀態（內容 ↗ 粒子分頁，沒有自己那份、不跟）；光源面板「跟著」換成「狀態」。
     進入：實例右欄「✎ 編輯 prefab」、實例右鍵、新增空白 prefab 後自動進；離開：上方「離開」或 Esc → `finishEdit()`：照預設狀態看得到的 png 算 `thumb`（不算角度），`file:` 圖照 pct 烤成 `textures/prefabs/<id>/<id>-<檔名>.png`（撞 key 加 `-2`）、改寫 key、去 pct、更新圖片清單、重開 sandbox。編輯中不能放角色／prefab、換場景＝離開。
   - ✅ 4b 組成 prefab＋改名／複製：擺設／粒子／光源右鍵（左欄或畫面）「組成 prefab…」→ 對話框填 id、勾要組的東西（預設勾點的那個＋跟著它的）、有自己那份（✎）的發射點選「另存成新 id（預設 `<prefab>-<原id>`）／覆寫原 id」（2026-11-21 改成帶進零件 `{def}`，2026-11-22 又改回寫 particle.json，見上面「組成」）；錨點＝第一個勾的擺設；跟著別人的先換成絕對位置；沒勾卻跟著被組走的改絕對位置；scenes.json＋prefab.json＋particle.json（store 的 `PARTICLE`）一起寫，接著 `finishEdit()` 收尾，兩步用 `mergeUndo()` 併成一筆 undo；particle.json 變了 sandbox 整個重開。prefab 庫右鍵 改名…（prefab.json key 保留順序＋所有場景實例；地圖／template／道具在第 5、6 步補）／複製…（整筆複製、不放實例）。
   - ✅ 4c 錨點十字、占地方塊畫在畫面上可拖：`gameScene()` 多送 `edit:{anchor, boxes}`，sandbox `_drawEdit()` 畫橘色十字＋body 紅／grid 藍／zone 綠框，`_editHandleAt()` 優先於其他把手；拖的時候改副本 `_editLive`，放開送 `moveAnchor {x,y}`（分頁 `moveAnchor()`：零件、方塊、thumb 反向挪，實例搬到新錨點，畫面不動）或 `editBox {k, box}`（`setPf`）；Shift 吸 16px。方塊要先在 prefab 面板勾起來才畫。
5. ✅ Tiled：縮圖＋tsj＋template 自動產生、mapcheck（`tools/scene/tiled.js`，測試同 prefab-tool.mjs）。
   - 縮圖檔名是 `textures/prefabs/prefab-<id>.png`（texture key `prefab-<id>`，避免跟別的圖撞名），`renderThumb()` 把永遠出現的 png 零件照 depth（含 flip／angle／scale／pct）合成進 thumb 框（規則見上面「縮圖圖」）；`finishEdit()`（儲存草稿、組成、加到 prefab、零件移到場景）在烤圖前呼叫 `syncPrefab()`，所以 file: 圖直接讀原圖。
   - 只有這四個動作會自動重產；零件的 png 在別處改了、手改 prefab.json 之後要手動：左欄 prefab 右鍵「重產縮圖」或 prefab 庫標題的 ⟳（全部，`regenThumbs()`，一筆 undo）。不做自動檢查（2026-11-24 定案）。
   - `finishEdit()` 算出來的 thumb 跟舊的不一樣、而且有地圖在用（`prefabRefs()`）：狀態列提示「錨點會偏 (dx, dy)」＋列出地圖（Tiled 物件左下角不動算），只提示、不改地圖。
   - 左欄 prefab 庫的圖示＝縮圖（`IC.iconEl('prefab-<id>')`，更新圖片清單後 `IC.onReload` 重畫）；有草稿那筆照草稿即時 `renderThumb()` 成 canvas。
   - `tilesets/prefabs.tsj`：圖片集合型，tile id 給了就不換（地圖裡的 gid＝firstgid＋id 才不會跑），改名只換 `image`、刪除只拿掉那格（id 空著）。
   - `templates/prefabs/<id>.tj`：`gid`、寬高＝thumb、屬性 `prefab`；已有的保留 `type` 跟其他屬性（預設 `item`）。
   - 改名（`renamePrefab()`）：`maproles.js` 的 `roleRefs`／`renameRoleRefs` 多了 `prop` 參數（`'prefab'`）改地圖物件跟 template 的屬性；自己的 template 改檔名、地圖裡 `template` 路徑指到舊檔的跟著改（廣播 `maps/...`）；縮圖 png 改名、tsj 圖路徑改。刪除：地圖物件或用它 template 的地圖還在就擋（列出來），沒人用才刪 template／縮圖／tsj 那格。複製：產生新的一套。這些檔**不進 undo**。
   - `src/data/mapcheck.js` 的 `isPrefabObj`／`prefabIssue`：`prefab` 指到 prefab.json 沒有的＝錯誤，地圖分頁的 ⚠（`summarize()`）跟 `node scripts/maps.js` 都會報。
   - 注意：Tiled 物件的位置是縮圖左下角，prefab 的縮圖外框變了（例如零件往左加、加了別的狀態的 png）已經擺好的物件錨點會跟著偏（會提示，見上）；不要在 Tiled 裡拉 prefab 物件的大小（寬高要等於 thumb）。
   - `tools/common/icons.js` 多 `reloadList()`：自己更新圖片清單時重讀（廣播不會傳回自己）。
6. ✅ 放置道具 `item.json bb.prefab`＋ghost、其他工具的引用掃描、道具分頁選擇器（測試 prefab.mjs、prefab-tool.mjs）。
   - **位置的兩種意思**：Tiled 物件（uid ≠ -1）的位置＝縮圖中心，ItemView `modify` 把 root 挪到錨點；runtime 生的（uid -1：放置道具、存檔重建、場景分頁 sandbox）位置**就是錨點**（`ItemView._setAnchor()` 對 prefab＋uid -1 不挪），存檔記的也是錨點，重建不會漂移。sandbox 的實例因此直接 `new Item(x, y)`。
   - 放置：`GameScene._placeAt()`：有 `bb.prefab` 的放在格子底邊中間（錨點），ghost 是 `src/core/prefab.js` 的 `prefabGhost()`（預設狀態的 png，不含粒子／光源）；`thumbOf`／`defaultImgs` 也搬到這裡（場景跟工具都 import，場景不 import components）。
   - 道具分頁：`bb` 變成已知欄位（`CAT_DEVICE` 建議），子欄位 `prefab`＝下拉 prefab.json 的 id，其他 bb key 在「其他」JSON 框。
   - 引用掃描：粒子分頁（prefab 零件的 `particle`，↗ 場景分頁）、特效分頁（png 零件的 `fx`）、圖片分頁（`img` 本來就是 FIELDS，prefab.json 加 ↗）；場景分頁收 ↗：選第一個放了那個 prefab 的場景、選起實例。
