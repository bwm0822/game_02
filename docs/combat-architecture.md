# 戰鬥系統架構筆記

修改戰鬥相關程式碼（`src/core/combat.js`、`src/components/com_stats.js`、`com_action.js`、`com_ability.js`、`src/components/ai/`）之前先看這份筆記。這是目前唯一一份戰鬥系統文件，內容是直接讀程式碼整理出來的，不是設計文件——遇到跟程式碼對不上的地方，以程式碼為準。

## 1. 傷害公式（`src/core/combat.js`）

`computeDamage(attacker, defender, skill={})` 是唯一的傷害計算入口：

```js
// 1. 命中/閃避判定（_checkHit）
acc = 攻擊方.acc + (skill.dat?.self?.hit ?? 0)
eva = 防禦方.eva + (skill.dat?.target?.dodge ?? 0)
rnd = Math.random()
rnd >= acc        → MISS
rnd >= (acc-eva)  → EVA(閃避)

// 2. 基礎傷害
dmg  = 攻擊方[skill.src ?? 'atk']   // 預設用 atk，技能可指定用別的屬性(例如法術用 int)
baseDamage = dmg * (skill.pow ?? 1) + (skill.flat ?? 0)

// 3. 防禦削減(遞減曲線，防禦越高邊際效益越低)
effectiveDef = 防禦方.def * (1 - (skill.pen ?? 0))     // pen = 穿透率
defFactor = baseDamage / (baseDamage + effectiveDef)
damage = baseDamage * defFactor

// 4. 元素抗性
damage *= 1 - 防禦方.resists[RESIST_MAP[skill.elm ?? 'phy']]

// 5. 暴擊
if(Math.random() < 攻擊方.cri) damage *= 攻擊方.crd

// 6. 隨機浮動 0.95~1.05，最後取整、下限 1
```

⚠️ `skill?.dat?.self?.hit`/`skill?.dat?.target?.dodge` 這條「技能額外命中/閃避加成」的路徑目前是死的——`ability.json` 裡沒有任何技能填過 `dat` 欄位，永遠是 `??0`。

`computeHealing(caster, skill)` 是治療版本，簡單很多：`amount = caster[skill.src ?? 'int'] * (skill.pow ?? 1) + (skill.flat ?? 0)`，沒有隨機浮動、沒有抗性。

檔案裡 91~178 行是一段舊版 `_calculateDamage` 的註解草稿，已經被取代，不用理它。

## 2. 屬性計算管線（`src/components/com_stats.js`）

`getTotalStats({attacker, stage, skill})`（綁在 `root.getTotalStats`，[com_stats.js:637](../src/components/com_stats.js#L637)）是屬性彙總的唯一入口：

```
五圍基礎值(str/dex/con/int/luk)
  → 裝備 meta(_metaOfEquips：atk/def/range/type，來自 item.json 的欄位)
  → buff/debuff/裝備 mods(_getMods：basA/basM 疊加在基礎五圍上、derA/derM 疊加在衍生屬性上)
  → 衍生屬性(_derivedStats)：
      HPMAX = CON x 10
      ATK   = STR x 1.5 + 裝備atk(近戰) / 裝備atk(遠程，不疊五圍)
      DEF   = CON + 裝備def
      EVA   = DEX x 0.01
      CRI   = min(50%, DEX x 0.01)
      CRD   = 1.5(基礎暴擊倍率)
```

結果會快取在 `this._total`，靠 `_dirty` 旗標控制（[com_stats.js:241](../src/components/com_stats.js#L241)）；只要呼叫時帶了 `attacker`/`stage`/`skill` 任一參數就強制重算（每次真的攻擊都會重算，平常讀取用快取）。

### 2.1 回合制持續效果

`_processEffs_TurnStart`/`_processEffs_TurnEnd` 處理 DOT/HOT、暈眩、buff/debuff 倒數——這塊是完整可用的，不是半成品。

### 2.2 扣血與死亡

`_takeDamage(dmg)`（[com_stats.js:337](../src/components/com_stats.js#L337)）：套用 HP 變化、依 `dmg.type`（`GM.CRIT`/`GM.MISS`/`GM.EVA`/`GM.HIT`）噴對應的傷害數字彈窗、`emit(GM.EVT.DAMAGE)`；HP 第一次歸零時（`alive && hp<=0`）額外 `emit(GM.EVT.ONDEAD)`，之後不會重複觸發。

### 2.3 `com_stats_old.js` 是死代碼

`player.js`/`npc.js`/`role.js` 都只 import `com_stats.js`，`com_stats_old.js` 沒有任何地方引用。它是舊版設計（用字串事件名、`mods.self/enemy` 形狀、每次命中扣好感度)，留著純粹是設計歷史紀錄，改東西不要照抄它的寫法。

## 3. 攻擊流程

### 3.1 玩家點擊

`com_cmd.js` 的 `_cmd({pt, ent, act})`：
- `bb.sta===GM.ST.ABILITY`（已經用 `selectAbility` 選好技能待點擊目標)→ 呼叫 `root.useAbility(ent)`
- 一般攻擊（`act===GM.ATTACK`）→ 有射程就 `root.attack(bb.ent)`，沒射程先移動靠近

⚠️ **`root.useAbility` 疑似沒有接線**：全專案 grep `root.useAbility\s*=` 找不到任何綁定，`com_ability.js` 只綁了 `root.selectAbility`/`root.unselectAbility`/`root.useAb`（[com_ability.js:272-276](../src/components/com_ability.js#L272-L276)），沒有 `useAbility`。照現在的程式碼，選完技能點擊目標會直接噴 `TypeError: root.useAbility is not a function`，還沒實測確認，但這條路徑看起來是斷的。

### 3.2 NPC AI 觸發

見 §4，最後一樣會走到 `root.attack(target, ability)`。

### 3.3 共同路徑：動畫 → 傷害 → 死亡

```
root.attack(target, ability)                          // com_action.js _attack()
  → 近戰(_attack_Melee)：位移動畫，到位後 onHit
  → 遠程/法術(_attack_Ranged/_attack_Spell)：Projectile 投射物，命中後 onHit
  → onHit = _onDamage(target, ability)
      → computeDamage(attacker, target, ability)       // combat.js
      → target.takeDamage(dmg, attacker)                // com_stats.js _takeDamage
          → 扣血、噴彈窗、emit(GM.EVT.DAMAGE)
          → HP 歸零 → emit(GM.EVT.ONDEAD)（只觸發一次）
```

### 3.4 `ONDEAD` 之後的收尾（事件驅動，各元件各自處理）

| 元件 | 動作 |
|---|---|
| `view.js` `_ondead` | 關互動 zone、等彈窗跑完、移除活體 sprite、換上 `meta.corpse` 屍體圖 |
| `com_loot.js` `_ondead` | 有 `meta.skin`/`meta.meat` 就開「解剖」互動（需要持有 sword 類武器） |
| `npc.js` `_ondead` | 狀態改 `GM.ST.DEATH`、`QuestManager.onKill(id)`、關閉 observe/attack 互動、5 個 tick 後移除（有排程的話改標 `removed:true` 存檔） |
| `player.js` `_ondead` | 狀態改 DEATH、取消回合註冊、送出 `'gameover'` |
| `com_stolen`/`com_trade`/`com_talk`/`com_disp`/`com_inventory`/`com_anim`/`com_nav` | 各自收掉自己的互動/路徑資源 |

## 4. AI 決策（`src/components/ai/`）

Utility AI（不是狀態機/行為樹）：`com_ai.js` 的 `UtilityDecider.decide()` 每個 tick 幫每個行為算分，跑分數最高的那個。

行為權重表 `wTBL`（[com_ai.js:82](../src/components/ai/com_ai.js#L82)）依 `role.json` 的 `meta.style` 決定：

| style | flee | attack | idle |
|---|---|---|---|
| `aggressive`（例：wolf） | 0 | 3.0 | 1.0 |
| `skittish`（例：horse） | 3.0 | 0 | 1.0 |
| `passive_fighter`（預設值，未知/未設定 style 都會落到這個） | 0 | 2.0 | 1.0 |
| `passive_coward`（例：melanie） | 2.0 | 0 | 1.0 |

`BehAttack`/`BehFlee` 的 `score()`：`aggressive`/`skittish` 無條件觸發；其他 style 要看好感度（favor）是否 `<= GM.FAV.HATE` 才會攻擊/逃跑。

⚠️ `role.json` 有些角色的 `meta.style` 寫 `weak`，但 `wTBL` 沒有這個 key，會靜默 fallback 成 `passive_fighter` 的權重——不確定是刻意（`weak` 只影響數值、不影響 AI 行為）還是漏掉，改 AI 權重前先確認一下。

**AI 只會偵測/鎖定玩家**（`com_sense.js` `_sensePlayer()` 只回傳玩家或 `null`），沒有 NPC 對 NPC 的戰鬥/仇恨系統。

`BehAttack.act()` 想用技能時呼叫 `root.useAb('atk')`/`root.useAb('heal')`（`com_ability._query(tag)` 依 `DB.ability(id).tag` 篩選），見 §5 的資料缺口。

`ai_tmp.js`、`com_ai.js` 裡被註解掉的 `BehChase`/`BehTest` 是實驗性/未接線的行為，不在目前跑的行為清單裡。

## 5. 技能資料（`public/assets/json/ability.json`）

`DB.ability(id)` 讀取。目前約 24 個技能，**只有 `fireball`/`firewall` 有完整的戰鬥數值**：

```json
"fireball": {
    "type": "spell", "tag": "atk", "cd": 3, "range": 5,
    "pow": 1.5, "flat": 10, "elm": "fire", "src": "int",
    "sprite": {...}
}
```

其他技能（`slash`、`thrust`、`whirlwind`、`heal`、`cure`、`steal`、`lockpick`、`butcher`、`stealth`、`barter`...）都只有 `icon`/`type`/`tw`/`us`（圖示+中英文說明文字），**沒有 `pow`/`flat`/`elm`/`src`/`tag`/`cd`/`range` 這些實際跑戰鬥計算需要的欄位**——`slash` 的說明文字寫「造成 115% 傷害」，但完全沒有對應資料，純粹是文案佔位。

⚠️ **`COM_Ability._use(target, id)`（[com_ability.js:213](../src/components/com_ability.js#L213)）目前用 `type` 分流,但 `type:"active"` 同時被攻擊技能（`slash`/`thrust`）跟治療技能（`heal`/`cure`）共用**：

```js
if(this._ability.type===GM.ACTIVE)     // GM.ACTIVE === 'active'
{
    // 一律當成治療處理：computeHealing() + root.heal()
}
else if(target && this._isInRange(target.pos))
{
    // 只有 type==='spell' 的技能(目前只有 fireball/firewall)會走到這裡
    root.attack?.(target, this._ability);
}
```
實際驗證過：`slash`/`thrust`（近戰攻擊技能）跟 `heal`/`cure`（治療技能）的 `type` 值都是 `"active"`，兩者現在完全走同一條「治療」分支——用 `slash` 只會嘗試治療目標，不會攻擊。目前唯一能正常造成傷害的技能路徑是 `type:"spell"` 的 fireball/firewall。要修的話，分流依據應該換成 `tag`（`atk`/`heal`/...）而不是 `type`，但目前 `tag` 欄位在資料裡也幾乎沒填（只有 `fireball` 有 `tag:"atk"`），兩件事要一起補。

`ab_tree.json`（`DB.abTree`）是技能樹的節點座標＋前置技能 `refs`（例如 `whirlwind` refs `slash`/`thrust`），沒有解鎖花費/等級需求欄位——這塊解鎖規則（如果有）應該在 UI 端（`uiability.js`），沒在這次調查範圍內確認。

## 6. 裝備數值（`public/assets/json/item.json`）

武器（`cat:"CAT_WEAPON"`）的 `type`（`melee`/`ranged`）、`range`、`atk`、`effects`（`{type:"mod", key:"str", a:1}` 這種修正值陣列，餵給 `com_stats.js` 的 `_metaOfEquips`/`_getMods`）目前是實際在跑的部分——現階段角色的戰鬥力主要由裝備決定，技能系統（除了 fireball/firewall）幾乎不影響數值。

## 7. `GM` 常數（`src/core/setting.js`）值得注意的地方

- `GM.ATTACK='attack'`（互動指令名）跟 `GM.ST.ABILITY='ability'`（`bb.sta`，代表「已選技能待點擊目標」）是兩個不同用途、字串恰好相關的常數，改的時候別搞混。
- `GM.EVT`（403 行附近）：`ONDEAD`/`UNDERATK`/`DAMAGE`/`TURNSTART`/`TURNEND`，戰鬥事件都掛在這裡。
- `GM.MODE = {NORMAL, COMBAT}`（397 行附近）：`GS.mode` 預設是 `NORMAL`，目前只在 `GameScene.process()` 影響「玩家/NPC 是否同時並行處理回合」（見 [record-save-architecture.md](record-save-architecture.md) 以外——這塊在 `GameScene.js`），沒找到其他地方切換到 `COMBAT` 模式，看起來是尚未完全用上的模式切換設計。
- ⚠️ `GM.P`（177~235 行附近）是一整組跟頂層 `GM.*`（238~316 行附近）重複的戰鬥常數（`BASE`/`COMBAT`/`RESIST` 等），命名還不一致（`GM.P` 用 `CRID`，頂層用 `CRD`）。目前 `combat.js`/`com_stats.js` 全部都用**頂層**那組，`GM.P` 沒人在用，疑似是沒清掉的舊草稿，不要照著 `GM.P` 的命名去改東西。

## 8. 已知缺口總結（依影響排序）

1. `COM_Ability._use()` 用 `type` 分流攻擊/治療，但 `slash`/`thrust` 這類攻擊技能跟 `heal`/`cure` 治療技能的 `type` 都是 `"active"`，現在用非 spell 技能一律會被當成治療處理，不會造成傷害
2. `ability.json` 24 個技能只有 2 個（`fireball`/`firewall`）填了 `pow`/`flat`/`elm`/`src` 等戰鬥數值，其餘都是圖示+文案佔位
3. `com_cmd.js` 呼叫 `root.useAbility(ent)`，但沒有任何元件綁定這個方法名（只有 `selectAbility`/`unselectAbility`/`useAb`），選技能點擊目標這條路徑疑似會直接噴錯，需要實測確認
4. AI 的 `queryAb('atk')`/`queryAb('heal')` 依賴 `tag` 欄位，資料裡幾乎沒填，AI 實質上只能用 fireball 施法
5. AI 只鎖定玩家，沒有 NPC 對 NPC 的戰鬥
6. `role.json` 的 `style:"weak"` 在 AI 權重表裡沒有對應項目，會靜默 fallback

這份筆記本身沒有動任何程式碼——上面列的都是現況記錄，要修哪一項再個別討論怎麼改。
