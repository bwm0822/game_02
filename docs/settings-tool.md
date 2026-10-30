# 設定分頁（tools/settings/）＋ tools/settings.json

工具共用的設定：數字欄的步進、紙娃娃自動拆圖的數字。殼的「設定」分頁看／改，紙娃娃、試穿讀它。

## 檔案

- `tools/settings.json`，**不進 git**（`.gitignore`），工具專用、遊戲不讀。
- **只存跟內建值不一樣的值**：`{step: {...}, auto: {...}}`，沒有的 key＝內建值；改成跟內建一樣的值也會把 key 拿掉。檔案不存在＝全部用內建值，第一次有改才產生。刪掉檔案＝全部回到內建。
- 內建值 `DEF` 在 `tools/common/settings.js`（程式改了內建值，沒改過的格子自動跟上）：
  - `step`：`pct` 0.25、`scale` 0.01、`xy` 0.25（x/y 數字欄，也是紙娃娃方向鍵移動、拖曳吸附的格子；Shift ×10 寫死）、`o` 0.05（ox/oy）、`a` 1。欄位名 → 步進 key 照 `STEP_OF`（`x`/`y`→`xy`、`ox`/`oy`→`o`）。
  - `auto`：`helmet`／`armor`／`boots`／`head`／`hair`（pct/scale/x/y）、`weapon.<分類>`（pct/scale/x/y/a/ox/oy，分類表 `WCLS` 也在這支）、`portrait`（size/fill）、`f.<護具>`（女版 scale/x/y）。
- 讀檔時只認 `DEF` 有的 key，葉子不是有限數字就用內建值。

## tools/common/settings.js

- `load(root)`：專案根目錄 → 讀 `tools/settings.json`，回傳檔案原本在不在；檔案壞了 throw，而且不會設成 ready（不會寫檔蓋掉它）。
- `ready()`／`get(sec)`（合併好的整段，複本）／`over()`（只有改過的值）／`step(欄位名)`。
- `set(sec, value)`：整段換掉（value 可以只給部分，缺的補內建），算出 diff 跟上次一樣就不動；不一樣延遲 500ms 寫檔（連續拖曳只寫一次），寫完 `notifySaved('settings.json')`。還沒 `load` 只改記憶體。
- `flush()`：馬上寫掉排著的（測試用）。
- `onChange(fn)`：別的分頁寫了檔（`BroadcastChannel` 收到 `settings.json`）就重讀再呼叫；自己寫的不會收到。
- `applySteps(root)`：有 `data-step` 的 `<input>` 照設定換 `step`（`data-step` 填欄位名或步進 key）。

## 誰在用

- **紙娃娃**：自動數字只剩一層＝`settings.json`（`autoSet()` 寫 `ST.set('auto', …)`），localStorage `paperdoll.auto` 只記介面狀態 `AUTO_UI`（種類、武器分類、拆法、🔗、☐女版）。拿到專案時 `ST.load()`：檔案不存在就把開頁時從 localStorage 讀到的舊數字搬進去；`settings.json` 還沒讀進來前 `autoSet()` 不寫 localStorage（舊數字要留著等搬家）。專案檔只存介面狀態，舊專案裡的數字開的時候忽略。步進：自動表、圖層屬性列、批次存武器的數字欄用 `data-step`，方向鍵／拖曳吸附用 `ST.step('xy')`。收到 `onChange` 數字換成檔案的、重套步進。
- **試穿**：`numInput()` 的 `step` 用 `ST.step(欄位名)`（沒對應的是 `any`），`setRoot()` 時 `ST.load()`，`onChange` 重畫。

## 設定分頁

- 「步進」一排、「紙娃娃自動拆圖」表格（列：護具／護具（女版）／頭像／武器各分類，欄：存檔%／scale／x／y／a／ox／oy，不適用的格子是灰底空格）＋「頭像合成」（尺寸／%）。
- 每格：有值＝改過（橘色），空白＝內建值（灰字 placeholder，title 也寫內建值）；**清空＝回內建**；存檔%／scale／尺寸／% 跟所有步進要大於 0，不合法的不收、狀態列提示。
- 每列最右 ↺ 整列清空；段標題「全部回到內建」要確認。
- 改了直接存（沒有存檔鈕），頁內 undo／redo（Ctrl+Z／Y，記 `over()` 的快照）；收到別的分頁（紙娃娃）寫檔就重畫、undo 從現在重算。
- 測試：`scripts/test/settings.mjs`（搬家、只存改過的、清空、undo、整列 ↺、步進跨分頁、紙娃娃改數字設定頁跟著變）。
