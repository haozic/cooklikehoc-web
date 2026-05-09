"""Fix black background images - pure Python/numpy/Pillow, no scipy needed."""
import os, numpy as np
from PIL import Image, ImageFilter
import shutil

PUBLIC_IMAGES = 'public/images'

BLACK_BG_FILES = [
    "香菇猪肉烧麦.jpeg",
    "Q 弹虾滑馄饨.jpeg",
    "泡椒鸡杂面.jpeg",
    "笋子鸡丁盖饭（菜苔版）.jpeg",
    "砂锅老坛酸菜鱼.jpeg",
    "五彩鸡丝拌面.jpeg",
    "经典毛豆烧鸡.jpeg",
    "豌豆肉末.jpeg",
    "凤爪蒸豆米.jpeg",
    "剁椒鱼头（白鲢鱼头版）.jpeg",
    "剁椒鱼头（草鱼头版）.jpeg",
    "竹笋蒸鸡翅.jpeg",
]


def box_blur_numpy(arr, radius):
    """Simple box blur using cumulative sums - fast, no scipy needed."""
    if radius <= 0:
        return arr
    h, w = arr.shape[:2]
    result = np.zeros_like(arr)
    for _ in range(2):  # Two passes: horizontal then vertical
        # Pad
        padded = np.pad(arr, ((0, 0), (radius, radius)), mode='edge')
        if arr.ndim == 2:
            cumsum = padded.cumsum(axis=1)
            result = (cumsum[:, 2 * radius:] - cumsum[:, :-2 * radius]) / (2 * radius + 1)
        else:
            cumsum = padded.cumsum(axis=1)
            result = (cumsum[:, 2 * radius:, :] - cumsum[:, :-2 * radius, :]) / (2 * radius + 1)
        arr = result.transpose(1, 0, 2) if arr.ndim == 3 else result.transpose(1, 0)
        result = np.zeros_like(arr)
    return arr


def fix_black_bg(img_path, output_path):
    """Replace black background with white using soft alpha blending."""
    img = Image.open(img_path).convert('RGB')
    arr = np.array(img, dtype=np.float32)
    h, w = arr.shape[:2]

    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]

    # Detect dark pixels: all channels below threshold
    max_channel = np.maximum(np.maximum(r, g), b)
    is_dark = max_channel < 50  # pixels where all RGB channels < 50

    # Expand mask by a few pixels to catch dark edges
    radius = min(max(2, min(w, h) // 60), 6)  # adaptive radius
    mask = is_dark.astype(np.float32)

    # Use PIL's GaussianBlur on the mask (fast C implementation)
    mask_img = Image.fromarray((mask * 255).astype(np.uint8))
    mask_img = mask_img.filter(ImageFilter.GaussianBlur(radius=radius))
    mask = np.array(mask_img, dtype=np.float32) / 255.0

    # Blend: mask=1 -> white, mask=0 -> keep original
    blend = mask[:, :, np.newaxis]
    white_bg = np.ones((h, w, 3), dtype=np.float32) * 255.0
    result_rgb = arr[:, :, :3] * (1.0 - blend) + white_bg * blend
    result_rgb = np.clip(result_rgb, 0, 255).astype(np.uint8)

    result = Image.fromarray(result_rgb, 'RGB')
    result.save(output_path, quality=92)

    change_pct = (mask > 0.3).mean() * 100
    return change_pct, radius


print("Fixing black background images...\n")

fixed = 0
for fname in BLACK_BG_FILES:
    fpath = os.path.join(PUBLIC_IMAGES, fname)
    if not os.path.exists(fpath):
        print(f"  [SKIP] {fname} - not found")
        continue

    # Backup if not already backed up
    bak_path = fpath + '.bak'
    if not os.path.exists(bak_path):
        shutil.copy2(fpath, bak_path)

    try:
        change_pct, radius = fix_black_bg(fpath, fpath)
        fixed += 1
        print(f"  [OK] {fname} - {change_pct:.1f}% changed (blur radius={radius})")
    except Exception as e:
        print(f"  [FAIL] {fname}: {e}")
        # Restore from backup
        if os.path.exists(bak_path):
            shutil.copy2(bak_path, fpath)

print(f"\nFixed {fixed}/{len(BLACK_BG_FILES)} images")
