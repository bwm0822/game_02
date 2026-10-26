# 特效工具（tools/fx）

視覺化編輯 `public/assets/json/fx.json`（手寫來源檔，沒有 xlsx、沒有轉檔腳本）。`npm run dev` 後開 `/tools/#fx`（殼見 [tools-shell.md](tools-shell.md)）。讀寫／undo／三方合併／改名刪除沿用 `tools/common/doc.js`，跟道具、角色編輯器一樣，見 [item-editor.md](item-editor.md)，這裡只寫特效專屬的。

## 資料

`fx.json` = `{id: {img, cell, spawn, idle, tick, end, body}}`，遊戲用 `DB.fx(id)` 查，查不到就不顯示。一筆是哪一種，由**誰引用它**決定（不另外存欄位）：

| 種類 | 誰引用 | 遊戲怎麼播 |
|---|---|---|
| 效果特效 | ability／item 的 `effects[].id`（`type: action` 的瞬間效果不播，不算） | `com_disp.js`：效果進 `_actives` 時 `fxOn`（spawn→idle 常駐），每回合扣血／控制刷新 `fxTick`，結束 `fxOff`（end）；`cell.flash:true` 不常駐，只在 tick 時播 spawn→tick→end |
| 區域特效 | 技能的 `zoneFx`（火牆 `firewall`） | `HazardZone` 讀 `DB.fx(ability.zoneFx)` 交給 `ZoneView`：每格一個，spawn 依 `stagger`／`from` 逐格長出來，角色站的那格 tick，到期 end |

- `img`：emoji，或 textures 的 key（`sheet:格子`／`atlas:frame`／單張圖）。
- `cell`：`size`（沒填 30）、`scale`（數字或 `[min, max]` 隨機）、`alpha`、`flipX`（`true`／`"random"`）；效果特效另有 `align`（`top`／`center`／`bottom`＝view 上緣／中間／下緣）、`ox`／`oy`、`flash`；區域特效另有 `jitter`（每格隨機偏移 ±px）。
- `spawn`／`idle`／`tick`／`end`：Phaser tween 設定，套在格子的 holder 上。`idle.randDelay` 是隨機延遲上限；區域的 `spawn.stagger`（逐格間隔 ms）、`spawn.from`（`center` 中心往外／`near` 離施法者近的先／`random`）。
- `body`：效果特效才有，套在角色身體 `view.shape` 上，只支援 `angle`，以腳底為支點轉（圖示跟著繞），解除時轉回 0。

播放邏輯都在 `src/core/fxcell.js`：`FxCell`（單格）、`attachCell()`（效果特效掛在角色哪裡）、`bodyTween()`、`zoneDelays()`（區域 spawn 先後）。遊戲跟這個工具的預覽呼叫同一份，改動作改這裡。

## 介面

- 左：特效（有人引用）／未使用（灰）／缺特效（灰，effects 或 zoneFx 指到、fx.json 沒有的 id，點了可以「用範本建立」）。清單旁的小字是引用的種類（dot、debuff、區域…）。
- 表單：
  - 「用到的」列出每個引用，↗ 跳到能力／道具分頁那一筆。
  - 圖（選圖器同道具分頁）、格子（`cell`，依種類只顯示有用的欄位，其他 key 在「其他」JSON）。
  - 每個階段一個框，可「建立」「移除」。內容是半結構化表單：時間參數（時長、曲線（下拉 Phaser ease）、延遲、來回、重複 `-1`＝無限；idle 多隨機延遲、區域的 spawn 多逐格間隔／從哪開始）＋屬性列（`scale`／`scaleX`／`scaleY`／`alpha`／`x`／`y`／`angle`，值可以是數值、相對 `+=`／`-=`、從→到；換屬性名位置不變）；表單沒列到的 key 在「其他（JSON）」。框標題的「JSON」整段切成 JSON 框改。
- 右：預覽（Phaser，`preview.js`）。
  - 效果特效套在角色上：下拉選 role.json 的角色（預設第一個怪物，記在 `localStorage` 的 `tools.fx.role`），照角色編輯器的 `partsOf()` 合成一張貼圖當 `view.shape`，root／view／shape 的關係跟 `RoleView` 一樣，所以 `align`、`body` 的支點跟遊戲一致。灰線是地面（角色位置）、灰框是 view（w×h）。
  - 區域特效不放角色，照第一個引用它的技能的 `zoneW×zoneH` 排格子（鏡頭縮到放得下），施法者當作站在區域左邊兩格（`from: near` 用），tick 隨機挑一格。
  - 上身（spawn→idle；閃一下的是 spawn→tick→end）、tick、解除（end）、重播；「自動循環」＝上身→每秒 tick 共 3 次→解除→停一秒再來（按上身／tick／解除會關掉自動循環）；速度 1×／0.5×／0.25×（tween 的 timeScale，循環的間隔一起變）。改了任何欄位就重播，畫布不重建。
- 總覽：圖、種類、大小、基準、閃、有哪些階段、用到的。

## 檢查（只警告）

沒有 img／textures.json 沒有那張圖、`cell` 欄位型別、`align`／`flipX` 不認識的值、階段不是物件、時長等不是數字、不認識的曲線、spawn／tick／end 無限重複（end 無限＝特效不會消失）、閃一下還有 idle／body（遊戲不會播）、`body` 有 `angle` 以外的屬性、區域特效有閃一下／body、同一個 id 同時被當區域跟效果特效。

能力分頁另外檢查技能的 `zoneFx` 有沒有在 fx.json（`zoneW`／`zoneH`／`zoneDur`／`zoneFx` 是能力表單的「區域寬／高／回合／特效」）。

## 改名／刪除

id 就是效果 id 或 `zoneFx`，改名只動 fx.json 的 key，確認框列出 ability.json／item.json 等檔案裡的引用（不跟著改，要自己到能力／道具分頁改）。

## 程式結構

| 檔案 | 內容 |
|---|---|
| `schema.js` | `CELL`、`STAGES`、`TIME`、`PROPS`、`EASES`、`valMode()`、`forKind()`（欄位只給區域／效果特效）、`template()` |
| `main.js` | 引用收集（`collectRefs()`：effects 陣列＋技能 `zoneFx`）、檢查、表單、清單、總覽 |
| `preview.js` | Phaser 預覽（只裝 BBCode 外掛給 emoji 用），import 遊戲的 `src/core/fxcell.js` |

測試：`node scripts/test/fx-tool.mjs`（`window.__fx`，OPFS 假資料夾：原樣往返、引用與缺特效、cell 表單、tween 表單、檢查、改名列引用、預覽（stun 掛在上緣＋body 擺動、解除轉回正、改了重播、閃一下、自動循環、區域 5×1 格）、殼裡 ↗ 跳能力分頁）。
