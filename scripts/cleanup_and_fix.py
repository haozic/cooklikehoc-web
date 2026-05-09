"""
Phase 1: Clean up redundant files
Phase 2: Fix black background images
Phase 3: Extract missing images from PDF for 24 no-image recipes
"""
import json
import os
import re
import shutil
import subprocess
import sys
from PIL import Image, ImageFilter
import numpy as np

BASE_DIR = r'e:\cursor\cooklikehoc-web'
PUBLIC_IMAGES = os.path.join(BASE_DIR, 'public', 'images')
MD_IMAGES = os.path.join(BASE_DIR, 'recipes_md', 'images')
PDF_PATH = os.path.join(BASE_DIR, '老乡鸡菜品溯源报告 2.0.pdf')
METADATA_PATH = os.path.join(BASE_DIR, 'recipes_md', '_recipes_metadata.json')

# ============================================================
# PHASE 1: Cleanup redundant files
# ============================================================
print("=" * 60)
print("PHASE 1: Cleaning up redundant files")
print("=" * 60)

# 1a. Delete recipes_md/images/ (all duplicated in public/)
if os.path.exists(MD_IMAGES):
    count = len(os.listdir(MD_IMAGES))
    shutil.rmtree(MD_IMAGES)
    print(f"[OK] Deleted recipes_md/images/ ({count} files)")

# 1b. Delete page_xxx_img1.jpeg from public/
pub_imgs = os.listdir(PUBLIC_IMAGES)
deleted_page = 0
for fname in pub_imgs:
    if re.match(r'page\d+_img\d*\.jpeg', fname):
        os.remove(os.path.join(PUBLIC_IMAGES, fname))
        deleted_page += 1
print(f"[OK] Deleted {deleted_page} page_xxx_img*.jpeg files")

# 1c. Delete old numbered ingredient images
deleted_num = 0
for fname in os.listdir(PUBLIC_IMAGES):
    if re.match(r'\d{3}_.+\.(jpeg|jpg|png)', fname):
        os.remove(os.path.join(PUBLIC_IMAGES, fname))
        deleted_num += 1
print(f"[OK] Deleted {deleted_num} old numbered ingredient images")

# 1d. Report what's left
remaining = os.listdir(PUBLIC_IMAGES)
print(f"\nRemaining in public/images/: {len(remaining)} files")
recipe_imgs = [f for f in remaining if f.endswith(('.jpeg','.jpg','.png','.webp'))]
print(f"  Recipe images: {len(recipe_imgs)}")

# ============================================================
# PHASE 2: Fix black background images
# ============================================================
print("\n" + "=" * 60)
print("PHASE 2: Fixing black background images")
print("=" * 60)

BLACK_BG_FILES = [
    '166_炸肉肠.jpeg',
    '166_烤肠（猪肉）.jpeg',
    '170_Q弹虾滑馄饨.jpeg',
    '170_蛋皮.jpeg',
    '炸肉肠.jpeg',
]

def fix_black_background(img_path):
    """Replace dark/black background with white"""
    try:
        img = Image.open(img_path)
        
        if img.mode == 'RGBA':
            # If has alpha, just remove alpha channel against white bg
            background = Image.new('RGBA', img.size, (255, 255, 255, 255))
            img = Image.alpha_composite(background, img)
            img = img.convert('RGB')
        elif img.mode == 'P':
            img = img.convert('RGBA')
            background = Image.new('RGBA', img.size, (255, 255, 255, 255))
            img = Image.alpha_composite(background, img)
            img = img.convert('RGB')
        elif img.mode != 'RGB':
            img = img.convert('RGB')
        
        arr = np.array(img)
        
        # Create mask for dark pixels (R<40, G<40, B<40)
        dark_mask = (arr[:,:,0] < 40) & (arr[:,:,1] < 40) & (arr[:,:,2] < 40)
        
        # Only modify if significant dark area
        dark_ratio = dark_mask.mean()
        if dark_ratio > 0.3:
            # Replace dark pixels with white
            arr[dark_mask] = [255, 255, 255]
            fixed = Image.fromarray(arr)
            fixed.save(img_path, quality=95)
            return True, dark_ratio
        return False, dark_ratio
    except Exception as e:
        return False, str(e)

fixed_count = 0
for fname in BLACK_BG_FILES:
    fpath = os.path.join(PUBLIC_IMAGES, fname)
    if os.path.exists(fpath):
        success, info = fix_black_background(fpath)
        if success:
            print(f"  [FIXED] {fname} (dark ratio: {info:.1%})")
            fixed_count += 1
        else:
            print(f"  [SKIP] {fname} (dark ratio: {info})")
    else:
        print(f"  [MISS] {fname} - file not found")
print(f"\nFixed {fixed_count} black background images")

# ============================================================
# PHASE 3: Extract missing images from PDF
# ============================================================
print("\n" + "=" * 60)
print("PHASE 3: Extracting missing recipe images from PDF")
print("=" * 60)

# Collect page numbers for no-image recipes from MD files
md_dir = os.path.join(BASE_DIR, 'recipes_md')
recipe_pages = {}
for fname in os.listdir(md_dir):
    if fname.endswith('.md'):
        fpath = os.path.join(md_dir, fname)
        with open(fpath, 'r', encoding='utf-8') as f:
            content = f.read()
        page_match = re.search(r'PDF\s*页码\s*\|\s*第\s*(\d+)\s*页', content)
        if page_match:
            page = int(page_match.group(1))
            name = fname.replace('.md', '')
            recipe_pages[name] = page

# Load metadata to find no-image recipes
with open(METADATA_PATH, 'r', encoding='utf-8') as f:
    metadata = json.load(f)

no_img = [r for r in metadata if not r.get('image')]
print(f"Recipes needing images: {len(no_img)}")

# Build page -> recipe name mapping
page_to_recipe = {}
for r in no_img:
    title = r['title']
    for md_name, page in recipe_pages.items():
        # Try exact match or partial match
        if title in md_name or md_name.endswith(title):
            page_to_recipe[page] = title
            break

print(f"Found page numbers for: {len(page_to_recipe)} recipes")

# Use PyMuPDF to extract images from those pages
try:
    import fitz  # PyMuPDF
except ImportError:
    subprocess.check_call([sys.executable, '-m', 'pip', 'install', 'PyMuPDF'], 
                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    import fitz

doc = fitz.open(PDF_PATH)
total_pages = doc.page_count

extracted = 0
for page_num, title in page_to_recipe.items():
    if page_num < 1 or page_num > total_pages:
        continue
    
    page = doc[page_num - 1]  # 0-indexed
    
    # Get images on the page
    image_list = page.get_images(full=True)
    
    if not image_list:
        print(f"  [NO IMG] {title} (page {page_num}) - no images on page")
        continue
    
    # Find the largest image (likely the main recipe photo)
    best_img = None
    best_size = 0
    
    for img_idx, img_info in enumerate(image_list):
        xref = img_info[0]
        base_image = doc.extract_image(xref)
        img_bytes = base_image["image"]
        w = base_image.get("width", 0)
        h = base_image.get("height", 0)
        size = w * h
        
        if size > best_size and size > 50000:  # Minimum 50k pixels
            best_size = size
            best_img = img_bytes
    
    if best_img:
        # Save as JPEG
        safe_name = title
        fname = f"{page_num}_{safe_name}.jpeg"
        fpath = os.path.join(PUBLIC_IMAGES, fname)
        
        with open(fpath, 'wb') as f:
            f.write(best_img)
        
        # Verify it's a valid image
        try:
            img = Image.open(fpath)
            img.verify()
            print(f"  [OK] {title} -> {fname} ({img.width}x{img.height})")
            extracted += 1
        except:
            os.remove(fpath)
            print(f"  [FAIL] {title} - invalid image")
    else:
        print(f"  [NO IMG] {title} (page {page_num}) - no suitable image found")

doc.close()
print(f"\nExtracted {extracted} images out of {len(no_img)} needed")

# ============================================================
# PHASE 4: Update metadata and recipes.js with new images
# ============================================================
print("\n" + "=" * 60)
print("PHASE 4: Updating metadata")
print("=" * 60)

# Map which new images exist
new_images = {}
for fname in os.listdir(PUBLIC_IMAGES):
    m = re.match(r'(\d+)_(.+)\.(jpeg|jpg|png)', fname)
    if m:
        page = int(m.group(1))
        name = m.group(2)
        new_images[page] = (name, fname)

# Update metadata
updated = 0
for r in metadata:
    if not r.get('image'):
        title = r['title']
        page = None
        for md_name, p in recipe_pages.items():
            if title in md_name or md_name.endswith(title):
                page = p
                break
        
        if page and page in new_images:
            matched_name, fname = new_images[page]
            r['image'] = f"/images/{fname}"
            updated += 1

with open(METADATA_PATH, 'w', encoding='utf-8') as f:
    json.dump(metadata, f, ensure_ascii=False, indent=2)

print(f"Updated {updated} metadata entries with new images")

# Also update MD files
for md_fname in os.listdir(md_dir):
    if not md_fname.endswith('.md'):
        continue
    md_path = os.path.join(md_dir, md_fname)
    with open(md_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Check if this MD has no image
    if '![' not in content:
        page_match = re.search(r'PDF\s*页码\s*\|\s*第\s*(\d+)\s*页', content)
        if page_match:
            page = int(page_match.group(1))
            if page in new_images:
                matched_name, fname = new_images[page]
                title_match = re.search(r'^#\s+(.+)$', content, re.MULTILINE)
                if title_match:
                    img_line = f"\n![{title_match.group(1)}](./images/{fname})\n"
                    # Insert after the table (after 第X页 line)
                    lines = content.split('\n')
                    new_lines = []
                    inserted = False
                    for line in lines:
                        new_lines.append(line)
                        if f'第 {page} 页' in line and not inserted:
                            new_lines.append(img_line)
                            inserted = True
                    if inserted:
                        with open(md_path, 'w', encoding='utf-8') as f:
                            f.write('\n'.join(new_lines))

print("MD files updated with new images")

print("\n" + "=" * 60)
print("ALL DONE!")
print("=" * 60)
print(f"\nRemaining in public/images/: {len(os.listdir(PUBLIC_IMAGES))} files")
print("Next step: run generate_recipes_js.py to update website data")
