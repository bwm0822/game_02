# NPC AI 架構筆記

修改 `src/components/ai/`（`COM_AI` 跟各個 `Beh*`）、感知（`COM_Sense`）或 NPC 戰鬥／追擊行為之前，先看這份筆記。作息怎麼走請看 [schedule-architecture.md](schedule-architecture.md)。

## 1. 每回合流程

```
Npc.process()                       src/roles/npc.js
 ├ TURNSTART
 ├ think()   ← COM_AI._think()      被控制時(total.states.ctrl)跳過
 │   ├ _updateBB()：root.sensePlayer() → COM_Sense 寫 bb.sensePlayer
 │   ├ 每個行為 score(ctx) → [分數, 原因]
 │   ├ 取最高分(平手時陣列中排前面的贏)；最高分 ≤ 0 → IDLE
 │   └ best.act(ctx)
 └ TURNEND
```

`ctx` 是 `root.ctx` 再加上 `cd`/`sm`/`tick`；`fav()`（對玩家的好感度）由 `Npc.ctx` 提供。

## 2. 行為與分數

行為清單在 `COM_AI._init()`，**陣列順序 = 平手時的優先順序**：

| 行為 | 分數 | 條件 | act |
|---|---|---|---|
| `BehFlee` | `w.flee` | 感知到玩家，且（`skittish` 或 `fav() ≤ HATE`） | `root.flee()`，`idleCnt=5` |
| `BehAttack` | `w.attack` | 感知到玩家，且（`aggressive` 或 `fav() ≤ HATE`） | 血量低於 50% 先補血 → `useAb('atk')` → 在攻擊範圍就 `attack`，不然追擊；記錄 `lastKnownPos`，`idleCnt=5` |
| `BehInvestigate` | 1.5 | 沒感知到玩家，但有 `lastKnownPos` | 走到最後看到玩家的位置 |
| `BehRespond` | 1.4 | 有 `alarmPos`（看到玩家也繼續） | 走到呼救地點；抵達或走不到 → 清掉 `alarmPos`，`idleCnt=3` |
| `BehIdle` | `w.idle` | `idleCnt > 0` | 站著 |
| `BehSchedule` | 1 | 一定成立 | `root.updateSch()`（沒有作息的 NPC 是 no-op） |

- 分數只有「`weight` 或 0」，沒有連續值。實際上它是**優先序清單**，權重表就是排序加上開關
- 權重表 `wTBL` 依 `role.json` 的 `style` 決定：`aggressive`（狼）、`skittish`（馬）、`passive_fighter`（預設，被討厭才反擊）、`passive_coward`（被討厭就逃）。表裡沒有的 style（例如 `karen` 的 `weak`）會退回 `passive_fighter`

## 3. 黑板欄位

| 欄位 | 誰寫 | 誰讀 |
|---|---|---|
| `sensePlayer` | `COM_Sense._sensePlayer()`（看到或聽到；睡覺時 null，見 §3.1） | Flee / Attack / Investigate |
| `seePlayer` | `COM_AI._updateBB()`：`sensePlayer` 而且 `canSee()`（只聽到時是 false） | 目前沒人讀 |
| `lastKnownPos` | Attack.act 寫入；Investigate 放棄時清掉 | Investigate |
| `idleCnt` | Flee / Attack 設成 5，Respond 抵達時設成 3；Idle.score 每次被評分就減 1 | Idle |
| `beh` | `COM_AI._think()`：這回合選到的行為名稱（`SCHEDULE`/`ATTACK`…），還沒想過是 undefined | `COM_Alarm` |
| `alarmPos` | `COM_Alarm.hearAlarm()`；Respond 結束時清掉 | Respond |
| `go` | `COM_Schedule`；Attack 失去目標時清掉 | Schedule |
| `path` | `COM_Nav.findPath()` | `COM_Action.move()` |
| `cACT.st` | `COM_Action.move()`：`reach`/`moving`/`blocked`/`stopped` | 各行為 |

### 3.1 感知（`COM_Sense`）

- **看**（`canSee()`）：`senseBB` 方框 8 格內 ＋ 不在死角 ＋ `map.los()`（牆擋、角色不擋）。跳 `👁️‍🗨️`
- **死角**：角色只有左右兩個面向（`root.faceDir()`：`View` 提供，+1 右 / −1 左），正背後 ±60 度看不到（跟面向夾角 > 120 度）。同一格、或沒有 `View` 的物件不算死角
- **聽**：2 格內（`hearTiles`）不管方向、可以穿牆。跳 `‼️`；聽到但沒看到時會 `root.face()` 轉向玩家，轉完馬上重新判斷一次能不能看到（沒被牆擋就變成看到）
- 圖示只有對玩家好感度 ≤ `HATE` 才跳；`COM_Alarm.witness()` 也走 `canSee()`，所以背對著的人不算目擊
- **除錯顯示**：debug 模式（`DEBUG.enable`）下右鍵 NPC，選單最下面有「感知除錯」勾選（`root.dbgSense(on)`）。實心格子 = 看得到的格子（範圍＋死角＋視線），方框 = 聽覺範圍；這回合有看到／聽到玩家就變紅色，不然是灰色。NPC 換格子、轉向或每次 `sensePlayer()` 後才重畫

## 4. 跟作息的交接

戰鬥結束 → 追到最後已知位置 → 發呆 5 回合 → 回去做作息：
- Attack 在 `score()` 裡發現失去目標，就清掉 `bb.go` 和路徑
- `COM_Schedule._update()` 看到 `!bb.go`，就重新找目前的作息目的地

## 5. 移動的規則（找不到路、被擋住）

行為裡的移動直接呼叫 `root.findPath()` + `root.move()`，**不用 `cmd_move()`**：`cmd_move()` 抵達時會看 `bb.go.act` 把狀態設成 ACTION，而追擊時 `bb.go` 可能還是作息的目的地。

| 狀況 | Investigate | Attack 追擊 |
|---|---|---|
| 找不到路（`bb.path.state===GM.PATH.NONE`，物件**沒有 `pts`**） | 清掉 `lastKnownPos`，放棄 | `clearPath()`、原地盯著，不放棄目標 |
| `blocked`，人類 | `checkBlock()`：門就打開，其他障礙物下回合重新找路 | 同左 |
| `blocked`，動物被門擋住 | 放棄 | 不處理（門關著也會擋住視線） |
| `reach` | 清掉 `lastKnownPos` | — |

- `PATH.NONE` 的路徑**一定要清掉**，不能留在 `bb.path`：`COM_Nav.checkPath()` 和 `COM_Action.move()` 都會直接讀 `pts`，留著會丟 TypeError
- 動物 = `role.json` 的 `animal:true`（`xls/role.xlsx` animals 分頁的 `_others` 列）。判斷寫在 `Behavior._onBlocked()`
- 追擊時不關門（作息才會 `closeDoorIfNeed()`）
- 門沒有上鎖機制（`COM_Lock` 只用在容器上），所以人類一定開得了門

## 6. 呼救與目擊（`COM_Alarm`）

只掛在人類 NPC（`npc.js` 用 `enable:!bb.meta.animal`），所以動物不會呼救、不會目擊、也不會回應。範圍都是 15 格（`senseBB` 方框）。

受害者收到 `UNDERATK`、攻擊者是玩家時：
1. 受害者對玩家好感度 ≤ `HATE` → 當作正當防衛，什麼都不做
2. **目擊**：對 `scene.roles` 每個人呼叫 `witness()`；醒著、15 格內、看得到玩家（含死角判斷）的人 → 對玩家好感度 −45
3. **呼救**：只有受害者 `bb.beh` 是 `SCHEDULE`（或 undefined）才喊（`root.speak()` 隨機台詞）；對每個人呼叫 `hearAlarm(受害者)`，15 格內（可穿牆）、`bb.beh` 不是 `ATTACK`/`FLEE`/`INVESTIGATE` 的人 → 睡著的先 `wake()`，設定 `bb.alarmPos`（新的蓋舊的），跳 `❗`。**聽到不扣好感度**，要到現場目擊才扣

- `COM_Alarm` 必須在 `COM_Favor` **前面** `addCom`：兩者都聽 `UNDERATK`，正當防衛要讀 `COM_Favor` 扣 50 之前的好感度
- `alarmPos`、`beh` 不存檔

## 7. 已知問題（還沒處理）

- `BehIdle.score()` 有副作用（`idleCnt--`），所以就算這回合贏的是別的行為，發呆次數也會被扣掉
- `Cooldown`、`AI_CD`、`minInterval`、`StateMachine` 都沒接上：線上的行為沒呼叫 `_isOnCooldown()`，也沒有任何地方呼叫 `sm.set()`，所以 `canAct()` 永遠是 true
- `com_ai.js` 的 `dlog(T.AI,bb,id)` 寫錯了（`id` 沒定義）。目前 Schedule 永遠拿 1 分，所以走不到這行
- `ai_tmp.js`、`behtest.js`、`behchase.js` 沒在用
