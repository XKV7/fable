"""카일루스 스킬 이펙트·장비 그림 추출 → RGBA 시트 + JSON
 - 빛 이펙트(add): 배경색을 빼서 '빛의 양'만 남긴다 → 게임에서 가산 혼합(lighter)으로 그려 번짐까지 그대로
 - 물체(sword): 테두리에서 이어진 배경만 지워 알파로 잘라낸다
"""
import sys, json, numpy as np
from PIL import Image
from scipy import ndimage
SRC, OUT_PNG, OUT_JSON, PREVIEW = sys.argv[1:5]
BG = np.array([6, 8, 23])
im = np.asarray(Image.open(SRC).convert('RGB')).astype(float)
ITEMS = [
    # 이름, 상자, 방식, 축척
    ('card', (777, 712, 853, 808), 'add', 1.0),     # 룬 마법진 (시전)
    ('spike', (861, 687, 913, 807), 'add', 1.0),    # 결정 기둥
    ('slash', (905, 710, 1042, 807), 'add', 1.0),   # 결정 베기 파편
    ('circle', (1050, 680, 1181, 811), 'add', 1.0), # 천구 나침반 대형 마법진
    ('sword', (1110, 187, 1324, 425), 'cut', 0.3),  # 별빛 장검 (패시브 낙하 검)
]

def biggest(mask, keep_frac=0.12):
    lab, n = ndimage.label(ndimage.binary_dilation(mask, iterations=2))
    if n == 0: return mask
    sizes = ndimage.sum(mask, lab, range(1, n + 1))
    ok = np.zeros(n + 1, bool); ok[1:] = sizes >= sizes.max() * keep_frac
    return mask & ok[lab]

tiles, meta = [], {}
for name, (x0, y0, x1, y1), mode, sc in ITEMS:
    a = im[y0:y1, x0:x1]
    d = np.abs(a - BG).sum(2)
    if mode == 'add':
        light = np.clip(a - BG, 0, 255)
        # 다른 그림 조각이 끼지 않게 가장 큰 덩어리 주변만
        m = biggest(d > 24, 0.35 if name == 'slash' else 0.12)
        m = ndimage.binary_dilation(m, iterations=6)
        light *= m[..., None]
        light = np.clip(light * 1.15, 0, 255)  # 살짝 밝게
        rgba = np.dstack([light, np.where(light.max(2) > 3, 255, 0)])
    else:
        near = d <= 7
        bg = np.zeros(d.shape, bool)
        h, w = d.shape
        seeds = np.zeros(d.shape, bool); seeds[0, :] = seeds[-1, :] = seeds[:, 0] = seeds[:, -1] = True
        lab, _ = ndimage.label(near)
        bg = np.isin(lab, np.unique(lab[seeds & near]))
        keep = biggest(~bg & (d > 7), 0.6)
        rgba = np.dstack([a, keep * 255.0])
    img = Image.fromarray(np.clip(rgba, 0, 255).astype(np.uint8), 'RGBA')
    if sc != 1.0:
        # 미리곱한 알파로 면적 평균 축소 후 알파 이진화
        arr = np.asarray(img).astype(float); al = arr[..., 3:4] / 255
        pm = Image.fromarray(np.dstack([arr[..., :3] * al, al * 255]).astype(np.uint8), 'RGBA')
        nw, nh = round(img.width * sc), round(img.height * sc)
        s2 = np.asarray(pm.resize((nw, nh), Image.BOX)).astype(float)
        a2 = s2[..., 3:4] / 255
        col = np.where(a2 > 0, s2[..., :3] / np.maximum(a2, 1e-6), 0)
        keep = a2[..., 0] >= 0.45
        out = np.zeros((nh + 2, nw + 2, 4), np.uint8)
        out[1:-1, 1:-1, :3] = np.clip(col, 0, 255); out[1:-1, 1:-1, 3] = keep * 255
        k2 = out[..., 3] > 0
        ring = (~k2) & (np.roll(k2, 1, 0) | np.roll(k2, -1, 0) | np.roll(k2, 1, 1) | np.roll(k2, -1, 1))
        out[ring] = [10, 8, 16, 255]
        img = Image.fromarray(out, 'RGBA')
    bb = img.getbbox(); img = img.crop(bb)
    tiles.append((name, img)); meta[name] = {'w': img.width, 'h': img.height, 'add': mode == 'add'}

W = sum(t.width for _, t in tiles) + len(tiles); H = max(t.height for _, t in tiles)
sheet = Image.new('RGBA', (W, H), (0, 0, 0, 0)); x = 0
for n, t in tiles:
    sheet.paste(t, (x, 0)); meta[n].update({'x': x, 'y': 0}); x += t.width + 1
sheet.save(OUT_PNG, optimize=True); json.dump(meta, open(OUT_JSON, 'w'))
prev = Image.new('RGBA', (W, H), (40, 34, 60, 255))
for n, t in tiles:
    m = meta[n]
    if m['add']:
        base = np.asarray(prev.crop((m['x'], 0, m['x'] + m['w'], m['h']))).astype(int)
        add = np.asarray(t).astype(int)
        base[..., :3] = np.clip(base[..., :3] + add[..., :3], 0, 255)
        prev.paste(Image.fromarray(base.astype(np.uint8), 'RGBA'), (m['x'], 0))
    else: prev.alpha_composite(t, (m['x'], 0))
prev.resize((W * 2, H * 2), Image.NEAREST).save(PREVIEW)
print(meta, sheet.size)
