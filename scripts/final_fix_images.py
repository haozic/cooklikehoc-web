"""
Final image fixes:
1. Fix black backgrounds -> white backgrounds
2. Upscale small images 3x using Lanczos
"""
import os
import json
import numpy as np
from PIL import Image, ImageFilter

BASE_DIR = r'e:\cursor\cooklikehoc-web'
PUBLIC_IMAGES = os.path.join(BASE_DIR, 'public', 'images')

# ============================================================
# 1. Fix black backgrounds
# ============================================================
print("=" * 60)
print("1. Fixing black/dark backgrounds")
print("=" * 60)

def has_dark_background(img_path, threshold=0.35):
    """Check if image has significant dark/black background"""
    try:
        img = Image.open(img_path)
        if img.mode == 'RGBA':
            img = img.convert('RGB')
        elif img.mode != 'RGB':
            img = img.convert('RGB')
        arr = np.array(img)
        dark_mask = (arr[:,:,0] < 35) & (arr[:,:,1] < 35) & (arr[:,:,2] < 35)
        return dark_mask.mean() > threshold, dark_mask, img
    except:
        return False, None, None

def fix_dark_background(img_path):
    """Replace near-black pixels with white, with smooth edges"""
    has_dark, dark_mask, img = has_dark_background(img_path, 0.35)
    if not has_dark:
        return False
    
    arr = np.array(img.convert('RGB'))
    
    # Create a soft mask: pixels that are very dark
    darkness = arr.astype(float).min(axis=2)  # minimum across RGB
    # Normalize: 0 (pitch black) to 1 (bright)
    dark_score = 1.0 - np.clip(darkness / 70.0, 0.0, 1.0)
    
    # Blend: where dark_score is high, blend towards white
    blend = np.clip(dark_score * 0.85, 0.0, 1.0)  # max 85% white blend
    for c in range(3):
        arr[:,:,c] = (arr[:,:,c] * (1.0 - blend) + 255.0 * blend).astype(np.uint8)
    
    # Replace completely black pixels fully
    full_black = (arr[:,:,0] < 15) & (arr[:,:,1] < 15) & (arr[:,:,2] < 15)
    arr[full_black] = [255, 255, 255]
    
    fixed = Image.fromarray(arr)
    fixed.save(img_path, 'JPEG', quality=92)
    return True

fixed_bg = 0
for fname in os.listdir(PUBLIC_IMAGES):
    if not fname.endswith(('.jpeg', '.jpg', '.png')):
        continue
    fpath = os.path.join(PUBLIC_IMAGES, fname)
    if fix_dark_background(fpath):
        print(f"  [FIXED BG] {fname}")
        fixed_bg += 1

print(f"Fixed {fixed_bg} black-background images")

# ============================================================
# 2. Upscale small images (< 50k pixels) 3x
# ============================================================
print("\n" + "=" * 60)
print("2. Upscaling small images")
print("=" * 60)

upscaled = 0
for fname in os.listdir(PUBLIC_IMAGES):
    if not fname.endswith(('.jpeg', '.jpg', '.png')):
        continue
    fpath = os.path.join(PUBLIC_IMAGES, fname)
    
    img = Image.open(fpath)
    w, h = img.size
    pixels = w * h
    
    if pixels < 60000:  # Upscale if less than 60k pixels
        # Target: at least 300px on the larger side
        scale = max(300.0 / max(w, h), 1.5)
        scale = min(scale, 4.0)  # Cap at 4x
        
        new_w = int(w * scale)
        new_h = int(h * scale)
        
        if img.mode == 'RGBA':
            img = img.convert('RGB')
        elif img.mode != 'RGB':
            img = img.convert('RGB')
        
        upscaled_img = img.resize((new_w, new_h), Image.LANCZOS)
        upscaled_img.save(fpath, 'JPEG', quality=90)
        
        print(f"  [UPSCALE] {fname}: {w}x{h} -> {new_w}x{new_h} ({scale:.1f}x)")
        upscaled += 1

print(f"Upscaled {upscaled} images")

# ============================================================
# 3. Summary
# ============================================================
print("\n" + "=" * 60)
print("3. Final summary")
print("=" * 60)

remaining = [f for f in os.listdir(PUBLIC_IMAGES) if f.endswith(('.jpeg','.jpg','.png'))]
print(f"Total recipe images in public/images: {len(remaining)}")

sizes = []
for fname in remaining:
    fpath = os.path.join(PUBLIC_IMAGES, fname)
    try:
        img = Image.open(fpath)
        sizes.append((fname, img.size[0], img.size[1]))
    except:
        pass

# Show smallest
sizes.sort(key=lambda x: x[1] * x[2])
print(f"Smallest: {sizes[0][0]} ({sizes[0][1]}x{sizes[0][2]})")
print(f"Largest: {sizes[-1][0]} ({sizes[-1][1]}x{sizes[-1][2]})")

print("\nDone! Ready to regenerate recipes.js")
