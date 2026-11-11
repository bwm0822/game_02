# 角色分頁：作息地圖

角色分頁右欄上方「外觀｜作息」切換（`S.rtab`，記在 `localStorage` 的 `tools.role.rtab`）。外觀＝原本的合成預覽；作息＝這份文件。左邊的作息卡片照舊（[role-editor.md](role-editor.md)），右邊畫地圖。作息資料格式見 [schedule-architecture.md](schedule-architecture.md)。

## 現況（第 5 步）

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

- **改 point（寫 Tiled 地圖）**：`tools/role/mapedit.js`，**只動 point**（type `point` 或用 `point.tj` 的），家具、門只能點選。每次都從硬碟重讀地圖 json → 改 → 寫回，然後 `SM.forget(map)` 重烤、狀態列提醒「Tiled 開著這張圖要重新載入，不然 Tiled 存檔會蓋掉」。
  - 新增：點空地（沒點到標籤或物件）→ 問名稱（預設 `<角色id>-p<n>`，只能英數 `-` `_`、同圖撞名擋）→ 加 `{id: nextobjectid, name, template: <相對>/templates/point.tj, x, y}`（x/y＝點到的格子左上角）、`nextobjectid` +1，放進已經有 point 的物件層（沒有就第一個物件層）；有選卡片就把它的 `map`＋`go` 指過去（一筆 undo）
  - 拖曳：左鍵按住 point 移超過 4px 才算拖，黃虛線框是放開後的格子，放開寫檔；拖過的那次 click 吃掉（不會變成點空地）
  - 右鍵 point：改名（同圖撞名擋；所有角色作息裡同 `map` 的 `go`／巡邏 `route` 一起改並**立刻存 role.json**，有檢查警告照常問「仍然存檔」）、刪除（還有作息用到就擋、列出誰的第幾筆；沒人用確認後刪）
  - 讀地圖先走專案資料夾（`SM.setReader()`，剛寫的、測試的 OPFS 假資料夾），讀不到才走 dev server
- **Tiled 排版**：`tools/common/tiledjson.js` 的 `stringify()` 照 Tiled 的規則輸出（最外層 `{ `、key 縮排、物件陣列元素縮排 +7、`}, ` 分隔、`\/`、非 ASCII 寫 `\uXXXX`、換行照原檔），git diff 只多出改的那幾行。專案的地圖讀進來再寫出去一字不差（測試會檢查全部地圖）；`forest-01`、`house-08`、`trump-inn-f1` 有幾行手改過的排版（`},` 少空白、多空行），工具寫它們時會順便整理成 Tiled 的樣子，資料不變。
- **路網過期**：`ME.staleMaps()` 比檔案時間，路網裡的地圖有比 `json/navgraph.json` 新的就在右欄頂端顯示「⚠ 路網已過期（xxx.json 比 navgraph.json 新）［更新路網］」（切到作息、重畫右欄、寫完地圖時檢查）；**不自動重跑**，按鈕才打 `POST /__tools/navgraph`，結果（節點數、警告）顯示在橫幅下面，跑完重讀 navgraph.json。卡片的目的地不在路網裡就在卡片上標「⚠ 路網裡沒有 地圖:點」。在 Tiled 改了地圖一樣會被比出來。

## 還沒做（照順序）

6. 巡邏 `route` 畫環＋編輯模式

## 測試

`node scripts/test/schedule-tool.mjs`：外觀｜作息切換與記住、預設地圖、下拉列路網的地圖、室內圖大小、具名物件、烤出來的圖有畫（翻轉的樓梯、地板、template 建築）、滑過顯示名稱與作息編號、地圖倍率自己一組、換地圖記住；先開一局遊戲讀 `ScheduleManager.plans`，比對工具算的全部角色時刻表一樣；預設選第 1 張、卡片時刻表（倒推）、麵包屑、路線走得到且終點在目的地站位格、標籤內容、點標籤切圖、點卡片不重畫表單、排不下標紅；滑過別人用的點、點物件改目的地＋undo、Shift＋點插入＋undo、顯示 ▾ 預設與記住、格子權重；全部地圖的 Tiled 排版 roundtrip；OPFS 假資料夾放 trump-inn-f1 跟 navgraph.json：沒過期、點空地新增（預設名、point.tj、nextobjectid、其他資料不變、排版、換行）、過期橫幅、卡片 ⚠、拖曳對齊格子、改名連帶存 role.json、撞名擋、有人用不能刪、刪除、更新路網（攔 fetch）。
