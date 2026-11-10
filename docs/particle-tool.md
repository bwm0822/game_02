# 粒子工具（tools/particle）

視覺化編輯 `public/assets/json/particle.json`（手寫來源檔，格式見 [particle-architecture.md](particle-architecture.md)）。殼的「粒子」分頁，排在「特效」後面（`/tools/#particle`）。讀寫／undo／三方合併／改名刪除沿用 `tools/common/doc.js`（見 [item-editor.md](item-editor.md)），這裡只寫粒子專屬的。

## 介面

- 左：粒子（有人引用）／未使用（灰）／缺粒子（灰，有人引用、particle.json 沒有，點了可以「用範本建立」）。內建 `p-` 形狀用 `builtinCanvas()` 畫圖示（`icons.js` 不認得 `p-`）。
- 表單：
  - 「用到的」：每個引用一個 ↗（`{tab, id, at}`，`at` 是路徑如 `cast.particle`），跳到能力／道具／特效分頁那一筆。
  - 自己的欄位（`schema.js` 的 `OWN`）：圖（內建下拉＋輸入框＋選圖器）、模式（持續／一次噴）、顆數（只有一次噴）、噴多久（只有持續）、跟著走（`local`）、深度、偏移。
  - Phaser 欄位（`PROPS`）分四個框：發射（frequency／quantity／lifespan／maxParticles）、運動（speed／speedX/Y／angle／gravity／acceleration／maxVelocity／moveTo／radial）、外觀（scale／alpha／rotate／tint／color／blendMode）、範圍（emitZone／deathZone，JSON）。只列有值的，「＋ 加屬性」用預設值加。
    - 數值類可切 數值／範圍 `{min,max}`／漸變 `{start,end,ease}`／隨機挑 `[a,b]`（其他寫法顯示 JSON）；換寫法保留數字。
    - `tint`：單色／漸變，用顏色選擇器寫 `#rrggbb`；`color`：顏色列（依壽命漸變），＋／− 增減。
  - 「其他 Phaser 欄位」：表單沒列的 key（JSON 框，原樣傳給 Phaser）。
  - 標題列「JSON」：整筆 JSON 模式（`form.js` 共用）。
- 右：Phaser 預覽（`preview.js`，`Phaser.AUTO`＝WebGL，tint／ADD 跟遊戲一樣；直接呼叫 `src/core/particle.js` 的 `playParticle`）。
  - 情境：原地／拖尾（白點沿弧線來回飛，emitter 跟著它）／角色身上（下拉選角色，預設第一個玩家角色，照 `partsOf()` 合成，`tools/common/pvstage.js` 跟特效分頁共用）／區域（寬×高格，`area` 選項，quantity 乘格數）。
  - 底色、速度（emitter 的 `timeScale`）、粒子數顯示。
  - 播放（從頭）、停止（`stop()`，剩下的飄完）、清除（`stop(true)`，關掉自動重播）、自動重播（一次噴或有 `duration` 的播完 0.4 秒後再播）。
  - 設定記在 `localStorage` 的 `tools.particle.pv`。改了任何欄位就重播，畫布不重建；textures 的圖切成單張貼圖 `pimg-N`。
- 總覽：圖、模式、量／時間、壽命、混合、用到的。

## 引用

`collectRefs()` 掃 ability.json／item.json／fx.json 裡 key 是 `particle` 或 `tickParticle` 的字串值（技能 `cast`／`travel`／`fx`、fx.json 上層）；`collectTiled()` 掃 `maps/**/*.json`、`templates/**/*.tj` 的 Tiled 自訂屬性 `particle`（地圖本身＝環境粒子、物件），要有專案資料夾才掃得到（拿到資料夾時 `draw()` 補掃，`S.refsP` 是那次的 promise），顯示「檔名・物件名稱」不能 ↗。改名只動 particle.json 的 key，確認框列其他檔的引用（不跟著改）。

## 檢查（只警告）

img 在 textures.json 找不到（內建跟 emoji 不查）、mode／depth 不認識、數字欄不是數字、一次噴還寫 duration／frequency、持續噴寫 count、持續噴 frequency −1、emoji 有 tint／color、blendMode 不認識、tint 不是 `#rrggbb`、漸變的 ease 不認識、emitZone／deathZone 不是物件。

## 程式結構

| 檔案 | 內容 |
|---|---|
| `schema.js` | `OWN`、`PROPS`（group／kind／def／hint）、`GROUPS`、`BLENDS`、`valMode()`／`convertVal()`、`template()` |
| `main.js` | 引用、檢查、表單、清單、總覽（`window.__pt`） |
| `preview.js` | Phaser 預覽（`PV`） |
| `tools/common/pvstage.js` | 角色合成（`roleCanvas`／`addRole`）、textures 圖切貼圖（`imgTexture`），特效分頁也用 |

測試：`node scripts/test/particle-tool.mjs`（原樣往返、引用、缺粒子、模式切換欄位、值寫法切換、顏色、檢查、整筆 JSON、預覽各情境／停止／自動重播／textures 圖、殼裡分頁順序與 ↗ 跳特效分頁）。
