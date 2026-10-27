# 多國語言（i18n）架構

> 狀態：2026-10-09 設計討論全部定案（共 18 題）；實作照 §13 分階段進行，第 1～6 階段已完成；英文為 Claude 機翻（審核欄 `mt`），待實玩修句子與爆版。
> 2026-10-26：翻譯表從 `xls/lang/<lang>.xlsx` 改成手寫的 `public/assets/lang/<lang>.json`，用工具殼的「翻譯」分頁編（[lang-tool.md](lang-tool.md)）；§11 底下 xlsx 的描述是舊流程，留作紀錄。

## 已定案

### 1. 範圍
- 全部都要能翻譯：UI、程式寫死字串、item/ability/role、dialog/story 台詞。
- 目前支援 繁中 + 英文；架構要讓「加語言＝加一個翻譯檔，不動程式」。

### 2. 語系代碼
- 用 BCP 47：`zh-TW`、`en`。舊的 `tw` → `zh-TW`、`us` → `en`。
- 設定檔（`Record.setting.lang`）讀到舊值就轉成新代碼。

### 3. 翻譯放哪（gettext 式）
- 資料 xlsx 只寫**原文**（本體是中文），不再每列開語言欄。
- 每個語言一份翻譯檔 `public/assets/lang/<lang>.json`（手寫來源檔＝執行期檔，格式見 [lang-tool.md](lang-tool.md)；原本是 `xls/lang/<lang>.xlsx` 轉出來，已不同步）。
- 原文語言不需要翻譯檔：目前語言 == 該資料的 `sourceLang` → 直接用原文；否則查翻譯檔，查不到退回原文。
- mod 可以宣告自己的 `sourceLang`（例如英文寫的 mod），中文玩家再另做 `zh-TW.json`。

### 4. 翻譯 key
- key = **情境 + 原文**（gettext 的 `msgctxt` + `msgid`），直接用原文字串當 key，不用雜湊。
- 情境是自動產生的語意路徑，例如 `dlg.karen.n_chat`、`item.sword-1`、`ability.steal`、`ui.weapon`。
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
  | `狼患` | `wolf_hunt` |
  | `狼患.殺狼` | `wolf_hunt.kills` |
  | `狼皮生意` | `pelt_trade` |
  | `殺.*` | `kill.*` |

- 程式寫死處：`com_favor.js` 的 `.好感`、`story.js` 的 `殺.${id}`；測試檔約 23 處。
- Tiled `m_03x05.json` 的 spawn 名 `@狼群`/`@盜賊` → `@wolves`/`@bandits`（連同 story.xlsx 的 spawns）。

### 6. 舊存檔
- 不寫遷移，舊存檔劇情進度作廢（目前沒有外部玩家）。只做設定檔 `lang` 的代碼轉換。
- 讀檔遇到不認得的 quality 值：留著不管、不報錯（為 mod 拔除時的存檔容忍）。
- 存檔版本號等正式發布前再加。

### 7. 既有 tw/us 欄位統一
- item.xlsx / ability.xlsx 的語言欄改成 `lab`/`des` 兩欄純文字（原文）；local.xlsx 維持兩列表頭 `key | text(lab, des)`。
- 現有英文（「譯文＝原文」的跳過）已抽到 `xls/lang/_legacy_en.json`（`{情境: {原文: 譯文}}`），第 5 階段匯入 `en.xlsx` 後刪掉。
- 翻譯函式叫 `tr(ctx, src, args)`（`src/infra/lang.js`；`T` 已被 debug 旗標佔用）。
- item/ability 的 `lab`/`des` 在 `DB.load()` 就換成目前語言（原文另存 `_src`，重跑不會疊兩次），程式直接讀 `dat.lab`/`dat.des`；local 是每次 `'key'.lab()` 時才 `tr('ui.<key>', …)`。所以換語言後要重新跑 `DB.load()`（#10 的重新載入）。
- 實際要改的 `dat[lang].lab` 只有約 10 處；其餘 ~110 處 `'xxx'.lab()` 走 `Local`，不用動。

### 8. 程式寫死的顯示字串
- 一律搬進 `local.xlsx`，用 ASCII id 取（延續 `'weapon'.lab()` 習慣），local.xlsx 是「UI 原文表」。
- 豁免（可留中文）：`dlog()`、註解、`uidebuger.js`、`manager/test.js` 等開發者專用。
- 順便刪掉舊檔：`*_old.js`、`cmbat copy.js`、`stats copy.js`（刪前確認沒被 import）。
- 實作（第 3 階段）：
  - UI 標籤加在 `general` 分頁；訊息與句子模板放新的 `msg` 分頁，key 用 `_` 開頭（延續 `_space_full`）。
  - 帶參數：`'_lock_fail'.lab({who})`（`String.prototype.lab(args)` → `tr('ui.<key>', 原文, args)`）。
  - 塞進模板的角色名用 `Local.name(id)`：查不到就顯示 id，不像 `.lab()` 標紅字（`rogue-1` 這類沒列在 local 的）；物品名用 `DB.item(id).lab`。
  - 目前還留著的中文都屬於豁免：除錯介面（`劇情除錯`、`感知除錯`、`[debug] 所有屬性`、line/story 的除錯傾印）、`unit_test()`／`測試`、建構時會被蓋掉的佔位文字（`阿凡達`、`內容`、`['交談','交易','離開']`）、語言自稱（`中文`）、偽語系本身、音樂檔名。

### 9. 文字格式規則
1. 佔位符沿用 `{#name}`，統一由 `tr()` 替換（合併 `local.js:30` 與 `utility.js:346` 兩套）；塞進去的值本身也要先翻譯。
2. **禁止程式拼接句子**：一句話是一個完整模板，可有可無的片段也各自是自帶標點的完整模板。例：`utility.js` 的 `fmt_Eff` 改成 `'_eff_dot'.lab({stage, scope, trigger, num, dur, stack})`，`_eff_stage`=`{#v}時，`/`On {#v}, `，並拿掉 `.replace(/，+/g,'，')` 補丁。觸發片段分 `_eff_trigger`（後面還有字，結尾帶逗號）跟 `_eff_trigger_end`（在句尾）兩種，取代原本靠補丁收掉的雙逗號。
   - `fmt_Des`（技能說明的 `{#fmt}`/`{#elm}`…）是算數值的另一層，維持原樣，吃的是已經 `tr()` 過的說明文字。
3. 轉檔檢查：譯文的佔位符集合、BBCode 標籤須與原文一致，否則標 error、執行期退回原文。
4. 複數／量詞暫不支援（英文先寫 `tile(s)`），需要時再加語法。
5. `_common.lines` 的 `/` 隨機變體整串一起翻，變體數可與原文不同。

### 10. 語言切換
- 重新載入才生效：設定頁改語言 → 存設定 → 回主選單重啟場景（遊戲中先自動存檔）。
- 首次啟動依 `navigator.language`：`zh*` → `zh-TW`，其他 → `en`。
- 只載當前語言的翻譯檔。
- 實作（第 6 階段）：設定頁只能從主選單進，所以不用處理遊戲中存檔；選了不同語言就 `Record.saveSetting()` 後 `window.location.reload()`（瀏覽器、Electron 都適用，DB/UI 文字整個重建）。dropdown 建立時會用目前值呼叫一次 onchange，值沒變就不動。
- 首次啟動預設在 `Record.defaultLang()`；無頭測試的 harness 把 `navigator.language` 固定成 `zh-TW`，測試預期值才會是中文。

### 11. 翻譯流程
- **2026-10-26 改版（現行）**：
  - `public/assets/lang/<lang>.json` 是 `{_meta, _shared:{原文:{t,r}}, <情境>:{原文:{t,r}}}`，只存有譯文的列；檢查欄（new/orphan/error）跟建議都即時算，審核欄變成 `r`。
  - 抽取＋檢查搬到 `src/data/langdata.js`，`Lang.load()`（`compile()`，佔位符不合退回原文）、`scripts/lang.js`、`tools/lang` 共用。
  - `scripts/lang.js` 只檢查、印統計，不寫檔；`--add`／`--prune` 拿掉，改在翻譯分頁「＋ 語言」「刪除全部 orphan」。
  - 改格式時從當時的 `en.json` 就地升級、審核全標 `mt`；`xls/lang/en.xlsx` 跟 `_legacy_en.json` 不再同步（xlsx 裡的審核狀態跟 orphan 沒帶過來），2026-10-27 連同整個 `xls/` 刪除。
- 以下是舊流程（xlsx）：
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
- 實作（第 5 階段）：
  - 抽取直接讀 json 裡轉檔寫好的 `ctx`（§15）；item/ability 沒有 `lab` 的不抽（執行期顯示 id）。
  - `new` 的意思是「還沒有譯文」：列一直是 `new`，直到譯文欄填了東西；填了就重算成空白或 `error`。
  - `shared` 分頁：同一句原文出現在 3 個以上情境就自動列成候選（`_shared` 列）；也可以手動加。shared 有譯文時，各情境沒填譯文的列算 ok，「建議」欄顯示 `shared: …`。原文完全消失時 shared 列才會變 orphan。
  - `meta` 分頁：`font` 等設定，輸出成 json 的 `_meta`；`en` 預設 `Arial, sans-serif`。
  - xlsx 是**整份重建**（每次依抽取順序重排、套統一樣式），所以在 Excel 裡手動調的欄寬、顏色不會保留；人只動「譯文」「審核」兩欄。
  - 執行期：`Preloader` 先 `Record.loadSetting()`，目前語言需要翻譯表（不是 `zh-TW`／`qps`）才載 `lang/<code>.json`；`MainMenu.loadData()` 交給 `Lang.load()`。
  - 舊英文 166 句已匯入 `en.xlsx`（審核欄空白，品質沒保證，例如 `焠毒短劍`→`Iron Sword` 明顯是改名前的舊譯文），`_legacy_en.json` 已刪。
  - qps 以 `/` 分段各自加括號（BBCode 裡的 `/` 不切），對話的隨機變體挑出來每段都有括號。
  - 已知：`COM_Talk._pickText` 跟 `com_disp` 的冒泡台詞用 `split('/')` 切變體，原文或譯文若出現 `[/color]` 這類 BBCode 會被切壞；目前 dialog/story 沒有 BBCode，之後要用再改。

### 12. 英文由誰翻
- Claude 先全部翻完，審核欄標 `mt`；使用者實玩看到怪句子再改並標 `ok`。
- 翻劇情前先向使用者確認各 NPC 人設口吻。之後新增劇情時順手把 `new` 列翻掉。

### 13. 實作分階段
1. ✅ 識別字 ASCII 化（quality/spawn 改名、轉檔 ASCII 檢查、`tw`→`zh-TW`）
   - item/ability/local.xlsx 的語言欄標頭先改成 `zh-TW`/`en`（json 的 `dat[lang]` 照舊能用），第 2 階段整欄拿掉
2. ✅ 核心 `tr()`＋item/ability/local 拿掉語言欄＋`[lang].lab` 改走 `tr()`；開發版設定頁可選 `qps`；測試 `scripts/test/lang.mjs`
3. ✅ 程式寫死字串搬進 local.xlsx、拼接改模板、刪舊檔、字型收斂
4. ✅ 劇情文字（對話節點、line、storylet、thread 日誌）接上 `tr()`；順便補了第 3 階段漏掉的交易/丟棄/拾取拼接句
5. ✅ `scripts/lang.js`（抽取、merge、匯入舊 `us`、產出 json、加進 run_all）
6. ✅ 英文上線（Claude 翻譯標 mt、語言切換流程；切英文實玩找爆版交給使用者）
   - 英文名沿用 local.xlsx 舊 `us` 欄：凱倫→Gilly、習近平→Xi Jinping…；劇情內文提到 karen/xi 時也寫 Gilly/Xi，跟顯示名一致
   - 舊 `us` 欄明顯過時的譯文已改掉並標 mt（匕首→Dagger、焠毒短劍→Venom Shortsword、葡萄→Grapes、毛皮→Pelt、高級X→Fine X…）

- 1~4 是純重構：中文畫面完全不變，每階段跑現有無頭測試驗證，一階段一組 commit。

### 14. UI 爆版
- 開發版加偽語系 `qps`（不出現在正式版語言選單）：`tr()` 把原文拉長約 2 倍並加括號（`【裝備裝備】`），第 2 階段起就能看出哪裡會爆、哪些字串漏接 `tr()`（沒括號的就是漏的）。
- 爆了個案修：加寬、換行或縮短譯文；不做通用自動縮字。

### 15. 情境命名規則
- 對話細到**節點**：同一句（如「好」）在不同節點可以各自翻；到處都一樣的詞靠 `_shared` 後備，只翻一次。
- 代價：節點改名會讓該節點的譯文變 orphan（靠 #11 的「建議」欄帶回舊譯文）。

| 來源 | 情境 |
|---|---|
| local.xlsx | `ui.<localId>` |
| item.json（手寫，item.xlsx 已不轉檔） | `item.<id>` |
| role.json（手寫） | `role.<id>` |
| ability.xlsx | `ability.<id>` |
| dialog.json 節點 | `dlg.<sheet>.<node>`（共用的是 `dlg._common.<node>`） |
| line | `line.<sheet>.<concept>`（line 沒有 id，同一 sheet 同一 concept 的多句靠原文區分） |
| story thread（title/desc/journal/reward） | `story.thread.<id>` |
| storylet（label/hint/text） | `story.let.<id>` |
| story 節點 | `story.node.<node>` |

- 實作（第 4 階段）：節點、line 的情境由 `src/data/storydata.js`（`flattenStory()`／`mergeDialog()`，`DB.load` 跟 `scripts/lang.js` 共用）在載入時算進 `ctx` 欄，執行期直接 `tr(node.ctx, …)`；`_common` 合併進各 NPC 後仍保留 `dlg._common.*`，所以共用台詞只翻一次。`extend` 掛到別的 NPC 節點上的選項自帶 `ctx`（來源 NPC），其他選項沿用節點的。storylet／thread 的情境在執行期組（`Story.cardCtx()`、`Story._threadCtx()`）。
- quality 的 `label` 執行期沒有顯示的地方（只在 xlsx/除錯用），不翻譯；原本表上的 `story.quality.<id>` 拿掉。

### 16. textKeys / labelKey 改名
- 實際存的是原文，名字會跟「情境＋原文」的 key 混淆；第 4 階段順便改成 `texts` / `label`（com_talk、scripts/story.js、scripts/tools.js、approach.mjs）。

### 17. NPC 顯示名稱
- ~~`role.xlsx` 加 `name` 欄~~：實作時發現名字早就在 local.xlsx 的 `roles` 分頁（`karen`→凱倫…），顯示走 `owner.id.lab()`，情境 `ui.<roleId>`，不用另開欄位。
- `rogue-1`/`rogue-2`/`orc`/`wolf`/`horse` 已補進 `roles` 分頁（只有名字，說明待補）。
- 2026-10-19 改版（角色編輯器第 3 步）：名字／說明搬進 `role.json` 的 `lab`/`des`，情境改 `role.<id>`（en.xlsx 另開 `role` 分頁，舊 `ui.<角色>` 譯文已原樣搬過去）；local.xlsx 的 `roles` 分頁刪掉，混在裡面的職業 `rogue` 移到 `jobs`。`DB.load()` 跟 item 一樣 `_localize(roleDB, 'role')`，顯示走 `Role` 的 `label`／`des` getter（沒有 `lab` 就顯示 id）；`Local.name()` 只剩給不一定列在 local 的 key 用（採集工具的 `cat_sub`）。

### 18. 字型
- 字型依語言決定：啟動時依當前語言設定 `GM.FONT`（font stack，不內嵌字型檔）。
  - 原文語言 `zh-TW` 沒有翻譯檔，預設值寫在 `setting.js`：`Arial, "Microsoft JhengHei", sans-serif`
  - 其他語言寫在翻譯檔的 `_meta.font`（翻譯分頁頂端的「字型」），維持「加語言不動程式」
- 第 3 階段順便把散落各處寫死的 `fontFamily` 收斂到 `GM.FONT`。
- 實作：`Lang.load(tbl)` 設定 `GM.FONT`（在 `MainMenu.loadData()` 呼叫）；`com_port`、`view.js` 改用 `GM.FONT`。主選單／GameOver 標題的 `'Arial Black'` 是刻意的粗體標題字，保留（中日韓字會自動退到系統字型）。
