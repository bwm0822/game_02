# NPC 作息（Schedule）架構筆記

修改作息資料、`ScheduleManager`（`src/manager/schedule.js`）、`COM_Schedule`（`src/components/com_schedule.js`）或路網（`scripts/navgraph.js`）之前先看這份筆記。

## 1. 資料：作息 = 「時間 → 目的地」

來源 `xls/role.xlsx`（`brooklyn` 等分頁的 `schedule` 列，一列一筆），`node scripts/role.js` 轉成 `role.json`：

```js
"schedule": [
  {"t":"@06:20", "go":"trump-p1", "map":"m_04x05/trump-inn-f1"},
  {"t":"@22:50", "go":"bed",      "map":"m_04x05/trump-inn-f2", "do":"idle"}
]
```

- `t`：`"HH:MM"` 是**出發**時間；`"@HH:MM"` 是**抵達**時間，載入時用「上一筆目的地 → 這筆目的地」的路網花費倒推成出發時間（排不下會 `console.warn`）
- `map` + `go`：目的地是哪張地圖的哪個具名物件（Tiled 物件名稱只在單張圖內唯一，所以一定要帶 `map`）
- `do`（選填）：抵達後的活動。沒寫就觸發目的地物件預設的 act（床 → `rest`）；`idle` = 只站著；`patrol` = 巡邏（見下）。`enter`（port）永遠不觸發，那是玩家切場景用的
- 中途怎麼走（哪個門、哪座樓梯）**不寫**，由路網算
- 依 xlsx 的順序循環：第一筆的「上一筆」是最後一筆

### 巡邏（`do:"patrol"`）

```js
{"t":"@08:00", "go":"guard-p1", "map":"m/m_04x05", "do":"patrol",
 "route":["guard-p1","guard-p2","guard-p3","guard-p2","guard-p4"], "wait":3}
```

- `go` 是巡邏入口，抵達後依 `route` **循環**走（要來回就把點重複寫），每個路點停 `wait` 回合（沒寫 = 不停）
- `route` 只能是 `map` 這張圖裡的物件名稱（不跨圖）；`scripts/role.js`、`navgraph.js`、`ScheduleManager._buildPlan()` 都會檢查
- 抽象狀態不追蹤走到第幾個路點，只記抵達入口的時間 `at`；實體化時 `COM_Schedule._initPatrol()` 用路網花費＋`wait` 繞圈取餘數推算此刻位置（決定性，進出地圖不會亂跳）
- 實體在場時路點進度存在元件裡（`_pi`/`_wait`），被對話/戰鬥拖住就繼續走原本的下一點，不重新推算
- 範例：`guard-1`/`guard-2`（`role.xlsx` brooklyn 分頁）兩人日夜輪班，守衛室是 `m_04x05/house-08`（一張床共用，換班時間保證床先空出來）

## 2. 路網：`navgraph.json`

`node scripts/navgraph.js` 產生（`run_all` 會跑），**改了 Tiled 地圖（物件位置、名稱、port 目標）要重跑**。

- 節點 key = `"地圖:物件名稱"`，例如 `"m_04x05/trump-inn-f1:door"`
- 邊 `{to, cost, type}`：`walk` = 同圖兩節點間 A* 步數（1 步 = 1 分鐘）；`port` = 物件的 `map`/`port` 屬性連到別張圖，花 1 分鐘。邊界出口（`main.world` 相鄰大地圖）目前**沒有**算進來，之後要加就是新的 `type`
- 腳本在 node 裡模擬地圖的格子權重：tile 的 `collide`/`weight` + 物件依 `View` 規則算出來的 footprint（預設 1000 = 擋住、`point`/`pickup` 0、門當可通行）。跟遊戲內實際 A* 會有 ±幾步誤差，不影響
- 地圖從 `main.world` 列的地圖出發，沿 port 找到所有室內地圖；`scripts/role.js` 跟 `navgraph.js` 都會檢查作息目的地在不在路網裡
- 執行期查詢走 `src/core/navgraph.js`（`NavGraph.route()`/`cost()`/`mapOf()`）

## 3. 執行期：抽象狀態 + 實體

每個有作息的 NPC 永遠有一份抽象狀態 `Record.game.schedule[id]`（跟 `Record.game.roles[id]` 分開，因為 `Role._saveData()` 會整包覆蓋那邊）：

```js
{ i, node, path:[...], eta, due, t, at?, pos?, dead? }
```

| 欄位 | 意義 |
|---|---|
| `i` | 目前執行的是第幾筆作息 |
| `node` | 最後到達的節點 |
| `path` | 還要經過的節點，空陣列 = 已在目的地 |
| `eta` | 到達 `path[0]` 的時間（只有沒實體時才用） |
| `due` | 下一筆作息的出發時間 |
| `at` | 抵達目的地的時間（巡邏推算位置用） |
| `pos` | 玩家離開地圖時 NPC 正走到一半的位置 |
| `t` | 上次處理的時間（偵測時間倒退） |
| `dead` | 永久死亡 |

時間都是絕對分鐘（`TimeSystem.toTotalMinutes()`）。

**誰負責推進**：場景裡有這個 NPC 的實體 → `COM_Schedule` 走路、到節點就 `path.shift()` 回寫；沒有實體 → `ScheduleManager.update()` 依 `eta` 推進。出發（換下一筆作息）不管有沒有實體都由 `ScheduleManager` 依 `due` 觸發，所以被對話/戰鬥拖住會晚到，不會瞬移。

**交棒**
- 抽象 → 實體：NPC 的 `node` 在玩家目前的地圖（且不是正要穿過 port 離開）就 `new Npc().init_runtime(id)`；`COM_Schedule._init()` 依 `pos`/`eta` 算出走到哪一步
- 實體 → 抽象：實體走到 port 而下一個節點在別張圖 → 設 `eta` 後 `root.exit()`；玩家離開地圖 → `COM_Schedule.save()` 記 `pos` 跟剩餘步數

**時間跳躍**：往前跳 → `update()` 迴圈依序處理所有到期的 `eta`/`due`（追趕）；開局、存檔沒狀態、時間倒退、作息筆數變少 → `_rebuild()` 假設一切準時，推出此刻應該在哪。

**死亡**：`COM_Schedule` 收到 `ONDEAD` 設 `dead:true`，之後不再推進也不實體化。舊存檔的 `Record.game.roles[id].removed` 在 rebuild 時會轉成 `dead`。
