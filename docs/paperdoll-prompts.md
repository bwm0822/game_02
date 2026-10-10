# 紙娃娃角色 Gemini Prompt 模板

用 ChatGPT 生圖畫二頭身、往右 45 度的紙娃娃零件（改用 Gemini 見文末附註）。

## 規格總覽

**圖層順序（由下往上）**

身體 → 靴子 → 褲子 → 盔甲 → 頭（臉＋光頭＋鬍子）→ 頭髮 → 頭盔／兜帽

戴頭盔／兜帽時隱藏頭髮。

| 零件 | 規則 |
|---|---|
| 身體 | 軀幹＋短腿，沒有手臂 |
| 靴子 | 重點在腳掌，靴筒低（會被褲管蓋住） |
| 褲子 | 褲管蓋到腳踝、蓋住靴筒，不畫腳 |
| 盔甲 | 軀幹＋肩膀，無袖，下襬蓋過褲頭，不畫領口以上 |
| 頭 | 臉＋光頭，鬍子算頭，不畫脖子 |
| 頭髮 | 單層，短髮到齊肩，不能有垂在頭後面的部分 |
| 頭盔／兜帽 | 外輪廓大過頭髮，臉的位置挖空 |

## 操作流程

1. **先畫素體人偶**（下面的 §2），反覆生成到滿意為止，存成 `base-mannequin.png`。之後所有零件都以它為標準，它一改，全部零件都要重畫。
2. **每個零件開一個新對話**，不要在同一串裡連續畫（畫風會漂、錯誤會延續；ChatGPT 的記憶功能也會把舊設定帶進來，必要時用臨時對話）。
3. 每次上傳參考圖：
   - `base-mannequin.png`（比例、朝向）
   - `public/assets/roles_64x64/rogue.png`（畫風）
   - 同類型已完成的零件 1 張（有的話；第一件沒有就省略）
4. Prompt = §1 風格段落 ＋ 該零件模板，`{{ }}` 換成想要的內容。
5. 拿到透明 PNG 後：裁到剛好 → 放進 `public/assets/roles_64x64/` → 在 `role.json`／`item.json` 調 `y`（必要時 `scale`）對齊。
6. 畫不好時，**追加修正**比整段重寫有效，例如：`Same image, but remove the arms.`、`Keep everything, make the boots shorter.`

---

## §1 共用風格段落（每次都貼在最前面）

```
Style: cute chibi 2D game asset, 2-head-tall proportions (head height equals body+legs height).
Thick dark brown-black outline, flat colors with one simple cel-shading tone, warm earthy palette,
matching the art style of the attached reference images exactly. No color filter, no yellow tint.
View: 3/4 view, character facing right at 45 degrees.
Output: a single isolated part only, centered, nothing else in the image.
Background: fully transparent background, PNG with alpha. No shadow, no ground, no text.
```

說明：
- `No color filter, no yellow tint`：ChatGPT 生圖常整體偏暖黃，不加會跟現有素材色調對不上。
- `matching the art style of the attached reference images` 讓它去看你附的 `rogue.png`，比文字描述畫風更準。
- `single isolated part only` 是防止它自作主張畫出整個角色的關鍵句。

---

## §2 素體人偶（只畫一次）

```
Draw a blank base mannequin for a paper-doll character system:
the same stocky ADULT MAN as the rogue reference image, but stripped down.
NOT a baby, NOT a child, NOT a toddler.
- Same body build as the rogue: broad shoulders, thick sturdy barrel-shaped torso, very short thick legs.
- Big slightly square head with a strong jaw, same head size as the rogue.
- Bald, no hair, no beard, no eyebrows. Simple stern adult face like the rogue's expression.
- NO ARMS at all: the shoulders end in a smooth rounded edge, no arms, no hands.
- Feet: simple rounded blocky feet, NO toes.
- Wearing only plain white underwear.
- Skin color: warm orange skin like the body-man reference.
- Thick dark outline and hard-edged cel shading exactly like the rogue.
- Full body, standing straight, facing right at 45 degrees.
```

說明：
- 只寫「光頭、豆豆眼、內褲」會被畫成嬰兒，所以要明講是 rogue 那種成年矮壯大叔、加上 `NOT a baby`。
- 第一次沒有素體可附，只附 `rogue.png` 跟 `body-man.png` 參考畫風和膚色。
- 定案後自己拆成兩張：**身體**（脖子以下）存成 `body-*.png`，整張存成 `base-mannequin.png` 當之後的參考。

---

## §3 零件模板

每個都接在 §1 後面。開頭的 `fits exactly on the attached base mannequin` 是對齊比例用，不要刪。

### 頭（head）

```
Draw ONLY the HEAD of a character, designed to fit exactly on the attached base mannequin
(same head size, same angle).
- Face and bald scalp only. NO HAIR. No neck, no body.
- Character: {{grumpy middle-aged man with a big bushy beard and thick eyebrows}}.
- Beard and mustache are part of the head (draw them if described).
- Ears visible.
```

說明：`{{ }}` 寫長相、表情、膚色、鬍子。不要寫髮型（頭髮另外一層）。

### 頭髮（hair）

```
Draw ONLY the HAIR, designed to sit on top of the attached bald head
(same size and angle). No face, no head, no skin — hair shape only.
- Hairstyle: {{short messy brown hair}}.
- Hair length: short to shoulder-length at most.
- All hair must be on top of or beside the head outline. NO hair hanging behind the head or back,
  no ponytail, no long hair.
- The face area is left empty (transparent).
```

說明：
- 參考圖改附「該角色的頭」，而不是只附素體，這樣頭髮才會貼合。
- 長髮、馬尾在這個系統裡畫不出來，要就之後另外處理。

### 頭盔／兜帽（helmet / hood）

```
Draw ONLY a {{leather helmet / cloth hood}}, designed to be worn on the attached base mannequin's head.
- The face area is a transparent cut-out hole, so the face underneath shows through.
- Its outer silhouette must be larger than the head and fully cover any short hairstyle.
- No head, no face, no hair, no body.
- Design: {{worn brown leather with stitching and a metal rim}}.
```

說明：可以附 `public/assets/roles_64x64/cloth-hood.png` 當「挖空臉」的範例（它是正面的，要特別寫 `but in 3/4 view facing right`）。

### 盔甲（armor）

```
Draw ONLY a {{leather chest armor}}, designed to be worn on the attached armless base mannequin's torso.
- Covers torso and shoulders only. Sleeveless, NO arms, NO hands.
- Nothing above the collar (no neck, no head).
- The bottom hem extends slightly below the waist to cover the top of the pants.
- No body visible, armor only.
- Design: {{brown leather with a belt and metal buckle}}.
```

說明：可以附 `leather-armor.png` 當畫風參考（它是正面的）。

### 褲子（pants）

```
Draw ONLY a pair of {{brown cloth pants}}, designed to be worn on the attached base mannequin's legs.
- From the waist down to the ankles.
- The pant legs cover the ankles and the top of the boots, only the feet will show below.
- NO feet, no shoes, no body.
- Design: {{simple brown trousers with a rope belt}}.
```

### 靴子（boots）

```
Draw ONLY a pair of {{leather boots}}, designed to be worn on the attached base mannequin's feet,
positioned exactly where the feet are (3/4 view, the far boot slightly behind the near boot).
- Low boots: the important part is the foot; the shaft is short because pants will cover it.
- NO legs, no pants, no body.
- Design: {{worn brown leather boots}}.
```

說明：可以附 `leather-boots.png` 當畫風參考。

### 身體（body）

身體通常就是從 §2 素體拆出來的。要畫其他體型（胖、瘦、女性）時：

```
Draw ONLY the BODY (no head) of a variant of the attached base mannequin.
- Body type: {{chubby}}.
- NO ARMS, no hands. Short stubby legs with rounded feet.
- Wearing only plain white underwear.
- Same height and leg position as the mannequin so all clothing parts still fit.
```

---

## 常見失敗與修正句

| 症狀 | 追加這句 |
|---|---|
| 畫出整個角色 | `Only the {{part}} itself, remove everything else.` |
| 長出手臂 | `Remove the arms completely, the character has no arms.` |
| 變成正面 | `Rotate to a 3/4 view facing right at 45 degrees, like the mannequin.` |
| 背景沒有透明 | `Make the background fully transparent and give me the PNG.` |
| 顏色偏黃 | `Remove the yellow tint, keep colors neutral like the reference.` |
| 線條變細、畫風跑掉 | `Use the thick outline and flat shading of the rogue reference image.` |
| 頭髮跑到頭後面 | `Remove all hair behind the head, keep only the hair on top and sides.` |

---

## 附註：改用 Gemini

Gemini（Google AI Studio）不會輸出真正的透明 PNG，寫 transparent 常會畫出假的棋盤格。改用時：

- §1 的 `Background` 那行換成：`Background: solid flat pure magenta #FF00FF, no gradient, no shadow, no ground, no checkerboard, no text.`（角色本身有洋紅色就改 `#00FF00`）
- §1 的 `No color filter, no yellow tint.` 可以拿掉
- 頭髮、頭盔裡的 `transparent` 改成 `filled with the magenta background`
- 拿到圖後要自己去背再裁切
- 背景跑掉時追加：`Replace the background with solid flat #FF00FF only.`
