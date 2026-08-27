# 存讀檔（Record）架構筆記

修改存讀檔相關程式碼（`src/infra/record.js`、`GameObject.save()`/`load()`）之前先看這份筆記。涵蓋 `Record.game.scenes` 的資料結構，以及這次除錯踩過的三個坑。

## 1. `Record.game.scenes` 資料結構

```js
Record.game.scenes = {
    "m/m_04x05": {
        prefab: { [uid]: data, ... },   // 具名/固定物件（來自 Tiled 物件層，uid 由 Map.createMap() 指派）
        runtime: [ data, data, ... ],   // 動態生成物件（uid===-1，例如掉落物），用陣列不用 dict
        QK01: { [uid]: data, ... },     // 任務專屬命名空間（qid），例如 #qx01_map 那種 tilemap layer 機制
    }
}
```

- **`prefab`**：來自 Tiled 地圖物件層、由 `Map.createMap()` 指派固定 `uid` 的物件（門、床、NPC 起始位置...），存讀都用 `uid` 當 key，`Record.getByUid`/`setByUid` 直接讀寫 `prefab[uid]`。
- **`runtime`**：`uid===-1` 的物件（不是從 Tiled 物件層來的，用 `new SomeClass(scene,x,y).init_runtime(...)` 動態建立的，例如玩家丟在地上的道具）。因為沒有固定 `uid` 可以當 key，`setByUid` 直接 `push` 進陣列；讀回來時（`GameScene.createRuntime()`）依序重新 `init_runtime()` 建立物件。
- **`QK01` 這種 qid 命名空間**：任務相關的物件存檔，`getByUid`/`setByUid` 多帶一個 `qid` 參數時會走這條路，見 `docs/quest-dialog-architecture.md` §6.1「已改成更通用的機制」。

## 2. `GameObject.save()`/`load()` 怎麼運作

```js
save(data={})
{
    for(let com of Object.values(this.coms)) {data = {...data,...com.save?.()}}
    if(Object.keys(data).length===0) {return;}   // 見 3.1
    this._saveData(data);
}
```

每個掛在物件上的元件（component）可以自己實作 `save()` 回傳要存的欄位（例如 `COM_Pickable.save()` 存 `{...pos, ...content}`），`GameObject.save()` 把所有元件的結果合併成一份 `data` 再交給 `_saveData()`（依 `uid`/`qid` 寫進 `Record.game.scenes`）。沒有實作 `save()` 的元件（`com.save?.()` 回傳 `undefined`）不會貢獻任何欄位。

`Port` 的邊界出口物件（`src/items/port.js` 的 `init_runtime()`）刻意不呼叫 `super.init_prefab()`，所以根本不會被 `GameScene.save()` 的 `Object.values(this.gos).forEach(go=>go.save?.())` 巡到——這批物件每次 `create()` 都靠 `_createEdgeExits()` 整批重新生成，不需要存讀檔。

## 3. 除錯踩過的坑

### 3.1 元件都沒提供資料時，還是會存一個空物件進 `runtime`

`GameObject.save()` 原本無條件呼叫 `this._saveData(data)`，即使合併完 `data` 還是 `{}`。對 `uid===-1` 的物件來說，`setByUid` 是直接 `push`，空物件也照樣被 push 進 `runtime[]`。下次 `GameScene.createRuntime()` 讀到這種空資料，`obj.class` 是 `undefined`（會 fallback 成 `'pickup'`），`Pickup.init_runtime(content)` 裡 `content.id` 也是 `undefined`，`DB.item(undefined)` 查不到資料，直接對 `undefined.drop` 取值崩潰（`Cannot read properties of undefined (reading 'drop')`）。

修法：合併完的 `data` 是空物件就直接 `return`，不呼叫 `_saveData()`（見上面 §2 的程式碼）。

> ⚠️ 這只防得住**之後**新產生的空資料。存檔裡如果已經有殘留的空 `runtime` 項目，這個修法救不回來，要清 localStorage 或開新遊戲。

### 3.2 `prefab`/`runtime` 空了也不會自動清掉，且 `getByUid`/`setByUid` 原本假設兩者永遠存在

即使套用 3.1 的修法，`prefab: {}`、`runtime: []` 這種「存在但是空的」結構還是會一直留在存檔裡（`setByUid` 第一次寫入某張地圖時就會建立 `{prefab:{}, runtime:[]}`，之後就算兩邊都被清空也不會消失）。

修法：`Record.saveGame()` 存檔前呼叫 `_pruneScenes()`：

```js
static _pruneScenes()
{
    const scenes = Record.game.scenes;
    if(!scenes) {return;}
    for(const mapName in scenes)
    {
        const s = scenes[mapName];
        if(s.prefab && Object.keys(s.prefab).length===0) {delete s.prefab;}
        if(s.runtime && s.runtime.length===0) {delete s.runtime;}
        if(Object.keys(s).length===0) {delete scenes[mapName];}
    }
}
```

⚠️ **地圖整個物件（`scenes[mapName]`）要完全沒有任何 key 才能刪掉**，不能只看「沒有 `prefab` 也沒有 `runtime`」——如果只看這兩個 key，會把還有任務資料掛在 `qid` 命名空間下（例如 `QK01`）的地圖存檔一起誤刪。

連帶影響：`prefab`/`runtime` 現在可能被剪掉，`getByUid()`/`setByUid()` 原本假設兩者永遠存在（`scenes[mapName].prefab[uid]` 沒有 optional chaining、`setByUid` 只檢查 `scenes[mapName]` 存不存在就直接 `.runtime.push()`），兩處都要補防呆（讀取用 `?.`，寫入前該補就補 `{}`/`[]`）。

### 3.3 `GameScene.save()` 清空 `runtime` 的路徑寫錯，導致同次進圖重複存檔會疊加掉落物

```js
// 原本(錯的)
if(Record.game[this._data.map]?.runtime) {Record.game[this._data.map].runtime = [];}
// 修正後
if(Record.game.scenes?.[this._data.map]?.runtime) {Record.game.scenes[this._data.map].runtime = [];}
```

`Record.game` 底下根本沒有用地圖名稱當 key 的欄位（`scenes` 才是），原本的條件恆假，**清空從來沒有真正執行過**。

這行的用意是：`save()` 每次都會用 `Object.values(this.gos).forEach(go=>go.save?.())` 把場上目前還存在的掉落物重新 `push` 一份進 `runtime[]`，所以**存檔前要先清空**，不然舊的（上一次 `save()` push 的）不會被移除，跟新的疊在一起。因為路徑寫錯導致清空失效，**同一次進地圖只要存檔存超過一次**（睡覺、切裝備、其他任何觸發 `save()` 的時機），場上每個掉落物就會被重複 `push` 一次；等真的離開這張地圖再回來，`GameScene.createRuntime()` 就會把同一個掉落物重複生成好幾份。

跟 3.1（存空物件崩潰）是兩個不同的坑，但都圍繞著同一個 `Record.game.scenes[mapName].runtime` 陣列——**清空的地方是進地圖時的 `createRuntime()`（路徑是對的），不是離開地圖時的 `save()`（路徑錯了）**，兩處各自負責不同時機，修的時候要分清楚別搞混。
