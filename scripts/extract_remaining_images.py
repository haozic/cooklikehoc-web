"""Extract remaining 36 missing recipe images from PDF"""
import fitz
import os
import re
import json
from PIL import Image

BASE_DIR = r'e:\cursor\cooklikehoc-web'
PUBLIC_IMAGES = os.path.join(BASE_DIR, 'public', 'images')
METADATA_PATH = os.path.join(BASE_DIR, 'recipes_md', '_recipes_metadata.json')
PDF_PATH = os.path.join(BASE_DIR, '老乡鸡菜品溯源报告 2.0.pdf')

# Load metadata to find no-image recipes
with open(METADATA_PATH, 'r', encoding='utf-8') as f:
    metadata = json.load(f)

pub_imgs_set = set(os.listdir(PUBLIC_IMAGES))
no_img = []
for r in metadata:
    img = r.get('image', '')
    if not img:
        no_img.append(r)
    else:
        fname = os.path.basename(img)
        if fname not in pub_imgs_set:
            no_img.append(r)
print(f"Recipes without valid images: {len(no_img)}")

# Extract page numbers from MD files
recipe_pages = {}
for fname in os.listdir(os.path.join(BASE_DIR, 'recipes_md')):
    if not fname.endswith('.md'):
        continue
    fpath = os.path.join(BASE_DIR, 'recipes_md', fname)
    with open(fpath, 'r', encoding='utf-8') as fp:
        content = fp.read()
    m = re.search(r'PDF\s*\S*\s*\|\s*第\s*(\d+)\s*页', content)
    if m:
        page = int(m.group(1))
        name = fname.replace('.md', '')
        recipe_pages[name] = page

print(f"Found page numbers for {len(recipe_pages)} recipes in MD files")

# Open PDF
doc = fitz.open(PDF_PATH)
total_pages = doc.page_count

# Build title -> page mapping for no-image recipes
no_img_pages = {}
for r in no_img:
    title = r['title']
    found_page = None
    for md_name, page in recipe_pages.items():
        if title in md_name or md_name.endswith(title):
            found_page = page
            break
    if found_page:
        no_img_pages[title] = found_page
    else:
        # Try direct match in title list
        clean_title = title.replace(' ', '').replace('（', '(').replace('）', ')')
        for md_name, page in recipe_pages.items():
            clean_name = md_name.replace(' ', '').replace('（', '(').replace('）', ')')
            if clean_title in clean_name or clean_name.endswith(clean_title.replace(' ','_')):
                found_page = page
                break
        if found_page:
            no_img_pages[title] = found_page

print(f"Mapped {len(no_img_pages)} of {len(no_img)} to PDF pages")

# Extract images
extracted = 0
for title, page_num in no_img_pages.items():
    if page_num < 1 or page_num > total_pages:
        print(f"  [SKIP] {title} - invalid page {page_num}")
        continue
    
    page = doc[page_num - 1]
    img_list = page.get_images(full=True)
    
    if not img_list:
        print(f"  [NONE] {title} (page {page_num})")
        continue
    
    # Find largest image on page
    best_xref = None
    best_size = 0
    best_ext = 'jpeg'
    
    for img_info in img_list:
        xref = img_info[0]
        base = doc.extract_image(xref)
        w = base.get('width', 0)
        h = base.get('height', 0)
        if w * h > best_size:
            best_size = w * h
            best_xref = xref
            best_ext = base.get('ext', 'jpeg')
    
    if best_xref:
        base = doc.extract_image(best_xref)
        img_bytes = base['image']
        w = base.get('width', 0)
        h = base.get('height', 0)
        
        # Save with simple name (no prefix)
        safe_name = title
        ext = best_ext if best_ext in ('jpeg', 'jpg', 'png') else 'jpeg'
        fname = f"{safe_name}.{ext}"
        fpath = os.path.join(PUBLIC_IMAGES, fname)
        
        with open(fpath, 'wb') as fx:
            fx.write(img_bytes)
        
        # Verify and upscale if needed
        try:
            img = Image.open(fpath)
            if img.mode == 'RGBA':
                img = img.convert('RGB')
            elif img.mode != 'RGB':
                img = img.convert('RGB')
            
            # Upscale small images to at least 300px on larger side
            if max(img.size) < 300:
                scale = 300.0 / max(img.size)
                new_size = (int(img.size[0] * scale), int(img.size[1] * scale))
                img = img.resize(new_size, Image.LANCZOS)
                img.save(fpath, 'JPEG', quality=90)
                print(f"  [OK+UP] {title} -> {fname} ({img.size[0]}x{img.size[1]})")
            else:
                img.save(fpath, 'JPEG', quality=90)
                print(f"  [OK] {title} -> {fname} ({img.size[0]}x{img.size[1]})")
            
            # Update metadata
            for r in metadata:
                if r['title'] == title:
                    r['image'] = f'/images/{fname}'
                    break
            
            extracted += 1
        except Exception as e:
            os.remove(fpath)
            print(f"  [FAIL] {title} - {e}")
    else:
        print(f"  [NONE] {title} (page {page_num}) - no images found")

doc.close()

# Save updated metadata
with open(METADATA_PATH, 'w', encoding='utf-8') as f:
    json.dump(metadata, f, ensure_ascii=False, indent=2)

print(f"\nExtracted: {extracted}/{len(no_img)}")
print(f"Total images in public/: {len(os.listdir(PUBLIC_IMAGES))}")
