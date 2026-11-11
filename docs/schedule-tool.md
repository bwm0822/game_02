# 角色分頁：作息地圖

角色分頁右欄上方「外觀｜作息」切換（`S.rtab`，記在 `localStorage` 的 `tools.role.rtab`）。外觀＝原本的合成預覽；作息＝這份文件。左邊的作息卡片照舊（[role-editor.md](role-editor.md)），右邊畫地圖。作息資料格式見 [schedule-architecture.md](schedule-architecture.md)。

## 現況（第 2 步）

- **地圖**：`tools/role/schedmap.js` 的 `schedMapEl(role, maps, refresh)`。`maps`＝`navgraph.json` 裡有的地圖（路網沒有的圖不列）。預設顯示上次選的地圖（`tools.role.sched.map`），沒選過＝這個角色作息第一筆的 `map`。
- **怎麼畫**：不用 Phaser，Canvas 2D 自己畫。`mapData(name)` 經 dev server 讀地圖 json，用 `src/data/navgrid.js` 的 `loadMap()` 一起讀 template／外部 tileset（跟路網同一份解析），把圖塊層和有 gid 的物件**烤成一張 1:1 的圖**（每張地圖只烤一次，`forget(name)` 丟掉重讀）。每次重畫只要 `drawImage` 這張圖，再疊上標記。
  - 圖塊：一般 tileset 照 `columns`／`margin`／`spacing` 切格，集合型 tileset 每格一張圖、底部對齊格子（同 Tiled）；翻轉旗標照 Tiled 的順序（先對角，再水平／垂直）；圖層的 `visible`／`opacity`／`offsetx`/`offsety` 都照著畫。
  - 物件：有 gid 的照 Tiled 畫在 `(x, y−h)`、依 `rotation` 繞左下角轉，同一層依 y 排序。template 物件的 gid 是相對 template 自己的 tileset，用 tileset 路徑對回這張地圖的 `firstgid` 換算。
- **縮放平移**：用 `tools/common/panzoom.js`，**每張地圖一組 view**（`createView('tools.preview.view.role.map.<地圖>')`），不跟外觀預覽共用。第一次看一張圖時自動置中裝滿。
- **標記**：具名物件（有名字、不是 `npc`，跟路網節點同一套規則）：point 畫圓、其他畫框（port／door 藍、bed 紫、其他白）；滑過去加粗，下方資訊列顯示「名稱（type）　作息 N」。這個角色在這張圖的作息點畫橘色圓角標籤，寫卡片編號（同一點有好幾筆就 `1,3`）。

## 還沒做（照順序）

3. 選卡片 → 畫 A* 格子路線（`navgrid.js` 的 `findPath()`）、路線麵包屑（經過的地圖，點了切圖）、卡片時刻表（出發→抵達、`@` 倒推、排不下標紅）
4. 有選卡片時點物件改 `map`＋`go`、Shift＋點在後面插入一筆、「顯示 ▾」（本角色其他行程／其他角色的點／物件名稱／格子可走）
5. 工具寫地圖 json，只動 point：新增（`point.tj`、`nextobjectid`、預設 `<角色id>-p<n>`）／拖曳／改名（連帶改所有角色的 `go`／`route`）／刪除（有人用擋）；路網過期提示＋「更新路網」（`POST /__tools/navgraph`，不自動跑）
6. 巡邏 `route` 畫環＋編輯模式

## 測試

`node scripts/test/schedule-tool.mjs`：外觀｜作息切換與記住、預設地圖、下拉列路網的地圖、室內圖大小、具名物件、烤出來的圖有畫（翻轉的樓梯、地板、template 建築）、滑過顯示名稱與作息編號、地圖倍率自己一組、換地圖記住。
