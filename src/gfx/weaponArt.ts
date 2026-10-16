import { makeCanvas, OUTLINE, silhouette } from './pixel';

/**
 * 무기 24종 전용 그림 (64×64, UI에서 32칸에 그려 ★6·7 영웅과 같은 2배 픽셀 밀도).
 * 무기마다 손으로 정한 부품(칼날·손잡이·코등이·보석·장식)을 축 좌표로 찍고,
 *  - 부품별 5단계 음영 (광원 왼쪽 위, 칼날은 가운데 날 선을 기준으로 밝은 면/어두운 면)
 *  - 4×4 정렬 디더로 단계 경계를 거칠게
 *  - 아래에 깔린 다른 부품과 맞닿은 가장자리 = 짙은 구분선
 *  - 전체 실루엣 1px 외곽선 (#0a0810)
 *  - 마지막에 외곽선 없는 빛 효과(불씨·서리·번개·영혼·반짝임)
 * 를 넣는다. 그림은 처음 쓸 때 한 번 만들어 캐시한다.
 */

const N = 64;
type RGB = [number, number, number];
type Test = (x: number, y: number) => number | null;

const hex = (c: string): RGB => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const WHITE: RGB = [255, 255, 255];
const INK: RGB = [22, 14, 30];
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const hash = (x: number, y: number, s = 0): number => {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/** 재질: 어두운 쪽부터 5단계 */
interface Mat {
  r: RGB[];
}
function mat(base: string, o: { hi?: string; lo?: string; gloss?: number } = {}): Mat {
  const b = hex(base);
  const hi = o.hi ? hex(o.hi) : mix(b, WHITE, 0.55);
  const lo = o.lo ? hex(o.lo) : mix(b, INK, 0.62);
  const g = o.gloss ?? 1;
  return { r: [lo, mix(lo, b, 0.55), b, mix(b, hi, 0.5 * g + 0.2), hi] };
}

const M = {
  steel: mat('#9aa4b4', { hi: '#f4f8ff', lo: '#2c3040' }),
  darkSteel: mat('#5a6070', { hi: '#c8d0e0', lo: '#181a24' }),
  iron: mat('#6e6a68', { hi: '#c8c0b8', lo: '#201c1c' }),
  gold: mat('#d8a840', { hi: '#fff4b0', lo: '#5a3410' }),
  bronze: mat('#b07a40', { hi: '#ffd8a0', lo: '#40200c' }),
  wood: mat('#7a5030', { hi: '#c89060', lo: '#2a160c' }),
  darkWood: mat('#4a3020', { hi: '#8a6040', lo: '#180c06' }),
  leather: mat('#5a3a2a', { hi: '#9a7050', lo: '#1c100a' }),
  bone: mat('#d8ccb0', { hi: '#ffffff', lo: '#5a4e3a' }),
  cloth: (c: string) => mat(c),
};

class Art {
  col = new Float32Array(N * N * 3);
  a = new Uint8Array(N * N);
  part = new Int16Array(N * N).fill(-1);
  fx: { x: number; y: number; c: RGB; a: number }[] = [];
  private pid = 0;

  /** 부품 찍기. test가 돌려주는 값 t(-1 어두움 ~ 1 밝음)로 음영 단계를 고른다 */
  paint(test: Test, m: Mat, o: { tex?: (x: number, y: number, c: RGB) => RGB; sep?: boolean; flat?: number } = {}): void {
    const id = this.pid++;
    const mask = new Float32Array(N * N).fill(NaN);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const t = test(x, y);
      if (t !== null) mask[y * N + x] = Math.max(-1, Math.min(1, t));
    }
    const inM = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < N && y < N && !Number.isNaN(mask[y * N + x]);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = y * N + x;
      const t = mask[i];
      if (Number.isNaN(t)) continue;
      const s = ((t + 1) / 2) * 4 + (BAYER[(y & 3) * 4 + (x & 3)] / 16 - 0.5) * 0.45;
      let k = Math.max(0, Math.min(4, Math.round(s)));
      // 실루엣 가장자리: 왼쪽 위는 밝게, 오른쪽 아래는 어둡게
      if (!inM(x - 1, y - 1) && k < 4 && k >= 2) k++;
      if (!inM(x + 1, y + 1) && k > 0) k--;
      // 아래 부품과 맞닿은 테두리 = 구분선
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
      if (o.tex) c = o.tex(x, y, c);
      this.col[i * 3] = c[0];
      this.col[i * 3 + 1] = c[1];
      this.col[i * 3 + 2] = c[2];
      this.a[i] = 255;
      this.part[i] = id;
    }
  }

  /** 한 픽셀 덧칠 (외곽선 안쪽 세부: 눈금·리벳·룬) */
  dot(x: number, y: number, c: RGB | string, a = 1): void {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= N || y >= N) return;
    const i = y * N + x;
    if (!this.a[i]) return;
    const cc = typeof c === 'string' ? hex(c) : c;
    for (let k = 0; k < 3; k++) this.col[i * 3 + k] += (cc[k] - this.col[i * 3 + k]) * a;
  }

  /** 외곽선 없는 빛 (불씨·번개 등) */
  glow(x: number, y: number, c: RGB | string, a = 1): void {
    this.fx.push({ x: Math.round(x), y: Math.round(y), c: typeof c === 'string' ? hex(c) : c, a });
  }

  finish(): HTMLCanvasElement {
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
      const ia = d[i + 3] / 255;
      if (ia === 0) {
        d[i] = f.c[0];
        d[i + 1] = f.c[1];
        d[i + 2] = f.c[2];
        d[i + 3] = Math.round(255 * f.a);
      } else {
        for (let k = 0; k < 3; k++) d[i + k] = d[i + k] + (f.c[k] - d[i + k]) * f.a;
      }
    }
    g.putImageData(img, 0, 0);
    return cv;
  }
}

// ───────────── 좌표·도형 ─────────────

/** 축 좌표: 원점(ox,oy)에서 각도 deg(0 = 오른쪽, 90 = 위) 방향이 u, 그 왼쪽(빛 쪽)이 v */
interface Axis {
  uv(x: number, y: number): [number, number];
  at(u: number, v: number): [number, number];
}
function axis(ox: number, oy: number, deg: number): Axis {
  const a = (deg * Math.PI) / 180;
  const dx = Math.cos(a);
  const dy = -Math.sin(a);
  const nx = dy;
  const ny = -dx;
  return {
    uv: (x, y) => {
      const px = x + 0.5 - ox;
      const py = y + 0.5 - oy;
      return [px * dx + py * dy, px * nx + py * ny];
    },
    at: (u, v) => [ox + u * dx + v * nx, oy + u * dy + v * ny],
  };
}

/** 원통형 막대: 반폭 hw(u), 중심선 이동 c(u). 결과 t = 가로 위치(빛 쪽 +) */
function rod(A: Axis, u0: number, u1: number, hw: number | ((u: number) => number), c?: (u: number) => number): Test {
  return (x, y) => {
    const [u, v] = A.uv(x, y);
    if (u < u0 || u > u1) return null;
    const h = typeof hw === 'number' ? hw : hw(u);
    if (h <= 0) return null;
    const d = v - (c ? c(u) : 0);
    if (Math.abs(d) > h) return null;
    return (d / h) * 0.9;
  };
}

/** 칼날: 가운데 날 선 기준으로 빛 쪽 면은 밝고 반대 면은 어둡다. 양 날 끝은 밝은 날 */
function blade(A: Axis, u0: number, u1: number, top: (u: number) => number, bot: (u: number) => number): Test {
  return (x, y) => {
    const [u, v] = A.uv(x, y);
    if (u < u0 || u > u1) return null;
    const t = top(u);
    const b = -bot(u);
    if (v > t || v < b || t <= b) return null;
    const mid = (t + b) / 2;
    if (v >= mid) {
      const f = (v - mid) / Math.max(0.5, t - mid);
      return f > 0.78 ? 1 : 0.15 + f * 0.6;
    }
    const f = (mid - v) / Math.max(0.5, mid - b);
    return f > 0.82 ? 0.2 : -0.35 - f * 0.55;
  };
}

/** 구: 빛 방향(왼쪽 위 앞)과의 내적 */
function ball(cx: number, cy: number, r: number, ry = r): Test {
  return (x, y) => {
    const nx = (x + 0.5 - cx) / r;
    const ny = (y + 0.5 - cy) / ry;
    const q = nx * nx + ny * ny;
    if (q > 1) return null;
    const nz = Math.sqrt(1 - q);
    return (-nx * 0.55 - ny * 0.6 + nz * 0.58) * 1.5 - 0.35;
  };
}

/** 고리 (두께 th) */
function ringT(cx: number, cy: number, r: number, th: number, ry = r, from = -Math.PI, to = Math.PI): Test {
  return (x, y) => {
    const px = x + 0.5 - cx;
    const py = (y + 0.5 - cy) * (r / ry);
    const d = Math.hypot(px, py);
    if (Math.abs(d - r) > th) return null;
    const a = Math.atan2(py, px);
    if (a < from || a > to) return null;
    const w = (d - r) / th; // 바깥 +
    const ox = px / (d || 1);
    const oy = py / (d || 1);
    return (-ox * 0.6 - oy * 0.7) * w * 0.9 + (1 - Math.abs(w)) * 0.3;
  };
}

/** 다각형 (짝수-홀수 판정). t = 기본값 + 세로 기울기 */
function poly(pts: [number, number][], t0 = 0, grad = 0): Test {
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    minY = Math.min(minY, p[1]);
    maxY = Math.max(maxY, p[1]);
  }
  return (x, y) => {
    const px = x + 0.5;
    const py = y + 0.5;
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i];
      const [xj, yj] = pts[j];
      if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
    }
    if (!inside) return null;
    return t0 + grad * (0.5 - (py - minY) / Math.max(1, maxY - minY));
  };
}

/** 축 기준 다각형: 점들을 (u, v)로 준다 */
function apoly(A: Axis, pts: [number, number][], t0 = 0, grad = 0): Test {
  return poly(pts.map(([u, v]) => A.at(u, v)), t0, grad);
}

/** 선분(굵기 r) */
function seg(x0: number, y0: number, x1: number, y1: number, r: number): Test {
  return (x, y) => {
    const px = x + 0.5;
    const py = y + 0.5;
    const vx = x1 - x0;
    const vy = y1 - y0;
    const l2 = vx * vx + vy * vy || 1;
    const k = Math.max(0, Math.min(1, ((px - x0) * vx + (py - y0) * vy) / l2));
    const dx = px - (x0 + vx * k);
    const dy = py - (y0 + vy * k);
    if (dx * dx + dy * dy > r * r) return null;
    return (-dx * 0.6 - dy * 0.7) / r;
  };
}

/** 손잡이 감은 끈 무늬 */
const wrapTex = (A: Axis, u0: number, u1: number, step = 2.6) => (x: number, y: number, c: RGB): RGB => {
  const [u, v] = A.uv(x, y);
  if (u < u0 || u > u1) return c;
  const ph = (u + v * 0.9) / step;
  return ph - Math.floor(ph) < 0.3 ? mix(c, INK, 0.45) : c;
};

/** 빛 효과: 점 하나 + 십자 번짐 */
function spark(A: Art, x: number, y: number, c: string, big = false): void {
  A.glow(x, y, WHITE, 1);
  A.glow(x - 1, y, c, 0.85);
  A.glow(x + 1, y, c, 0.85);
  A.glow(x, y - 1, c, 0.85);
  A.glow(x, y + 1, c, 0.85);
  if (big) {
    A.glow(x - 2, y, c, 0.45);
    A.glow(x + 2, y, c, 0.45);
    A.glow(x, y - 2, c, 0.45);
    A.glow(x, y + 2, c, 0.45);
  }
}

/** 칼날 위 빛나는 룬/균열 선 */
function runeLine(A: Art, ax: Axis, u0: number, u1: number, v: number, c: string, step = 3, wob = 0.8): void {
  for (let u = u0; u <= u1; u += 0.5) {
    if (Math.floor(u / step) % 3 === 2) continue;
    const [x, y] = ax.at(u, v + Math.sin(u * 1.3) * wob);
    A.dot(x, y, c, 1);
  }
}

/** 손잡이 공통: 폼멜 + 감은 손잡이 */
function hilt(A: Art, ax: Axis, u0: number, u1: number, hw: number, grip: Mat, pommel: Mat, pr = 3.2): void {
  A.paint(rod(ax, u0 + pr * 0.6, u1, hw), grip, { tex: wrapTex(ax, u0, u1) });
  const [px, py] = ax.at(u0 + pr * 0.5, 0);
  A.paint(ball(px, py, pr), pommel);
}

// ───────────── 무기별 그림 ─────────────

const D: Record<string, (A: Art) => void> = {
  // ★3
  rusty_blade(A) {
    const ax = axis(9, 55, 45);
    hilt(A, ax, 0, 16, 2.2, M.leather, M.iron);
    A.paint(apoly(ax, [[15, -9], [19, -9.5], [19.5, 9.5], [15, 9], [16.5, 0]], 0.1, 0.4), M.iron);
    const notch = (u: number): number => ((u > 33 && u < 36) || (u > 52 && u < 54.5) ? 1.6 : 0);
    const rust = mat('#a89880', { hi: '#e8e0d0', lo: '#2e2a26' });
    A.paint(
      blade(ax, 19, 74, (u) => (u > 66 ? 4.2 * (74 - u) / 8 : 4.2) - notch(u), (u) => (u > 66 ? 4.2 * (74 - u) / 8 : 4.2)),
      rust,
      {
        tex: (x, y, c) => {
          const n = hash(x >> 1, y >> 1, 3);
          if (n > 0.72) return mix(c, hex('#9a4a1a'), 0.6);
          if (n > 0.6) return mix(c, hex('#6a3a1a'), 0.4);
          return c;
        },
      },
    );
    runeLine(A, ax, 21, 62, 0, '#5a5048', 99, 0); // 홈(풀러)
  },
  hunter_knife(A) {
    const ax = axis(13, 51, 45);
    const antler = mat('#c8b490', { hi: '#fff4e0', lo: '#4a3a24' });
    A.paint(rod(ax, 2, 20, (u) => 2.6 + Math.sin(u * 0.7) * 0.4), antler, {
      tex: (x, y, c) => (hash(x, y, 7) > 0.8 ? mix(c, INK, 0.3) : c),
    });
    A.paint(ball(...ax.at(2.5, 0), 2.6), M.bronze);
    for (const u of [8, 14]) A.dot(...ax.at(u, 0), '#ffd890');
    A.paint(apoly(ax, [[19, -5], [22, -5.5], [22, 5.5], [19, 5]], 0.2, 0.3), M.bronze);
    // 클립 포인트 칼날: 등은 끝에서 꺾여 내려오고 날은 둥글게 올라간다
    A.paint(
      blade(
        ax,
        22,
        56,
        (u) => (u < 44 ? 3.6 : 3.6 - (u - 44) * 0.42),
        (u) => 4 * Math.sqrt(Math.max(0, 1 - ((u - 22) / 34) ** 6)) - (u > 48 ? (u - 48) * 0.1 : 0),
      ),
      M.steel,
    );
    runeLine(A, ax, 24, 42, 1.6, '#5a6070', 99, 0);
  },
  ember_club(A) {
    const ax = axis(10, 54, 50);
    A.paint(rod(ax, 2, 18, 2.4), M.leather, { tex: wrapTex(ax, 2, 18) });
    A.paint(
      rod(ax, 16, 62, (u) => 2.6 + ((u - 16) / 46) ** 1.3 * 6.4 - (u > 58 ? ((u - 58) / 4) ** 2 * 5 : 0)),
      M.darkWood,
      {
        tex: (x, y, c) => {
          const [u, v] = ax.uv(x, y);
          // 불씨 균열
          const cr = Math.abs(v - Math.sin(u * 0.5) * 2.4) < 0.6 && u > 32 && hash(Math.floor(u / 3), 1, 2) > 0.3;
          if (cr) return mix(hex('#ff8a2a'), hex('#ffe080'), hash(x, y, 1));
          return hash(x >> 1, y, 5) > 0.82 ? mix(c, INK, 0.35) : c;
        },
      },
    );
    for (const u of [26, 40]) A.paint(rod(ax, u, u + 2.4, (uu) => 3.2 + ((uu - 16) / 46) ** 1.3 * 6.4), M.iron);
    for (const [u, v] of [[48, 5.8], [54, -6.6], [44, -5.4], [58, 3.8]]) A.paint(ball(...ax.at(u, v), 1.5), M.iron);
    for (let i = 0; i < 9; i++) {
      const [x, y] = ax.at(56 + hash(i, 1) * 10, (hash(i, 2) - 0.5) * 14);
      spark(A, x, y - hash(i, 3) * 4, i % 2 ? '#ff8a2a' : '#ffd040', i < 2);
    }
  },
  thorn_whip(A) {
    const ax = axis(9, 56, 55);
    hilt(A, ax, 0, 15, 2.4, M.leather, M.bronze, 2.8);
    // 감긴 채찍: 큰 고리 두 겹 + 끝으로 늘어지는 꼬리
    const vine = mat('#a03040', { hi: '#ff90a0', lo: '#30080e' });
    A.paint(seg(...ax.at(15, 0), 24, 30, 2.2), vine);
    A.paint(ringT(35, 26, 14, 2.4, 12), vine);
    A.paint(ringT(38, 24, 9, 2.1, 8), vine);
    A.paint(seg(48, 33, 57, 47, 1.6), vine);
    A.paint(seg(57, 47, 59, 54, 1.1), vine);
    // 가시
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const r = 14 + 2.4;
      const x = 35 + Math.cos(a) * r;
      const y = 26 + Math.sin(a) * r * (12 / 14);
      const ox = Math.cos(a + 0.5) * 3.6;
      const oy = Math.sin(a + 0.5) * 3.6;
      A.paint(poly([[x - Math.cos(a) * 1.5 - Math.sin(a) * 1.3, y - Math.sin(a) * 1.5 + Math.cos(a) * 1.3], [x + ox, y + oy], [x - Math.cos(a) * 1.5 + Math.sin(a) * 1.3, y - Math.sin(a) * 1.5 - Math.cos(a) * 1.3]], 0.6), M.bone, { sep: false });
    }
    for (const [x, y] of [[22, 22], [50, 18], [30, 40], [57, 52]]) A.glow(x, y, '#ff3050', 0.7);
  },
  viper_fang(A) {
    const ax = axis(12, 52, 40);
    A.paint(rod(ax, 2, 18, 2.4), mat('#2a4a2a', { hi: '#6aa060', lo: '#0a1a0a' }), { tex: wrapTex(ax, 2, 18, 2) });
    A.paint(ball(...ax.at(2.5, 0), 2.8), mat('#3a6a30'));
    A.dot(...ax.at(2, 0.8), '#ffe040');
    // 뱀 머리 코등이
    A.paint(apoly(ax, [[17, -6], [21, -7], [24, -3], [24, 4], [21, 7], [17, 5]], 0.2, 0.5), mat('#3a6a30', { hi: '#a0e070', lo: '#0e200a' }));
    A.dot(...ax.at(21, 3.5), '#ffe040');
    A.dot(...ax.at(21, -4), '#ffe040');
    // 휘어진 송곳니 칼날
    const bend = (u: number): number => ((u - 23) / 33) ** 2 * 6;
    A.paint(
      blade(ax, 23, 57, (u) => 3.6 * (1 - ((u - 23) / 34) ** 1.6) + bend(u), (u) => 3.6 * (1 - ((u - 23) / 34) ** 1.6) - bend(u)),
      mat('#d8e8c8', { hi: '#ffffff', lo: '#3a4a30' }),
    );
    runeLine(A, ax, 26, 50, 0, '#70c040', 4, 0);
    for (let i = 0; i < 4; i++) {
      const [x, y] = ax.at(30 + i * 7, -3.5 + ((30 + i * 7 - 23) / 33) ** 2 * 6);
      A.glow(x, y + 1, '#90ff50', 0.9);
      A.glow(x, y + 2 + (i % 2), '#70c040', 0.7);
    }
    A.glow(46, 26, '#b0ff70', 1);
    A.glow(46, 27, '#70c040', 0.8);
    A.glow(46, 29, '#70c040', 0.6);
  },
  gale_gloves(A) {
    const g = mat('#70e0a0', { hi: '#e0fff0', lo: '#103a24' });
    const cuff = mat('#3a7a5a', { hi: '#a0e0c0', lo: '#0a2016' });
    // 손가락 4개 + 엄지
    for (const [x, h] of [[24, 15], [29.5, 18], [35, 17], [40.5, 13]] as [number, number][]) A.paint(seg(x, 30, x, 30 - h, 2.6), g);
    A.paint(seg(19, 38, 13, 28, 2.8), g);
    A.paint(poly([[20, 28], [44, 28], [45, 44], [21, 46]], 0.1, 0.8), g);
    for (const x of [24, 29.5, 35, 40.5]) A.paint(ball(x, 28, 2.6, 1.8), M.gold);
    A.paint(poly([[19, 45], [46, 43], [48, 54], [18, 56]], -0.1, 0.6), cuff);
    for (let x = 21; x < 46; x += 4) A.dot(x, 49 + (x % 8 ? 0 : 1), '#d0fff0');
    // 깃털
    const fe = mat('#e8fff4', { hi: '#ffffff', lo: '#5aa080' });
    A.paint(poly([[46, 46], [60, 34], [58, 42], [48, 52]], 0.2, 0.6), fe);
    A.paint(poly([[46, 50], [62, 46], [56, 52], [47, 54]], 0.0, 0.5), fe);
    for (let i = 0; i < 3; i++) A.dot(48 + i * 4, 48 - i * 3, '#70e0a0');
    // 바람 소용돌이
    for (let k = 0; k < 26; k++) {
      const a = k * 0.32;
      const r = 4 + k * 0.42;
      A.glow(14 + Math.cos(a) * r, 14 + Math.sin(a) * r * 0.6, '#a0ffd0', 0.35 + (k / 26) * 0.5);
    }
  },
  grave_shovel(A) {
    const ax = axis(10, 55, 45);
    A.paint(ringT(...ax.at(2, 0), 3.6, 1.3), M.darkWood);
    A.paint(rod(ax, 5, 46, 1.9), M.wood, { tex: (x, y, c) => (hash(x, y >> 1, 4) > 0.85 ? mix(c, INK, 0.3) : c) });
    A.paint(rod(ax, 44, 49, 2.6), M.iron);
    // 삽날
    A.paint(apoly(ax, [[48, -7], [64, -7.5], [72, 0], [64, 7.5], [48, 7]], 0.15, 0.2), M.iron, {
      tex: (x, y, c) => {
        const [u] = ax.uv(x, y);
        if (u > 60 && hash(x, y, 9) > 0.55) return mix(c, hex('#4a3a2a'), 0.5); // 흙
        return c;
      },
    });
    A.paint(apoly(ax, [[49, -5.5], [62, -5.8], [62, -3.6], [49, -3.4]], 0.9), M.iron, { sep: false });
    // 영혼 불빛
    for (let i = 0; i < 6; i++) {
      const [x, y] = ax.at(58 + i * 1.6, -11 - Math.sin(i) * 2);
      A.glow(x, y, i === 0 ? '#ffffff' : '#a0f0ff', 0.9 - i * 0.12);
    }
  },
  tower_sword(A) {
    const ax = axis(20, 60, 60);
    A.paint(rod(ax, 0, 10, 2), M.leather, { tex: wrapTex(ax, 0, 10) });
    A.paint(blade(ax, 10, 66, (u) => (u > 58 ? 3.4 * (66 - u) / 8 : 3.4), (u) => (u > 58 ? 3.4 * (66 - u) / 8 : 3.4)), M.steel);
    // 방패
    const sh = mat('#a0a8b8', { hi: '#f0f4ff', lo: '#2a2e3a' });
    A.paint(poly([[8, 12], [36, 8], [40, 38], [24, 56], [8, 40]], 0.2, 1.0), sh);
    A.paint(poly([[11, 15], [33, 12], [36, 37], [24, 51], [11, 38]], -0.2, 0.9), mat('#3a4a6a', { hi: '#8aa0c8', lo: '#101828' }));
    // 문장 (방패 십자)
    A.paint(poly([[21.5, 15], [24, 14.6], [25, 46], [22.5, 47]], 0.5), M.gold);
    A.paint(poly([[12, 26], [35, 23.5], [35.4, 26], [12.2, 28.6]], 0.5), M.gold);
    for (const [x, y] of [[11, 14], [34, 10.5], [38, 36], [10.5, 39], [24, 53]]) A.paint(ball(x, y, 1.4), M.iron);
  },
  frost_awl(A) {
    const ax = axis(8, 57, 45);
    A.paint(rod(ax, 0, 48, 1.7), mat('#6a7a8a', { hi: '#c0d8e8', lo: '#1a2430' }));
    A.paint(rod(ax, 4, 14, 2.3), M.leather, { tex: wrapTex(ax, 4, 14) });
    A.paint(rod(ax, 46, 50, 3), M.darkSteel);
    // 얼음 송곳: 깎은 면이 보이는 사각뿔
    const ice = mat('#a0e0ff', { hi: '#ffffff', lo: '#1a4a70' });
    A.paint(apoly(ax, [[49, 0], [52, 3.6], [76, 0]], 0.9), ice);
    A.paint(apoly(ax, [[49, 0], [52, -3.6], [76, 0]], -0.5), ice);
    // 서리 결정
    for (const [u, v] of [[50, 6], [54, -6], [44, 4], [40, -4.5]] as [number, number][]) {
      const [x, y] = ax.at(u, v);
      A.paint(poly([[x, y - 2.5], [x + 1.4, y], [x, y + 2.5], [x - 1.4, y]], 0.5), ice, { sep: false });
    }
    for (let i = 0; i < 6; i++) spark(A, ...ax.at(58 + i * 3, (hash(i, 4) - 0.5) * 14), '#c0f0ff', i === 0);
  },

  // ★4
  quake_blade(A) {
    const ax = axis(8, 56, 45);
    hilt(A, ax, 0, 15, 2.4, M.leather, M.bronze, 3.4);
    A.paint(apoly(ax, [[14, -11], [19, -12], [20, -4], [20, 4], [19, 12], [14, 11], [16, 0]], 0.1, 0.5), M.bronze);
    A.paint(ball(...ax.at(17, 0), 2.2), mat('#ff6a2a', { hi: '#ffe080', lo: '#4a1004' }));
    const w = (u: number): number => (u > 66 ? 6.4 * Math.sqrt(Math.max(0, (76 - u) / 10)) : 6.4 - (u - 20) * 0.02);
    A.paint(blade(ax, 20, 76, w, w), mat('#c8b090', { hi: '#fff8e0', lo: '#3a2c1c' }));
    // 진동 균열 (지그재그 + 빛)
    let v = 0;
    for (let u = 24; u < 68; u += 1) {
      v += (hash(u, 3) - 0.5) * 1.6;
      v = Math.max(-2.6, Math.min(2.6, v));
      const [x, y] = ax.at(u, v);
      A.dot(x, y, '#ffb040', 1);
      if (u % 7 === 0) A.glow(x + 1, y - 1, '#ffd060', 0.7);
    }
    for (const [u, vv] of [[78, 6], [80, -4], [74, 9]] as [number, number][]) spark(A, ...ax.at(u * 0.8, vv * 1.4), '#ffd080');
  },
  blood_thirst(A) {
    const ax = axis(10, 56, 52);
    A.paint(rod(ax, 0, 64, 2), M.darkWood);
    A.paint(rod(ax, 2, 16, 2.6), M.leather, { tex: wrapTex(ax, 2, 16) });
    A.paint(rod(ax, 44, 60, 2.8), M.iron);
    // 초승달 도끼날 (한쪽)
    const red = mat('#c0283c', { hi: '#ffa0a8', lo: '#30040a' });
    A.paint(
      apoly(ax, [[46, -2.5], [47, -6], [40, -11], [35, -19], [43, -20.5], [52, -21.5], [61, -20], [67, -14], [57, -6], [56, -2.5]], -0.1, 0.8),
      red,
      {
        tex: (x, y, c) => {
          const [u, vv] = ax.uv(x, y);
          const edge = vv < -18.6 || (u < 39 && vv < -15) || (u > 63 && vv < -12);
          return edge ? mix(c, hex('#ffe0e0'), 0.6) : c;
        },
      },
    );
    A.paint(apoly(ax, [[62, 2.5], [66, 7], [62, 9], [58, 2.5]], 0.3), M.iron);
    // 피 방울
    for (const [u, vv] of [[44, -22], [56, -23], [37, -20]] as [number, number][]) {
      const [x, y] = ax.at(u, vv);
      A.glow(x, y + 1, '#ff2040', 1);
      A.glow(x, y + 2, '#c01030', 0.9);
      A.glow(x, y + 4, '#ff2040', 0.6);
    }
  },
  thunder_pike(A) {
    const ax = axis(7, 58, 45);
    A.paint(rod(ax, 0, 54, 1.7), mat('#3a4a6a', { hi: '#8aa0d0', lo: '#0e1424' }));
    for (const u of [8, 20, 32]) A.paint(rod(ax, u, u + 1.8, 2.3), M.gold);
    A.paint(rod(ax, 52, 56, 3), M.gold);
    // 번개 모양 창날
    const bolt = mat('#80d0ff', { hi: '#ffffff', lo: '#1a3a70' });
    A.paint(apoly(ax, [[55, 0], [60, 5], [63, 1.5], [70, 5], [80, 0], [70, -2], [66, -6], [62, -1.5], [58, -5]], 0, 0.4), bolt);
    A.paint(apoly(ax, [[52, 3], [48, 9], [55, 6]], 0.4), M.gold);
    A.paint(apoly(ax, [[52, -3], [48, -9], [55, -6]], -0.2), M.gold);
    // 전기 아크
    const arc = (x0: number, y0: number, n: number, s: number): void => {
      let x = x0;
      let y = y0;
      for (let i = 0; i < n; i++) {
        x += 1 + (hash(i, s) > 0.5 ? 1 : 0);
        y += hash(i, s + 1) > 0.5 ? -1 : 1;
        A.glow(x, y, i % 3 ? '#a0e0ff' : '#ffffff', 0.9);
      }
    };
    arc(38, 18, 10, 5);
    arc(46, 26, 8, 9);
    arc(26, 30, 7, 13);
  },
  shadow_fang(A) {
    const ax = axis(12, 52, 42);
    A.paint(rod(ax, 2, 18, 2.4), mat('#2a1e3a', { hi: '#6a5a8a', lo: '#0a0612' }), { tex: wrapTex(ax, 2, 18, 2.2) });
    A.paint(ball(...ax.at(2.6, 0), 2.8), mat('#9a6bff', { hi: '#f0e0ff', lo: '#2a1060' }));
    A.paint(apoly(ax, [[17, -7], [20, -4], [20, 4], [17, 7], [19, 0]], 0.1, 0.5), mat('#4a3a6a'));
    const bend = (u: number): number => -(((u - 20) / 36) ** 2) * 5;
    A.paint(
      blade(ax, 20, 58, (u) => 3.4 * (1 - ((u - 20) / 38) ** 2) + bend(u), (u) => 4 * (1 - ((u - 20) / 38) ** 1.3) - bend(u)),
      mat('#9a6bff', { hi: '#ffe8ff', lo: '#1a0840' }),
    );
    runeLine(A, ax, 24, 48, -0.5, '#e0c8ff', 3.6, 0.5);
    // 그림자 연기
    for (let i = 0; i < 18; i++) {
      const [x, y] = ax.at(18 + hash(i, 1) * 40, -8 - hash(i, 2) * 7);
      A.glow(x, y, i % 3 ? '#5a3a9a' : '#9a6bff', 0.35 + hash(i, 3) * 0.35);
    }
  },
  relay_token(A) {
    // 사슬
    for (let i = 0; i < 5; i++) A.paint(ringT(32 + (i - 2) * 1.2, 4 + i * 3, 1.8, 0.8, 1.2), M.gold, { sep: false });
    A.paint(ball(32, 36, 19), mat('#2a7a5a', { hi: '#a0ffd0', lo: '#08241a' }));
    A.paint(ringT(32, 36, 17.5, 2.2), M.gold);
    A.paint(ball(32, 36, 10), mat('#6dffb0', { hi: '#ffffff', lo: '#0e4a30' }));
    // 교대 화살표 두 개 (돌아가는)
    const arrow = (a0: number, a1: number): void => {
      for (let a = a0; a <= a1; a += 0.05) A.dot(32 + Math.cos(a) * 13.5, 36 + Math.sin(a) * 13.5, '#fff8d0');
      const hx = 32 + Math.cos(a1) * 13.5;
      const hy = 36 + Math.sin(a1) * 13.5;
      const tx = -Math.sin(a1);
      const ty = Math.cos(a1);
      for (let k = 0; k < 4; k++) {
        A.dot(hx + tx * k * 0.5 - Math.cos(a1) * (2.4 - k * 0.6), hy + ty * k * 0.5 - Math.sin(a1) * (2.4 - k * 0.6), '#fff8d0');
        A.dot(hx + tx * k * 0.5 + Math.cos(a1) * (2.4 - k * 0.6), hy + ty * k * 0.5 + Math.sin(a1) * (2.4 - k * 0.6), '#fff8d0');
      }
    };
    arrow(-2.6, -0.6);
    arrow(0.55, 2.55);
    // 가운데 두 실루엣
    A.paint(ball(28, 33, 2.4), mat('#0e4a30'), { sep: false });
    A.paint(ball(36, 39, 2.4), mat('#0e4a30'), { sep: false });
    spark(A, 26, 27, '#d0ffe8');
    spark(A, 48, 22, '#6dffb0', true);
  },
  berserker_axe(A) {
    const ax = axis(32, 62, 90);
    A.paint(rod(ax, 0, 56, 2.1), M.darkWood);
    A.paint(rod(ax, 2, 16, 2.7), M.leather, { tex: wrapTex(ax, 2, 16) });
    A.paint(apoly(ax, [[56, -2], [62, 0], [56, 2]], 0.5), M.iron);
    const red = mat('#d84020', { hi: '#ffc0a0', lo: '#3a0a04' });
    // 양날 도끼
    for (const s of [1, -1]) {
      A.paint(
        apoly(ax, [[38, 2.5 * s], [30, 9 * s], [32, 22 * s], [46, 27 * s], [58, 22 * s], [60, 9 * s], [52, 2.5 * s]], s > 0 ? 0.2 : -0.3, 0.6),
        red,
        {
          tex: (x, y, c) => {
            const [u, v] = ax.uv(x, y);
            return Math.abs(v) > 22 || Math.hypot(u - 45, v - 4 * s) > 21 ? mix(c, hex('#fff0e0'), 0.55) : c;
          },
        },
      );
    }
    A.paint(rod(ax, 37, 53, 3.4), M.iron);
    for (const u of [40, 45, 50]) A.paint(ball(...ax.at(u, 0), 1.3), M.gold, { sep: false });
    // 가시
    A.paint(apoly(ax, [[46, 27], [44, 31], [48, 27]], 0.4), M.iron);
    A.paint(apoly(ax, [[46, -27], [44, -31], [48, -27]], 0.1), M.iron);
    for (let i = 0; i < 6; i++) A.glow(...ax.at(30 + i * 6, (i % 2 ? 1 : -1) * 30), '#ff8040', 0.6);
  },
  soul_reaper(A) {
    const ax = axis(14, 60, 74);
    A.paint(rod(ax, 0, 60, 1.8), mat('#2a3440', { hi: '#7a8aa0', lo: '#0a0e14' }));
    for (const u of [12, 24]) A.paint(rod(ax, u, u + 1.6, 2.4), M.bone);
    A.paint(ball(...ax.at(0, 0), 2.6), M.bone);
    // 큰 낫날: 자루 끝에서 왼쪽으로 휘어 내려오는 한쪽 날
    const blade2 = mat('#9ef0ff', { hi: '#ffffff', lo: '#164a5a' });
    const [tx, ty] = ax.at(60, 0);
    const cx = tx - 2;
    const cy = ty + 21;
    A.paint(
      (x, y) => {
        const px = x + 0.5 - cx;
        const py = y + 0.5 - cy;
        const a = Math.atan2(py, px);
        if (a > -Math.PI * 0.42 || a < -Math.PI) return null;
        const f = (a + Math.PI) / (Math.PI * 0.58); // 0 날 끝 ~ 1 자루 쪽
        const d = Math.hypot(px, py);
        const outer = 21 + f * 1.5;
        const inner = outer - 1 - f * 8.5;
        if (d > outer || d < inner) return null;
        const w = (d - inner) / Math.max(1, outer - inner);
        return w > 0.78 ? 0.6 : w < 0.25 ? 1 : 0.2 - w * 0.8;
      },
      blade2,
    );
    A.paint(ball(...ax.at(60, 0), 3), mat('#2a3440'));
    A.paint(ball(...ax.at(60, 0), 1.6), mat('#9ef0ff', { hi: '#ffffff' }), { sep: false });
    // 영혼 불꽃
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI * 0.98 + i * 0.17;
      A.glow(cx + Math.cos(a) * 18 - 1, cy + Math.sin(a) * 18 + 3, i % 3 ? '#9ef0ff' : '#ffffff', 0.4 + (i % 2) * 0.3);
    }
    spark(A, cx - 21, cy, '#9ef0ff', true);
  },
  pyre_staff(A) {
    const ax = axis(18, 62, 72);
    A.paint(rod(ax, 0, 46, (u) => 1.8 + Math.sin(u * 0.4) * 0.3), M.darkWood, { tex: (x, y, c) => (hash(x, y, 2) > 0.85 ? mix(c, INK, 0.4) : c) });
    for (const u of [14, 30]) A.paint(rod(ax, u, u + 2, 2.5), M.bronze);
    // 해골 화로
    const [hx, hy] = ax.at(50, 0);
    A.paint(poly([[hx - 7, hy + 1], [hx + 7, hy - 1], [hx + 5, hy + 7], [hx - 4, hy + 8]], 0, 0.5), M.bronze);
    A.paint(ball(hx, hy - 3, 6.4, 5.8), M.bone);
    A.paint(ball(hx - 2.4, hy - 3, 1.5), mat('#1a0a04'), { sep: false });
    A.paint(ball(hx + 2.4, hy - 3.4, 1.5), mat('#1a0a04'), { sep: false });
    A.dot(hx - 2.4, hy - 3, '#ffb040');
    A.dot(hx + 2.4, hy - 3.4, '#ffb040');
    for (let x = -2; x <= 2; x += 2) A.dot(hx + x, hy + 1, '#3a2a1a');
    // 불꽃
    const fl = mat('#ff8a3a', { hi: '#fff4a0', lo: '#8a1a04' });
    A.paint(poly([[hx - 6, hy - 6], [hx - 4, hy - 14], [hx - 1, hy - 10], [hx + 1, hy - 20], [hx + 4, hy - 11], [hx + 6, hy - 15], [hx + 7, hy - 6]], 0.2, 1.6), fl, { sep: false });
    A.paint(poly([[hx - 3, hy - 7], [hx, hy - 14], [hx + 3, hy - 7]], 0.95), fl, { sep: false });
    for (let i = 0; i < 7; i++) A.glow(hx - 8 + hash(i, 6) * 16, hy - 22 - hash(i, 7) * 10, i % 2 ? '#ffd040' : '#ff6a1a', 0.85);
  },
  rime_saber(A) {
    const ax = axis(9, 55, 42);
    hilt(A, ax, 0, 14, 2.2, mat('#2a4a6a', { hi: '#80b0e0', lo: '#0a1424' }), M.steel, 2.8);
    // 손 보호대(너클 가드) 곡선
    A.paint(ringT(...ax.at(9, -1), 7.4, 1, 6, -Math.PI, -0.4), M.steel);
    A.paint(apoly(ax, [[13, -6], [17, -6.5], [17, 5], [13, 4.5]], 0.2, 0.4), M.steel);
    const bend = (u: number): number => ((u - 17) / 56) ** 2 * 9;
    A.paint(
      blade(ax, 17, 74, (u) => 2.6 * (u > 64 ? (74 - u) / 10 : 1) + bend(u) + 0.6, (u) => 2.6 * (u > 64 ? (74 - u) / 10 : 1) - bend(u) + 0.6),
      mat('#a8e4ff', { hi: '#ffffff', lo: '#1e4a6a' }),
    );
    // 등 쪽 서리 가시
    for (let u = 24; u < 66; u += 6) {
      const [x, y] = ax.at(u, 2.6 + bend(u) + 1.2);
      A.paint(poly([[x - 1.2, y + 1], [x + 0.6, y - 2.6], [x + 1.4, y + 1]], 0.8), mat('#e0f8ff', { hi: '#ffffff', lo: '#5aa0c0' }), { sep: false });
    }
    for (let i = 0; i < 6; i++) spark(A, ...ax.at(30 + i * 8, 10 + bend(30 + i * 8) + hash(i, 2) * 5), '#c0f0ff', i === 2);
  },

  // ★5
  eternis(A) {
    const ax = axis(8, 56, 45);
    hilt(A, ax, 0, 15, 2.3, mat('#3a2a5a', { hi: '#8a70c0', lo: '#0e0820' }), M.gold, 3.4);
    A.paint(ball(...ax.at(1.6, 0), 1.6), mat('#c8a8ff', { hi: '#ffffff' }), { sep: false });
    // 날개 코등이
    const wing = (s: number): [number, number][] => [[14, 2 * s], [11, 7 * s], [9, 14 * s], [14, 12 * s], [16, 16 * s], [19, 10 * s], [21, 4 * s]];
    A.paint(apoly(ax, wing(1), 0.4, 0.6), M.gold);
    A.paint(apoly(ax, wing(-1), -0.1, 0.6), M.gold);
    A.paint(ball(...ax.at(18, 0), 3.4), mat('#8a40ff', { hi: '#f0d0ff', lo: '#1a0440' }));
    const w = (u: number): number => (u > 68 ? 4.8 * ((78 - u) / 10) ** 0.8 : 4.8 - (u - 21) * 0.025);
    A.paint(blade(ax, 21, 78, w, w), mat('#d8d0f0', { hi: '#ffffff', lo: '#2a2048' }));
    // 가운데 영혼 홈 (빛나는 보라 + 룬)
    A.paint(rod(ax, 24, 64, (u) => 1.3 * (1 - ((u - 24) / 40) ** 4)), mat('#9a6bff', { hi: '#ffffff', lo: '#3a1a8a' }), { sep: false });
    for (let u = 28; u < 62; u += 6) A.dot(...ax.at(u, 0), '#ffffff');
    // 영혼 칼날 3개 (궤도)
    for (const [u, v] of [[44, 14], [60, -14], [70, 11]] as [number, number][]) {
      const [x, y] = ax.at(u, v);
      for (let k = -2; k <= 2; k++) A.glow(x + k, y - k, k === 0 ? '#ffffff' : '#c8a8ff', 0.9 - Math.abs(k) * 0.15);
    }
    for (let i = 0; i < 14; i++) A.glow(...ax.at(22 + hash(i, 1) * 56, (hash(i, 2) > 0.5 ? 1 : -1) * (7 + hash(i, 3) * 5)), '#9a6bff', 0.35 + hash(i, 4) * 0.3);
    spark(A, ...ax.at(78, 0), '#e0c8ff', true);
  },
  storm_heart(A) {
    // 금속 틀 안에 갇힌 번개 심장
    A.paint(ball(32, 34, 18), mat('#1a3a6a', { hi: '#7fd8ff', lo: '#040a1a' }));
    A.paint(ball(32, 34, 13), mat('#7fd8ff', { hi: '#ffffff', lo: '#1a4a8a' }));
    // 하트 모양 핵
    A.paint(
      (x, y) => {
        const px = (x + 0.5 - 32) / 7;
        const py = -(y + 0.5 - 35) / 7;
        const q = px * px + py * py - 1;
        if (q * q * q - px * px * py * py * py > 0) return null;
        return 0.3 - py * 0.4 - px * 0.3;
      },
      mat('#e0f8ff', { hi: '#ffffff', lo: '#4a90d0' }),
      { sep: false },
    );
    // 틀: 세로·가로 고리
    A.paint(ringT(32, 34, 18, 1.6, 18), M.darkSteel);
    A.paint(ringT(32, 34, 7, 1.5, 18), M.darkSteel);
    A.paint(ringT(32, 34, 18, 1.5, 6), M.darkSteel);
    for (const [x, y] of [[32, 15], [32, 53], [13.5, 34], [50.5, 34]]) A.paint(ball(x, y, 2.4), M.gold);
    // 꼭대기 걸쇠
    A.paint(ringT(32, 10, 3.2, 1.1), M.gold);
    // 번개
    const zig = (pts: [number, number][]): void => {
      for (let i = 0; i < pts.length - 1; i++) {
        const [x0, y0] = pts[i];
        const [x1, y1] = pts[i + 1];
        const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2);
        for (let k = 0; k <= n; k++) A.glow(x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n, '#ffffff', 1);
      }
    };
    zig([[52, 12], [56, 18], [53, 20], [60, 28]]);
    zig([[10, 50], [6, 44], [10, 42], [4, 34]]);
    zig([[46, 54], [50, 58], [47, 60], [52, 63]]);
    for (const [x, y] of [[56, 18], [6, 44], [50, 58]]) spark(A, x, y, '#7fd8ff', true);
  },
  volcania(A) {
    const ax = axis(8, 56, 45);
    hilt(A, ax, 0, 15, 2.4, mat('#3a1a10', { hi: '#8a4a2a', lo: '#100404' }), mat('#ff6a2a', { hi: '#ffe080', lo: '#4a0e00' }), 3.4);
    A.paint(apoly(ax, [[14, -10], [17, -6], [16, -13], [21, -8], [21, 8], [16, 13], [17, 6], [14, 10], [17, 0]], 0.1, 0.5), mat('#2a1a18', { hi: '#8a6050', lo: '#080404' }));
    A.paint(ball(...ax.at(18.5, 0), 2.6), mat('#ff3a10', { hi: '#ffe080', lo: '#4a0400' }));
    const w = (u: number): number => (u > 66 ? 5.6 * ((77 - u) / 11) ** 0.9 : 5.6 + Math.sin(u * 0.35) * 0.4);
    // 흑요석 칼날 + 마그마 균열
    A.paint(blade(ax, 21, 77, w, w), mat('#3a2a2a', { hi: '#9a7a70', lo: '#0a0606' }), {
      tex: (x, y, c) => {
        const [u, v] = ax.uv(x, y);
        const k = Math.abs(v - Math.sin(u * 0.45) * 2.2) < 0.75 || (Math.abs(v + Math.sin(u * 0.8 + 1) * 3.4) < 0.5 && hash(Math.floor(u / 4), 2) > 0.4);
        if (k && u < 72) return mix(hex('#ff6a1a'), hex('#ffe060'), hash(x, y, 3));
        return c;
      },
    });
    // 불꽃 휘감기
    const fl = mat('#ff6a2a', { hi: '#fff0a0', lo: '#8a1a04' });
    for (const [u, v, s] of [[34, 6, 1], [50, -7, -1], [62, 6, 1]] as [number, number, number][]) {
      A.paint(apoly(ax, [[u - 4, v - 1.6 * s], [u + 2, v + 2 * s], [u + 6, v + 5.4 * s], [u + 1, v + 0.4 * s]], 0.6), fl, { sep: false });
    }
    for (let i = 0; i < 14; i++) {
      const [x, y] = ax.at(24 + hash(i, 1) * 56, (hash(i, 2) - 0.5) * 22);
      A.glow(x, y - hash(i, 3) * 3, i % 3 ? '#ff8a2a' : '#ffe080', 0.55 + hash(i, 4) * 0.4);
    }
  },
  chrono_glass(A) {
    const fr = M.gold;
    // 위·아래 판
    A.paint(poly([[12, 6], [52, 6], [50, 11], [14, 11]], 0.5, 0.6), fr);
    A.paint(poly([[14, 53], [50, 53], [52, 58], [12, 58]], 0, 0.6), fr);
    // 유리 (두 원뿔)
    const glass = mat('#bfe8ff', { hi: '#ffffff', lo: '#3a6a8a' });
    A.paint(poly([[17, 11], [47, 11], [34, 31], [30, 31]], 0.2, 0.8), glass);
    A.paint(poly([[30, 33], [34, 33], [47, 53], [17, 53]], 0.1, 0.8), glass);
    // 모래
    const sand = mat('#ffe8a0', { hi: '#fffbe0', lo: '#8a6a20' });
    A.paint(poly([[23, 20], [41, 20], [34, 31], [30, 31]], 0.3, 0.4), sand, { sep: false });
    A.paint(poly([[32, 40], [44, 53], [20, 53]], 0.2, 0.6), sand, { sep: false });
    for (let y = 31; y < 46; y++) A.dot(32, y, '#fff0b0');
    // 기둥
    for (const x of [14, 50]) A.paint(rod(axis(x, 53, 90), 0, 42, 1.8), fr);
    A.paint(ringT(32, 32, 4.4, 1.2), fr);
    // 시계 바늘 장식
    A.paint(ringT(32, 8.5, 2, 0.8), mat('#ff9ac0'), { sep: false });
    A.dot(26, 15, '#ffffff');
    A.dot(24, 17, '#ffffff');
    A.dot(22, 44, '#ffffff');
    for (let i = 0; i < 16; i++) {
      const a = i * 0.39;
      A.glow(32 + Math.cos(a) * 28, 32 + Math.sin(a) * 28, i % 4 ? '#ffe8a0' : '#ffffff', 0.25 + (i % 4 === 0 ? 0.5 : 0.2));
    }
  },
  blood_sovereign(A) {
    const ax = axis(32, 63, 90);
    A.paint(rod(ax, 0, 58, 2.2), mat('#2a0a12', { hi: '#7a3040', lo: '#0a0204' }));
    for (const u of [4, 12, 20]) A.paint(rod(ax, u, u + 1.6, 2.8), M.gold);
    const red = mat('#ff2050', { hi: '#ffd0d8', lo: '#3a0410' });
    // 왕관 모양 큰 도끼날 (오른쪽) + 작은 갈고리 (왼쪽)
    A.paint(
      apoly(ax, [[34, -2.5], [26, -10], [26, -18], [32, -22], [38, -20], [44, -26], [50, -20], [56, -24], [62, -18], [62, -10], [56, -2.5]], -0.1, 0.8),
      red,
      {
        tex: (x, y, c) => {
          const [, v] = ax.uv(x, y);
          return v < -17 ? mix(c, hex('#fff0f0'), 0.35) : c;
        },
      },
    );
    A.paint(apoly(ax, [[40, 2.5], [36, 10], [44, 14], [52, 8], [52, 2.5]], 0.3, 0.6), mat('#a01030', { hi: '#ff90a0', lo: '#2a0208' }));
    A.paint(rod(ax, 33, 57, 3.6), M.gold);
    A.paint(ball(...ax.at(45, -9), 3.4), mat('#ff2050', { hi: '#ffffff', lo: '#5a0018' }));
    A.paint(apoly(ax, [[58, -3], [66, 0], [58, 3]], 0.6), M.gold);
    for (const [u, v] of [[26, -18], [44, -26], [62, -18]] as [number, number][]) spark(A, ...ax.at(u, v - 1), '#ffd040');
    for (let i = 0; i < 5; i++) {
      const [x, y] = ax.at(28 + i * 8, -22 - (i % 2) * 3);
      A.glow(x, y + 2, '#ff2050', 0.9);
      A.glow(x, y + 3, '#a01030', 0.8);
    }
  },
  chaos_star(A) {
    // 별 결정 + 둘레를 도는 우주 파편
    for (let k = 0; k < 70; k++) {
      const a = k * 0.09;
      A.glow(32 + Math.cos(a) * 27, 33 + Math.sin(a) * 9 - Math.cos(a) * 6, k % 5 ? '#c890ff' : '#ffffff', 0.25 + (k % 5 ? 0.15 : 0.5));
    }
    const star = (cx: number, cy: number, R: number, r: number, rot: number): [number, number][] => {
      const p: [number, number][] = [];
      for (let i = 0; i < 10; i++) {
        const a = rot + (i * Math.PI) / 5;
        const rr = i % 2 ? r : R;
        p.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
      }
      return p;
    };
    const pink = mat('#ffb0f0', { hi: '#ffffff', lo: '#5a1a7a' });
    // 면마다 다른 밝기 (깎은 결정)
    const pts = star(32, 33, 25, 10.5, -Math.PI / 2);
    for (let i = 0; i < 10; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % 10];
      const mid = (Math.atan2((a[1] + b[1]) / 2 - 33, (a[0] + b[0]) / 2 - 32) + Math.PI) / (Math.PI * 2);
      const lit = Math.cos((mid - 0.375) * Math.PI * 2);
      A.paint(poly([[32, 33], a, b], lit * 0.9 - 0.1), pink, { sep: false });
    }
    A.paint(ball(32, 33, 6), mat('#ffffff', { lo: '#c080ff', hi: '#ffffff' }), { sep: false });
    A.paint(ball(32, 33, 3), mat('#2a0a4a', { hi: '#8a40c0', lo: '#000000' }), { sep: false });
    // 작은 운석 파편
    for (const [x, y, r] of [[8, 14, 2.6], [56, 50, 2.2], [54, 12, 1.8], [10, 52, 1.6]] as [number, number, number][]) A.paint(ball(x, y, r), mat('#7a5aa0', { hi: '#e0c0ff', lo: '#1a0a30' }));
    for (const [x, y] of [[32, 4], [60, 24], [4, 30], [44, 60]]) spark(A, x, y, '#ffd0ff', true);
  },
};

const cache = new Map<string, HTMLCanvasElement>();
const lockCache = new Map<string, HTMLCanvasElement>();

/** 무기 그림 (64×64). 정의가 없으면 null */
export function weaponArt(id: string): HTMLCanvasElement | null {
  let c = cache.get(id);
  if (!c) {
    const fn = D[id];
    if (!fn) return null;
    const A = new Art();
    fn(A);
    c = A.finish();
    cache.set(id, c);
  }
  return c;
}

export const WEAPON_ART_IDS = Object.keys(D);

/**
 * UI에 무기 그림을 그린다. (x, y, size) = 기존 아이콘 자리.
 * 28칸 이상은 32의 배수 크기로(픽셀이 고르게) 가운데 맞춰 그리고, 더 작으면 부드럽게 축소한다.
 * locked: 미보유 실루엣 색
 */
export function drawWeaponArt(g: CanvasRenderingContext2D, id: string, x: number, y: number, size: number, locked?: string): boolean {
  let img = weaponArt(id);
  if (!img) return false;
  if (locked) {
    let s = lockCache.get(id + locked);
    if (!s) {
      s = silhouette(img, locked);
      lockCache.set(id + locked, s);
    }
    img = s;
  }
  const d = size >= 28 ? Math.max(32, Math.round(size / 32) * 32) : size;
  const ox = x + (size - d) / 2;
  const oy = y + (size - d) / 2;
  const sm = g.imageSmoothingEnabled;
  g.imageSmoothingEnabled = d % 32 !== 0;
  if (g.imageSmoothingEnabled) g.imageSmoothingQuality = 'high';
  g.drawImage(img, Math.round(ox * 2) / 2, Math.round(oy * 2) / 2, d, d);
  g.imageSmoothingEnabled = sm;
  return true;
}
