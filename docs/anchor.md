# 座標：全部相對錨點

2026-11-20 定案並完成。以前 View 有一個看不見的「框」（`wid`×`hei`，錨點是框中心的位移 `anchorX/Y`），物理／佔格／可點方塊（`bl/br…`、`gl…`、`zl…`）量框的邊、角色部位相對框中心；錨點一動方塊就跑掉，工具也一直要寫換算。現在把框拿掉：

- **錨點＝GameObject 的位置**（`root.x/y`），view 放在錨點（`view.x/y` 永遠 0）。
- 圖片、方塊、角色部位、prefab 零件、粒子、光源**全部相對錨點**。
- 方塊只剩兩種：`grid`（佔格：weight／block、尋路體型 `bb.tile`）、`zone`（可點）。body 物理方塊整個拿掉（`_addPhysics()` 本來就沒在用，`bb` 欄位又跟黑板撞名）。
- 方塊內部一律是相對錨點的 `{x, y, w, h}`，**x,y＝左上角**（同 prefab）。

## 三種資料來源

| | 錨點怎麼來 | 方塊怎麼寫 | 沒寫方塊 |
|---|---|---|---|
| 角色（role.json） | GameObject 位置就是錨點 | `grid`／`zone: {x,y,w,h}` | 沒有（沒 grid＝不佔格、`bb.tile` 1×1；沒 zone＝點不到） |
| prefab（prefab.json） | prefab 的 (0,0) | `grid`／`zone: {x,y,w,h}` | 沒有；Tiled 物件寫了量邊欄位（`gl/zt…`，量縮圖外框）就整組蓋掉 |
| 單張圖道具（Tiled tile 物件、item.json `bb`、程式建的 port／pickup／remains／hazardzone） | `al/ar/at/ab`＝錨點到**圖片矩形**左／右／上／下邊的距離（`al` 優先 `ar`、`at` 優先 `ab`），沒寫的軸＝圖片中心 | `gl/gr/gw/gt/gb/gh`、`zl/zr/zw/zt/zb/zh` 量圖片的邊，三選二（`View._resolveAxis()`） | 整張圖 |

單張圖道具的 `wid`/`hei`＝圖片大小（Tiled 透過 `displayWidth` setter 寫進 `bb.wid`）。`View._setAnchor()` 算出圖片矩形相對錨點的位置 `_img`，Tiled 物件（`modify`，Phaser 把它放在圖片中心）把 root 挪到錨點；`_box(k)` 量 `_img` 的邊換成相對錨點的方塊。

`setShape({sprite, x, y, scl, origin})` 的 `x,y`＝origin 點相對錨點，沒寫＝圖片矩形的中心（tree 的 `harvest_tex.y` 因此從 40 改成 8）。單張圖預設 origin 是中心、零件類（prefab png、角色部位）是底邊中點，沒有統一。

會換圖的單張圖道具（door、lamp、採集）之後適合改成 prefab（狀態＝`look`），另開題目。

## Tiled 的角色物件

Tiled 的 tile 物件 `x,y` 是左下角（Tiled 規定），換算規則固定、不讀 role.json：

- 有大小的物件（tile／矩形）：錨點＝**左下角那一格的中心**（`RoleView._setAnchor()`、`mapcheck.js` 的 `placeOf()`、地圖分頁 `edit.js` 的 `makeRole()`）。
- 點物件：點本身就是錨點。

人形 32×64、野獸 64×64 的位置跟以前一樣；轉檔時只有 3 個點物件盜賊（m_03x05）往下挪 16。

## view.rect／pivot

- `view.rect`：圖的範圍（相對錨點）。單張圖＝圖片矩形、prefab＝縮圖外框、角色＝部位合成的範圍（不含武器、手上的工具），`_measure()` 在建立跟換裝（`_updateEquips()`）時量一次（量的時候 shape 暫時回靜止姿勢、不翻面），轉身時繞支點鏡射。給 `getShapeRect()`（遮擋、sandbox 點選）、fx 的 `cell.align`（`cellPos()`）、`bodyTween()` 的底部支點、debug 畫面用。
- `view.pivot`：shape 靜止時的位置。角色的 `_shape` 放在支點（x＝身體圖的中心、y＝合成範圍的中心，人形約錨點上方 17、狼在右邊 16），rig 反向挪回來所以部位數字照樣相對錨點；翻面、走路搖晃、倒地（`_fall()` 把支點移到 grid 中心）都繞它轉，跟以前繞 view 中心差不多。
- `view.zoneBox`：可點方塊（相對錨點），com_port 的名牌貼在它的上緣。

## 角色部位

part.json 的 body 條目 `x/y`（rig 位置）從相對框中心改成相對錨點：人形 `y:32→16`、野獸（`animals-*`、`monsters-0`）`x:0→16, y:32→16`。其他部位相對 rig／支點，不受影響；紙娃娃的 `flatPart()`／`unflatPart()` 照 body 換算，前後一致。

## 工具

- 角色預覽（角色、部位、試穿、道具分頁共用 `tools/role/preview.js`）：畫布的世界原點＝角色大概範圍 `FIG`（`mapcheck.js`，32×64、中心在錨點上方 16）的中心，錨點在 `ANCHOR`（原點下方 16），人形畫面跟以前一樣；「顯示 ▾」剩 錨點／grid／zone／三個支點（`drawBoxes()`、`drawAnchor()`）。
- 地圖分頁／作息地圖：角色小圖的中心＝FIG 的中心，點選框照 FIG。
- 特效／粒子分頁的 Phaser 預覽（`pvstage.js` 的 `addRole()`）：假 view 帶 `rect`（FIG）跟 `pivot`。
- 角色編輯器：`w/h/anchor/b/g/z` 欄位拿掉，改 `grid`／`zone`；新角色範本人形 `{x:-16,y:-16,w:32,h:32}`、野獸寬 64。
- 場景分頁：prefab 方塊剩 grid／zone，沒勾＝沒有，有右鍵動作沒 zone 標 ⚠。

## 轉檔

一次性腳本（沒進 repo）轉了：role.json（刪 `w/h/anchor/b`，`g/z`→`grid/zone`）、part.json 的 body、item.json 的 tree（刪 `bl/bw/bh`、`harvest_tex.y`）、prefab.json（刪 `body`，沒寫方塊的補 thumb 矩形保持行為）、Tiled 的 `anchorY`→`ab`／`at`（exit_door、door、chair、trump-inn-f1 兩個）、`bt` 刪掉（door、house）、點物件角色挪位置。
