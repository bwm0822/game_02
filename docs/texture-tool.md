# 圖片工具（tools/texture/）

殼的「圖片」分頁：整理 `public/assets/textures/`，看哪些圖沒人引用、被誰引用，把不要的搬進 `.tbd/`、在 `.tbd/` 裡真的刪掉。不改任何 json，引用只列不改。

## 畫面

- 左欄：「未使用」（`.tbd/` 以外沒人引用的）＋資料夾樹（`textures/` 底下，`.tbd/` 排最後，`minimap/` 不列，`textures/` 根目錄的圖只在搜尋／未使用看得到）；`.tbd/` 裡還被引用的圖數字標紅 ⚠。
- 中間：選的資料夾（含子資料夾）的縮圖；未使用的變淡，`.tbd/` 裡還被引用的紅框（遊戲載不到 `.tbd/`，等於已經缺圖）。點一下選取，Ctrl＋點加減，Shift＋點範圍；搜尋框比檔名、跨所有資料夾。有 `_sheet.json`／`_atlas.json` 的標 ▦。
- 右欄：最後點的那張的大圖、路徑、尺寸、sheet 格數／atlas frame 數、引用清單；item／role／ability／fx／dialog／story 的引用有 ↗ 跳到那個分頁（`gotoTab`，story 去掉開頭的 `lines`）。

## 引用規則（`scan.js`）

字串剛好等於檔名（去副檔名）才算，`key:frame` 取冒號前；而且只認放圖的地方，不然 `type: "well"`、`align: "top"`、`_tag = 'well'` 這種同名字串會被當成引用：

- 資料 json（`public/assets/json/*.json`，`textures.json`、`navgraph.json` 除外）：欄位名在 `FIELDS`（`icon`、`sprite`、`back`、`img`）裡的字串值，陣列看上一層的欄位名；物件 key 不算。**遊戲加了放圖的新欄位要加進 `FIELDS`**，不然那些圖會被當成未使用。
- 地圖／template／tsj（`maps/**/*.json`、`templates/**/*.tj`、`tilesets/*.tsj`）：Tiled 自訂屬性的 `value`；tsj 的 `image`（相對 .tsj 解析）比路徑，不追那個 tsj 有沒有地圖在用。
- `src/**/*.js`（`src/old`、`//` 開頭的行不算）：字串字面量要是 `key:frame` 寫法，或那一行有圖片相關的字（`CTX`：image／sprite／texture／icon／img／pic／background／frame／portrait／cursor）。
- sheet／atlas 以整個檔案為單位。
- 還是會誤判：用字串組出來的 key（`${名}-icon`）抓不到，會被當成未使用；同一行剛好有圖片相關字的同名字串會被當成有用。所以沒有「全部刪掉」，一張張看。

## 操作（檔案操作，不進 undo）

- 一般資料夾：「搬到 .tbd」→ `textures/a/b/x.png` 搬到 `textures/.tbd/a/b/x.png`，同名 `_sheet.json`／`_atlas.json` 一起搬；目標已存在就不搬。
- `.tbd/`：「搬回原位」（`.tbd/` 以外已有同 key 的圖＝撞名、或原位已有同名檔就不搬）、「刪除」（`removeEntry`，一定確認、沒有資源回收筒）；做完往上清掉 `.tbd/` 裡的空資料夾（`.tbd/` 本身留著）。
- 有被引用的圖，搬／刪前先列出引用確認，不擋。
- `textures.json` 不用手動更新：dev server 監看 `textures/` 會自己重產，殼廣播後這裡重列（見 [tools-shell.md](tools-shell.md)）。被 tsj 用路徑引用的圖搬走，`scripts/textures.js` 會報錯不產出，要把圖搬回來或改 tsj。

## 重掃

第一次開分頁（拿到專案資料夾）、殼重選資料夾、別的分頁存了 json（`onSaved`）就重掃引用；`textures.json` 的廣播只重列圖。改了 `src/` 或 tsj／地圖要按「重新掃描」。

## 檔案

| 檔案 | 內容 |
|---|---|
| `scan.js` | `listTextures(assets)` 列圖（`{path, key, dir, tbd, metas}`）、`scan(root)` 算引用（`{uses: key→[loc], paths: 路徑→[loc], scanned}`，`loc = {text, go?}`） |
| `main.js` | 畫面、選取、搬移／刪除；`window.__tx` 給測試 |

測試：`node scripts/test/texture.mjs`（OPFS 假專案：列圖、未使用、tbd 標紅、↗、選取、搬到 tbd／搬回／撞名／刪除、殼接線）。
