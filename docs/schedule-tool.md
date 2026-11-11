# 角色分頁：作息地圖

角色分頁右欄上方「外觀｜作息」切換（`S.rtab`，記在 `localStorage` 的 `tools.role.rtab`）。外觀＝原本的合成預覽；作息＝這份文件。左邊的作息卡片照舊（[role-editor.md](role-editor.md)），右邊畫地圖。作息資料格式見 [schedule-architecture.md](schedule-architecture.md)。

## 現況（第 4 步）

- **地圖**：`tools/role/schedmap.js` 的 `schedMapEl(role, maps, refresh)`。`maps`＝`navgraph.json` 裡有的地圖（路網沒有的圖不列）。預設顯示上次選的地圖（`tools.role.sched.map`），沒選過＝這個角色作息第一筆的 `map`。
- **怎麼畫**：不用 Phaser，Canvas 2D 自己畫。`mapData(name)` 經 dev server 讀地圖 json，用 `src/data/navgrid.js` 的 `loadMap()` 一起讀 template／外部 tileset（跟路網同一份解析），把圖塊層和有 gid 的物件**烤成一張 1:1 的圖**（每張地圖只烤一次，`forget(name)` 丟掉重讀）。每次重畫只要 `drawImage` 這張圖，再疊上標記。
  - 圖塊：一般 tileset 照 `columns`／`margin`／`spacing` 切格，集合型 tileset 每格一張圖、底部對齊格子（同 Tiled）；翻轉旗標照 Tiled 的順序（先對角，再水平／垂直）；圖層的 `visible`／`opacity`／`offsetx`/`offsety` 都照著畫。
  - 物件：有 gid 的照 Tiled 畫在 `(x, y−h)`、依 `rotation` 繞左下角轉，同一層依 y 排序。template 物件的 gid 是相對 template 自己的 tileset，用 tileset 路徑對回這張地圖的 `firstgid` 換算。
- **縮放平移**：用 `tools/common/panzoom.js`，**每張地圖一組 view**（`createView('tools.preview.view.role.map.<地圖>')`），不跟外觀預覽共用。第一次看一張圖時自動置中裝滿。
- **標記**：具名物件（有名字、不是 `npc`，跟路網節點同一套規則）：point 畫圓、其他畫框（port／door 藍、bed 紫、其他白）；滑過去加粗，下方資訊列顯示「名稱（type）　作息 N」。這個角色在這張圖的作息點畫橘色圓角標籤，寫卡片編號（同一點有好幾筆就 `1,3`）。

- **選卡片**：點卡片（或卡片裡的欄位拿到焦點）＝選它（`S.schSel = {id, i}`，換角色從第 1 筆開始），卡片藍框；地圖跳到那筆的目的地地圖。**只換反白、只重畫右欄**（`renderRight()`），不重畫左邊表單，不然點卡片裡的按鈕／輸入框會失效。
- **時刻表**：`src/data/schedplan.js` 的 `buildPlan(schedule, edges, nodes)`——**遊戲的 `ScheduleManager._buildPlan()` 跟 `NavGraph` 的最短路也是呼叫它**，所以工具顯示的時間＝遊戲的時間。每張卡片在標題下方顯示「出發 HH:MM → 抵達 HH:MM（走 N 分）」，`@` 抵達型的出發時間是倒推的；走不到、排不下（上一筆還沒到就要出發）標紅，寫晚幾分。
- **路線**：選中那筆從上一筆目的地（第一筆的上一筆是最後一筆）走過來的路網路徑，照地圖分段（`legsOf()`，每個節點帶經過的時刻）。這張圖上的每一段用 `navgrid.js` 的 `bestPath()` 在格子上跑 A*（起點試物件的每個站位格、取最短；格子 `buildGrid()` 每張圖算一次存在 `mapData` 裡），畫成亮藍折線，走不到的段畫紅虛線。段頭標「HH:MM 出發」或「HH:MM 從 <地圖> 進來」，段尾標「HH:MM 抵達」或「HH:MM → <地圖>」；有地圖的標籤（藍底）點了切過去。
- **麵包屑**：地圖下拉下面一排，這段路依序經過的地圖（`地圖 進入～離開`），目前這張反白，點了切過去。

- **點地圖**（`schedMapEl` 的 `onPick` → `main.js` 的 `pickDest()`，都是一筆 undo）：先看路線標籤（切圖），再看具名物件——
  - 有選卡片：點物件＝把那筆的 `map`＋`go` 改成它
  - Shift＋點：在選中那筆後面插入一筆 `{t, go, map}`（`t` 抄選中那筆、改成抵達 `@`；沒有作息就是第一筆 `@08:00`），選到新的那筆
  - 沒有選卡片（沒有作息）：一般點只看資訊
  - 滑過物件：資訊列寫名稱、type、這個角色第幾筆、別的角色誰的第幾筆（時間），加上點選提示
- **顯示 ▾**（`tools/common/showmenu.js` 的 `createShowMenu()`，記在 `tools.role.sched.show`，只存勾了的；存過就不套預設）：這個角色其他行程（預設勾；不勾只畫選中那筆的編號）、其他角色的點（綠字 `id 編號`）、物件名稱、格子可走（`buildGrid()` 的結果：紅＝擋住、黃＝權重大於 1）。

## 還沒做（照順序）

5. 工具寫地圖 json，只動 point：新增（`point.tj`、`nextobjectid`、預設 `<角色id>-p<n>`）／拖曳／改名（連帶改所有角色的 `go`／`route`）／刪除（有人用擋）；路網過期提示＋「更新路網」（`POST /__tools/navgraph`，不自動跑）
6. 巡邏 `route` 畫環＋編輯模式

## 測試

`node scripts/test/schedule-tool.mjs`：外觀｜作息切換與記住、預設地圖、下拉列路網的地圖、室內圖大小、具名物件、烤出來的圖有畫（翻轉的樓梯、地板、template 建築）、滑過顯示名稱與作息編號、地圖倍率自己一組、換地圖記住；先開一局遊戲讀 `ScheduleManager.plans`，比對工具算的全部角色時刻表一樣；預設選第 1 張、卡片時刻表（倒推）、麵包屑、路線走得到且終點在目的地站位格、標籤內容、點標籤切圖、點卡片不重畫表單、排不下標紅；滑過別人用的點、點物件改目的地＋undo、Shift＋點插入＋undo、顯示 ▾ 預設與記住、格子權重。
