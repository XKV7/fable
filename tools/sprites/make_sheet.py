"""컨셉아트 시트 → 카일루스 게임용 스프라이트 (배경 제거·축소·색 정리·외곽선) → PNG 시트 + 메타 JSON"""
import sys, json, numpy as np
from PIL import Image, ImageFilter, ImageEnhance
from collections import deque

SRC, OUT_PNG, OUT_JSON, PREVIEW = sys.argv[1:5]
SCALE = 0.6
BG = np.array([6, 8, 23])
im = Image.open(SRC).convert('RGB')

# (이름, 상자, 좌우반전)
F = []
def add(name, boxes, flip=()):
    for i, b in enumerate(boxes): F.append((f'{name}{i}', b, i in flip))
add('idle', [(33, 552, 101, 634), (112, 552, 181, 634), (193, 552, 262, 634), (272, 552, 342, 634), (353, 552, 422, 634)])
add('walk', [(455, 553, 504, 634), (525, 553, 574, 634), (595, 553, 645, 634), (667, 553, 716, 634), (737, 553, 788, 634)])
add('run', [(835, 556, 899, 634), (913, 556, 976, 634), (990, 556, 1055, 634), (1070, 556, 1134, 634)])
add('attack', [(34, 716, 131, 801), (134, 703, 219, 801), (225, 716, 302, 801), (300, 703, 394, 801), (405, 716, 482, 801), (482, 716, 576, 801)], flip=(5,))
add('cast', [(619, 706, 690, 801), (703, 712, 774, 801)])
add('hit', [(39, 872, 124, 950), (142, 870, 226, 949), (244, 872, 331, 950), (351, 872, 438, 949), (456, 873, 547, 949)])
add('die', [(613, 888, 688, 951), (697, 895, 787, 955), (801, 895, 890, 955), (905, 892, 1029, 957)])
# 스킬 이펙트 (마법진·결정·대형 마법진) — 캐릭터가 아닌 효과 그림
# add('fx', [(781, 712, 849, 803), (866, 696, 1039, 802), (1054, 696, 1177, 806)])

def cut(box, flip):
    a = np.asarray(im.crop(box)).astype(int)
    h, w, _ = a.shape
    d = np.abs(a - BG).sum(axis=2)
    near = d <= 7
    # 테두리에서 이어진 배경만 지운다 (코트의 어두운 안쪽은 남김)
    bg = np.zeros((h, w), bool)
    q = deque([(y, x) for y in range(h) for x in (0, w - 1)] + [(y, x) for x in range(w) for y in (0, h - 1)])
    while q:
        y, x = q.popleft()
        if y < 0 or x < 0 or y >= h or x >= w or bg[y, x] or not near[y, x]: continue
        bg[y, x] = True
        q.extend([(y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)])
    # 막힌 배경 주머니(몸과 나침반 사이 등): 배경색과 아주 가까운(차이 4 이하) 20픽셀 이상 덩어리
    from scipy import ndimage as _nd
    tight = (d <= 4) & ~bg
    pl, pn = _nd.label(tight)
    if pn:
        ps = _nd.sum(tight, pl, range(1, pn + 1))
        okp = np.zeros(pn + 1, bool); okp[1:] = ps >= 20
        bg |= okp[pl]
    rgba = np.dstack([a, np.where(bg, 0, 255)]).astype(np.uint8)
    img = Image.fromarray(rgba, 'RGBA')
    if flip: img = img.transpose(Image.FLIP_LEFT_RIGHT)
    return img

def shrink(img):
    w, h = img.size
    nw, nh = max(1, round(w * SCALE)), max(1, round(h * SCALE))
    # 미리 살짝 선명하게 → 미리곱한 알파로 면적 평균 축소
    rgb = img.convert('RGB').filter(ImageFilter.UnsharpMask(radius=1.2, percent=120, threshold=2))
    rgb = ImageEnhance.Color(ImageEnhance.Contrast(rgb).enhance(1.12)).enhance(1.15)
    a = np.asarray(img)[:, :, 3:4].astype(float) / 255
    pm = (np.asarray(rgb).astype(float) * a)
    pm_img = Image.fromarray(np.dstack([pm, a * 255]).clip(0, 255).astype(np.uint8), 'RGBA')
    sm = np.asarray(pm_img.resize((nw, nh), Image.BOX)).astype(float)
    al = sm[:, :, 3] / 255
    col = np.where(al[..., None] > 0, sm[:, :, :3] / np.maximum(al[..., None], 1e-6), 0)
    keep = al >= 0.45
    return col.clip(0, 255), keep

def main_body(keep, frac=0.12):
    # 1픽셀 깎아 몸에 가는 번짐으로 붙은 나침반·반짝이를 떼고, 큰 덩어리만 남긴 뒤 가장자리를 되돌린다
    from scipy import ndimage as _nd
    er = _nd.binary_erosion(keep, structure=np.ones((3, 3)), iterations=2)
    if er.any():
        keep = _nd.binary_dilation(_main_body(er, frac), structure=np.ones((3, 3)), iterations=2) & keep
    return _main_body(keep, min(frac, 0.02) if frac < 1 else 1.0)

def _main_body(keep, frac=0.12):
    # 몸에서 떨어진 작은 반짝이(별 장식)는 지운다: 가장 큰 덩어리의 12% 미만 조각 제거
    h, w = keep.shape
    lab = np.zeros((h, w), int); sizes = [0]
    for y in range(h):
        for x in range(w):
            if keep[y, x] and not lab[y, x]:
                n = len(sizes); q = [(y, x)]; lab[y, x] = n; c = 0
                while q:
                    cy, cx = q.pop(); c += 1
                    for dy in (-1, 0, 1):
                        for dx in (-1, 0, 1):
                            yy, xx = cy + dy, cx + dx
                            if 0 <= yy < h and 0 <= xx < w and keep[yy, xx] and not lab[yy, xx]:
                                lab[yy, xx] = n; q.append((yy, xx))
                sizes.append(c)
    big = max(sizes)
    ok = np.array([s >= big * frac - 1e-9 for s in sizes]); ok[0] = False
    return ok[lab]

def _unused():
    return col.clip(0, 255), keep

sys.path.insert(0, __import__("os").path.dirname(__file__)); import gen
raw = {n: cut(b, fl) for n, b, fl in F}
# 원본 해상도에서 떠 있는 나침반·반짝이 떼기 (공격·시전 칸은 큰 검기는 남김)
for n in raw:
    if n.startswith('fx'): continue
    if n.startswith('die'): raw[n] = gen.detach(raw[n], 3, 0.25)
    else: raw[n] = gen.detach(raw[n], 5, 0.3 if n.rstrip('0123456789') in ('attack', 'cast') else 1.0)
for n, img in gen.make_all(raw).items(): raw[n] = img
parts = []
for n, img in raw.items():
    c, k = shrink(img)
    # 몸에서 떨어진 조각(나침반·반짝이)은 지운다: 공격·시전 칸은 큰 검기만 남기고(30%), 나머지는 몸통만
    if not n.startswith('fx'): k = main_body(k, 0.3 if n.split('_')[0].rstrip('0123456789') in ('attack', 'cast') else 0.25 if n.startswith('die') else 1.0)
    parts.append((n, c, k))

# 공용 팔레트: 모든 프레임의 불투명 픽셀로 28색
allpx = np.concatenate([c[k] for _, c, k in parts]).astype(np.uint8)
pal_img = Image.fromarray(allpx.reshape(-1, 1, 3), 'RGB').quantize(colors=40, method=Image.Quantize.MEDIANCUT)
pal = np.array(pal_img.getpalette()[:40 * 3]).reshape(-1, 3)

def snap(c):
    d = ((c[..., None, :] - pal[None, None, :, :]) ** 2).sum(-1)
    return pal[d.argmin(-1)]

OUTLINE = np.array([10, 8, 16])
frames, tiles = {}, []
for name, col, keep in parts:
    h, w = keep.shape
    out = np.zeros((h + 2, w + 2, 4), np.uint8)
    sn = snap(col)
    out[1:-1, 1:-1, :3] = np.where(keep[..., None], sn, 0)
    out[1:-1, 1:-1, 3] = np.where(keep, 255, 0)
    k2 = np.zeros((h + 2, w + 2), bool); k2[1:-1, 1:-1] = keep
    ring = (~k2) & (np.roll(k2, 1, 0) | np.roll(k2, -1, 0) | np.roll(k2, 1, 1) | np.roll(k2, -1, 1))
    out[ring, :3] = OUTLINE; out[ring, 3] = 255
    solid = out[:, :, 3] > 0
    ys, xs = np.where(solid)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    out = out[y0:y1, x0:x1]; solid = solid[y0:y1, x0:x1]
    H, W = solid.shape
    # 기준점: 머리(위 30%) 가운데 x, 그 아래 발(가장 낮은 불투명 픽셀) y
    top = solid[: max(3, int(H * 0.3))]
    cx = int(round(np.where(top)[1].mean())) if top.any() else W // 2
    band = solid[:, max(0, cx - 9): cx + 10]
    fy = int(np.where(band.any(axis=1))[0].max()) + 1
    frames[name] = {'w': W, 'h': H, 'ax': cx, 'ay': fy}
    tiles.append((name, Image.fromarray(out, 'RGBA')))

# 시트에 가로로 배치
sheet_w = sum(t.width for _, t in tiles) + len(tiles)
sheet_h = max(t.height for _, t in tiles)
sheet = Image.new('RGBA', (sheet_w, sheet_h), (0, 0, 0, 0))
x = 0
for name, t in tiles:
    sheet.paste(t, (x, 0)); frames[name].update({'x': x, 'y': 0}); x += t.width + 1
sheet.save(OUT_PNG, optimize=True)
json.dump(frames, open(OUT_JSON, 'w'))
prev = Image.new('RGBA', (sheet_w, sheet_h), (58, 52, 80, 255)); prev.alpha_composite(sheet)
prev.resize((sheet_w * 3, sheet_h * 3), Image.NEAREST).save(PREVIEW)
print(len(frames), 'frames', sheet.size, 'palette', len(pal))
print({k: (v['w'], v['h']) for k, v in list(frames.items())[:6]})
