import { makeCanvas, OUTLINE } from './pixel';

/**
 * UI 아이콘 전용 그림 (유물·아이템·문장·상태·재화 등 icons.ts 의 모든 키).
 * 무기 그림(weaponArt)과 같은 마감 규칙을 따른다.
 *  - 모양은 32×32 연속 좌표계에 도형 함수로 정의 → 원하는 해상도(N)로 그때그때 래스터화
 *    (UI 박스 크기 × 2 로 그려 ★6·7 영웅/무기 그림과 같은 2배 픽셀 밀도. 확대·축소 번짐 없음)
 *  - 부품별 5단계 음영 (광원 왼쪽 위) + 실루엣 안쪽 베벨(가장자리 쪽 면 기울기) + 4×4 정렬 디더
 *  - 아래 부품과 맞닿은 가장자리 = 짙은 구분선, 전체 1px 외곽선 (#0a0810)
 *  - 외곽선 없는 빛 효과(불꽃·번개·반짝임)
 * 같은 키가 유물마다 다른 색으로 쓰이므로 본색(col)에서 재질을 만들어 (키, 색, 해상도)별로 캐시한다.
 */

type RGB = [number, number, number];
/** 32 좌표계 위치 → 음영 값 t(-1 어두움 ~ 1 밝음), 밖이면 null */
type Test = (x: number, y: number) => number | null;
type Pt = [number, number];

const S = 32;
const hex = (c: string): RGB => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const WHITE: RGB = [255, 255, 255];
const INK: RGB = [22, 14, 30];
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const lum = (c: RGB): number => (c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11) / 255;

/** 재질: 어두운 쪽부터 5단계 */
interface Mat {
  r: RGB[];
}
function mat(base: RGB, o: { hi?: RGB; lo?: RGB; k?: number } = {}): Mat {
  const hi = o.hi ?? mix(base, WHITE, 0.55);
  const lo = o.lo ?? mix(base, INK, 0.64);
  return { r: [lo, mix(lo, base, 0.55), base, mix(base, hi, 0.55), hi] };
}

/** 본색 하나에서 뽑은 재질 묶음 */
interface Pal {
  /** 본색 */
  P: Mat;
  /** 밝은 본색 (유리·빛나는 부분) */
  L: Mat;
  /** 어두운 본색 (손잡이·안쪽) */
  D: Mat;
  /** 흰색 계열 (밀랍·종이·칼날·보석 빛) — 본색이 살짝 섞인다 */
  W: Mat;
  /** 검정 (눈·구멍) */
  K: Mat;
  /** 금속 (칼날·쇠테) */
  M: Mat;
  /** 나무 (자루) */
  T: Mat;
  c: RGB;
  hi: RGB;
}
function palette(col: string): Pal {
  const c = hex(col);
  const l = lum(c);
  return {
    P: mat(c),
    L: mat(mix(c, WHITE, 0.5), { hi: WHITE }),
    D: mat(mix(c, INK, l > 0.7 ? 0.6 : 0.45)),
    W: mat(mix([236, 232, 244], c, 0.14), { hi: WHITE, lo: mix([90, 84, 110], c, 0.25) }),
    K: mat([26, 18, 34], { hi: [70, 56, 86], lo: [8, 6, 12] }),
    M: mat(mix([170, 178, 192], c, 0.22), { hi: WHITE, lo: mix([40, 42, 56], c, 0.15) }),
    T: mat(mix([118, 80, 52], c, 0.18), { hi: mix([200, 150, 100], c, 0.15), lo: [36, 20, 12] }),
    c,
    hi: mix(c, WHITE, 0.75),
  };
}

interface PaintOpt {
  /** 아래 부품과의 경계에 구분선 */
  sep?: boolean;
  /** 베벨 폭 (32 좌표계 단위, 0 = 없음) */
  bev?: number;
  /** 색 덧칠 (x, y = 32 좌표계) */
  tex?: (x: number, y: number, c: RGB) => RGB;
}

class Art {
  col: Float32Array;
  a: Uint8Array;
  part: Int16Array;
  fx: { x: number; y: number; c: RGB; a: number }[] = [];
  private pid = 0;
  /** 1픽셀 = 32 좌표계의 몇 단위인가 */
  u: number;
  constructor(public n: number) {
    this.col = new Float32Array(n * n * 3);
    this.a = new Uint8Array(n * n);
    this.part = new Int16Array(n * n).fill(-1);
    this.u = S / n;
  }
  /** 픽셀 중심 → 32 좌표 */
  cx(p: number): number {
    return (p + 0.5) * this.u;
  }
  /** 32 좌표 → 픽셀 */
  px(v: number): number {
    return Math.floor(v / this.u);
  }

  paint(test: Test, m: Mat, o: PaintOpt = {}): void {
    const N = this.n;
    const id = this.pid++;
    const mask = new Float32Array(N * N).fill(NaN);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const t = test(this.cx(x), this.cx(y));
      if (t !== null) mask[y * N + x] = t;
    }
    const inM = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < N && y < N && !Number.isNaN(mask[y * N + x]);
    // 베벨: 실루엣 안쪽 거리장 → 가장자리 면의 기울기를 빛 방향과 내적
    const bev = o.bev ?? 2.6;
    let lit: Float32Array | null = null;
    if (bev > 0) {
      const R = Math.max(1.5, bev / this.u);
      const d = new Float32Array(N * N);
      for (let i = 0; i < N * N; i++) d[i] = Number.isNaN(mask[i]) ? 0 : 1e4;
      const at = (x: number, y: number): number => (x < 0 || y < 0 || x >= N || y >= N ? 0 : d[y * N + x]);
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const i = y * N + x;
        if (!d[i]) continue;
        d[i] = Math.min(d[i], at(x - 1, y) + 1, at(x, y - 1) + 1, at(x - 1, y - 1) + 1.414, at(x + 1, y - 1) + 1.414);
      }
      for (let y = N - 1; y >= 0; y--) for (let x = N - 1; x >= 0; x--) {
        const i = y * N + x;
        if (!d[i]) continue;
        d[i] = Math.min(d[i], at(x + 1, y) + 1, at(x, y + 1) + 1, at(x + 1, y + 1) + 1.414, at(x - 1, y + 1) + 1.414);
      }
      const h = (x: number, y: number): number => Math.min(at(x, y), R) / R;
      lit = new Float32Array(N * N);
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const i = y * N + x;
        if (!d[i]) continue;
        const gx = h(x + 1, y) - h(x - 1, y);
        const gy = h(x, y + 1) - h(x, y - 1);
        lit[i] = Math.max(-1, Math.min(1, ((gx * 0.6 + gy * 0.75) * R) / 2));
      }
    }
    const dAmp = N >= 40 ? 0.45 : 0.3;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = y * N + x;
      let t = mask[i];
      if (Number.isNaN(t)) continue;
      if (lit) t += lit[i] * 0.75;
      t = Math.max(-1, Math.min(1, t));
      const s = ((t + 1) / 2) * 4 + (BAYER[(y & 3) * 4 + (x & 3)] / 16 - 0.5) * dAmp;
      let k = Math.max(0, Math.min(4, Math.round(s)));
      if (!inM(x - 1, y - 1) && k < 4 && k >= 2) k++;
      if (!inM(x + 1, y + 1) && k > 0) k--;
      if (o.sep !== false) {
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= N || ny >= N || inM(nx, ny)) continue;
          const j = ny * N + nx;
          if (this.a[j] && this.part[j] !== id) {
            k = Math.min(k, 0);
            break;
          }
        }
      }
      let c = m.r[k];
      if (o.tex) c = o.tex(this.cx(x), this.cx(y), c);
      this.col[i * 3] = c[0];
      this.col[i * 3 + 1] = c[1];
      this.col[i * 3 + 2] = c[2];
      this.a[i] = 255;
      this.part[i] = id;
    }
  }

  /** 칠해진 픽셀 위에 덧칠 (32 좌표) */
  dot(x: number, y: number, c: RGB, a = 1): void {
    this.dotP(this.px(x), this.px(y), c, a);
  }
  dotP(x: number, y: number, c: RGB, a = 1): void {
    const N = this.n;
    if (x < 0 || y < 0 || x >= N || y >= N) return;
    const i = y * N + x;
    if (!this.a[i]) return;
    for (let k = 0; k < 3; k++) this.col[i * 3 + k] += (c[k] - this.col[i * 3 + k]) * a;
  }
  /** 선 덧칠 (32 좌표, 1픽셀 굵기) */
  line(x0: number, y0: number, x1: number, y1: number, c: RGB, a = 1, skip = 0): void {
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / this.u) + 1;
    let last = -1;
    for (let k = 0; k <= n; k++) {
      if (skip && k % skip === skip - 1) continue;
      const px = this.px(x0 + ((x1 - x0) * k) / n);
      const py = this.px(y0 + ((y1 - y0) * k) / n);
      const id = py * this.n + px;
      if (id === last) continue;
      last = id;
      this.dotP(px, py, c, a);
    }
  }
  /** 외곽선 없는 빛 (32 좌표) */
  glow(x: number, y: number, c: RGB, a = 1): void {
    this.fx.push({ x: this.px(x), y: this.px(y), c, a });
  }
  /** 반짝임: 가운데 흰 점 + 십자 번짐 (해상도에 맞춰 팔 길이) */
  spark(x: number, y: number, c: RGB, big = false): void {
    const X = this.px(x);
    const Y = this.px(y);
    const arm = Math.max(1, Math.round((big ? 2.4 : 1.4) / this.u));
    this.fx.push({ x: X, y: Y, c: WHITE, a: 1 });
    for (let k = 1; k <= arm; k++) {
      const a = 0.9 - (k - 1) / (arm + 0.5);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) this.fx.push({ x: X + dx * k, y: Y + dy * k, c, a });
    }
  }

  finish(): HTMLCanvasElement {
    const N = this.n;
    const cv = makeCanvas(N, N);
    const g = cv.getContext('2d')!;
    const img = g.createImageData(N, N);
    const d = img.data;
    const oc = hex(OUTLINE);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = y * N + x;
      if (this.a[i]) {
        d[i * 4] = this.col[i * 3];
        d[i * 4 + 1] = this.col[i * 3 + 1];
        d[i * 4 + 2] = this.col[i * 3 + 2];
        d[i * 4 + 3] = 255;
      } else if ((x > 0 && this.a[i - 1]) || (x < N - 1 && this.a[i + 1]) || (y > 0 && this.a[i - N]) || (y < N - 1 && this.a[i + N])) {
        d[i * 4] = oc[0];
        d[i * 4 + 1] = oc[1];
        d[i * 4 + 2] = oc[2];
        d[i * 4 + 3] = 255;
      }
    }
    for (const f of this.fx) {
      if (f.x < 0 || f.y < 0 || f.x >= N || f.y >= N) continue;
      const i = (f.y * N + f.x) * 4;
      if (d[i + 3] === 0) {
        d[i] = f.c[0];
        d[i + 1] = f.c[1];
        d[i + 2] = f.c[2];
        d[i + 3] = Math.round(255 * f.a);
      } else {
        const a = d[i + 3] < 255 ? Math.max(f.a, d[i + 3] / 255) : f.a;
        for (let k = 0; k < 3; k++) d[i + k] = d[i + k] + (f.c[k] - d[i + k]) * f.a;
        d[i + 3] = Math.round(255 * Math.max(a, d[i + 3] / 255));
      }
    }
    g.putImageData(img, 0, 0);
    return cv;
  }
}

// ───────────── 도형 (32 좌표계) ─────────────

const LX = -0.6;
const LY = -0.75;

/** 구: 빛 방향(왼쪽 위 앞)과의 내적 */
function ball(cx: number, cy: number, r: number, ry = r, k = 1): Test {
  return (x, y) => {
    const nx = (x - cx) / r;
    const ny = (y - cy) / ry;
    const q = nx * nx + ny * ny;
    if (q > 1) return null;
    const nz = Math.sqrt(1 - q);
    return ((-nx * 0.55 - ny * 0.6 + nz * 0.58) * 1.5 - 0.35) * k;
  };
}

/** 평평한 타원 (대각 기울기) */
function oval(cx: number, cy: number, rx: number, ry: number, t0 = 0, grad = 0.5): Test {
  return (x, y) => {
    const nx = (x - cx) / rx;
    const ny = (y - cy) / ry;
    if (nx * nx + ny * ny > 1) return null;
    return t0 - (nx * 0.6 + ny * 0.75) * grad;
  };
}

/** 고리 (두께 th: 중심 반지름 ±th) */
function ring(cx: number, cy: number, r: number, th: number, ry = r, from = -Math.PI, to = Math.PI): Test {
  return (x, y) => {
    const px = x - cx;
    const py = (y - cy) * (r / ry);
    const d = Math.hypot(px, py);
    if (Math.abs(d - r) > th) return null;
    const a = Math.atan2(py, px);
    if (a < from || a > to) return null;
    const w = (d - r) / th;
    const ox = px / (d || 1);
    const oy = py / (d || 1);
    return (ox * LX + oy * LY) * w * 0.9 + (1 - Math.abs(w)) * 0.3;
  };
}

/** 다각형 (짝수-홀수). t = 기본값 + 빛 방향 기울기 */
function poly(pts: Pt[], t0 = 0, grad = 0.6): Test {
  let lo = Infinity;
  let hi = -Infinity;
  for (const p of pts) {
    const q = p[0] * 0.6 + p[1] * 0.75;
    lo = Math.min(lo, q);
    hi = Math.max(hi, q);
  }
  return (px, py) => {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i];
      const [xj, yj] = pts[j];
      if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
    }
    if (!inside) return null;
    return t0 + grad * (0.5 - (px * 0.6 + py * 0.75 - lo) / Math.max(1, hi - lo));
  };
}

const rect = (x0: number, y0: number, x1: number, y1: number, t0 = 0, grad = 0.6): Test => poly([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], t0, grad);

/** 둥근 사각형 */
function rrect(x0: number, y0: number, x1: number, y1: number, r: number, t0 = 0, grad = 0.6): Test {
  const base = rect(x0, y0, x1, y1, t0, grad);
  return (x, y) => {
    const qx = Math.max(x0 + r - x, 0, x - (x1 - r));
    const qy = Math.max(y0 + r - y, 0, y - (y1 - r));
    if (qx * qx + qy * qy > r * r) return null;
    return base(Math.min(Math.max(x, x0 + 0.01), x1 - 0.01), Math.min(Math.max(y, y0 + 0.01), y1 - 0.01));
  };
}

/** 가늘어지는 꺾은선 (원통 음영). r0 → r1 로 굵기 변화 */
function stroke(pts: Pt[], r0: number, r1 = r0, t0 = 0): Test {
  const L: number[] = [0];
  for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const tot = L[L.length - 1] || 1;
  return (px, py) => {
    let best = Infinity;
    let bdx = 0;
    let bdy = 0;
    let br = r0;
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[i + 1];
      const vx = x1 - x0;
      const vy = y1 - y0;
      const l2 = vx * vx + vy * vy || 1;
      const k = Math.max(0, Math.min(1, ((px - x0) * vx + (py - y0) * vy) / l2));
      const dx = px - (x0 + vx * k);
      const dy = py - (y0 + vy * k);
      const r = r0 + (r1 - r0) * ((L[i] + (L[i + 1] - L[i]) * k) / tot);
      const dd = Math.hypot(dx, dy) - r;
      if (dd < best) {
        best = dd;
        bdx = dx;
        bdy = dy;
        br = r;
      }
    }
    if (best > 0) return null;
    return t0 + ((bdx * LX + bdy * LY) / Math.max(0.5, br)) * 0.9;
  };
}

/** 2차 베지어 점열 */
function bez(p0: Pt, p1: Pt, p2: Pt, n = 14): Pt[] {
  const o: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = (1 - t) * (1 - t);
    const b = 2 * (1 - t) * t;
    const c = t * t;
    o.push([a * p0[0] + b * p1[0] + c * p2[0], a * p0[1] + b * p1[1] + c * p2[1]]);
  }
  return o;
}

/** 별 꼭짓점 */
function starPts(cx: number, cy: number, R: number, r: number, n = 5, rot = -Math.PI / 2): Pt[] {
  const p: Pt[] = [];
  for (let i = 0; i < n * 2; i++) {
    const a = rot + (i * Math.PI) / n;
    const rr = i % 2 ? r : R;
    p.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  return p;
}

/** a 에서 b 를 뺀 모양 */
const sub = (a: Test, ...b: Test[]): Test => (x, y) => (b.some((f) => f(x, y) !== null) ? null : a(x, y));
/** 여러 모양 합 (먼저 맞는 값) */
const uni = (...f: Test[]): Test => (x, y) => {
  for (const q of f) {
    const t = q(x, y);
    if (t !== null) return t;
  }
  return null;
};
/** 조건으로 자르기 */
const clip = (a: Test, keep: (x: number, y: number) => boolean): Test => (x, y) => (keep(x, y) ? a(x, y) : null);
/** 축 좌표: 원점(ox,oy)에서 각도 deg(0 = 오른쪽, 90 = 위) 방향 u, 그 왼쪽이 v */
function axis(ox: number, oy: number, deg: number): { at: (u: number, v: number) => Pt; uv: (x: number, y: number) => Pt } {
  const a = (deg * Math.PI) / 180;
  const dx = Math.cos(a);
  const dy = -Math.sin(a);
  return {
    at: (u, v) => [ox + u * dx + v * dy, oy + u * dy - v * dx],
    uv: (x, y) => {
      const px = x - ox;
      const py = y - oy;
      return [px * dx + py * dy, px * dy - py * dx];
    },
  };
}
type Axis = ReturnType<typeof axis>;
const apoly = (ax: Axis, pts: Pt[], t0 = 0, grad = 0.6): Test => poly(pts.map(([u, v]) => ax.at(u, v)), t0, grad);

/** 칼날: 가운데 날 선 기준 위(빛) 면 밝고 아래 면 어둡다 */
function blade(ax: Axis, u0: number, u1: number, w: (u: number) => number): Test {
  return (x, y) => {
    const [u, v] = ax.uv(x, y);
    if (u < u0 || u > u1) return null;
    const h = w(u);
    if (h <= 0 || Math.abs(v) > h) return null;
    const f = v / h;
    return f > 0 ? (f > 0.7 ? 1 : 0.3 + f * 0.5) : f < -0.75 ? 0.1 : -0.3 + f * 0.5;
  };
}

/** 하트 모양 */
function heartT(cx: number, cy: number, s: number): Test {
  return (x, y) => {
    const X = (x - cx) / s;
    const Y = -(y - cy) / s;
    const q = X * X + Y * Y - 1;
    if (q * q * q - X * X * Y * Y * Y > 0) return null;
    // 두 둥근 볼 + 아래 뾰족
    const lx = X < 0 ? X + 0.55 : X - 0.55;
    const ly = Y - 0.45;
    const nz = Math.max(0, 1 - (lx * lx + ly * ly) / 0.5);
    return (-X * 0.55 + Y * 0.7) * 0.7 + nz * 0.5 - 0.1;
  };
}

// ───────────── 아이콘별 그림 ─────────────

type Draw = (A: Art, p: Pal) => void;

/** 물방울 모양 (꼭지 위) */
function dropT(cx: number, top: number, bot: number, r: number): Test {
  const cy = bot - r;
  return (x, y) => {
    if (y > bot || y < top) return null;
    if (y >= cy) {
      const q = ball(cx, cy, r)(x, y);
      return q;
    }
    const k = (y - top) / (cy - top);
    const w = r * Math.pow(k, 0.75);
    if (Math.abs(x - cx) > w) return null;
    return ball(cx, cy, r)(cx + (x - cx) * (r / Math.max(0.01, w)) * 0.9, cy - r * 0.5 * (1 - k)) ?? 0.2;
  };
}

/** 불꽃 모양: 흔들리는 혀 */
function flameT(cx: number, top: number, bot: number, w: number, lean = 0): Test {
  return (x, y) => {
    if (y < top || y > bot) return null;
    const k = (y - top) / (bot - top); // 0 꼭대기 ~ 1 바닥
    const off = lean * (1 - k) * (1 - k) + Math.sin(k * 7) * 0.6 * (1 - k);
    const hw = w * (k < 0.72 ? Math.pow(k / 0.72, 0.8) : Math.sqrt(Math.max(0, 1 - ((k - 0.72) / 0.28) ** 2)));
    const d = x - cx - off;
    if (Math.abs(d) > hw) return null;
    return 0.4 - (d / Math.max(0.5, hw)) * 0.5 - (k - 0.5) * 0.4;
  };
}

/** 해골 (공용: skull 아이콘·영혼 등) */
function skullDraw(A: Art, p: Pal, m: Mat): void {
  A.paint(uni(ball(16, 13.5, 11.5, 10.5), rrect(9, 15, 23, 25.5, 3.5, -0.2, 0.6)), m);
  // 눈구멍·코
  A.paint(oval(11.2, 15.2, 3.4, 3.6, -0.5, 0.2), p.K, { sep: false, bev: 0 });
  A.paint(oval(20.8, 15.2, 3.4, 3.6, -0.5, 0.2), p.K, { sep: false, bev: 0 });
  A.paint(poly([[16, 18.6], [18, 22], [14, 22]], -0.6, 0.2), p.K, { sep: false, bev: 0 });
  // 이빨
  A.paint(rrect(11, 24.5, 21, 29.5, 1.2, 0.3, 0.6), p.W);
  for (const x of [13.5, 16, 18.5]) A.line(x, 24.6, x, 29.4, p.W.r[0]);
  A.glow(11.2 - 0.8, 14.2, p.hi, 0.85);
  A.glow(20.8 - 0.8, 14.2, p.hi, 0.85);
  A.dot(9, 7.5, WHITE, 0.6);
}

/** 손잡이 공통 (자루 + 끝 공) */
function shaft(A: Art, a: Pt, b: Pt, r: number, m: Mat, bands?: Mat, n = 0): void {
  A.paint(stroke([a, b], r), m);
  if (bands) for (let i = 1; i <= n; i++) {
    const k = i / (n + 1);
    const cx = a[0] + (b[0] - a[0]) * k;
    const cy = a[1] + (b[1] - a[1]) * k;
    A.paint(ball(cx, cy, r + 0.7), bands, { bev: 0 });
  }
}

const D: Record<string, Draw> = {
  heart(A, p) {
    A.paint(heartT(16, 14.5, 12.6), p.P, { bev: 3 });
    A.paint(oval(10.5, 10, 3, 2, 0.9, 0.2), p.L, { sep: false, bev: 0 });
    A.dot(9.5, 9.5, WHITE);
    A.dot(10.5, 9.5, WHITE, 0.7);
  },
  candle(A, p) {
    // 받침 접시
    A.paint(uni(oval(16, 27, 13, 3.6, -0.1, 0.5), rect(13, 22, 19, 27, 0, 0.4)), p.D);
    // 밀랍 기둥 + 흘러내림
    const wax = uni(rect(11, 13.5, 21, 25.5, 0.1, 0.5), oval(16, 13.5, 5, 1.6, 0.5), stroke([[12.5, 13.5], [12.5, 19]], 1.4), stroke([[19.4, 14], [19.4, 17]], 1.2));
    A.paint((x, y) => {
      const t = wax(x, y);
      if (t === null) return null;
      return t + (x < 14 ? 0.35 : x > 19 ? -0.35 : 0);
    }, p.W);
    // 심지
    A.paint(rect(15.3, 9.5, 16.7, 13, -0.6, 0), p.K, { bev: 0 });
    // 불꽃
    A.paint(flameT(16, 0.8, 11.2, 4, 0.8), p.P, { sep: false });
    A.paint(flameT(16, 4.5, 10.6, 2, 0.4), p.L, { sep: false, bev: 0 });
    A.glow(16, 9, WHITE, 0.9);
    for (const [x, y, a] of [[11, 4, 0.5], [21.5, 6, 0.6], [9.5, 9, 0.35], [23, 2, 0.4]]) A.glow(x, y, p.hi, a);
  },
  boot(A, p) {
    // 장화 몸통 + 발
    A.paint(poly([[8, 3], [20, 3], [20, 17], [27, 19.5], [29.5, 23.5], [29.5, 25.5], [6, 25.5], [7.5, 17]], 0.05, 0.7), p.P, { bev: 2.6 });
    // 접힌 윗단
    A.paint(rrect(7, 3, 21.5, 8, 1.2, 0.4, 0.5), p.L);
    // 밑창·굽
    A.paint(uni(rect(5.5, 25, 30, 28.5, -0.3, 0.3), rect(5.5, 25, 12, 29.8, -0.4, 0.3)), p.D, { bev: 1.4 });
    // 끈 구멍
    for (let i = 0; i < 3; i++) {
      A.dot(17.5, 11 + i * 3, p.D.r[0]);
      A.dot(18.5, 11.5 + i * 3, p.D.r[0]);
    }
    A.line(9, 9.5, 9, 23, p.P.r[3], 0.6);
    A.line(8, 26, 29, 26, p.D.r[3], 0.7, 3);
  },
  feather(A, p) {
    const ax = axis(4.5, 28.5, 52);
    const w = (u: number): number => (u < 6 ? 0 : u > 33 ? 0 : 6.2 * Math.sin(((u - 6) / 27) * Math.PI) ** 0.7 * (u > 26 ? 1 : 1));
    // 깃털 날개 (톱니 결)
    A.paint(
      (x, y) => {
        const [u, v] = ax.uv(x, y);
        const h = w(u) * (v > 0 ? 1 : 0.82);
        if (h <= 0 || Math.abs(v) > h) return null;
        // 결 사이 갈라짐
        const nick = Math.abs(v) / h > 0.55 && Math.sin((u - Math.abs(v) * 0.9) * 1.25) > 0.88;
        if (nick) return null;
        return v > 0 ? 0.45 - (v / h) * 0.2 : -0.2 + (v / h) * 0.5;
      },
      p.P,
      {
        bev: 1.6,
        tex: (x, y, c) => {
          const [u, v] = ax.uv(x, y);
          const ph = (u - Math.abs(v) * 0.8) / 2.2;
          return ph - Math.floor(ph) < 0.18 ? mix(c, INK, 0.25) : c;
        },
      },
    );
    // 깃대
    A.paint(stroke([ax.at(0, 0), ax.at(34, 0)], 0.95, 0.4, 0.4), p.W, { sep: false, bev: 0 });
  },
  orb(A, p) {
    A.paint(ball(16, 17, 12.5), p.P, { bev: 0 });
    // 안쪽 소용돌이 빛
    A.paint(ring(16, 17, 7.5, 1.1, 7.5, -2.6, 0.2), p.L, { sep: false, bev: 0 });
    A.paint(oval(11.5, 11.5, 3.6, 2.4, 0.9, 0.2), p.L, { sep: false, bev: 0 });
    A.dot(10.5, 10.5, WHITE);
    A.dot(11.5, 10.5, WHITE, 0.6);
    A.spark(24.5, 7, p.hi);
  },
  claw(A, p) {
    // 발가락 마디 셋 (발톱 뿌리)
    A.paint(uni(oval(16, 26.5, 11.5, 3.6, -0.1, 0.5), ball(8.2, 24.5, 3.6), ball(16, 24, 3.8), ball(23.8, 24.5, 3.6)), p.D, { bev: 1.6 });
    // 발톱 셋 (휘어진 갈고리)
    for (const [x, lean] of [[8, -2], [16, 0], [24, 2]] as [number, number][]) {
      const pts = bez([x + lean * 0.5, 23], [x + lean - 3.5, 13], [x + lean + 1.5, 2.5]);
      A.paint(stroke(pts, 3, 0.5, 0.1), p.P, { bev: 1.6 });
      A.paint(stroke(pts.slice(3), 0.8, 0.3, 0.6), p.L, { sep: false, bev: 0 });
    }
  },
  tooth(A, p) {
    const crown = rrect(6, 4, 26, 17, 5, 0.3, 0.6);
    const roots = uni(stroke([[10.5, 14], [9.5, 23], [11, 28.5]], 3.6, 1.6, 0), stroke([[21.5, 14], [22.5, 23], [21, 28.5]], 3.6, 1.6, -0.2));
    A.paint(uni(crown, roots), p.P, { bev: 3 });
    // 씹는 면 홈
    A.line(16, 4.5, 16, 9, p.D.r[1], 0.8);
    A.paint(oval(10.5, 8, 2.4, 1.6, 0.9, 0.2), p.L, { sep: false, bev: 0 });
    A.dot(9.5, 7.5, WHITE);
  },
  chalice(A, p) {
    // 받침 → 대 → 잔
    A.paint(uni(oval(16, 27, 9, 2.8, -0.1), poly([[12, 27], [20, 27], [18, 24], [14, 24]], 0, 0.4)), p.D);
    A.paint(stroke([[16, 16], [16, 24.5]], 1.9, 1.5), p.P);
    A.paint(ball(16, 19.5, 3, 1.8), p.P, { bev: 0 });
    A.paint(
      (x, y) => {
        if (y < 5 || y > 17) return null;
        const k = (y - 5) / 12;
        const hw = 11.5 * Math.sqrt(Math.max(0, 1 - k * k * 0.95)) * (1 - k * 0.15);
        if (Math.abs(x - 16) > hw) return null;
        return 0.35 - ((x - 16) / hw) * 0.55 - k * 0.3;
      },
      p.P,
    );
    // 잔 입구 + 액체
    A.paint(oval(16, 5.8, 11, 2.4, -0.4, 0.2), p.D, { sep: false, bev: 0 });
    A.paint(oval(16, 6.4, 9, 1.6, 0.2, 0.6), mat(mix(p.c, [150, 10, 40], 0.5)), { sep: false, bev: 0 });
    // 보석 띠
    A.paint(ring(16, 9, 10.6, 0.6, 2.2, 0, Math.PI), p.L, { sep: false, bev: 0 });
    A.paint(poly([[16, 9.5], [18.2, 12], [16, 14.5], [13.8, 12]], 0.5, 0.9), p.L, { bev: 0 });
    A.dot(15.5, 11, WHITE);
    A.line(7.5, 8.5, 9.5, 14, p.L.r[4], 0.8);
  },
  cleaver(A, p) {
    // 손잡이
    A.paint(stroke([[13.5, 18], [13.5, 29]], 2.3), p.T);
    for (const y of [22, 25.5]) A.dot(13.5, y, p.T.r[4]);
    // 칼날
    A.paint(sub(poly([[3, 4], [25, 4], [28, 6.5], [27, 19], [3, 19]], 0.1, 0.7), ball(23.5, 8.5, 1.9)), p.M, {
      bev: 2,
      tex: (x, y, c) => (y > 15.8 ? mix(c, WHITE, 0.45) : x < 9 ? mix(c, p.c, 0.35) : c),
    });
    A.paint(rect(3, 4, 8, 19, 0.2, 0.5), p.P, { sep: true, bev: 1.4 });
    A.dot(5.5, 7.5, p.P.r[4]);
    A.dot(5.5, 15, p.P.r[4]);
    A.spark(26, 17.5, p.hi);
  },
  crown(A, p) {
    // 뾰족 셋 + 띠
    A.paint(poly([[4, 22], [3, 7.5], [10, 14], [16, 4.5], [22, 14], [29, 7.5], [28, 22]], 0.25, 0.7), p.P, { bev: 2.4 });
    for (const [x, y] of [[3.2, 6.5], [16, 3.5], [28.8, 6.5]] as Pt[]) A.paint(ball(x, y, 2.2), p.L, { bev: 0 });
    A.paint(rrect(3.5, 21, 28.5, 27, 1.2, -0.05, 0.5), p.D, { bev: 1.6 });
    // 보석
    A.paint(ball(16, 16.5, 3), p.W, { bev: 0 });
    A.paint(ball(9, 18, 1.8), p.L, { bev: 0 });
    A.paint(ball(23, 18, 1.8), p.L, { bev: 0 });
    for (const x of [7, 12, 16, 20, 25]) A.paint(ball(x, 24, 1), p.L, { sep: false, bev: 0 });
    A.spark(15, 15.5, p.hi);
  },
  bolt(A, p) {
    A.paint(poly([[19, 1.5], [8, 16.5], [15, 16.5], [10, 30.5], [25, 12.5], [17.5, 12.5], [23, 1.5]], 0.3, 0.9), p.P, { bev: 2.2 });
    A.paint(poly([[19.5, 3.5], [11.5, 15], [16.5, 15], [13.5, 25]], 0.9, 0), p.L, { sep: false, bev: 0 });
    for (const [x, y, a] of [[6, 9, 0.6], [26, 21, 0.6], [27.5, 5, 0.4], [5, 25, 0.35]]) A.glow(x, y, p.hi, a);
    A.spark(24.5, 12.5, p.hi);
  },
  drum(A, p) {
    // 몸통 (원통)
    A.paint(
      (x, y) => {
        const nx = (x - 16) / 12.5;
        if (Math.abs(nx) > 1 || y < 9) return null;
        if (y > 25.5 + 3.4 * Math.sqrt(1 - nx * nx)) return null;
        return -nx * 0.7 + 0.05;
      },
      p.P,
      { bev: 1.4 },
    );
    // 끈 (테 사이를 오가는 V)
    for (let i = 0; i < 5; i++) {
      const x0 = 5.5 + i * 4.2;
      A.line(x0, 11.5, x0 + 2.1, 25, p.W.r[3], 0.9);
      A.line(x0 + 2.1, 25, x0 + 4.2, 11.5, p.W.r[2], 0.9);
    }
    // 테 + 가죽 면
    A.paint(ring(16, 9.5, 12, 1.3, 3.6), p.D, { bev: 0 });
    A.paint(oval(16, 9.5, 10.8, 2.6, 0.5, 0.6), p.W, { sep: false, bev: 0 });
    A.paint(ring(16, 25.5, 12, 1.2, 3.6, 0, Math.PI), p.D, { bev: 0, sep: false });
    for (let i = 0; i < 6; i++) {
      const x = 5.5 + i * 4.2;
      A.paint(ball(x, 9.5 + Math.sqrt(Math.max(0, 1 - ((x - 16) / 12) ** 2)) * 3.6, 0.8), p.W, { sep: false, bev: 0 });
    }
    A.dot(10, 8.6, WHITE, 0.8);
  },
  cloak(A, p) {
    // 망토 (위 두건 → 아래로 넓어지는 자락, 들쭉날쭉한 끝단)
    A.paint(
      (x, y) => {
        if (y < 2.5 || y > 29.5) return null;
        const k = (y - 2.5) / 27;
        const hw = k < 0.25 ? 6.5 * Math.sqrt(k / 0.25) + 0.5 : 7 + (k - 0.25) * 10.5;
        if (Math.abs(x - 16) > hw) return null;
        const hem = 27 + Math.abs(Math.sin((x - 16) * 0.75)) * 2.5;
        if (y > hem) return null;
        // 주름
        const fold = Math.sin((x - 16) * 0.9 + y * 0.05);
        return 0.15 - ((x - 16) / hw) * 0.4 + fold * 0.25 * k - k * 0.2;
      },
      p.P,
      { bev: 2.2 },
    );
    // 두건 안쪽 그늘
    A.paint(oval(16, 10.5, 3.8, 4.6, -0.9, 0.2), p.D, { sep: false, bev: 0 });
    A.paint(ball(16, 15.5, 1.8), p.L, { bev: 0 });
    for (const x of [11, 16, 21]) A.line(x, 18, x + (x - 16) * 0.35, 27.5, p.D.r[0], 0.55);
  },
  eye(A, p) {
    // 눈꺼풀 (아몬드)
    const almond = (x: number, y: number): number | null => {
      const nx = (x - 16) / 14.5;
      const hw = 8.5 * (1 - nx * nx);
      if (Math.abs(nx) > 1 || Math.abs(y - 16) > hw) return null;
      return 0.3 - (y - 16) / Math.max(1, hw) * 0.5;
    };
    A.paint(almond, p.D, { bev: 1.6 });
    A.paint((x, y) => {
      const nx = (x - 16) / 12.5;
      const hw = 6.6 * (1 - nx * nx);
      if (Math.abs(nx) > 1 || Math.abs(y - 16) > hw) return null;
      return 0.5 - (y - 16) / Math.max(1, hw) * 0.4;
    }, p.W, { bev: 1.2 });
    A.paint(sub(ball(16, 16, 6.2), (x, y) => (Math.abs(y - 16) > 6.6 * (1 - ((x - 16) / 12.5) ** 2) ? 0 : null)), p.P, { bev: 0 });
    A.paint(oval(16, 16, 1.6, 4.4, -0.8, 0), p.K, { sep: false, bev: 0 });
    A.paint(ball(13.6, 13.4, 1.4), p.W, { sep: false, bev: 0 });
    A.dot(13.2, 13, WHITE);
    for (const [x0, x1] of [[6, 4], [11, 10], [21, 22], [26, 28]]) A.line(x0, 9.5 - Math.abs(x0 - 16) * -0.05, x1, 5.5, p.D.r[1], 1);
  },
  pouch(A, p) {
    // 자루 몸통
    A.paint(uni(ball(16, 20.5, 11, 9), poly([[12, 12.5], [20, 12.5], [24, 16], [8, 16]], 0.3)), p.P, { bev: 2.6 });
    // 묶은 윗단 (오므린 천: 위로 벌어지고 둥근 주름)
    A.paint(
      (x, y) => {
        if (y < 4 || y > 12) return null;
        const k = (y - 4) / 8;
        const hw = 7 - k * 3;
        if (Math.abs(x - 16) > hw) return null;
        if (y < 4 + Math.sin((x - 16) * 0.75) ** 2 * 1.6) return null;
        return 0.45 - ((x - 16) / hw) * 0.4 + Math.cos((x - 16) * 1.5) * 0.25;
      },
      p.P,
      { bev: 1.2 },
    );
    A.paint(rrect(11, 10.5, 21, 13.5, 1.4, 0.1, 0.4), p.D, { bev: 1 });
    // 끈 매듭 + 늘어진 끈
    A.paint(stroke([[19, 12.5], [22.5, 15], [23, 19]], 0.85), p.W, { bev: 0 });
    A.paint(ball(19.5, 12, 1.6), p.W, { bev: 0 });
    // 무늬 (동전 표시)
    A.paint(ring(16, 21.5, 3.2, 0.9), p.L, { sep: false, bev: 0 });
    A.dot(11, 17, WHITE, 0.8);
  },
  mask(A, p) {
    // 끈
    A.paint(uni(stroke([[4, 12.5], [1.5, 14], [2, 18]], 0.9), stroke([[28, 12.5], [30.5, 14], [30, 18]], 0.9)), p.D, { bev: 0 });
    A.paint(
      (x, y) => {
        if (y < 3.5 || y > 29) return null;
        const k = (y - 3.5) / 25.5;
        const hw = k < 0.45 ? 12.5 * Math.sqrt(1 - ((0.45 - k) / 0.45) ** 2 * 0.75) : 12.5 * (1 - ((k - 0.45) / 0.55) ** 1.6 * 0.72);
        if (Math.abs(x - 16) > hw) return null;
        const nx = (x - 16) / hw;
        return 0.35 - nx * 0.45 - k * 0.45 + (1 - nx * nx) * 0.2;
      },
      p.P,
      { bev: 2.6 },
    );
    // 이마 무늬
    A.paint(poly([[16, 5.5], [18, 9], [16, 11.5], [14, 9]], 0.8, 0.3), p.L, { sep: false, bev: 0 });
    // 눈 (치켜뜬)
    A.paint(poly([[7, 13], [14, 15], [13, 18.5], [8, 17.5]], -0.6, 0.3), p.K, { sep: false, bev: 0 });
    A.paint(poly([[25, 13], [18, 15], [19, 18.5], [24, 17.5]], -0.6, 0.3), p.K, { sep: false, bev: 0 });
    A.glow(10.5, 16, p.hi, 0.9);
    A.glow(21.5, 16, p.hi, 0.9);
    // 입
    A.paint(poly([[12, 23], [20, 23], [18.5, 25], [13.5, 25]], -0.5, 0.2), p.D, { sep: false, bev: 0 });
    A.line(9, 21, 6.5, 13.5, p.D.r[1], 0.5);
  },
  twin(A, p) {
    // 두 형상: 빛(앞, 본색) · 그림자(뒤, 어두운 색)
    const fig = (cx: number, m: Mat, dk: number): void => {
      A.paint(uni(ball(cx, 8.5, 4.6), poly([[cx - 5.5, 28.5], [cx - 4, 14.5], [cx + 4, 14.5], [cx + 5.5, 28.5]], 0.1 + dk, 0.6)), m, { bev: 2 });
      A.paint(oval(cx - 1.8, 8.5, 0.9, 1.3, -0.8, 0), p.K, { sep: false, bev: 0 });
      A.paint(oval(cx + 1.8, 8.5, 0.9, 1.3, -0.8, 0), p.K, { sep: false, bev: 0 });
    };
    fig(21.5, p.D, -0.1);
    fig(10.5, p.P, 0.1);
    A.spark(26.5, 4, p.hi);
  },
  dagger(A, p) {
    const ax = axis(5, 27, 45);
    A.paint(stroke([ax.at(0.5, 0), ax.at(7.5, 0)], 2), p.T, { tex: (x, y, c) => (((ax.uv(x, y)[0] / 2) % 1) < 0.35 ? mix(c, INK, 0.4) : c) });
    A.paint(ball(...ax.at(0, 0), 2.4), p.P);
    A.paint(apoly(ax, [[7.5, -6.2], [10, -6.2], [10, 6.2], [7.5, 6.2]], 0.2, 0.5), p.P, { bev: 1.2 });
    A.paint(blade(ax, 10, 30, (u) => (u > 22 ? 3.3 * (30 - u) / 8 : 3.3 - (u - 10) * 0.02)), p.M, { bev: 0 });
    A.paint(ball(...ax.at(8.75, 0), 1.5), p.L, { bev: 0, sep: false });
    A.spark(...ax.at(26, 1.5), p.hi);
  },
  lantern(A, p) {
    // 손잡이 고리
    A.paint(ring(16, 5.5, 3.6, 1, 3.4, -Math.PI, 0.05), p.D, { bev: 0 });
    // 뚜껑
    A.paint(poly([[16, 4.5], [24, 10.5], [8, 10.5]], 0.3, 0.7), p.P, { bev: 1.8 });
    // 유리 (빛나는)
    A.paint(rect(9.5, 10.5, 22.5, 25, 0.6, 0.6), p.L, { bev: 1.6 });
    A.paint(flameT(16, 13, 22.5, 3, 0.4), mat(mix(p.hi, [255, 240, 200], 0.4), { hi: WHITE }), { sep: false, bev: 0 });
    A.glow(16, 20.5, WHITE, 0.9);
    // 틀
    for (const x of [9.8, 22.2]) A.paint(rect(x - 1.4, 10.5, x + 1.4, 25), p.P, { bev: 0 });
    A.paint(rect(15.2, 10.5, 16.8, 13), p.P, { bev: 0 });
    A.paint(rrect(7, 24.5, 25, 28.5, 1, -0.1, 0.5), p.D, { bev: 1.2 });
    for (const [x, y, a] of [[5, 15, 0.5], [27, 18, 0.5], [4.5, 21.5, 0.3], [27.5, 12, 0.3]]) A.glow(x, y, p.hi, a);
  },
  shield(A, p) {
    const shp = (inset: number): Test => (x, y) => {
      const top = 3.5 + inset;
      if (y < top) return null;
      const k = (y - 3.5) / 26;
      const hw = (k < 0.45 ? 12.5 : 12.5 * Math.sqrt(Math.max(0, 1 - ((k - 0.45) / 0.55) ** 2))) - inset;
      if (hw <= 0 || Math.abs(x - 16) > hw) return null;
      return 0.3 - ((x - 16) / Math.max(1, hw)) * 0.5 - k * 0.4;
    };
    A.paint(shp(0), p.D, { bev: 1.6 });
    A.paint(shp(2.6), p.P, { bev: 2.6 });
    // 가운데 문장 (십자)
    A.paint(uni(rect(14.3, 8, 17.7, 24), rect(9.5, 12.5, 22.5, 15.5)), p.L, { bev: 1.2 });
    A.paint(ball(16, 14, 2.2), p.W, { bev: 0 });
    for (const [x, y] of [[6.5, 7], [25.5, 7], [16, 27]] as Pt[]) A.paint(ball(x, y, 0.9), p.W, { sep: false, bev: 0 });
  },
  bone(A, p) {
    const bn = (a: Pt, b: Pt): Test => {
      const dx = (b[0] - a[0]) * 0.07;
      const dy = (b[1] - a[1]) * 0.07;
      const px = -dy * 0.65;
      const py = dx * 0.65;
      return uni(
        ball(a[0] + px, a[1] + py, 3.1),
        ball(a[0] - px, a[1] - py, 3.1),
        ball(b[0] + px, b[1] + py, 3.1),
        ball(b[0] - px, b[1] - py, 3.1),
        stroke([a, b], 2.1, 2.1, 0.1),
      );
    };
    const bm = mat(mix(p.c, [255, 250, 235], 0.35), { hi: WHITE });
    A.paint(bn([6.5, 25.5], [25.5, 6.5]), mat(mix(p.c, [150, 130, 110], 0.4)), { bev: 1.4 });
    A.paint(bn([6.5, 6.5], [25.5, 25.5]), bm, { bev: 1.4 });
  },
  fist(A, p) {
    // 손목
    A.paint(rrect(10, 22, 22, 30, 1.5, -0.2, 0.4), p.D, { bev: 1.6 });
    // 주먹 몸
    A.paint(rrect(6.5, 8, 26, 24, 5, 0.1, 0.7), p.P, { bev: 2.6 });
    // 손가락 마디 넷
    for (let i = 0; i < 4; i++) A.paint(ball(9.4 + i * 4.4, 9.5, 2.9, 3.2), p.P, { bev: 0 });
    for (let i = 1; i < 4; i++) A.line(7.2 + i * 4.4, 8, 7.2 + i * 4.4, 15, p.D.r[0], 0.9);
    // 엄지
    A.paint(stroke([[7.5, 18], [19, 17]], 2.6, 2.3, 0.2), p.P, { bev: 1.2 });
    A.paint(ring(16, 22.5, 6, 0.6, 1.2, 0, Math.PI), p.D, { sep: false, bev: 0 });
    A.dot(8.5, 7.5, WHITE, 0.6);
  },
  shard(A, p) {
    const pts: Pt[] = [[16, 1.5], [22.5, 12], [20, 27], [16, 30.5], [10.5, 22], [10, 9]];
    // 면마다 다른 밝기
    A.paint(poly([pts[0], pts[1], [16.5, 15]], 0.1, 0.4), p.P, { bev: 0 });
    A.paint(poly([[16.5, 15], pts[1], pts[2], pts[3]], -0.55, 0.3), p.P, { bev: 0, sep: false });
    A.paint(poly([pts[0], [16.5, 15], pts[3], pts[4], pts[5]], 0.6, 0.5), p.P, { bev: 0, sep: false });
    A.paint(poly([pts[5], pts[4], [13, 14]], 0.95, 0.2), p.L, { bev: 0, sep: false });
    A.line(16, 2.5, 16.5, 15, p.L.r[4], 0.8);
    A.line(16.5, 15, 16, 29.5, p.P.r[1], 0.6);
    A.spark(12, 7, p.hi);
    A.glow(25, 22, p.hi, 0.5);
    A.glow(6.5, 26, p.hi, 0.35);
  },
  bell(A, p) {
    // 꼭지 고리
    A.paint(ring(16, 4.5, 2.6, 1, 2.4, -Math.PI, 0.1), p.D, { bev: 0 });
    // 종 몸통
    A.paint(
      (x, y) => {
        if (y < 5.5 || y > 24) return null;
        const k = (y - 5.5) / 18.5;
        const hw = 5 + 3.8 * Math.sqrt(k) + (k > 0.7 ? ((k - 0.7) / 0.3) ** 2 * 5 : 0);
        if (Math.abs(x - 16) > hw) return null;
        return 0.35 - ((x - 16) / hw) * 0.65 - k * 0.15;
      },
      p.P,
      { bev: 1.4 },
    );
    A.paint(oval(16, 6.8, 5.2, 2, 0.3), p.P, { sep: false });
    // 아래 테
    A.paint(oval(16, 24, 14, 2.6, 0, 0.5), p.D);
    A.paint(ring(16, 15.5, 7.6, 0.7, 1.4, 0, Math.PI), p.D, { sep: false, bev: 0 });
    // 추
    A.paint(ball(16, 27.5, 2.6), p.L);
    A.line(12, 9, 10, 20, p.L.r[4], 0.8);
    A.glow(4, 14, p.hi, 0.5);
    A.glow(28, 14, p.hi, 0.5);
    A.glow(2.5, 18, p.hi, 0.3);
  },
  horn(A, p) {
    const pts = bez([6, 24], [11, 8], [28, 3.5], 18);
    A.paint(stroke(pts, 6.2, 0.6, 0.15), p.P, {
      bev: 2,
      tex: (x, y, c) => {
        // 고리 무늬
        let best = 0;
        let bd = Infinity;
        pts.forEach((q, i) => {
          const d = (q[0] - x) ** 2 + (q[1] - y) ** 2;
          if (d < bd) {
            bd = d;
            best = i;
          }
        });
        return best < 12 && best % 3 === 1 ? mix(c, INK, 0.3) : c;
      },
    });
    // 입구 (넓은 끝)
    A.paint(oval(6, 25.5, 5.8, 4, -0.4, 0.4), p.D, { bev: 0 });
    A.paint(oval(6, 25.5, 3.6, 2.3, -0.9, 0), p.K, { sep: false, bev: 0 });
    A.dot(9, 13, WHITE, 0.6);
  },
  drop(A, p) {
    A.paint(dropT(16, 2, 29, 9.5), p.P, { bev: 2.6 });
    A.paint(oval(12, 19.5, 2, 3.4, 0.9, 0.1), p.L, { sep: false, bev: 0 });
    A.dot(11.5, 17.5, WHITE);
    A.dot(11.5, 18.5, WHITE, 0.6);
  },
  paint(A, p) {
    // 위: 물감으로 그은 굵은 자국
    A.paint(stroke(bez([3.5, 9], [12, 2.5], [22, 6.5]), 2.8, 1.2, 0.2), p.P, { bev: 1.4 });
    A.paint(stroke(bez([5, 15], [11, 11], [17, 12.5]), 2.2, 0.9, 0.2), p.P, { bev: 1.2 });
    A.paint(ball(5.5, 17.2, 1.1, 1.7), p.P, { bev: 0 });
    // 붓 (사발에 꽂힌)
    A.paint(stroke([[17, 22], [27, 6]], 1.3), p.T, { bev: 0 });
    A.paint(stroke([[25.4, 8.5], [27.5, 5.2]], 1.6), p.M, { bev: 0 });
    A.paint(stroke([[27.3, 5.4], [29.3, 2.2]], 1.9, 0.6), p.P, { bev: 0 });
    // 물감 사발
    A.paint(
      (x, y) => {
        if (y < 20 || y > 30) return null;
        const hw = 12 * Math.sqrt(Math.max(0, 1 - ((y - 20) / 10) ** 2));
        if (Math.abs(x - 15) > hw) return null;
        return 0.1 - ((x - 15) / Math.max(1, hw)) * 0.6 - (y - 20) / 20;
      },
      p.T,
      { bev: 1.4 },
    );
    A.paint(oval(15, 20.5, 12, 2.8, -0.2, 0.3), p.T, { sep: false, bev: 0 });
    A.paint(oval(15, 20.8, 10, 1.8, 0.5, 0.6), p.P, { sep: false, bev: 0 });
    A.dot(10, 20.3, WHITE, 0.8);
    A.line(6, 25, 9, 28, p.T.r[4], 0.5);
  },
  belt(A, p) {
    // 띠
    A.paint(rrect(1.5, 10, 30.5, 21, 1.5, 0.05, 0.4), p.P, {
      bev: 1.8,
      tex: (x, y, c) => ((y > 11.6 && y < 12.6) || (y > 18.4 && y < 19.4)) && Math.floor(x / 1.6) % 2 === 0 ? mix(c, WHITE, 0.25) : c,
    });
    // 구멍
    for (const x of [24, 27.5]) A.paint(ball(x, 15.5, 1), p.K, { sep: false, bev: 0 });
    // 버클 (네모 고리)
    A.paint(sub(rrect(9, 7.5, 19.5, 23.5, 1.6, 0.3, 0.7), rect(11.6, 10.2, 16.9, 20.8)), p.M, { bev: 1.4 });
    A.paint(rect(13.2, 13.8, 21.5, 17.2, 0.2, 0.4), p.M, { bev: 0 });
    A.dot(10, 8.5, WHITE);
  },
  hood(A, p) {
    // 두건 + 어깨
    A.paint(uni(ball(16, 13, 11.5, 11), poly([[1.5, 29.5], [5, 20], [27, 20], [30.5, 29.5]], -0.1, 0.5)), p.P, { bev: 2.6 });
    // 얼굴 그늘
    A.paint(
      (x, y) => {
        if (y < 8.5 || y > 25) return null;
        const k = (y - 8.5) / 16.5;
        const hw = 7.4 * Math.sqrt(Math.min(1, k * 1.8)) * (1 - k * 0.25);
        return Math.abs(x - 16) <= hw ? -0.85 + (1 - k) * 0.2 : null;
      },
      p.K,
      { sep: false, bev: 0 },
    );
    // 빛나는 눈
    for (const x of [12.8, 19.2]) {
      A.paint(oval(x, 15.5, 1.6, 1, 0.8, 0), p.L, { sep: false, bev: 0 });
      A.glow(x, 15.5, WHITE, 0.7);
      A.glow(x, 17, p.hi, 0.35);
    }
    A.line(16, 2.5, 16, 7, p.D.r[1], 0.6);
    A.line(8, 22, 5.5, 28.5, p.D.r[1], 0.6);
    A.line(24, 22, 26.5, 28.5, p.D.r[0], 0.6);
  },
  baton(A, p) {
    const a: Pt = [5, 27];
    const b: Pt = [25, 7];
    shaft(A, a, b, 2.4, p.P, p.D, 3);
    A.paint(stroke([[3.5, 28.5], [8, 24]], 2.8), p.D, { bev: 1.2 });
    A.paint(ball(26, 6, 3.2), p.W, { bev: 0 });
    A.spark(26.5, 5.5, p.hi, true);
  },
  potion(A, p) {
    // 코르크 → 목 → 둥근 병
    A.paint(rrect(12.5, 1.5, 19.5, 6.5, 1.2, 0.2, 0.5), p.T, { bev: 1.2 });
    A.paint(rect(12, 6, 20, 12.5, 0.2, 0.4), p.W, { bev: 1.4 });
    A.paint(ball(16, 20.5, 10), p.P, { bev: 0 });
    A.paint(rrect(10.5, 5.5, 21.5, 7.8, 1, 0.3, 0.3), p.W, { bev: 0 });
    // 액체 표면·거품·유리 반사
    A.paint(oval(16, 14.5, 7.2, 1.4, 0.7, 0.3), p.L, { sep: false, bev: 0 });
    A.paint(oval(11.5, 18, 2, 3.2, 0.95, 0), p.L, { sep: false, bev: 0 });
    A.dot(11, 17, WHITE);
    for (const [x, y] of [[19, 21], [17.5, 25], [21, 18]] as Pt[]) A.dot(x, y, p.L.r[4], 0.8);
  },
  coin(A, p) {
    // 옆 두께
    A.paint(oval(17, 17.5, 12, 12.5, -0.6, 0.3), p.D, { bev: 0 });
    A.paint(ball(15.5, 16, 12, 12.5, 0.8), p.P, { bev: 0 });
    A.paint(ring(15.5, 16, 9, 0.9), p.D, { sep: false, bev: 0 });
    // 별 문양 (돋을새김)
    A.paint(poly(starPts(15.5, 16.3, 6, 2.6), 0.4, 0.9), p.L, { bev: 1 });
    A.spark(9, 7.5, p.hi);
    A.dot(8, 10, WHITE, 0.7);
  },
  jar(A, p) {
    // 뚜껑 + 손잡이
    A.paint(ball(16, 3.6, 2.2), p.D);
    A.paint(rrect(9.5, 5, 22.5, 8.5, 1.2, 0.2, 0.5), p.D, { bev: 1.2 });
    A.paint(rect(11.5, 8, 20.5, 11, 0.1, 0.3), p.P, { bev: 0 });
    // 몸통 (둥근 항아리)
    A.paint(
      (x, y) => {
        if (y < 10.5 || y > 29) return null;
        const k = (y - 10.5) / 18.5;
        const hw = 6 + 7.5 * Math.sin(Math.min(1, k * 1.15) * Math.PI * 0.82) - (k > 0.85 ? (k - 0.85) * 12 : 0);
        if (Math.abs(x - 16) > hw) return null;
        return 0.3 - ((x - 16) / hw) * 0.7 - k * 0.2;
      },
      p.P,
      { bev: 1.4 },
    );
    // 부적
    A.paint(rrect(13.5, 15, 18.5, 22.5, 0.6, 0.6, 0.4), p.W, { bev: 0 });
    A.line(16, 16.5, 16, 21, p.c, 0.9);
    A.line(14.6, 18.2, 17.4, 18.2, p.c, 0.9);
    A.line(7, 17, 7.5, 23, WHITE, 0.6);
  },
  book(A, p) {
    // 표지 (펼친 책)
    A.paint(poly([[1.5, 7], [16, 9.5], [30.5, 7], [30.5, 26], [16, 28.5], [1.5, 26]], -0.1, 0.4), p.D, { bev: 1.2 });
    // 두 쪽
    A.paint(poly([[3, 4.5], [15.2, 7], [15.2, 26.5], [3, 24]], 0.5, 0.5), p.W, { bev: 1.2 });
    A.paint(poly([[16.8, 7], [29, 4.5], [29, 24], [16.8, 26.5]], 0.05, 0.5), p.W, { bev: 1.2 });
    // 글줄
    for (let i = 0; i < 5; i++) {
      const y = 9 + i * 3;
      A.line(5, y, 13.5, y + 1.7, mix(p.c, INK, 0.3), 0.7, 4);
      A.line(18.5, y + 1.7, 27, y, mix(p.c, INK, 0.3), 0.7, 4);
    }
    // 빛나는 마법진
    A.paint(ring(22.8, 15.5, 3.2, 0.6), p.P, { sep: false, bev: 0 });
    A.glow(22.8, 15.5, p.hi, 0.9);
    A.line(16, 7.5, 16, 27.5, p.D.r[0]);
    A.spark(26, 3, p.hi);
  },
  chain(A, p) {
    // 사슬 고리 (기울어진 타원, 번갈아 앞뒤)
    const ax = axis(5, 27, 45);
    for (let i = 0; i < 3; i++) {
      const [cx, cy] = ax.at(4 + i * 10, 0);
      const flat = i % 2 === 1;
      A.paint(
        (x, y) => {
          const [u, v] = ax.uv(x, y);
          const [cu] = ax.uv(cx, cy);
          const du = (u - cu) / 6.4;
          const dv = v / (flat ? 2.2 : 4.4);
          const d = Math.hypot(du, dv);
          const w = flat ? 0.55 : 0.36;
          if (Math.abs(d - (1 - w / 2)) > w / 2 + 0.06) return null;
          const nx = (x - cx) / 6;
          const ny = (y - cy) / 6;
          return (d < 1 - w / 2 ? 1 : -1) * (nx * LX + ny * LY) * 0.8 + 0.2;
        },
        flat ? mat(mix(p.c, INK, 0.2)) : p.P,
        { bev: 0 },
      );
    }
    A.spark(9, 19.5, p.hi);
  },
  hourglass(A, p) {
    A.paint(rrect(4, 2, 28, 5.5, 1.2, 0.3, 0.5), p.D, { bev: 1.2 });
    A.paint(rrect(4, 26, 28, 29.5, 1.2, -0.1, 0.5), p.D, { bev: 1.2 });
    // 유리
    const glass = (x: number, y: number): number | null => {
      if (y < 5.5 || y > 26) return null;
      const k = Math.abs(y - 15.75) / 10.25;
      const hw = 1.4 + 9 * Math.pow(k, 0.85);
      if (Math.abs(x - 16) > hw) return null;
      return 0.55 - ((x - 16) / hw) * 0.5;
    };
    A.paint(glass, p.W, { bev: 1 });
    // 모래
    A.paint(clip(glass, (x, y) => y > 9 && y < 15), p.P, { sep: false, bev: 0 });
    A.paint(clip(glass, (x, y) => y > 26 - (9 - Math.abs(x - 16)) * 0.8), p.P, { sep: false, bev: 0 });
    A.line(16, 15, 16, 25, p.P.r[3]);
    // 기둥
    for (const x of [5.5, 26.5]) A.paint(stroke([[x, 5], [x, 26.5]], 1.1), p.D, { bev: 0 });
    A.line(11, 8, 13.5, 12.5, WHITE, 0.8);
  },
  flask(A, p) {
    A.paint(rrect(13, 1.5, 19, 5, 1, 0.2, 0.5), p.T, { bev: 1 });
    // 원뿔 플라스크 유리
    const body = (x: number, y: number): number | null => {
      if (y < 4.5 || y > 29.5) return null;
      const hw = y < 12 ? 3.2 : 3.2 + (y - 12) * 0.62;
      const bot = 29.5 - Math.max(0, Math.abs(x - 16) - 9.5) * 1.2;
      if (Math.abs(x - 16) > Math.min(hw, 13) || y > bot) return null;
      return 0.5 - ((x - 16) / Math.max(1, hw)) * 0.5;
    };
    A.paint(body, p.W, { bev: 1.2 });
    // 액체
    A.paint(clip(body, (x, y) => y > 18 + Math.sin(x * 0.9) * 0.5), p.P, { sep: false, bev: 1.4 });
    A.paint(oval(16, 18.4, 7.5, 0.9, 0.9, 0), p.L, { sep: false, bev: 0 });
    for (const [x, y] of [[14, 22], [18.5, 25], [16.5, 20.5]] as Pt[]) A.dot(x, y, p.L.r[4]);
    A.line(13.8, 7, 13.8, 12, WHITE, 0.7);
    for (const [x, y, a] of [[21, 3, 0.6], [23.5, 7, 0.4], [9.5, 6, 0.35]]) A.glow(x, y, p.hi, a);
  },
  ring(A, p) {
    // 띠
    A.paint(ring(16, 20, 10, 2.4, 8.5), p.P, { bev: 0 });
    // 받침 + 보석
    A.paint(poly([[11, 12], [21, 12], [19, 15], [13, 15]], 0.1, 0.5), p.D, { bev: 1 });
    A.paint(poly([[11, 7.5], [16, 3], [21, 7.5], [16, 13]], 0.3, 0.9), p.W, { bev: 1 });
    A.paint(poly([[11, 7.5], [16, 3], [16, 7.5]], 0.95, 0), p.W, { sep: false, bev: 0 });
    A.paint(poly([[16, 7.5], [21, 7.5], [16, 13]], -0.5, 0.2), p.L, { sep: false, bev: 0 });
    A.spark(13, 5, p.hi, true);
  },
  gem(A, p) {
    const top = 7;
    const mid = 13;
    // 윗면(테이블)·윗경사·아랫경사 면
    A.paint(poly([[9.5, top], [22.5, top], [29.5, mid], [2.5, mid]], 0.2, 0.4), p.P, { bev: 0 });
    A.paint(poly([[12, top], [20, top], [18.5, mid], [13.5, mid]], 0.95, 0.2), p.L, { bev: 0, sep: false });
    A.paint(poly([[2.5, mid], [13.5, mid], [16, 29]], 0.45, 0.3), p.P, { bev: 0 });
    A.paint(poly([[13.5, mid], [18.5, mid], [16, 29]], 0.05, 0.3), p.P, { bev: 0, sep: false });
    A.paint(poly([[18.5, mid], [29.5, mid], [16, 29]], -0.6, 0.3), p.P, { bev: 0, sep: false });
    A.line(3.5, 12.6, 28.5, 12.6, p.L.r[4], 0.5);
    A.spark(9.5, 9.5, p.hi, true);
    A.glow(26, 4, p.hi, 0.5);
  },
  snow(A, p) {
    // 6갈래 눈꽃
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3 - Math.PI / 2;
      const cx = 16;
      const cy = 16;
      const tip: Pt = [cx + Math.cos(a) * 13.5, cy + Math.sin(a) * 13.5];
      A.paint(stroke([[cx, cy], tip], 1.6, 1, 0.3), p.P, { bev: 0, sep: false });
      for (const s of [-1, 1]) {
        const bx = cx + Math.cos(a) * 8;
        const by = cy + Math.sin(a) * 8;
        const ba = a + s * 0.85;
        A.paint(stroke([[bx, by], [bx + Math.cos(ba) * 4.6, by + Math.sin(ba) * 4.6]], 1.1, 0.8, 0.3), p.P, { bev: 0, sep: false });
      }
    }
    A.paint(poly(starPts(16, 16, 4.2, 2.4, 6, -Math.PI / 2), 0.7, 0.8), p.L, { bev: 0, sep: false });
    A.glow(16, 16, WHITE, 0.9);
    A.spark(16, 2.8, p.hi);
  },
  dice(A, p) {
    // 정육면체 (윗면 밝게, 왼면 본색, 오른면 어둡게)
    const T: Pt = [16, 2.5];
    const L: Pt = [3.5, 9];
    const R: Pt = [28.5, 9];
    const C: Pt = [16, 15.5];
    const LB: Pt = [3.5, 23.5];
    const RB: Pt = [28.5, 23.5];
    const B: Pt = [16, 30];
    A.paint(poly([T, R, C, L], 0.85, 0.3), p.P, { bev: 0 });
    A.paint(poly([L, C, B, LB], 0.1, 0.4), p.P, { bev: 0, sep: false });
    A.paint(poly([C, R, RB, B], -0.6, 0.3), p.P, { bev: 0, sep: false });
    const pip = mix(p.c, INK, 0.8);
    const pipAt = (x: number, y: number, rx: number, ry: number): void => A.paint(oval(x, y, rx, ry, -0.8, 0), mat(pip), { sep: false, bev: 0 });
    pipAt(16, 9, 2, 1.1);
    pipAt(7.5, 14, 1.2, 1.6);
    pipAt(12, 24, 1.2, 1.6);
    pipAt(9.8, 19, 1.2, 1.6);
    pipAt(20, 18.5, 1.2, 1.6);
    pipAt(24.5, 15.5, 1.2, 1.6);
    pipAt(22.2, 24.5, 1.2, 1.6);
    A.line(16, 15.5, 16, 29.5, p.P.r[4], 0.4);
  },
  idol(A, p) {
    // 받침
    A.paint(rrect(6, 25, 26, 30, 1, -0.1, 0.4), p.D, { bev: 1.2 });
    // 몸 (앉은 형상)
    A.paint(poly([[16, 11], [24.5, 16], [25, 25.5], [7, 25.5], [7.5, 16]], 0.1, 0.6), p.P, { bev: 2.6 });
    // 팔 (모은 손)
    A.paint(stroke([[9.5, 17], [13, 21.5], [19, 21.5], [22.5, 17]], 1.6), p.P, { bev: 0 });
    A.paint(ball(16, 21.5, 2), p.L, { bev: 0 });
    // 머리 + 관
    A.paint(ball(16, 8.5, 5.6), p.P);
    A.paint(poly([[10.5, 5], [11.3, 1.2], [13.6, 3.2], [16, 0.4], [18.4, 3.2], [20.7, 1.2], [21.5, 5]], 0.6, 0.4), p.L, { bev: 0 });
    A.paint(rect(13, 7.6, 15, 9.4, -0.8, 0), p.K, { sep: false, bev: 0 });
    A.paint(rect(17, 7.6, 19, 9.4, -0.8, 0), p.K, { sep: false, bev: 0 });
    A.glow(14, 8.5, p.hi, 0.8);
    A.glow(18, 8.5, p.hi, 0.8);
    A.spark(5, 6, p.hi);
  },
  skull(A, p) {
    skullDraw(A, p, p.P);
  },
  flame(A, p) {
    A.paint(uni(flameT(16, 1, 30, 11, 3), flameT(24, 9, 25, 3.2, 2.5), flameT(8, 12, 26, 3, -2.5)), p.P, { bev: 2.2 });
    A.paint(flameT(16, 9, 29, 7, 1.5), p.L, { sep: false, bev: 0 });
    A.paint(flameT(15.5, 17, 28, 3.6, 0.8), mat(mix(p.hi, [255, 250, 220], 0.6), { hi: WHITE }), { sep: false, bev: 0 });
    for (const [x, y, a] of [[24, 4, 0.8], [7, 6, 0.55], [27.5, 12, 0.4], [10, 2, 0.35]]) A.glow(x, y, p.hi, a);
  },
  fang(A, p) {
    // 위턱 (휘어진 잇몸 띠)
    const gum = (x: number, y: number): number | null => {
      const dx = (x - 16) / 14.5;
      if (Math.abs(dx) > 1) return null;
      const top = 3 + (1 - dx * dx) * 5;
      const bot = top + 6 - dx * dx * 2;
      if (y < top || y > bot) return null;
      return 0.4 - (y - top) / 7 - dx * 0.2;
    };
    A.paint(gum, p.P, { bev: 1.6 });
    const tooth = mat(mix(p.c, [250, 244, 230], 0.78), { hi: WHITE });
    const gy = (x: number): number => 3 + (1 - ((x - 16) / 14.5) ** 2) * 5 + 6 - ((x - 16) / 14.5) ** 2 * 2 - 0.8;
    // 작은 이빨
    for (const x of [4.5, 8, 14, 18, 24, 27.5]) A.paint(poly([[x - 1.6, gy(x)], [x + 1.6, gy(x)], [x, gy(x) + 4.5]], 0.3, 0.4), tooth, { bev: 0 });
    // 큰 송곳니 둘 (살짝 휘어짐)
    for (const s of [-1, 1]) {
      const x = 16 + s * 6.6;
      const y0 = gy(x);
      A.paint(stroke(bez([x, y0], [x + s * 0.4, y0 + 9], [x - s * 1.2, 29.5], 10), 2.9, 0.5, 0.25 - s * 0.25), tooth, { bev: 1.2 });
      A.line(x - 1.2, y0 + 2, x - 1, y0 + 9, WHITE, 0.7);
    }
  },
  wing(A, p) {
    const feather = (a: Pt, len: number, ang: number, m: Mat, w = 2.5): void => {
      const ax = axis(a[0], a[1], ang);
      A.paint(
        (x, y) => {
          const [u, v] = ax.uv(x, y);
          if (u < -1 || u > len) return null;
          const hw = w * Math.min(1, (len - u) / 3.2) * Math.min(1, (u + 1) / 2) + 0.3;
          if (Math.abs(v) > hw) return null;
          return 0.2 + (v / hw) * 0.45 - (u / len) * 0.3;
        },
        m,
        { bev: 1 },
      );
    };
    const shoulder: Pt = [4, 27];
    const wrist: Pt = [13, 9];
    const lerp = (t: number): Pt => [shoulder[0] + (wrist[0] - shoulder[0]) * t, shoulder[1] + (wrist[1] - shoulder[1]) * t];
    const dark = mat(mix(p.c, INK, 0.18));
    // 둘째 깃 (팔에서 오른쪽 아래로)
    for (let i = 0; i < 4; i++) feather(lerp(0.25 + i * 0.2), 9 + i * 1.2, -38 + i * 4, i % 2 ? p.P : dark);
    // 첫째 깃 (손목에서 부채꼴로 바깥쪽)
    for (let i = 4; i >= 0; i--) feather([wrist[0] + i * 0.4, wrist[1] + i * 0.6], 17 - i * 1.2, 22 - i * 14, i % 2 ? dark : p.P);
    // 덮깃 (짧고 밝게)
    for (let i = 0; i < 4; i++) feather(lerp(0.12 + i * 0.25), 6.5, -10 + i * 6, p.L, 2.3);
    // 뼈대 (앞 가장자리)
    A.paint(stroke([shoulder, wrist, [16, 6.5]], 2, 1.4, 0.5), p.L, { bev: 0 });
  },
  soul(A, p) {
    // 꼬리 흔들리는 혼불 유령
    A.paint(
      (x, y) => {
        if (y < 3 || y > 30) return null;
        const k = (y - 3) / 27;
        const hw = k < 0.4 ? 10 * Math.sqrt(1 - ((0.4 - k) / 0.4) ** 2) : 10 - (k - 0.4) * 6;
        const off = Math.sin(k * 6) * (k > 0.5 ? (k - 0.5) * 6 : 0);
        if (Math.abs(x - 16 - off) > hw) return null;
        // 아랫단 물결
        const hem = 26 + Math.sin((x - 16) * 1.1) * 2.6;
        if (y > hem + 2.5) return null;
        return 0.5 - ((x - 16 - off) / hw) * 0.4 - k * 0.6;
      },
      p.L,
      { bev: 2.2 },
    );
    A.paint(oval(12.2, 12.5, 2, 2.8, -0.8, 0), p.K, { sep: false, bev: 0 });
    A.paint(oval(19.8, 12.5, 2, 2.8, -0.8, 0), p.K, { sep: false, bev: 0 });
    A.paint(oval(16, 19, 1.6, 1.8, -0.6, 0), p.K, { sep: false, bev: 0 });
    A.glow(11.8, 11.8, p.hi, 0.6);
    A.glow(19.4, 11.8, p.hi, 0.6);
    for (const [x, y, a] of [[4, 8, 0.6], [28, 14, 0.5], [5, 24, 0.4], [27.5, 26, 0.6], [26, 3, 0.35]]) A.glow(x, y, p.hi, a);
  },
  // ───── 무기 ─────
  sword(A, p) {
    const ax = axis(4, 28, 45);
    A.paint(stroke([ax.at(1, 0), ax.at(7, 0)], 1.8), p.T, { tex: (x, y, c) => (((ax.uv(x, y)[0] / 1.8) % 1) < 0.35 ? mix(c, INK, 0.4) : c) });
    A.paint(ball(...ax.at(0.5, 0), 2.3), p.P);
    A.paint(blade(ax, 9, 35, (u) => (u > 30 ? 2.6 * (35 - u) / 5 : 2.6)), p.M, { bev: 0 });
    A.paint(stroke([ax.at(8, -6.5), ax.at(8, 6.5)], 1.6), p.P, { bev: 0 });
    A.paint(ball(...ax.at(8, 0), 1.5), p.L, { bev: 0, sep: false });
    A.line(...ax.at(11, 0), ...ax.at(29, 0), p.c, 0.55);
    A.spark(...ax.at(31, 1.2), p.hi);
  },
  axe(A, p) {
    shaft(A, [27, 29.5], [9, 6], 1.7, p.T, p.D, 2);
    const ax = axis(27, 29.5, 128);
    // 큰 초승달 날 (자루 왼쪽)
    A.paint(
      apoly(ax, [[19, 1.4], [16, 6], [12.5, 10.5], [16, 12.5], [21, 13.5], [26, 13.4], [31, 12], [34, 10], [30, 6], [28, 1.4]], 0.2, 0.8),
      p.P,
      { bev: 2, tex: (x, y, c) => (ax.uv(x, y)[1] > 10.4 ? mix(c, WHITE, 0.5) : c) },
    );
    // 뒤쪽 뿔
    A.paint(apoly(ax, [[21, -1.4], [24, -6.5], [27, -1.4]], -0.1, 0.5), p.D, { bev: 0 });
    A.paint(stroke([ax.at(19.5, 0), ax.at(28, 0)], 2.2), p.D, { bev: 0 });
    A.spark(...ax.at(30, 12), p.hi);
  },
  spear(A, p) {
    shaft(A, [3, 29], [21, 11], 1.4, p.T);
    A.paint(stroke([[18.5, 13.5], [21.5, 10.5]], 2.2), p.P, { bev: 0 });
    const ax = axis(21, 11, 45);
    A.paint(blade(ax, 0, 13, (u) => (u < 5 ? 1.6 + u * 0.55 : 4.4 * (13 - u) / 8)), p.M, { bev: 0 });
    A.spark(...ax.at(10, 1), p.hi);
  },
  staff(A, p) {
    shaft(A, [4, 29.5], [20, 13], 1.5, p.T, p.D, 2);
    // 갈퀴 받침
    A.paint(stroke(bez([17, 16], [15, 8], [20, 4]), 1.2, 0.6), p.D, { bev: 0 });
    A.paint(stroke(bez([17, 16], [26, 17], [28, 11]), 1.2, 0.6), p.D, { bev: 0 });
    A.paint(ball(22, 10, 5.2), p.P, { bev: 0 });
    A.paint(ball(20.5, 8.5, 2), p.L, { bev: 0, sep: false });
    A.dot(20, 8, WHITE);
    for (const [x, y, a] of [[28, 3, 0.7], [29, 8, 0.4], [15, 4, 0.4]]) A.glow(x, y, p.hi, a);
    A.spark(28, 3, p.hi);
  },
  bow(A, p) {
    // 활대 (호)
    const arc = bez([9, 2], [-4, 16], [9, 30], 18);
    A.paint(stroke(arc, 1.5, 1.5, 0.2), p.P, { bev: 0 });
    A.paint(stroke(arc.slice(7, 12), 2.3, 2.3, 0.1), p.T, { bev: 0 });
    // 시위
    A.paint(stroke([[9, 2.5], [9, 29.5]], 0.5), p.W, { bev: 0 });
    // 화살 (깃은 시위 쪽, 촉은 오른쪽)
    A.paint(stroke([[8, 16], [26, 16]], 0.7), p.T, { bev: 0, sep: false });
    A.paint(poly([[25, 13], [31, 16], [25, 19]], 0.4, 0.6), p.M, { bev: 0 });
    A.paint(poly([[10.5, 15.4], [15.5, 15.4], [13.5, 12.4], [9, 12.4]], 0.6, 0.4), p.L, { bev: 0 });
    A.paint(poly([[10.5, 16.6], [15.5, 16.6], [13.5, 19.6], [9, 19.6]], -0.1, 0.4), p.L, { bev: 0 });
  },
  hammer(A, p) {
    shaft(A, [27, 29], [11, 11], 1.7, p.T, p.D, 2);
    const ax = axis(10, 10, 45);
    A.paint(apoly(ax, [[-10, -4.5], [10, -4.5], [10, 4.5], [-10, 4.5]], 0.2, 0.6), p.P, { bev: 2.4 });
    A.paint(apoly(ax, [[-10.5, -5.4], [-7.5, -5.4], [-7.5, 5.4], [-10.5, 5.4]], -0.2, 0.4), p.D, { bev: 0 });
    A.paint(apoly(ax, [[7.5, -5.4], [10.5, -5.4], [10.5, 5.4], [7.5, 5.4]], 0.3, 0.4), p.D, { bev: 0 });
    A.spark(...ax.at(9, 4), p.hi);
  },
  glove(A, p) {
    // 손가락 넷 + 엄지
    for (let i = 0; i < 4; i++) A.paint(stroke([[8.5 + i * 4.6, 3.5 + (i === 0 || i === 3 ? 2 : 0)], [8.5 + i * 4.6, 15]], 2.1), p.P, { bev: 0 });
    A.paint(stroke([[25.5, 21], [29, 13.5]], 2.3), p.P, { bev: 0 });
    A.paint(rrect(6, 12, 27, 24, 3.5, 0.1, 0.6), p.P, { bev: 2.4 });
    for (let i = 0; i < 4; i++) A.paint(rect(6.6 + i * 4.6, 9, 10.4 + i * 4.6, 10.4), p.D, { sep: false, bev: 0 });
    // 손목 덮개
    A.paint(rrect(8, 23, 25, 29.5, 1.4, -0.2, 0.4), p.D, { bev: 1.4 });
    A.paint(ball(16.5, 18, 2.3), p.L, { bev: 0 });
    A.line(8.5, 26.2, 24.5, 26.2, p.D.r[4], 0.6, 3);
  },
  shovel(A, p) {
    shaft(A, [4.5, 27.5], [19, 13], 1.4, p.T);
    A.paint(stroke([[2, 25], [7, 30]], 1.6), p.T, { bev: 0 });
    const ax = axis(19, 13, 45);
    A.paint(apoly(ax, [[0, -3], [0, 3], [3, 6], [12, 5.5], [16, 0], [12, -5.5], [3, -6]], 0.3, 0.8), p.P, { bev: 2 });
    A.line(...ax.at(2, 0), ...ax.at(13, 0), p.D.r[1], 0.8);
  },
  whip(A, p) {
    A.paint(stroke([[3, 6], [10, 13]], 2.3), p.T, { tex: (x, y, c) => (((x + y) / 2.4) % 1 < 0.35 ? mix(c, INK, 0.4) : c) });
    A.paint(ball(3, 5.5, 2.4), p.D);
    const lash = [...bez([10, 13], [24, 8], [26, 17], 10), ...bez([26, 17], [27, 28], [15, 24], 10).slice(1), ...bez([15, 24], [9, 21], [11, 29], 8).slice(1)];
    A.paint(stroke(lash, 1.6, 0.6, 0.2), p.P, { bev: 0 });
    A.spark(11, 29, p.hi);
  },
  scythe(A, p) {
    shaft(A, [6, 30.5], [21, 3.5], 1.5, p.T, p.D, 1);
    // 낫날 (크게 휘어진)
    A.paint(
      (x, y) => {
        const d = Math.hypot(x - 21, (y - 15) * 1.1);
        const a = Math.atan2(y - 15, x - 21);
        if (a > -0.75 || a < -Math.PI + 0.05) return null;
        const k = (-0.75 - a) / (Math.PI - 0.8);
        const th = 6 * (1 - k) ** 0.7;
        if (d > 13 || d < 13 - th) return null;
        return 0.3 + ((d - (13 - th / 2)) / Math.max(0.5, th)) * 0.9;
      },
      p.M,
      { bev: 1, tex: (x, y, c) => (Math.hypot(x - 21, (y - 15) * 1.1) < 8.6 + 0 ? mix(c, WHITE, 0.45) : mix(c, p.c, 0.3)) },
    );
    A.spark(9, 12, p.hi);
  },
  bag(A, p) {
    // 손잡이 고리
    A.paint(ring(16, 9, 6, 1.4, 5, -Math.PI, 0), p.D, { bev: 0 });
    // 가방 몸
    A.paint(rrect(3.5, 9, 28.5, 28.5, 3, 0, 0.6), p.P, { bev: 2.4 });
    // 덮개
    A.paint(poly([[3.5, 9], [28.5, 9], [28.5, 16], [16, 19.5], [3.5, 16]], 0.3, 0.5), p.D, { bev: 1.6 });
    A.paint(rrect(13.5, 16.5, 18.5, 21.5, 0.8, 0.4, 0.5), p.W, { bev: 0 });
    A.dot(16, 19, p.W.r[0]);
    A.line(5, 25.5, 27, 25.5, p.P.r[3], 0.5, 3);
  },
  question(A, p) {
    const q = [...bez([7.5, 10.5], [8, 2.5], [16, 2.5], 8), ...bez([16, 2.5], [25, 3], [24, 10], 8).slice(1), ...bez([24, 10], [23, 15], [16, 17], 8).slice(1), [16, 21.5] as Pt];
    A.paint(stroke(q, 3.2, 3, 0.1), p.P, { bev: 0 });
    A.paint(ball(16, 27, 3.2), p.P);
    A.line(9, 8, 11.5, 5, WHITE, 0.6);
  },
  chest(A, p) {
    // 둥근 뚜껑
    A.paint(uni(clip(oval(16, 13, 13.5, 8.5, 0.5, 0.6), (_x, y) => y < 13), rect(2.5, 12.5, 29.5, 14)), p.P, { bev: 2 });
    // 몸통
    A.paint(rect(2.5, 14, 29.5, 28.5, 0, 0.5), p.P, { bev: 2 });
    // 쇠테
    for (const x of [6, 26]) A.paint(rect(x - 1.6, 4.6, x + 1.6, 28.5, 0.1, 0.4), p.D, { bev: 0, sep: false });
    A.paint(rect(2.5, 13, 29.5, 15.4, 0, 0.3), p.D, { bev: 0, sep: false });
    // 자물쇠
    A.paint(rrect(13, 13, 19, 20.5, 1, 0.5, 0.6), p.W, { bev: 1 });
    A.paint(rect(15.4, 15.5, 16.6, 18.5, -0.8, 0), p.K, { bev: 0, sep: false });
    A.glow(16, 4, p.hi, 0.6);
    A.spark(24, 3, p.hi);
  },
  door(A, p) {
    // 아치 문틀
    const arch = (x0: number, x1: number, y0: number, y1: number): Test => (x, y) => {
      const cx = (x0 + x1) / 2;
      const r = (x1 - x0) / 2;
      if (x < x0 || x > x1 || y > y1) return null;
      if (y < y0 + r && Math.hypot(x - cx, y - (y0 + r)) > r) return null;
      return 0.2 - ((x - cx) / r) * 0.3 - (y - y0) / (y1 - y0) * 0.3;
    };
    A.paint(arch(3.5, 28.5, 1.5, 30), p.D, { bev: 1.6 });
    A.paint(arch(6.5, 25.5, 4.5, 30), p.P, {
      bev: 1.6,
      tex: (x, _y, c) => (Math.abs(((x - 6.5) / 4.75) % 1) < 0.14 ? mix(c, INK, 0.45) : c),
    });
    for (const y of [11, 23]) A.paint(rect(6.5, y - 1.2, 25.5, y + 1.2, 0, 0.3), p.D, { bev: 0, sep: false });
    A.paint(ball(21.5, 17.5, 1.6), p.W, { bev: 0 });
    A.spark(21.5, 17.5, p.hi);
  },
  star(A, p) {
    const pts = starPts(16, 17, 14.5, 6.2);
    for (let i = 0; i < 10; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % 10];
      const ang = Math.atan2((a[1] + b[1]) / 2 - 17, (a[0] + b[0]) / 2 - 16);
      const lit = Math.cos(ang) * LX + Math.sin(ang) * LY;
      A.paint(poly([[16, 17], a, b], lit * 0.9 + 0.05, 0.2), p.P, { sep: false, bev: 0 });
    }
    A.spark(16, 17, p.hi);
  },
  lock(A, p) {
    // 걸쇠 고리
    A.paint(ring(16, 11.5, 6.6, 1.9, 7, -Math.PI, 0), p.D, { bev: 0 });
    A.paint(uni(rect(7.5, 11, 11.3, 15), rect(20.7, 11, 24.5, 15)), p.D, { bev: 0 });
    // 몸통
    A.paint(rrect(4.5, 14, 27.5, 29.5, 2.4, 0.1, 0.7), p.P, { bev: 2.4 });
    // 열쇠 구멍
    A.paint(uni(ball(16, 20, 2.4), poly([[14.6, 21], [17.4, 21], [18.2, 26], [13.8, 26]])), p.K, { sep: false, bev: 0 });
    A.dot(6.5, 16, WHITE, 0.7);
    A.line(6, 27.5, 26, 27.5, p.D.r[1], 0.5);
  },
};

const cache = new Map<string, HTMLCanvasElement>();

/** 아이콘 그림이 있는 키들 */
export const ICON_ART_KEYS = Object.keys(D);

/**
 * 아이콘 그림 (n×n 픽셀, col = 본색). 정의가 없으면 null.
 * n 은 그릴 UI 박스 크기 × 픽셀 밀도. 같은 (키, 색, n)은 캐시한다.
 */
export function iconArt(key: string, col: string, n: number): HTMLCanvasElement | null {
  const fn = D[key];
  if (!fn) return null;
  n = Math.max(8, Math.min(160, Math.round(n)));
  const k = `${key}|${col}|${n}`;
  let c = cache.get(k);
  if (!c) {
    const A = new Art(n);
    fn(A, palette(/^#[0-9a-f]{6}$/i.test(col) ? col : '#ffffff'));
    c = A.finish();
    if (cache.size > 1500) cache.clear();
    cache.set(k, c);
  }
  return c;
}
