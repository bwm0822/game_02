# 地圖分頁（tools/map/）

殼的「地圖」分頁（排在角色後面）：看每張 Tiled 地圖上**誰在哪、什麼劇情時出現**。2026-11-11 定案的 6 步計畫：

1. ✅ 作息地圖的畫圖抽到 `tools/common/mapview.js`（角色分頁共用）
2. ✅ 分頁骨架：地圖樹＋徽章、世界總覽、畫地圖＋角色、右欄（唯讀）
3. ✅ 放置角色：調色盤、點放／Shift 連放／拖曳／刪除／換 id／屬性表、`roles` 圖層、立刻寫檔＋廣播＋undo
4. ✅ `@群組`：新增／共用／改名／刪除，連動 story.json 劇情線的 `spawns`、條件編輯＋↗ 任務分頁、👁 預覽
5. ✅ 檢查與連動：`src/data/` 共用的地圖檢查（id 不存在／擋路格／具名 NPC 標 ⚠，run_all 也跑）、角色分頁改名／刪除連動地圖
6. ✅ 時間游標：`whereAt()`＋`posOf()` 顯示具名 NPC 此刻實際在哪（走路、巡邏畫在路上）

## 定案

- **只放角色**（role.json 不是 player 的）；具名 NPC（作息生出來的）放了標 ⚠ 不擋。之後可能加地上道具（pickup）。
- **物件格式混合**：有 template 的（`templates/animals/wolf.tj` 等）用 template，沒有的寫成 `type:"npc"`＋屬性 `id` 的點物件。遊戲只認 `type:"npc"`＋`id`；template 的 `gid` 只給 Tiled 編輯器看圖。
- **常駐角色**放 `roles` 物件層（沒有就建）；舊圖層裡的角色歸在「常駐」底下、標它實際在哪層。
- **地圖任務**＝`@群組` 物件層＋story.json 劇情線的 `spawns` 條件（[story-architecture.md §5.4](story-architecture.md)）。群組名稱全域唯一、也是存檔命名空間。
- **作息點**：作息（目的地、巡邏）只在角色分頁改，point 本身這裡也能改（見下面「改 point」）。畫三種（`spotsOf(st)`，`S.occ` 或地圖換了才重算）：所有 `point`（淡黃圈）、作息 `at` 格子（淡黃方框）、被作息用到的其他具名物件（淡黃框住整個物件；沒人用不畫），巡邏 `route` 經過的點也算；兩人以上同時停留（`occupy.js` 的 `clashOf()`）畫**紅色**，只是提示、不算進左欄 ⚠ 跟 `mapcheck.js`。滑過＝名稱（作息 point／作息格子／`<type>`・作息點）＋占用時間圖（見 [schedule-tool.md](schedule-tool.md)，時間游標開著畫白線、此刻在這的人加粗）；門也是作息點時門的浮動框一起列。點擊：只有一筆＝`gotoTab('role', [id, 'schedule', i])`（角色分頁 `openSch()`：開表單、作息段、選那張卡片、右欄切作息地圖），好幾筆＝小選單 `id 第幾筆（時間）` 挑一筆，沒人用＝沒反應；hit 順序 point 圓圈 → 格子 → 物件框，門在作息點前面。`S.occ`＝`loadRefs()` 時有作息的角色 `[{id, sch, segs}]`（排不出時刻表的 `segs:null`，時間圖寫「排不出時刻表」）。

## 版面

- **左欄**：搜尋、「只看有角色／群組的」（`tools.map.only`）、照 世界（`main.world` 列的）／其他 分組收合（`fold.js`），`_` 開頭的舊檔不列。**室內地圖**（第一層資料夾名＝某張世界地圖，如 `m_04x05/karen-home`，`S.rooms`／反查 `S.parent`）掛在那張世界地圖底下、縮排、只寫短名；世界地圖那列前面的 ▸／▾ 切摺疊（點名字＝選地圖，Alt＋點箭頭＝所有世界地圖一起切），狀態記在同一份 `tools.map.open`（key `room:<世界地圖>`），預設摺著；那列多一個 `🏠n`（室內張數），摺著時再掛 `🏠⚠n`＝房子 ⚠ 加總（滑過列哪幾間），展開就回到各房子身上。對不到世界地圖的室內地圖放「其他」。徽章 `🐾n`＝角色數、`@n`＝群組數（滑過列群組名），沒東西的變淡。徽章只讀地圖 json＋template（`summarize()`），不烤圖。
- **自動展開**：只在選取換了的那一下（`openMap()` → `reveal()`：點清單、總覽格子／小點／`🏠` 選單、點門、← 返回、undo 跨圖、開分頁時記住的那張）把所在的組＋世界地圖那層打開、捲到看得見；重畫不會再打開，選著的地圖所在的組也摺得起來。
- **搜尋／只看有東西**：房子對到 → 它的世界地圖也列出來當路標（自己沒對到＝淡色），世界地圖對到不帶出沒對到的房子；搜尋中全部展開（不改存著的摺疊狀態）。
- **中間**：沒選地圖＝世界總覽（見下）；選了＝地圖畫布（`mapview.js` 的 `mapData(name, {skip: isRoleObj, tag: 'map'})`，角色不烤進底圖、另外畫）。選的地圖記 `tools.map.sel`，每張地圖一組 panzoom view（`tools.preview.view.map.<地圖>`）；再點一次同一張／「總覽」鈕回總覽。
- **右欄**：圖層／群組（常駐＋每個 `@群組` 的角色數、所屬劇情線、條件，沒宣告標 ⚠）、角色清單（點了選取）、選取的角色（id ↗ 角色分頁、名字、種類、圖層、站的格子、格式、物件 id、其他屬性）。

## 世界總覽（2026-11-11 加縮放）

- canvas＋`panzoom.js`，自己一組 view `tools.preview.view.map.#world`，**倍率上限 6**（`createView(key, {max})`，倍率欄的 max 跟著），單位＝縮圖像素（一張地圖長邊 100，同 `scripts/minimap.js` 的 `OUTPUT_SIZE`），縮圖像素風不平滑。**左鍵拖超過 4px 也平移**（`panzoom(cv, {leftPan: true})`，拖過的話 `pz.dragged` 吃掉接著的 click），中鍵照舊。
- 畫的東西：`main.world` 每格縮圖＋框（有角色／室內有角色的加亮）；**每個角色一個小點**（站的位置換算過去，藍＝常駐、粉紅＝`@群組`、紅／黃＝有 ⚠，👁 藏起來的群組不畫）；字 15px（`drawWorld()` 的 `FS`），格子畫面上 ≥ 4.5 倍字高（約 68px）才寫字：左上地圖名、右下一行一個徽章 `🐾n`／`@群組`／`⚠n`／`🏠n(🐾m)`（室內地圖張數跟角色數，時間游標開著再加 `🕒人數`）。字跟點大小固定在螢幕 px。
- 點格子＝打開那張；點小點＝打開並選取那個角色；點 `🏠`＝跳出選單列室內地圖（各自的角色／群組／⚠），選一張打開。滑過有浮動框。
- 小點、具名物件中心都是 `summarize()` 讀徽章時順便記的（`S.sums[地圖].dots`／`.named`），不用烤圖；室內地圖對應的世界地圖在 `S.rooms`。
- **時間游標**：總覽下方同一組 `🕒 作息`（跟地圖畫布共用時間跟開關），具名 NPC 在世界地圖上畫青點（走路中空心），在室內的算進那格 `🏠` 的人數（浮動框列誰在哪間），旁邊寫全世界幾人（室內幾人）。

## 角色怎麼畫（`tools/map/roles.js`）

- 角色物件＝navgrid `resolveObject()` 後 `type==='npc'` 且有 `props.id`（template 裡寫的也算）。
- 位置照遊戲：Phaser `createFromObjects` 把物件放在視覺中心（tile 物件 `(x+w/2, y−h/2)`、其他 `(x+w/2, y+h/2)`、點物件寬高 0＝`(x, y)`），`RoleView` 再把 root 移到 中心＋`role.anchor`＝站的那格。例：狼 template 64×64 在 (512,224) → 中心 (544,192) → root (528,208)＝格 16,6。
- 外觀用角色分頁的 `partsOf()`，每個角色烤一張 256×256 小圖（view 中心在正中）快取，role／item／part.json 存檔或圖片清單重載時丟掉。找不到角色畫紅框。
- 疊放：底圖 → 格子 → 淡色 point → 角色（照 root 的 y）→ 選取（藍框＋站的格子）／滑過（白虛線）→ 名稱。

## 互動

- 滑過角色：浮動框 id 名字、種類・圖層・格子；點＝選取（右欄跟著反白），點空地取消；**拖曳**＝整格移動（拖超過 4px 才算、綠框鬼影、放開寫檔、吃掉接著的 click）；**Del** 刪選取的；**右鍵**選單＝移到「常駐」／別的 `@群組`、刪除、↗ 角色分頁。
- 滑過 point：誰的第幾筆作息在用；點了跳到使用者的角色分頁（好幾筆跳小選單）。
- **改 point**（2026-11-12，寫法共用角色分頁的 `tools/common/pointedit.js`，只動 point、不碰作息目的地）：
  - 拖曳：左鍵按住 `point` 移超過 4px 才算，黃虛線框＝放開後的格子，放開寫檔（x/y＝格子左上角），吃掉接著的 click；角色疊在上面時角色優先。
  - 右鍵空地（或 `@x,y` 作息格子）：「新增 point…」，預設＝上次新增成功的名字去掉尾巴數字（`tools.map.pointPrefix`，所有地圖共用，沒記過或剩空的＝`p`；取消、被擋不記，改名不更新）＋這張圖最小的空號（如上次 `inn-sit3` → `inn-sit1`），名稱只能英數 `-` `_`、同圖撞名擋，放進已經有 point 的物件層（沒有＝第一個物件層）、`template` 指 `templates/point.tj`。
  - 右鍵 point：改名…（對話框標題「一起改：…」列出別張圖指過來的門（`map:這張圖`＋`port:舊名`，從徽章的 `S.sums[*].ports` 找，`PE.portsTo()`）跟 role.json 的「誰第幾筆」；這張圖＋那些門的地圖＋role.json 的 `go`／巡邏 `route` 用 `writeFiles()` 一起寫＝**一筆 undo**（`PE.renameNamed()`，門跟 point 共用），每個檔都廣播、自己 `loadRefs()`；角色分頁沒存的修改交給 doc.js 存檔時合併）、刪除…（還有作息用到擋、列出誰的第幾筆）、↗ 到角色分頁看作息（有人用才有）。其他具名物件右鍵只有 ↗。
  - 「顯示 ▾」的作息點沒勾＝點不到也改不了。
  - **路網過期**：地圖上方同角色分頁的橫幅（`navBanner()`），這張圖比 `navgraph.json` 新就亮（只比 mtime，放角色也會亮，接受誤報），「更新路網」走 `POST /__tools/navgraph`、重讀 navgraph 重算時間游標。
- **物件名稱過濾**：「顯示 ▾」的「物件名稱」後面一個輸入框（`showmenu.js` 項目第 4 格 `{filter:true}`，字記在 `<key>.filter`＝`tools.map.show.filter`，角色分頁作息地圖同一套、記 `tools.role.sched.show.filter`）。`nameFilter(text)`：空白／逗號隔開好幾個關鍵字、符合任一個、不分大小寫，沒有 `*`＝部分比對、有 `*`＝萬用字元整個名字要對上，空的＝全部。只過濾畫出來的名字（框、作息點、門、hover、點擊照舊），畫名字前問 `SHOW.nameOk(name)`；邊打邊重畫、打字時沒勾就自動勾、✕ 清空、底下 `符合 n／總數`（`showMenu(onChange, disabled, {names})` 的 `names()`＝這張圖的具名物件）、有過濾時按鈕 `顯示（n）🔍▾`。
- 「顯示 ▾」（`tools.map.show`）：作息點（key 還是 `points`，預設勾）、物件名稱、格子可走、門（預設勾）。`showmenu.js` 只存勾了的＋預設勾卻取消的（`false`），讀的時候預設先套再蓋存的，所以後來才加的預設項目舊存檔也會勾。

## 門（2026-11-11）

- **門**＝`type:"port"`＋屬性 `map`（要去的地圖，相對 `maps/`）的物件（`isPortObj()`），`port`＝落腳點（那張圖上同名的物件，如世界地圖的 `karen-home` ↔ 房裡的 `door`、`stair-up` ↔ `stair-dn`）；哪個方向都算，`main.world` 的邊界出口不算（遊戲執行期才產生）。
- 畫在角色底下：橘色半透明框＋`🚪`（壞的紅／黃＋`⚠`），滑過變實線；「顯示 ▾」的「門」沒勾＝不畫也點不到。
- 點擊順序：角色 ＞ 時間游標 NPC ＞ 門 ＞ point；放置模式、拖曳中不理門。
- **單擊進去**：`enterDoor()` 把這張推進 `S.back`、打開目的地圖（左欄選到、記 `tools.map.sel`），`landAt()` 倍率不動（那張圖沒記過＝置中的倍率）、落腳點放到畫布正中央、黃框閃 1.2 秒。落腳點找不到＝照原本的視角打開＋狀態列提示。找門、畫框、點中、落腳閃一下在 `tools/common/doors.js`（角色分頁的作息地圖共用），返回堆疊各分頁自己管。
- **← 返回**（「總覽」旁邊）：只有點門進來的才推進堆疊（只在記憶體），按了回上一張（視角是那張記住的）、空了變灰。
- **壞門**：`src/data/mapcheck.js` 的 `portIssue(o, namesOf)`：地圖不存在＝error（畫布紅框、點了不跳只提示）、落腳點找不到＝warn（黃框、照樣進去）。左欄 `⚠n` 也算進去：`summarize()` 記每張圖的物件名稱 `names` 跟門 `ports`，`resummarize()` 後 `linkPorts()` 整批補上門的問題（`issues`＝`roleIssues`＋門）。`node scripts/maps.js` 同樣檢查（門可能指到 `_` 開頭的圖，用到才讀）。
- **右鍵門**（2026-11-13）：`改名 <名>…`（沒名字的門沒有這項）／`↗ 進去 <地圖>`（同左鍵，壞到地圖不存在只提示）。改名跟 point 同一支：同圖撞名擋、名字只能英數 `-` `_`，別張圖 `port` 指到它的門一起改（如改房裡的 `door` → 世界地圖的 `karen-home` 門跟其他指過來的門 `port` 跟著改；`port` 寫在 template 的會在物件上補一個、照名稱排），作息 `go`／`route` 也一起改，全部一筆 undo；不自動重跑路網（橫幅照亮）。舊存檔裡 NPC 剛好站在舊名節點上時 `ScheduleManager` 找不到節點會照時間重建，不用處理。
- 不做：改門的目的地（`map`／`port`）、門的雙向配對檢查（可能是故意的單向門）、世界總覽上畫門。

## 放角色（第 3 步）

- **右欄調色盤**：role.json 除了 `player` 的全部，種類分頁（全部／動物／怪物／首領／土匪／NPC／其他，只列有的，記 `tools.map.kind`）＋搜尋；具名 NPC（`kind:"npc"`）標 ⚠。點一個＝放置模式（地圖上方綠色提示列、滑過顯示半透明鬼影＋綠框），**點格子放一個就結束、Shift＋點連放**，右鍵／Esc／再點同一個結束。放完選到新的那個。
- **目標層**：右欄「圖層／群組」點一列＝放到那裡（綠框，`S.target`；換到沒有那層的地圖就回常駐）。常駐＝`roles` 物件層，沒有就建在最後（`nextlayerid`+1）。
- **格式**（`tools/map/edit.js`）：啟動時掃 `templates/` 底下 `type:"npc"`＋屬性 `id` 的 `.tj`（`scanTemplates()`，同一角色多個取路徑排第一的）。有 template 寫 `{id, template: <相對地圖的路徑>, x, y}`；沒有寫點物件 `{height:0, id, name:'', point:true, properties:[{id}], rotation:0, type:'npc', visible:true, width:0, x, y}`。x/y 從「站的格子」反推：格子中心 −anchor ＝ view 中心，再換回 Tiled 原點（圖塊物件左下 `(cx−w/2, cy+h/2)`、矩形左上、點物件就是中心）。物件 key 照字母排、properties 照名稱排（同 Tiled），排版走 `tiledjson.js`。
- **選取的角色**（右欄）：角色下拉＝換成別的角色（`replaceRole()`：站的格子、物件 id 不變，格式照新角色，物件自己的其他屬性保留）、圖層下拉、站的格子、格式、重生（`respawn`，int，空白＝拿掉，template 給的標灰）、物件自己的屬性（改值／✕ 拿掉）、template 給的屬性（灰、唯讀）、加屬性（名稱＋型別 string/int/float/bool＋值；`id` 不行）、刪除。
- **寫檔**：每個動作 `editMap()` 現讀硬碟上的地圖 → 改 → 寫回，所以別的分頁（角色分頁寫 point）的修改不會被蓋（`writeFiles()` 也能一次寫好幾個檔，如 point 改名連 role.json）；寫完 `forget()`、廣播 `maps/<地圖>.json`、重算徽章、狀態列提醒「Tiled 開著這張圖要重新載入」。具名 NPC 放下去狀態列加 ⚠，不擋。
- **undo／redo**（左欄 ↶↷、Ctrl+Z／Ctrl+Y）：每步記地圖前後全文，復原時現在的檔案要等於「後」才寫回「前」（不然是別處改過，擋下來、狀態列說明），跨地圖也行（會切過去）。只在記憶體、重開分頁就沒了。

## @群組（地圖任務，第 4 步）

右欄「圖層／群組」每個 `@群組` 一列：👁（藏起來＝那組角色不畫、點不到、清單變淡，只影響工具畫面，記 `tools.map.hide`，拿來預覽劇情不同階段）、名稱、`↗ 劇情線`（跳任務分頁 `[劇情線, 'spawns', 群組]`）、角色數、**條件欄**（`data-expr` 自動完成，`dl-cond` 用任務分頁同一支 `storyLists()`；失焦寫 story.json）、條件問題（`checkStory()` 對這條 spawns 的結果，例如未宣告的 quality）標 ⚠。沒在 story.json 宣告的圖層標 ⚠。右鍵＝改名…／刪除…／↗。

- **＋ 新群組…**：名稱（英數 `-_`）＋劇情線（記 `tools.map.line`）＋條件 → 地圖加空的 `@名稱` 物件層（接在最後、`nextlayerid`+1）＋story.json 那條劇情線的 `spawns` 加一筆，目標層換過去。名稱**已經宣告過**（別張圖在用）＝提示共用、劇情線／條件鎖住，只加圖層。同一張圖已經有就擋。
- **改名**：用到的所有地圖的 `@圖層`＋story.json 的 spawns key（保留順序）＋計數器來源 `kill:@<群組>`（`storyrename.js` 的 `groupRenamer()`）一起改、一筆 undo；對話框列出要改的檔，警告**存檔命名空間**（舊存檔裡這組的狀態對不上）；改成已有的名字擋。
- **刪除**：這張圖的圖層連同裡面的角色。別張圖還在用＝只刪圖層；是最後一張＝問「連條件一起刪／只刪圖層」。
- 寫檔走 `editFiles()`（好幾個檔全部改好才一起寫，地圖照 Tiled 排版、story.json 同任務分頁 `JSON.stringify(…, null, 2)`），每個檔都廣播（story.json 是 `story.json`、地圖是 `maps/…`）；任務分頁有未存修改時照它的合併規則處理。undo 一筆可以包好幾個檔，每個檔都要沒被別處改過才復原。
- 群組在哪幾張地圖用，看左欄徽章那份（`S.sums`，每次寫完重算）。

## 檢查與連動（第 5 步）

- **`src/data/mapcheck.js`**（工具跟腳本共用，`isRoleObj`／`placeOf` 也搬到這裡；門的 `isPortObj`／`portIssue` 見「門」）：`roleIssues(rid, roles)`＝不用格子就能查的（role.json 沒有 → error、玩家角色 → error、具名 NPC → warn）；`checkMapRoles(d, roles, grid?)`＝再加站在地圖外（error）、站在擋住的格子（warn，格子同路網 `buildGrid()`：牆、物件佔住的）。
- **`node scripts/maps.js`**：掃全部地圖（不含 `_` 開頭）印出來，有 error exit code 1；run_all 會自動跑（`scripts/*.js`）。
- **地圖分頁**：左欄徽章 `⚠n`＝`roleIssues` 的數量（擋路格要打開地圖才算，不進徽章）；打開的地圖每個有問題的角色右上角紅（有 error）／黃（只有 warn）圓點「!」，浮動框、角色清單、選取的角色都列出來。role.json 存檔後全部徽章重算。
- **角色分頁改名**（`doc.js` 的 `opt.ext`，`tools/common/maproles.js`）：掃 `maps/**` 物件自己的屬性 `id` 跟 `templates/**` 的 `.tj`（連帶列出用那個 template 的地圖），對話框多一段「地圖／template 裡會一起改的」；按改名＝記憶體改完後**立刻寫地圖／template＋存 role.json**（免得地圖指到還沒存的新 id），廣播每個檔、`SM.forget()`。地圖照 Tiled 排版重寫；template 是另一種排版，只用正規式換掉 `"name":"id" … "value":"舊"` 那個值。
- **角色分頁刪除**：地圖或 template 還在用就擋（列出在哪），不進原本的刪除確認。
- 地圖分頁收到 `templates/…` 的廣播＝快取全丟、整個重讀。

## 時間游標（第 6 步）

- 地圖下方 `🕒 作息` 勾選＋`HH:MM` 欄＋滑桿（拖＝10 分一格），記 `tools.map.time`／`tools.map.t`；打時間、拖滑桿或滾輪會自動打開。**滾輪**（滑桿或 HH:MM 欄上，擋掉頁面捲動）：往下＝+1 分、往上＝−1 分、Shift＝±10，跨午夜繞回。
- 讀 role.json 時順便照 `navgraph.json`（存 `S.nav`）給每個有作息的角色排時刻表（`src/data/schedplan.js` 的 `buildPlan()`，同遊戲 `ScheduleManager`），再用角色分頁 `schedbar.js` 的 `whereAt()` 查這個時刻在哪一筆，`posOf()` 算**實際位置**：走路中照那筆的路線 `from → path…` 每段 `edgeCost()` 分，算出在哪兩個點之間走了幾分（穿過 port 那一分鐘算還在前一張圖；正走在別張圖就畫在那張）；巡邏中照 `patrolAt()`（遊戲 `_initPatrol()` 同一支：入口往 p1 的路上／停在路點／兩點之間，一次／單向跑完在終點）；其他＝目的地。選了地圖：兩點之間用 A*（`bestPath()`，同作息地圖畫路線）照比例取那一格（`walkCen()`，每張圖快取 `st.walks`），走不到就直線內插；總覽：兩點直線內插。
- 畫法：角色 0.8 不透明＋藍框（走路中虛線框、名字寫 `id → 目的地點名`）。同一點（或同一格）好幾個人往右排開 24px。下面藍底名字。
- 滑過＝名字、時間、在／正走去哪個點、第幾筆；點了跳角色分頁。只是看的，點不到也拖不動（地圖上放的角色優先）。旁邊寫這張圖此刻幾人、幾人在路上。

## 同步

- `SH.onSaved`：role／item／part.json → 重讀並丟掉角色小圖；story.json → 重讀 spawns（＋條件檢查、dl-cond）；`maps/<地圖>.json` → `forget()`＋重算那張徽章。
- 角色分頁寫 point 後也廣播 `maps/<地圖>.json`，收到地圖分頁的廣播會 `SM.forget()` 重畫作息地圖。
- `SH.onGoto([地圖, 物件 id?])`。

測試：`node scripts/test/map-tool.mjs`（假專案在 OPFS：真的 json＋幾張地圖，加上測試自己寫的 `fixture-01`（圖塊物件的 `rogue`／`orc`）、`fixture-02`（好的／地圖不存在／落腳點不存在三個門），不放進 `public/`）。`m/m_03x05.json` 用凍結的 `scripts/test/fixtures/m_03x05.json`（斷言寫死它的角色數、圖層、狼的位置；真的那張在 Tiled 改了不會影響測試，要更新就照新的斷言重抄一份）。
