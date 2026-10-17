"""컨셉아트 → 게임 스프라이트 (설정 파일 하나로). 사용: python3 -I hero.py 설정.json 출력.ts 미리보기.png
설정: { id, src, bg: 'flat'|'local', tol, height(목표 키, 기본 49), frames: {이름: [x0,y0,x1,y1, flip?]}, fx: {이름: [상자, 'add'|'cut', 크기]},
        poses: {게임포즈: 칸이름}, cycles: {idle|run|hurt|dead: {frames, tick}}, variants: true }
 - 캐릭터 칸: 배경 제거(테두리에서 이어진 배경만) → 떨어진 작은 반짝이 제거 → 선명화 → 면적 평균 축소 → 공용 40색 → 1픽셀 외곽선
 - 축소 배율은 대기 칸 몸통(가장 큰 덩어리) 키가 height가 되도록 자동
 - fx add: 배경색을 뺀 빛의 양(가산 혼합용), cut: 알파로 잘라낸 물체
"""
import sys, os, json, base64, io, numpy as np
from PIL import Image, ImageFilter, ImageEnhance
from scipy import ndimage
sys.path.insert(0, os.path.dirname(__file__))
import gen
cfg = json.load(open(sys.argv[1])); OUT_TS, PREV = sys.argv[2], sys.argv[3]
IM = np.asarray(Image.open(cfg['src']).convert('RGB')).astype(float)
TOL = cfg.get('tol', 8)

def bg_of(a):
    """그라데이션 배경 대응: 네 변의 색(잡음 줄이려 띠 중앙값)을 안쪽으로 보간한 픽셀별 배경 추정 (Coons 면)"""
    h, w, _ = a.shape
    k = 3
    top = ndimage.median_filter(np.median(a[:k], 0), size=(9, 1)); bot = ndimage.median_filter(np.median(a[-k:], 0), size=(9, 1))
    lef = ndimage.median_filter(np.median(a[:, :k], 1), size=(9, 1)); rig = ndimage.median_filter(np.median(a[:, -k:], 1), size=(9, 1))
    v = np.linspace(0, 1, h)[:, None, None]; u = np.linspace(0, 1, w)[None, :, None]
    tb = top[None] * (1 - v) + bot[None] * v
    lr = lef[:, None] * (1 - u) + rig[:, None] * u
    cor = (top[0] * (1 - u) * (1 - v) + top[-1] * u * (1 - v) + bot[0] * (1 - u) * v + bot[-1] * u * v)
    return tb + lr - cor

def cut(box, flip=False):
    x0, y0, x1, y1 = box
    a = IM[y0:y1, x0:x1]
    # bgColor: [r,g,b] — 단색 배경 시트는 고정 배경색 사용 (칸 테두리에 몸이 걸려 테두리 추정 배경이 틀어지는 것 방지)
    d = np.abs(a - (np.array(cfg['bgColor'], float) if 'bgColor' in cfg else bg_of(a))).sum(2)
    tl = TOL
    if 'tolLow' in cfg:  # tolLow: [아래쪽 비율, 허용차] — 칸 아래쪽(다리·신발)은 허용차를 낮춰 배경과 비슷한 검은 다리가 지워지지 않게
        fr_, t2 = cfg['tolLow']; tl = np.full((d.shape[0], 1), float(TOL)); tl[int(d.shape[0] * (1 - fr_)):] = t2
    near = d <= tl
    seeds = np.zeros(d.shape, bool); seeds[0] = seeds[-1] = True; seeds[:, 0] = seeds[:, -1] = True
    lab, _ = ndimage.label(near)
    bg = np.isin(lab, np.unique(lab[seeds & near])) & near
    # 몸과 떠 있는 구체 사이처럼 테두리에서 막힌 배경 주머니도 지운다 (배경색과 아주 가까운 20픽셀 이상 덩어리만)
    tight = (d <= cfg.get('pocket_tol', max(4, TOL * 0.6))) & ~bg
    pl, pn = ndimage.label(tight)
    if pn:
        ps = ndimage.sum(tight, pl, range(1, pn + 1))
        okp = np.zeros(pn + 1, bool); okp[1:] = ps >= 20
        bg |= okp[pl]
    rgba = np.dstack([a, np.where(bg, 0, 255)]).astype(np.uint8)
    img = Image.fromarray(rgba, 'RGBA')
    return img.transpose(Image.FLIP_LEFT_RIGHT) if flip else img

def largest(mask):
    lab, n = ndimage.label(mask, structure=np.ones((3, 3)))
    if n == 0: return mask, lab, np.zeros(1)
    sizes = ndimage.sum(mask, lab, range(1, n + 1))
    return lab == (sizes.argmax() + 1), lab, sizes

def clean(keep, frac=0.12):
    _, lab, sizes = largest(keep)
    if not sizes.size: return keep
    ok = np.zeros(len(sizes) + 1, bool); ok[1:] = sizes >= sizes.max() * frac
    return ok[lab]

def body_only(k, frac=1.0, it=None):
    """몸에 1~2픽셀 번짐으로 붙어 있는 떠 있는 구체·반짝이까지 떼어 낸다:
    1픽셀 깎아 가는 다리를 끊고 → 큰 덩어리만 남긴 뒤 → 깎은 가장자리만 원래대로 되돌림"""
    it = it or cfg.get('detach', 1)
    er = ndimage.binary_erosion(k, structure=np.ones((3, 3)), iterations=it)
    if not er.any(): return k
    kept = clean(er, frac) if frac < 1 else largest(er)[0]
    out = ndimage.binary_dilation(kept, structure=np.ones((3, 3)), iterations=it) & k
    return largest(out)[0] if frac >= 1 else clean(out, 0.02)

def shrink(img, sc, sharpen=110):
    w, h = img.size
    nw, nh = max(1, round(w * sc)), max(1, round(h * sc))
    rgb = img.convert('RGB').filter(ImageFilter.UnsharpMask(radius=1.2, percent=sharpen, threshold=2))
    rgb = ImageEnhance.Color(ImageEnhance.Contrast(rgb).enhance(1.1)).enhance(1.12)
    a = np.asarray(img)[:, :, 3:4].astype(float) / 255
    pm = Image.fromarray(np.dstack([np.asarray(rgb).astype(float) * a, a * 255]).clip(0, 255).astype(np.uint8), 'RGBA')
    sm = np.asarray(pm.resize((nw, nh), Image.BOX)).astype(float)
    al = sm[:, :, 3] / 255
    col = np.where(al[..., None] > 0, sm[:, :, :3] / np.maximum(al[..., None], 1e-6), 0)
    return col.clip(0, 255), al >= 0.45

_PROP = {}
def drop_prop(img, spec):
    import cv2
    key = json.dumps(spec, sort_keys=True)
    if key not in _PROP:
        if 'src' in spec:  # src: 원본 그림 좌표 상자 (칸 상자에 잘린 소품도 온전히 본뜰 때)
            x0, y0 = spec['src'][:2]; m = np.asarray(cut(spec['src']))[:, :, 3] > 0
            if 'core' in spec:  # core: 밝기 이상인 부분만 소품 모양으로 (어두운 번짐·옆 머리카락이 본에 섞이지 않게)
                bx0, by0, bx1, by1 = spec['src']
                m &= IM[by0:by1, bx0:bx1] @ np.array([0.3, 0.55, 0.15]) > spec['core']
        else:
            fb = cfg['frames'][spec['from']]; bx0, by0, bx1, by1 = spec['box']
            x0, y0 = fb[0] + bx0, fb[1] + by0
            m = np.asarray(cut(fb[:4]))[by0:by1, bx0:bx1, 3] > 0
        m = largest(m)[0]; ys, xs = np.where(m)
        m = m[ys.min():ys.max() + 1, xs.min():xs.max() + 1]; x0 += xs.min(); y0 += ys.min()
        _PROP[key] = (IM[y0:y0 + m.shape[0], x0:x0 + m.shape[1]].mean(2).astype(np.float32), m)
    tpl, tm = _PROP[key]
    a = np.asarray(img).copy(); g = a[:, :, :3].astype(np.float32).mean(2)
    # pad: 칸 가장자리에 잘려 일부만 걸친 소품도 찾도록 배경색으로 둘레를 넓혀 맞춘다
    P = int(spec.get('pad', 0))
    if P: g = np.pad(g, P, constant_values=float(np.mean(cfg.get('bgColor', [0, 0, 0]))))
    best = (-1, None, None)
    for sc in np.arange(0.8, 1.45, 0.05):
        t = cv2.resize(tpl, None, fx=sc, fy=sc, interpolation=cv2.INTER_AREA)
        if t.shape[0] > g.shape[0] or t.shape[1] > g.shape[1]: continue
        r = cv2.matchTemplate(g, t, cv2.TM_CCOEFF_NORMED); _, mv, _, ml = cv2.minMaxLoc(r)
        if mv > best[0]: best = (mv, ml, sc)
    mv, (lx, ly), sc = best if best[1] else (0, (0, 0), 1)
    if os.environ.get('PROP_DEBUG'): print('prop', spec.get('src', spec.get('from')), round(float(mv), 2), round(float(sc), 2), (lx - P, ly - P))
    if mv < spec.get('thr', 0.6): return img
    mk = cv2.resize(tm.astype(np.uint8), None, fx=sc, fy=sc, interpolation=cv2.INTER_NEAREST) > 0
    gr = spec.get('grow', 2)
    mk = ndimage.binary_dilation(np.pad(mk, gr), iterations=gr)
    full = np.zeros((g.shape[0] + 2 * gr, g.shape[1] + 2 * gr), bool); h, w = mk.shape
    full[ly:ly + h, lx:lx + w] = mk; full = full[gr + P:full.shape[0] - gr - P, gr + P:full.shape[1] - gr - P]
    if 'halo' in spec:  # halo: [반경, 밝기] — 지운 소품 둘레 반경 안의 어두운 번짐(밝기 미만)도 지운다
        r_, lv = spec['halo']
        near = ndimage.binary_dilation(full, iterations=r_)
        full |= near & (a[:, :, :3].astype(float) @ np.array([0.3, 0.55, 0.15]) < lv)
    a[full, 3] = 0
    return Image.fromarray(a, 'RGBA')

# ── 원본 해상도 칸 + 생성 칸
raw = {}
FXF = lambda n: n.split('_')[0].rstrip('0123456789') in ('attack', 'big', 'cast')
for name, b in cfg['frames'].items():
    raw[name] = cut(b[:4], len(b) > 4 and b[4])
    # erase: {칸 이름 접두어: [x0,y0,x1,y1]} — 칸 안 좌표의 사각형을 지운다 (늘 같은 자리에 떠 있는 구체 등)
    for pre, (ex0, ey0, ex1, ey1) in cfg.get('erase', {}).items():
        if name.rstrip('0123456789') == pre:
            arr = np.asarray(raw[name]).copy(); arr[ey0:ey1, ex0:ex1, 3] = 0; raw[name] = Image.fromarray(arr, 'RGBA')
    # eraseAt: {칸 이름: [[x0,y0,x1,y1], ...]} — 원본 그림 좌표의 사각형을 그 칸에서만 지운다 (몸에 닿은 반짝이 하나 등)
    for ex0, ey0, ex1, ey1 in cfg.get('eraseAt', {}).get(name, []):
        arr = np.asarray(raw[name]).copy(); bx, by = b[0], b[1]
        rm = np.zeros(arr.shape[:2], bool); rm[max(0, ey0 - by):max(0, ey1 - by), max(0, ex0 - bx):max(0, ex1 - bx)] = True
        if 'eraseHalo' in cfg:  # eraseHalo: [반경, 밝기] — 지운 사각형 둘레의 어두운 번짐도 지워 잘린 자리가 곧은 선으로 남지 않게
            r_, lv = cfg['eraseHalo']
            rm |= ndimage.binary_dilation(rm, iterations=r_) & (arr[:, :, :3].astype(float) @ np.array([0.3, 0.55, 0.15]) < lv)
        arr[rm, 3] = 0; raw[name] = Image.fromarray(arr, 'RGBA')
    # dropProp: {from: 칸, box: [칸 안 상자], frames: [접두어], thr, grow} (또는 그 목록) — 칸마다 따라다니는 떠 있는 소품(구체 등)을
    # 기준 칸의 모양으로 찾아(템플릿 정합, 여러 크기) 지운다. 몸에 번져 붙어도 떨어지고, 칸마다 있다 없다 하는 깜빡임이 없어진다
    dp = cfg.get('dropProp', [])
    for spec in (dp if isinstance(dp, list) else [dp]):
        if name.rstrip('0123456789') in spec['frames'] or name in spec['frames']:
            raw[name] = drop_prop(raw[name], spec)
    # 원본 해상도에서 떠 있는 구체·반짝이 떼기 (공격·시전 칸은 큰 검기·마법진은 남김)
    if name.startswith('die'):  # 누운 몸은 가늘게 끊기기 쉬워 큰 조각은 모두 남김
        raw[name] = gen.detach(raw[name], 3, 0.25)
    else:
        raw[name] = gen.detach(raw[name], cfg.get('detach_hi', 3), cfg.get('keep_fx', 0.3) if FXF(name) else 1.0)
if cfg.get('variants', True):
    runs = sorted(k for k in raw if k.startswith('run'))
    r1, rl = raw[runs[min(1, len(runs) - 1)]], raw[runs[-1]]
    raw['jump'] = gen.jump(r1); raw['fall'] = gen.fall(rl); raw['crouch'] = gen.crouch(raw['idle0']); raw['dash'] = gen.dash(raw[runs[len(runs) // 2]])
    for a_, b_ in cfg.get('tweens', []):
        raw[f'{a_}_{b_}'] = gen.tween(raw[a_], raw[b_])

# 축소 배율: 대기 칸 몸통 키 → height
bodyh = []
for k in raw:
    if k.startswith('idle'):
        m, _, _ = largest(np.asarray(raw[k])[:, :, 3] > 127)
        ys = np.where(m.any(1))[0]; bodyh.append(ys.max() - ys.min() + 1)
SC = cfg.get('height', 49) / float(np.median(bodyh))
print('scale', round(SC, 3), 'body', np.median(bodyh))

parts = []
for n, img in raw.items():
    if cfg.get('denoise'):  # denoise: 축소 전 중앙값 필터 크기 (그림의 잔 얼룩·압축 잡티가 축소 후 자글거리는 점이 되는 것 방지)
        img = Image.merge('RGBA', (*img.convert('RGB').filter(ImageFilter.MedianFilter(cfg['denoise'])).split(), img.getchannel('A')))
    c, k = shrink(img, SC, cfg.get('sharpen', 110))  # sharpen: 선명화 세기 (낮추면 축소 후 자글거림이 줄어듦)
    # 몸에서 떨어진 조각(떠 있는 구체·반짝이)은 지운다: 공격·시전 칸은 큰 검기·마법진만 남기고(30%), 나머지는 몸통만
    fx_frame = n.split('_')[0].rstrip('0123456789') in ('attack', 'big', 'cast')
    parts.append((n, c, body_only(k, cfg.get('keep_fx', 0.3)) if fx_frame else body_only(k, 0.25) if n.startswith('die') else body_only(k)))
allpx = np.concatenate([c[k] for _, c, k in parts]).astype(np.uint8)
NP = 40
pal = np.array(Image.fromarray(allpx.reshape(-1, 1, 3), 'RGB').quantize(colors=NP, method=Image.Quantize.MEDIANCUT).getpalette()[:NP * 3]).reshape(-1, 3)
def snap(c):
    return pal[((c[..., None, :] - pal[None, None]) ** 2).sum(-1).argmin(-1)]

def despeckle(rgb, keep, passes):
    """despeckle: 외톨이 픽셀 정리 — 이웃 4칸 중 3칸 이상이 비었으면 지우고, 4칸이 다 찬 1픽셀 구멍은 메우고,
    8이웃과 모두 다른 색인데 이웃 5칸 이상이 한 색이면 그 색으로 (축소·양자화로 생긴 자글거리는 점)"""
    rgb = rgb.copy(); keep = keep.copy()
    sh4 = [(1, 0), (-1, 0), (0, 1), (0, -1)]; sh8 = sh4 + [(1, 1), (1, -1), (-1, 1), (-1, -1)]
    roll = lambda a, d: np.roll(np.roll(a, d[0], 0), d[1], 1)
    for _ in range(passes):
        kp = np.pad(keep, 1)
        n4 = sum(roll(kp, d) for d in sh4)[1:-1, 1:-1].astype(int)
        filled = ~keep & (n4 >= 4)
        keep = (keep & (n4 >= 2)) | filled
        idx = (rgb[..., 0].astype(np.int64) << 16) | (rgb[..., 1].astype(np.int64) << 8) | rgb[..., 2].astype(np.int64)
        idx = np.where(keep & ~filled, idx, -1); ip = np.pad(idx, 1, constant_values=-1)
        nb = np.stack([roll(ip, d)[1:-1, 1:-1] for d in sh8])
        same = (nb == idx[None]).sum(0)
        best, cnt = idx.copy(), np.zeros(idx.shape, int)
        for j in range(8):
            c = (nb == nb[j][None]).sum(0); better = (c > cnt) & (nb[j] >= 0); best = np.where(better, nb[j], best); cnt = np.where(better, c, cnt)
        fix = (keep & ~filled & (same == 0) & (cnt >= 5)) | filled  # 메운 구멍은 이웃 최다 색으로
        best = np.where(best < 0, 0, best)
        rgb = np.where(fix[..., None], np.stack([(best >> 16) & 255, (best >> 8) & 255, best & 255], -1), rgb)
    return rgb, keep

frames, tiles = {}, []
for name, col, keep in parts:
    h, w = keep.shape
    out = np.zeros((h + 2, w + 2, 4), np.uint8)
    sc_ = np.where(keep[..., None], snap(col), 0)
    if cfg.get('despeckle'): sc_, keep = despeckle(sc_, keep, cfg['despeckle'])
    out[1:-1, 1:-1, :3] = sc_; out[1:-1, 1:-1, 3] = keep * 255
    k2 = out[..., 3] > 0
    ring = (~k2) & (np.roll(k2, 1, 0) | np.roll(k2, -1, 0) | np.roll(k2, 1, 1) | np.roll(k2, -1, 1))
    out[ring] = [10, 8, 16, 255]
    solid = out[..., 3] > 0
    ys, xs = np.where(solid)
    out = out[ys.min():ys.max() + 1, xs.min():xs.max() + 1]; solid = out[..., 3] > 0
    H, W = solid.shape
    body, _, _ = largest(solid)  # 기준점은 몸통 덩어리로 (떠 있는 구체·검기에 끌려가지 않게)
    by = np.where(body.any(1))[0]; top = body[by.min(): by.min() + max(3, int((by.max() - by.min()) * 0.3))]
    cx = int(round(np.where(top)[1].mean()))
    band = body[:, max(0, cx - 9): cx + 10]
    fy = int(np.where(band.any(1))[0].max()) + 1
    frames[name] = {'w': W, 'h': H, 'ax': cx, 'ay': fy}
    frames[name]['_top'] = int(by.min())
    tiles.append((name, Image.fromarray(out, 'RGBA')))

# level: [칸 접두어] — 그 칸들의 머리 높이를 고르게 맞추고 1픽셀씩 규칙적으로 출렁이게 (그림마다 키가 달라 생기는 떨림 제거)
for pre in cfg.get('level', []):
    names = sorted((n for n in frames if n.rstrip('0123456789') == pre), key=lambda n: int(n[len(pre):]))
    if not names: continue
    hs = [frames[n]['ay'] - frames[n]['_top'] for n in names]
    med = int(np.median(hs))
    for i, n in enumerate(names):
        frames[n]['ay'] = frames[n]['_top'] + med + (1 if i % 2 else 0)
for f in frames.values(): f.pop('_top', None)

def pack(tl):
    W = sum(t.width for _, t in tl) + len(tl); H = max(t.height for _, t in tl)
    sh = Image.new('RGBA', (W, H), (0, 0, 0, 0)); x = 0; pos = {}
    for n, t in tl:
        sh.paste(t, (x, 0)); pos[n] = (x, 0); x += t.width + 1
    return sh, pos
sheet, pos = pack(tiles)
for n, (x, y) in pos.items(): frames[n].update({'x': x, 'y': y})

# ── 이펙트·장비
fxt, fxm = [], {}
_srcs = {}
for name, spec in cfg.get('fx', {}).items():
    box, mode, sc = spec[:3]
    SRC_IM = IM
    if len(spec) > 3:  # 다른 그림(컨셉아트)에서 가져오는 에셋
        if spec[3] not in _srcs: _srcs[spec[3]] = np.asarray(Image.open(spec[3]).convert('RGB')).astype(float)
        SRC_IM = _srcs[spec[3]]
    x0, y0, x1, y1 = box
    a = SRC_IM[y0:y1, x0:x1]; bgc = bg_of(a); d = np.abs(a - bgc).sum(2)
    if mode == 'add':
        # 색은 원본 그대로, 배경보다 밝은 정도를 빛의 양으로 (배경색을 빼면 남색 배경에서 파랑이 빠져 누렇게 변함)
        lum = lambda x: x @ np.array([0.3, 0.55, 0.15])
        al = np.clip((lum(a) - lum(bgc) - cfg.get('floor', 10)) / 70.0, 0, 1)
        m = clean(d > 24, 0.1); m = ndimage.binary_dilation(m, iterations=5)
        light = np.clip(a * (al * m)[..., None] * 1.1, 0, 255)
        img = Image.fromarray(np.dstack([light, np.where(light.max(2) > 3, 255, 0)]).astype(np.uint8), 'RGBA')
        if sc != 1: img = img.resize((round(img.width * sc), round(img.height * sc)), Image.BOX)
    else:
        if mode == 'cutb':
            # 밝은 물체: 배경보다 밝은 부분만 (어두운 기운이 둘러싼 지팡이 등)
            lum = lambda x: x @ np.array([0.3, 0.55, 0.15])
            m = ndimage.binary_fill_holes(ndimage.binary_closing(lum(a) - lum(bgc) > 16, iterations=1))
            img = Image.fromarray(np.dstack([a, m * 255]).astype(np.uint8), 'RGBA')
        else:
            img = Image.fromarray(np.dstack([a, np.where(d <= TOL, 0, 255)]).astype(np.uint8), 'RGBA') if SRC_IM is not IM else cut(box)
        c, k = shrink(img, sc); k = clean(k, 0.5)
        o = np.zeros((k.shape[0] + 2, k.shape[1] + 2, 4), np.uint8); o[1:-1, 1:-1, :3] = c; o[1:-1, 1:-1, 3] = k * 255
        k2 = o[..., 3] > 0; ring = (~k2) & (np.roll(k2, 1, 0) | np.roll(k2, -1, 0) | np.roll(k2, 1, 1) | np.roll(k2, -1, 1))
        o[ring] = [10, 8, 16, 255]; img = Image.fromarray(o, 'RGBA')
    bb = img.getbbox(); img = img.crop(bb)
    fxt.append((name, img)); fxm[name] = {'w': img.width, 'h': img.height, 'add': mode == 'add'}
if fxt:
    fsheet, fpos = pack(fxt)
    for n, (x, y) in fpos.items(): fxm[n].update({'x': x, 'y': y})

def b64(img):
    bio = io.BytesIO(); img.save(bio, 'PNG', optimize=True); return base64.b64encode(bio.getvalue()).decode()
hid = cfg['id']; HID = hid.upper()
ts = f'''/**
 * {cfg.get('title', hid)} — 컨셉아트에서 잘라 만든 스프라이트 (자동 생성: tools/hero.py, 손으로 고치지 말 것).
 * 칸: 배경 제거 → 반짝이 정리 → 선명화 → {SC:.2f}배 면적 평균 축소 → 공용 40색 → 1픽셀 외곽선. ax/ay = 발 기준점.
 * fx: 스킬 에셋 그림 (add = 가산 혼합용 빛, 아니면 알파로 잘라낸 물체).
 */
import type {{ HeroSheet }} from '../hd';

export const {HID}: HeroSheet = {{
  sheet: 'data:image/png;base64,{b64(sheet)}',
  frames: {json.dumps({k: {kk: v[kk] for kk in ('x', 'y', 'w', 'h', 'ax', 'ay')} for k, v in frames.items()})},
  fxSheet: {("'data:image/png;base64," + b64(fsheet) + "'") if fxt else "''"},
  fx: {json.dumps(fxm)},
  poses: {json.dumps(cfg['poses'])},
  cycles: {json.dumps(cfg['cycles'])},
}};
'''
open(OUT_TS, 'w').write(ts)
# 미리보기: 칸 + 이펙트
pv = Image.new('RGBA', (max(sheet.width, fsheet.width if fxt else 0), sheet.height + (fsheet.height if fxt else 0) + 4), (58, 52, 80, 255))
pv.alpha_composite(sheet, (0, 0))
if fxt: pv.alpha_composite(fsheet, (0, sheet.height + 4))
pv.resize((pv.width * 2, pv.height * 2), Image.NEAREST).save(PREV)
print(len(frames), 'frames', sheet.size, 'fx', list(fxm), 'ts', len(ts))
