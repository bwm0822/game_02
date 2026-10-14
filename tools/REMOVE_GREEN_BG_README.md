# 紙娃娃綠色背景移除工具

移除 AI 生成或遊戲素材中的綠色背景，保留衣服、靴子、黑色描邊。

## 安裝依賴

```bash
pip install opencv-python pillow numpy
```

## 使用方法

### 基本用法
```bash
python tools/remove-green-bg.py input.png
```
輸出檔案預設為 `outfit_only.png`（同目錄）

### 指定輸出路徑
```bash
python tools/remove-green-bg.py input.png output/outfit.png
```

### 批次處理
```bash
# Windows
for %f in (*.png) do python tools/remove-green-bg.py "%f" output/"%~nf"

# Linux/Mac
for f in *.png; do python tools/remove-green-bg.py "$f" "output/$f"; done
```

## 工作流程

1. **HSV 綠色檢測** — 捕捉飽和度高的綠色（H 45~85, S 60~255）
2. **RGB 綠色檢測** — 捕捉邊界淡綠色（G > R+40 AND G > B+40）
3. **合併判斷** — HSV OR RGB，確保零遺漏
4. **轉成透明** — 綠色像素設 Alpha=0
5. **保留衣服** — 棕色、米色、黑色描邊完整保留

## 輸出說明

- **格式**: PNG (RGBA)
- **透明度**: 綠色區域變透明，邊界保留反鋸齒效果
- **衣服**: 所有衣服、靴子、黑色描邊完整保留

## 範例

```bash
# 處理角色素材
python tools/remove-green-bg.py character_full.png images/output/outfit_only.png

# 檢查結果
# 用圖片編輯器打開 outfit_only.png，黑色背景下應該只看到衣服和靴子
```

## 常見問題

**Q: 為什麼輸出還有綠色像素？**
A: 邊界反鋸齒可能混有綠色。提高 S（飽和度）閾值或 RGB 判斷條件。

**Q: 怎樣批次處理多個檔案？**
A: 見上方「批次處理」章節。

**Q: 衣服被誤移除了？**
A: 檢查您的衣服顏色。若衣服也是高飽和度綠色系，需手動調整 HSV 範圍。
