# 粒子工具（tools/particle）

視覺化編輯 `public/assets/json/particle.json`（手寫來源檔，格式見 [particle-architecture.md](particle-architecture.md)）。殼的「粒子」分頁，排在「特效」後面（`/tools/#particle`）。讀寫／undo／三方合併／改名刪除沿用 `tools/common/doc.js`（見 [item-editor.md](item-editor.md)），這裡只寫粒子專屬的。

## 介面

- 左：粒子（有人引用）／未使用（灰）／缺粒子（灰，有人引用、particle.json 沒有，點了可以「用範本建立」）。內建 `p-` 形狀用 `builtinCanvas()` 畫圖示（`icons.js` 不認得 `p-`）。
- 表單：
  - 「用到的」：每個引用一個 ↗（`{tab, id, at}`，`at` 是路徑如 `cast.particle`），跳到能力／道具／特效分頁那一筆。
  - 自己的欄位（`schema.js` 的 `OWN`）：圖（內建下拉＋輸入框＋選圖器）、模式（持續／一次噴）、顆數（只有一次噴）、噴多久（只有持續）、跟著走（`local`）、深度、偏移。
  - Phaser 欄位（`PROPS`）分四個框：發射（frequency／quantity／lifespan／maxParticles）、運動（speed／speedX/Y／angle／gravity／acceleration／maxVelocity／moveTo／radial）、外觀（scale／alpha／rotate／tint／color／blendMode）、範圍（emitZone／deathZone）。只列有值的，「＋ 加屬性」用預設值加。
    - 數值類可切 數值／範圍 `{min,max}`／漸變 `{start,end,ease}`／隨機挑 `[a,b]`（其他寫法顯示 JSON）；換寫法保留數字。數值欄是 `type=number`，↑↓ 步進寫在 `PROPS.<key>.step`（沒寫＝`any`），用 `form.js` 的 `numInput()`，同一格連按併成一步 undo。
    - `tint`：單色／漸變，用顏色選擇器寫 `#rrggbb`；`color`：顏色列（依壽命漸變），＋／− 增減。
    - emitZone／deathZone（`kind:'zone'`，純函式在 `schema.js` 的 zone 段）：type 下拉（emit：random／edge；death：onEnter／onLeave）＋形狀下拉（矩形 `{x,y,w,h}`／圓 `{x,y,r}`／線段 `{x1,y1,x2,y2}`，deathZone 沒有線段＝Phaser 的 Line 沒有 `contains()`）＋數字欄（步進 1；矩形／圓的 x、y 可空，矩形空＝以發射點為中心、灰字顯示那個值）。換形狀保留中心跟大小（`convertShape()`），換成 edge 沒有 quantity／stepRate 補 `quantity:12`、edge 另列 quantity／yoyo／seamless（離開 edge 拿掉）。陣列或認不得的寫法（`zoneEditable()` 為假）退回 JSON 框。座標都相對發射點（含偏移 x／y）。
  - 「其他 Phaser 欄位」：表單沒列的 key（JSON 框，原樣傳給 Phaser）。
  - 標題列「JSON」：整筆 JSON 模式（`form.js` 共用）。
- 版面（`.split`／`.form`／`.split > .pv`）在 `tools/common/style.css`，特效分頁共用：預覽固定寬、表單在自己那欄裡折行（標題列、`.iconField`、`.prop`、input 縮到 100%），真的塞不下才在表單那欄出橫捲軸，永遠不蓋到預覽；測試 `t.formFits()` 量 1024／1400 兩種寬度。
- 右：Phaser 預覽（`preview.js`，`Phaser.AUTO`＝WebGL，tint／ADD 跟遊戲一樣；直接呼叫 `src/core/particle.js` 的 `playParticle`）。
  - 欄寬：左邊框可拖（`splitter.js` 的 `resizeRight()`，200px～60vw，記 `tools.right.particle`，雙擊回預設＝240×180 畫布×2）。畫布跟著變：放大倍率維持 2、照 4:3（`pvstage.js` 的 `stageSize()`），高度超過 `#view` 扣掉控制列就以高為準；`game.scale.resize()` 不重建畫布，世界座標不動（發射點還在 W/2,H/2），變大＝看到更多。拖尾的飛行距離跟著畫布寬。
  - zone 框：emitZone 綠實線、deathZone 紅虛線（「☑ zone 框」可關）。點框選取（疊在一起挑面積小的），選中的出白色把手：矩形 8 個（對邊固定）、圓 1 個（改 r）、線段兩端；拖本體移動。拖曳吸整數、Shift 吸 4px，放開才寫回（`PV.onZone`，一步 undo）。原地／角色身上可拖，拖尾只畫，區域情境不畫 emitZone（被 `area` 蓋掉）、deathZone 照樣可拖。
  - 鏡頭：滾輪以游標為中心縮放（0.1～20）、中鍵拖曳平移，記在 `P.view`（換條目不動）；「置中」、換情境、改區域格數回預設（區域情境＝自動放得下格子）。
  - 情境：原地／拖尾（白點沿弧線來回飛，emitter 跟著它）／角色身上（下拉選角色，預設第一個玩家角色，照 `partsOf()` 合成，`tools/common/pvstage.js` 跟特效分頁共用）／區域（寬×高格，`area` 選項，quantity 乘格數）。
  - 底色、速度（emitter 的 `timeScale`）、粒子數顯示。
  - 播放（從頭）、停止（`stop()`，剩下的飄完）、清除（`stop(true)`，關掉自動重播）、自動重播（一次噴或有 `duration` 的播完 0.4 秒後再播）。
  - 設定記在 `localStorage` 的 `tools.particle.pv`。改了任何欄位就重播，畫布不重建；textures 的圖切成單張貼圖 `pimg-N`。
- 總覽：圖、模式、量／時間、壽命、混合、用到的。

## 引用

`collectRefs()` 掃 ability.json／item.json／fx.json 裡 key 是 `particle` 或 `tickParticle` 的字串值（技能 `cast`／`travel`／`fx`、fx.json 上層）；`collectTiled()` 掃 `maps/**/*.json`、`templates/**/*.tj` 的 Tiled 自訂屬性 `particle`（地圖本身＝環境粒子、物件），要有專案資料夾才掃得到（拿到資料夾時 `draw()` 補掃，`S.refsP` 是那次的 promise），顯示「檔名・物件名稱」不能 ↗。改名只動 particle.json 的 key，確認框列其他檔的引用（不跟著改）。

## 檢查（只警告）

img 在 textures.json 找不到（內建跟 emoji 不查）、mode／depth 不認識、數字欄不是數字、一次噴還寫 duration／frequency、持續噴寫 count、持續噴 frequency −1、emoji 有 tint／color、blendMode 不認識、tint 不是 `#rrggbb`、漸變的 ease 不認識、emitZone／deathZone 不是物件／type 不認識／形狀認不得／deathZone 用線段、edge 沒寫 quantity。

**陷阱**：emitter 用 `startFollow` 跟著目標時（角色身上、拖尾，`local` 沒勾），粒子座標是世界座標，Phaser 的 deathZone 拿粒子座標判斷，所以 deathZone 會變成相對地圖原點而不是發射點；預覽一律照相對發射點畫。要在跟著走的粒子用 deathZone，得改 `src/core/particle.js`（目前沒有粒子用 deathZone）。

## 程式結構

| 檔案 | 內容 |
|---|---|
| `schema.js` | `OWN`、`PROPS`（group／kind／def／step／hint）、`GROUPS`、`BLENDS`、`valMode()`／`convertVal()`、`template()`；zone：`ZONES`、`shapeOf()`、`zoneEditable()`、`convertShape()`、`setZoneType()`、`handlesOf()`、`hitZone()`、`dragZone()` |
| `main.js` | 引用、檢查、表單、清單、總覽（`window.__pt`） |
| `preview.js` | Phaser 預覽（`PV`） |
| `tools/common/pvstage.js` | 角色合成（`roleCanvas`／`addRole`）、textures 圖切貼圖（`imgTexture`），特效分頁也用 |

測試：`node scripts/test/particle-tool.mjs`（原樣往返、引用、缺粒子、模式切換欄位、值寫法切換、顏色、檢查、整筆 JSON、預覽各情境／停止／自動重播／textures 圖、zone 表單與拖曳（純函式＋真的用滑鼠拖）、滾輪／置中、版面不溢出、殼裡分頁順序與 ↗ 跳特效分頁）。
