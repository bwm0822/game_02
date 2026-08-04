# Quest / Dialog 架構筆記

修改任務或對話系統之前先看這份筆記。涵蓋資料格式、xlsx→json 建置流程、對話元件、QuestManager、以及兩者的串接流程。

## 1. 資料層

### 1.1 目前使用的是 v2 格式

`src/data/db.js` 只載入 `dialog_v2`/`quest_v2`（`dialog`/`quest` 這兩行已被註解掉）：

```js
this._dialogDB = scene.cache.json.get('dialog_v2');
this._questDB  = scene.cache.json.get('quest_v2');
```

存取方式：`DB.dialog(npcId)`、`DB.quest(questId)`。舊版 `public/assets/json/dialog.json`/`quest.json` 已不再被讀取，屬於歷史殘留。

### 1.2 xlsx → json 建置流程

資料是用 Excel 維護，再用 Node 腳本轉成 JSON，**沒有**接進 `package.json` 的 npm scripts，要手動執行：

```bash
node scripts/quest_v2.js    # xls/quest_v2.xlsx  -> public/assets/json/quest_v2.json
node scripts/dialog_v2.js   # xls/dialog_v2.xlsx  -> public/assets/json/dialog_v2.json
```

轉換規則（`scripts/quest_v2.js`）：Excel 一個 sheet 對應一個 NPC（`locales`、`說明` 這兩個 sheet 會被跳過），sheet 內用 `#開頭` 的列標記表頭、分割出多個資料表（例如任務基本資料表 + 任務步驟表），再依 `quest_id` 把步驟塞進對應任務。

### 1.3 quest_v2.json 結構

以 quest id 為 key：

```json
{
  "QK01": {
    "id": "QK01",
    "npcId": "karen",
    "titleKey": "黑森林討伐",
    "descKey": "黑森林的野狼越來越猖獗，長老需要你的幫助。",
    "steps": {
      "step_02": {
        "descKey": "前往黑森林，擊殺黑森林的野狼 ({current}/{required})",
        "complete": {"type": "kill", "required": 1, "id": "wolf"},
        "conds": ["step_01"],
        "actions": ["set qk01 done"]
      }
    },
    "reward": {"gold": 100, "exp": 100, "items": []},
    "action": {"start": ["set qk01_start"]}
  }
}
```

- `steps[stepId].complete.type`：`collect`（持有數量）/`kill`（擊殺數）/`flag`（Record flag）/`none`（純顯示，不會自動完成，通常是「回報任務」提示）
- `steps[stepId].conds`：前置 step id 陣列，未達成前這個 step 不會被檢查
- `steps[stepId].actions`：該 step 完成時執行的指令（見 1.5）
- `descKey` 支援 `{current}`/`{required}` 佔位符，顯示時由 `QuestManager.content()` 替換
- `action.start`：`QuestManager.start(id)` 時執行的指令

### 1.4 dialog_v2.json 結構

以 npc id 為 key：

```json
{
  "karen": {
    "actions": ["!_first_meet : set _quest n_QK01"],
    "entries": [
      {"nodeId": "npc_a_after_quest", "order": 1, "condition": "quest_done==true"},
      {"nodeId": "n_default", "order": 3, "actions": ["clr _where", "clr _weapon"]}
    ],
    "nodes": {
      "n_default": {
        "textKeys": {"!_first_meet": "很高興認識你，我是Karen", "true": "你好/需要幫助嗎?"},
        "choices": [
          {"labelKey": "交易", "priority": 10, "actions": ["trade"]},
          {"labelKey": "聊天", "priority": 20, "next": "n_chat"},
          {"labelKey": "關於任務", "priority": 30, "next": "[_quest]", "condition": "_quest"},
          {"labelKey": "離開", "priority": 99, "actions": ["close"]}
        ],
        "posts": ["set _first_meet"]
      }
    }
  }
}
```

- `entries`：對話入口，依 `order` 排序，取第一個 `condition` 成立的 `nodeId`；`actions`/entry 上的 `actions` 會先執行（設旗標用）
- `nodes[nodeId].textKeys`：字串，或 `{condition: text}` 的條件映射（由上而下找第一個成立的），值裡用 `/` 分隔多個文本會隨機挑一個、之後依序輪替（`_pickText`）
- `nodes[nodeId].choices[].condition`：選項是否顯示的條件
- `nodes[nodeId].choices[].next`：下一個 `nodeId`；`[varName]` 語法代表動態導向——實際節點 id 存在 flag/Record 變數裡（例如 `next:"[_quest]"` 搭配 `set _quest n_QK01`）
- `nodes[nodeId].posts`：顯示完這個節點後執行的指令（設旗標用，例如記錄「已見過第一次」）
- **actions 指令集**（`COM_Talk_V2._exec`）：`trade`（開交易面板）、`qstart <id>`（開始任務）、`qclose <id>`（完成任務）、`close`（關閉對話框）、`set <flag> [val]`、`clr <flag>`、`rm <flag>`；指令前面可加 `條件:` 前綴做條件執行，例如 `"!_first_meet : set _quest n_QK01"`
- **條件表達式**（`_evalCond`）：支援 `&&`/`||`/`!flag`/`flag==val`/`flag!=val`/純 flag 名稱；flag 依字首判斷來源：`#questId` 讀 `QuestManager.getState(questId)`、`_xxx` 讀元件自己的 runtime `_rec`（存檔）、其他讀全域 `Record.getVar()`

### 1.5 flag 三種來源整理

| 前綴 | 讀取方式 | 用途 |
|---|---|---|
| `#questId` | `QuestManager.getState(questId)` → `'open'/'done'/'close'/undefined` | 依任務狀態分支對話 |
| `_xxx` | `COM_Talk_V2._rec`（隨對話元件存檔，NPC 各自獨立） | 該 NPC 專屬的對話進度旗標 |
| 其他 | `Record.getVar()`（全域） | 跨 NPC/跨系統共用的旗標 |

## 2. 對話元件：COM_Talk vs COM_Talk_V2

`src/roles/npc.js` 同時 `import` 兩者，但實際 `.addCom()` 只掛 `COM_Talk_V2`（`COM_Talk` 那行被註解掉）：

```js
// .addCom(new COM_Talk())
.addCom(new COM_Talk_V2())
```

**`src/components/com_talk.js`（`COM_Talk`）是死代碼**，是配合舊版 `dialog.json`（`(cond)text/cmd0;cmd1` 字串語法、`QuestManager.add()`/`.query()`）的舊實作，`QuestManager` 現在已經沒有這些方法了，就算手動掛回去也會直接壞掉。修改對話系統一律只看 `com_talk_v2.js`。

## 3. QuestManager（src/manager/quest.js）

### 3.1 狀態結構

```js
static quests = {active: {}, close: {}};   // 沒有 opened！(見第 6 節已知問題)
```

`active[id]`/`close[id]` 內容：`{steps:{}, counters:{}, sta:'open'|'close', close:bool}`

### 3.2 公開 API

| 方法 | 用途 |
|---|---|
| `start(id)` | 開啟任務，寫入 `quests.active[id]`，執行 `quest.action.start` |
| `close(id)` | 完成任務，發放 `reward`，執行 `quest.actions`，從 `active` 移到 `close` |
| `remove(id)` | 從 `active` 移除（用於玩家在任務列表手動移除已完成任務） |
| `title(q)` / `content(q)` | 產生任務列表顯示用的標題/內容 BBCode 文字（`q = {cat, dat, sta}`） |
| `queryActive(id)` / `queryClose(id)` | 依 id 組出 `{cat, dat, sta}` 給 UI 用；查不到回傳 `null` |
| `getState(id)` | 回傳 `'open'`（active 但步驟未全部完成）/`'done'`（active 且步驟全完成，尚未回報）/`'close'`（已完成）/`undefined`（從未開始） |
| `onKill(id)` / `onCollect()` / `onFlag()` | 由外部觸發，檢查所有 active quest 中對應 `complete.type` 的 step 是否達成 |
| `save()` / `load()` | 存讀檔，走 `Record.game.quest` |

### 3.3 `onCollect()` 由誰觸發

`InventoryService`（`src/services/inventoryService.js`）在 `doSwap`/`doMerge` 觸發 `'swap'`/`'doMerge'`；`COM_Storage`（`com_inventory.js`）的 `_receive`/`_put` 觸發 `'receive'`/`'put'`；`_drop` 觸發 `'drop'`。**但 `onCollect(dbg)` 目前忽略傳入參數，一律呼叫 `_checkSteps('collect')`**——也就是說這些細分的事件名稱（`'swap'`/`'put'`/`'receive'`/`'drop'`/`'doMerge'`）目前只是除錯用的字串標記，不影響實際檢查邏輯；`_checkSteps('collect')` 一律是「重新統計玩家目前持有數量」，不管觸發來源是什麼操作。

### 3.4 `onKill`/`onFlag` 觸發點

- `onKill(id)`：`Npc._ondead()`（[npc.js:68](src/roles/npc.js#L68)），角色死亡時以自己的 id 觸發
- `onFlag()`：搜尋 `_exec` 的 `set` 指令（對話/任務 actions 都會呼叫 `Record.setVar`），目前在 `src/manager/quest.js` 的 `_exec` 及 `com_talk_v2.js` 的 `_setVar` 都有 `set` 指令，但檢查後兩處都沒有主動呼叫 `QuestManager.onFlag()`——需要另外找呼叫點（如果找不到，代表 `flag` 類型的任務步驟目前不會被動觸發檢查，只能等下次其他事件觸發 `_checkSteps` 時順便被檢查到其他 type，實際上 `flag` 類型只能靠自己被排入某個確實有呼叫的檢查路徑）

## 4. UiDialog（src/ui/uidialog.js）

雙欄面板：`_spkA`（NPC，左上頭像+名字+文字，用 rexUI 的 `rexTextPage` 分頁）、`_spkB`（玩家，右下選項清單）。

流程：`show(owner)` → `updateDialog()` → `owner.getDialog()`（呼叫到 `COM_Talk_V2._onGetDialog()`）拿到 `{A, B}` → `_spkA.setDialog(A)` 分頁、`_spkB` 顯示選項按鈕。每個選項按鈕 `onclick` 呼叫 `owner.select(option, this.cb.bind(this))`，`cb(cmd)` 依 `COM_Talk_V2._exec` 回呼的指令做對應動作：

- `'close'`/`'exit'`：關閉對話框
- `'goto'`：切換到新節點，重新 `updateDialog()`
- `'next'`：NPC 文本還沒翻完（`rexTextPage` 未到最後一頁）時，顯示「*聆聽...*」提示玩家繼續翻頁

## 5. UiMisc + PQuest + PMap

`UiMisc`（[uimisc.js](src/ui/uimisc.js)）是頁籤容器（任務/地圖兩頁），內容分別委派給：

- **`PQuest`**（[pquest.js](src/ui/pquest.js)）：左側依分類（`已完成`/`一般任務`）摺疊的任務按鈕清單，右側顯示 `QuestManager.title()`/`content()`；有新進度的任務會顯示紅點（`QuestManager.updated` 這個 Set）。
- **`PMap`**（[pmap.js](src/ui/pmap.js)）：讀 `MiniMap.map` 的 Tiled object layer 產生地圖節點 `UNode`，理論上還會在地圖上標出任務所在地——但這部分目前是壞的，見第 6 節。

## 6. 已知問題

### 6.1 ⚠️ 地圖任務標記功能已失效（真正的功能性 bug，非純死代碼）

`PMap._updateQuest()`（[pmap.js:123](src/ui/pmap.js#L123)）用的是舊版 API，跟現在的 `QuestManager` 對不上：

```js
for(let id in QuestManager.quests.opened)   // QuestManager.quests 只有 {active, close}，沒有 opened
{
    let q = QuestManager.query(id);          // QuestManager 沒有 query()，只有 queryActive/queryClose
    if(q.nid) { ... q.state ... q.title() ...}  // 這幾個成員現在的 q={cat,dat,sta} 也沒有
}
```

因為 `for...in undefined` 在 JS 不會拋錯、只是不執行，這段程式碼會靜默失效——地圖上永遠不會出現任務標記、`_focusOn`/`setQid` 這條「從任務列表跳到地圖」的路徑也永遠用不到。連帶地，`pquest.js` 的「地圖」按鈕（`if(q.nid) {...}`）也永遠不會顯示，因為 `queryActive`/`queryClose` 回傳的物件、以及 `quest_v2.json` 資料本身都沒有 `nid` 欄位。看起來是 `quest.js` 從舊版（`add`/`query`/`opened` 那套 API）重寫成現在的 `active`/`close`/`queryActive`/`queryClose` 之後，`pmap.js` 沒有同步更新。

### 6.2 `onFlag()` 疑似沒有實際呼叫點

見 3.4，`flag` 類型的任務完成條件，觸發路徑不明確，需要進一步確認（也可能是設計上預期靠其他類型事件觸發時「順便」檢查到，因為 `_checkSteps` 是掃描全部 active quest，不限定觸發來源）。

### 6.3 死代碼清單

- `src/manager/quest_old.js`：零 import，確認無人使用
- `src/components/com_talk.js`（`COM_Talk`）：`npc.js` 中被註解掉，配合已棄用的 `dialog.json`/舊版 `QuestManager` API，實際運作會直接壞掉
- `src/ui/uiquest.js`（`UiQuest`）：先前 UI 架構分析已確認的死代碼，被 `uimisc.js`+`pquest.js`+`pmap.js` 取代
- `public/assets/json/dialog.json`/`quest.json`（非 v2）：`db.js` 已不再讀取

## 7. 新增任務／對話的實務指南

### 新增一個任務

1. 在 `xls/quest_v2.xlsx` 對應 NPC 的 sheet 加一列任務基本資料（`quest_id`/`titleKey`/`descKey`/`reward_*`/`actions_start`）與對應的步驟列（`step_id`/`descKey`/`complete_type`/`complete_required`/`complete_id`/`conds`/`actions`）。
2. 執行 `node scripts/quest_v2.js` 重新產生 `public/assets/json/quest_v2.json`。
3. 在對話（dialog_v2）某個 `choice.actions` 加上 `qstart <quest_id>` 觸發任務開始；任務最後一步通常是 `type:'none'`，靠玩家跟 NPC 對話時另一個 `choice.actions` 的 `qclose <quest_id>` 手動回報完成。
4. 需要依任務狀態分支對話時，條件寫 `#quest_id==open` / `#quest_id==done` / `#quest_id==close`。

### 新增一段對話

1. 在 `xls/dialog_v2.xlsx` 對應 NPC 的 sheet 新增節點列（`nodeId`/`textKeys`/`choices`...，實際欄位對照請看 `scripts/dialog_v2.js` 怎麼組資料，跟 `quest_v2.js` 讀表方式一致）。
2. 執行 `node scripts/dialog_v2.js` 重新產生 `public/assets/json/dialog_v2.json`。
3. 新節點要被走到，得從某個既有節點的 `choice.next` 連過去，或加一筆新的 `entries`（記得排 `order`、設 `condition`）。
4. 對話中要暫存「這個 NPC 是不是講過這句話了」之類的旗標，用 `_` 開頭的變數名（存在對話元件自己的 runtime 資料，不會污染全域 `Record`）。
