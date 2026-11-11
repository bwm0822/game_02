# 地圖分頁（tools/map/）

殼的「地圖」分頁（排在角色後面）：看每張 Tiled 地圖上**誰在哪、什麼劇情時出現**。2026-11-11 定案的 6 步計畫：

1. ✅ 作息地圖的畫圖抽到 `tools/common/mapview.js`（角色分頁共用）
2. ✅ 分頁骨架：地圖樹＋徽章、世界總覽、畫地圖＋角色、右欄（唯讀）
3. 放置角色：調色盤、點放／Shift 連放／拖曳／刪除／換 id／屬性表、`roles` 圖層、立刻寫檔＋廣播＋undo
4. `@群組`：新增／共用／改名／刪除，連動 story.json 劇情線的 `spawns`、條件編輯＋↗ 任務分頁、👁 預覽
5. 檢查與連動：`src/data/` 共用的地圖檢查（id 不存在／擋路格／具名 NPC 標 ⚠，run_all 也跑）、角色分頁改名／刪除連動地圖
6. 時間游標：`whereAt()` 顯示具名 NPC 此刻在這張圖的哪裡

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

- 滑過角色：浮動框 id 名字、種類・圖層・格子；點＝選取（右欄跟著反白），點空地取消。
- 滑過 point：誰的第幾筆作息在用；點了跳到第一個使用者的角色分頁。
- 「顯示 ▾」（`tools.map.show`）：作息 point（預設勾）、物件名稱、格子可走。

## 同步

- `SH.onSaved`：role／item／part.json → 重讀並丟掉角色小圖；story.json → 重讀 spawns；`maps/<地圖>.json` → `forget()`＋重算那張徽章。
- `SH.onGoto([地圖, 物件 id?])`。

測試：`node scripts/test/map-tool.mjs`。
