# 翻譯工具（tools/lang/）

殼的「翻譯」分頁，編 `public/assets/lang/<lang>.json`。整體 i18n 設計見 [i18n-architecture.md](i18n-architecture.md)，殼見 [tools-shell.md](tools-shell.md)。

## 檔案格式

`public/assets/lang/<lang>.json` 是**手寫來源檔，也是遊戲執行期讀的檔**（沒有轉檔）：

```json
{
  "_meta": {"font": "Arial, sans-serif"},
  "ui.weapon": {"武器": {"t": "Weapon", "r": "mt"}},
  "dlg._common.n_cold": {"……又是你。": {"t": "...You again.", "r": "ok"}},
  "_shared": {"離開": {"t": "Leave"}}
}
```

- key 是「情境＋原文」（情境命名見 i18n-architecture.md §15），值是 `{t: 譯文, r: 審核}`；`r` 是空白（沒填）、`mt`（機翻未審）或 `ok`（已審）。
- **只存有譯文的列**。`new`（沒譯文）、`orphan`（原文已經不存在）、`error`（佔位符／BBCode 跟原文不合）跟「建議」都是即時算的，不存。
- 抽原文、算狀態、檢查都在 `src/data/langdata.js`（純函式）：`extract(data)` 從 local/item/role/ability/dialog/story 抽 `{ctx, src}`，`analyze(file, entries)` 算每列狀態，`compile(file)` 給 `Lang.load()` 轉成執行期查表（佔位符不合的譯文不收，退回原文），`scripts/lang.js` 跟工具也用同一套。
- `node scripts/lang.js` 只做檢查、印統計（`en: 551 ok / 78 new / 3 orphan / 0 error`，error 逐列列出），不寫檔；`run_all` 最後一步照樣跑它。
- 舊的 `xls/lang/en.xlsx`、`_legacy_en.json` 已刪除（2026-10-26 改格式時從當時的 `en.json` 就地升級，審核全標 `mt`；2026-10-27 刪掉，en.xlsx 要看去翻 git 歷史）。

## 畫面

- 頂端：語言下拉（列 `lang/*.json`，`zh-TW`／`qps` 不列；選過的記在 `localStorage` 的 `tools.lang.lang`）、「＋ 語言」（建 `<代碼>.json`，只有 `_meta.font`；遊戲的語言選單要另外加）、字型（`_meta.font`，空白＝用原文字型）、搜尋、狀態篩選、「複製待翻」「貼上譯文」。
- 左欄樹：依情境的 `.` 分層（最後一段不列），外加「全部」、`_shared`、`orphan`；每層顯示「待處理（new＋error）／總數」，選到的節點自動展開。
- 表格：情境（相對選到的節點）、原文、譯文（直接編）、審核（點一下 空白 → mt → ok）、檢查、建議。
  - 搜尋**跨整棵樹**（搜情境、原文、譯文）；狀態篩選只在選到的節點裡，要全域就選「全部」。
  - 譯文：Enter 套用並跳下一列（Ctrl+Enter 上一列）、Shift+Enter 換行、Esc 還原；清空＝刪掉那列。改譯文只就地更新那一列（textarea 不重建，篩選中改完的列也先留著），審核狀態不會自動改。
  - 被 `_shared` 蓋到、自己沒譯文的列：譯文欄灰字顯示 shared 譯文、檢查欄寫 `shared`；直接打字就是這個情境自己覆寫，覆寫後「建議」欄有「↺ 回到 shared」。
- 存檔、undo、存前偵測外部修改做情境層級合併都走 `tools/common/doc.js`（`opt.dir = 'lang'`，`opt.file` 隨語言切換）；有 error 只警告不擋存。key 順序：檔案裡原有的照舊，新加的插在原文順序裡前一個已存在的 key 後面（每次 draw 就排好，`S.data` 跟存出來的一致才不會一直算成未存檔）。
- 其他分頁存了 local/item/role/ability/dialog/story 的 json 就重新抽原文、重算狀態。

## orphan 與 shared

- orphan：原文改了字、節點／id 改名或句子刪掉時，舊譯文留在檔案裡變成孤兒。同情境的 new 列「建議」欄會列出那些舊譯文，**點一下＝搬過去**（審核標 `mt`，orphan 刪掉）；同情境剛好一筆 new 一筆 orphan 時檢查欄標「new（可能是改字）」。不會自動搬也不會自動刪：orphan 列有「刪除」，`orphan` 節點有「刪除全部 orphan」。
- shared：同一句原文出現在 3 個以上情境（`SHARED_MIN`）就列在 `_shared` 當候選（不在檔案裡，填了才寫），已經有 shared 譯文的也列。有譯文的列**右鍵「升為 shared」**：譯文搬進 `_shared`，同原文、譯文一模一樣的其他情境一起刪掉（確認框列出是哪些）。

## ↗ 跳到來源

每列情境旁的 `↗` 用 `gotoTab` 跳到來源分頁（orphan 沒有）：

| 情境 | 分頁 | path |
|---|---|---|
| `ui.<key>` | 文字 | `[key]`（[local-tool.md](local-tool.md)） |
| `item.<id>`／`role.<id>`／`ability.<id>` | 道具／角色／能力 | `[id]`（`doc.js` 的 `listenGoto()`；能力分頁自己接，還沒讀檔就記在 `S.goto`） |
| `dlg.<npc>.<node>` | 對話 | `[npc, 'nodes', node]`，extend 掛的選項是 `[npc, 'extend', node]` |
| `line.<npc>.<concept>` | 對話 | `[npc, 'lines', i]`（同 concept 同原文那句） |
| `story.let.<id>`／`story.thread.<id>`／`story.node.<id>` | 任務 | `[line, 'storylets', i]`／`[line, 'threads', id]`／`[line, 'nodes', npc, id]` |

反方向只有文字分頁的「翻譯 ↗」：path `[情境]`，翻譯分頁把它填進搜尋。

## 給 AI 翻

不打 API：

- 「複製待翻」：表格裡目前看得到的 new／error 列，複製成提示詞＋`{情境:{原文:""}}`。提示詞包含遊戲背景、情境前綴的意思、佔位符／BBCode／`/` 變體規則，跟角色譯名表（`role.<id>` 有譯文的角色；表格裡有該 NPC 對話時附上 `des` 當口吻參考）。
- 「貼上譯文」：貼回同格式的 JSON（前後有說明文字或 ``` 也行，取第一個 `{` 到最後一個 `}`），預覽分成「套用」「一樣（跳過）」「空的（跳過）」「對不到原文（不套用）」，佔位符不合的照樣套用但標 error；套用的審核一律標 `mt`。

## 測試

`node scripts/test/lang-tool.mjs`：OPFS 假專案，驗證讀檔／沒改就存一字不差、樹與篩選搜尋、就地編輯與 Enter 跳列、審核循環、清空刪列、新增語言、orphan 建議與刪除、升為 shared／回到 shared、匯出匯入，最後在殼裡測 `↗` 跳到道具／角色／能力／對話／任務分頁。

不做的：直接打翻譯 API、從其他分頁跳回翻譯、複數／量詞語法、遊戲語言選單自動加新語言。
