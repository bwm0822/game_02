# 地圖分頁（tools/map/）

殼的「地圖」分頁（排在角色後面）：看每張 Tiled 地圖上**誰在哪、什麼劇情時出現**。2026-11-11 定案的 6 步計畫：

1. ✅ 作息地圖的畫圖抽到 `tools/common/mapview.js`（角色分頁共用）
2. ✅ 分頁骨架：地圖樹＋徽章、世界總覽、畫地圖＋角色、右欄（唯讀）
3. ✅ 放置角色：調色盤、點放／Shift 連放／拖曳／刪除／換 id／屬性表、`roles` 圖層、立刻寫檔＋廣播＋undo
4. ✅ `@群組`：新增／共用／改名／刪除，連動 story.json 劇情線的 `spawns`、條件編輯＋↗ 任務分頁、👁 預覽
5. ✅ 檢查與連動：`src/data/` 共用的地圖檢查（id 不存在／擋路格／具名 NPC 標 ⚠，run_all 也跑）、角色分頁改名／刪除連動地圖
6. ✅ 時間游標：`whereAt()` 顯示具名 NPC 此刻在這張圖的哪裡

## 定案

- **只放角色**（role.json 不是 player 的）；具名 NPC（作息生出來的）放了標 ⚠ 不擋。之後可能加地上道具（pickup）。
- **物件格式混合**：有 template 的（`templates/animals/wolf.tj` 等）用 template，沒有的寫成 `type:"npc"`＋屬性 `id` 的點物件。遊戲只認 `type:"npc"`＋`id`；template 的 `gid` 只給 Tiled 編輯器看圖。
- **常駐角色**放 `roles` 物件層（沒有就建）；舊圖層裡的角色歸在「常駐」底下、標它實際在哪層。
- **地圖任務**＝`@群組` 物件層＋story.json 劇情線的 `spawns` 條件（[story-architecture.md §5.4](story-architecture.md)）。群組名稱全域唯一、也是存檔命名空間。
- 作息 point 在這裡**唯讀**（淡色、↗ 角色分頁），point 只在角色分頁改。

## 版面

- **左欄**：搜尋、「只看有角色／群組的」（`tools.map.only`）、照 世界（`main.world` 列的）／室內（第一層資料夾名＝某張世界地圖，如 `m_04x05/karen-home`）／其他 分組收合（`fold.js`），`_` 開頭的舊檔不列。徽章 `🐾n`＝角色數、`@n`＝群組數（滑過列群組名），沒東西的變淡。徽章只讀地圖 json＋template（`summarize()`），不烤圖。
- **中間**：沒選地圖＝世界總覽（`main.world` 座標拼 `textures/minimap/<地圖>.png`，格子上標角色數跟群組名，點一格打開）；選了＝地圖畫布（`mapview.js` 的 `mapData(name, {skip: isRoleObj, tag: 'map'})`，角色不烤進底圖、另外畫）。選的地圖記 `tools.map.sel`，每張地圖一組 panzoom view（`tools.preview.view.map.<地圖>`）；再點一次同一張／「總覽」鈕回總覽。
- **右欄**：圖層／群組（常駐＋每個 `@群組` 的角色數、所屬劇情線、條件，沒宣告標 ⚠）、角色清單（點了選取）、選取的角色（id ↗ 角色分頁、名字、種類、圖層、站的格子、格式、物件 id、其他屬性）。

## 角色怎麼畫（`tools/map/roles.js`）

- 角色物件＝navgrid `resolveObject()` 後 `type==='npc'` 且有 `props.id`（template 裡寫的也算）。
- 位置照遊戲：Phaser `createFromObjects` 把物件放在視覺中心（tile 物件 `(x+w/2, y−h/2)`、其他 `(x+w/2, y+h/2)`、點物件寬高 0＝`(x, y)`），`RoleView` 再把 root 移到 中心＋`role.anchor`＝站的那格。例：狼 template 64×64 在 (512,224) → 中心 (544,192) → root (528,208)＝格 16,6。
- 外觀用角色分頁的 `partsOf()`，每個角色烤一張 256×256 小圖（view 中心在正中）快取，role／item／part.json 存檔或圖片清單重載時丟掉。找不到角色畫紅框。
- 疊放：底圖 → 格子 → 淡色 point → 角色（照 root 的 y）→ 選取（藍框＋站的格子）／滑過（白虛線）→ 名稱。

## 互動

- 滑過角色：浮動框 id 名字、種類・圖層・格子；點＝選取（右欄跟著反白），點空地取消；**拖曳**＝整格移動（拖超過 4px 才算、綠框鬼影、放開寫檔、吃掉接著的 click）；**Del** 刪選取的；**右鍵**選單＝移到「常駐」／別的 `@群組`、刪除、↗ 角色分頁。
- 滑過 point：誰的第幾筆作息在用；點了跳到第一個使用者的角色分頁。
- 「顯示 ▾」（`tools.map.show`）：作息 point（預設勾）、物件名稱、格子可走。

## 放角色（第 3 步）

- **右欄調色盤**：role.json 除了 `player` 的全部，種類分頁（全部／動物／怪物／首領／土匪／NPC／其他，只列有的，記 `tools.map.kind`）＋搜尋；具名 NPC（`kind:"npc"`）標 ⚠。點一個＝放置模式（地圖上方綠色提示列、滑過顯示半透明鬼影＋綠框），**點格子放一個就結束、Shift＋點連放**，右鍵／Esc／再點同一個結束。放完選到新的那個。
- **目標層**：右欄「圖層／群組」點一列＝放到那裡（綠框，`S.target`；換到沒有那層的地圖就回常駐）。常駐＝`roles` 物件層，沒有就建在最後（`nextlayerid`+1）。
- **格式**（`tools/map/edit.js`）：啟動時掃 `templates/` 底下 `type:"npc"`＋屬性 `id` 的 `.tj`（`scanTemplates()`，同一角色多個取路徑排第一的）。有 template 寫 `{id, template: <相對地圖的路徑>, x, y}`；沒有寫點物件 `{height:0, id, name:'', point:true, properties:[{id}], rotation:0, type:'npc', visible:true, width:0, x, y}`。x/y 從「站的格子」反推：格子中心 −anchor ＝ view 中心，再換回 Tiled 原點（圖塊物件左下 `(cx−w/2, cy+h/2)`、矩形左上、點物件就是中心）。物件 key 照字母排、properties 照名稱排（同 Tiled），排版走 `tiledjson.js`。
- **選取的角色**（右欄）：角色下拉＝換成別的角色（`replaceRole()`：站的格子、物件 id 不變，格式照新角色，物件自己的其他屬性保留）、圖層下拉、站的格子、格式、重生（`respawn`，int，空白＝拿掉，template 給的標灰）、物件自己的屬性（改值／✕ 拿掉）、template 給的屬性（灰、唯讀）、加屬性（名稱＋型別 string/int/float/bool＋值；`id` 不行）、刪除。
- **寫檔**：每個動作 `editMap()` 現讀硬碟上的地圖 → 改 → 寫回，所以別的分頁（角色分頁寫 point）的修改不會被蓋；寫完 `forget()`、廣播 `maps/<地圖>.json`、重算徽章、狀態列提醒「Tiled 開著這張圖要重新載入」。具名 NPC 放下去狀態列加 ⚠，不擋。
- **undo／redo**（左欄 ↶↷、Ctrl+Z／Ctrl+Y）：每步記地圖前後全文，復原時現在的檔案要等於「後」才寫回「前」（不然是別處改過，擋下來、狀態列說明），跨地圖也行（會切過去）。只在記憶體、重開分頁就沒了。

## @群組（地圖任務，第 4 步）

右欄「圖層／群組」每個 `@群組` 一列：👁（藏起來＝那組角色不畫、點不到、清單變淡，只影響工具畫面，記 `tools.map.hide`，拿來預覽劇情不同階段）、名稱、`↗ 劇情線`（跳任務分頁 `[劇情線, 'spawns', 群組]`）、角色數、**條件欄**（`data-expr` 自動完成，`dl-cond` 用任務分頁同一支 `storyLists()`；失焦寫 story.json）、條件問題（`checkStory()` 對這條 spawns 的結果，例如未宣告的 quality）標 ⚠。沒在 story.json 宣告的圖層標 ⚠。右鍵＝改名…／刪除…／↗。

- **＋ 新群組…**：名稱（英數 `-_`）＋劇情線（記 `tools.map.line`）＋條件 → 地圖加空的 `@名稱` 物件層（接在最後、`nextlayerid`+1）＋story.json 那條劇情線的 `spawns` 加一筆，目標層換過去。名稱**已經宣告過**（別張圖在用）＝提示共用、劇情線／條件鎖住，只加圖層。同一張圖已經有就擋。
- **改名**：用到的所有地圖的 `@圖層`＋story.json 的 spawns key（保留順序）一起改、一筆 undo；對話框列出要改的檔，警告**存檔命名空間**（舊存檔裡這組的狀態對不上）；改成已有的名字擋。
- **刪除**：這張圖的圖層連同裡面的角色。別張圖還在用＝只刪圖層；是最後一張＝問「連條件一起刪／只刪圖層」。
- 寫檔走 `editFiles()`（好幾個檔全部改好才一起寫，地圖照 Tiled 排版、story.json 同任務分頁 `JSON.stringify(…, null, 2)`），每個檔都廣播（story.json 是 `story.json`、地圖是 `maps/…`）；任務分頁有未存修改時照它的合併規則處理。undo 一筆可以包好幾個檔，每個檔都要沒被別處改過才復原。
- 群組在哪幾張地圖用，看左欄徽章那份（`S.sums`，每次寫完重算）。

## 檢查與連動（第 5 步）

- **`src/data/mapcheck.js`**（工具跟腳本共用，`isRoleObj`／`placeOf` 也搬到這裡）：`roleIssues(rid, roles)`＝不用格子就能查的（role.json 沒有 → error、玩家角色 → error、具名 NPC → warn）；`checkMapRoles(d, roles, grid?)`＝再加站在地圖外（error）、站在擋住的格子（warn，格子同路網 `buildGrid()`：牆、物件佔住的）。
- **`node scripts/maps.js`**：掃全部地圖（不含 `_` 開頭）印出來，有 error exit code 1；run_all 會自動跑（`scripts/*.js`）。
- **地圖分頁**：左欄徽章 `⚠n`＝`roleIssues` 的數量（擋路格要打開地圖才算，不進徽章）；打開的地圖每個有問題的角色右上角紅（有 error）／黃（只有 warn）圓點「!」，浮動框、角色清單、選取的角色都列出來。role.json 存檔後全部徽章重算。
- **角色分頁改名**（`doc.js` 的 `opt.ext`，`tools/common/maproles.js`）：掃 `maps/**` 物件自己的屬性 `id` 跟 `templates/**` 的 `.tj`（連帶列出用那個 template 的地圖），對話框多一段「地圖／template 裡會一起改的」；按改名＝記憶體改完後**立刻寫地圖／template＋存 role.json**（免得地圖指到還沒存的新 id），廣播每個檔、`SM.forget()`。地圖照 Tiled 排版重寫；template 是另一種排版，只用正規式換掉 `"name":"id" … "value":"舊"` 那個值。
- **角色分頁刪除**：地圖或 template 還在用就擋（列出在哪），不進原本的刪除確認。
- 地圖分頁收到 `templates/…` 的廣播＝快取全丟、整個重讀。

## 時間游標（第 6 步）

- 地圖下方 `🕒 作息` 勾選＋`HH:MM` 欄＋滑桿（10 分一格），記 `tools.map.time`／`tools.map.t`；打時間或拖滑桿會自動打開。
- 讀 role.json 時順便照 `navgraph.json` 給每個有作息的角色排時刻表（`src/data/schedplan.js` 的 `buildPlan()`，同遊戲 `ScheduleManager`），再用角色分頁 `schedbar.js` 的 `whereAt()`（甘特圖同一支）查這個時刻：停在這張圖的點＝半透明角色＋藍框；正走去這張圖的點（走路中）＝更淡＋虛線框＋名字前加 `→`（目前畫在目的地，不算路上的位置）。同一點好幾個人往右排開 24px。下面藍底名字。
- 滑過＝名字、時間、在／正走去哪個點、第幾筆；點了跳角色分頁。只是看的，點不到也拖不動（地圖上放的角色優先）。旁邊寫這張圖此刻幾人、幾人走過來。

## 同步

- `SH.onSaved`：role／item／part.json → 重讀並丟掉角色小圖；story.json → 重讀 spawns（＋條件檢查、dl-cond）；`maps/<地圖>.json` → `forget()`＋重算那張徽章。
- 角色分頁寫 point 後也廣播 `maps/<地圖>.json`，收到地圖分頁的廣播會 `SM.forget()` 重畫作息地圖。
- `SH.onGoto([地圖, 物件 id?])`。

測試：`node scripts/test/map-tool.mjs`。
