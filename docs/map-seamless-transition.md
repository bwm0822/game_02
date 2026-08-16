# 地圖無縫邊界切換筆記

修改地圖邊界轉場（`main.world`、`GameScene.js` 的 `_checkMapEdge` 相關方法）之前先看這份筆記。涵蓋設計決策、Tiled World 檔案用法、程式架構、以及除錯過程中踩過的坑。

## 1. 設計決策

**目標**：玩家走到地圖邊緣時自動切換到相鄰地圖，不用透過 Port 物件手動互動。

**範圍界定**（刻意不做的事，避免過度工程）：
- **場景切換機制不變**：仍然是 `scene.start()` 整個 Scene 重啟 + `UiChangeScene` 黑幕淡入，**不是**同一個 Scene 內部換資料的真無縫（那個方案需要改 `Map` 的 teardown、camera 跨圖渲染等，工作量大很多，目前沒有採用）。
- **一次只載入一張地圖**：不做兩張地圖同時渲染、camera 跨地圖的機制。
- 「無縫」指的是**觸發方式**（走到邊界自動觸發，不用按互動鍵）+ **落點座標連續**（進新地圖後出現在對應位置，不是傳送到固定點），不是畫面完全不間斷。

## 2. Tiled World 檔案（`public/assets/maps/main.world`）

Tiled 內建的 World 功能：純**編輯器輔助**用途，記錄多張地圖在共用座標空間中的相對位置，方便在 Tiled 裡對齊邊界地形。Runtime（`src/manager/map.js` 的 `Map.createMap()`）完全不需要認識這個檔案，各地圖仍各自是獨立的 json。

### 2.1 建立與編輯（Tiled 操作）

- `World → New World…` 建立
- 開啟地圖後用工具列「Add the current map to a loaded world」/「Add another map to the current world」加入
- 切到 World Tool 用滑鼠拖曳或方向鍵對齊位置（**沒有**數字座標輸入欄位，精確座標只能直接編輯 `.world` 檔案本身，格式是純 JSON）
- `World → Save World` 存檔

### 2.2 檔案格式

```json
{
    "maps": [
        {"fileName": "forest-01.json", "x": 0, "y": 1280, "width": 1280, "height": 1280},
        {"fileName": "village-01.json", "x": 0, "y": 0, "width": 1280, "height": 1280}
    ]
}
```

`x`/`y`/`width`/`height` 都是像素。village-01 在 `(0,0)`、forest-01 在 `(0,1280)`（南邊），兩張都 40×40 tile、32px 一格 = 1280×1280px，剛好無縫相接。

## 3. 程式架構（`src/scenes/GameScene.js`）

### 3.1 整體流程

```
update() 每幀呼叫 _checkMapEdge()
  → 玩家站在邊界 tile 且該方向有鄰圖
  → 算出鄰圖 + 對應落點座標
  → emit('scene', {map, pos, ambient})
  → setEvent() 的 'scene' handler（統一入口，見 3.4）
  → UiChangeScene 黑幕淡入 → gotoScene(config)
  → scene.start('GameArea', config)   ← 跟 Port 走同一條路，完全複用
  → 新 Scene 的 create() → setPosition() 讀 this._data.pos（見 GameScene.js:381-395）
```

`setPosition()` 本來就有 `this._data.pos` 這個分支（給固定座標用），邊界系統直接餵座標進去，`gotoScene()`/`scene.start()` 完全不用改。

### 3.2 關鍵方法

| 方法 | 位置 | 用途 |
|---|---|---|
| `_findWorldMap(mapName)` | [GameScene.js:77](../src/scenes/GameScene.js#L77) | 依地圖檔名查 `main.world`，回傳該圖的 `{x,y,width,height}` |
| `_findAdjacentMap(dir)` | [GameScene.js:113](../src/scenes/GameScene.js#L113) | 依方向（`'l'/'r'/'t'/'b'`）找矩形邊界剛好相接、且有重疊的鄰圖 |
| `_checkMapEdge()` | [GameScene.js:133](../src/scenes/GameScene.js#L133) | 每幀檢查玩家是否站在邊界 tile，是則算落點座標並 `emit('scene', ...)` |
| `_showEdgeArrows()` | [GameScene.js:84](../src/scenes/GameScene.js#L84) | `create()` 時執行一次，在有鄰圖的邊界上、每個可通行 tile 放一個方向箭頭提示 |

### 3.3 落點座標怎麼算

跨越邊界的那一軸（例如往南走，就是 y 軸）**直接落在鄰圖邊界內側一格**（不是邊界那格本身，見 5.4 為什麼）；平行邊界的那一軸依世界座標換算，讓左右（或上下）位置連續對應：

```js
// dir === 'b'（往南）為例
ntx = tx + (this._worldMap.x - next.x) / tw;   // 平行軸：世界座標換算
nty = 1;                                        // 跨越軸：鄰圖內側第 1 格（不是第 0 格）
```

### 3.4 轉場統一入口（防競態）

`setEvent()`（[GameScene.js:682](../src/scenes/GameScene.js#L682)）裡的 `'scene'` event handler 是**所有**轉場來源（邊界自動偵測 + Port 手動互動）共用的唯一入口，用 `this._transitioning` 擋住重複觸發：

```js
.on('scene', (config)=>{
    if(this._transitioning) {return;}
    this._transitioning = true;
    Ui.get(UI.TAG.CHANGESCENE).start(()=>{this.gotoScene(config);})
})
```

守衛**只能放在這裡**，不能放在 `_checkMapEdge()` 自己身上（見 5.5 為什麼）。

## 4. 素材

- `edgeArrow`（[Preloader.js](../src/scenes/Preloader.js)）：`public/assets/textures/cartography/arrowHead.png`，手繪地圖風格箭頭。專案裡另外還有一個 `'arrow'`（`roles_64x64/arrow.png`）是遠程攻擊用的**投射物**箭矢，兩個不要混用。
- 箭頭 `setDisplaySize(32,32)`、`setDepth(1)`——比 tile layer（depth 預設 0）高、比所有角色/物件（`GameObject.updateDepth()` 用 `depth = this.y`，見 [gameobject.js:345](../src/core/gameobject.js#L345)）都低，維持在地面上不蓋到任何東西。

## 5. 除錯踩過的坑（照時間順序）

### 5.1 `async create()` 的載入空窗期讀到舊場景資料

Phaser 呼叫 `scene.start()` 重用**同一個 Scene 實例**（不是整個銷毀重建），而 `create()` 是 `async` function——Phaser 不會等它 await 完就開始跑 `update()`。所以 `await new Map(this).createMap(...)` 還沒跑完的空窗期，`update()` 照樣在跑，這時候讀到的 `this._worldMap`／`this.map`（Phaser Tilemap）都還是**上一張地圖的舊值或尚未賦值**，會直接崩潰（`Cannot read properties of undefined (reading 'worldToTileX')`）。

修法：`this._worldMap = null` 等重置要放在 `await` **之前**（同步階段），跟其他狀態重置放一起，讓守衛在空窗期能正確擋下。

### 5.2 座標 off-by-one 導致一進新圖就反彈

一開始用「連續像素平移」算落點座標（`globalX - next.x`），玩家會被丟到鄰圖邊界**再往外一格**的無效座標（例如 forest-01 的 `ty=-1`），而那格又符合「站在邊界」的判斷條件，一進新地圖就立刻觸發跳回去，兩張圖來回彈（「一直切換」）。

修法：改成「跨越邊界的軸直接鎖定鄰圖的合法邊界列/欄，只有平行軸用世界座標換算」（見 3.3）。

### 5.3 沒有防抖動，站在邊界就會一直觸發

單靠座標修正還不夠：只要玩家站在邊界 tile 不動，每幀都會重新判斷一次，`_transitioning` 又在新場景 `create()` 被重置成 `false`，等於每次轉場完都可能立刻再觸發一次。

修法：新增 `this._lastTile`，只有 tile **真的變了**才重新判斷；`create()` 裡 `setPosition()` 完成後，把玩家出生位置直接寫進 `_lastTile` 當基準值，避免「剛傳送過來、人還站在邊界那格」的當下被誤判成又要切換。

### 5.4 進新圖後仍站在邊界列，被要求「不要站在邊界上」

5.2 的修法會讓玩家精確落在鄰圖邊界的第 0 格／最後一格——這格本身依然符合邊界判斷條件。若玩家在這排邊界上左右（或上下）移動，平行軸的 tile 一變就會被誤觸發（`_lastTile` debounce 只擋「原地不動」，擋不了「沿邊界滑動」）。

修法：落點往鄰圖內側再推一格（`nty = 1` 而非 `0`），玩家一進新圖就已經脫離邊界判斷範圍，順便解掉「沿邊界滑動被誤觸發」的邊緣情況。

### 5.5 轉場競態：Port 互動 + 邊界偵測同時觸發，雙重 `scene.start()`

`_checkMapEdge()` 原本自己設 `this._transitioning = true` 再 `emit('scene', ...)`，這只能擋住**它自己**重複觸發，擋不住「邊界偵測」跟「玩家同時手動觸發一個 Port」這種**不同來源**的轉場請求同時發生。兩個 `'scene'` 事件會各自排一次黑幕淡入、各自呼叫 `gotoScene()`，導致第二次 `scene.start()` 把第一次還在 async 載入中的 `this._data` 蓋掉，`setPosition()` 讀到不一致的資料而崩潰（`Cannot read properties of undefined (reading 'getPts')`）。

修法：守衛移到 `setEvent()` 的 `'scene'` handler（3.4），這是所有轉場來源唯一共用的入口，不管誰先送事件，第二個一律被擋掉。`_checkMapEdge()` 自己不再設這個旗標（不然事件都還沒送到 handler，旗標就已經是 `true`，會把自己也一起擋掉）。

### 5.6 `com_disp.js` 的舊 bug 被邊界系統意外揭露

`COM_Disp`（NPC/玩家講話、彈出圖示，[com_disp.js](../src/components/com_disp.js)）的 `_speak()`/`_pop()` 用原生 `setTimeout` 排程隱藏對話框，這個計時器**不會**跟著 Phaser 場景 `scene.start()` 重啟自動取消。以前很少會在計時器還沒到期前就切場景，邊界自動轉場讓玩家隨時可能中途觸發切換，計時器到期時想操作已經被銷毀的 UI 元件就崩潰（`Cannot set properties of undefined (setting 'hidden')`）。

修法：在兩處 timeout callback 開頭加 `if(!this._sz?.active) {return;}` 防呆，場景已經關閉就直接跳過。**這是既有 bug，跟邊界系統本身無關，只是被更容易觸發的場景切換意外揭露**——之後如果在其他地方看到類似「場景切一半就報錯」，優先懷疑同一類「計時器沒跟著場景清掉」的問題。

### 5.7 `setPosition()` 對應不到 Port 就整個崩潰

`setPosition()`（[GameScene.js:381](../src/scenes/GameScene.js#L381)）原本 `this._data.port` 對應不到 `this.gos` 裡任何物件時會直接崩潰（`Cannot read properties of undefined (reading 'getPts')`）。這條路徑是**既有的 Port 系統**，跟邊界偵測無關，但只要地圖資料有缺（Tiled 物件被刪、改名、id 對不上）就會炸——例如 5.8 那次就是這樣被抓出來的。

修法：找不到就印警告（`console.warn`，帶 map 名稱跟 port id）並退回地圖中心點，不再讓整個 Promise 鏈崩潰。

### 5.8 案例：`village-01.json` 的預設重生點 `entry` 被誤刪

`src/infra/record.js` 的 `Record.game_def = {default:'entry', map:'village-01', ...}`——新遊戲（或死亡重來）會找 `village-01` 地圖裡**名字**叫 `entry` 的物件當重生點（`scene.gos` 是依 `bb.name` 建索引，見 [gameobject.js:123](../src/core/gameobject.js#L123)，不是 Tiled 的數字 id）。

village-01.json 南邊原本有一整排手動放置的舊版傳送門（`exit_b.tj` 模板，用來接 forest-01，在有 `main.world` 自動邊界系統之前的做法），其中一個物件被**順手改名叫 `entry`**、身兼「新遊戲重生點」跟「傳送門」兩種用途。在改用 `main.world` 自動邊界系統、清理這排舊傳送門時，這個物件被整排一起刪掉，連帶讓 `entry` 消失，觸發 5.7 的崩潰。

**這不是程式 bug，是地圖內容資料的問題**，用 5.7 的防呆兜底即可；真的要修要嘛回 Tiled 找個位置補一個名叫 `entry` 的物件，要嘛改 `record.js` 的 `default` 指到別的既有物件名稱。

> ⚠️ 提醒：這幾張地圖（`village-01.json`/`forest-01.json`/`main.world`）目前都是**尚未 commit** 的工作副本，改動前後記得對照 `git diff`。

## 6. 待辦

- `village-01.json` 缺一個名叫 `entry` 的重生點物件（見 5.8），目前靠地圖中心點防呆頂著，位置不一定理想
- 地圖編輯（`village-01.json`/`forest-01.json`/`main.world`）尚未 commit
- `main.world` 目前只有 village-01/forest-01 兩張圖，其他地圖要接進無縫系統得比照 §2 加入 world 檔並對齊座標
