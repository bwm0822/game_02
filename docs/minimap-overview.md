# 總覽地圖(縮圖拼接)筆記

修改總覽地圖顯示（`main.world`、`scripts/minimap.js`、`MiniMap`、`PMap`）之前先看這份筆記。涵蓋 10×10 網格地圖系統、縮圖產生流程、執行時合成/顯示邏輯，以及除錯過程中踩過的坑。跟 [docs/map-seamless-transition.md](map-seamless-transition.md)（玩家實際走路時的邊界無縫切換）是兩個不同主題，那份筆記處理「玩家怎麼從一張地圖走到另一張」，這份處理「選單裡的地圖頁籤怎麼顯示整個世界」。

## 1. 設計決策

總覽地圖不再是手繪的獨立 Tiled 檔（舊的 `map.json`，已刪除），改成：**用每張實際遊戲地圖的縮圖，依 `main.world` 的相對位置拼成一張合成貼圖**。玩家在選單「地圖」頁籤看到的，就是縮小版的真實世界，不是另外設計的示意圖。

節點點擊跳轉、任務地點標記這些互動功能目前**暫時關閉**（見 §6），只保留「顯示縮圖背景 + 玩家目前位置標記」。

## 2. 10×10 網格地圖系統

目前世界由 100 張地圖組成，檔名規則 `m_{X}x{Y}.json`（兩位數補零），`X` 是欄（0~9，左到右）、`Y` 是列（0~9，上到下），每張固定 100×100 tile（3200×3200px）。`main.world` 記錄每張的世界座標：`x = X×3200, y = Y×3200`。

```json
{
    "maps": [
        {"fileName": "m_00x00.json", "x": 0, "y": 0, "width": 3200, "height": 3200},
        {"fileName": "m_01x00.json", "x": 3200, "y": 0, "width": 3200, "height": 3200}
    ]
}
```

新遊戲預設地圖是 `Record.game_def.map`（[record.js:8](../src/infra/record.js#L8)），目前指向 `m_00x00`。

> ⚠️ **檔名歷史包袱**：這個世界檔案改過好幾次名字（`main.world` → `map.world` → 又改回 `main.world`），過程中留下了 `_main.world`、`_m_00x-01.json`、`_m_00x00.json`、`_m_00x01.json` 這幾個帶底線前綴的檔案——這些是**改名前的舊資料/備份**，不是現役檔案。現役的只有 `public/assets/maps/main.world`。改路徑相關的程式碼（`Preloader.js`、`scripts/minimap.js`）之前都因為這個來回改名踩過雷，見 §5.5。

## 3. 縮圖產生流程（`scripts/minimap.js` + `scripts/minimap.bat`）

用法：雙擊 `scripts/minimap.bat`，或手動 `node scripts/minimap.js`（需要環境變數 `TMXRASTERIZER` 指到 Tiled 附的 `tmxrasterizer.exe`，`.bat` 已經處理好預設路徑）。

流程：讀 `main.world` → 對每張地圖 → 讀該地圖 json 的 `width`/`height`（tile 數）跟圖層名稱 → 呼叫 `tmxrasterizer` 畫高解析度原圖 → 用 `sharp` 二次縮放到目標尺寸 → 存到 `public/assets/textures/minimap/<地圖名>.png`。

三個關鍵常數（[scripts/minimap.js:12-26](../scripts/minimap.js#L12-L26)）：

| 常數 | 用途 |
|---|---|
| `SOURCE_TILE_PX`(8) | `tmxrasterizer` 畫「高解析度原圖」用的每格像素數，純中繼值，不影響最終輸出 |
| `OUTPUT_SIZE`(100) | 輸出圖片**長邊**要縮成幾像素，短邊依地圖實際寬高比例算。**必須跟 [minimap.js:10](../src/manager/minimap.js#L10) 的 `MiniMap.OUTPUT_SIZE` 保持同一個值**，遊戲執行時合成貼圖用的縮放比例才會跟產圖時一致 |
| `SHOW_LAYER_PREFIX`('map') | 只有名稱以此開頭的圖層會被畫進縮圖，其他一律用 `--hide-layer` 排除——所以**地圖裡想出現在縮圖上的圖層，命名要以 `map` 開頭**（例如 `map_ground`），否則縮圖會是空的 |

### 為什麼要「先用整數畫、再二次縮放」

`tmxrasterizer` 的 `--tilesize`/`--size` 兩個縮放參數**都只吃純整數**，帶小數點就直接失敗（連數值等於整數的 `2.0` 這種寫法都不行），也不能小於 1。想要任意縮放比例（例如小於 1px/格），只能先用整數尺寸畫出一張「原圖」，再用 `sharp`（已加進 `devDependencies`）做第二次縮放，不受這個限制。

## 4. 執行時合成（`src/manager/minimap.js`）

`MiniMap.init(scene)` 在 `GameScene.create()` 呼叫一次（`await MiniMap.init(this);`），流程：

1. 讀 `scene.cache.json.get('world')`（Preloader 已載入的 `main.world`，跟邊界無縫系統共用同一份資料，不用重載）
2. 動態載入每張地圖的縮圖 png（Preloader 階段還不知道 `main.world` 裡列了哪些地圖，只能在這裡另外 `scene.load.image()`）
3. 依 `OUTPUT_SIZE` 反推 `pxPerTile`（每 tile 換算成合成貼圖上幾像素），假設**所有地圖 tile 數相同**（用第一張地圖的尺寸當基準，跟 §3 的 `OUTPUT_SIZE` 用同一套邏輯）
4. 算出所有地圖的邊界框，開一張對應大小的 `RenderTexture`，把每張縮圖依世界座標畫上去，存成 `MiniMap.tex`
5. 同時把每張地圖在合成貼圖裡的 `{x,y,w,h}` 記進 `MiniMap.layout[mapName]`，供 `PMap` 查詢

`MiniMap.worldToTex(mapName, x, y)`：把「某張地圖自己座標系裡的一個點」（例如玩家的 `GM.player.x/y`）換算成合成貼圖座標，查不到該地圖時回傳 `null`。

## 5. PMap 顯示（`src/ui/pmap.js`）

`update()` 的執行順序**非常關鍵**：

```js
update()
{
    this.show();
    this._updateMap();       // 畫背景縮圖
    this._updateQuest();     // 組左側清單
    this.layout();           // 版面重新排版
    this._updatePlayerMark(); // 置中 + 畫玩家標記，一定要排在 layout() 之後
}
```

`_updatePlayerMark()`：用 `Record.game.map` 查 `MiniMap.layout`，算出玩家目前所在地圖縮圖的中心點呼叫 `_centerOn()` 置中；再用 `MiniMap.worldToTex()` 算出玩家在該地圖裡的實際相對位置，呼叫 `_setPlayer()` 畫標記。左側清單「玩家」按鈕（`btn.isPlayer=true`）點擊時也會重新呼叫這個方法。

## 6. 已知現況：節點/任務系統暫時關閉

`_processObjectLayer`/`_addNode`/`_addImage`（原本讀 `map.json` 物件層畫節點/裝飾圖）已經整段刪除（連同 `MiniMap.map`、`UNode` import）。`this._nds` 現在永遠是空物件 `{}`，代表：
- 任務清單裡的任務按鈕（`_updateQuest()` 迴圈）雖然還會產生，但 `if (!pos || !this._nds[pos]) continue;` 永遠會被跳過，**任務地點標記目前不會顯示**
- `_focusOn(nid)` 只有「玩家」按鈕會真的動作（走 `_updatePlayerMark()` 另一條路），其他呼叫都會因為 `this._nds[nid]` 查無資料而安靜地不做事

這是刻意的取捨（先做「只顯示縮圖」），不是 bug。之後要恢復任務地點跳轉，需要另外設計一套「地圖名稱 → 世界座標」的節點資料（例如每張地圖 json 加一個自訂屬性），不能直接沿用舊的 `map.json` 物件層機制。

## 7. 除錯踩過的坑

### 7.1 `Pic` 元件沒給 `w`/`h` 會變成 0 大小、整個消失

`ui.uPic(...)` 底層是 `Pic extends OverlapSizer`（[uicomponents.js:5-19](../src/ui/uicomponents.js#L5-L19)），建構子把 `w`/`h` 直接傳給 `super(scene,x,y,w,h,...)`。一開始想「玩家圖示不用縮放」，把 `w`/`h` 整個省略，結果容器變成 0 大小，圖示畫了但看不到。**這個元件沒有「不給尺寸＝用原始大小」的行為，必須明確給數值。**

### 7.2 `Utility.clamp` 在 `min > max` 時恆回傳 `0`

`Utility.clamp(value,min,max) = Math.min(Math.max(value,min),max)`（[utility.js:89-92](../src/core/utility.js#L89-L92)），這個實作假設呼叫端保證 `min<=max`。`_centerOn()` 原本的 `min = {x:w-img_w, y:h-img_h}` 是給「縮圖比可視面板還大」的情境設計的（這時 `min<0`），但現在縮圖（100px 上下）遠比面板（500px 上下）小，`min` 變成正數、比 `max(=0)` 還大——`Math.max(value,min)` 一定先卡到那個大的 `min`，再被 `Math.min(...,0)` 壓回 `0`，導致捲動位置永遠算出 `0`。

修法：呼叫 `clamp` 前先用 `Math.min(min.x,0)`/`Math.max(min.x,0)` 把範圍排好順序，不管縮圖比面板大或小都能算對。

### 7.3 `update()` 呼叫順序：`layout()` 會蓋掉手動設定的捲動位置

最初把置中邏輯直接寫在 `_updateMap()` 裡，但 `update()` 的順序是 `_updateMap() → _updateQuest() → this.layout()`——捲動位置剛設好，馬上就被後面的 `layout()` 重新排版蓋掉，等於白設，且不會有任何錯誤訊息（純粹「沒作用」）。修法是把置中/畫標記獨立成 `_updatePlayerMark()`，明確排在 `this.layout()` 之後才呼叫。

### 7.4 PowerShell `Set-Content -Encoding utf8` 會帶 BOM，Node `JSON.parse` 讀不動

用 PowerShell 腳本重新產生 `main.world` 時，`Set-Content -Encoding utf8` 在 Windows PowerShell 5.1 底下**一定會加 BOM**（位元組順序記號），瀏覽器端 Phaser 用 `JSON.parse` 讀取時會直接因為開頭的隱藏字元丟出 `Unexpected token` 錯誤。修法是改用 `[System.IO.File]::WriteAllText(path, content, (New-Object System.Text.UTF8Encoding $false))`，明確指定不帶 BOM 的 UTF-8。**以後只要是用 PowerShell 產生給 Node/瀏覽器讀的 JSON 檔，都要注意這點。**

### 7.5 死程式碼沒清乾淨，載入已刪除的舊檔案讓整個遊戲進不去

`MiniMap.init()` 改成合成縮圖貼圖之後，其實還留著一段載入 `public/assets/maps/map.json`（舊的、獨立設計的總覽地圖 Tiled 檔）的程式碼，只是回傳值 `this.map` 已經沒有任何地方在讀（`PMap._processObjectLayer()` 早就沒人呼叫）。後來 `map.json` 這個檔案本身被刪掉（改用縮圖拼接後不需要了），但沒人記得回頭清那段載入程式碼——直到某次重整理地圖檔案，`map.json` 才真的消失，遊戲直接在 `MiniMap.init()` 崩潰（伺服器對不存在的路徑回傳 404 的 HTML，Phaser 拿去 `JSON.parse` 就炸了）。

**教訓：一個資料來源不再被讀取時，載入它的程式碼要一起刪，不要留著「反正沒人用」的死載入——資料檔案本身之後被清掉時就會變成未爆彈。**

### 7.6 `disableUnscrollableDrag` 對 `scrollMode:2` 沒有作用（已放棄的死路）

想解「拖曳縮圖後會跳回左上角」的問題時，試過在 `uScroll(...)` config 加 `disableUnscrollableDrag:false`。查了 rexUI 原始碼（[uicomponents.js:637-651](../src/ui/uicomponents.js#L637-L651)）才發現，這個參數只會傳進 `slider` 設定，而 `PMap._map` 用的 `scrollMode:2`（雙向）底下 `slider()` 直接回傳空物件 `{}`，`disableUnscrollableDrag` 根本不會被用到。**這條路走不通，已經改回去，不要重試。**

## 8. 未解決 / 待辦

- **拖曳地圖縮圖後會跳回左上角**：根因還沒找到（§7.6 排除了一個候選方向），下次要查建議往 rexUI `ScrollablePanel` 的 panel-body 拖曳（drag-to-pan）機制本身找，不是 slider 相關的設定
- **任務地點標記/節點跳轉停用中**：見 §6，需要重新設計節點資料來源
- **`entry` 重生點缺失**：延續 [map-seamless-transition.md §5.8](map-seamless-transition.md#58-案例village-01json-的預設重生點-entry-被誤刪) 的舊問題，新的 `m_00x00.json` 一樣沒有 `entry` 物件，新開局靠 `setPosition()` 的防呆退回地圖中心點
- **100 張地圖目前內容都相同**（複製自同一張模板），實際美術內容還沒畫
