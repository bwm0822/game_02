# Prefab（png＋粒子＋光源＋fx 組成的物件）

2026-11-17 定案。在場景分頁把 png／粒子／光源（png 可掛 fx）組成可重複使用的物件，存成資料，遊戲（Tiled 地圖、放置道具）跟場景分頁共用。

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
- **狀態**：自由命名的單一狀態，存 `bb.look`（不用 `bb.sta`，那是現有的物件狀態）。零件沒寫 `look`＝永遠出現；寫了＝只在那個狀態出現。`look` 只能一個名稱，三狀態以上真的需要時再擴充成陣列。狀態名稱沒有任何零件用到 → `dlog` 警告、只顯示沒寫 `look` 的零件，不當掉。
- `acts`：右鍵選單動作 id → 切到的狀態。按鈕文字＝`'<id>'.lab()`（local.json）；目標狀態＝目前狀態的那個 act 藏起來。也可以用現有的 key（`turn_on`/`turn_off`）。
- `defAct`：選填，左鍵預設動作；沒寫的話 acts 不進左鍵預設（`ORDER`）。
- `body`／`grid`／`zone`：占地方塊預設值（同 ItemView 的 `bl/br/bt/bb`、`gl…`、`zl…`，相對錨點），Tiled 屬性可覆寫。
- `thumb`：縮圖（預設狀態下所有 png 零件的外框）左下角相對錨點的位移＋大小，Tiled tile 物件座標換算回錨點用。
- 零件：
  - `img`：texture key，`sx`/`sy`/`angle`/`flip`/`ox`/`oy`/`depth`（只排 prefab 內部前後），選填 `fx`（fx.json id，跑 `fxcell.js` 的 idle，切狀態時 spawn／end）。
  - `particle`：particle.json id（**只能參照**，沒有私有 `def`）。
  - `light`：寫在 prefab 裡（`r`/`color`/`i?`/`dir`/`arc`/`soft`）。光源閃爍以後再說。
- 實例不能覆寫零件；要不一樣就另做一個 prefab。

## 遊戲

- `ItemView`（`src/components/view.js`）看到 `bb.prefab` 就整個接手（不另開 com，所有掛 ItemView 的物件自動支援）：`_setData()` 套縮圖大小、錨點、沒被 Tiled 覆寫的占地方塊；`_addShape()` 不建單張圖，`_shape`＝放在錨點的 container，png 零件各包一個 holder（fx tween 動 holder）照 `depth` 排；粒子 `playParticle({target:root})`、光源 `scene.lights.addLight`＋`setSpot`（`i` 沒寫＝`GM.LIGHT`）。outline／遮擋半透明照舊作用在 `_shape`。`root.setTexture`／`setShape` 對 prefab 無效。
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

## Tiled

存 prefab 時自動產生：
1. 縮圖 `textures/prefabs/<id>.png`（預設狀態的 png 零件合成，不畫粒子／光源）
2. 圖片集合型 tileset `tilesets/prefabs.tsj`
3. template `templates/prefabs/<id>.tj`（`gid`＝縮圖、屬性 `prefab`、寬高＝縮圖）

遊戲裡 ItemView 有 `prefab` 就不畫 gid 那張縮圖，錨點用 `thumb` 從 tile 物件左下角換算。

## 場景分頁

- 左欄（每段都可摺疊，記住）：
  - 最上方「prefab 庫 ＋」：列出 prefab.json 全部（縮圖），拖進畫面＝放實例；右鍵 改名…／複製…／刪除；＋＝新增空白 prefab（取 id → 畫面中央放實例 → 進編輯模式）。
  - 場景清單、角色／擺設／粒子／光源，多一段「prefab 實例 ＋」（＋ 選單挑 id、放地圖中間；畫面右鍵「放 prefab ▸」）。
- 實例（scenes.json）：`{key, prefab, x, y, look?}`；一般模式下是真正的遊戲物件（同遊戲程式），右欄切狀態預覽。
- 組成：多選擺設／粒子／光源 → 右鍵「組成 prefab…」：錨點預設第一個擺設的錨點；`file:` 圖照 pct 烤成 `textures/prefabs/<id>/<檔名>.png`（撞名加 `-2`）、改寫 texture key、自動更新圖片清單；有 `def` 的發射點問「另存成 particle.json 新 id（預設 `<prefab>-<原id>`）／覆寫原 id」。原本那幾個東西換成一個實例。
- 實例右鍵：編輯 prefab／拆開（攤回一般擺設／粒子／光源，不動 prefab.json）。
- 編輯模式：其他東西變暗鎖住；零件攤開成擺設／發射點／光源用現有的把手與表單編；錨點十字可拖（零件反向移動、畫面不動，Shift 吸格線）；body／grid／zone 三種方塊畫出來可拖；上方條「正在編輯 X｜狀態：全部／各狀態｜離開」，選某狀態只顯示那狀態＋沒寫 look 的零件，新零件自動標成目前篩選的狀態；acts 表單（local.json 沒有的 key 標 ⚠＋一鍵補）。改了直接寫 prefab.json（同圖其他實例跟著變）；換成 `file:` 圖存時一樣烤。
- prefab.json＋scenes.json＋產生的檔案共用一個 undo 堆疊，一次動作＝一筆，立刻寫檔＋廣播。
- 改名：連帶改 template／縮圖／tsj／所有地圖跟 template 的 `prefab`、scenes.json、item.json，一筆 undo。刪除：地圖或道具有用到就擋（列出來）；只有 scenes.json 用到就連實例一起拿掉。
- `textures/prefabs/` 不再被用到的圖不自動刪，交給圖片分頁的「未使用」。

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
4. 場景分頁：組成 prefab（烤圖、粒子另存）＋編輯模式（零件、錨點、方塊、acts）＋改名／複製／刪除。
5. Tiled：縮圖＋tsj＋template 自動產生、mapcheck。
6. 放置道具 `item.json bb.prefab`＋ghost、其他工具的引用掃描、道具分頁選擇器。
