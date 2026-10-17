import { makeCanvas, OUTLINE } from './pixel';
import { hdQueue, hdState } from './hd';

/**
 * 방 시설(문·상자·상점 노점·제단·무기고·모닥불·수수께끼 비석·표지판·거점 시설) 2배 정밀 그림.
 * 무기 그림(weaponArt.ts)과 같은 방식으로 부품마다
 *  - 5단계 음영 (광원 왼쪽 위) + 4×4 정렬 디더
 *  - 먼저 그린 다른 부품과 맞닿은 가장자리 = 짙은 구분선
 *  - 전체 실루엣 1px 외곽선 (#0a0810)
 *  - 마지막에 외곽선 없는 빛 (불꽃·영혼·반짝임)
 * 을 넣는다. 그림 크기는 월드 크기의 2배(픽셀이 절반 크기) — 고해상도 층(hdQueue)에 월드 크기로 그린다.
 * 바닥 가운데가 기준점이라 기존 시설과 위치·판정이 같고, 그림만 위로 더 커질 수 있다.
 * 움직이는 부분(불꽃·상인 숨쉬기·영혼 결정)은 프레임 번호 f로 고르고, 프레임마다 한 번 만들어 캐시한다.
 */

type RGB = [number, number, number];
type Tex = (x: number, y: number, c: RGB) => RGB;
/** 도형: 경계 상자 + 각 픽셀의 음영값 t (-1 어두움 ~ 1 밝음, 밖이면 null) */
interface Sh {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  t: (x: number, y: number) => number | null;
}

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
function mat(base: string, hi?: string, lo?: string): Mat {
  const b = hex(base);
  const h = hi ? hex(hi) : mix(b, WHITE, 0.5);
  const l = lo ? hex(lo) : mix(b, INK, 0.62);
  return { r: [l, mix(l, b, 0.55), b, mix(b, h, 0.55), h] };
}

const M = {
  wood: mat('#8a5a34', '#d8a060', '#2a140a'),
  darkWood: mat('#5a3820', '#9a6a40', '#1a0c06'),
  redWood: mat('#7a3a2a', '#c8785a', '#24100c'),
  stone: mat('#6a6478', '#c4c0d4', '#1e1a28'),
  darkStone: mat('#45404f', '#8a8498', '#14101c'),
  violetStone: mat('#3e3456', '#8a78b0', '#120c1e'),
  iron: mat('#5e6270', '#c0c8d8', '#16181e'),
  steel: mat('#9aa4b4', '#f4f8ff', '#2c3040'),
  gold: mat('#e0a830', '#fff4b0', '#5a3410'),
  bone: mat('#dccfb2', '#ffffff', '#5a4c3a'),
  leather: mat('#6a4028', '#a87850', '#1e0e08'),
  red: mat('#b8323a', '#ff8a7a', '#3a0a14'),
  cream: mat('#e8d8b0', '#ffffff', '#6a5030'),
  green: mat('#2f7a50', '#7ad898', '#0c2418'),
  hood: mat('#4a2e6a', '#9070c0', '#140a22'),
  robe: mat('#2c1c40', '#6a4a90', '#0c0614'),
  blue: mat('#3a5aa0', '#8ab0f0', '#0e1838'),
  cyan: mat('#4ac8e8', '#e0ffff', '#0c3a5a'),
  magenta: mat('#c04ad8', '#ffc8ff', '#3a0a4a'),
  paper: mat('#e8dcc0', '#ffffff', '#7a6a50'),
  ember: mat('#d8401a', '#ffd060', '#4a0a04'),
  void: mat('#1a1028', '#3a2a50', '#06030c'),
  potR: mat('#e8364a', '#ffc0c0', '#4a0a14'),
  potB: mat('#3a8ae8', '#c0e8ff', '#0a1a4a'),
  potG: mat('#3ac86a', '#d0ffd0', '#0a3a1a'),
};

class Art {
  col: Float32Array;
  a: Uint8Array;
  part: Int16Array;
  fx: { x: number; y: number; c: RGB; a: number }[] = [];
  private pid = 0;
  constructor(
    public W: number,
    public H: number,
  ) {
    this.col = new Float32Array(W * H * 3);
    this.a = new Uint8Array(W * H);
    this.part = new Int16Array(W * H).fill(-1);
  }

  /** 부품 찍기. 도형의 t 값으로 음영 단계를 고른다 */
  paint(s: Sh, m: Mat, o: { tex?: Tex; sep?: boolean; edge?: boolean; shift?: number } = {}): void {
    const { W, H } = this;
    const id = this.pid++;
    const x0 = Math.max(0, Math.floor(s.x0));
    const y0 = Math.max(0, Math.floor(s.y0));
    const x1 = Math.min(W, Math.ceil(s.x1));
    const y1 = Math.min(H, Math.ceil(s.y1));
    const bw = x1 - x0;
    if (bw <= 0 || y1 <= y0) return;
    const mask = new Float32Array(bw * (y1 - y0)).fill(NaN);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const t = s.t(x, y);
      if (t !== null) mask[(y - y0) * bw + x - x0] = Math.max(-1, Math.min(1, t + (o.shift ?? 0)));
    }
    const inM = (x: number, y: number): boolean => x >= x0 && y >= y0 && x < x1 && y < y1 && !Number.isNaN(mask[(y - y0) * bw + x - x0]);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const t = mask[(y - y0) * bw + x - x0];
      if (Number.isNaN(t)) continue;
      const i = y * W + x;
      const sv = ((t + 1) / 2) * 4 + (BAYER[(y & 3) * 4 + (x & 3)] / 16 - 0.5) * 0.45;
      let k = Math.max(0, Math.min(4, Math.round(sv)));
      if (o.edge !== false) {
        if (!inM(x - 1, y - 1) && k < 4 && k >= 2) k++;
        if (!inM(x + 1, y + 1) && k > 0) k--;
      }
      if (o.sep !== false) {
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H || inM(nx, ny)) continue;
          const j = ny * W + nx;
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

  /** 한 색으로 채우기 (음영 없음, 외곽선 안쪽 무늬) */
  fill(s: Sh, c: string | RGB, a = 1): void {
    const cc = typeof c === 'string' ? hex(c) : c;
    for (let y = Math.max(0, Math.floor(s.y0)); y < Math.min(this.H, Math.ceil(s.y1)); y++)
      for (let x = Math.max(0, Math.floor(s.x0)); x < Math.min(this.W, Math.ceil(s.x1)); x++) if (s.t(x, y) !== null) this.dot(x, y, cc, a);
  }

  /** 한 픽셀 덧칠 (이미 칠한 곳만) */
  dot(x: number, y: number, c: RGB | string, a = 1): void {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.W || y >= this.H) return;
    const i = y * this.W + x;
    if (!this.a[i]) return;
    const cc = typeof c === 'string' ? hex(c) : c;
    for (let k = 0; k < 3; k++) this.col[i * 3 + k] += (cc[k] - this.col[i * 3 + k]) * a;
  }

  /** 외곽선 없는 빛 */
  glow(x: number, y: number, c: RGB | string, a = 1): void {
    this.fx.push({ x: Math.round(x), y: Math.round(y), c: typeof c === 'string' ? hex(c) : c, a });
  }
  /** 도형 모양의 외곽선 없는 빛 */
  glowSh(s: Sh, c: string, a = 1): void {
    const cc = hex(c);
    for (let y = Math.floor(s.y0); y < Math.ceil(s.y1); y++) for (let x = Math.floor(s.x0); x < Math.ceil(s.x1); x++) if (s.t(x, y) !== null) this.glow(x, y, cc, a);
  }

  finish(outline = true): HTMLCanvasElement {
    const { W, H } = this;
    const cv = makeCanvas(W, H);
    const g = cv.getContext('2d')!;
    const img = g.createImageData(W, H);
    const d = img.data;
    const oc = hex(OUTLINE);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (this.a[i]) {
        d[i * 4] = this.col[i * 3];
        d[i * 4 + 1] = this.col[i * 3 + 1];
        d[i * 4 + 2] = this.col[i * 3 + 2];
        d[i * 4 + 3] = 255;
      } else if (outline && ((x > 0 && this.a[i - 1]) || (x < W - 1 && this.a[i + 1]) || (y > 0 && this.a[i - W]) || (y < H - 1 && this.a[i + W]))) {
        d[i * 4] = oc[0];
        d[i * 4 + 1] = oc[1];
        d[i * 4 + 2] = oc[2];
        d[i * 4 + 3] = 255;
      }
    }
    for (const f of this.fx) {
      if (f.x < 0 || f.y < 0 || f.x >= W || f.y >= H) continue;
      const i = (f.y * W + f.x) * 4;
      const ia = d[i + 3] / 255;
      if (ia === 0) {
        d[i] = f.c[0];
        d[i + 1] = f.c[1];
        d[i + 2] = f.c[2];
        d[i + 3] = Math.round(255 * f.a);
      } else {
        const na = Math.min(1, ia + f.a * (1 - ia));
        for (let k = 0; k < 3; k++) d[i + k] = d[i + k] + (f.c[k] - d[i + k]) * f.a;
        d[i + 3] = Math.round(na * 255);
      }
    }
    g.putImageData(img, 0, 0);
    return cv;
  }
}

// ───────────── 도형 ─────────────

/** 상자: 위 t0 → 아래 t1 세로 그라데이션 */
const box = (x: number, y: number, w: number, h: number, t0 = 0.35, t1 = -0.35): Sh => ({
  x0: x, y0: y, x1: x + w, y1: y + h,
  t: (px, py) => (px >= x && px < x + w && py >= y && py < y + h ? t0 + (t1 - t0) * ((py - y + 0.5) / h) : null),
});
/** 세로 원통 (기둥·병): 왼쪽 30% 지점이 가장 밝다 */
const cyl = (x: number, y: number, w: number, h: number, amb = 0): Sh => ({
  x0: x, y0: y, x1: x + w, y1: y + h,
  t: (px, py) => (px >= x && px < x + w && py >= y && py < y + h ? 0.85 - 2.1 * Math.abs((px - x + 0.5) / w - 0.3) + amb : null),
});
/** 가로 원통 (통나무·말린 침구) */
const cylH = (x: number, y: number, w: number, h: number, amb = 0): Sh => ({
  x0: x, y0: y, x1: x + w, y1: y + h,
  t: (px, py) => (px >= x && px < x + w && py >= y && py < y + h ? 0.85 - 2.1 * Math.abs((py - y + 0.5) / h - 0.3) + amb : null),
});
/** 타원 (구 음영) */
const oval = (cx: number, cy: number, rx: number, ry: number, amb = 0): Sh => ({
  x0: cx - rx - 1, y0: cy - ry - 1, x1: cx + rx + 1, y1: cy + ry + 1,
  t: (px, py) => {
    const dx = (px + 0.5 - cx) / rx;
    const dy = (py + 0.5 - cy) / ry;
    const d = dx * dx + dy * dy;
    if (d > 1) return null;
    return (-dx * 0.55 - dy * 0.75 + Math.sqrt(1 - d) * 0.5) * 1.1 - 0.35 + amb;
  },
});
/** 고리 (반지름 r0~r1) */
const ring = (cx: number, cy: number, r0: number, r1: number, sy = 1): Sh => ({
  x0: cx - r1 - 1, y0: cy - r1 * sy - 1, x1: cx + r1 + 1, y1: cy + r1 * sy + 1,
  t: (px, py) => {
    const dx = px + 0.5 - cx;
    const dy = (py + 0.5 - cy) / sy;
    const d = Math.hypot(dx, dy);
    if (d < r0 || d > r1) return null;
    return (-dx - dy) / r1 * 0.7;
  },
});
/** 다각형. t: 고정값이나 (u, v) 위치 함수 (경계 상자 기준 0~1) */
const poly = (pts: [number, number][], t: number | ((u: number, v: number) => number) = (_u, v) => 0.35 - v * 0.7): Sh => {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const x0 = Math.min(...xs);
  const y0 = Math.min(...ys);
  const x1 = Math.max(...xs);
  const y1 = Math.max(...ys);
  return {
    x0, y0, x1: x1 + 1, y1: y1 + 1,
    t: (px, py) => {
      const X = px + 0.5;
      const Y = py + 0.5;
      let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i];
        const [xj, yj] = pts[j];
        if (yi > Y !== yj > Y && X < ((xj - xi) * (Y - yi)) / (yj - yi) + xi) inside = !inside;
      }
      if (!inside) return null;
      return typeof t === 'number' ? t : t((X - x0) / Math.max(1, x1 - x0), (Y - y0) / Math.max(1, y1 - y0));
    },
  };
};
/** 두께 w의 막대 (a→b), 가로 방향 원통 음영 */
const rod = (ax: number, ay: number, bx: number, by: number, w: number): Sh => {
  const len = Math.hypot(bx - ax, by - ay) || 1;
  const dx = (bx - ax) / len;
  const dy = (by - ay) / len;
  const hw = w / 2;
  return {
    x0: Math.min(ax, bx) - hw - 1, y0: Math.min(ay, by) - hw - 1, x1: Math.max(ax, bx) + hw + 1, y1: Math.max(ay, by) + hw + 1,
    t: (px, py) => {
      const X = px + 0.5 - ax;
      const Y = py + 0.5 - ay;
      const u = X * dx + Y * dy;
      const v = -X * dy + Y * dx;
      if (u < 0 || u > len || Math.abs(v) > hw) return null;
      // 빛(왼쪽 위) 쪽 면이 밝다
      const side = -dy * -0.7 + dx * -0.7 > 0 ? -1 : 1;
      return (v / hw) * 0.7 * side + 0.1;
    },
  };
};
/** 도형 합치기 (앞 도형 우선) */
const union = (...ss: Sh[]): Sh => ({
  x0: Math.min(...ss.map((s) => s.x0)), y0: Math.min(...ss.map((s) => s.y0)), x1: Math.max(...ss.map((s) => s.x1)), y1: Math.max(...ss.map((s) => s.y1)),
  t: (x, y) => {
    for (const s of ss) {
      const t = s.t(x, y);
      if (t !== null) return t;
    }
    return null;
  },
});
/** 도형 a에서 b를 뺀 부분 */
const minus = (a: Sh, b: Sh): Sh => ({ ...a, t: (x, y) => (b.t(x, y) !== null ? null : a.t(x, y)) });
/** 도형 a 중 조건을 만족하는 부분만 */
const where = (a: Sh, f: (x: number, y: number) => boolean): Sh => ({ ...a, t: (x, y) => (f(x, y) ? a.t(x, y) : null) });

// ───────────── 무늬 ─────────────

/** 나뭇결 (가로 판자, vertical이면 세로 판자) */
const grain =
  (seed: number, vertical = false): Tex =>
  (x, y, c) => {
    const a = vertical ? x : y;
    const b = vertical ? y : x;
    const n = hash(Math.floor(b / 6 + hash(a, 7, seed) * 9), a, seed);
    return n > 0.84 ? mix(c, INK, 0.28) : n < 0.06 ? mix(c, WHITE, 0.12) : c;
  };
/** 석재 블록: 줄눈 + 블록마다 밝기 차이 */
const blocks =
  (bw: number, bh: number, ox = 0, oy = 0): Tex =>
  (x, y, c) => {
    const ry = Math.floor((y - oy) / bh);
    const sx = x - ox + (ry & 1 ? bw / 2 : 0);
    if ((y - oy) % bh === 0 || Math.floor(sx) % bw === 0) return mix(c, INK, 0.55);
    const v = hash(Math.floor(sx / bw), ry, 3) - 0.5;
    const p = hash(x, y, 9);
    let r = v > 0 ? mix(c, WHITE, v * 0.14) : mix(c, INK, -v * 0.3);
    if (p > 0.96) r = mix(r, INK, 0.3);
    return r;
  };
/** 잔 얼룩 (천·가죽) */
const speckle =
  (seed: number, amt = 0.15): Tex =>
  (x, y, c) => {
    const n = hash(x, y, seed);
    return n > 0.93 ? mix(c, INK, amt) : n < 0.04 ? mix(c, WHITE, amt * 0.7) : c;
  };

// ───────────── 공용 부품 ─────────────

/** 물약 병 (밑 가운데 x, 바닥 y, 몸통 반지름 r) */
function bottle(A: Art, x: number, by: number, r: number, m: Mat, tall = false): void {
  const h = tall ? r * 2.6 : r * 2;
  A.paint(tall ? cyl(x - r, by - h, r * 2, h) : oval(x, by - r, r, r), m);
  const nw = Math.max(2, Math.round(r * 0.8));
  A.paint(box(x - nw / 2, by - h - r * 0.9, nw, r, 0.3, -0.2), mat('#c8d8e0', '#ffffff', '#4a5868'));
  A.paint(box(x - nw / 2 - 0.5, by - h - r * 1.3, nw + 1, Math.max(1.5, r * 0.5)), M.wood);
  A.dot(x - r * 0.45, by - h * 0.65, '#ffffff', 0.9);
  if (r >= 4) A.dot(x - r * 0.45, by - h * 0.65 + 1, '#ffffff', 0.6);
}

/** 금화 더미 */
function coins(A: Art, x: number, by: number, n: number, r = 4): void {
  for (let i = 0; i < n; i++) A.paint(oval(x + (i % 2 ? 1 : 0), by - 2 - i * 2, r, 1.6), M.gold, { sep: i > 0 });
}

/** 깜빡이는 불꽃 (외곽선 없음). (x, by) = 불꽃 밑, h = 높이, f = 프레임 */
function flame(A: Art, x: number, by: number, w: number, h: number, f: number, cols = ['#d8401a', '#ff8a2a', '#ffd040', '#fff4c0']): void {
  const sway = Math.sin(f * 1.7) * w * 0.18;
  const hh = h * (0.9 + 0.12 * Math.sin(f * 2.3));
  const layers = cols.length;
  for (let L = 0; L < layers; L++) {
    const k = 1 - L / layers;
    const lw = w * k * 0.5;
    const lh = hh * (0.55 + 0.45 * k);
    for (let yy = 0; yy < lh; yy++) {
      const v = yy / lh; // 0 = 밑, 1 = 끝
      const half = lw * Math.sqrt(Math.max(0, 1 - v)) * (v < 0.25 ? 0.75 + v : 1);
      const cxx = x + sway * v * v + Math.sin(v * 5 + f) * 0.6 * v;
      for (let xx = Math.floor(cxx - half); xx <= Math.ceil(cxx + half); xx++) {
        if (Math.abs(xx + 0.5 - cxx) > half) continue;
        A.glow(xx, by - 1 - yy, cols[L], 1);
      }
    }
  }
}

// ───────────── 해골 상인 ─────────────

/** 해골 상인 (노점용 작은 모습). (cx, top) = 두건 꼭대기 가운데, f = 프레임 */
function merchantSmall(A: Art, cx: number, top: number, f: number): void {
  const bob = f % 8 >= 2 && f % 8 < 6 ? 1 : 0;
  const blink = f % 16 === 13;
  const y = top + bob;
  // 몸(망토)
  A.paint(poly([[cx - 9, y + 20], [cx + 9, y + 20], [cx + 15, y + 34], [cx - 15, y + 34]]), M.hood, { tex: speckle(4) });
  A.paint(poly([[cx - 3, y + 20], [cx + 3, y + 20], [cx + 5, y + 34], [cx - 5, y + 34]], 0), M.robe);
  A.paint(oval(cx, y + 27, 2, 2), M.gold);
  // 두건
  A.paint(union(oval(cx, y + 11, 11, 11), poly([[cx - 4, y + 3], [cx + 7, y - 2], [cx + 6, y + 6]])), M.hood, { tex: speckle(5) });
  A.fill(oval(cx, y + 13, 8, 8.5), '#140a1c');
  // 해골
  A.paint(oval(cx, y + 11.5, 6.5, 6), M.bone, { sep: false });
  A.paint(box(cx - 4, y + 15, 8, 5, 0.2, -0.4), M.bone, { sep: false });
  A.fill(box(cx - 3, y + 17, 6, 1), '#5a4c3a');
  for (let i = -3; i < 3; i += 2) A.dot(cx + i + 1, y + 18, '#5a4c3a');
  A.fill(box(cx - 4.5, y + 10, 3, 3), '#1a0c14');
  A.fill(box(cx + 1.5, y + 10, 3, 3), '#1a0c14');
  A.dot(cx, y + 14, '#3a2a2a');
  if (!blink) {
    A.dot(cx - 3, y + 11, '#ffd040');
    A.dot(cx + 3, y + 11, '#ffd040');
    A.glow(cx - 3, y + 10, '#ffb02a', 0.5);
    A.glow(cx + 3, y + 10, '#ffb02a', 0.5);
  }
  // 외눈 안경
  A.fill(ring(cx + 3, y + 11.5, 2, 3), '#e0a830');
}

/**
 * 해골 상인 큰 모습 (상점 화면용, 176×160 — UI 88×80칸).
 * 보라 두건 + 금테 외눈 안경 + 옛 금화 목걸이. 왼손으로 금화를 튕기며 기다린다.
 */
function merchantBig(f: number): HTMLCanvasElement {
  const A = new Art(176, 160);
  const ph = f % 8;
  const bob = ph >= 2 && ph < 6 ? 2 : 0;
  const blink = f % 24 === 21;
  const cx = 88;
  const hy = 14 + bob; // 두건 위쪽
  // 어깨·망토
  A.paint(poly([[cx - 40, 112], [cx + 40, 112], [cx + 70, 160], [cx - 70, 160]], (u, v) => 0.3 - v * 0.6 - Math.abs(u - 0.4) * 0.4), M.hood, { tex: speckle(11, 0.18) });
  // 망토 주름
  for (const [x0, x1] of [[cx - 30, cx - 44], [cx + 30, cx + 46], [cx - 14, cx - 20]] as [number, number][]) A.fill(rod(x0, 118, x1, 160, 2), '#2a1640', 0.8);
  // 앞섶 조끼 + 금 단추
  A.paint(poly([[cx - 16, 108], [cx + 16, 108], [cx + 24, 160], [cx - 24, 160]], (u, v) => 0.2 - v * 0.6), M.robe, { tex: speckle(12) });
  A.paint(poly([[cx - 16, 108], [cx - 10, 108], [cx - 18, 160], [cx - 24, 160]], 0.4), M.gold, { sep: false });
  A.paint(poly([[cx + 10, 108], [cx + 16, 108], [cx + 24, 160], [cx + 18, 160]], 0.1), M.gold, { sep: false });
  // 목걸이 줄 + 옛 금화
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    A.dot(cx - 14 + t * 28, 106 + Math.sin(t * Math.PI) * 16, '#ffd060');
  }
  A.paint(oval(cx, 128, 9, 9), M.gold);
  A.paint(box(cx - 2, 126, 4, 4, -0.8, -0.8), M.darkWood);
  A.fill(ring(cx, 128, 6.5, 7.5), '#a87020', 0.7);
  // 두건
  const hood = union(oval(cx, hy + 52, 46, 50), poly([[cx - 22, hy + 14], [cx + 8, hy - 12], [cx + 26, hy + 12]], 0.6));
  A.paint(hood, M.hood, { tex: speckle(13, 0.16) });
  A.fill(where(ring(cx, hy + 62, 33, 37, 1.12), (_x, y) => y > hy + 20), '#e0a830');
  A.fill(where(ring(cx, hy + 62, 33, 34, 1.12), (_x, y) => y > hy + 20), '#fff0a0', 0.6);
  A.fill(oval(cx, hy + 64, 33, 39), '#100816');
  // 해골: 머리뼈
  const sy = hy + 50;
  A.paint(oval(cx, sy, 24, 23), M.bone, { sep: false, tex: speckle(14, 0.1) });
  // 광대뼈·턱
  A.paint(poly([[cx - 22, sy + 4], [cx + 22, sy + 4], [cx + 16, sy + 22], [cx - 16, sy + 22]], (u, v) => 0.1 - v * 0.6 - (u - 0.3) * 0.4), M.bone, { sep: false });
  A.paint(poly([[cx - 15, sy + 20], [cx + 15, sy + 20], [cx + 13, sy + 33], [cx - 13, sy + 33]], (u, v) => 0.1 - v * 0.7 - (u - 0.3) * 0.3), M.bone);
  // 이빨
  A.fill(box(cx - 12, sy + 19, 24, 7), '#2a1a1a');
  for (let i = 0; i < 6; i++) A.paint(box(cx - 11 + i * 4, sy + 19, 3, 3, 0.6, 0.1), M.bone, { sep: false, edge: false });
  for (let i = 0; i < 6; i++) A.paint(box(cx - 11 + i * 4, sy + 23, 3, 3, 0.3, -0.3), M.bone, { sep: false, edge: false });
  // 금니 하나
  A.paint(box(cx + 5, sy + 23, 3, 3, 0.6, 0), M.gold, { sep: false, edge: false });
  // 금 간 자국
  A.fill(rod(cx - 14, sy - 16, cx - 8, sy - 8, 1), '#6a5a48');
  A.fill(rod(cx - 8, sy - 8, cx - 10, sy - 2, 1), '#6a5a48');
  // 눈구멍
  A.fill(oval(cx - 10, sy + 2, 7.5, 6.5), '#1a0c16');
  A.fill(oval(cx + 10, sy + 2, 7.5, 6.5), '#1a0c16');
  A.fill(oval(cx - 10, sy + 1, 6, 5), '#0a0408');
  A.fill(oval(cx + 10, sy + 1, 6, 5), '#0a0408');
  // 코
  A.fill(poly([[cx - 3, sy + 10], [cx + 3, sy + 10], [cx, sy + 16]]), '#2a1a1a');
  // 눈빛
  if (!blink) {
    for (const ex of [cx - 10, cx + 10]) {
      A.fill(oval(ex, sy + 2, 2.6, 2.6), '#ffb02a');
      A.fill(box(ex - 1, sy + 1, 2, 2), '#fff4c0');
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        A.glow(ex + Math.cos(a) * 4.5, sy + 2 + Math.sin(a) * 4, '#ff9a2a', 0.35);
      }
    }
  } else {
    for (const ex of [cx - 10, cx + 10]) A.fill(box(ex - 3, sy + 2, 6, 1), '#ff9a2a');
  }
  // 외눈 안경 + 금줄
  A.paint(ring(cx + 10, sy + 2, 8, 10.5), M.gold, { sep: false });
  A.fill(oval(cx + 10, sy + 2, 7.5, 7.5), '#a8e0ff', 0.12);
  A.dot(cx + 6, sy - 2, '#ffffff');
  A.dot(cx + 7, sy - 3, '#ffffff');
  for (let i = 0; i <= 14; i++) {
    const t = i / 14;
    A.dot(cx + 19 + t * 14, sy + 6 + t * 46 + Math.sin(t * Math.PI) * 6, i % 2 ? '#e0a830' : '#fff0a0');
  }
  // 왼팔(소매) + 뼈 손: 금화 튕기기
  const coinUp = [0, 3, 8, 12, 14, 12, 8, 3][ph];
  A.paint(poly([[cx - 48, 120], [cx - 30, 116], [cx - 40, 150], [cx - 58, 150]], (u, v) => 0.3 - v * 0.5 - u * 0.3), M.hood, { tex: speckle(15) });
  A.paint(box(cx - 58, 146, 20, 6, 0.4, -0.2), M.gold);
  // 손가락 (엄지 위로)
  const hx = cx - 50;
  const hyy = 154;
  A.paint(oval(hx + 2, hyy + 2, 8, 5), M.bone);
  for (let i = 0; i < 3; i++) A.paint(rod(hx - 4 + i * 4, hyy + 4, hx - 5 + i * 4, hyy + 10, 3), M.bone);
  A.paint(rod(hx + 8, hyy, hx + 12, hyy - 5 + (ph === 1 ? -2 : 0), 3), M.bone);
  // 튕겨 오른 금화 (회전 = 너비)
  const cw = [5, 4, 2, 1, 4, 5, 2, 1][ph];
  const coinY = hyy - 12 - coinUp;
  A.paint(oval(hx + 12, coinY, Math.max(1, cw), 5), M.gold);
  if (cw >= 4) A.fill(box(hx + 11, coinY - 1, 2, 2), '#8a5a10');
  if (ph === 4) {
    A.glow(hx + 18, coinY - 4, '#ffffff', 0.9);
    A.glow(hx + 17, coinY - 4, '#fff0a0', 0.6);
    A.glow(hx + 19, coinY - 4, '#fff0a0', 0.6);
    A.glow(hx + 18, coinY - 5, '#fff0a0', 0.6);
    A.glow(hx + 18, coinY - 3, '#fff0a0', 0.6);
  }
  // 오른팔: 카운터에 얹은 뼈 손
  A.paint(poly([[cx + 30, 116], [cx + 48, 120], [cx + 58, 150], [cx + 40, 150]], (u, v) => 0.1 - v * 0.5 - u * 0.3), M.hood, { tex: speckle(16) });
  A.paint(box(cx + 38, 146, 20, 6, 0.3, -0.3), M.gold);
  A.paint(oval(cx + 48, 155, 9, 4), M.bone);
  for (let i = 0; i < 4; i++) A.paint(rod(cx + 41 + i * 4, 156, cx + 40 + i * 4, 160, 3), M.bone);
  return A.finish();
}

// ───────────── 시설 그림 ─────────────

/** 상점 노점 (144×112 — 월드 72×56) */
function shopStall(f: number): HTMLCanvasElement {
  const A = new Art(144, 112);
  const cx = 72;
  // 뒤 천막 벽
  A.paint(box(16, 22, 112, 56, -0.2, -0.6), mat('#3a2440', '#6a4a70', '#120a16'), { tex: (x, y, c) => (x % 12 < 1 ? mix(c, INK, 0.35) : speckle(21)(x, y, c)) });
  // 기둥
  A.paint(cyl(10, 18, 8, 94), M.wood, { tex: grain(1, true) });
  A.paint(cyl(126, 18, 8, 94), M.wood, { tex: grain(2, true) });
  // 뒤 선반 + 물건
  A.paint(box(18, 52, 108, 4, 0.5, -0.4), M.wood, { tex: grain(3) });
  bottle(A, 26, 52, 3.5, M.potR);
  bottle(A, 35, 52, 3, M.potB, true);
  bottle(A, 43, 52, 2.5, M.potG);
  A.paint(oval(104, 48, 3.5, 3.5), M.cyan);
  A.glow(103, 46, '#ffffff', 0.9);
  A.paint(box(100, 51, 8, 2, 0.3, -0.3), M.gold);
  // 해골 촛대
  A.paint(oval(92, 47, 4, 4), M.bone);
  A.fill(box(90, 46, 1.5, 1.5), '#1a0c14');
  A.fill(box(93, 46, 1.5, 1.5), '#1a0c14');
  A.paint(box(91, 39, 3, 5, 0.4, 0), M.cream);
  flame(A, 92.5, 39, 3, 5, f, ['#ff8a2a', '#ffd040', '#fff4c0']);
  // 상인
  merchantSmall(A, cx, 30, f);
  // 카운터 윗판·앞판
  A.paint(box(4, 68, 136, 7, 0.6, 0), M.wood, { tex: grain(4) });
  A.paint(box(8, 75, 128, 37, -0.1, -0.5), M.darkWood, { tex: (x, y, c) => ((x - 8) % 16 === 0 ? mix(c, INK, 0.5) : grain(5, true)(x, y, c)) });
  // 쇠 모서리
  for (const x of [8, 130]) {
    A.paint(box(x, 75, 6, 37, 0.3, -0.3), M.iron);
    for (const y of [79, 92, 105]) A.dot(x + 3, y, '#d0d8e8');
  }
  // 앞 휘장 (초록 + 금테 + 금화 문장)
  const dr = poly([[44, 75], [100, 75], [100, 96], [86, 102], [72, 98], [58, 102], [44, 96]], (u, v) => 0.25 - v * 0.6 + Math.sin(u * 18) * 0.25);
  A.paint(dr, M.green, { tex: speckle(22) });
  A.fill(where(dr, (x, y) => dr.t(x, y + 2) === null || dr.t(x - 2, y) === null || dr.t(x + 2, y) === null), '#e0a830');
  A.paint(oval(72, 85, 6, 6), M.gold);
  A.fill(box(70.5, 83, 3, 4), '#8a5a10');
  // 카운터 위 물건: 금화 더미, 두루마리, 저울 대신 작은 상자
  coins(A, 20, 68, 4, 4);
  coins(A, 29, 68, 2, 3.5);
  A.paint(cylH(38, 63, 12, 5), M.paper);
  A.paint(box(43, 63, 2, 5, 0, 0), M.red, { sep: false });
  A.paint(box(104, 60, 14, 8, 0.4, -0.3), M.redWood, { tex: grain(6) });
  A.paint(box(104, 57, 14, 4, 0.6, 0), M.redWood);
  A.paint(box(109, 60, 4, 4, 0.5, 0), M.gold);
  bottle(A, 126, 68, 3.5, M.potR);
  // 줄무늬 차양 (원근으로 벌어지는 줄)
  const top = 8;
  const bot = 26;
  const halfAt = (y: number): number => 58 + ((y - top) / (bot - top)) * 14;
  const stripe = (x: number, y: number): number => Math.floor(((x + 0.5 - cx) / halfAt(y)) * 5 + 50);
  const roof = poly([[cx - 58, top], [cx + 58, top], [cx + 72, bot], [cx - 72, bot]], (_u, v) => 0.5 - v * 0.6);
  const scal: Sh[] = [];
  for (let i = 0; i < 10; i++) scal.push(oval(cx - 72 + 7.2 + i * 14.4, bot, 7.2, 6, -0.3));
  const aw = union(roof, ...scal);
  A.paint(aw, M.red, { tex: speckle(23, 0.1) });
  A.paint(where(aw, (x, y) => (y <= bot ? stripe(x, y) : Math.floor((x - (cx - 72)) / 14.4) + 51) % 2 === 0), M.cream, { sep: false, edge: false, shift: -0.1 });
  A.fill(box(cx - 58, top, 116, 1), '#ffffff', 0.35);
  // 차양 위 간판 (금화)
  A.paint(box(cx - 15, 0, 30, 9, 0.5, -0.2), M.wood, { tex: grain(7) });
  A.paint(oval(cx, 4.5, 3.5, 3.5), M.gold);
  A.dot(cx - 9, 4, '#e0a830');
  A.dot(cx + 9, 4, '#e0a830');
  // 등불 (오른쪽 차양 아래)
  const lx = 120;
  for (let y = bot + 5; y < bot + 9; y++) A.glow(lx, y, '#4a4a54', 1);
  A.paint(box(lx - 4, bot + 9, 9, 2, 0.4, 0), M.iron);
  A.paint(box(lx - 3, bot + 11, 7, 9, 0.6, 0.2), mat('#ffc040', '#fff8d0', '#c06010'));
  A.paint(box(lx - 4, bot + 20, 9, 2, 0.2, -0.2), M.iron);
  A.fill(box(lx - 3, bot + 11, 1, 9), '#3a3a44');
  A.fill(box(lx + 3, bot + 11, 1, 9), '#3a3a44');
  const fl = f % 3;
  A.fill(box(lx - 1, bot + 13 + (fl === 1 ? 1 : 0), 3, 5), '#fff8e0', 0.9);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    A.glow(lx + 0.5 + Math.cos(a) * 7, bot + 15.5 + Math.sin(a) * 7, '#ffd060', 0.18 + (fl === 2 ? 0.08 : 0));
  }
  return A.finish();
}

/** 영혼 제단 / 계약의 제단(가챠) (80×96 — 월드 40×48) */
function altar(f: number, gacha: boolean): HTMLCanvasElement {
  const A = new Art(80, 96);
  const st = gacha ? M.violetStone : M.stone;
  const rune = gacha ? '#ff9af0' : '#9ef0ff';
  const crystal = gacha ? M.magenta : M.cyan;
  // 계단
  A.paint(box(2, 84, 76, 12, 0.4, -0.4), st, { tex: blocks(14, 6, 2, 84) });
  A.paint(box(10, 74, 60, 11, 0.4, -0.4), st, { tex: blocks(12, 6, 4, 74) });
  // 기둥 (아래로 갈수록 넓다)
  A.paint(poly([[24, 40], [56, 40], [60, 74], [20, 74]], (u, v) => 0.4 - u * 0.9 - v * 0.2), gacha ? M.violetStone : M.darkStone, { tex: blocks(10, 8, 20, 42) });
  // 룬 홈
  for (let i = 0; i < 4; i++) {
    const y = 46 + i * 7;
    A.fill(box(32, y, 16, 2), '#140c1c');
    if ((i + Math.floor(f / 2)) % 4 !== 0) for (let x = 33; x < 47; x += 2) A.fill(box(x, y, 1, 1), rune);
  }
  // 윗판
  A.paint(box(16, 34, 48, 7, 0.6, -0.2), st);
  A.paint(box(20, 30, 40, 5, 0.6, 0), gacha ? M.gold : st);
  // 양쪽 초
  for (const x of [12, 64]) {
    A.paint(box(x, 64, 5, 10, 0.5, -0.2), M.cream);
    flame(A, x + 2.5, 64, 4, 7, f + x, ['#ff8a2a', '#ffd040', '#fff4c0']);
  }
  // 떠 있는 결정 (위아래로 흔들림)
  const b = Math.round(Math.sin((f / 6) * Math.PI * 2) * 2);
  const cy = 15 + b;
  A.paint(poly([[40, cy - 13], [48, cy], [40, cy + 12], [32, cy]], (u, v) => 0.7 - u * 1.2 - v * 0.4), crystal);
  A.paint(poly([[40, cy - 13], [44, cy], [40, cy + 12], [37, cy]], (u) => 0.9 - u * 0.6), crystal, { sep: false, edge: false });
  A.dot(38, cy - 6, '#ffffff');
  A.dot(38, cy - 5, '#ffffff');
  // 결정 주위 빛 알갱이 (회전)
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + f * 0.5;
    const r = 15;
    A.glow(40 + Math.cos(a) * r, cy + Math.sin(a) * r * 0.45, rune, Math.sin(a) > 0 ? 0.9 : 0.45);
  }
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    A.glow(40 + Math.cos(a) * 10, cy + Math.sin(a) * 15, rune, 0.15);
  }
  return A.finish();
}

/** 무기고: 무기 걸이 + 모루 (96×96 — 월드 48×48) */
function armory(): HTMLCanvasElement {
  const A = new Art(96, 96);
  // 걸이 기둥·가로대
  A.paint(cyl(8, 24, 7, 72), M.darkWood, { tex: grain(31, true) });
  A.paint(cyl(80, 24, 7, 72), M.darkWood, { tex: grain(32, true) });
  A.paint(box(4, 22, 88, 6, 0.6, -0.2), M.wood, { tex: grain(33) });
  A.paint(box(8, 70, 80, 5, 0.5, -0.3), M.wood, { tex: grain(34) });
  // 장검
  A.paint(poly([[25, 14], [28, 4], [31, 14], [31, 54], [25, 54]], (u) => 0.8 - u * 1.4), M.steel);
  A.fill(box(27.5, 12, 1, 40), '#ffffff', 0.5);
  A.paint(box(18, 54, 20, 4, 0.6, -0.2), M.gold);
  A.paint(cyl(26, 58, 4, 12), M.leather);
  A.paint(oval(28, 72, 3, 3), M.gold);
  // 도끼
  A.paint(cyl(46, 8, 4, 64), M.wood, { tex: grain(35, true) });
  A.paint(poly([[50, 10], [60, 4], [64, 14], [62, 26], [56, 22], [50, 22]], (u, v) => 0.6 - u * 0.6 - v * 0.6), M.steel);
  A.paint(poly([[46, 10], [40, 6], [38, 16], [46, 20]], (u, v) => 0.4 - v * 0.7), M.iron);
  A.fill(rod(62, 6, 63, 24, 1), '#ffffff', 0.6);
  // 창
  A.paint(cyl(67, 10, 3, 62), M.wood, { tex: grain(36, true) });
  A.paint(poly([[68.5, -1], [73, 8], [68.5, 15], [64, 8]], (u) => 0.8 - u * 1.4), M.steel);
  A.paint(box(65, 15, 7, 3, 0.5, 0), M.red);
  // 방패 (기대어 둠)
  const sh = oval(24, 78, 15, 17);
  A.paint(sh, M.red, { tex: speckle(37) });
  A.paint(ring(24, 78, 13, 15.5, 17 / 15.5), M.iron, { sep: false });
  A.paint(where(box(9, 76, 30, 4, 0.3, -0.1), (x, y) => sh.t(x, y) !== null), M.gold, { sep: false });
  A.paint(oval(24, 78, 4, 4), M.gold);
  // 모루
  A.paint(poly([[52, 76], [88, 76], [96, 72], [90, 82], [52, 82]], (u, v) => 0.7 - v * 1.2 - u * 0.2), M.iron);
  A.paint(box(60, 82, 20, 7, 0.2, -0.5), M.iron);
  A.paint(box(54, 89, 32, 7, 0.4, -0.4), M.iron);
  A.fill(box(54, 76, 34, 1), '#c8d0e0', 0.8);
  // 망치
  A.paint(rod(62, 74, 78, 64, 3), M.wood);
  A.paint(box(76, 58, 9, 8, 0.6, -0.3), M.iron);
  return A.finish();
}

/** 모닥불 + 침낭 + 배낭 (112×64 — 월드 56×32) */
function campfire(f: number): HTMLCanvasElement {
  const A = new Art(112, 64);
  const fx = 66;
  // 침낭 (말아 둔 담요)
  A.paint(cylH(2, 44, 34, 18), M.red, { tex: speckle(41) });
  A.paint(oval(36, 53, 5, 9), M.cream);
  A.fill(ring(36, 53, 2, 3, 1.6), '#a08060');
  A.paint(box(10, 43, 3, 20, 0.2, -0.2), M.leather, { sep: false });
  A.paint(box(25, 43, 3, 20, 0.2, -0.2), M.leather, { sep: false });
  // 배낭
  A.paint(box(94, 38, 16, 24, 0.3, -0.4), M.leather, { tex: speckle(42) });
  A.paint(box(93, 36, 18, 9, 0.6, 0), M.leather);
  A.paint(box(100, 42, 4, 4, 0.5, 0), M.gold);
  A.paint(cylH(92, 32, 20, 5), M.green);
  // 장작
  A.paint(rod(fx - 16, 60, fx + 16, 50, 5), M.wood, { tex: grain(43) });
  A.paint(rod(fx - 16, 50, fx + 16, 60, 5), M.darkWood, { tex: grain(44) });
  A.paint(oval(fx + 16, 50, 2.5, 2.5), M.cream);
  A.paint(oval(fx - 16, 50, 2.5, 2.5), M.cream);
  // 돌 고리
  for (let i = 0; i < 7; i++) A.paint(oval(fx - 21 + i * 7, 60 - (i % 2), 4, 3.5), M.stone);
  // 숯불
  for (let i = 0; i < 9; i++) A.glow(fx - 8 + i * 2, 55 + (i % 2), (i + f) % 3 ? '#ff6a1a' : '#ffd040', 0.9);
  // 불꽃 (세 갈래)
  flame(A, fx, 55, 18, 34, f);
  flame(A, fx - 6, 55, 9, 18, f + 2);
  flame(A, fx + 6, 55, 9, 20, f + 4);
  // 불티
  for (let i = 0; i < 4; i++) {
    const t = ((f * 3 + i * 7) % 24) / 24;
    A.glow(fx - 6 + i * 4 + Math.sin(t * 8 + i) * 3, 22 - t * 18, '#ffd040', 1 - t);
  }
  return A.finish();
}

/** 수수께끼 비석 (64×96 — 월드 32×48) */
const QMARK = ['.####.', '##..##', '##..##', '....##', '...##.', '..##..', '..##..', '......', '..##..', '..##..'];
function obelisk(f: number): HTMLCanvasElement {
  const A = new Art(64, 96);
  A.paint(box(4, 86, 56, 10, 0.4, -0.4), M.darkStone, { tex: blocks(14, 5, 4, 86) });
  A.paint(box(10, 80, 44, 7, 0.5, -0.3), M.darkStone);
  const ob = poly([[16, 80], [48, 80], [44, 18], [32, 6], [20, 18]], (u, v) => 0.5 - u * 1.1 + v * 0.1);
  A.paint(ob, M.violetStone, { tex: speckle(51, 0.25) });
  // 금
  A.fill(rod(40, 30, 44, 44, 1), '#120c1e');
  A.fill(rod(44, 44, 41, 56, 1), '#120c1e');
  A.fill(rod(22, 62, 26, 74, 1), '#120c1e');
  // 물음표 룬 (깜빡임)
  const on = 0.55 + 0.45 * Math.sin((f / 6) * Math.PI * 2);
  for (let r = 0; r < QMARK.length; r++)
    for (let c = 0; c < 6; c++) {
      if (QMARK[r][c] !== '#') continue;
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) A.dot(26 + c * 2 + dx, 32 + r * 2 + dy, '#e0b0ff', 0.6 + on * 0.4);
    }
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    A.glow(32 + Math.cos(a) * 10, 42 + Math.sin(a) * 14, '#b070ff', 0.15 + on * 0.15);
  }
  // 떠다니는 돌 조각
  for (let i = 0; i < 3; i++) {
    const a = (f / 12) * Math.PI * 2 + (i * Math.PI * 2) / 3;
    const x = 32 + Math.cos(a) * 22;
    const y = 18 + Math.sin(a) * 5 + i * 4;
    if (Math.sin(a) < -0.3) continue; // 뒤로 돌아간 조각은 비석에 가려짐
    A.paint(poly([[x - 2.5, y], [x, y - 3], [x + 2.5, y], [x, y + 2.5]], 0.3), M.violetStone);
    A.glow(x, y + 4, '#b070ff', 0.4);
  }
  return A.finish();
}

/** 보물 상자. big = 보물방의 큰 상자 (금테·붉은 나무) */
function chest(open: boolean, big: boolean): HTMLCanvasElement {
  const W = big ? 56 : 44;
  const H = big ? 48 : 40;
  const A = new Art(W, H);
  const wood = big ? M.redWood : M.wood;
  const band = big ? M.gold : M.iron;
  const bh = big ? 22 : 18; // 몸통 높이
  const by = H - bh;
  const lidH = big ? 14 : 11;
  const bands = big ? [6, W - 12] : [6, W - 10];
  const bw = big ? 6 : 4;
  if (open) {
    // 뒤로 젖힌 뚜껑 (안쪽 면)
    A.paint(poly([[3, by + 1], [W - 3, by + 1], [W - 5, by - lidH - 4], [5, by - lidH - 4]], (_u, v) => -0.5 + v * 0.4), M.darkWood, { tex: grain(61) });
    for (const x of bands) A.paint(box(x, by - lidH - 4, bw, lidH + 5, 0.1, -0.4), band, { sep: false });
  }
  // 몸통
  A.paint(box(2, by, W - 4, bh, 0.3, -0.45), wood, { tex: (x, y, c) => ((y - by) % 6 === 0 ? mix(c, INK, 0.35) : grain(62)(x, y, c)) });
  for (const x of bands) A.paint(box(x, by, bw, bh, 0.3, -0.3), band);
  A.paint(box(2, H - 3, W - 4, 3, 0.1, -0.3), band, { sep: false });
  if (open) {
    // 안쪽 + 금은보화
    A.fill(box(4, by, W - 8, 3), '#1a0e08');
    for (let i = 0; i < (big ? 7 : 5); i++) A.paint(oval(7 + i * ((W - 14) / (big ? 6 : 4)), by - 1 + (i % 2), 3.5, 2.2), M.gold, { sep: false });
    if (big) A.paint(oval(W / 2, by - 3, 3, 3), M.potR);
    for (let i = 0; i < 6; i++) A.glow(8 + i * ((W - 16) / 5), by - 6 - (i % 3) * 3, '#fff0a0', 0.5);
  } else {
    // 둥근 뚜껑
    const lid: Sh = {
      x0: 2, y0: by - lidH, x1: W - 2, y1: by + 1,
      t: (x, y) => {
        const dx = (x + 0.5 - W / 2) / (W / 2 - 2);
        const dy = (y + 0.5 - by) / lidH;
        if (dy > 0.05 || Math.abs(dx) ** 5 + dy * dy > 1) return null;
        // 둥근 뚜껑: 위쪽 면은 밝고 앞쪽 아래로 갈수록 어둡다
        return 0.9 + dy * 0.2 - (dy + 1) * 0.9 - dx * 0.25;
      },
    };
    A.paint(lid, wood, { tex: grain(63) });
    for (const x of bands) A.paint(where(lid, (px) => px >= x && px < x + bw), band, { sep: false, shift: -0.1 });
    A.fill(box(2, by, W - 4, 1), '#1a0e08');
    // 자물쇠
    const lx = W / 2 - (big ? 5 : 4);
    A.paint(box(lx, by - 3, big ? 10 : 8, big ? 10 : 8, 0.6, -0.2), M.gold);
    A.fill(box(W / 2 - 1, by, 2, 3), '#2a1406');
    if (big) {
      A.paint(oval(W / 2, by - 9, 2.5, 2.5), M.potR);
      A.glow(W / 2 - 1, by - 10, '#ffffff', 0.9);
    }
  }
  return A.finish();
}

/** 석조 아치 문 (56×88 — 월드 28×44, 문 세 개가 두 칸 간격으로 붙어 있어도 사이가 뜨게) */
function door(open: boolean, f: number): HTMLCanvasElement {
  const W = 56;
  const cx = 28;
  const R = 28; // 바깥 아치 반지름
  const ir = 19; // 안쪽 반지름
  const ix0 = cx - ir;
  const ix1 = cx + ir;
  const HH = 88;
  const A = new Art(W, HH);
  const outer: Sh = {
    x0: 0, y0: 0, x1: W, y1: HH,
    t: (x, y) => {
      const X = x + 0.5;
      const Y = y + 0.5;
      if (Y >= R) return 0.3 - (Y / HH) * 0.5 - (X > ix1 ? 0.3 : 0);
      const d = Math.hypot(X - cx, Y - R);
      return d <= R ? 0.5 - (X - cx) / W - (d > R - 3 ? 0.2 : 0) : null;
    },
  };
  const inner: Sh = {
    x0: ix0, y0: R - ir, x1: ix1, y1: HH,
    t: (x, y) => {
      const X = x + 0.5;
      const Y = y + 0.5;
      if (X < ix0 || X > ix1) return null;
      if (Y >= R) return 0;
      return Math.hypot(X - cx, Y - R) <= ir ? 0 : null;
    },
  };
  // 아치 석재 (위는 방사형 쐐기돌, 아래는 쌓은 블록)
  A.paint(minus(outer, inner), M.stone, {
    tex: (x, y, c) => {
      const X = x + 0.5;
      const Y = y + 0.5;
      if (Y < R) {
        const a = Math.atan2(Y - R, X - cx);
        const q = ((a + Math.PI) / Math.PI) * 9;
        if (q % 1 < 0.09) return mix(c, INK, 0.55);
        const v = hash(Math.floor(q), 1, 71) - 0.5;
        return v > 0 ? mix(c, WHITE, v * 0.15) : mix(c, INK, -v * 0.3);
      }
      return blocks(9, 9, X < cx ? 0 : ix1, R)(x, y, c);
    },
  });
  // 쐐기돌
  A.paint(poly([[cx - 5, 0], [cx + 5, 0], [cx + 3, 10], [cx - 3, 10]], (u) => 0.7 - u * 0.8), M.stone);
  A.paint(oval(cx, 4, 2, 2), open ? M.magenta : M.gold, { sep: false });
  const my = 54; // 안쪽 가운데 높이
  if (open) {
    // 안쪽: 보랏빛 소용돌이
    A.paint({ ...inner, t: (x, y) => (inner.t(x, y) === null ? null : 0.6 - Math.hypot((x + 0.5 - cx) / ir, (y + 0.5 - my) / 40) * 1.6) }, mat('#3a1a6a', '#b090ff', '#08040f'), { sep: false, edge: false });
    for (let i = 0; i < 60; i++) {
      const t = i / 60;
      const a = t * Math.PI * 5 + f * 0.52;
      const r = 2 + t * 16;
      const x = cx + Math.cos(a) * r;
      const y = my + Math.sin(a) * r * 1.6;
      if (inner.t(Math.round(x), Math.round(y)) === null) continue;
      const c = i % 5 === 0 ? '#ffffff' : i % 2 ? '#c8a8ff' : '#8a5aff';
      A.glow(x, y, c, 0.5 + (1 - t) * 0.5);
      A.glow(x + 1, y, c, 0.35);
    }
    A.fill(oval(cx, my, 3, 5), '#f0e0ff', 0.7);
    // 열린 문짝 (왼쪽에 납작하게)
    A.paint(poly([[ix0, R + 2], [ix0 + 6, R + 7], [ix0 + 6, HH - 4], [ix0, HH]], (u) => 0.3 - u * 0.6), M.wood, { tex: grain(72, true) });
    A.paint(poly([[ix0, 42], [ix0 + 6, 46], [ix0 + 6, 49], [ix0, 45]], 0.2), M.iron, { sep: false });
    A.paint(poly([[ix0, 70], [ix0 + 6, 72], [ix0 + 6, 75], [ix0, 73]], 0.2), M.iron, { sep: false });
  } else {
    // 판자 문
    A.paint(inner, M.wood, { tex: (x, y, c) => ((x - ix0) % 10 === 0 ? mix(c, INK, 0.6) : grain(73, true)(x, y, c)) });
    for (const y of [40, 70]) {
      A.paint(where(box(ix0, y, ix1 - ix0, 5, 0.5, -0.3), (x, yy) => inner.t(x, yy) !== null), M.iron, { sep: false });
      for (let x = ix0 + 4; x < ix1; x += 8) A.dot(x, y + 2, '#d8e0f0');
    }
    A.paint(ring(cx + 10, 56, 2.5, 4), M.gold, { sep: false });
    A.paint(oval(cx + 10, 52, 1.6, 1.6), M.gold, { sep: false });
    A.fill(oval(cx, 24, 4, 4), '#1a0e08');
    A.fill(box(cx - 2, 20, 1, 8), '#4a4a54');
    A.fill(box(cx + 1, 20, 1, 8), '#4a4a54');
  }
  // 문턱
  A.paint(box(4, HH - 4, W - 8, 4, 0.5, -0.3), M.darkStone, { sep: false });
  return A.finish();
}

/** 안내 표지판 (40×40 — 월드 20×20) */
function sign(): HTMLCanvasElement {
  const A = new Art(40, 40);
  A.paint(cyl(17, 18, 6, 22), M.darkWood, { tex: grain(81, true) });
  A.paint(box(3, 4, 34, 17, 0.5, -0.3), M.wood, { tex: (x, y, c) => ((y - 4) % 6 === 0 ? mix(c, INK, 0.4) : grain(82)(x, y, c)) });
  A.paint(minus(box(3, 4, 34, 17, 0.6, -0.4), box(5, 6, 30, 13)), M.darkWood, { sep: false });
  for (const [x, y] of [[5, 6], [34, 6], [5, 18], [34, 18]]) A.dot(x, y, '#c8d0e0');
  A.fill(box(9, 9, 20, 1), '#3a2010');
  A.fill(box(9, 13, 14, 1), '#3a2010');
  A.fill(box(9, 16, 18, 1), '#3a2010');
  // 풀
  for (const [x, h] of [[14, 4], [16, 6], [24, 5], [26, 3]]) A.paint(box(x, 40 - h, 1, h, 0.4, -0.2), M.green, { sep: false });
  return A.finish();
}

/** 업적 비석 (64×88 — 월드 32×44) */
function stele(f: number): HTMLCanvasElement {
  const A = new Art(64, 88);
  A.paint(box(4, 78, 56, 10, 0.4, -0.4), M.darkStone, { tex: blocks(14, 5, 4, 78) });
  const body: Sh = {
    x0: 12, y0: 8, x1: 52, y1: 78,
    t: (x, y) => {
      const X = x + 0.5;
      const Y = y + 0.5;
      if (X < 12 || X > 52) return null;
      if (Y < 26 && Math.hypot(X - 32, Y - 28) > 20) return null;
      return 0.5 - ((X - 12) / 40) * 0.9 - (Y / 88) * 0.2;
    },
  };
  A.paint(body, M.stone, { tex: speckle(91, 0.2) });
  A.paint(minus(body, { ...body, t: (x, y) => (x >= 15 && x < 49 && y >= 11 && body.t(x, y - 3) !== null ? 0 : null) }), M.darkStone, { sep: false });
  // 금빛 문장 (별)
  const s = 0.75 + 0.25 * Math.sin((f / 6) * Math.PI * 2);
  const star: [number, number][] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 ? 4 : 9;
    star.push([32 + Math.cos(a) * r, 28 + Math.sin(a) * r]);
  }
  A.paint(poly(star, (u, v) => 0.7 - u * 0.6 - v * 0.6), M.gold);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    A.glow(32 + Math.cos(a) * 12, 28 + Math.sin(a) * 12, '#ffe080', 0.25 * s);
  }
  // 새긴 글줄
  for (let i = 0; i < 5; i++) {
    const w = [24, 18, 22, 16, 20][i];
    A.fill(box(32 - w / 2, 44 + i * 6, w, 2), '#2a2430');
    A.fill(box(32 - w / 2, 46 + i * 6, w, 1), '#e0c060', 0.7);
  }
  return A.finish();
}

/** 도감 독서대 (64×80 — 월드 32×40) */
function lectern(f: number): HTMLCanvasElement {
  const A = new Art(64, 80);
  A.paint(box(12, 72, 40, 8, 0.4, -0.4), M.darkWood, { tex: grain(101) });
  A.paint(cyl(26, 36, 12, 37), M.wood, { tex: grain(102, true) });
  A.paint(poly([[6, 30], [58, 22], [58, 30], [6, 38]], (u, v) => 0.4 - v * 0.8), M.darkWood, { tex: grain(103) });
  // 펼친 책
  A.paint(poly([[4, 26], [32, 22], [32, 30], [4, 34]], (u, v) => 0.2 - v * 0.6), M.red);
  A.paint(poly([[32, 22], [60, 18], [60, 26], [32, 30]], (u, v) => 0 - v * 0.6), M.red, { sep: false });
  A.paint(poly([[6, 22], [31, 17], [31, 27], [6, 31]], (u, v) => 0.8 - v * 0.6 + u * 0.2), M.paper);
  A.paint(poly([[33, 17], [58, 13], [58, 23], [33, 27]], (u, v) => 0.6 - v * 0.6 - u * 0.3), M.paper, { sep: false });
  for (let i = 0; i < 4; i++) {
    A.fill(rod(9, 24 + i * 2, 28, 20 + i * 2, 1), '#7a6a5a', 0.7);
    A.fill(rod(36, 20 + i * 2, 55, 16 + i * 2, 1), '#7a6a5a', 0.7);
  }
  // 떠오르는 빛 글자
  for (let i = 0; i < 4; i++) {
    const t = ((f * 2 + i * 6) % 24) / 24;
    A.glow(26 + i * 4 + Math.sin(t * 6 + i) * 2, 14 - t * 12, '#9ef0ff', 1 - t);
  }
  // 초
  A.paint(box(52, 62, 5, 10, 0.5, -0.2), M.cream);
  flame(A, 54.5, 62, 4, 7, f, ['#ff8a2a', '#ffd040', '#fff4c0']);
  return A.finish();
}

/** 출정의 문 (80×104 — 월드 40×52) */
function portal(f: number): HTMLCanvasElement {
  const A = new Art(80, 104);
  // 받침
  A.paint(box(8, 94, 64, 10, 0.4, -0.4), M.darkStone, { tex: blocks(14, 5, 8, 94) });
  // 안쪽 소용돌이
  A.paint({ ...oval(40, 50, 26, 40), t: (x, y) => (oval(40, 50, 26, 40).t(x, y) === null ? null : 1 - Math.hypot((x + 0.5 - 40) / 26, (y + 0.5 - 50) / 40) * 1.8) }, mat('#6a3ab0', '#e0c8ff', '#140a28'), { sep: false, edge: false });
  for (let i = 0; i < 90; i++) {
    const t = i / 90;
    const a = t * Math.PI * 6 - f * 0.52;
    const r = 2 + t * 23;
    const c = i % 5 === 0 ? '#ffffff' : i % 2 ? '#c8a8ff' : '#8a5aff';
    A.glow(40 + Math.cos(a) * r, 50 + Math.sin(a) * r * 1.5, c, 0.5 + (1 - t) * 0.5);
    A.glow(41 + Math.cos(a) * r, 50 + Math.sin(a) * r * 1.5, c, 0.3);
  }
  A.fill(oval(40, 50, 5, 8), '#f0e0ff', 0.75);
  // 돌 고리 테두리 (룬)
  A.paint(ring(40, 50, 26, 32, 40 / 26), M.violetStone, {
    tex: (x, y, c) => {
      const a = Math.atan2((y + 0.5 - 50) / (40 / 26), x + 0.5 - 40);
      return Math.abs(((a + Math.PI) / (Math.PI * 2)) * 16 % 1) < 0.07 ? mix(c, INK, 0.5) : c;
    },
  });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const on = (i + Math.floor(f / 2)) % 8 < 3;
    A.dot(40 + Math.cos(a) * 29, 50 + Math.sin(a) * 29 * (40 / 26), on ? '#e0c0ff' : '#8a6ad0');
  }
  // 위 장식 결정
  A.paint(poly([[40, 0], [45, 8], [40, 14], [35, 8]], (u) => 0.8 - u * 1.2), M.magenta);
  return A.finish();
}

/** 편성 깃발 (64×88 — 월드 32×44) */
function banner(): HTMLCanvasElement {
  const A = new Art(64, 88);
  A.paint(box(16, 82, 32, 6, 0.4, -0.4), M.darkStone);
  A.paint(cyl(30, 4, 4, 80), M.darkWood, { tex: grain(111, true) });
  A.paint(oval(32, 4, 3.5, 3.5), M.gold);
  A.paint(box(8, 8, 48, 4, 0.6, 0), M.gold);
  const fl = poly([[10, 12], [54, 12], [54, 66], [42, 58], [32, 68], [22, 58], [10, 66]], (u, v) => 0.3 - v * 0.6 + Math.sin(u * 10) * 0.25);
  A.paint(fl, M.blue, { tex: speckle(112) });
  A.fill(where(fl, (x, y) => fl.t(x, y + 3) === null || fl.t(x - 3, y) === null || fl.t(x + 3, y) === null), '#e0b040');
  // 교차한 두 검 문장
  A.paint(rod(22, 46, 42, 22, 3), M.steel);
  A.paint(rod(42, 46, 22, 22, 3), M.steel);
  A.paint(rod(19, 42, 27, 50, 2), M.gold, { sep: false });
  A.paint(rod(45, 42, 37, 50, 2), M.gold, { sep: false });
  A.paint(oval(32, 34, 4, 4), M.gold);
  return A.finish();
}

/** 육성 결정 (64×80 — 월드 32×40) */
function crystals(f: number): HTMLCanvasElement {
  const A = new Art(64, 80);
  A.paint(box(10, 70, 44, 10, 0.4, -0.4), M.darkStone, { tex: blocks(11, 5, 10, 70) });
  const shard = (x: number, by: number, w: number, h: number, lean: number, m: Mat): void => {
    A.paint(poly([[x - w, by], [x - w + lean * 0.3, by - h * 0.7], [x + lean, by - h], [x + w + lean * 0.3, by - h * 0.7], [x + w, by]], (u, v) => 0.8 - u * 1.3 + v * 0.1), m);
    A.paint(poly([[x - w * 0.2, by], [x + lean, by - h], [x + w * 0.4 + lean * 0.3, by - h * 0.6], [x + w * 0.3, by]], (u) => 0.9 - u * 0.5), m, { sep: false, edge: false });
  };
  shard(20, 72, 6, 26, -5, M.cyan);
  shard(44, 72, 6, 30, 5, M.cyan);
  shard(32, 72, 9, 56, 0, M.cyan);
  A.dot(29, 30, '#ffffff');
  A.dot(29, 31, '#ffffff');
  for (let i = 0; i < 5; i++) {
    const t = ((f * 2 + i * 5) % 24) / 24;
    A.glow(18 + i * 7, 60 - t * 50, '#c0ffff', 1 - t);
  }
  return A.finish();
}

/** 영구 강화 모루 (80×64 — 월드 40×32) */
function forge(f: number): HTMLCanvasElement {
  const A = new Art(80, 64);
  A.paint(poly([[6, 22], [62, 22], [78, 16], [68, 30], [12, 30]], (u, v) => 0.7 - v * 1.2 - u * 0.2), M.iron);
  A.fill(box(6, 22, 58, 1), '#d0d8e8', 0.8);
  A.paint(box(20, 30, 32, 14, 0.2, -0.5), M.iron);
  A.paint(box(10, 44, 52, 8, 0.4, -0.4), M.iron);
  A.paint(box(4, 52, 64, 12, 0.3, -0.5), M.darkWood, { tex: grain(121) });
  // 달군 쇠
  const hot = (f % 6) / 6;
  A.paint(box(22, 17, 24, 5, 0.6, 0), mat('#ff6a1a', '#fff0a0', '#8a1a04'));
  for (let i = 0; i < 4; i++) {
    const t = (hot + i / 4) % 1;
    A.glow(26 + i * 5, 14 - t * 12, '#ffd040', 1 - t);
  }
  // 망치
  A.paint(rod(52, 12, 70, 0, 3), M.wood);
  A.paint(box(46, 6, 10, 9, 0.6, -0.3), M.iron);
  return A.finish();
}

// ───────────── 목록·캐시 ─────────────

const DRAW: Record<string, (f: number) => HTMLCanvasElement> = {
  shop: (f) => shopStall(f % 48),
  altar: (f) => altar(f % 6, false),
  gacha: (f) => altar(f % 6, true),
  armory: () => armory(),
  rest: (f) => campfire(f % 12),
  event: (f) => obelisk(f % 12),
  chest: () => chest(false, false),
  chest_open: () => chest(true, false),
  chest_big: () => chest(false, true),
  chest_big_open: () => chest(true, true),
  door_closed: () => door(false, 0),
  door_open: (f) => door(true, f % 12),
  sign: () => sign(),
  stele: (f) => stele(f % 6),
  book: (f) => lectern(f % 12),
  portal: (f) => portal(f % 12),
  banner: () => banner(),
  crystal: (f) => crystals(f % 12),
  anvil: (f) => forge(f % 6),
};

const cache = new Map<string, HTMLCanvasElement>();

/** 시설 고해상도 그림 (월드 크기의 2배). 정의가 없으면 null */
export function propHD(kind: string, f = 0): HTMLCanvasElement | null {
  const fn = DRAW[kind];
  if (!fn || typeof document === 'undefined') return null;
  const k = `${kind}:${f}`;
  let c = cache.get(k);
  if (!c) {
    c = fn(f);
    cache.set(k, c);
  }
  return c;
}

/**
 * 시설을 고해상도 층에 그린다. (x, groundY) = 월드 화면 좌표의 바닥 가운데.
 * 고해상도를 쓰지 않는 화면이거나 그림이 없으면 false → 호출한 쪽이 기존 방식으로 그린다.
 */
export function drawPropHD(kind: string, f: number, x: number, groundY: number, alpha = 1): boolean {
  if (hdState.off) return false;
  const img = propHD(kind, f);
  if (!img) return false;
  const w = img.width / 2;
  const h = img.height / 2;
  hdQueue.push({ img, x: Math.round(x), y: Math.round(groundY) - h / 2, flip: false, alpha, fx: { sx: 0, sy: 0, sw: img.width, sh: img.height, w, h, ang: 0, add: false, squash: 1 } });
  return true;
}

const bigCache = new Map<number, HTMLCanvasElement>();
/** 상점 화면의 큰 해골 상인 (176×160, UI 88×80칸). f = 0~7 프레임 */
export function merchantHD(f: number): HTMLCanvasElement {
  const k = ((f % 48) + 48) % 48;
  let c = bigCache.get(k);
  if (!c) {
    c = merchantBig(k);
    bigCache.set(k, c);
  }
  return c;
}

// ───────────── 상점 화면 배경 ─────────────

let backdrop: HTMLCanvasElement | null = null;
/**
 * 상점 화면 왼쪽 무대 배경 (472×448 — UI 236×224칸): 줄무늬 차양, 판자 벽, 양쪽 선반과 잡화.
 * 상인은 이 위에, 카운터(shopCounterHD)는 상인 앞에 그린다.
 */
export function shopBackdropHD(): HTMLCanvasElement {
  if (backdrop) return backdrop;
  const A = new Art(472, 448);
  // 판자 벽
  A.paint(box(0, 40, 472, 408, -0.1, -0.7), mat('#4a2e22', '#8a5a40', '#140a06'), {
    edge: false,
    tex: (x, y, c) => ((x % 28 === 0 || x % 28 === 1) ? mix(c, INK, 0.5) : grain(131, true)(x, y, c)),
  });
  // 선반 두 단 × 양쪽
  const shelf = (x: number, y: number, w: number, seed: number): void => {
    A.paint(box(x, y, w, 8, 0.6, -0.2), M.wood, { tex: grain(seed) });
    A.paint(box(x, y + 8, w, 4, -0.2, -0.6), M.darkWood);
    A.paint(poly([[x + 6, y + 12], [x + 14, y + 12], [x + 8, y + 22]], -0.3), M.darkWood);
    A.paint(poly([[x + w - 14, y + 12], [x + w - 6, y + 12], [x + w - 8, y + 22]], -0.3), M.darkWood);
  };
  shelf(8, 148, 124, 132);
  shelf(340, 148, 124, 133);
  shelf(8, 228, 124, 134);
  shelf(340, 228, 124, 135);
  // 위 선반 물건 (왼쪽)
  bottle(A, 26, 148, 8, M.potR);
  bottle(A, 48, 148, 7, M.potB, true);
  bottle(A, 70, 148, 6, M.potG);
  A.paint(box(84, 120, 10, 28, 0.4, -0.3), M.red, { tex: speckle(136) });
  A.paint(box(94, 116, 10, 32, 0.4, -0.3), M.blue);
  A.paint(box(104, 124, 9, 24, 0.4, -0.3), M.green);
  A.paint(box(113, 128, 12, 20, 0.4, -0.3), M.leather);
  for (const x of [84, 94, 104, 113]) A.fill(box(x + 2, 132, 5, 2), '#e0a830', 0.8);
  // 위 선반 물건 (오른쪽): 해골, 수정 구슬, 모래시계
  A.paint(oval(362, 134, 12, 12), M.bone);
  A.paint(box(354, 140, 16, 8, 0.2, -0.4), M.bone);
  A.fill(oval(357, 134, 3.5, 3.5), '#1a0c14');
  A.fill(oval(367, 134, 3.5, 3.5), '#1a0c14');
  A.fill(box(357, 142, 10, 1), '#5a4c3a');
  A.paint(box(388, 142, 22, 6, 0.4, -0.3), M.gold);
  A.paint(oval(399, 130, 12, 12), M.cyan);
  A.dot(394, 124, '#ffffff');
  A.dot(395, 124, '#ffffff');
  A.dot(394, 125, '#ffffff');
  A.paint(box(424, 112, 22, 4, 0.5, 0), M.darkWood);
  A.paint(box(424, 144, 22, 4, 0.5, 0), M.darkWood);
  A.paint(poly([[428, 116], [442, 116], [436, 130], [442, 144], [428, 144], [434, 130]], (u) => 0.7 - u), mat('#c8e0f0', '#ffffff', '#4a6070'));
  A.fill(poly([[431, 140], [439, 140], [442, 144], [428, 144]]), '#e0c080');
  // 아래 선반 물건: 자루, 두루마리, 단지
  A.paint(oval(36, 212, 20, 16), mat('#a8885a', '#e0c890', '#3a2a14'), { tex: speckle(137) });
  A.paint(box(28, 192, 16, 6, 0.4, -0.2), mat('#a8885a', '#e0c890', '#3a2a14'));
  A.fill(box(26, 197, 20, 2), '#5a3a1a');
  for (let i = 0; i < 3; i++) A.paint(cylH(64, 214 - i * 9, 30, 9), M.paper);
  A.paint(box(76, 196, 4, 32, 0, 0), M.red, { sep: false });
  A.paint(oval(112, 212, 12, 15), mat('#5a7a8a', '#a8d0e0', '#14242a'));
  A.paint(box(104, 194, 16, 5, 0.5, -0.2), mat('#5a7a8a', '#a8d0e0', '#14242a'));
  bottle(A, 360, 228, 9, M.potR);
  bottle(A, 386, 228, 7, M.potG, true);
  coins(A, 412, 228, 6, 9);
  coins(A, 440, 228, 3, 8);
  // 매달린 등불 두 개 (빛은 화면에서 따로)
  for (const lx of [40, 432]) {
    for (let y = 40; y < 56; y += 3) A.paint(oval(lx, y, 1.5, 1.5), M.iron, { sep: false });
    A.paint(box(lx - 9, 56, 18, 4, 0.5, 0), M.iron);
    A.paint(box(lx - 7, 60, 14, 18, 0.6, 0.3), mat('#ffc040', '#fff8d0', '#c06010'));
    A.fill(box(lx - 7, 60, 2, 18), '#3a3a44');
    A.fill(box(lx + 5, 60, 2, 18), '#3a3a44');
    A.fill(box(lx - 2, 64, 4, 10), '#fff8e0', 0.9);
    A.paint(box(lx - 9, 78, 18, 4, 0.2, -0.2), M.iron);
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2;
      A.glow(lx + Math.cos(a) * 14, 69 + Math.sin(a) * 14, '#ffd060', 0.15);
    }
  }
  // 줄무늬 차양
  const sc: Sh[] = [];
  for (let i = 0; i < 17; i++) sc.push(oval(14 + i * 26.6, 40, 14, 10, -0.3));
  const aw = union(box(0, 0, 472, 40, 0.5, -0.1), ...sc);
  A.paint(aw, M.red, { tex: speckle(138, 0.1) });
  A.paint(where(aw, (x) => Math.floor((x + 13) / 26.6) % 2 === 1), M.cream, { sep: false, edge: false, shift: -0.1 });
  A.paint(box(0, 0, 472, 6, 0.6, 0.2), M.darkWood, { tex: grain(139) });
  backdrop = A.finish(false);
  return backdrop;
}

let counter: HTMLCanvasElement | null = null;
/**
 * 상점 카운터 앞판 (472×184 — UI 236×92칸). 윗판 + 3열 2단 유리 진열칸.
 * 진열칸 안쪽 자리: UI 기준 (8 + i·76, 22 + 행·36) 크기 68×32 — 오버레이가 이 위에 물건을 그린다.
 */
export const COUNTER_SLOT = { x0: 8, y0: 20, w: 68, h: 32, gx: 8, gy: 4 };
export function shopCounterHD(): HTMLCanvasElement {
  if (counter) return counter;
  const A = new Art(472, 184);
  // 윗판
  A.paint(box(0, 0, 472, 14, 0.7, 0), M.wood, { tex: grain(141) });
  A.paint(box(0, 14, 472, 6, -0.1, -0.6), M.darkWood);
  // 앞판
  A.paint(box(0, 20, 472, 164, -0.1, -0.55), M.darkWood, { tex: (x, y, c) => (y % 18 === 0 ? mix(c, INK, 0.4) : grain(142)(x, y, c)) });
  // 진열칸 (안쪽 벨벳 + 금테)
  const S = COUNTER_SLOT;
  for (let r = 0; r < 2; r++)
    for (let c = 0; c < 3; c++) {
      const x = (S.x0 + c * (S.w + S.gx)) * 2;
      const y = (S.y0 + r * (S.h + S.gy)) * 2;
      const w = S.w * 2;
      const h = S.h * 2;
      A.paint(box(x - 4, y - 4, w + 8, h + 8, 0.6, -0.4), M.gold);
      A.paint(box(x, y, w, h, -0.3, -0.8), r === 0 ? mat('#3a1e4a', '#6a4a88', '#0e0616') : mat('#1e3a2e', '#4a7a60', '#06120c'), { tex: speckle(143 + r * 3 + c, 0.2) });
      // 유리 반사 빗금
      for (let i = 0; i < 10; i++) {
        A.dot(x + 6 + i, y + 3 + i, '#ffffff', 0.18);
        A.dot(x + 11 + i, y + 3 + i, '#ffffff', 0.1);
      }
    }
  // 아래 굽 + 쇠 모서리
  A.paint(box(0, 176, 472, 8, 0.2, -0.6), M.darkWood);
  for (const x of [0, 460]) A.paint(box(x, 20, 12, 164, 0.3, -0.3), M.iron);
  counter = A.finish(false);
  return counter;
}
