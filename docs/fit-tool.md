# 試穿（tools/fit）

選角色、穿上裝備，用數字調整角色部件跟裝備疊在身上的擺放，武器可以擺出瞄準／揮砍的姿勢來對握把。開法：`npm run dev` 後開 `/tools/` 的「試穿」分頁（殼見 [tools-shell.md](tools-shell.md)）。

## 範圍

- **角色**：只列紙娃娃型（有 `head` 或 `hand` 的），依 `kind` 分組。
- **五格**：頭盔／護甲／手套／靴子／武器，依道具的 `cat` 分格，只列有 `equip` 的道具（沒有 `equip` 的道具穿上也看不到，所以不列）。選角色時照 `inv.equips` 帶入原本的穿搭；換裝只是試穿，**不會寫回** `inv.equips`（要改穿搭用角色編輯器）。
- **可調**（只用數字欄，畫布只負責預覽）：
  - 角色 `body`/`head`/`hand` 的 `scale/x/y/a/ox/oy` → `role.json`
  - 裝備 `equip` 的 `scale/x/y/a/ox/oy` → `item.json`。**裝備擺放是全角色共用的**，在這個角色身上調準了，換別的角色可能會歪
  - 武器 `equip.aim`（有它才會瞄準）、`swing.aim`、`swing.grip.x/y`（揮砍要三個都有）
  - 欄位清空＝刪 key（遊戲用預設值，placeholder 顯示預設值）；不是數字的不寫
- 不做：改 sprite（用道具／角色編輯器）、改像素（用紙娃娃）、跨角色比對、`ext` 的獨立擺放（跟主圖同一組數字，跟遊戲一樣）。

## 預覽

合成規則同角色編輯器的 `role/preview.js`（也就是 `RoleView._addPart`）：部件在 view 中心 +(x, y)、origin `(ox ?? 0.5, oy ?? 1)`、依 `DEPTH` 疊。虛線是 view、黃十字是錨點（兩個都能關），可開物理 b／佔格 g／互動 z 框、翻面。

倍率有 ×1～×6 和「遊戲」：遊戲畫面固定 1024×768、`Scale.FIT` 塞進視窗、鏡頭沒 zoom，所以「遊戲」＝`min(螢幕寬/1024, 螢幕高/768)`，是全螢幕玩時的大小（視窗越小遊戲裡越小）。canvas 照 `devicePixelRatio` 開，放大不糊。

## 武器姿勢

姿勢數學在 `src/core/pose.js`（純函式、不碰 Phaser）：`aimPose()`、`swingPose()`、`gripAt()`、`swingPlace()`、`dirTo()`。遊戲的 `COM_Anim._aim/_swing` 用 tween 推 `t`，工具用滑桿推，所以兩邊算出來一樣；**改揮砍動作改 pose.js，不要在 com_anim.js 另寫一份**。

- 姿勢下拉：靜止／瞄準／下劈／橫掃，串法照 `com_action.js`：`aim→收回`、`raise→strike→收回`、`sweepRaise→sweep→收回`（中間的 lunge 整隻前撲不演）。武器缺對應參數的選項反灰，換武器後不能用就跳回靜止。
- 時間滑桿 0～1 是整段的進度，`▶ 播放` 照遊戲的 duration／ease 跑一次（ease 只實作用到的 `quad.out`、`cubic.in`）。
- 目標角度：0＝右、90＝下、180＝左。面向跟遊戲的 `face()` 一樣跟著目標翻（目標在左邊就翻面），姿勢模式下「翻面」勾選反灰。
- 只有武器主圖會動，`ext` 不動（遊戲的 swinger／aimer 也只拿 `sps[0]`）。

## 存讀檔

不走 `common/doc.js`（它一頁只管一個檔），自己管兩份：

- undo／redo 一筆記兩個檔的快照（Ctrl+Z／Ctrl+Y，最多 300 步）。
- 存檔（Ctrl+S）只寫有改的檔；寫之前比對硬碟，被別人改過就問「合併／覆蓋／取消」（`merge3`，同 `doc.js`），寫完 `notifySaved()` 廣播。
- 收到別的分頁存檔：那個檔沒改過就重讀（undo 紀錄從現在重算），有改就只提示、存檔時合併。`textures.json` 更新時重畫預覽。
- 換角色時修改留著，一起存；未存狀態回報給殼（分頁 ●、關頁警告）。

## 檔案

| 檔案 | 內容 |
|---|---|
| `tools/fit/main.js` | 狀態、讀寫、undo、清單／表格／預覽、姿勢推進 `poseAt()` |
| `tools/fit/fit.css` | 版面 |
| `src/core/pose.js` | 瞄準／揮砍姿勢純函式（遊戲共用） |

`DEPTH`、`KINDS` 從 `tools/role/schema.js` 拿。

測試：`node scripts/test/fit.mjs`（OPFS 當假的專案根目錄：只列紙娃娃型、帶入原裝、換裝不寫回、數字寫進對的檔、清空刪 key、跨檔 undo、姿勢可用與總長、瞄準角度、遊戲倍率、只存有改的檔、外部修改合併）。
