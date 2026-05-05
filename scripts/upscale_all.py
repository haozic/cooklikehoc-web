from PIL import Image, ImageFilter
import os
import sys

input_dir = sys.argv[1] if len(sys.argv) > 1 else 'public/images'
target_w = 1200

files = [f for f in os.listdir(input_dir) if f.lower().endswith(('.jpg', '.jpeg', '.png'))]
print(f'Found {len(files)} images')

for f in files:
    path = os.path.join(input_dir, f)
    img = Image.open(path)
    w, h = img.size
    if w >= target_w:
        print(f'  SKIP {f}: already {w}x{h}')
        continue
    ratio = target_w / w
    new_h = int(h * ratio)
    print(f'  {f}: {w}x{h} -> {target_w}x{new_h}')
    img_hd = img.resize((target_w, new_h), Image.LANCZOS)
    img_hd = img_hd.filter(ImageFilter.UnsharpMask(radius=1.2, percent=80, threshold=2))
    ext = os.path.splitext(f)[1].lower()
    fmt = 'PNG' if ext == '.png' else 'JPEG'
    save_kw = {'quality': 92, 'optimize': True} if fmt == 'JPEG' else {'optimize': True}
    img_hd.save(path, fmt, **save_kw)

print('Done')
