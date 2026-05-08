# CLAUDE.md

## 專案概覽

以 **Phaser 3** 和 **Vite** 為基礎的 2D RPG 瀏覽器遊戲，支援 Electron 桌面版本打包。

## 建置與開發指令

```bash
# 啟動開發伺服器（含 log.js，port 8080）
npm run dev

# 啟動開發伺服器（含 Electron 視窗）
npm run dev-app

# 啟動開發伺服器（不含 log.js）
npm run dev-nolog

# 生產版建置（輸出至 dist/）
npm run build

# 建置 Electron 應用程式版本
npm run build-app

# 打包 Electron 安裝檔
npm run dist

# 部署至 GitHub Pages
npm run deploy
```

## 目錄結構

```
src/
  core/         # 核心工具：gameobject、event、setting、debug、tilemap、combat
  scenes/       # Phaser 場景：Boot, Preloader, MainMenu, Game, GameMap, GameArea, UI, Top
  components/   # 可組合元件：ai/、sleep、door、port、stats、anim 等
  ui/           # UI 類別與面板：uiclass、uiinfo、uiinv、uiprofile、uitrade 等
  roles/        # 角色類別（繼承 GameObject）
  items/        # 地圖物件類別（bed、door、port、well 等）
  manager/      # 管理器：quest、audio、minimap、schedule
  systems/      # 系統：time
  services/     # 服務：dragService、pressService
  infra/        # 基礎設施：record（存讀檔）、local（localStorage）
  data/         # 靜態資料：db.js（集中載入 JSON 資料）
  old/          # 廢棄程式碼（勿修改、勿引用）

public/         # 靜態資源（圖片、音效、地圖、JSON 資料）
vite/           # Vite 設定檔（config.dev.mjs、config.prod.mjs、config.prod_app.mjs）
electron/       # Electron 主程序
dist/           # 建置輸出（勿手動修改）
```

## 架構重點

### GameObject（src/core/gameobject.js）
遊戲場景中所有物件的基底類別，繼承自 `Phaser.GameObjects.Container`。

- `_coms`：元件庫，透過 `addCom()` 掛載行為元件
- `_bb`（blackboard）：元件之間的共享資料中心
- `uid`：由 `map.createMap()` 自動設定；`-1` 表示玩家
- `ctx`：傳遞給元件的上下文物件（含 `root`、`bb`、`scene`）

### 元件系統（src/components/）
功能以元件形式附加在 `GameObject` 上，例如 AI、睡眠、製造、感知等。元件透過 `bb`（blackboard）共享資料，不直接耦合。

### 場景流程
`Boot` → `Preloader` → `MainMenu` → `Game`（讀取存檔）→ `GameMap` 或 `GameArea`  
`UI` 和 `Top` 場景與遊戲場景並行運作（`scene.launch()`）。

### 資料（src/data/db.js）
所有 JSON 資料（item、role、dialog、quest、skill、sk_tree）在 `Preloader` 載入後，統一由 `DB.load(scene)` 解析。

### 存讀檔（src/infra/record.js）
`Record.loadGame()` 在 `Game` 場景執行一次，其他場景不需重複呼叫。存檔資料存於 `localStorage`。

## 代碼規範

- **語言**：JavaScript ES Module（`type: "module"`），禁止使用 CommonJS
- **類別命名**：PascalCase（`class GameMap`、`class UiProfile`）
- **檔案命名**：小寫無底線（`uiprofile.js`、`gameobject.js`）；UI 檔以 `ui` 開頭
- **場景類別**：放於 `src/scenes/`，名稱以大寫字母開頭
- **UI 類別**：放於 `src/ui/`，繼承自 `src/ui/uicommon.js` 的 `Ui` 基底類別
- **全域常數**：集中定義於 `src/core/setting.js`（`GM`、`ORDER`、`UI` 等）
- **Debug 輸出**：使用 `dlog(tag, ...)` 搭配 `T` 旗標（定義於 `src/core/debug.js`）；正式版不留 `console.log`
- **`src/old/`**：廢棄程式碼，不可引用也不可修改
- **不寫多餘的 comments**：除非有隱藏的約束或不直覺的行為，否則不加註解

## 主要依賴

| 套件 | 用途 |
|------|------|
| `phaser` ^3.86 | 遊戲引擎 |
| `phaser3-rex-plugins` ^1.80 | UI plugin、BBCode text、行為元件 |
| `vite` ^5.3 | 打包工具（開發 / 生產） |
| `electron` ^35 | 桌面版打包 |
| `electron-builder` ^26 | Electron 安裝檔產生 |
| `gh-pages` ^6 | GitHub Pages 部署 |
