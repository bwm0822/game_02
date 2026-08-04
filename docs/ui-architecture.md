# UI 架構筆記（src/ui/）

修改 UI 之前先看這份筆記。涵蓋基底架構、共用元件、既有面板分類，以及新增面板的標準寫法。

## 1. 核心架構

### 1.1 `Ui`（uicommon.js）—— 靜態全域註冊表

`Ui` 不是被繼承的基底類別，而是純靜態（無實例）的全域協調中樞：

| 方法 | 用途 |
|---|---|
| `addToList(ui)` / `on(tag,...args)` / `off(tag)` / `get(tag)` | 以 `tag` 為 key 的「面板總表」，`Ui.on('inv', player)` 等同呼叫 `UiInv.instance.show(player)` |
| `register(ui,type)` / `unregister(ui)` | 以 `tag` 為 key 的「目前開啟面板表」，`type` 是 `GM.UI_LEFT/UI_RIGHT/UI_BOTTOM/...` 之類的 bitmask，供 `closeAll` 分組關閉 |
| `closeAll(mode)` | 依 bitmask 關閉所有符合條件的已註冊面板 |
| `refreshAll()` | 呼叫所有已註冊面板的 `refresh()`（若有實作） |
| `setMode(mode)` / `mode`（getter） | 全域 UI 互動模式：`UI.MODE.NORMAL / FILL / PLACE` |
| `addLayer(scene,name,top)` | 建立 Phaser layer 並加入面板，控制繪製順序 |
| `delayCall(func, delay=GM.OVER_DELAY)` / `cancelDelayCall()` | 統一管理 tooltip（`UiInfo`）顯示延遲的計時器 |

### 1.2 `UiFrame`（uiframe.js）—— 真正的面板基底類別

所有具體面板都 `extends UiFrame`（繼承 rexUI 的 `Sizer`）。

- **建構期** `constructor(scene, config, tag)`：`config.cover` 若給值，會另外包一層全螢幕遮罩 container（可設定點擊遮罩即關閉 `touchClose`）；沒有 `cover` 則面板直接加進該 tag 對應的 layer。自動呼叫 `Ui.addToList(this)`。
- **生命週期**：`show()`/`hide()` 開關可見性；`close()` 預設是 `this.hide()`，各面板通常會 override 並額外呼叫 `unregister()`。
- **輔助方法**：
  - `addBg(scene,config)`：加入背景矩形，滑鼠移入時 `send('clearpath')`
  - `addTop(scene,title)`：加入標題列 + 右上關閉按鈕（綁定 `this.close`）
  - `register(type)`/`unregister()`/`closeAll(mode)`/`refreshAll()`/`on(tag,...)`/`off(tag)`：對 `Ui` 靜態方法的薄包裝
  - `setCamera(mode)`/`clrCamera(mode)`：發送 `'camera'` 事件給 scene（開面板時攝影機偏移，避免擋住玩家）
  - `rePos(margin)`：確保面板不超出畫面邊界

**標準寫法**（以 `UiInv` 為例）：

```js
export default class UiInv extends UiFrame {
    static instance = null;
    constructor(scene) {
        const config = {...};
        super(scene, config, UI.TAG.INV);
        UiInv.instance = this;
        this.addBg(scene).addTop(scene,'bag').addEquips(scene)...
            .setOrigin(1,0).layout().hide();
    }
    show(owner) { super.show(); ...; this.register(GM.UI_RIGHT); }
    close() { super.close(); this.unregister(); }
    static show(owner) {this.instance?.show(owner);}
}
```

### 1.3 `ui.js` 與 `UI` Scene

`src/ui/ui.js` 匯出 `createUI(scene)` 工廠函式；真正的 Phaser Scene 定義在 `src/scenes/UI.js`，與遊戲場景（`GameArea`/`GameScene`）以 `scene.launch()` 並行執行。

雙向溝通：
- UI → 遊戲場景：`UiFrame.send(event, ...args)` → `scene.events.emit(event, ...args)`（如 `send('clearpath')`、`send('save')`、`send('menu')`）
- 遊戲場景 → UI：`area.events.emit('stop_ui')` 觸發 `UI.stop()`

`createUI(scene)` 依序 `new` 出所有面板單例，**順序即 z-order**（越後面越上層），因此 `UiCursor`、`UiInfo`、`UiOption`、`UiMessage`、`UiPopup`、`UiConfirm`、`UiButtons`、`UiChangeScene` 排在最後。

## 2. 共用基礎設施

| 檔案 | 提供內容 | 何時使用 |
|---|---|---|
| `uiframe.js` | `UiFrame` 基底類別 | 寫任何新面板一定 `extends UiFrame` |
| `uicomponents.js` | 元件工廠函式集：`Pic`/`Icon`、`uRect`、`uBbc`（BBCode 文字）、`uDes`、`uPanel`/`uLabel`/`uButton`（`UI.BTN.DEF/ITEM/OPTION/CHECK/FOLD/DROP`）、`uBar`/`uProgress`、`uScroll`、`uStorage`、`uGrid`/`uFix`、`uTabs`、`uSlider`/`uDropdown`、`uInput`、`uFold`、`uGroup` | 建立面板內任何 UI 元素，優先用這裡而不要直接呼叫 rexUI API |
| `uiclass.js` | ⚠️ 不是 UI 類別註冊表，是遊戲物件層級的可互動元件：`Slot`（物品格，含拖曳/右鍵選單/tooltip）、`EquipSlot`、`MatSlot`、`OutputSlot`、`AbilitySlot`、`AbilityItem`/`Ability`、`Effect` | 面板要顯示「物品格/技能格/buff 圖示」時直接 import 使用 |
| `uibuttons.js`（`UiButtons`） | 通用「垂直選單彈窗」 | 需要「點一下彈出幾個選項按鈕」時 |
| `uicursor.js`（`UiCursor`） | 自製游標（取代瀏覽器游標），`static icons` 定義各互動狀態對應圖示 | 新增互動類型時在 `static icons` 補一筆 |
| `uidragged.js`（`UiDragged`） | 拖曳中物品/技能圖示，跟隨滑鼠 | 拖放邏輯核心，由 `DragService` 呼叫 |
| `uipopup.js`（`UiPopup`） | 左上角浮出/收回通知（tween 動畫） | 短暫提示（對比 `uimessage.js` 的訊息佇列） |
| `uiconfirm.js`（`UiConfirm`） | Promise 化確認彈窗，`await UiConfirm.msg('...')` | 任何需要「確定/取消」的操作 |
| `uimisc.js`（`UiMisc`） | 「任務/地圖」頁籤容器，內容委派給 `PQuest`/`PMap` | 見面板分類 |
| `pmap.js`（`PMap`） | 小地圖/任務地圖（非 `UiFrame`，rexUI `Sizer`），讀取 `MiniMap.map` 產生 `UNode` | `UiMisc` 內嵌使用 |
| `pquest.js`（`PQuest`） | 任務列表（非 `UiFrame`），資料來源 `QuestManager` | `UiMisc` 內嵌使用 |
| `unode.js`（`UNode`） | 地圖上可互動地點的容器，非「UI 面板」而是小地圖裡的節點物件 | `PMap._addNode()` 建立 |

## 3. 既有面板分類

> 全數 `extends UiFrame`，在 `ui.js` 的 `createUI()` 中 new 出來，除非特別註明。

**物品/裝備/交易**：`uiinv.js`（背包+裝備）、`uistorage.js`（外部容器）、`uitrade.js`（NPC 交易）、`uisteal.js`（偷竊）、`uimanufacture.js`（製作台）、`uicount.js`（拆分數量 Promise 彈窗）

**角色/能力**：`uiprofile.js`（角色屬性）、`uiability.js`（技能樹）、`uieffect.js`（buff/debuff 常駐列）、`uiobserve.js`（觀察 NPC 資訊卡）

**對話/任務**：`uidialog.js`（NPC 對話框）、`uimisc.js`（任務/地圖頁籤，委派 `PQuest`/`PMap`）

**系統/設定**：`uimain.js`（底部主控列）、`uisetting.js`（遊戲設定）、`uichangescene.js`（黑幕轉場）、`uicover.js`（全螢幕遮罩，計數器支援巢狀開關）、`uigameover.js`（結束畫面）、`uimaplegend.js`（小地圖圖例）、`uidebuger.js`（開發主控台）

**共通彈窗/HUD/游標**：`uiinfo.js`（通用 tooltip）、`uioption.js`（右鍵動作選單）、`uimessage.js`（左下角訊息佇列）、`uitime.js`（右下角時間顯示）

**特殊**：`uimark.js`（`UiMark`——不是 `UiFrame` 子類，是遊戲世界座標的移動目的地標記，在 `GameScene` 而非 `UI` scene 中建立，命名容易誤導）

**⚠️ 已知死代碼（暫未清除，需要時再處理）**：
- `uiquest.js`（`UiQuest`）：`createUI()` 未 new 它，`UI.TAG` 也已無 `QUEST`，功能已被 `uimisc.js`+`pquest.js`+`pmap.js` 取代。`uimain.js` 仍殘留 `import`與 `_quest()` 死方法（按鈕清單中未綁定）。
- `uitest.js`（`UiTest`）：`ui.js` 有 import 但 `createUI()` 從未 new，屬開發期試驗殘留。
- `uiframe.js` 有未使用的 `import UiMark from './uimark.js'`。
- `uidragged.js`／`uicursor.js`／`uicomponents.js`（`Icon`）內留有大段被註解掉的舊版實作。
- `src/old/ui_old.js`：整個 UI 系統重構前的舊版備份，`src/old/` 依專案規範不可引用也不可修改。

## 4. 新增 UI 面板的標準作法

以假設的「成就面板 `UiAchieve`」為例：

1. **命名**：檔名全小寫無底線、`ui` 開頭 → `uiachieve.js`；類別 `UiAchieve`（export default）。
2. **在 `src/core/setting.js` 的 `UI.TAG` 補上識別字串**：`ACHIEVE:'achieve'`。若要被 `Ui.closeAll()` 分組管理，用 `GM.UI_LEFT/UI_RIGHT/UI_BOTTOM/UI_TOP/UI_CENTER` bitmask。
3. **繼承 `UiFrame`**：

```js
import UiFrame from './uiframe.js'
import * as ui from './uicomponents.js'
import {GM,UI} from '../core/setting.js'

export default class UiAchieve extends UiFrame {
    static instance = null;
    constructor(scene) {
        const config = { x:GM.w/2, y:GM.h/2, width:400, orientation:'y',
                          space:UI.SPACE.FRAME, cover:{alpha:0.5} };
        super(scene, config, UI.TAG.ACHIEVE);
        UiAchieve.instance = this;
        this.addBg(scene).addTop(scene,'achieve')
            .layout().hide();
    }
    show(owner) {
        super.show();
        this.owner = owner;
        this.closeAll(GM.UI_CENTER);   // 視需要決定是否關掉同區域其他面板
        this.register(GM.UI_CENTER);
    }
    close() { super.close(); this.unregister(); }
    refresh() { if(this.visible) { /* 供 Ui.refreshAll() 呼叫 */ } }
    static show(owner) {this.instance?.show(owner);}
    static toggle(owner) {this.instance?.visible ? this.instance.close() : this.instance.show(owner);}
}
```

4. **內部元素一律用 `uicomponents.js` 的工廠函式**；需要物品格/技能格時引用 `uiclass.js`。
5. **在 `src/ui/ui.js` 的 `createUI(scene)` 內 import 並 `new UiAchieve(scene)`**（注意 new 的順序影響繪製層級）。
6. **開啟入口**：通常在 `uimain.js` 加按鈕呼叫 `UiAchieve.toggle(this.player)`；或由 `uioption.js` 右鍵選單觸發；或其他面板用 `this.on(UI.TAG.ACHIEVE, target)`。
7. **跨面板通訊慣例**：
   - 順便打開另一面板：`this.on(UI.TAG.B, arg)`
   - 跟遊戲場景溝通：`this.send('eventName', ...args)`
   - 需要使用者確認：`await UiConfirm.msg('...')` 或 `await UiCount.getCount(min,max)`
   - Tooltip：滑鼠移入 `Ui.delayCall(()=>{UiInfo.show(UI.INFO.XXX, this)})`，移出 `Ui.cancelDelayCall(); UiInfo.close();`
8. **狀態存取**：`GM.player` 是全域玩家單例；跨面板刷新資料用 `Ui.refreshAll()`（`refresh()` 內要有 `if(this.visible)` 判斷）。

## 5. `setting.js` 中與 UI 相關的常數速查

- `UI.MODE`：`NORMAL/FILL/PLACE`——全域互動模式（注意：舊常數 `GM.UI_MODE_NORMAL/FILL` 仍與此並存，數值對得上但屬技術債，新代碼一律用 `UI.MODE`）
- `UI.TAG`：每個面板的唯一識別字串（`Ui.on/off/get` 與 `UiFrame` 建構子第三參數用）
- `UI.INFO`：`UiInfo` 支援的 tooltip 樣式（`SLOT/PROP/BTN/ABILITY.{LR,TB}/ACTIVE.{LR,TB}/NODE`）
- `UI.BTN`：`uButton` 支援的按鈕樣式（`DEF/ITEM/OPTION/CHECK/FOLD/DROP`）
- `UI.BG`/`UI.SPACE`：預先定義好的背景樣式與版面間距組合，盡量重用
- `UI.SCROLL`/`UI.SLIDER`/`UI.PROGRESS`：對應元件的樣式列舉
- `GM.UI_LEFT/UI_LEFT_P/UI_RIGHT/UI_CENTER/UI_BOTTOM/UI_TOP/UI_MSG/UI_ALL`：`register()`/`closeAll()` 用的區域 bitmask
- `GM.CAM_LEFT/CAM_RIGHT/CAM_TOP/CAM_LEFT_TOP/CAM_BOTTOM`：對應 `setCamera()`/`clrCamera()` 的攝影機偏移模式
- `GM.OVER_DELAY`（100ms）、`GM.PRESS_DELAY`（250ms）：tooltip 顯示延遲、技能長按延遲，由 `Ui.delayCall()` 使用
