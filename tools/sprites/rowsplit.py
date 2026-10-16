"""패널 한 줄(띠)에서 열 간격으로 프레임을 나눈다. 인자: 그림 출력png tol gap 띠들(x0,y0,x1,y1;...)"""
import sys, numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
src, out, tol, gap = sys.argv[1], sys.argv[2], float(sys.argv[3]), int(sys.argv[4])
bands = [tuple(map(int, b.split(','))) for b in sys.argv[5].split(';')]
im = Image.open(src).convert('RGB'); A = np.asarray(im).astype(float)
prev = im.copy(); dr = ImageDraw.Draw(prev)
for bi, (x0, y0, x1, y1) in enumerate(bands):
    a = A[y0:y1, x0:x1]
    # 띠의 배경: 가장자리 픽셀 중앙값을 열마다 (가로 그라데이션 대응)
    edge = np.concatenate([a[:3], a[-3:]], 0)
    bgc = np.median(edge, axis=0)  # (w,3)
    bgc = ndimage.median_filter(bgc, size=(31, 1))
    d = np.abs(a - bgc[None]).sum(2)
    m = ndimage.binary_opening(d > tol, iterations=1)
    col = m.sum(0) > 0
    segs = []; s = None; last = -99
    for x, c in enumerate(col):
        if c:
            if s is None: s = x
            elif x - last > gap: segs.append((s, last + 1)); s = x
            last = x
    if s is not None: segs.append((s, last + 1))
    res = []
    for sx0, sx1 in segs:
        if sx1 - sx0 < 6: continue
        rows = np.where(m[:, sx0:sx1].any(1))[0]
        b = (x0 + sx0, y0 + rows.min(), x0 + sx1, y0 + rows.max() + 1)
        res.append(b); dr.rectangle(b, outline=(255, 60, 60))
    print(f'band{bi}:', ' '.join(str(b) for b in res))
prev.save(out)
