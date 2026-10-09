# Story 架構設計（storylet + rule-based + 對話樹）

> 狀態：**階段 1～5 全部完成**（2026-10-08）。任務系統（QuestManager／quest.xlsx）已退休；dialog.xlsx 的格式以本文 §6 為準，[quest-dialog-architecture.md](quest-dialog-architecture.md) 只剩 xlsx 樣式規範（§8）有效。

目標是高自由度：同一個目標可以有多種解法，選擇會留下後果，NPC 會記得。取代現行 `QuestManager` + `COM_Talk` 的旗標接力寫法。

## 1. 三層分工

```
quality 庫（Record.game.q）── 唯一的劇情狀態，全部是數字
   ▲ 讀條件／寫效果                    ▲ 只讀
storylet（story.xlsx）               thread（story.xlsx）
 ・對話卡：跟 NPC 對話時變成選項       ・任務日誌：把 quality 翻譯成「現在該做什麼」
 ・事件卡：世界事件發生時自動觸發       ・不推進劇情，只負責顯示
   ▲
對話樹（dialog.xlsx）── NPC 的日常：開場、閒聊、交易；rule-based 台詞（line）
```

- **推進劇情的永遠是 storylet 改 quality**；任務日誌只是一面鏡子
- 任務不再是獨立系統，「任務進度」就是一個 quality
- `quest.xlsx`／`QuestManager`／`scripts/quest.js` 退休

## 2. Quality 庫

存在 `Record.game.q`，扁平的 `{name: number}`：

```js
Record.game.q = {
  "wolf_hunt": 2,                 // global
  "karen.favor": 60,          // scope=npc，對玩家的好感度
  "karen._first_meet": 1,    // NPC 私有旗標（_ 開頭）
  "kill.wolf": 7,              // 全域擊殺累計，自動維護
  "wolf_hunt.kills": 2,            // count 開的專屬計數器
}
```

- **不存在 = 0**：`!x` 與 `x==0` 等價；`x=0` 等同刪除
- **命名慣例**：quality 代表「世界的某件事」（`wolf_hunt`、`pelt_trade`），不是「某個任務」（`QX01`），方便跨任務、跨 NPC 共用；quality／thread／storylet／節點／spawn 群組名稱一律 ASCII（`scripts/story.js` 檢查，見 [i18n-architecture.md §5](i18n-architecture.md)）
- **NPC 前綴解析**：在某個 NPC 的情境下（該 NPC 的 dialog sheet、`_common`、`who` 對到該 NPC 的卡），`favor`／`_xxx` 這種 scope=npc 或 `_` 開頭的名稱自動補成 `<npcId>.favor`／`<npcId>._xxx`；要指定別的 NPC 就寫完整名稱 `karen.favor`
- 取代：`Record.game.vars`、`COM_Talk._rec`、`QuestManager.quests` 三處狀態；地圖 `#flag` layer（`src/manager/map.js`）改讀 quality
- **舊存檔不相容**，直接放棄

### 2.1 好感度

`<npc>.favor` 就是現有 `COM_Favor` 的好感度（0～100，預設 50，門檻沿用 `GM.FAV`：`LOVE 100`／`LIKE 75`／`NEUTRAL 50`／`DISLIKE 25`／`HATE 10`）。

- `COM_Favor` 保留邏輯（低於 50 每回合回復 0.1、受攻擊／被偷扣分），**對玩家的好感度**改成讀寫 `Record.game.q`
- 只有 `role.json` 標了 `unique:true` 的 NPC（來源 `xls/role.xlsx` 的 `_others` 列）才存進 quality 庫——狼、馬這類同 id 會有很多隻的生物如果共用 `wolf_hunt.favor`，打一隻全世界的狼都會恨你。目前標記的是 brooklyn 分頁的 8 個 NPC（trump、melanie、musk、karen、xi、macron、guard-1、guard-2）
- 沒標 `unique` 的、以及 NPC 對其他 NPC 的好感度，照舊存在 `COM_Favor` 自己身上；storylet 讀到這類 NPC 的 `favor` 一律是預設值 50
- 對話只在 `HATE`（≤10）以下隱藏；≤25 走 `n_cold` 冷淡入口（見 §6.3）；交易規則不變（≤25 不能交易）

### 2.2 qualities 宣告表（story.xlsx 的 `qualities` sheet）

```
#  name    scope   default  show  label   desc
   wolf_hunt     global  0        no
   favor     npc     50       yes   好感度
   懷疑     npc     0        no
   通緝     global  0        no
   kill.*     global  0        no            ← 萬用字元
```

- 轉檔時掃過 story.xlsx 與 dialog.xlsx 所有條件／效果／thread，**遇到沒宣告的名稱就報錯**（sheet + 列號）
- `_` 開頭的 NPC 私有旗標免宣告
- `show=yes` 可以顯示在 UI 上

## 3. 條件語法

沿用現行 `_evalCond` 的寫法並擴充：

| 寫法 | 意思 |
|---|---|
| `a && b`、`a \|\| b` | 且／或 |
| `x`、`!x` | 非 0／為 0 |
| `x==2`、`x!=2`、`x>=3`、`x<=25`、`x>1`、`x<1` | 數值比較 |
| `item:plet:3` | 玩家身上至少 3 個 plet（即時查背包） |
| `time=night`、`map=m/m_04x05`、`hp<0.3`、`job=guard`、`style=coward` | 情境事實（由查詢時提供，見 §7） |

`#questId` 前綴淘汰。

## 4. 指令（效果）語法

dialog、storylet、事件卡共用**同一個模組**（取代 `COM_Talk._exec` 與 `QuestManager._exec`）：

| 指令 | 意思 |
|---|---|
| `x=1`、`x+1`、`x-2` | quality 設值／加減 |
| `karen.favor+10` | 指定 NPC |
| `give axe_01 1`、`take plet 3` | 給玩家／拿走玩家的道具（`take` 取代 `consume`，不檢查數量，搭配 `item:` 條件先擋） |
| `gold+120`、`gold-50` | 金錢 |
| `count wolf_hunt.kills kill:wolf`、`stop wolf_hunt.kills` | 開／停專屬計數器 |
| `trade`、`close`、`goto n_xxx` | 對話控制（只在對話中有效） |
| `approach n_xxx` | NPC 走到玩家身邊並打開對話（見 §8） |
| `條件 : 指令` | 條件執行 |

淘汰：`set`／`clr`／`rm`／`qstart`／`qclose`／`consume`、`next:"[var]"` 動態指標。

## 5. story.xlsx

一條劇情線一個 sheet（`qualities` sheet 除外），sheet 內沿用 `#` 表頭分多張表的慣例：

### 5.1 thread 表（任務日誌）

```
#  thread  title        desc                              quality  value  journal                          pos        end  reward_hint
   QX01    屠夫的生意經   黑森林的狼氾濫，xi 的肉舖快沒貨了……   wolf_hunt     1      獵殺黑森林的野狼 ({wolf_hunt.kills}/3)   m/m_03x05
                                                                   2      剝下狼皮，帶去給商人 karen
                                                                   3      回去跟 xi 回報
                                                                   9      你把狼皮直接賣給了 xi                       Y
                                                                   10     完成                                        Y    xi 答應會好好報答你
```

- quality 第一次變成表上有的值時，thread 出現在日誌中
- `journal` 支援 `{quality名}` 佔位符
- `end=Y` 的值代表結束，移到「已完成」分類
- `reward_hint` 選填，取代原本的「獎勵」區塊（實際獎勵寫在效果裡）

### 5.2 storylet 表

```
#  id           who        on    tease    requires                     label             hint          text                         effects
   wolf_ask     xi                         wolf_hunt==0                       關於黑森林                       最近狼變多了……能幫我獵些狼皮嗎？  wolf_hunt=1, count wolf_hunt.kills kill:wolf
   wolf_enough             kill            wolf_hunt==1 && wolf_hunt.kills>=3                                         已經獵到足夠的狼了             wolf_hunt=2, stop wolf_hunt.kills
   wolf_pelt    karen                      wolf_hunt==2 && item:plet:1        關於黑森林的狼皮                  這批狼皮品質不錯……             take plet 1, wolf_hunt=3, favor+5
   wolf_sell    xi               wolf_hunt==2   wolf_hunt==2 && item:plet:3        直接把狼皮賣給你   需要 3 張狼皮   ……也好，那我自己收了           take plet 3, wolf_hunt=9, gold+80
   wolf_report  xi                         wolf_hunt==3                       回報                             @n_wolf_report               wolf_hunt=10, gold+120, give axe_01 1
   wolf_grudge  karen      see             wolf_hunt==9 && !_grudge                                            聽說你把狼皮都賣給 xi 了？哼   _grudge=1, favor-10
```

- 上表是示意，實際 xlsx 裡多個效果／事件用 `;` 分隔（同 dialog.xlsx）
- **對話卡**：有 `who`、沒有 `on`。跟該 NPC 對話時，`requires` 成立就變成選項（插入位置見 §6.4）
- **事件卡**：有 `on`。事件發生時檢查 `requires`，成立就套用 `effects`；`text` 有值就顯示成畫面提示，或冒在 NPC 頭上的泡泡；空白就默默套用
- **`who`**：`karen`（單一 NPC）／`job:guard`（`role.json` 的 `job`）／`*`（任何 NPC）；同一個 `id` 有多張卡時，越具體的壓過越籠統的
- **`tease`**：選填。`tease` 成立但 `requires` 不成立時，顯示成灰色選項並附上 `hint`；沒填就完全隱藏
- **`text`**：一句話，或 `@節點id` 跳進長對話節點
- **`mood`**：選填（K 欄）。空白＝一般對話卡；`cold`＝只在 NPC 冷淡（`n_cold`）時出現，見 §6.4
- 不重複出現靠 quality 擋（例如 `!_grudge`），不另外設 once 欄

### 5.3 長對話節點表

`text` 填 `@n_xxx` 時跳進的節點，放在**同一個劇情線 sheet**，欄位與 dialog.xlsx 的 node/choice 相同（加 `who` 欄標示屬於哪個 NPC），讓一條劇情的所有內容都在同一頁。

### 5.4 spawn 表（地圖 `@群組` 圖層）

劇情期間才出現的物件（怪、NPC、道具）在 Tiled 裡放進名稱是 `@群組` 的物件圖層，出現條件寫在劇情線 sheet 的 spawn 表：

```
#  group   requires              desc
   wolves   wolf_hunt && wolf_hunt<10        狼患進行中，m_03x05 出現 3 隻狼
```

- `src/manager/map.js` 只在**進地圖時**判斷（`DB.spawn(group)`）：不成立就不生成，並清掉該群組的存檔；即時生成／移除刻意不做（2026-10-08 決定）
- 群組名稱同時是存檔命名空間（`qid`），條件怎麼改都不影響存檔；群組名稱全域唯一
- 轉檔檢查：地圖的 `@` 圖層沒宣告 → 錯誤；宣告了但沒地圖用 → 警告；舊的 `#` 條件圖層 → 錯誤

## 6. dialog.xlsx

欄位不變（`section`／`node_id`／`priority`／`condition`／`text_keys`／`label_key`／`next`／`actions`），只負責 NPC 的日常與個性。

### 6.1 `_common` sheet

所有 NPC 共用的 line／entry／node；NPC 自己的 sheet 有同名節點就用自己的。裡面的 `favor`、`_xxx` 自動解析成當下那個 NPC 的。

- 合併在轉檔時做（`scripts/dialog.js`）：節點同名用自己的、entry 同 `node_id` 用自己的；`choice:<node_id>` 列可以掛到 `_common` 的節點上，不用複製整個節點
- `_common` 的 n_default 有 `交易` 選項，條件是 `trade` 事實（`role.json` 的 `trade:true`），所有商人自動都有
- dialog 的條件（choice、entry、texts）跟 line 一樣附帶 NPC 情境事實（`Line.facts()`：`map`/`hour`/`time`/`job`/`style`/`trade`/`hp`）
- **能對話的 NPC** = 有自己 sheet 的 + `role.json` 標 `unique:true` 的（沒 sheet 就整套用 `_common`）；其他角色（狼、盜賊…）沒有對話，但 line 泡泡照樣吃 `_common` 的
- dialog.json 的 `_common` key 是合併前的共用資料，給沒有對話的角色查 line 用

### 6.2 `section: line`（rule-based 台詞）

```
#  section  node_id   condition                      text_keys
   line     greet                                    你好/需要幫助嗎?
   line     greet     time=night                     這麼晚了還在外面晃？
   line     underAtk  hp<0.3                         救命啊！別打了！
```

- `node_id` 欄填 concept：`greet`（開對話時 NPC 的第一句）、`underAtk`、`stolen`、`hearPlayer`、`seePlayer`…
- 挑選：所有條件成立的 line 中，**條件數最多的勝出**；寫在 NPC 自己 sheet 的 line **+1 分**；同分隨機
- 條件數 = `condition` 用 `&&` 切出的段數；`text_keys` 可以用 `/` 分隔多句隨機挑
- 泡泡類 concept 同一個 NPC 有冷卻時間（`COM_Disp` 的 `BUBBLE_CD`，3 秒）
- entry 節點的 `text_keys` 空白時，開場白使用 `greet` 命中的 line
- `text_keys` 的 `條件: 文字` 映射寫法保留給一般節點，開場白改用 line
- [com_disp.js](../src/components/com_disp.js) 的 `underAtk`／`stolen` 泡泡查 line（`_common` 裡是 `找死!!!`／`有小偷!!!`）
- 程式：`src/systems/line.js`（`Line.pick(npc, concept, facts)`、`Line.facts(npc, root)` 附帶 `map`/`hour`/`time`/`job`/`style`，有 root 時加 `hp`（血量比例 0～1））

### 6.3 entry 與冷淡入口

```
_common
#  section  node_id   priority  condition   text_keys
   entry    n_cold    1         favor<=25
   entry    n_default 9
   node     n_cold                          ……又是你。
   storylets          10                                         ← 能挽回好感的卡插在這
   choice             99                                          離開   close
```

entry 依 `priority` 排序取第一個成立的（沿用現行 `order` 行為）。

### 6.4 storylet 插入位置

- 預設：插進**entry 節點**，priority 30
- 節點底下有 `section: storylets` 列時：插進那個節點、用那一列的 `priority`（`n_cold` 是 10）
- 其他節點不會被插
- **mood**：`storylets` 列的 `node_id` 欄可以填一個情境名稱（`n_cold` 填 `cold`），這個節點只收 storylet 表 `mood` 欄相同的卡；沒填 mood 的節點（含預設的 entry 節點）只收 `mood` 空白的卡。所以 NPC 冷淡時只會出現挽回好感的卡（`mood=cold`），任務卡不會跑進來，好感回來後挽回卡也不會出現
- 轉檔檢查：事件卡不能填 `mood`；`mood` 填了 dialog.xlsx 沒有任何 storylets 列收的值會報錯

### 6.5 節點沿用選項

節點列的 `next` 有值、底下沒有 choice 列時，代表「顯示完這句，沿用 `next` 節點的選項」，閒聊節點不用每個都複製一整組選項：

```
   node     n_where   這裡是……                  n_chat     _where=1
```

### 6.6 拿掉的東西

`[_quest]` 動態指標、`actions` 列的 `set _quest …`、`#QX01==open` 條件、`choice:n_default` 的任務選項、各 NPC 重複的閒聊節點、指向不存在節點的 `npc_a_after_quest` 入口。

## 7. 事件

| `on` | 觸發時機 | 查詢時附帶的事實 |
|---|---|---|
| `kill` | 任何角色死亡（`kill.<id>` 與 count 計數器在檢查前先更新） | 死者 id |
| `item` | 玩家背包變動 | — |
| `enter` | 進入地圖（`GameScene.create()` 放好玩家之後；讀檔進地圖也算） | — |
| `time` | 遊戲時間跨過整點；一次跳好幾小時（睡覺）時每個整點各觸發一次 | `hour`／`time` 是那個整點的 |
| `quality` | 任何 quality 改變 | — |
| `see` | NPC 的 `COM_Sense` 看到玩家（`bb.sensePlayer`） | who = 該 NPC |

- 同一輪每張卡最多觸發一次，避免 `quality` 事件連鎖爆炸
- 情境事實（`time`、`map`、`hp`、`job`、`style`…）由查詢方提供，line 與 storylet 共用
- 所有查詢（事件卡、對話卡、line、劇情除錯）都自動附帶 `map`（目前地圖）、`hour`（0～23）、`time`（`day`／`night`，18:00～06:00 是 night，跟 `lutAmbient` 變暗的時段一致），見 `story.js` 的 `worldFacts()`

## 8. NPC 主動（`see` + `approach`）

- 觸發點：`COM_AI._updateBB()` 裡 `bb.seePlayer` 由 false 變 true 的那一刻（`Story.onSee(npc)`）；一直看著不會重複觸發，看不到再看到才會再觸發。只聽到不算
- `see` 卡的 `text` 冒在 NPC 頭上（`root.speak`，2 秒），不是畫面提示
- 有 `approach n_xxx`：記到 `bb.approach`，`BehApproach`（1.3 分，壓過作息跟發呆、輸給 Respond／Investigate／戰鬥）走到玩家旁邊，抵達後 `root.talkAt(n_xxx)` 開對話直接進 `n_xxx`（entry 節點照算，`next` 回 entry 時對話卡照插）；玩家的移動被 `stop()` 打斷，NPC 發呆 2 回合不走開
- 不觸發／暫停：好感 ≤ `HATE`（放棄、清掉 `bb.approach`）、戰鬥模式（`GS.mode` 不是 NORMAL）、NPC 睡覺、玩家正在對話或交易（`Story.playerBusy`）；後三種先去做作息，條件解除後繼續走過來；走不到也放棄
- `bb.approach` 不存檔：玩家在 NPC 走到之前離開地圖，這次搭話就沒了。所以 `see` 卡只放「打招呼」這類效果，推進劇情的 quality 寫在 `n_xxx` 節點裡，下次看到還會再來
- 轉檔檢查：`approach` 只能用在 `on` 含 `see`、有填 `who` 的卡，`n_xxx` 要是 who 對到的 NPC 的節點

## 9. 任務日誌（PQuest）

- thread 的 quality 每換一次值（而且表上有對應的值），就把那一行 journal 附加到 `Record.game.journal[thread]`
- 畫面：說明 + 走過的路（✔）+ 目前這一行（▸，有 `pos` 時顯示地圖按鈕）；`reward_hint` 有填才顯示
- 不列出沒走到的值（不劇透岔路）
- 紅點、`pos` 地圖跳轉沿用現有機制

## 10. Debug

- **右鍵 NPC →「劇情除錯」**：列出 `who` 對得上的所有卡，標示 ✅ 成立／🔒 tease 中／❌ 不成立，並標出卡住的條件與目前值；列出各 concept 的 line 分數與命中的那一條
- **quality 檢視器**：debug 面板「指令」頁的 `q` 指令——`q` 列出全部、`q 關鍵字` 篩選、`q wolf_hunt=2`／`q karen.favor+10` 直接修改（名稱要寫完整，沒有 NPC 情境）
- **`T.STORY`**：`dlog` 印出事件卡觸發與 quality 變動

## 11. 轉檔靜態檢查

- 未宣告的 quality 名稱
- `goto`／`@節點`／`approach`／entry 指向不存在的節點
- `who` 寫了不存在的 NPC id 或 job
- 錯誤一律標出 xlsx、sheet、列號

## 12. 實作階段

每個階段結束遊戲都要能正常玩：

1. ✅ **地基**：quality 庫、共用條件／指令模組、`qualities` 表與名稱檢查、好感度搬進 q；`COM_Talk` 與地圖 `#flag` layer 改讀 quality；quality 檢視器、`T.STORY`
   - 程式：`src/systems/quality.js`（`Quality`）、`src/systems/script.js`（`evalCond()`／`exec()`）；轉檔：`scripts/story.js`（`xls/story.xlsx` → `story.json`，`DB.qualities()`）
   - 未宣告 quality 的檢查也涵蓋 dialog.json 與地圖的 `#` layer；節點 id／`who` 的檢查在階段 2 補上
2. ✅ **storylet 主體**：story.xlsx 轉檔、對話卡插入、`tease`／`hint`、thread 日誌與 PQuest 改版、右鍵 NPC 劇情除錯；QK01／QX01／QX02 **1:1 照搬**；QuestManager 與 quest.xlsx 退休
   - 程式：`src/systems/story.js`（`Story`：`talkCards()`／`fire()`／`onKill()`／`onItem()`／`thread()`／`debug()`），`COM_Talk` 把對話卡插進 entry 節點、找不到的節點去 story 節點表找
   - quality 命名：QK01→`bandit_hunt`、QX01→`wolf_hunt`、QX02→`pelt_trade`（各一個 sheet），值 1～4 是進行中、10 是完成；擊殺用 `bandit_hunt.kills`（rogue-1）／`wolf_hunt.kills` 計數器；討伐令搬家後改成盜賊討伐（原本 QK01 殺狼是放錯，rogue-1 身上就帶著要收集的匕首）
   - 為了 1:1 搬家，**階段 3 的 `kill`／`item`／`quality` 事件與 `count`／`stop` 提前在這階段做了**（`Story.onKill` 在 `Npc._ondead`、`Story.onItem` 在原本 `QuestManager.onCollect` 的位置）；`kill` 事件附帶 `dead`（死者 id）情境事實
   - 過渡期指令（`set`／`clr`／`rm`／`qstart`／`qclose`／`consume`、`#questId`、`[var]` 動態 next、dialog 的 `action` 列）已刪除，dialog.xlsx 改用 `_x=1`／`_x=0`／`!_x`
   - 實作細節：xlsx 裡多個指令／事件用 `;` 分隔（跟 dialog.xlsx 一致，不是逗號）；`on` 可以填多個（例如 `item;quality`，避免「先拿到道具、才到這一步」時卡住）；`reward_hint` 取日誌走過的值中最後一個有填的；`text` 是一句話的對話卡，選完後 NPC 回那句話、選項留在 entry 節點
   - forest-01（已棄用）的兩個任務圖層搬到 `m/m_03x05.json`，改成 `@群組` 圖層（見 §5.4）：`@wolves`、`@bandits`（rogue-1）
   - debug：右鍵 NPC「劇情除錯」＝ debug 面板指令 `story <npcId>`；line 的分數顯示留到階段 4
3. ✅ **事件卡**：`enter`／`time`（`kill`／`item`／`quality`、`count`／`stop` 已在階段 2 完成）
   - 程式：`Story.onEnter()`（`GameScene.create()`）、`Story.onTime()`（註冊在 `TimeSystem`）；測試 `scripts/test/events.mjs`（測試卡在執行期塞進 `DB.story()`，不動 xlsx）
4. ✅ **dialog 改版**：`_common`、`line` + rule-based、`next` 沿用選項、`storylets` 插入位置、`n_cold`；泡泡改查 line
   - 程式：`scripts/dialog.js`（轉檔時合併 `_common`）、`src/systems/line.js`（`Line`）、`COM_Talk`（`_nodeText()` 開場白、`_choices()` 沿用選項＋插卡）、`COM_Disp._say()`；測試 `scripts/test/dialog.mjs`
   - 對話隱藏門檻從 `DISLIKE`（25）改成 `HATE`（10）；karen／xi 的閒聊節點與交易選項搬進 `_common`，自己 sheet 只剩 greet
   - 劇情除錯（`story <npcId>`）多印各 concept 的 line 分數，▶ 是會勝出的、★ 是自己 sheet 的
5. ✅ **NPC 主動**：`on: see`、`approach`、`BehApproach`
   - 程式：`Story.onSee()`／`Story.playerBusy`、`Story.fire()` 多了 `{say, cb}` 選項；`COM_AI._updateBB()` 觸發 see、`root.approach()`；`src/components/ai/behapproach.js`；`COM_Talk` 的 `root.talkAt(node)`；`UiFrame.isOpen`；測試 `scripts/test/approach.mjs`（測試卡與節點在執行期塞進 `DB.story()`）
   - 無頭測試的 `gotoMap()` 改成等到新的玩家物件出現：起始地圖就是 `m/m_04x05`，原本切到同一張地圖時會在舊場景還沒重啟前就回報載入完成

岔路：
- ✅ `wolf_sell`／`wolf_grudge`（狼患 sheet）：`wolf_hunt==3` 時可以把狼皮直接賣給 xi（`take plet 1; wolf_hunt=9; gold+80`，`wolf_hunt==2` 時 tease），任務結束在 9，拿不到斧頭跟後續的狼皮生意；karen 之後看到你會喊「喂！你給我過來！」並 `approach n_wolf_grudge`，道歉 `favor-5`、嗆回去 `favor-15`，都設 `_grudge=1`。`wolf_report` 跟狼群 spawn 改成 `<9`。測試 `scripts/test/wolf.mjs`
