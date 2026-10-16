"""그림에서 배경과 다른 덩어리(프레임 후보) 상자를 찾아 줄별로 출력 + 번호 붙인 미리보기"""
import sys, numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
src, out = sys.argv[1], sys.argv[2]
tol = float(sys.argv[3]) if len(sys.argv) > 3 else 30
dil = int(sys.argv[4]) if len(sys.argv) > 4 else 5
im = Image.open(src).convert('RGB'); a = np.asarray(im).astype(float)
# 국소 배경: 큰 창의 중앙값 근사 (어두운 남색 그라데이션·단색 모두)
small = np.asarray(im.resize((im.width // 16, im.height // 16), Image.BOX)).astype(float)
bgs = ndimage.median_filter(small, size=(5, 5, 1))
bg = np.asarray(Image.fromarray(bgs.astype(np.uint8)).resize(im.size, Image.BILINEAR)).astype(float)
d = np.abs(a - bg).sum(2)
m = ndimage.binary_dilation(d > tol, iterations=dil)
lab, n = ndimage.label(m)
boxes = []
for i, sl in enumerate(ndimage.find_objects(lab)):
    h = sl[0].stop - sl[0].start; w = sl[1].stop - sl[1].start
    if h < 25 or w < 12 or h > 400: continue
    boxes.append((sl[1].start + dil, sl[0].start + dil, sl[1].stop - dil, sl[0].stop - dil))
boxes.sort(key=lambda b: (b[1] + b[3]) / 2)
rows = []
for b in boxes:
    cy = (b[1] + b[3]) / 2
    if rows and abs(cy - rows[-1][0]) < 25: rows[-1][1].append(b)
    else: rows.append([cy, [b]])
prev = im.copy(); dr = ImageDraw.Draw(prev)
k = 0
for ri, (cy, bs) in enumerate(rows):
    bs.sort()
    print(f'row{ri} y~{cy:.0f}:', ' '.join(f'{k + j}={b}' for j, b in enumerate(bs)))
    for j, b in enumerate(bs):
        dr.rectangle(b, outline=(255, 60, 60)); dr.text((b[0], b[1] - 10), str(k + j), fill=(255, 255, 0))
    k += len(bs)
prev.save(out)
