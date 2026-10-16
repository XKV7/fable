"""컨셉아트 프레임 사이 동작 만들기 (원본 해상도에서 작업, 결과는 make_sheet의 축소·색 정리를 그대로 거침)
 - 인비트윈: 앞·뒤 프레임을 발 기준으로 맞춘 뒤 양방향 광학 흐름으로 반쯤 이동시킨 모습을 합성
 - 변형: 부위(하체·상체) 단위로 늘이고 접고 기울여 점프·낙하·착지·대시를 만든다
"""
import numpy as np, cv2
from PIL import Image

def arr(img): return np.asarray(img).astype(np.float32)

def anchor(a):
    m = a[:, :, 3] > 127
    ys, xs = np.where(m)
    h = ys.max() - ys.min() + 1
    top = m[ys.min(): ys.min() + max(3, int(h * 0.3))]
    cx = int(round(np.where(top)[1].mean()))
    band = m[:, max(0, cx - 15): cx + 16]
    fy = int(np.where(band.any(axis=1))[0].max()) + 1
    return cx, fy

def align(a, b):
    """두 프레임을 발 기준점이 같은 곳에 오게 같은 크기 캔버스에 놓는다"""
    (ax, ay), (bx, by) = anchor(a), anchor(b)
    L = max(ax, bx); R = max(a.shape[1] - ax, b.shape[1] - bx)
    T = max(ay, by); B = max(a.shape[0] - ay, b.shape[0] - by)
    out = []
    for im, x, y in ((a, ax, ay), (b, bx, by)):
        c = np.zeros((T + B, L + R, 4), np.float32)
        c[T - y: T - y + im.shape[0], L - x: L - x + im.shape[1]] = im
        out.append(c)
    return out

def gray(a):
    g = (a[:, :, :3] @ np.array([0.3, 0.55, 0.15], np.float32)) * (a[:, :, 3] / 255) + (a[:, :, 3] > 127) * 40
    return np.clip(g, 0, 255).astype(np.uint8)

def flow(a, b):
    return cv2.calcOpticalFlowFarneback(gray(a), gray(b), None, 0.5, 4, 9, 6, 7, 1.5, 0)

def warp(a, f, t):
    h, w = a.shape[:2]
    gx, gy = np.meshgrid(np.arange(w, dtype=np.float32), np.arange(h, dtype=np.float32))
    return cv2.remap(a, gx - f[..., 0] * t, gy - f[..., 1] * t, cv2.INTER_NEAREST, borderMode=cv2.BORDER_CONSTANT, borderValue=0)

def tween(A, B, t=0.5):
    a, b = align(arr(A), arr(B))
    fab, fba = flow(a, b), flow(b, a)
    wa, wb = warp(a, fab, t), warp(b, fba, 1 - t)
    # 가까운 쪽 그림을 우선, 없는 곳만 다른 쪽으로 채운다 (색을 섞지 않아 흐려지지 않음)
    first, second = (wa, wb) if t <= 0.5 else (wb, wa)
    alpha = (wa[:, :, 3] * (1 - t) + wb[:, :, 3] * t)
    rgb = np.where(first[:, :, 3:4] > 127, first[:, :, :3], second[:, :, :3])
    out = np.dstack([rgb, np.where(alpha > 127, 255, 0)]).astype(np.uint8)
    return Image.fromarray(out, 'RGBA')

def regions(a):
    """발 기준점과 엉덩이 높이(키의 62% 지점)"""
    m = a[:, :, 3] > 127
    ys = np.where(m.any(axis=1))[0]
    top, bot = ys.min(), ys.max() + 1
    return top, bot, int(top + (bot - top) * 0.62)

def restack(a, hip, lower_scale, upper_shift=0, lower_shear=0.0):
    """하체를 세로로 늘이거나 접고(lower_scale), 상체를 그 위에 다시 얹는다"""
    h, w = a.shape[:2]
    up, lo = a[:hip], a[hip:]
    nh = max(2, int(round(lo.shape[0] * lower_scale)))
    lo2 = cv2.resize(lo, (w, nh), interpolation=cv2.INTER_NEAREST)
    if lower_shear:
        M = np.float32([[1, lower_shear, -lower_shear * nh / 2], [0, 1, 0]])
        lo2 = cv2.warpAffine(lo2, M, (w, nh), flags=cv2.INTER_NEAREST, borderValue=0)
    out = np.zeros((up.shape[0] + nh + 8, w, 4), np.float32)
    out[:up.shape[0]] = up
    seam = out[up.shape[0]: up.shape[0] + nh]
    seam[:] = np.where(seam[:, :, 3:4] > 0, seam, lo2)
    return out

def to_img(a): return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGBA')

def jump(run):
    a = arr(run); _, _, hip = regions(a)
    return to_img(restack(a, hip, 0.72, lower_shear=-0.25))  # 다리를 접어 올린 모습

def fall(run):
    a = arr(run); _, _, hip = regions(a)
    return to_img(restack(a, hip, 1.1, lower_shear=0.2))  # 다리를 뻗어 내리는 모습

def crouch(idle):
    a = arr(idle); h, w = a.shape[:2]
    nh = int(round(h * 0.88)); nw = int(round(w * 1.06))
    return to_img(cv2.resize(a, (nw, nh), interpolation=cv2.INTER_NEAREST))  # 착지: 눌린 모습

def dash(run):
    a = arr(run); h, w = a.shape[:2]
    k = 0.22  # 위쪽을 앞으로 기울임
    pad = int(h * k) + 4
    M = np.float32([[1, -k, h * k], [0, 1, 0]])
    body = cv2.warpAffine(a, M, (w + pad, h), flags=cv2.INTER_NEAREST, borderValue=0)
    # 뒤쪽 잔상: 같은 실루엣을 별빛색 점무늬로
    out = np.zeros((h, w + pad + 10, 4), np.float32)
    sil = body[:, :, 3] > 127
    ghost = np.zeros_like(body); ghost[sil] = [44, 52, 140, 255]  # 짙은 남청 잔상
    out[:, :w + pad] = ghost
    shifted = np.zeros_like(out); shifted[:, 10:] = body
    return to_img(np.where(shifted[:, :, 3:4] > 127, shifted, out))

def make_all(raw):
    g = {}
    for i in range(4):  # 달리기 4칸 → 8칸
        g[f'run{i}_{(i + 1) % 4}'] = tween(raw[f'run{i}'], raw[f'run{(i + 1) % 4}'])
    for i in range(4):  # 걷기 사이
        g[f'walk{i}_{i + 1}'] = tween(raw[f'walk{i}'], raw[f'walk{i + 1}'])
    for i in (0, 1, 2, 4):  # 공격 칸 사이 (휘두르는 중간). 3→4는 큰 검기가 사라지는 칸이라 사이 그림이 깨져서 제외
        g[f'attack{i}_{i + 1}'] = tween(raw[f'attack{i}'], raw[f'attack{i + 1}'])
    g['cast0_1'] = tween(raw['cast0'], raw['cast1'])
    g['hit_die'] = tween(raw['hit1'], raw['die0'])
    for i in range(3):  # 쓰러지는 중간
        g[f'die{i}_{i + 1}'] = tween(raw[f'die{i}'], raw[f'die{i + 1}'])
    g['jump'] = jump(raw['run1'])
    g['fall'] = fall(raw['run3'])
    g['crouch'] = crouch(raw['idle0'])
    g['dash'] = dash(raw['run2'])
    g.update(make_strides(raw))
    return g

def stride(run, phase, swing=26, bob=3):
    """달리기 보폭: 컨셉아트 달리기 칸은 다리 모양이 거의 같아 미끄러지듯 보인다.
    하체를 엉덩이 기준 앞다리·뒷다리로 나눠 반대 방향으로 흔들고(phase), 몸통은 위아래로 출렁이게 한다."""
    a = arr(run)
    m = a[:, :, 3] > 127
    ys = np.where(m.any(axis=1))[0]
    top, bot = ys.min(), ys.max() + 1
    hip = int(top + (bot - top) * 0.66)
    band = m[hip:hip + 6]
    cx = int(round(np.where(band)[1].mean()))
    pad = 24
    H, W = a.shape[0] + pad * 2, a.shape[1] + pad * 2
    A = np.zeros((H, W, 4), np.float32); A[pad:pad + a.shape[0], pad:pad + a.shape[1]] = a
    hy, hx = hip + pad, cx + pad
    s = np.sin(phase)
    lift = -abs(np.cos(phase)) * bob  # 다리가 모일 때(교차) 몸이 떠오른다
    def part(x0, x1, ang):
        p = np.zeros_like(A); p[hy:, x0:x1] = A[hy:, x0:x1]
        M = cv2.getRotationMatrix2D((float(hx), float(hy)), ang, 1.0)
        return cv2.warpAffine(p, M, (W, H), flags=cv2.INTER_NEAREST, borderValue=0)
    back = part(0, hx, -swing * s)
    front = part(hx, W, swing * s)
    up = np.zeros_like(A); up[:hy + 3] = A[:hy + 3]
    # 몸통 출렁임
    dy = int(round(lift))
    up = np.roll(up, dy, axis=0)
    out = back
    out = np.where(front[:, :, 3:4] > 127, front, out)
    out = np.where(up[:, :, 3:4] > 127, up, out)
    return to_img(out)

def make_strides(raw):
    # 달리기 4칸을 번갈아 바탕으로 쓰고(옷자락 움직임), 다리는 8단계로 흔든다
    return {f'stride{i}': stride(raw[f'run{(i // 2) % 4}'], i * np.pi / 4) for i in range(8)}

def detach(img, it=3, frac=1.0):
    """원본 해상도에서 몸에 번짐으로 붙어 있는 떠 있는 구체·나침반·반짝이를 떼어 낸다.
    it 픽셀 깎아 가는 다리를 끊고 → 큰 덩어리(frac 이상)만 남긴 뒤 → 깎은 가장자리만 되돌림"""
    from scipy import ndimage as nd
    a = np.asarray(img).copy()
    m = a[:, :, 3] > 127
    er = nd.binary_erosion(m, structure=np.ones((3, 3)), iterations=it)
    lab, n = nd.label(er, structure=np.ones((3, 3)))
    if n == 0: return img
    sizes = nd.sum(er, lab, range(1, n + 1))
    ok = np.zeros(n + 1, bool); ok[1:] = sizes >= sizes.max() * frac - 1e-9
    keep = nd.binary_dilation(ok[lab], structure=np.ones((3, 3)), iterations=it + 1) & m
    a[:, :, 3] = np.where(keep, a[:, :, 3], 0)
    return Image.fromarray(a, 'RGBA')
