import cv2
from cv2 import dnn_superres
import os
import sys
import urllib.request
import numpy as np

input_dir = sys.argv[1] if len(sys.argv) > 1 else 'public/images'
model_name = 'EDSR'
model_scale = 4
model_url = f'https://github.com/Saafke/EDSR_Tensorflow/raw/master/models/EDSR_x{model_scale}.pb'
model_path = f'EDSR_x{model_scale}.pb'

if not os.path.exists(model_path):
    print(f'Downloading {model_name} x{model_scale} model...')
    urllib.request.urlretrieve(model_url, model_path)
    print('Done')

sr = dnn_superres.DnnSuperResImpl_create()
sr.readModel(model_path)
sr.setModel(model_name.lower(), model_scale)

files = [f for f in os.listdir(input_dir) if f.lower().endswith(('.jpg', '.jpeg', '.png'))]
print(f'Found {len(files)} images')

for f in files:
    path = os.path.join(input_dir, f)
    with open(path, 'rb') as fh:
        data = np.frombuffer(fh.read(), np.uint8)
    img = cv2.imdecode(data, cv2.IMREAD_COLOR)
    w, h = img.shape[1], img.shape[0]
    if w >= 1200:
        print(f'  SKIP {f}: already {w}x{h}')
        continue
    print(f'  {f}: {w}x{h} -> {w*model_scale}x{h*model_scale}')
    result = sr.upsample(img)
    ext = os.path.splitext(f)[1].lower()
    if ext == '.png':
        _, buf = cv2.imencode('.png', result, [cv2.IMWRITE_PNG_COMPRESSION, 3])
    else:
        _, buf = cv2.imencode('.jpg', result, [cv2.IMWRITE_JPEG_QUALITY, 92])
    with open(path, 'wb') as fh:
        fh.write(buf)

print('Done')
