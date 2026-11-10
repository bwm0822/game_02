# 粒子特效架構

一套粒子系統：資料在 `public/assets/json/particle.json`（手寫來源檔），播放在 `src/core/particle.js`（Phaser 3.86 內建 ParticleEmitter 的薄包裝）。遊戲跟工具的 Phaser 預覽共用同一支，core 不 import DB，遊戲端自己 `DB.particle(id)` 查（查不到 `dlog(T.WARN)`）。

## 條目格式

一筆＝Phaser `ParticleEmitterConfig` 原樣，加上自己的欄位：

| 欄位 | 說明 |
|---|---|
| `img` | `p-dot`／`p-soft`／`p-spark`／`p-square`／`p-ring`＝內建形狀（第一次用到才用 canvas 畫）；texture key（`key` 或 `key:frame`）；其他字＝emoji，畫成 32px 的 `emoji:<字>` 貼圖快取。沒寫＝`p-dot` |
| `mode` | `burst`＝一次噴 `count` 顆（預設 10），噴完自動銷毀；`stream`（預設）＝持續噴 |
| `duration` | stream 噴多久（ms）。呼叫端傳的優先；兩邊都沒有＝噴到 `stop()` |
| `local` | `true`＝emitter 加進 parent container，粒子跟著物件走；預設 world＋follow，噴出去的粒子留在原地 |
| `depth` | `'under'`＝畫在目標底下（目標 depth −0.5，每幀跟著更新）；預設 `Infinity` |
| `x`, `y` | 發射點偏移 |

友善寫法（`emitterConfig()` 轉換）：`tint`／`color` 可寫 `'#ff6600'`（單值、陣列、`{start,end}`、`{min,max}`、`{random:[]}` 都行）；`blendMode` 可寫 `'ADD'`；`emitZone`／`deathZone` 的 `source` 寫 `{x,y,w,h}`（沒寫 x/y＝置中）、`{x,y,r}`、`{x1,y1,x2,y2}`。emoji 粒子丟掉 `tint`／`color`（彩色字形染色會髒）。

`p-` 開頭保留給內建形狀，`scripts/textures.js` 擋 `textures/` 裡 `p-` 開頭的檔名。

## 播放

```js
import {playParticle} from '../core/particle.js';
const h = playParticle(scene, DB.particle('ember'), {target: role, oy: -20});
h.stop();          // 停止發射，剩下的飄完才銷毀
h.stop(true);      // 立刻清掉
await h.done;      // 銷毀時 resolve（預設不等，粒子只是裝飾）
```

`opts`：`x`/`y`（沒 target 時的世界座標）、`target`、`parent`（local 用，沒給＝target）、`ox`/`oy`、`duration`、`count`、`area:{w,h,cells}`（區域：發射範圍改成置中的 w×h 矩形，stream 的 `quantity`／burst 的 `count` 乘 `cells`）、`depth`。

生命週期：
- follow 模式 emitter 放 (0,0)（Phaser 的 follow 是粒子出生在 target＋offset 再套 emitter transform）
- 目標 `active` 變 false 或 `scene` 沒了就自動 `stop()`——不聽目標的 `destroy` 事件（GameObject 覆寫了 `on/off/emit`，聽不到）
- emitter 自己的 `destroy`（parent container 被砍、場景關閉）→ 拿掉 update 監聽、resolve `done`
- 不存檔

## 使用端（規劃，見計畫順序）

- 技能（已完成，`com_action.js`）：`cast`／`travel`／`fx` 物件內的 `particle`
  - `cast.particle`：`_castFx()` 在施法者身上噴（follow），不等；`cast.img` 寫 `''` 就不跳 icon（不寫＝技能 icon，跟以前一樣）。summon 型（`com_ability.js`）走 `root.castFx`
  - `travel.particle`：`Projectile` 的 `trail`（spell／fall／ranged 都有），world＋follow 投射物，命中時 `stop()` 讓殘留的飄散；emitter 比投射物先建，同 depth 畫在後面
  - `fx.particle`：`_hitFx()` 在命中點（目標的 pos，或補位空格）噴，不等；`fx.img` 寫 `''` 就不跳 icon
  - 能力分頁檢查 `cast`／`travel`／`fx` 的 `particle` 在 particle.json 有沒有（這三個物件還是在「其他欄位」JSON 裡改）
- fx.json 上層 `particle`（狀態期間持續）／`tickParticle`（tick 時噴、不等），`img` 改選填
- 區域整片一個 emitter（`area`），spawn 播完才噴
- Tiled 物件屬性 `particle`＋`px`/`py`；地圖層級環境粒子跟鏡頭
- 工具殼「粒子」分頁（特效後面）：已完成，見 [particle-tool.md](particle-tool.md)；`builtinCanvas(key)` 給工具畫內建形狀圖示

測試：`node scripts/test/particle.mjs`。
