# 已知風險紀錄

記錄目前程式碼裡「現在不會出事，但條件改變就會壞」的潛在風險。發現時先評估影響範圍，決定要不要立刻修；不修的話記錄在這裡，並在程式碼裡加註解指回這份文件。

## `com_port.js` 讀取原始 `bb.zt`，繞過 `View._resolveAxis()`

- **位置**：[src/components/com_port.js](../src/components/com_port.js) 的 `COM_Node._addName()`（約 L87）、`_addPanel()`（約 L116）
- **風險**：這兩處直接讀 `bb.zt`（Tiled 物件的原始自訂屬性值），不是 `View._addListener()` 透過 `_resolveAxis()` 算出來的 `this.zt`。`View` 那邊 `zl`/`zr`/`zt`/`zb`/`zw`/`zh` 支援「三選二」推算（詳見 [view.js](../src/components/view.js) 的 `_resolveAxis()`），但 `com_port.js` 這裡沒有走這條推算路徑。
- **觸發條件**：如果之後有 Tiled 物件改成只給 `zh`+`zb`（或其他不含 `zt` 的組合）來設定 zone、不直接給 `zt`，`bb.zt` 會是 `undefined`，這裡算出來的 `y` 會是 `NaN`，名牌/面板位置會跑掉。
- **現況**：截至 2026-08-22，專案裡所有用到 `zt` 的 Tiled template（`door.tj`、`exit_door.tj`、`forest.tj`、`village.tj`、`well.tj` 等）都是直接給 `zt`，沒有只給 `zh`/`zb` 的用法，所以目前不會觸發。
- **如果要修**：讓 `com_port.js` 改讀 `root.view` 算好的 `this.zt`（或是把 `_resolveAxis()` 的結果透過 `bind()` 曝露給外部使用），而不是繞過 View 直接讀 blackboard 原始值。
