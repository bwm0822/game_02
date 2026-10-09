# 多國語言（i18n）架構

> 狀態：2026-10-09 設計討論全部定案（共 18 題）；實作照 §13 分階段進行，第 1 階段已完成。

## 已定案

### 1. 範圍
- 全部都要能翻譯：UI、程式寫死字串、item/ability/role、dialog/story 台詞。
- 目前支援 繁中 + 英文；架構要讓「加語言＝加一個翻譯檔，不動程式」。

### 2. 語系代碼
- 用 BCP 47：`zh-TW`、`en`。舊的 `tw` → `zh-TW`、`us` → `en`。
- 設定檔（`Record.setting.lang`）讀到舊值就轉成新代碼。

### 3. 翻譯放哪（gettext 式）
- 資料 xlsx 只寫**原文**（本體是中文），不再每列開語言欄。
- 每個語言一份翻譯表 `xls/lang/<lang>.xlsx`，產出 `public/assets/lang/<lang>.json`。
- 原文語言不需要翻譯檔：目前語言 == 該資料的 `sourceLang` → 直接用原文；否則查翻譯檔，查不到退回原文。
- mod 可以宣告自己的 `sourceLang`（例如英文寫的 mod），中文玩家再另做 `zh-TW.json`。

### 4. 翻譯 key
- key = **情境 + 原文**（gettext 的 `msgctxt` + `msgid`），直接用原文字串當 key，不用雜湊。
- 情境是自動產生的語意路徑，例如 `dlg.karen.n_chat`、`item.sword_01`、`ability.steal`、`ui.weapon`。
- 有共用詞庫 `_shared`：情境查不到時，退到全域同一句的譯文（`離開`、`接受`…）。
- en.json 大致長相：
  ```json
  { "dlg.karen.n_chat": { "這是哪裡?": "Where is this?" }, "_shared": { "離開": "Leave" } }
  ```
- 風險備忘：若未來要全語音配音，需要穩定 line ID；屆時由轉檔腳本在 xlsx 回寫隱藏 ID 欄（Yarn Spinner 式），不用推翻架構。

### 5. 識別字一律 ASCII
- quality、node、storylet、item、spawn 等**識別字**一律 ASCII（小寫 snake_case，`.` 表子層級）；中文只能出現在顯示文字欄位。轉檔腳本檢查，違反就報錯。
- quality 改名：

  | 現在 | 新 id |
  |---|---|
  | `好感` | `favor` |
  | `討伐令` | `bandit_hunt` |
  | `討伐令.殺盜賊` | `bandit_hunt.kills` |
  | `狼患` | `wolf` |
  | `狼患.殺狼` | `wolf.kills` |
  | `狼皮生意` | `pelt_trade` |
  | `殺.*` | `kill.*` |

- 程式寫死處：`com_favor.js` 的 `.好感`、`story.js` 的 `殺.${id}`；測試檔約 23 處。
- Tiled `m_03x05.json` 的 spawn 名 `@狼群`/`@盜賊` → `@wolves`/`@bandits`（連同 story.xlsx 的 spawns）。

### 6. 舊存檔
- 不寫遷移，舊存檔劇情進度作廢（目前沒有外部玩家）。只做設定檔 `lang` 的代碼轉換。
- 讀檔遇到不認得的 quality 值：留著不管、不報錯（為 mod 拔除時的存檔容忍）。
- 存檔版本號等正式發布前再加。

### 7. 既有 tw/us 欄位統一
- item.xlsx / ability.xlsx / local.xlsx 的 `tw`/`us` 欄拿掉，改成單一 `lab`/`des`（原文）。
- 現有英文（item、local 的 `us`）一次性匯入 `en.xlsx`；ability 的 `us` 多為中文佔位，「譯文＝原文」的列跳過。
- 程式約 120 處 `dat[lang].lab` 這類寫法全改成走 `T()`。

### 8. 程式寫死的顯示字串
- 一律搬進 `local.xlsx`，用 ASCII id 取（延續 `'weapon'.lab()` 習慣），local.xlsx 是「UI 原文表」。
- 豁免（可留中文）：`dlog()`、註解、`uidebuger.js`、`manager/test.js` 等開發者專用；`src/old/`。
- 順便刪掉 `src/old/` 以外的舊檔：`*_old.js`、`cmbat copy.js`、`stats copy.js`（刪前確認沒被 import）。

### 9. 文字格式規則
1. 佔位符沿用 `{#name}`，統一由 `T()` 替換（合併 `local.js:30` 與 `utility.js:346` 兩套）；塞進去的值本身也要先翻譯。
2. **禁止程式拼接句子**：一句話是一個完整模板，可有可無的片段也各自是自帶標點的完整模板。例：`utility.js` 的 `fmt_Eff` 改成 `T('eff.dot', {stage, id, num, dur, stack})`，`eff.stage`=`{#v}時，`/`On {#v}, `，並拿掉 `.replace(/，+/g,'，')` 補丁。
3. 轉檔檢查：譯文的佔位符集合、BBCode 標籤須與原文一致，否則標 error、執行期退回原文。
4. 複數／量詞暫不支援（英文先寫 `tile(s)`），需要時再加語法。
5. `_common.lines` 的 `/` 隨機變體整串一起翻，變體數可與原文不同。

### 10. 語言切換
- 重新載入才生效：設定頁改語言 → 存設定 → 回主選單重啟場景（遊戲中先自動存檔）。
- 首次啟動依 `navigator.language`：`zh*` → `zh-TW`，其他 → `en`。
- 只載當前語言的翻譯檔。

### 11. 翻譯流程
- 新增 `scripts/lang.js`，排在 `run_all` 最後；從**產出的 json**（item/ability/local/dialog/story）抽出「情境＋原文」。
- 對每個 `xls/lang/<lang>.xlsx` 做 merge（exceljs 寫入，遵守 quest-dialog-architecture.md §8 樣式）：
  - 新原文 → 新增列，檢查欄 `new`
  - 原文已不存在 → 不刪，移到 sheet 底部，檢查欄 `orphan`；同情境的 new 列「建議」欄自動帶入孤兒的舊譯文
  - 佔位符/BBCode 不一致 → 檢查欄寫 `error: 原因`
  - orphan 永不自動刪，手動刪或 `--prune`
- 一個語言一個 xlsx，一個領域一個 sheet（`ui`、`item`、`ability`、`dialog`、`story`）。
- 欄位：`情境 | 原文 | 譯文 | 檢查 | 審核 | 建議`
  - **檢查**：腳本專用、每次重算（空白／`new`／`orphan`／`error: …`）
  - **審核**：人專用、腳本不動（空白／`mt` 機翻未審／`ok` 已審）
  - 執行期規則：有譯文且檢查欄空白就使用。
- 加新語言：`node scripts/lang.js --add ja`。
- 終端機印統計：`en: 312 ok / 15 new / 3 orphan / 1 error`。

### 12. 英文由誰翻
- Claude 先全部翻完，審核欄標 `mt`；使用者實玩看到怪句子再改並標 `ok`。
- 翻劇情前先向使用者確認各 NPC 人設口吻。之後新增劇情時順手把 `new` 列翻掉。

### 13. 實作分階段
1. ✅ 識別字 ASCII 化（quality/spawn 改名、轉檔 ASCII 檢查、`tw`→`zh-TW`）
   - item/ability/local.xlsx 的語言欄標頭先改成 `zh-TW`/`en`（json 的 `dat[lang]` 照舊能用），第 2 階段整欄拿掉
2. 核心 `T()`＋item/ability/local 拿掉語言欄＋120 處 `[lang].lab` 改走 `T()`
3. 程式寫死字串搬進 local.xlsx、拼接改模板、刪舊檔
4. 劇情文字（uidialog、line、story 的 thread/storylet/quality label）接上 `T()`
5. `scripts/lang.js`（抽取、merge、匯入舊 `us`、產出 json、加進 run_all）
6. 英文上線（Claude 翻譯標 mt、語言切換流程、切英文實玩找爆版）

- 1~4 是純重構：中文畫面完全不變，每階段跑現有無頭測試驗證，一階段一組 commit。

### 14. UI 爆版
- 開發版加偽語系 `qps`（不出現在正式版語言選單）：`T()` 把原文拉長約 2 倍並加括號（`【裝備裝備】`），第 2 階段起就能看出哪裡會爆、哪些字串漏接 `T()`（沒括號的就是漏的）。
- 爆了個案修：加寬、換行或縮短譯文；不做通用自動縮字。

### 15. 情境命名規則
- 對話細到**節點**：同一句（如「好」）在不同節點可以各自翻；到處都一樣的詞靠 `_shared` 後備，只翻一次。
- 代價：節點改名會讓該節點的譯文變 orphan（靠 #11 的「建議」欄帶回舊譯文）。

| 來源 | 情境 |
|---|---|
| local.xlsx | `ui.<localId>` |
| item.xlsx | `item.<id>` |
| ability.xlsx | `ability.<id>` |
| dialog.json 節點 | `dlg.<npc>.<node>`（共用的是 `dlg._common.<node>`） |
| `_common` 的 line | `line.<id>` |
| story thread（title/desc/journal） | `story.thread.<id>` |
| storylet（label/text） | `story.let.<id>` |
| story 節點 | `story.node.<node>` |
| quality label | `story.quality.<id>` |

### 16. textKeys / labelKey 改名
- 實際存的是原文，名字會跟「情境＋原文」的 key 混淆；第 4 階段順便改成 `texts` / `label`（com_talk、scripts/story.js、scripts/tools.js、approach.mjs）。

### 17. NPC 顯示名稱
- `role.xlsx` 加 `name` 欄填中文原文（凱倫、守衛、狼…），情境 `role.<id>`，跟 item 一樣走 `T()`；沒填就退回 id。`guard-1`/`guard-2` 可以填同一個名字。
- 屬於第 2 階段（資料領域，跟 item/ability 一起）；lang.js 的 sheet 加 `role`。

### 18. 字型
- 字型依語言決定：啟動時依當前語言設定 `GM.FONT`（font stack，不內嵌字型檔）。
  - 原文語言 `zh-TW` 沒有翻譯檔，預設值寫在 `setting.js`：`Arial, "Microsoft JhengHei", sans-serif`
  - 其他語言寫在翻譯檔的 `_meta.font`（來源是 `xls/lang/<lang>.xlsx` 的 `meta` sheet），維持「加語言不動程式」
- 第 3 階段順便把散落各處寫死的 `fontFamily` 收斂到 `GM.FONT`（`src/old/` 不動）。
