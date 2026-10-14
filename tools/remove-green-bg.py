#!/usr/bin/env python3
"""
紙娃娃綠色背景移除工具
移除 AI 生成或遊戲素材中的綠色背景，保留衣服、靴子、黑色描邊
用法: python remove-green-bg.py <input.png> [output.png]
"""

import sys
import cv2
import numpy as np
from PIL import Image
from pathlib import Path

def remove_green_background(input_path, output_path=None):
    """
    移除綠色背景，轉成透明 PNG

    Args:
        input_path: 輸入圖片路徑 (RGB or RGBA)
        output_path: 輸出路徑 (預設: input_path 同目錄改名為 outfit_only.png)
    """
    input_path = Path(input_path)

    if not input_path.exists():
        print(f"❌ 檔案不存在: {input_path}")
        return False

    if output_path is None:
        output_path = input_path.parent / "outfit_only.png"
    else:
        output_path = Path(output_path)

    # 確保輸出目錄存在
    output_path.parent.mkdir(parents=True, exist_ok=True)

    print(f"📖 讀取: {input_path}")
    img = Image.open(input_path).convert('RGBA')
    rgba = np.array(img, dtype=np.uint8)

    # RGB 轉 HSV
    rgb = rgba[:, :, :3]
    bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)

    r, g, b, a = rgba[:,:,0], rgba[:,:,1], rgba[:,:,2], rgba[:,:,3]

    # 階段 1: HSV 綠色檢測（捕捉主要綠色）
    lower_green = np.array([45, 60, 20])
    upper_green = np.array([85, 255, 255])
    green_mask_hsv = cv2.inRange(hsv, lower_green, upper_green) > 0

    # 階段 2: RGB 綠色檢測（捕捉邊界綠色）
    green_mask_rgb = (g > 100) & (g > r + 40) & (g > b + 40)

    # 合併遮罩
    green_mask = green_mask_hsv | green_mask_rgb

    # 綠色轉透明
    rgba[green_mask, 3] = 0

    # 儲存
    result = Image.fromarray(rgba, 'RGBA')
    result.save(output_path)

    green_count = np.sum(green_mask)
    transparent_count = np.sum(a[green_mask] == 0)
    opaque_count = np.sum(a > 200)

    print(f"✅ 完成！")
    print(f"   移除綠色像素: {green_count:,}")
    print(f"   保留衣服/靴子: {opaque_count:,}")
    print(f"   輸出: {output_path}")

    return True

def main():
    if len(sys.argv) < 2:
        print(__doc__)
        print("範例:")
        print("  python remove-green-bg.py character.png")
        print("  python remove-green-bg.py character.png ../images/output/outfit.png")
        sys.exit(1)

    input_file = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else None

    success = remove_green_background(input_file, output_file)
    sys.exit(0 if success else 1)

if __name__ == '__main__':
    main()
