import { CREATURES, type Pal } from './creatures';
import { OUTLINE } from './pixel';

/**
 * 비인간형 적(생물형) 고해상도(2배 정밀) 그림. 96×96 칸, 발 y=88 — 48칸 그림(creatures.ts·sprites.ts DRAW)과
 * 같은 자리·같은 몸 크기·같은 동작(대기 흔들림·이동 주기·예고 웅크림·공격 돌진·피격)을 2배 정밀로 다시 그린다.
 * 색은 48칸과 같은 적별 팔레트(a 본색·b 밝은 색·c 어두운 색·e 눈·강조색)를 쓴다.
 *
 * 그리는 방식 (hdHero.ts·weaponArt.ts와 같은 계열):
 *  - 부위마다 마스크(모양)를 만들고, 마스크 안쪽 거리장으로 높이(둥근 정도 r)를 만들어 법선을 구한 뒤
 *    왼쪽 위 광원으로 5단계 음영 + 4×4 정렬 디더 (구체·원통·각진 판 모두 같은 규칙으로 입체가 생긴다)
 *  - 이미 그려진 다른 부위와 맞닿은 가장자리 = 짙은 구분선
 *  - 털·돌·나무껍질·비늘 같은 결은 음영값을 흔드는 텍스처 함수로
 *  - 전체 실루엣에 공용 1px 외곽선(#0a0810), 그 위에 외곽선 없는 빛 효과(눈빛·불씨·반짝임)
 * 좌표는 48칸 단위(소수 가능)로 적고 내부에서 2배 한다 — 48칸 그림과 자리를 맞추기 쉽게.
 */

const W = 96;
const K = 2;
type RGB = [number, number, number];
type Pt = [number, number];
type Ramp = RGB[];

// ───────────── 색 ─────────────
const rgbCache = new Map<string, RGB>();
function rgb(c: string): RGB {
  let v = rgbCache.get(c);
  if (!v) {
    v = [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
    rgbCache.set(c, v);
  }
  return v;
}
const toHex = (r: number, g: number, b: number): string =>
  `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
function mix(a: string, b: string, t: number): string {
  const x = rgb(a);
  const y = rgb(b);
  return toHex(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t);
}
/** 밝게 (따뜻한 빛 쪽으로) */
const lt = (c: string, f: number): string => mix(c, '#fff8ec', f);
/** 어둡게 (차가운 보라 그림자 쪽으로) */
const dk = (c: string, f: number): string => mix(c, '#140c24', f);
const lum = (c: string): number => {
  const [r, g, b] = rgb(c);
  return (r * 0.3 + g * 0.59 + b * 0.11) / 255;
};
/** 5단계 음영: 어두운 쪽부터 [짙은 그림자, lo, base, 중간 밝음, hi] */
function ramp(lo: string, base: string, hi: string): Ramp {
  return [dk(lo, 0.45), lo, base, mix(base, hi, 0.55), hi].map(rgb);
}
const u32 = (c: RGB): number => ((255 << 24) | (Math.round(c[2]) << 16) | (Math.round(c[1]) << 8) | Math.round(c[0])) >>> 0;
const RED = '#ff3030';

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
function hash(x: number, y: number, s = 0): number {
  let h = (x * 374761393 + y * 668265263 + s * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// ───────────── 마스크 (좌표: 48칸 단위 → 픽셀) ─────────────
class Mask {
  m = new Uint8Array(W * W);
  x0 = W;
  y0 = W;
  x1 = -1;
  y1 = -1;
  private erase = false;
  constructor(
    public ox: number,
    public oy: number,
  ) {}
  private set(x: number, y: number): void {
    if (x < 0 || y < 0 || x >= W || y >= W) return;
    if (this.erase) {
      this.m[y * W + x] = 0;
      return;
    }
    this.m[y * W + x] = 1;
    if (x < this.x0) this.x0 = x;
    if (x > this.x1) this.x1 = x;
    if (y < this.y0) this.y0 = y;
    if (y > this.y1) this.y1 = y;
  }
  has(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < W && y < W && this.m[y * W + x] === 1;
  }
  /** 48칸 좌표 → 픽셀 좌표 */
  X(u: number): number {
    return (u + this.ox) * K;
  }
  Y(v: number): number {
    return (v + this.oy) * K;
  }
  /** 픽셀 중심 → 48칸 좌표 */
  U(x: number): number {
    return (x + 0.5) / K - this.ox;
  }
  V(y: number): number {
    return (y + 0.5) / K - this.oy;
  }
  /** 48칸 좌표 상자 안의 픽셀마다 test(u, v) */
  test(ua: number, va: number, ub: number, vb: number, t: (u: number, v: number) => boolean): this {
    const xa = Math.max(0, Math.floor(this.X(ua)) - 1);
    const xb = Math.min(W - 1, Math.ceil(this.X(ub)) + 1);
    const ya = Math.max(0, Math.floor(this.Y(va)) - 1);
    const yb = Math.min(W - 1, Math.ceil(this.Y(vb)) + 1);
    for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) if (t(this.U(x), this.V(y))) this.set(x, y);
    return this;
  }
  ellipse(cx: number, cy: number, rx: number, ry: number, rot = 0): this {
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    const r = Math.max(rx, ry);
    return this.test(cx - r, cy - r, cx + r, cy + r, (u, v) => {
      const dx = u - cx;
      const dy = v - cy;
      const a = (dx * c + dy * s) / rx;
      const b = (-dx * s + dy * c) / ry;
      return a * a + b * b <= 1;
    });
  }
  disc(cx: number, cy: number, r: number): this {
    return this.ellipse(cx, cy, r, r);
  }
  /** 두 점 사이 굵은 선 (반지름 r0 → r1) */
  cap(ax: number, ay: number, bx: number, by: number, r0: number, r1 = r0): this {
    const rm = Math.max(r0, r1);
    const vx = bx - ax;
    const vy = by - ay;
    const ll = vx * vx + vy * vy || 1;
    return this.test(Math.min(ax, bx) - rm, Math.min(ay, by) - rm, Math.max(ax, bx) + rm, Math.max(ay, by) + rm, (u, v) => {
      const px = u - ax;
      const py = v - ay;
      const t = Math.max(0, Math.min(1, (px * vx + py * vy) / ll));
      const dx = px - vx * t;
      const dy = py - vy * t;
      const r = r0 + (r1 - r0) * t;
      return dx * dx + dy * dy <= r * r;
    });
  }
  path(pts: Pt[], r0: number, r1 = r0): this {
    const n = pts.length - 1;
    for (let i = 0; i < n; i++) this.cap(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], r0 + ((r1 - r0) * i) / n, r0 + ((r1 - r0) * (i + 1)) / n);
    return this;
  }
  poly(pts: Pt[]): this {
    let ua = Infinity;
    let ub = -Infinity;
    let va = Infinity;
    let vb = -Infinity;
    for (const p of pts) {
      ua = Math.min(ua, p[0]);
      ub = Math.max(ub, p[0]);
      va = Math.min(va, p[1]);
      vb = Math.max(vb, p[1]);
    }
    return this.test(ua, va, ub, vb, (u, v) => {
      let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i];
        const [xj, yj] = pts[j];
        if (yi > v !== yj > v && u < ((xj - xi) * (v - yi)) / (yj - yi) + xi) inside = !inside;
      }
      return inside;
    });
  }
  rect(x: number, y: number, w: number, h: number): this {
    return this.test(x, y, x + w, y + h, (u, v) => u >= x && u < x + w && v >= y && v < y + h);
  }
  /** 고리: 바깥 타원(rx, ry)에서 두께 t만큼. keep(u, v)이 거짓인 곳은 뺀다 (앞·뒤 반쪽 나누기) */
  ring(cx: number, cy: number, rx: number, ry: number, t: number, keep?: (u: number, v: number) => boolean): this {
    return this.test(cx - rx, cy - ry, cx + rx, cy + ry, (u, v) => {
      const dx = u - cx;
      const dy = v - cy;
      const o = (dx / rx) ** 2 + (dy / ry) ** 2;
      const i = (dx / Math.max(0.1, rx - t)) ** 2 + (dy / Math.max(0.1, ry - t)) ** 2;
      return o <= 1 && i > 1 && (!keep || keep(u, v));
    });
  }
  /** 안에서 그린 모양을 빼낸다 */
  cut(f: (m: this) => void): this {
    this.erase = true;
    f(this);
    this.erase = false;
    return this;
  }
  /** test가 거짓인 픽셀을 지운다 */
  clip(t: (u: number, v: number) => boolean): this {
    for (let y = Math.max(0, this.y0); y <= this.y1; y++) for (let x = Math.max(0, this.x0); x <= this.x1; x++) if (this.m[y * W + x] && !t(this.U(x), this.V(y))) this.m[y * W + x] = 0;
    return this;
  }
}

// ───────────── 래스터 ─────────────
interface PaintOpt {
  /** 둥근 정도 (픽셀): 클수록 공처럼, 작으면 모서리만 깎인 판 */
  r?: number;
  /** 디더 세기 */
  dither?: number;
  /** 다른 부위와 맞닿은 곳에 구분선 (기본 켬) */
  line?: boolean;
  /** 음영값(0~1)을 흔드는 결 */
  tex?: (x: number, y: number, v: number) => number;
  /** 가장 밝은 곳의 반사광 색 */
  spec?: string;
  /** 음영 대비 */
  gain?: number;
  /** 위쪽일수록 밝게 하는 정도 */
  bias?: number;
  /** 음영 없이 한 단계로 */
  flat?: number;
}

const LX = -0.5;
const LY = -0.62;
const LZ = 0.6;
const LN = Math.hypot(LX, LY, LZ);
const L: [number, number, number] = [LX / LN, LY / LN, LZ / LN];

class Art {
  buf = new Uint32Array(W * W);
  part = new Uint16Array(W * W);
  pid = 0;
  fx: { x: number; y: number; c: RGB; a: number }[] = [];
  /** 몸 전체 이동 (48칸 단위) — 피격 움찔·돌진 */
  ox = 0;
  oy = 0;
  m(): Mask {
    return new Mask(this.ox, this.oy);
  }
  X(u: number): number {
    return Math.round((u + this.ox) * K - 0.5);
  }
  Y(v: number): number {
    return Math.round((v + this.oy) * K - 0.5);
  }

  paint(m: Mask, rp: Ramp, o: PaintOpt = {}): void {
    if (m.x1 < 0) return;
    const id = ++this.pid;
    const R = o.r ?? 7;
    const gain = o.gain ?? 1.05;
    const dither = o.dither ?? 0.55;
    const bias = o.bias ?? 0.12;
    const bx = m.x0 - 1;
    const by = m.y0 - 1;
    const bw = m.x1 - m.x0 + 3;
    const bh = m.y1 - m.y0 + 3;
    const d = new Float32Array(bw * bh);
    for (let j = 0; j < bh; j++) for (let i = 0; i < bw; i++) d[j * bw + i] = m.has(bx + i, by + j) ? 1e6 : 0;
    const S2 = 1.414;
    for (let j = 1; j < bh; j++) {
      for (let i = 1; i < bw - 1; i++) {
        const k = j * bw + i;
        if (!d[k]) continue;
        d[k] = Math.min(d[k], d[k - 1] + 1, d[k - bw] + 1, d[k - bw - 1] + S2, d[k - bw + 1] + S2);
      }
    }
    for (let j = bh - 2; j >= 0; j--) {
      for (let i = bw - 2; i >= 1; i--) {
        const k = j * bw + i;
        if (!d[k]) continue;
        d[k] = Math.min(d[k], d[k + 1] + 1, d[k + bw] + 1, d[k + bw + 1] + S2, d[k + bw - 1] + S2);
      }
    }
    const hgt = (k: number): number => {
      const v = d[k];
      if (v <= 0) return 0;
      if (v >= R) return R;
      return Math.sqrt(R * R - (R - v) * (R - v));
    };
    const line = rgb(dk(toHex(...rp[0]), 0.35));
    const spec = o.spec ? rgb(o.spec) : null;
    const out: number[] = [];
    for (let j = 1; j < bh - 1; j++) {
      for (let i = 1; i < bw - 1; i++) {
        const k = j * bw + i;
        if (!d[k]) continue;
        const x = bx + i;
        const y = by + j;
        let c: RGB;
        let touch = false;
        if (o.line !== false) {
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const xx = x + dx;
            const yy = y + dy;
            if (m.has(xx, yy) || xx < 0 || yy < 0 || xx >= W || yy >= W) continue;
            const q = yy * W + xx;
            if (this.buf[q] && this.part[q] !== id) {
              touch = true;
              break;
            }
          }
        }
        if (touch) c = line;
        else if (o.flat !== undefined) c = rp[Math.max(0, Math.min(rp.length - 1, o.flat))];
        else {
          const gx = (hgt(k + 1) - hgt(k - 1)) / 2;
          const gy = (hgt(k + bw) - hgt(k - bw)) / 2;
          const nl = Math.hypot(gx, gy, 1);
          const ndl = (-gx * L[0] - gy * L[1] + L[2]) / nl;
          let v = 0.5 + (ndl - L[2]) * gain + (0.5 - j / bh) * bias;
          if (o.tex) v = o.tex(x, y, v);
          const s = v * 4 + (BAYER[(y & 3) * 4 + (x & 3)] / 16 - 0.5) * dither;
          const idx = Math.max(0, Math.min(4, Math.round(s)));
          c = spec && v > 0.97 ? spec : rp[idx];
        }
        out.push(y * W + x, u32(c));
      }
    }
    for (let q = 0; q < out.length; q += 2) {
      this.buf[out[q]] = out[q + 1];
      this.part[out[q]] = id;
    }
  }
  /** 한 픽셀 (픽셀 좌표) */
  px(x: number, y: number, c: string): void {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= W || y >= W) return;
    this.buf[y * W + x] = u32(rgb(c));
  }
  /** 이미 칠해진 곳에만 (픽셀 좌표) */
  on(x: number, y: number, c: string): void {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= W || y >= W || !this.buf[y * W + x]) return;
    this.buf[y * W + x] = u32(rgb(c));
  }
  /** 48칸 좌표의 한 픽셀 */
  dot(u: number, v: number, c: string): void {
    this.px(this.X(u), this.Y(v), c);
  }
  /** 48칸 좌표의 칠해진 곳 위 한 픽셀 */
  dotOn(u: number, v: number, c: string): void {
    this.on(this.X(u), this.Y(v), c);
  }
  /** 48칸 좌표 선 (칠해진 곳 위에만 그릴지 선택) */
  ln(ua: number, va: number, ub: number, vb: number, c: string, onlyOn = true): void {
    let x0 = this.X(ua);
    let y0 = this.Y(va);
    const x1 = this.X(ub);
    const y1 = this.Y(vb);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (let i = 0; i < 300; i++) {
      if (onlyOn) this.on(x0, y0, c);
      else this.px(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }
  /** 외곽선 없는 빛 한 점 (픽셀 좌표) */
  glowPx(x: number, y: number, c: string, a = 1): void {
    this.fx.push({ x: Math.round(x), y: Math.round(y), c: rgb(c), a });
  }
  /** 둥근 빛 번짐 (48칸 좌표, 반지름 r) */
  halo(u: number, v: number, r: number, c: string, a = 0.4): void {
    const cx = (u + this.ox) * K;
    const cy = (v + this.oy) * K;
    const R = r * K;
    for (let y = Math.floor(cy - R); y <= Math.ceil(cy + R); y++) {
      for (let x = Math.floor(cx - R); x <= Math.ceil(cx + R); x++) {
        const t = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / R;
        if (t >= 1) continue;
        const k = (1 - t) * (1 - t) * a;
        // 거친 픽셀 느낌: 알파를 4단계로
        const q = Math.round(k * 4 + (BAYER[(y & 3) * 4 + (x & 3)] / 16 - 0.5)) / 4;
        if (q > 0) this.glowPx(x, y, c, Math.min(1, q));
      }
    }
  }
  /** 반짝임 (+ 모양) */
  sparkle(u: number, v: number, c: string, big = false): void {
    const x = this.X(u);
    const y = this.Y(v);
    this.glowPx(x, y, '#ffffff', 1);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) this.glowPx(x + dx, y + dy, c, 0.85);
    if (big) for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) this.glowPx(x + dx, y + dy, c, 0.45);
  }
  /**
   * 눈: (u, v) 중심, 반지름 r(48칸), 빛나는 눈이면 번짐까지.
   * 밝은 색은 빛나는 눈, 어두운 색은 반짝임만 있는 검은 눈.
   */
  eye(u: number, v: number, col: string, o: { r?: number; glow?: boolean; shut?: boolean } = {}): void {
    const r = o.r ?? 1;
    if (o.shut) {
      this.ln(u - r, v, u + r, v + 0.3, dk(col, 0.6), false);
      return;
    }
    const bright = lum(col) > 0.45;
    const m = this.m().ellipse(u, v, r, r * 1.05);
    this.paint(m, ramp(dk(col, 0.25), col, lt(col, 0.6)), { r: 3, line: false, gain: 0.6 });
    this.dot(u - r * 0.35, v - r * 0.4, bright ? '#ffffff' : lt(col, 0.7));
    if (bright && o.glow !== false) this.halo(u, v, r * 3, col, 0.4);
  }

  finish(): HTMLCanvasElement {
    const b = this.buf;
    const o = u32(rgb(OUTLINE));
    const ring: number[] = [];
    for (let y = 0; y < W; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (b[i]) continue;
        if ((x > 0 && b[i - 1]) || (x < W - 1 && b[i + 1]) || (y > 0 && b[i - W]) || (y < W - 1 && b[i + W])) ring.push(i);
      }
    }
    for (const i of ring) b[i] = o;
    const c = document.createElement('canvas');
    c.width = c.height = W;
    const g = c.getContext('2d')!;
    const img = g.createImageData(W, W);
    const d = img.data;
    new Uint32Array(d.buffer).set(b);
    for (const f of this.fx) {
      if (f.x < 0 || f.y < 0 || f.x >= W || f.y >= W) continue;
      const i = (f.y * W + f.x) * 4;
      const ia = d[i + 3] / 255;
      if (ia === 0) {
        d[i] = f.c[0];
        d[i + 1] = f.c[1];
        d[i + 2] = f.c[2];
        d[i + 3] = Math.round(255 * f.a);
      } else {
        for (let k = 0; k < 3; k++) d[i + k] = d[i + k] + (f.c[k] - d[i + k]) * f.a;
        d[i + 3] = Math.max(d[i + 3], Math.round(255 * f.a));
      }
    }
    g.putImageData(img, 0, 0);
    return c;
  }
}

// ───────────── 결 (텍스처) ─────────────
/** 고른 잡음 */
const noise = (amt: number, seed = 1) => (x: number, y: number, v: number): number => v + (hash(x, y, seed) - 0.5) * amt;
/** 돌: 2px 덩어리 잡음 + 가는 금 */
const stone = (seed = 3) => (x: number, y: number, v: number): number => {
  let t = v + (hash(x >> 1, y >> 1, seed) - 0.5) * 0.2;
  if (hash(x >> 2, y >> 2, seed + 9) > 0.9 && ((x + y) & 1) === 0) t -= 0.3;
  return t;
};
/** 털: 비스듬한 짧은 결 */
const fur = (seed = 5) => (x: number, y: number, v: number): number => {
  const h = hash(x + (y >> 1) * 3, y >> 1, seed);
  return v + (h > 0.86 ? -0.24 : h < 0.08 ? 0.18 : 0);
};
/** 비늘·깃털: 엇갈린 반달 무늬 */
const scales = (sz = 4, amt = 0.28) => (x: number, y: number, v: number): number => {
  const row = Math.floor(y / sz);
  const xx = x + (row & 1 ? sz / 2 : 0);
  const fx = (xx % sz) / sz - 0.5;
  const fy = (y % sz) / sz;
  return v + (fy > 0.7 - Math.abs(fx) * 0.8 ? -amt : 0);
};
/** 나무껍질: 세로 결 */
const bark = (seed = 7) => (x: number, y: number, v: number): number => {
  const w = Math.round(Math.sin(y * 0.35 + x * 0.2) * 1.2);
  const k = (x + w) % 5;
  return v + (k === 0 ? -0.32 : k === 2 ? 0.1 : 0) + (hash(x, y >> 2, seed) - 0.5) * 0.12;
};
const both = (a: (x: number, y: number, v: number) => number, b: (x: number, y: number, v: number) => number) => (x: number, y: number, v: number): number => b(x, y, a(x, y, v));

// ───────────── 팔레트에서 재질 ─────────────
interface Mats {
  body: Ramp;
  dark: Ramp;
  light: Ramp;
  acc: Ramp;
}
function mats(c: Pal): Mats {
  return {
    body: ramp(c.c, c.a, c.b),
    dark: ramp(dk(c.c, 0.3), c.c, mix(c.c, c.a, 0.6)),
    light: ramp(mix(c.a, c.c, 0.3), mix(c.a, c.b, 0.55), lt(c.b, 0.45)),
    acc: ramp(dk(c.e, 0.35), c.e, lt(c.e, 0.55)),
  };
}

const bob = (f: number, k = 1): number => Math.sin(f * 1.57) * k;

interface Var {
  /** devourer: 큰 이빨 입 */
  maw?: boolean;
  /** lost_soul: 검은 눈·입 */
  soul?: boolean;
  /** moth: 독가루 색 */
  dust?: string;
  /** fire_sprite: 불꽃 꼬리 */
  flame?: boolean;
  /** magma_golem: 용암 */
  lava?: boolean;
  /** forge_hound: 불꽃 갈기 */
  fire?: boolean;
  /** void_eye: 아래로 늘어진 촉수 */
  below?: boolean;
}

type Fam = (A: Art, c: Pal, M: Mats, anim: string, f: number, o: Var) => void;

const eyeCol = (c: Pal, anim: string): string => (anim === 'wind' ? RED : c.e);

/** 박쥐 날개막: 어깨→손목→손가락 끝들, 손가락 사이는 오목하게 */
function batWing(A: Art, M: Mats, sx: number, sy: number, wx: number, wy: number, tips: Pt[], back: Pt, s: number, memb: Ramp): void {
  const pts: Pt[] = [[sx, sy - 1], [wx, wy], ...tips, back];
  const m = A.m().poly(pts);
  const chain: Pt[] = [...tips, back];
  m.cut((q) => {
    for (let i = 0; i < chain.length - 1; i++) {
      const [ax, ay] = chain[i];
      const [bx, by] = chain[i + 1];
      const mx = (ax + bx) / 2;
      const my = (ay + by) / 2;
      const dl = Math.hypot(bx - ax, by - ay);
      // 손목 반대쪽(아래)으로 오목하게
      const nx = mx - wx;
      const ny = my - wy;
      const nn = Math.hypot(nx, ny) || 1;
      q.disc(mx + (nx / nn) * dl * 0.42, my + (ny / nn) * dl * 0.42, dl * 0.52);
    }
  });
  A.paint(m, memb, { r: 3, tex: noise(0.12, 11) });
  // 손가락 뼈
  const bone = A.m().cap(sx, sy, wx, wy, 0.85, 0.6);
  for (const t of tips) bone.cap(wx, wy, t[0], t[1], 0.5, 0.25);
  A.paint(bone, M.body, { r: 2, line: false });
  // 엄지 발톱
  A.dot(wx + s * 0.3, wy - 0.9, '#f0e8e0');
}

// ───────────── 가족별 그리기 ─────────────
const FAM: Record<string, Fam> = {
  bat(A, c, M, anim, f) {
    const cy = 28 + bob(f, 2) + (anim === 'atk' ? 3 : 0);
    const up = f % 2 === 0 ? -5 : 1;
    const memb = ramp(dk(c.c, 0.35), c.c, mix(c.c, c.a, 0.55));
    for (const s of [-1, 1]) {
      const wx = 24 + s * 12;
      const wy = cy - 3 + up;
      batWing(A, M, 24 + s * 3, cy - 0.5, wx, wy, [[24 + s * 17, cy + 3 + up], [24 + s * 13, cy + 5 + up * 0.8], [24 + s * 8.5, cy + 4.5 + up * 0.4]], [24 + s * 3.5, cy + 3], s, memb);
    }
    // 귀
    for (const s of [-1, 1]) {
      const e = A.m().poly([[24 + s * 1.2, cy - 3], [24 + s * 2.8, cy - 8.5], [24 + s * 3.8, cy - 2.5]]);
      A.paint(e, M.body, { r: 2 });
      A.dotOn(24 + s * 2.5, cy - 5, dk(c.c, 0.3));
      A.dotOn(24 + s * 2.6, cy - 4.2, dk(c.c, 0.3));
    }
    A.paint(A.m().ellipse(24, cy + 0.5, 4.3, 4.7), M.body, { r: 7, tex: fur(5) });
    A.paint(A.m().ellipse(24, cy + 2.2, 2.6, 2.6), M.light, { r: 5, line: false, tex: fur(6) });
    // 발
    A.dot(23, cy + 5.4, dk(c.c, 0.2));
    A.dot(25, cy + 5.4, dk(c.c, 0.2));
    const ec = eyeCol(c, anim);
    A.eye(22.4, cy - 1, ec, { r: 0.9, shut: anim === 'hurt' });
    A.eye(25.6, cy - 1, ec, { r: 0.9, shut: anim === 'hurt' });
    A.dot(24, cy + 0.6, dk(c.c, 0.5));
    // 송곳니
    A.dot(23.2, cy + 1.6, '#f4f0e8');
    A.dot(24.8, cy + 1.6, '#f4f0e8');
  },

  swarm(A, c, M, anim, f) {
    const ec = eyeCol(c, anim);
    const memb = ramp(dk(c.c, 0.3), c.c, mix(c.c, c.a, 0.6));
    const bs = Array.from({ length: 5 }, (_, i) => ({
      x: 14 + ((i * 7 + f * 3) % 20),
      y: 20 + ((i * 11 + f * 2) % 16) + (anim === 'atk' ? 3 : 0),
      up: (f + i) % 2 === 0 ? -2 : 1,
    })).sort((a, b) => a.y - b.y);
    for (const { x, y, up } of bs) {
      for (const s of [-1, 1]) {
        const m = A.m().poly([[x + s * 0.8, y - 0.8], [x + s * 4, y - 0.8 + up], [x + s * 5.6, y + up + 0.6], [x + s * 4, y + up * 0.4 + 0.8], [x + s * 2.6, y + 1.2], [x + s * 1, y + 1]]);
        A.paint(m, memb, { r: 2 });
      }
      A.paint(A.m().ellipse(x, y, 1.7, 1.5).poly([[x - 1.4, y - 0.6], [x - 1.1, y - 2.6], [x - 0.2, y - 1]]).poly([[x + 1.4, y - 0.6], [x + 1.1, y - 2.6], [x + 0.2, y - 1]]), M.body, { r: 3, tex: fur(2) });
      A.dot(x - 0.6, y - 0.4, ec);
      A.dot(x + 0.6, y - 0.4, ec);
      if (lum(ec) > 0.45) {
        A.glowPx(A.X(x - 0.6), A.Y(y - 0.4) - 1, ec, 0.4);
        A.glowPx(A.X(x + 0.6), A.Y(y - 0.4) - 1, ec, 0.4);
      }
    }
  },

  scorpion(A, c, M, anim, f) {
    const run = anim === 'move' || anim === 'atk' ? f % 2 : 0;
    const tail = anim === 'wind' ? -4 : anim === 'atk' ? 6 : 0;
    const legR = M.dark;
    // 먼 쪽 다리
    for (let i = 0; i < 3; i++) {
      const lift = (run + i) % 2;
      const hx = 17 + i * 5;
      A.paint(A.m().path([[hx, 39], [hx - 2.6, 37.6], [hx - 3.8, 44 - lift]], 0.7, 0.35), ramp(dk(c.c, 0.5), dk(c.c, 0.25), c.c), { r: 2 });
    }
    // 먼 쪽 집게
    A.paint(A.m().cap(28.5, 38, 33.5, 37.2, 0.9, 0.8), legR, { r: 2 });
    A.paint(A.m().ellipse(35.4, 36.6, 2.1, 1.4, -0.2).poly([[36, 35.6], [38.6, 35.6], [36.4, 36.6]]), legR, { r: 3 });
    // 꼬리 마디 (뒤에서부터)
    const P0: Pt = [14, 37];
    const P1: Pt = [6.5, 29.5];
    const P2: Pt = [11 + tail, 22.5];
    const bz = (t: number): Pt => [(1 - t) ** 2 * P0[0] + 2 * (1 - t) * t * P1[0] + t * t * P2[0], (1 - t) ** 2 * P0[1] + 2 * (1 - t) * t * P1[1] + t * t * P2[1]];
    const segs = 6;
    for (let i = 0; i < segs; i++) {
      const [x, y] = bz(i / (segs - 1));
      A.paint(A.m().disc(x, y, 2.3 - i * 0.16), M.body, { r: 4, spec: lt(c.b, 0.5) });
    }
    // 독침
    const sx = 16.5 + tail;
    const sy = 22;
    A.paint(A.m().cap(P2[0], P2[1], sx, sy, 1.4, 1.2), M.body, { r: 3 });
    A.paint(A.m().ellipse(sx + 1, sy + 0.3, 1.9, 1.5, 0.3), M.acc, { r: 4, spec: '#ffffff' });
    A.paint(A.m().poly([[sx + 2.2, sy - 0.4], [sx + 4.4, sy + 1.6], [sx + 2.4, sy + 1.6]]), ramp(dk(c.c, 0.5), c.c, c.a), { r: 1 });
    A.halo(sx + 1, sy + 0.3, 3.5, c.e, 0.35);
    // 몸통
    const body = A.m().ellipse(22, 38, 9, 4.2).clip((_, v) => v < 41.6);
    A.paint(body, M.body, { r: 6, spec: lt(c.b, 0.4), tex: noise(0.1, 4) });
    for (const sx2 of [15.5, 18.5, 21.5, 24.5]) A.ln(sx2, 34.4, sx2 - 0.6, 41.4, dk(c.c, 0.2));
    // 머리
    A.paint(A.m().ellipse(29.6, 37.6, 3.4, 2.8), M.body, { r: 5, spec: lt(c.b, 0.4) });
    // 가까운 쪽 다리
    for (let i = 0; i < 3; i++) {
      const lift = (run + i + 1) % 2;
      const hx = 19.5 + i * 5;
      A.paint(A.m().path([[hx, 40], [hx + 2.6, 38.3], [hx + 3.6, 44 - lift]], 0.75, 0.35), legR, { r: 2 });
    }
    // 가까운 쪽 집게
    const op = anim === 'wind' ? 1.2 : anim === 'atk' ? 0.2 : 0.6;
    A.paint(A.m().path([[30, 37.4], [33.4, 35.8], [36, 34.2]], 1.1, 0.9), M.body, { r: 3 });
    A.paint(A.m().ellipse(37.6, 33.2, 2.7, 1.9, -0.3), M.light, { r: 4, spec: '#ffffff' });
    A.paint(A.m().path([[39, 32.1], [41, 31.3 - op], [42, 31.8 - op]], 0.8, 0.3), M.light, { r: 2 });
    A.paint(A.m().path([[39, 34.1], [41.2, 34 + op * 0.4], [42, 33.4 + op * 0.4]], 0.7, 0.3), M.body, { r: 2 });
    A.eye(30.6, 36.3, anim === 'wind' ? RED : '#201010', { r: 0.7, shut: anim === 'hurt' });
    A.dot(31.8, 36.9, anim === 'wind' ? RED : '#201010');
  },

  spider(A, c, M, anim, f) {
    const sq = anim === 'wind' ? 2 : anim === 'atk' ? -2 : bob(f);
    const cy = 37 + sq;
    const far = ramp(dk(c.c, 0.55), dk(c.c, 0.3), c.c);
    const leg = (i: number, near: boolean): void => {
      const k = (f + i + (near ? 0 : 1)) % 2;
      const hx = (near ? 25.6 : 26.4) + i * 1;
      const kx = (near ? 12 : 14) + i * 5;
      const fx = (near ? 10 : 12) + i * 6;
      const ky = cy - (near ? 5 : 6) + k;
      A.paint(A.m().path([[hx, cy + 1.5], [kx, ky], [fx, 44]], 0.85, 0.35), near ? M.dark : far, { r: 2 });
      if (near) A.dotOn(kx, ky - 0.4, lt(c.a, 0.2));
    };
    for (let i = 0; i < 4; i++) leg(i, false);
    // 배
    A.paint(A.m().ellipse(18.6, cy - 0.6, 7.4, 5.6), M.body, { r: 9, gain: 0.85, bias: 0.25, spec: lt(c.b, 0.55), tex: noise(0.08, 2) });
    // 무늬
    for (const [x, y, r] of [[16.5, cy - 3.2, 1], [19.6, cy - 3.8, 1.1], [14, cy - 1.6, 0.8]] as [number, number, number][]) {
      A.paint(A.m().ellipse(x, y, r * 1.3, r * 0.8), M.acc, { r: 2, line: false });
    }
    A.ln(13, cy + 1, 22, cy + 2.4, dk(c.c, 0.2));
    for (let i = 0; i < 4; i++) leg(i, true);
    // 머리가슴
    A.paint(A.m().ellipse(28.6, cy + 0.8, 4.6, 3.4), M.body, { r: 6, spec: lt(c.b, 0.4) });
    // 엄니
    A.paint(A.m().path([[31.6, cy + 2.6], [32.6, cy + 4.4], [31.8, cy + 5.2]], 0.6, 0.3), M.light, { r: 2 });
    const ec = anim === 'wind' ? RED : c.e;
    A.eye(31, cy - 0.6, ec, { r: 0.75, shut: anim === 'hurt' });
    A.eye(32.4, cy + 0.6, ec, { r: 0.6, shut: anim === 'hurt' });
    A.dot(29.8, cy - 1.4, ec);
    A.dot(30.4, cy + 0.6, ec);
  },

  gargoyle(A, c, M, anim, f) {
    const flap = f % 2 === 0 ? -6 : 0;
    const y = 28 + bob(f, 2) + (anim === 'atk' ? 4 : 0);
    const st = stone(4);
    const wingR = ramp(dk(c.c, 0.4), c.c, mix(c.c, c.a, 0.6));
    const wing = (dx: number, dy: number, r: Ramp): void => {
      const wx = 10 + dx;
      const wy = y - 10.5 + flap + dy;
      batWing(A, M, 22 + dx, y - 2 + dy, wx, wy, [[7 + dx, y + 2.5 + dy + flap * 0.15], [11.5 + dx, y + 2 + dy + flap * 0.1], [16 + dx, y + 1.5 + dy]], [21 + dx, y + 1 + dy], -1, r);
    };
    wing(3.5, -1.2, ramp(dk(c.c, 0.6), dk(c.c, 0.35), c.c));
    // 꼬리
    A.paint(A.m().path([[20, y + 6], [16, y + 9], [13, y + 11.6], [10.6, y + 11]], 1.2, 0.5).poly([[11.4, y + 10], [8.6, y + 10.2], [9.6, y + 12.6]]), M.dark, { r: 3 });
    // 뒷다리 (먼 쪽)
    A.paint(A.m().path([[27, y + 6.5], [28.4, y + 9.5], [27.8, y + 12.2], [29.6, y + 12.6]], 1.3, 0.6), wingR, { r: 3, tex: st });
    // 몸
    A.paint(A.m().ellipse(24, y + 2, 5.4, 6.4), M.body, { r: 8, tex: st });
    A.paint(A.m().ellipse(25.6, y + 1.6, 2.8, 3.6), M.light, { r: 5, line: false, tex: st });
    // 가까운 다리
    A.paint(A.m().path([[21.5, y + 6.5], [19.6, y + 9.6], [20.4, y + 12.2], [22.2, y + 12.6]], 1.5, 0.7), M.body, { r: 3, tex: st });
    A.dot(22.6, y + 12.6, '#e8e0d0');
    A.dot(30, y + 12.8, '#e8e0d0');
    // 머리
    A.paint(A.m().poly([[24.4, y - 7.6], [29.8, y - 8], [32.2, y - 5.6], [32, y - 3], [29.2, y - 1.8], [25, y - 2.6]]), M.body, { r: 4, tex: st });
    A.ln(27.6, y - 6.2, 31.4, y - 6.2, dk(c.c, 0.2));
    // 뿔
    A.paint(A.m().path([[25.8, y - 7.2], [24.4, y - 10], [22.4, y - 11]], 0.9, 0.3), M.light, { r: 2 });
    A.paint(A.m().path([[29, y - 7.6], [29.4, y - 10], [28.6, y - 11.6]], 0.8, 0.3), M.light, { r: 2 });
    // 입·이빨
    A.ln(28.6, y - 3.4, 32, y - 3.4, dk(c.c, 0.5));
    A.dot(30, y - 3, '#f0ecdf');
    A.dot(31.2, y - 3, '#f0ecdf');
    A.eye(29.6, y - 5.2, eyeCol(c, anim), { r: 0.8, shut: anim === 'hurt' });
    // 앞 날개
    wing(0, 0, wingR);
    // 팔 (발톱)
    A.paint(A.m().path([[23.6, y + 1], [27, y + 3.8], [30, y + 3]], 1.3, 0.8), M.body, { r: 3, tex: st });
    A.dot(30.8, y + 2.6, '#f0ecdf');
    A.dot(31, y + 3.4, '#f0ecdf');
  },

  golem(A, c, M, anim, f, o) {
    const arm = anim === 'wind' ? -12 : anim === 'atk' ? 6 : bob(f);
    const st = stone(o.lava ? 8 : 6);
    // 다리
    for (const x of [17, 27]) {
      A.paint(A.m().rect(x, 37, 5, 5.4), M.dark, { r: 3, tex: st });
      A.paint(A.m().rect(x - 0.6, 42, 6.2, 2), M.body, { r: 2, tex: st });
    }
    // 몸통 (모서리 깎인 바위)
    const torso = A.m().poly([[15.4, 22], [32.6, 22], [34.4, 24], [34, 36.6], [31.4, 38.6], [16.6, 38.6], [14, 36.6], [13.6, 24]]);
    A.paint(torso, M.body, { r: 5, tex: st, spec: o.lava ? undefined : lt(c.b, 0.4) });
    A.ln(15, 30.5, 22, 31.2, dk(c.c, 0.15));
    A.ln(26, 32, 33.6, 31, dk(c.c, 0.15));
    // 빛나는 금
    const glowC = c.e;
    const cracks: [number, number, number, number][] = o.lava
      ? [[18, 26, 24, 32], [24, 32, 30, 27], [22, 34, 26, 37]]
      : [[18, 27, 22, 33], [30, 26, 26, 31]];
    for (const [a, b, cc, d] of cracks) {
      A.ln(a, b, cc, d, glowC);
      A.ln(a + 0.5, b, cc + 0.5, d, lt(glowC, 0.4));
      const n = 5;
      for (let i = 0; i <= n; i++) A.halo(a + ((cc - a) * i) / n, b + ((d - b) * i) / n, 1.6, glowC, 0.25);
    }
    // 팔 (어깨 바위 + 팔뚝 + 주먹)
    for (const s of [-1, 1]) {
      const x = s < 0 ? 8 : 34;
      const ay = 22 + arm;
      A.paint(A.m().poly([[x + 0.6, ay], [x + 5.4, ay], [x + 6, ay + 2], [x + 5.6, ay + 11], [x + 0.4, ay + 11], [x, ay + 2]]), M.body, { r: 4, tex: st });
      A.paint(A.m().ellipse(x + 3 - s * 0.6, ay + 1.4, 3.8, 2.8), M.light, { r: 5, tex: st });
      A.paint(A.m().poly([[x - 0.4, ay + 10], [x + 6.4, ay + 10], [x + 7.2, ay + 12], [x + 6.8, ay + 15.2], [x - 0.8, ay + 15.2], [x - 1.2, ay + 12]]), M.light, { r: 3, tex: st });
      for (let i = 1; i < 4; i++) A.ln(x - 0.8 + i * 2, ay + 12.6, x - 0.8 + i * 2, ay + 15, dk(c.c, 0.1));
      if (o.lava) A.halo(x + 3, ay + 6, 1.5, glowC, 0.4);
    }
    // 머리
    A.paint(A.m().poly([[18.6, 15], [29.4, 15], [30.2, 16.4], [30, 22.6], [18, 22.6], [17.8, 16.4]]), M.light, { r: 4, tex: st });
    A.ln(18.4, 17.6, 29.6, 17.6, dk(c.c, 0.05));
    const ec = anim === 'wind' ? RED : c.e;
    for (const ex of [21, 26]) {
      const m = A.m().rect(ex, 18.2, 2, 1.6);
      A.paint(m, ramp(dk(ec, 0.2), ec, lt(ec, 0.6)), { r: 2, line: false });
      A.halo(ex + 1, 19, 2.4, ec, 0.45);
    }
    A.ln(21.6, 21.2, 26.6, 21.2, dk(c.c, 0.4));
    // 결정 뿔
    A.paint(A.m().poly([[20, 15.4], [21.2, 9.4], [23.2, 15.4]]), M.light, { r: 1.5, spec: '#ffffff' });
    A.paint(A.m().poly([[25.8, 15.4], [27, 11.6], [28.2, 15.4]]), M.light, { r: 1.5, spec: '#ffffff' });
    if (o.lava) for (let i = 0; i < 3; i++) A.sparkle(16 + i * 8 + (f % 2) * 2, 12 - ((f + i) % 3) * 2, '#ffa02a');
  },

  treant(A, c, M, anim, f) {
    const arm = anim === 'wind' ? -10 : anim === 'atk' ? 6 : bob(f);
    const bk = bark(7);
    const leaf = ramp(dk(c.c, 0.45), c.c, lt(c.c, 0.3));
    // 뿌리 발
    for (const s of [-1, 1]) {
      const x = 24 + s * 7;
      A.paint(A.m().poly([[x - 3, 39], [x + 3, 39], [x + 3.4 + s * 1.5, 44], [x - 3.4 + s * 1.5, 44]]).cap(x + s * 2, 43, x + s * 5, 44, 0.8), M.body, { r: 3, tex: bk });
    }
    // 팔 가지
    for (const s of [-1, 1]) {
      const sx = 24 + s * 6.5;
      const ex = 24 + s * 16;
      const ey = 20 + arm;
      A.paint(A.m().path([[sx, 26], [ex, ey], [24 + s * 19, 15 + arm]], 1.7, 0.6).cap(ex, ey, 24 + s * 18.2, ey + 2.4, 0.6, 0.3), M.body, { r: 3, tex: bk });
      A.paint(A.m().disc(24 + s * 19, 14.2 + arm, 1.6).disc(24 + s * 17.2, 15.6 + arm, 1.2), leaf, { r: 3, tex: noise(0.3, 9) });
    }
    // 줄기
    A.paint(A.m().poly([[17.4, 17.6], [30.6, 17.6], [31.4, 37], [33, 40.6], [15, 40.6], [16.6, 37]]), M.body, { r: 6, tex: bk });
    A.ln(24, 31.5, 24.6, 40.4, dk(c.c, 0.3));
    // 잎 머리
    const can = A.m().disc(16, 12.5, 5.2).disc(24, 9, 6.8).disc(32, 12.5, 5.2).disc(20, 15, 4.6).disc(28, 15, 4.6).disc(24, 14, 5);
    A.paint(can, leaf, {
      r: 9,
      tex: (x, y, v) => {
        const h = hash(x >> 1, y >> 1, 21);
        return v + (h > 0.78 ? 0.3 : h < 0.22 ? -0.3 : 0);
      },
    });
    for (let i = 0; i < 5; i++) A.dotOn(15 + i * 4.5, 8 + ((i * 3) % 5), lt(c.c, 0.55));
    // 얼굴: 옹이 눈, 입
    const ec = anim === 'wind' ? RED : c.e;
    for (const ex of [21, 27]) {
      A.paint(A.m().ellipse(ex, 24, 1.7, 1.3), ramp('#140c18', '#1e1420', '#2a1e2a'), { r: 2 });
      if (anim !== 'hurt') {
        A.dot(ex - 0.2, 24, ec);
        A.dot(ex + 0.3, 24, ec);
        A.halo(ex, 24, 2.4, ec, 0.4);
      }
    }
    A.paint(A.m().poly([[20.6, 29.6], [27.4, 29.6], [26.4, 31.4], [24, 30.8], [21.4, 31.4]]), ramp('#140c18', '#1e1420', '#2a1e2a'), { r: 2 });
  },

  wisp(A, c, M, anim, f, o) {
    const cy = 28 + bob(f, 2);
    const k = anim === 'wind' ? 2 : 0;
    A.halo(24, cy, 11 + k, c.a, 0.32);
    // 불꽃 몸: 원 + 위로 흔들리는 혀
    const fl = Math.sin(f * 1.57) * 1.4;
    const m = A.m().disc(24, cy, 6.2 + k);
    m.poly([[18.6 - k, cy - 2], [22 + fl * 0.5, cy - 8 - k], [24 + fl, cy - 12.5 - k], [25.4 + fl * 0.6, cy - 8.5 - k], [29.4 + k, cy - 2]]);
    m.poly([[19.4, cy - 3.4], [18.2 - fl * 0.4, cy - 8 - k * 0.5], [21.6, cy - 5.6]]);
    m.poly([[26.6, cy - 4.4], [29.6 + fl * 0.3, cy - 8.6 - k * 0.5], [29.2, cy - 2.6]]);
    A.paint(m, M.body, { r: 9, spec: '#ffffff', gain: 0.9 });
    A.paint(A.m().ellipse(23.2, cy - 1.2, 3.4 + k * 0.5, 3.8 + k * 0.5), ramp(c.a, mix(c.a, c.b, 0.6), '#ffffff'), { r: 6, line: false, gain: 0.7 });
    A.halo(23.4, cy - 1.4, 5, c.b, 0.3);
    // 도는 반짝임
    for (let i = 0; i < 4; i++) {
      const a = f * 0.8 + i * 1.57;
      A.sparkle(24 + Math.cos(a) * (10 + k), cy + Math.sin(a) * (8 + k), c.b, i === 0);
    }
    // 아래로 흩어지는 불씨
    for (let i = 0; i < 3; i++) {
      const x = A.X(22 + i * 2);
      const y = A.Y(cy + 7 + ((f + i) % 3));
      A.glowPx(x, y, c.b, 0.9);
      A.glowPx(x + 1, y, c.a, 0.6);
      A.glowPx(x, y + 1, c.a, 0.5);
    }
    if (o.flame) for (let i = 0; i < 4; i++) A.sparkle(20 + i * 3 + ((f + i) % 2), cy - 10 - ((f + i) % 3) - k, i % 2 ? '#ff8a2a' : '#ffd040');
    // 눈
    const ec = anim === 'wind' ? RED : c.e;
    for (const ex of [21.6, 26.4]) {
      if (anim === 'hurt') {
        A.ln(ex - 0.8, cy - 0.4, ex + 0.8, cy + 0.2, ec, false);
        continue;
      }
      A.paint(A.m().ellipse(ex, cy, 0.95, 1.4), ramp(dk(ec, 0.3), ec, lt(ec, 0.35)), { r: 2, line: false });
      A.dot(ex - 0.3, cy - 0.6, '#ffffff');
    }
  },

  plant(A, c, M, anim, f) {
    const puff = anim === 'wind' ? 2 : anim === 'atk' ? -1 : bob(f) * 0.5;
    // 줄기
    A.paint(A.m().path([[23.6, 44], [24.4, 38], [23.8, 32], [24, 29]], 1.3, 0.9), M.dark, { r: 3 });
    for (const s of [-1, 1]) {
      // 잎
      const lm = A.m().ellipse(24 + s * 5.6, 38.6, 4.6, 1.9, s * -0.35);
      A.paint(lm, M.body, { r: 4 });
      A.ln(24 + s * 1.6, 39.6, 24 + s * 9, 37, dk(c.c, 0.2));
      // 가시 덩굴
      const tip: Pt = [24 + s * 10, 31.6 - puff];
      A.paint(A.m().path([[24, 36], [24 + s * 5.4, 33.4 - puff * 0.5], tip], 0.65, 0.4), M.dark, { r: 2 });
      for (const t of [0.35, 0.65]) {
        const x = 24 + s * 10 * t;
        const y = 35 - t * 3.6 - puff * t;
        A.dot(x, y - 0.8, lt(c.c, 0.4));
      }
      A.paint(A.m().disc(tip[0], tip[1] - 0.4, 1.3), M.acc, { r: 3, spec: '#ffffff' });
      A.halo(tip[0], tip[1] - 0.4, 2.6, c.e, 0.3);
    }
    // 머리 (꽃봉오리)
    const hy = 26 - puff;
    const rx = 7 + puff;
    const ry = 6 + puff;
    A.paint(A.m().ellipse(24, hy, rx, ry), M.body, {
      r: 9,
      spec: lt(c.b, 0.5),
      tex: (x, _y, v) => v + ((x % 6) === 0 ? -0.2 : 0),
    });
    // 머리 위 가시
    for (let i = 0; i < 5; i++) {
      const x = 18 + i * 3;
      const y = hy - ry + 1 - (i % 2) * 1.5 + Math.abs(i - 2) * 0.8;
      const lean = (i - 2) * 0.7;
      A.paint(A.m().poly([[x - 1, y + 1.4], [x + lean, y - 2.4], [x + 1, y + 1.4]]), M.acc, { r: 1.5 });
    }
    // 입
    const mc = anim === 'wind' ? RED : '#201010';
    A.paint(A.m().ellipse(24, hy + 1.6, 2.8, anim === 'atk' ? 1.8 : 1.3), ramp('#100810', mc, lt(mc, 0.2)), { r: 2 });
    for (const x of [22.4, 23.6, 24.8, 26]) A.dotOn(x, hy + 0.9, '#f4f0e0');
    A.eye(21.6, hy - 1.8, '#201010', { r: 0.7, shut: anim === 'hurt' });
    A.eye(26.4, hy - 1.8, '#201010', { r: 0.7, shut: anim === 'hurt' });
  },

  jelly(A, c, M, anim, f) {
    const cy = 24 + bob(f, 2);
    const pulse = anim === 'wind' ? 2 : f % 2;
    const tent = ramp(mix(c.c, c.a, 0.3), mix(c.a, c.b, 0.3), c.b);
    // 촉수
    for (let i = 0; i < 5; i++) {
      const x = 18 + i * 3;
      const len = 10 + (i % 2) * 4;
      const pts: Pt[] = [];
      for (let y = 0; y <= len; y += 2) pts.push([x + Math.sin((y + f * 2 + i) * 0.6) * 1.1, cy + 4.6 + y]);
      A.paint(A.m().path(pts, 0.75, 0.3), tent, { r: 2, line: false });
    }
    // 입 팔 (주름 띠)
    for (const s of [-1, 1]) {
      const pts: Pt[] = [];
      for (let y = 0; y <= 8; y += 2) pts.push([24 + s * 1.4 + Math.sin(y * 0.8 + f * 1.6 + s) * 0.8, cy + 4 + y]);
      A.paint(A.m().path(pts, 1.2, 0.5), M.light, { r: 3, line: false, tex: noise(0.2, 3) });
    }
    // 갓
    const bell = A.m().ellipse(24, cy, 8 + pulse, 6.2).clip((_, v) => v <= cy + 3.6);
    A.paint(bell, ramp(c.c, c.a, lt(c.b, 0.2)), { r: 10, spec: '#ffffff', gain: 0.95 });
    // 안쪽 기관 (비침)
    A.paint(A.m().ellipse(24, cy + 0.8, 3.6, 2), ramp(c.a, mix(c.a, c.b, 0.5), c.b), { r: 3, line: false, gain: 0.5 });
    A.halo(24, cy + 0.8, 4, c.e, 0.25);
    // 가장자리 주름
    const fr = A.m();
    for (let x = 16.4 - pulse; x <= 31.6 + pulse; x += 1.9) fr.disc(x, cy + 4.1, 1.15);
    A.paint(fr, M.dark, { r: 2 });
    // 무늬 줄
    for (const dx of [-4.4, 0, 4.4]) A.ln(24 + dx * 0.5, cy - 5, 24 + dx * (1 + pulse * 0.08), cy + 3, mix(c.a, c.b, 0.5));
    const ec = anim === 'wind' ? RED : c.e;
    A.eye(21, cy + 0.4, ec, { r: 0.9, shut: anim === 'hurt' });
    A.eye(27, cy + 0.4, ec, { r: 0.9, shut: anim === 'hurt' });
    if (anim === 'atk') for (let i = 0; i < 4; i++) A.sparkle(16 + i * 5, cy + 18, c.e, true);
  },

  armillary(A, c, M, anim, f) {
    const cy = 26 + bob(f, 1);
    const k = anim === 'wind' ? 2 : 0;
    const R = 10 + k;
    const brass = ramp(c.c, c.a, lt(c.b, 0.2));
    // 받침
    A.paint(A.m().cap(24, cy + 10.5, 24, cy + 16.2, 0.9), M.dark, { r: 2 });
    A.paint(A.m().poly([[20.6, cy + 15.8], [27.4, cy + 15.8], [28.6, cy + 18.2], [19.4, cy + 18.2]]), brass, { r: 2, spec: '#ffffff' });
    // 뒤쪽 고리 반쪽
    A.paint(A.m().ring(24, cy, R, 3.2, 1, (_, v) => v < cy), M.dark, { r: 2 });
    A.paint(A.m().ring(24, cy, 3.2, R, 1, (u) => u > 24), M.dark, { r: 2 });
    // 뒤쪽 구슬
    const beads = [0, 1, 2].map((i) => {
      const a = f * 0.9 + i * 2.1;
      return { x: 24 + Math.cos(a) * R, y: cy + Math.sin(a) * 3.2, front: Math.sin(a) > 0 };
    });
    for (const b of beads) if (!b.front) A.paint(A.m().disc(b.x, b.y, 1.1), M.dark, { r: 2 });
    // 중심 구슬
    A.halo(24, cy, 6, c.e, 0.4);
    A.paint(A.m().disc(24, cy, 3.3), M.acc, { r: 6, spec: '#ffffff' });
    A.dot(23.2, cy - 1.2, '#ffffff');
    // 바깥 큰 고리
    const outer = A.m().ring(24, cy, R + 0.6, R + 0.6, 1.4);
    A.paint(outer, brass, { r: 2, spec: '#ffffff' });
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      A.dotOn(24 + Math.cos(a) * (R - 0.1), cy + Math.sin(a) * (R - 0.1), dk(c.c, 0.3));
    }
    // 앞쪽 고리 반쪽
    A.paint(A.m().ring(24, cy, R, 3.2, 1, (_, v) => v >= cy), brass, { r: 2, spec: '#ffffff' });
    A.paint(A.m().ring(24, cy, 3.2, R, 1, (u) => u <= 24), brass, { r: 2, spec: '#ffffff' });
    for (const b of beads) if (b.front) A.paint(A.m().disc(b.x, b.y, 1.2), M.light, { r: 3, spec: '#ffffff' });
    if (anim === 'wind') A.sparkle(24, cy, c.e, true);
  },

  eye(A, c, M, anim, f, o) {
    const cy = (o.below ? 30 : 26) + bob(f, o.below ? 1 : 2);
    const k = anim === 'wind' ? 1 : 0;
    const lid = ramp(dk(c.c, 0.4), c.c, mix(c.c, c.a, 0.7));
    // 촉수
    if (o.below) {
      for (let i = 0; i < 5; i++) {
        const tx = 18 + i * 3 + ((f + i) % 2);
        A.paint(A.m().path([[24 + (i - 2) * 1.6, cy + 5], [21 + i * 1.5 + Math.sin(f + i) * 0.8, cy + 10], [tx, cy + 14.5]], 0.9, 0.3), lid, { r: 2 });
      }
    } else {
      for (let i = 0; i < 6; i++) {
        const a = i * 1.05 + f * 0.3;
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        const pts: Pt[] = [];
        for (let t = 0; t <= 1.001; t += 0.25) {
          const rr = 8 + t * 6.4;
          const w = Math.sin(t * 3 + f + i) * 1.1 * t;
          pts.push([24 + ca * rr - sa * w, cy + sa * rr + ca * w]);
        }
        A.paint(A.m().path(pts, 1.3, 0.35), i % 2 ? M.body : lid, { r: 2 });
      }
    }
    // 눈꺼풀·살
    const R = (o.below ? 8 : 9) + k;
    A.paint(A.m().disc(24, cy, R), lid, { r: 10, tex: noise(0.12, 8) });
    A.paint(A.m().disc(24.2, cy, R - 2), M.body, { r: 9, tex: noise(0.1, 9) });
    // 흰자
    const shut = anim === 'hurt';
    const sx = 24.8;
    const sw = R - 2.6;
    const sh = shut ? 1 : R - 3.2;
    A.paint(A.m().ellipse(sx, cy, sw, sh), ramp('#9a8a9a', '#e0d4e0', '#ffffff'), { r: 8, gain: 0.8 });
    if (!shut) {
      for (const [a, l] of [[0.5, 2], [2.4, 1.6], [3.6, 2.2], [5.2, 1.6]] as [number, number][]) {
        A.ln(sx + Math.cos(a) * sw, cy + Math.sin(a) * sh, sx + Math.cos(a) * (sw - l), cy + Math.sin(a) * (sh - l * 0.8), '#c05a70');
      }
      const ix = 25.8 + (anim === 'wind' ? 0 : 0.6);
      const ir = Math.min(3.2, sh - 0.6);
      A.paint(A.m().disc(ix, cy, ir), ramp(dk(c.b, 0.5), mix(c.a, c.b, 0.6), lt(c.b, 0.3)), { r: 4, line: false });
      const pc = anim === 'wind' ? RED : c.e;
      A.paint(A.m().ellipse(ix + 0.2, cy, 0.8 + k * 0.4, Math.min(1.8, ir - 0.4)), ramp(dk(pc, 0.3), pc, lt(pc, 0.3)), { r: 2, line: false });
      A.dot(ix - 0.8, cy - 1.2, '#ffffff');
      A.dot(ix - 0.3, cy - 1.2, '#ffffff');
      if (anim === 'wind') A.halo(ix, cy, 4, RED, 0.45);
    }
  },

  worm(A, c, M, anim, f) {
    const up = anim === 'wind' ? -6 : anim === 'atk' ? 2 : 0;
    const segY = (i: number): number => 40 - Math.max(0, i - 3) * 3 + (i >= 4 ? up : 0) + Math.sin(f + i) * 0.6;
    // 마디 사이를 잇는 몸 (머리를 든 자세에서 끊기지 않게)
    const spine: Pt[] = [];
    for (let i = 0; i < 6; i++) spine.push([12 + i * 4, segY(i)]);
    spine.push([36, 30 + up]);
    A.paint(A.m().path(spine, 2, 2.6), M.dark, { r: 4 });
    for (let i = 0; i < 6; i++) {
      const x = 12 + i * 4;
      const y = segY(i);
      const r = 2.5 + i * 0.12;
      A.paint(A.m().ellipse(x, y, r + 0.5, r), i % 2 ? M.body : M.light, { r: 6, spec: lt(c.b, 0.4) });
      A.ln(x + r * 0.6, y - r + 0.6, x + r * 0.6, y + r - 0.6, dk(c.c, 0.2));
      A.dot(x - 0.4, y + r + 0.4, dk(c.c, 0.3));
      A.dot(x + 1.2, y + r + 0.3, dk(c.c, 0.3));
    }
    const hx = 36;
    const hy = 30 + up;
    // 아래턱
    const op = anim === 'wind' ? 1.6 : anim === 'atk' ? 1 : 0.4;
    A.paint(A.m().disc(hx, hy, 4.3), M.body, { r: 7, spec: lt(c.b, 0.4) });
    // 입
    A.paint(A.m().ellipse(hx + 3.2, hy + 0.4, 1.7, 1.6 + op * 0.5), ramp('#100810', '#2a0a18', '#4a1a2a'), { r: 2 });
    for (let i = 0; i < 4; i++) {
      const a = -1.2 + i * 0.8;
      A.dotOn(hx + 3.2 + Math.cos(a) * 1.2, hy + 0.4 + Math.sin(a) * (1.2 + op * 0.4), '#f4f0e0');
    }
    // 큰턱
    A.paint(A.m().path([[hx + 2.4, hy - 2.6], [hx + 5.2, hy - 2.4 - op], [hx + 6.4, hy - 0.8 - op]], 0.8, 0.3), M.light, { r: 2 });
    A.paint(A.m().path([[hx + 2.4, hy + 3], [hx + 5.2, hy + 3 + op], [hx + 6.4, hy + 1.6 + op]], 0.8, 0.3), M.light, { r: 2 });
    A.eye(hx - 0.2, hy - 2, eyeCol(c, anim), { r: 0.9, shut: anim === 'hurt' });
  },

  bird(A, c, M, anim, f) {
    const flap = f % 2 === 0 ? -6 : 2;
    const y = 26 + bob(f, 2) + (anim === 'atk' ? 4 : 0);
    const featherR = ramp(dk(c.c, 0.35), c.c, mix(c.c, c.a, 0.6));
    const wing = (dx: number, dy: number, r: Ramp, cov: Ramp | null): void => {
      // 앞전: 어깨 → 손목 → 날개 끝. 깃은 앞전에서 꼬리 쪽(뒤)으로 한 장씩
      const S: Pt = [22.4 + dx, y - 1.2 + dy];
      const Wr: Pt = [15 + dx, y - 6.8 + flap + dy];
      const T: Pt = [8 + dx, y - 3.4 + flap * 1.05 + dy];
      const lead = (t: number): Pt => (t < 0.5 ? [S[0] + (Wr[0] - S[0]) * t * 2, S[1] + (Wr[1] - S[1]) * t * 2] : [Wr[0] + (T[0] - Wr[0]) * (t - 0.5) * 2, Wr[1] + (T[1] - Wr[1]) * (t - 0.5) * 2]);
      const dl = Math.hypot(T[0] - Wr[0], T[1] - Wr[1]) || 1;
      const D: Pt = [(T[0] - Wr[0]) / dl, (T[1] - Wr[1]) / dl];
      const B: Pt = [-0.8, 0.6];
      const n = 10;
      const fs: [Pt, Pt][] = [];
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const [bx, by] = lead(t);
        const k = Math.max(0, t - 0.35) * 1.4;
        let fx = B[0] * (1 - k) + D[0] * k;
        let fy = B[1] * (1 - k) + D[1] * k;
        const fl = Math.hypot(fx, fy) || 1;
        fx /= fl;
        fy /= fl;
        const len = 3.2 + t * 2.8 - (t > 0.95 ? 0.8 : 0);
        fs.push([[bx, by], [bx + fx * len, by + fy * len]]);
      }
      // 깃 아래 바탕 (깃 사이 틈을 메운다)
      A.paint(A.m().poly([...fs.map((q) => q[0]), ...fs.map((q) => q[1]).reverse()]), r, { r: 3 });
      for (let i = n; i >= 0; i--) {
        const [[bx, by], [ex, ey]] = fs[i];
        A.paint(A.m().cap(bx, by, ex, ey, 1.25, 0.7), r, { r: 2.5 });
      }
      // 앞전 뼈대 + 덮깃
      A.paint(A.m().path([S, Wr, lead(0.75)], 1.5, 0.8), cov ?? r, { r: 3, tex: cov ? scales(3, 0.2) : undefined });
    };
    wing(3, -1, ramp(dk(c.c, 0.6), dk(c.c, 0.35), c.c), null);
    // 꼬리깃
    A.paint(A.m().poly([[19, y - 0.6], [11.6, y + 1.2], [10.4, y + 3.6], [12.2, y + 4.8], [19, y + 2]]), featherR, { r: 2 });
    A.ln(18, y + 0.6, 11.6, y + 2.6, dk(c.c, 0.4));
    // 몸
    A.paint(A.m().ellipse(24, y, 6.6, 3.8, -0.12), M.body, { r: 7, tex: scales(4, 0.2) });
    // 다리·발톱
    const tal = anim === 'atk' ? 2.5 : 0;
    A.paint(A.m().path([[24.6, y + 3], [25 + tal, y + 5.2], [26 + tal * 1.2, y + 5.6]], 0.55, 0.4), ramp('#3a2a20', c.e, lt(c.e, 0.4)), { r: 1.5 });
    // 머리
    A.paint(A.m().disc(31, y - 2.2, 3.3), M.body, { r: 6, tex: scales(3, 0.15) });
    // 부리
    A.paint(A.m().poly([[33.4, y - 3], [37.8, y - 0.8], [33.6, y - 0.2]]), M.acc, { r: 2, spec: '#ffffff' });
    A.ln(33.8, y - 1.4, 36.6, y - 0.9, dk(c.e, 0.5));
    const ec = anim === 'wind' ? RED : '#ffffff';
    if (anim === 'hurt') A.ln(31.6, y - 3, 33, y - 2.6, '#140c18', false);
    else {
      A.paint(A.m().disc(32.2, y - 3, 0.95), ramp('#808080', ec, '#ffffff'), { r: 2, line: false });
      A.dot(32.6, y - 3, '#140c18');
      if (anim === 'wind') A.halo(32.2, y - 3, 2.6, RED, 0.45);
    }
    wing(0, 0, featherR, M.light);
  },

  blob(A, c, M, anim, f, o) {
    const sq = anim === 'wind' ? 3 : anim === 'atk' ? -3 : bob(f);
    const rx = (o.maw ? 10 : 9) + sq;
    const ry = (o.maw ? 8 : 7) - sq;
    const cy = 44 - ry;
    // 바닥 웅덩이
    A.paint(A.m().ellipse(24, 43.4, rx + 1.4, 1.3), M.dark, { r: 2 });
    const body = A.m().ellipse(24, cy, rx, ry).clip((_, v) => v <= 44);
    A.paint(body, M.body, { r: 14, spec: '#ffffff', gain: 0.95 });
    // 거품
    for (const [x, y, r] of [[17.4, cy + 3, 0.9], [29.6, cy + 3.6, 0.7], [22, cy + 4.6, 0.5]] as [number, number, number][]) {
      A.paint(A.m().disc(x, y, r), M.light, { r: 2, line: false });
    }
    A.paint(A.m().ellipse(20.6, cy - ry * 0.5, 2.6, 1.5, -0.4), ramp(c.b, lt(c.b, 0.4), '#ffffff'), { r: 3, line: false, gain: 0.4 });
    A.dot(19.6, cy - ry * 0.5 - 0.6, '#ffffff');
    if (o.maw) {
      // 이빨 가득한 입
      A.paint(A.m().ellipse(24, cy + 1.4, 7, 1.8 + (anim === 'atk' ? 1 : 0)), ramp('#100010', '#200010', '#3a0a20'), { r: 2 });
      for (let i = 0; i < 7; i++) {
        A.dotOn(18.6 + i * 1.8, cy + 0.2, '#f0e0f0');
        A.dotOn(19.4 + i * 1.8, cy + 2.6 + (anim === 'atk' ? 1 : 0), '#f0e0f0');
      }
      const ec = anim === 'wind' ? RED : c.e;
      A.eye(19, cy - 3.6, ec, { r: 0.8, shut: anim === 'hurt' });
      A.eye(29, cy - 3.6, ec, { r: 0.8, shut: anim === 'hurt' });
      A.eye(24, cy - 4.8, ec, { r: 0.9, shut: anim === 'hurt' });
      return;
    }
    for (const ex of [26, 30]) {
      if (anim === 'hurt') {
        A.ln(ex - 0.8, cy - 0.8, ex + 0.8, cy - 0.4, '#201020');
        continue;
      }
      A.paint(A.m().ellipse(ex, cy - 0.6, 0.95, 1.6), ramp('#100810', '#201020', '#3a2a3a'), { r: 2, line: false });
      A.dot(ex - 0.3, cy - 1.4, '#ffffff');
    }
    const mc = anim === 'wind' ? '#ff4040' : c.e;
    A.paint(A.m().path([[24.4, cy + 2.2], [27, cy + 3], [29.6, cy + 2.2]], 0.5), ramp(dk(mc, 0.3), mc, mc), { r: 1, line: false });
  },

  hound(A, c, M, anim, f, o) {
    const moving = anim === 'move' || anim === 'atk';
    const ph = f * 1.57;
    const big = anim === 'wind' ? 1 : 0;
    const jaw = anim === 'wind' ? 1.4 : anim === 'atk' ? 2.2 : 0;
    const crouch = anim === 'wind' ? 1 : 0;
    const furT = fur(5);
    const farR = ramp(dk(c.c, 0.55), dk(c.c, 0.3), c.c);
    const leg = (x: number, front: boolean, near: boolean, phase: number): void => {
      const sw = moving ? Math.sin(ph + phase) * 2 : 0;
      const lift = moving ? Math.max(0, Math.cos(ph + phase)) * 1.2 : 0;
      const r = near ? M.body : farR;
      if (front) A.paint(A.m().path([[x, 36 + crouch], [x - 0.4 + sw * 0.4, 40.4], [x + 0.4 + sw, 43.2 - lift]], 1.4, 0.75), r, { r: 3, tex: furT });
      else A.paint(A.m().path([[x, 36 + crouch], [x + 1.8 + sw * 0.3, 39.8], [x - 0.6 + sw, 42], [x + 0.2 + sw, 43.2 - lift]], 1.8, 0.7), r, { r: 3, tex: furT });
      A.paint(A.m().ellipse(x + 0.9 + sw, 43.6 - lift, 1.4, 0.7), near ? M.dark : farR, { r: 2 });
    };
    // 먼 쪽 다리
    leg(19.5, false, false, Math.PI);
    leg(31, true, false, 0);
    // 꼬리
    A.paint(A.m().path([[14.4, 33.4 + crouch], [10.6, 31.2 - big], [7.4, 29 - (moving ? f % 2 : 0) - big * 2]], 1.3, 0.5), M.body, { r: 3, tex: furT });
    // 몸
    const torso = A.m().ellipse(22, 35.6 + crouch, 9.6, 4.3).ellipse(29.6, 35 + crouch, 4.6, 5);
    torso.cut((q) => q.ellipse(21, 41.2 + crouch, 6, 1.6));
    A.paint(torso, M.body, { r: 7, tex: furT });
    A.paint(A.m().ellipse(30.6, 37.4 + crouch, 2.6, 2.6), M.light, { r: 4, line: false, tex: furT });
    // 등 가시·갈기
    for (let i = 0; i < 4; i++) {
      const x = 15.6 + i * 4;
      const by = 31.8 + crouch + Math.abs(i - 2) * 0.2;
      A.paint(A.m().poly([[x - 1, by + 0.6], [x - 0.2 - (i === 3 ? 0 : 0.6), by - 2.6 - big], [x + 1, by + 0.4]]), M.acc, { r: 1.5 });
    }
    if (o.fire) for (let i = 0; i < 6; i++) A.sparkle(15 + i * 3, 30 - ((f + i) % 2) - crouch * 0, i % 2 ? '#ff8a2a' : '#ffd040');
    // 목·머리
    const hx = anim === 'atk' ? 1.2 : 0;
    const hy = crouch + (anim === 'wind' ? 0.6 : 0);
    A.paint(A.m().cap(29.6, 33.4 + crouch, 33.4 + hx, 30.6 + hy, 3), M.body, { r: 6, tex: furT });
    // 귀 (뒤)
    A.paint(A.m().poly([[32 + hx, 28.4 + hy], [30.6 + hx, 25.2 + hy], [33.2 + hx, 27.4 + hy]]), M.dark, { r: 2 });
    // 아래턱
    A.paint(A.m().poly([[34 + hx, 32.4 + hy], [40.8 + hx, 32.8 + hy + jaw], [40.4 + hx, 34 + hy + jaw], [35 + hx, 34.2 + hy]]), M.dark, { r: 2 });
    if (jaw > 0) {
      A.paint(A.m().poly([[35 + hx, 32.6 + hy], [40.6 + hx, 32.4 + hy], [40.4 + hx, 32.8 + hy + jaw], [35 + hx, 33.2 + hy]]), ramp('#1a0810', '#3a0a18', '#6a1a2a'), { r: 1 });
      for (let i = 0; i < 3; i++) A.dot(36.4 + hx + i * 1.4, 32.8 + hy + jaw * 0.6 - 0.1, '#f4f0e0');
    }
    // 머리·주둥이
    A.paint(A.m().ellipse(34.4 + hx, 30 + hy, 3.8, 3.2).poly([[35.6 + hx, 28.6 + hy], [41.4 + hx, 30.2 + hy], [42 + hx, 32.4 + hy], [36 + hx, 33 + hy]]), M.body, { r: 5, tex: furT });
    A.dot(41.6 + hx, 30.4 + hy, '#140c18');
    A.dot(41.2 + hx, 30.4 + hy, '#140c18');
    A.ln(37 + hx, 32.6 + hy, 41.6 + hx, 32.4 + hy, dk(c.c, 0.4));
    for (let i = 0; i < 3; i++) A.dotOn(37.6 + hx + i * 1.3, 32.9 + hy, '#f4f0e0');
    // 귀 (앞)
    A.paint(A.m().poly([[33 + hx, 28 + hy], [33.2 + hx, 24.4 + hy], [35.4 + hx, 27.6 + hy]]), M.body, { r: 2 });
    A.dotOn(33.6 + hx, 26.6 + hy, dk(c.c, 0.3));
    A.ln(34 + hx, 28.4 + hy, 37.2 + hx, 28.6 + hy, dk(c.c, 0.2));
    A.eye(36 + hx, 29.4 + hy, eyeCol(c, anim), { r: 0.8, shut: anim === 'hurt' });
    // 가까운 다리
    leg(15.5, false, true, 0);
    leg(27.5, true, true, Math.PI);
  },

  raptor(A, c, M, anim, f) {
    const run = anim === 'move' || anim === 'atk' ? f % 2 : 0;
    const lean = anim === 'atk' ? 3 : 0;
    const jaw = anim === 'wind' ? 1.6 : anim === 'atk' ? 2.2 : 0;
    const sc = scales(3, 0.18);
    const farR = ramp(dk(c.c, 0.55), dk(c.c, 0.3), c.c);
    const leg = (near: boolean): void => {
      const s = near ? 1 - run : run;
      const hx = near ? 21 : 24;
      const fx = near ? 18 + s * 3 + (1 - s) * 0 : 27 - s * 3;
      A.paint(A.m().path([[hx, 33.6], [hx + 2.4, 37.6], [fx - 0.4, 41], [fx + 0.4, 43.4]], 2, 0.6), near ? M.body : farR, { r: 3, tex: sc });
      A.paint(A.m().poly([[fx - 1, 42.6], [fx + 2.8, 43.2], [fx + 2.6, 44.2], [fx - 1.4, 44.2]]), near ? M.dark : farR, { r: 1.5 });
      A.dot(fx + 3.2, 43.8, '#f0ecdf');
    };
    leg(false);
    // 꼬리
    A.paint(A.m().path([[15.4, 31.6], [10.4, 29.8], [6.6, 28.6], [4, 28]], 2.6, 0.4), M.body, { r: 4, tex: sc });
    // 몸
    A.paint(A.m().ellipse(22, 32, 8.2, 5.2, -0.15), M.body, { r: 8, tex: sc, spec: lt(c.b, 0.4) });
    for (let i = 0; i < 5; i++) A.paint(A.m().disc(15 + i * 3, 27.6 - i * 0.2 + (i === 4 ? -0.4 : 0), 0.8), M.dark, { r: 2 });
    // 목
    A.paint(A.m().path([[27.4 + lean * 0.3, 30.4], [30.4 + lean * 0.7, 26], [32.4 + lean, 22.4]], 2.4, 1.6), M.body, { r: 5, tex: sc });
    // 작은 팔
    A.paint(A.m().path([[28.4, 32.6], [31, 34.2], [32.4, 33.4]], 0.65, 0.4), M.dark, { r: 2 });
    A.dot(33, 33.2, '#f0ecdf');
    // 아래턱
    const x = lean;
    A.paint(A.m().poly([[32 + x, 22.2], [39.4 + x, 22.4 + jaw], [39 + x, 23.6 + jaw], [32.4 + x, 23.8]]), M.dark, { r: 2 });
    if (jaw > 0) {
      A.paint(A.m().poly([[33 + x, 21.8], [39.6 + x, 21.6], [39.4 + x, 22.4 + jaw], [33 + x, 22.6]]), ramp('#1a0810', '#3a0a18', '#6a1a2a'), { r: 1 });
      for (let i = 0; i < 4; i++) A.dot(34 + x + i * 1.4, 22.4 + jaw * 0.7 - 0.2, '#f4f0e0');
    }
    // 머리
    A.paint(A.m().poly([[30.6 + x, 19.6], [33 + x, 18.2], [37 + x, 18.6], [40.2 + x, 20.4], [40.2 + x, 21.8], [32.4 + x, 22.6], [30.4 + x, 21.6]]), M.body, { r: 4, tex: sc });
    A.paint(A.m().poly([[32 + x, 18.6], [33.4 + x, 16.6], [35.6 + x, 18.4]]), M.acc, { r: 1.5 });
    A.ln(33.6 + x, 21.8, 40 + x, 21.6, dk(c.c, 0.4));
    for (let i = 0; i < 4; i++) A.dotOn(34.6 + x + i * 1.4, 22.1, '#f4f0e0');
    A.dot(39.4 + x, 19.8, '#140c18');
    A.eye(34.6 + x, 19.8, eyeCol(c, anim), { r: 0.75, shut: anim === 'hurt' });
    leg(true);
  },

  gear(A, c, M, anim, f) {
    const rot = f * 0.4 + (anim === 'wind' ? 0.8 : 0);
    const metal = ramp(dk(c.c, 0.2), mix(c.c, c.a, 0.5), c.a);
    const steel = ramp('#3a3a48', mix(c.b, '#3a3a48', 0.45), lt(c.b, 0.4));
    // 바퀴
    for (const x of [17.4, 30.6]) A.paint(A.m().disc(x, 42.4, 1.9), steel, { r: 3 });
    // 받침 상자
    A.paint(A.m().poly([[14.4, 34], [33.6, 34], [34.4, 35.2], [34.4, 42], [13.6, 42], [13.6, 35.2]]), metal, { r: 3, tex: noise(0.12, 5) });
    A.paint(A.m().rect(13.6, 34, 20.8, 1.6), M.body, { r: 1.5 });
    for (const x of [15.4, 32.6]) for (const y of [36.6, 40.2]) A.dot(x, y, lt(c.b, 0.3));
    A.ln(20, 37.6, 28, 37.6, dk(c.c, 0.4));
    A.ln(20, 39.4, 28, 39.4, dk(c.c, 0.4));
    // 배기관과 연기
    A.paint(A.m().rect(15.2, 30.4, 1.8, 3.8), steel, { r: 1.5 });
    A.halo(16.2, 28.6 - (f % 2), 1.8, '#a0a0a8', 0.4);
    // 칼날 팔
    A.paint(A.m().cap(30.6, 25.6, 38, 25.6, 1.4), steel, { r: 2 });
    const bc = anim === 'wind' ? RED : c.e;
    A.paint(A.m().poly([[37.4, 22], [41.6, 21.4], [42.4, 25.6], [41.6, 29.6], [37.4, 29.2]]), steel, { r: 2, spec: '#ffffff' });
    A.ln(41.8, 22, 42.2, 29, bc, true);
    A.ln(41.4, 22.6, 41.4, 28.6, mix(bc, '#ffffff', 0.25), true);
    for (let i = 0; i < 4; i++) A.dot(42.6, 22.6 + i * 2, steel[3] ? lt(c.b, 0.2) : '#ffffff');
    // 톱니바퀴
    const gm = A.m().test(14, 16, 34, 36, (u, v) => {
      const dx = u - 24;
      const dy = v - 26;
      const r = Math.hypot(dx, dy);
      const a = Math.atan2(dy, dx) - rot;
      const tooth = Math.cos(a * 8) > 0.2;
      return r <= 8 + (tooth ? 1.7 : 0);
    });
    gm.cut((q) => {
      for (let i = 0; i < 4; i++) {
        const a = rot + i * 1.571 + 0.785;
        q.disc(24 + Math.cos(a) * 5, 26 + Math.sin(a) * 5, 1.5);
      }
    });
    A.paint(gm, metal, { r: 4, spec: lt(c.a, 0.6), tex: noise(0.1, 6) });
    for (let i = 0; i < 4; i++) {
      const a = rot + i * 1.571;
      A.ln(24 + Math.cos(a) * 3, 26 + Math.sin(a) * 3, 24 + Math.cos(a) * 7, 26 + Math.sin(a) * 7, dk(c.c, 0.25));
    }
    A.paint(A.m().disc(24, 26, 3), ramp(dk(c.c, 0.4), c.c, mix(c.c, c.a, 0.6)), { r: 4 });
    A.paint(A.m().disc(24, 26, 1.1), ramp(dk(c.e, 0.3), c.e, lt(c.e, 0.5)), { r: 2, line: false });
    A.halo(24, 26, 2.8, c.e, 0.4);
  },

  moth(A, c, M, anim, f, o) {
    const flap = f % 2 === 0 ? -4 : 2;
    const fw = flap / 2;
    // 뒷날개
    for (const s of [-1, 1]) {
      const m = A.m().poly([[24 + s * 1, 29.4], [24 + s * 5.6, 30], [24 + s * 8.6, 33.6 + fw * 0.2], [24 + s * 7, 37.6], [24 + s * 3.4, 37.4], [24 + s * 1.2, 33]]);
      A.paint(m, ramp(dk(c.b, 0.45), mix(c.b, c.a, 0.3), lt(c.b, 0.35)), { r: 4, tex: noise(0.14, 4) });
      A.paint(A.m().disc(24 + s * 5.2, 34.4, 1), ramp(dk(c.c, 0.3), c.c, c.a), { r: 2, line: false });
    }
    // 앞날개
    for (const s of [-1, 1]) {
      const pts: Pt[] = [[24 + s * 1.2, 26], [24 + s * 6.4, 20.6 + fw * 1.2], [24 + s * 12, 20.4 + fw * 1.4], [24 + s * 13.6, 24.6 + fw], [24 + s * 11, 29 + fw * 0.6], [24 + s * 1.4, 29.4]];
      const m = A.m().poly(pts);
      A.paint(m, M.body, { r: 5, tex: noise(0.16, 7) });
      const ex = 24 + s * 8;
      const ey = 24.8 + fw;
      // 눈무늬
      A.paint(A.m().disc(ex, ey, 2), ramp(dk(c.c, 0.3), c.c, mix(c.c, c.a, 0.5)), { r: 3, line: false });
      A.paint(A.m().disc(ex, ey, 1.2), M.acc, { r: 2, line: false });
      A.dot(ex - 0.3, ey - 0.4, lt(c.e, 0.7));
      // 날개맥
      A.ln(24 + s * 1.6, 27.6, 24 + s * 12.6, 22 + fw * 1.3, dk(c.a, 0.3));
      A.ln(24 + s * 1.6, 28.4, 24 + s * 11.6, 27.6 + fw * 0.7, dk(c.a, 0.3));
      // 가장자리 띠
      A.ln(24 + s * 12.4, 21.2 + fw * 1.4, 24 + s * 13.2, 24.8 + fw, lt(c.a, 0.35));
    }
    // 몸
    A.paint(A.m().ellipse(24, 32.8, 1.9, 4.2), ramp(dk(c.c, 0.4), c.c, mix(c.c, c.a, 0.6)), { r: 4, tex: (x, y, v) => v + (y % 3 === 0 ? -0.25 : 0) });
    A.paint(A.m().ellipse(24, 27.4, 2.4, 2.6), ramp(dk(c.c, 0.3), mix(c.c, c.a, 0.4), lt(c.a, 0.2)), { r: 5, tex: fur(3) });
    A.paint(A.m().disc(24, 24.2, 1.8), ramp(dk(c.c, 0.4), c.c, mix(c.c, c.a, 0.5)), { r: 3 });
    // 더듬이 (깃털 모양)
    for (const s of [-1, 1]) {
      A.paint(A.m().path([[24 + s * 0.6, 22.8], [24 + s * 1.8, 20.6], [24 + s * 3.6, 18.6]], 0.4, 0.3), M.dark, { r: 1, line: false });
      for (let i = 1; i < 4; i++) {
        const x = 24 + s * (0.6 + i * 0.9);
        const y = 22.8 - i * 1.2;
        A.dot(x + s * 0.6, y + 0.2, c.c);
        A.dot(x - s * 0.5, y - 0.6, c.c);
      }
    }
    const ec = anim === 'wind' ? RED : '#202020';
    if (anim === 'hurt') {
      A.ln(22.8, 24, 23.6, 24.2, '#140c18');
      A.ln(24.4, 24.2, 25.2, 24, '#140c18');
    } else {
      A.dot(23, 24, ec);
      A.dot(23, 24.5, ec);
      A.dot(25, 24, ec);
      A.dot(25, 24.5, ec);
      A.dot(23, 23.6, '#ffffff');
      A.dot(25, 23.6, '#ffffff');
    }
    const dust = o.dust ?? c.e;
    for (let i = 0; i < 3; i++) A.glowPx(A.X(14 + i * 9 + (f % 2) * 2), A.Y(19 + ((f + i * 2) % 4) * 2), dust, 0.7);
    if (anim === 'atk') for (let i = 0; i < 5; i++) A.sparkle(20 + i * 2, 38.6 + (i % 2) * 2, dust);
  },

  fish(A, c, M, anim, f) {
    const run = anim === 'move' || anim === 'atk' ? f % 2 : 0;
    const jaw = anim === 'wind' ? 3 : anim === 'atk' ? 1 : 0;
    const finR = ramp(dk(c.c, 0.35), c.c, mix(c.c, c.a, 0.6));
    // 먼 다리 지느러미
    A.paint(A.m().poly([[23.4, 39], [27.4, 39.4], [27.8, 44 - run], [24, 44 - run]]), ramp(dk(c.c, 0.6), dk(c.c, 0.35), c.c), { r: 2 });
    // 꼬리
    A.paint(A.m().poly([[13.4, 34], [6, 29 - run], [7.6, 34], [6, 39 + run]]), finR, { r: 2 });
    for (const dy of [-2.6, 0, 2.6]) A.ln(12.6, 34, 7.4, 34 + dy * 1.4, dk(c.c, 0.3));
    // 등 가시
    for (let i = 0; i < 3; i++) A.paint(A.m().poly([[16 + i * 3, 28.6 + i * 0.2], [15 + i * 3, 25.2 + i * 0.4], [18 + i * 3, 28.4]]), finR, { r: 1 });
    // 입 안
    A.paint(A.m().poly([[28.6, 33], [37.4, 30.8 - jaw], [37.4, 36.6 + jaw], [28.6, 35.6]]), ramp('#140810', '#2a0a18', '#4a1a2a'), { r: 3 });
    // 몸
    const body = A.m().ellipse(22, 34, 10, 7.2);
    body.cut((q) => q.poly([[29, 34], [33.4, 30 - jaw], [33.4, 38 + jaw]]));
    A.paint(body, M.body, { r: 10, tex: scales(4, 0.15), spec: lt(c.b, 0.3) });
    // 발광점
    for (const [x, y] of [[16, 36], [19, 38], [22.4, 39], [14.6, 32.6]] as Pt[]) {
      A.dotOn(x, y, c.e);
      A.glowPx(A.X(x), A.Y(y) - 1, c.e, 0.35);
    }
    // 위·아래 턱 + 이빨
    A.paint(A.m().poly([[27, 30], [37.6, 30.4 - jaw], [37.2, 32 - jaw], [30, 33]]), M.body, { r: 3 });
    A.paint(A.m().poly([[27, 38], [37.6, 36.8 + jaw], [37.2, 35.4 + jaw], [30, 35.2]]), M.dark, { r: 3 });
    for (let i = 0; i < 4; i++) {
      const x = 31 + i * 1.6;
      const t = (x - 30) / 7.6;
      const yu = 32.6 - t * (1 + jaw * 0.9);
      const yl = 35.4 + t * (1 + jaw * 0.9) - t * 0.4;
      A.dot(x, yu, '#f0f0f0');
      A.dot(x, yu + 0.5, '#d0d0d8');
      A.dot(x + 0.8, yl, '#f0f0f0');
      A.dot(x + 0.8, yl - 0.5, '#d0d0d8');
    }
    // 가까운 다리 지느러미
    A.paint(A.m().poly([[15.4, 39], [19.4, 39.4], [19.6, 44], [15.6, 44]]), finR, { r: 2 });
    // 가슴지느러미
    A.paint(A.m().poly([[21, 35], [24.6, 33.6], [25.6, 37.4 + run], [22, 37.6]]), finR, { r: 2 });
    // 눈
    if (anim === 'hurt') A.ln(26, 31, 28, 31.4, '#140c18', false);
    else {
      A.paint(A.m().disc(27, 31, 1.3), ramp('#a0a0a8', anim === 'wind' ? RED : '#ffffff', '#ffffff'), { r: 2 });
      A.dot(27.4, 31, '#140c18');
      if (anim === 'wind') A.halo(27, 31, 3, RED, 0.45);
    }
    // 초롱 (낚싯대 + 발광구)
    A.paint(A.m().path([[25.6, 27.6], [27, 22], [29, 18.6], [30.4, 17.6]], 0.55, 0.4), M.dark, { r: 1.5 });
    A.halo(31, 17, 6, c.e, 0.4);
    A.paint(A.m().disc(31, 17, 2.1), ramp(dk(c.e, 0.25), c.e, '#ffffff'), { r: 4, gain: 0.6 });
    A.sparkle(30.4, 16.4, c.e);
  },

  crab(A, c, M, anim, f) {
    const run = anim === 'move' ? f % 2 : 0;
    const raise = anim === 'wind' || anim === 'block' ? -6 : anim === 'atk' ? 2 : 0;
    // 다리
    for (let i = 0; i < 3; i++) {
      const l1 = (run + i) % 2;
      const l2 = (run + i + 1) % 2;
      A.paint(A.m().path([[17.4 + i * 2, 38.6], [13.2 + i * 2, 36.6 + i * 0.5], [11.4 + i * 2.2, 44 - l1]], 0.85, 0.3), M.dark, { r: 2 });
      A.paint(A.m().path([[30.6 - i * 2, 38.6], [34.8 - i * 2, 36.6 + i * 0.5], [36.6 - i * 2.2, 44 - l2]], 0.85, 0.3), M.dark, { r: 2 });
    }
    // 집게 팔
    const op = anim === 'wind' ? 1.6 : anim === 'block' ? 0 : 0.8;
    for (const s of [-1, 1]) {
      const bx = 24 + s * 7;
      const cx = 24 + s * 14.5;
      const cy = 26.6 + raise;
      A.paint(A.m().path([[bx, 34.6], [24 + s * 11, 31 + raise * 0.6], [cx - s * 1.4, cy + 1.4]], 1.3, 1.1), M.body, { r: 3, tex: noise(0.1, 2) });
      // 집게: 큰 손바닥 + 위로 벌어진 두 손가락
      A.paint(A.m().ellipse(cx, cy + 0.6, 3.4, 2.9, s * 0.2), M.light, { r: 6, spec: '#ffffff' });
      A.paint(A.m().path([[cx + s * 1.6, cy - 1.2], [cx + s * 2.6, cy - 4], [cx + s * 1.8, cy - 6.4 - op * 0.4]], 1.3, 0.35), M.light, { r: 3, spec: '#ffffff' });
      A.paint(A.m().path([[cx - s * 1.2, cy - 1.4], [cx - s * 1.4 - s * op, cy - 3.6 - op * 0.3], [cx - s * 0.4 - s * op * 0.6, cy - 5.6 - op * 0.3]], 1, 0.3), M.body, { r: 2 });
      A.dotOn(cx + s * 0.4, cy + 1, dk(c.c, 0.1));
      for (let i = 0; i < 3; i++) A.dotOn(cx - s * 1.4 + s * i * 1.2, cy - 0.4, lt(c.b, 0.4));
    }
    // 눈자루
    for (const s of [-1, 1]) A.paint(A.m().cap(24 + s * 2.4, 33.4, 24 + s * 2.8, 30.6, 0.5), M.dark, { r: 1 });
    // 등딱지
    const shell = A.m().ellipse(24, 36.2, 10.2, 5.2).clip((_, v) => v < 40.4);
    for (let i = 0; i < 4; i++) shell.poly([[15 + i * 2.6, 33], [16 + i * 2.6, 30.8 + (i % 2) * 0.6], [17.2 + i * 2.6, 33]]);
    for (let i = 0; i < 4; i++) shell.poly([[33 - i * 2.6, 33], [32 - i * 2.6, 30.8 + (i % 2) * 0.6], [30.8 - i * 2.6, 33]]);
    A.paint(shell, M.body, { r: 8, spec: lt(c.b, 0.5), tex: noise(0.1, 6) });
    A.paint(A.m().ellipse(24, 34.4, 5.4, 1.8), M.light, { r: 3, line: false });
    A.ln(17, 38.6, 31, 38.6, dk(c.c, 0.3));
    // 입
    A.dot(23.4, 39.4, dk(c.c, 0.4));
    A.dot(24.6, 39.4, dk(c.c, 0.4));
    // 눈
    const ec = anim === 'wind' ? RED : c.e;
    for (const s of [-1, 1]) {
      const ex = 24 + s * 2.8;
      if (anim === 'hurt') {
        A.ln(ex - 0.8, 30.2, ex + 0.8, 30.4, '#140c18', false);
        continue;
      }
      A.paint(A.m().disc(ex, 30, 1), ramp(dk(ec, 0.4), ec, lt(ec, 0.6)), { r: 2 });
      if (lum(ec) > 0.6) A.dot(ex + 0.2, 30.2, '#140c18');
      A.dot(ex - 0.4, 29.6, '#ffffff');
    }
  },

  shard(A, c, M, anim, f) {
    const cy = 26 + bob(f, 2);
    const k = anim === 'wind' ? 2 : 0;
    const h = 10 + k;
    const w = (10 + k) * 0.46;
    A.halo(24, cy, 9 + k, c.b, 0.22);
    const top: Pt = [24, cy - h];
    const bot: Pt = [24, cy + h];
    const lf: Pt = [24 - w, cy - 0.6];
    const rt: Pt = [24 + w, cy + 0.6];
    const mid: Pt = [24.6, cy - 0.2];
    const glass = ramp(c.c, c.a, '#ffffff');
    // 면: 왼쪽 위 밝게, 오른쪽 아래 어둡게
    A.paint(A.m().poly([top, mid, lf]), glass, { flat: 4, line: false });
    A.paint(A.m().poly([top, rt, mid]), glass, { flat: 3, line: false });
    A.paint(A.m().poly([lf, mid, bot]), glass, { flat: 2, line: false });
    A.paint(A.m().poly([mid, rt, bot]), glass, { flat: 1, line: false });
    // 모서리 선
    A.ln(top[0], top[1], bot[0] + 0.3, bot[1], mix(c.a, '#ffffff', 0.3));
    A.ln(lf[0], lf[1], rt[0], rt[1], mix(c.a, '#ffffff', 0.4));
    A.ln(24 + 0.5, cy - h + 1, 24 + w - 0.6, cy + 0.2, c.c);
    // 안쪽 굴절 줄
    A.ln(22, cy - 6, 21.6, cy - 2, '#ffffff');
    A.ln(26, cy + 3, 25.4, cy + 7, c.b);
    A.dot(22.4, cy - 3.4, '#ffffff');
    // 심장
    const ec = anim === 'wind' ? RED : c.e;
    A.paint(A.m().ellipse(24.6, cy + 0.4, 1.3, 1.8), ramp(dk(ec, 0.3), ec, lt(ec, 0.6)), { r: 2, line: false });
    A.halo(24.6, cy + 0.4, 3.6, ec, 0.5);
    // 도는 작은 조각
    for (let i = 0; i < 3; i++) {
      const x = 24 + Math.cos(f + i * 2) * 13;
      const y = cy + Math.sin(f + i * 2) * 6;
      A.paint(A.m().poly([[x, y - 2.2], [x + 1.1, y], [x, y + 2.2], [x - 1.1, y]]), glass, { flat: 3, line: false });
      A.dot(x - 0.3, y - 0.6, '#ffffff');
    }
  },

  prism(A, c, M, anim, f) {
    const k = anim === 'wind' ? 1 : 0;
    // 받침
    A.paint(A.m().poly([[16.4, 39.6], [31.6, 39.6], [32.4, 44], [15.6, 44]]), M.dark, { r: 3, tex: stone(2) });
    A.paint(A.m().rect(15, 37.8, 18, 2.2), M.body, { r: 2, tex: stone(3) });
    for (const x of [19, 24, 29]) {
      A.dotOn(x, 41.8, c.e);
      A.glowPx(A.X(x), A.Y(41.8), c.e, 0.5);
    }
    // 결정 피라미드
    const ap: Pt = [24, 15.4];
    const bl: Pt = [14.6 - k, 38];
    const br: Pt = [33.4 + k, 38];
    const bm: Pt = [25, 38];
    const cr = ramp(c.c, c.a, c.b);
    A.paint(A.m().poly([ap, bm, bl]), cr, { flat: 3, line: false, tex: undefined });
    A.paint(A.m().poly([ap, br, bm]), cr, { flat: 1, line: false });
    // 빛 띠 (예전 4줄마다 강조색)
    for (const yy of [24, 28, 32, 36]) {
      const t = (yy - 15.4) / 22.6;
      const x0 = 24 - (24 - bl[0]) * t;
      const x1 = 24 + (br[0] - 24) * t;
      A.ln(x0 + 0.3, yy, x1 - 0.3, yy, c.e);
      A.glowPx(A.X(x0 + 1), A.Y(yy) - 1, c.e, 0.3);
    }
    // 윗부분 밝게
    A.paint(A.m().poly([ap, [26, 23], [21.2, 23]]), ramp(c.a, c.b, '#ffffff'), { flat: 3, line: false });
    A.ln(24, 15.6, 25, 37.8, mix(c.b, '#ffffff', 0.4));
    A.ln(22.8, 18.6, 18.6, 30, '#ffffff');
    // 꼭대기 빛
    const ty = 14 - (f % 2);
    A.halo(24, ty, 3.6, c.e, 0.5);
    A.sparkle(24, ty, c.e, true);
    // 가운데 눈
    const ec = anim === 'wind' ? RED : '#ffffff';
    A.paint(A.m().ellipse(24, 26.4, 1.5, 1.2), ramp(dk(ec, 0.4), ec, '#ffffff'), { r: 2, line: false });
    A.halo(24, 26.4, 3.4, anim === 'wind' ? RED : c.e, 0.45);
  },

  hourglass(A, c, M, anim, f) {
    const arm = anim === 'wind' ? -10 : anim === 'atk' ? 6 : bob(f);
    const frame = ramp(dk(c.c, 0.35), c.c, mix(c.c, c.a, 0.6));
    // 기둥
    for (const x of [14.8, 33.2]) A.paint(A.m().cap(x, 14.6, x, 40, 0.75), frame, { r: 2 });
    // 유리
    const gw = (v: number): number => {
      const y = v - 15;
      if (y < 0 || y > 25) return -1;
      return Math.abs(12 - y) * 0.6 + 1;
    };
    const glass = A.m().test(14, 15, 34, 40, (u, v) => {
      const w = gw(v);
      return w > 0 && Math.abs(u - 24) <= w;
    });
    A.paint(glass, ramp(mix('#4a6070', c.c, 0.3), mix('#b0c8d4', c.b, 0.25), '#f4fcff'), { r: 6, gain: 0.7, spec: '#ffffff' });
    // 모래
    const sand = (f % 4) + 2;
    const sr = ramp(c.c, c.a, c.e);
    const low = A.m().test(14, 28, 34, 40, (u, v) => {
      const w = gw(v);
      if (w <= 0) return false;
      const top = 30 + (4 - sand) + Math.abs(u - 24) * 0.45;
      return Math.abs(u - 24) <= w - 0.6 && v >= top;
    });
    A.paint(low, sr, { r: 4, line: false });
    const hi = A.m().test(14, 15, 34, 28, (u, v) => {
      const w = gw(v);
      if (w <= 0) return false;
      return Math.abs(u - 24) <= w - 0.6 && v >= 18 + sand * 0.4 && v <= 26;
    });
    A.paint(hi, sr, { r: 4, line: false });
    A.ln(24, 26, 24, 33 + (4 - sand), c.e);
    A.glowPx(A.X(24), A.Y(28), lt(c.e, 0.5), 0.6);
    // 반사광
    A.ln(18, 16.6, 20.6, 22, '#ffffff');
    A.ln(20.4, 31, 18.2, 37.4, lt(c.b, 0.6));
    // 위·아래 틀
    A.paint(A.m().poly([[13.4, 12], [34.6, 12], [34, 15.2], [14, 15.2]]), frame, { r: 2, spec: lt(c.a, 0.5) });
    A.paint(A.m().poly([[13.6, 39.8], [34.4, 39.8], [35, 44], [13, 44]]), frame, { r: 3, spec: lt(c.a, 0.5) });
    A.ln(14, 41.6, 34, 41.6, dk(c.c, 0.4));
    A.ln(14.4, 13.6, 33.6, 13.6, mix(c.c, c.a, 0.8));
    // 눈
    const ec = anim === 'wind' ? RED : '#201010';
    for (const ex of [19, 29]) {
      if (anim === 'hurt') {
        A.ln(ex - 1, 21, ex + 1, 21.2, '#201010');
        continue;
      }
      A.paint(A.m().rect(ex - 1, 20, 2, 2), ramp(dk(ec, 0.3), ec, lt(ec, 0.3)), { r: 1, line: false });
      if (anim === 'wind') A.halo(ex, 21, 2.6, RED, 0.45);
      else A.dot(ex - 0.5, 20.2, '#ffffff');
    }
    // 떠 있는 손
    for (const s of [-1, 1]) {
      const x = s < 0 ? 8 : 34;
      const y = 22 + arm;
      A.paint(A.m().poly([[x + 0.4, y], [x + 5.6, y], [x + 6, y + 1], [x + 6, y + 9], [x + 5, y + 10], [x + 1, y + 10], [x, y + 9], [x, y + 1]]), M.light, { r: 3, spec: '#ffffff' });
      for (let i = 1; i < 3; i++) A.ln(x + i * 2, y + 6.4, x + i * 2, y + 9.6, dk(c.b, 0.4));
      A.ln(x + 0.6, y + 3, x + 5.4, y + 3, dk(c.b, 0.3));
      A.halo(x + 3, y + 11.4, 1.6, c.e, 0.35);
    }
  },

  // ───── 스토리 1 (sprites.ts DRAW의 비인간형) ─────
  ghost(A, c, M, anim, f, o) {
    const cx = 24;
    const cy = 30 + Math.sin(f * 1.6);
    const raise = anim === 'wind' ? -4 : anim === 'atk' ? 3 : 0;
    A.halo(cx, cy - 2, 10, c.a, 0.22);
    // 너덜너덜한 꼬리
    const tail = A.m();
    for (let i = 0; i < 9; i++) {
      const w = (o.soul ? 4.4 : 6) - i * (o.soul ? 0.55 : 0.6);
      tail.rect(cx - w + Math.sin(f + i * 0.8) * 1.5, cy + 1 + i, w * 2, 1.2);
    }
    for (let i = 0; i < 3; i++) tail.cap(cx - 3 + i * 3 + Math.sin(f + i) * 1.2, cy + 7, cx - 3.4 + i * 3.2 + Math.sin(f * 1.3 + i) * 2, cy + 11.4 - (i % 2), 1, 0.3);
    A.paint(tail, ramp(dk(c.c, 0.2), c.c, c.a), { r: 4, tex: noise(0.14, 3) });
    // 팔
    if (!o.soul) {
      for (const s of [-1, 1]) {
        A.paint(A.m().path([[cx + s * 4.6, cy - 2], [cx + s * 8, cy - 3 + raise * 0.6], [cx + s * 10.4, cy - 4 + raise]], 1.2, 0.5), M.body, { r: 3 });
        A.dot(cx + s * 11, cy - 4.6 + raise, c.b);
        A.dot(cx + s * 10.6, cy - 3.4 + raise, c.b);
      }
    }
    // 머리 (두건)
    A.paint(A.m().ellipse(cx, cy - (o.soul ? 2 : 4), o.soul ? 5 : 6, o.soul ? 6 : 7), M.body, { r: 9, gain: 0.9, spec: '#ffffff' });
    const fy = cy - (o.soul ? 3 : 6);
    if (o.soul) {
      const ec = anim === 'wind' ? RED : c.e;
      if (anim === 'hurt') {
        A.ln(21.6, fy, 23, fy + 0.3, ec, false);
        A.ln(25, fy + 0.3, 26.4, fy, ec, false);
      } else {
        A.paint(A.m().ellipse(22.4, fy, 0.8, 1.3), ramp(dk(ec, 0.3), ec, lt(ec, 0.3)), { r: 2, line: false });
        A.paint(A.m().ellipse(25.6, fy, 0.8, 1.3), ramp(dk(ec, 0.3), ec, lt(ec, 0.3)), { r: 2, line: false });
      }
      A.paint(A.m().ellipse(24, fy + 3.4, 1.4, anim === 'atk' ? 1.4 : 0.8), ramp(dk(c.e, 0.3), c.e, c.e), { r: 1, line: false });
      return;
    }
    // 얼굴 그늘
    A.paint(A.m().ellipse(cx, fy + 0.6, 4, 3.2), ramp('#0c1420', '#102030', '#1a3040'), { r: 3, line: false });
    const ec = anim === 'wind' ? '#ff4040' : c.e;
    for (const s of [-1, 1]) {
      if (anim === 'hurt') {
        A.ln(cx + s * 2 - 0.8, fy, cx + s * 2 + 0.8, fy + 0.4, ec);
        continue;
      }
      A.paint(A.m().ellipse(cx + s * 1.8, fy, 0.8, 1), ramp(dk(ec, 0.2), ec, '#ffffff'), { r: 2, line: false });
      A.halo(cx + s * 1.8, fy, 2.4, ec, 0.5);
    }
    if (anim === 'hurt') A.ln(cx - 4, cy - 10, cx + 4, cy - 10, '#ffffff', false);
  },

  bug(A, c, M, anim, f) {
    const up = anim === 'wind' ? -3 : 0;
    const leg = ramp(dk(c.c, 0.4), c.c, mix(c.c, c.a, 0.5));
    for (let i = 0; i < 4; i++) {
      const k = (f + i) % 2;
      A.paint(A.m().path([[14.6 + i * 5, 40.6], [13 + i * 5, 42 - k * 0.6], [12 + i * 5 + k * 2, 44]], 0.6, 0.3), leg, { r: 1.5 });
    }
    for (let i = 0; i < 3; i++) {
      A.paint(A.m().ellipse(16 + i * 6, 38.6, 4.2, 3.4), M.body, { r: 6, spec: lt(c.b, 0.4) });
      A.dotOn(15 + i * 6, 36.2, c.b);
      A.dotOn(15.6 + i * 6, 36, c.b);
    }
    // 독침 (꼬리)
    A.paint(A.m().path([[12, 39], [9, 38], [6.4, 36.6 + (anim === 'atk' ? -0.6 : 0)]], 1, 0.3), M.acc, { r: 2 });
    if (anim === 'atk') {
      A.sparkle(6, 36.4, '#c0ff60', true);
    }
    // 머리
    A.paint(A.m().ellipse(34, 37 + up, 4.2, 3.2), ramp(c.c, mix(c.a, c.b, 0.3), c.b), { r: 6, spec: '#ffffff' });
    A.paint(A.m().path([[36.8, 37.4 + up], [40, 35.6 + up], [41.4, 35.8 + up]], 0.6, 0.3), leg, { r: 1 });
    A.paint(A.m().path([[36.8, 38.4 + up], [40, 40 + up], [41.4, 39.4 + up]], 0.6, 0.3), leg, { r: 1 });
    A.eye(36, 36 + up, c.e, { r: 0.8, shut: anim === 'hurt' });
  },

  shroom(A, c, M, anim, f) {
    const puff = anim === 'wind' ? 2 : anim === 'atk' ? -1 : Math.sin(f) * 0.6;
    const stem = ramp(dk(c.c, 0.35), c.c, lt(c.c, 0.5));
    A.paint(A.m().poly([[21, 34], [27, 34], [27.6, 42.6], [28.6, 44], [19.4, 44], [20.4, 42.6]]), stem, { r: 5 });
    // 주름 아래
    A.paint(A.m().ellipse(24, 32.6 - puff * 0.5, 9 + puff, 2), ramp(dk(c.a, 0.6), dk(c.a, 0.35), c.a), { r: 2 });
    // 갓
    const cap = A.m().ellipse(24, 30 - puff, 10 + puff, 6 + puff).clip((_, v) => v <= 32.4 - puff * 0.5);
    A.paint(cap, M.body, { r: 9, spec: '#ffe0f4' });
    for (const [x, y, r] of [[19, 28, 1.3], [27, 26, 1.2], [29.6, 30, 1], [23, 25, 0.9], [16, 31, 0.8]] as [number, number, number][]) {
      A.paint(A.m().disc(x, y - puff, r), ramp('#c0a8b8', '#f0d8ea', '#ffffff'), { r: 2, line: false });
    }
    // 눈
    for (const x of [22, 25.6]) {
      if (anim === 'hurt') A.ln(x - 0.6, 37.6, x + 0.6, 37.8, '#302020');
      else {
        A.paint(A.m().ellipse(x, 37.8, 0.7, 1.2), ramp('#100810', '#302020', '#4a3a3a'), { r: 1, line: false });
        A.dot(x - 0.2, 37.2, '#ffffff');
      }
    }
    if (anim === 'wind') for (let i = 0; i < 4; i++) A.sparkle(16 + i * 5, 20 - (f % 3), c.e);
  },

  tome(A, c, M, anim, f) {
    const cy = 30 + Math.sin(f * 1.4);
    const open = anim === 'wind' ? 6 : 3;
    const lift = open / 3;
    // 표지
    A.paint(A.m().poly([[24, cy - 4.6], [15.6, cy - 5.6 - lift * 0.4], [15.4, cy + 5.2], [24, cy + 6]]), M.body, { r: 3, tex: noise(0.12, 4) });
    A.paint(A.m().poly([[24, cy - 4.6], [32.4, cy - 5.6 - lift * 0.4], [32.6, cy + 5.2], [24, cy + 6]]), M.body, { r: 3, tex: noise(0.12, 5) });
    // 책장
    const paper = ramp('#8aa0c0', '#d8e4f4', '#ffffff');
    A.paint(A.m().poly([[24, cy - 3.4 - lift * 0.3], [17, cy - 4.4 - lift], [16.8, cy + 3.8], [24, cy + 4.6]]), paper, { r: 3 });
    A.paint(A.m().poly([[24, cy - 3.4 - lift * 0.3], [31, cy - 4.4 - lift], [31.2, cy + 3.8], [24, cy + 4.6]]), paper, { r: 3 });
    for (let i = 0; i < 4; i++) {
      A.ln(18.2, cy - 2.4 + i * 1.8 - lift * 0.5, 22.8, cy - 1.8 + i * 1.8, '#8aa0c0');
      A.ln(25.2, cy - 1.8 + i * 1.8, 29.8, cy - 2.4 + i * 1.8 - lift * 0.5, '#8aa0c0');
    }
    // 등 (빛나는 룬)
    A.paint(A.m().rect(23.2, cy - 4.8, 1.6, 11), M.acc, { r: 1.5, line: false });
    A.halo(24, cy, 4, c.e, 0.3);
    // 모서리 장식
    for (const [x, y] of [[15.8, cy - 5.2], [32.2, cy - 5.2], [15.8, cy + 4.8], [32.2, cy + 4.8]] as Pt[]) A.dot(x, y, '#e0c070');
    // 눈 (페이지 위)
    const ec = anim === 'wind' ? RED : c.e;
    if (anim !== 'hurt') {
      A.eye(20.4, cy + 0.2, ec, { r: 0.7 });
      A.eye(27.6, cy + 0.2, ec, { r: 0.7 });
    }
    if (anim === 'wind') for (let i = 0; i < 4; i++) A.sparkle(20 + i * 3, cy - 10 - (f % 3), c.e);
    else A.glowPx(A.X(22 + (f % 2) * 4), A.Y(cy - 7 - (f % 3)), c.e, 0.6);
  },

  mimic(A, c, M, anim, f) {
    const jaw = anim === 'wind' ? 5 : anim === 'atk' ? 3 + (f % 2) * 2 : 1;
    const wood = both(bark(3), noise(0.08, 2));
    const iron = ramp('#2a2a34', '#6e6e78', '#c8c8d0');
    // 발
    A.paint(A.m().rect(14, 42.6, 3, 2.4 - (f % 2)), M.dark, { r: 2 });
    A.paint(A.m().rect(31, 42.6, 3, 2.4 - ((f + 1) % 2)), M.dark, { r: 2 });
    // 몸통 (상자)
    A.paint(A.m().rect(13, 31, 22, 13), M.body, { r: 3, tex: wood });
    // 입 안
    A.paint(A.m().rect(13.6, 31.6 - jaw, 20.8, jaw + 1.6), ramp('#100008', '#2a0a14', '#4a1424'), { r: 2 });
    // 혀
    if (jaw > 2) A.paint(A.m().ellipse(25, 31.6, 4, 1.2), ramp('#5a1a2a', '#a03050', '#e06080'), { r: 2 });
    // 이빨
    for (let i = 0; i < 6; i++) {
      A.paint(A.m().poly([[14.4 + i * 3.4, 31.4 - jaw], [16.2 + i * 3.4, 31.4 - jaw], [15.3 + i * 3.4, 33.2 - jaw]]), ramp('#a0a090', '#e8e4d4', '#ffffff'), { r: 1 });
      A.paint(A.m().poly([[15.6 + i * 3.4, 31.6], [17.4 + i * 3.4, 31.6], [16.5 + i * 3.4, 29.8]]), ramp('#a0a090', '#e8e4d4', '#ffffff'), { r: 1 });
    }
    // 뚜껑
    A.paint(A.m().poly([[13, 31.6 - jaw], [35, 31.6 - jaw], [35, 27.6 - jaw], [33.6, 25.6 - jaw], [14.4, 25.6 - jaw], [13, 27.6 - jaw]]), M.light, { r: 4, tex: wood });
    // 쇠 띠
    A.paint(A.m().rect(13, 30.4 - jaw, 22, 1.2), iron, { r: 1 });
    A.paint(A.m().rect(13, 32.6, 22, 1.2), iron, { r: 1 });
    for (const x of [15.4, 31.4]) {
      A.paint(A.m().rect(x, 25.6 - jaw, 1.4, 6), iron, { r: 1 });
      A.paint(A.m().rect(x, 32.6, 1.4, 11.4), iron, { r: 1 });
    }
    // 책등 장식 (서가 미믹)
    const books = ['#a03030', '#305090', '#a08030', '#307040'];
    for (let i = 0; i < 4; i++) {
      A.paint(A.m().rect(17.4 + i * 3.4, 35, 2.8, 7.6), ramp(dk(books[i], 0.4), books[i], lt(books[i], 0.4)), { r: 2 });
      A.dotOn(18.4 + i * 3.4, 37, '#e0c070');
    }
    // 자물쇠
    A.paint(A.m().rect(23, 30.6 - jaw, 2.4, 2.6), ramp('#5a3410', '#d8a840', '#fff4b0'), { r: 2 });
    // 눈
    const ec = anim === 'wind' ? RED : c.e;
    for (const x of [18, 29]) {
      if (anim === 'hurt') {
        A.ln(x - 0.8, 27.4 - jaw, x + 0.8, 27.6 - jaw, '#140c18');
        continue;
      }
      A.eye(x, 27.6 - jaw, ec, { r: 0.8 });
    }
  },

  dummy(A, c, M, anim) {
    const t = anim === 'hurt' ? 2 : 0;
    const wood = ramp(dk(c.c, 0.4), c.c, mix(c.c, c.a, 0.5));
    A.paint(A.m().rect(23, 26, 2, 18), wood, { r: 2, tex: bark(2) });
    A.paint(A.m().ellipse(24, 43.6, 3.4, 0.8), wood, { r: 1 });
    A.paint(A.m().cap(14.6 + t, 28.8, 33.4 + t, 28.8, 1), wood, { r: 2, tex: bark(3) });
    const straw = ramp(dk(c.a, 0.4), c.a, c.b);
    A.paint(A.m().ellipse(24 + t, 30.4, 6, 8), straw, { r: 9, tex: (x, y, v) => v + ((x + (y >> 2)) % 3 === 0 ? -0.2 : 0) });
    for (const y of [26, 30, 34]) A.ln(18.4 + t, y, 29.6 + t, y, dk(c.a, 0.45));
    A.paint(A.m().disc(24 + t, 19, 4.2), ramp(dk(c.b, 0.35), c.b, lt(c.b, 0.4)), { r: 7, tex: noise(0.12, 4) });
    A.dot(22 + t, 18.2, '#302010');
    A.dot(26 + t, 18.2, '#302010');
    A.ln(22.6 + t, 21, 25.6 + t, 21, '#6a4a2a');
    // 과녁
    A.paint(A.m().ring(24 + t, 30.4, 3.2, 3.2, 0.8), ramp(dk(c.e, 0.3), c.e, lt(c.e, 0.4)), { r: 1.5, line: false });
    A.paint(A.m().disc(24 + t, 30.4, 1), ramp(dk(c.e, 0.3), c.e, lt(c.e, 0.4)), { r: 1.5, line: false });
  },
};

/** 스토리 1 비인간형 적 (sprites.ts DRAW): 48칸 그림과 같은 색 */
const LEGACY: Record<string, { kind: string; pal: Pal; v?: Var }> = {
  wraith: { kind: 'ghost', pal: { a: '#80c8e0', b: '#d0f4ff', c: '#4a7a98', e: '#80ffff' } },
  lost_soul: { kind: 'ghost', pal: { a: '#e0c0ff', b: '#f8ecff', c: '#9a7ac0', e: '#4a2a6a' }, v: { soul: true } },
  slime: { kind: 'blob', pal: { a: '#8bdc3a', b: '#d0ff90', c: '#5a9a20', e: '#305010' } },
  devourer: { kind: 'blob', pal: { a: '#a040a0', b: '#d070d0', c: '#7a2a7a', e: '#ff80d0' }, v: { maw: true } },
  venom_bug: { kind: 'bug', pal: { a: '#90b040', b: '#e0ff80', c: '#506020', e: '#ff3030' } },
  spore_cap: { kind: 'shroom', pal: { a: '#c050a0', b: '#e070c0', c: '#e0d0b0', e: '#c0f060' } },
  moth: { kind: 'moth', pal: { a: '#e0c060', b: '#b39a4d', c: '#806030', e: '#a04020' }, v: { dust: '#c0f060' } },
  fire_sprite: { kind: 'wisp', pal: { a: '#ffb02a', b: '#fff0a0', c: '#ff6a1a', e: '#401000' }, v: { flame: true } },
  magma_golem: { kind: 'golem', pal: { a: '#5a3a30', b: '#7a5a48', c: '#2e1e18', e: '#ff6a1a' }, v: { lava: true } },
  forge_hound: { kind: 'hound', pal: { a: '#4a3028', b: '#6a4a38', c: '#2a1a14', e: '#ffd040' }, v: { fire: true } },
  gull: { kind: 'bird', pal: { a: '#d0e0f0', b: '#ffffff', c: '#8a9aaa', e: '#e0a040' } },
  crab: { kind: 'crab', pal: { a: '#d05a3a', b: '#e0a080', c: '#6a2a1a', e: '#101010' } },
  tome: { kind: 'tome', pal: { a: '#3a5a8a', b: '#e8f0ff', c: '#1e2a44', e: '#a8e4ff' } },
  mimic: { kind: 'mimic', pal: { a: '#7a4a2a', b: '#a06a40', c: '#3a2014', e: '#ff3030' } },
  void_eye: { kind: 'eye', pal: { a: '#5a2a6a', b: '#ff80d0', c: '#3a1a4a', e: '#100010' }, v: { below: true } },
  dummy: { kind: 'dummy', pal: { a: '#d0b070', b: '#e0c080', c: '#7a5a3a', e: '#c03030' } },
};

/** 생물 2배 그림이 있는 적 id 전부 */
export const CREATURE_HD_IDS: string[] = [...Object.keys(CREATURES), ...Object.keys(LEGACY)];

/** 생물형 적 한 프레임: 96×96, 발 y=88. 모르는 id면 null */
export function drawCreatureHD(id: string, anim: string, f: number): HTMLCanvasElement | null {
  const cr = CREATURES[id] ?? LEGACY[id];
  const fam = cr && FAM[cr.kind];
  if (!fam || typeof document === 'undefined') return null;
  const A = new Art();
  // 피격: 뒤로 살짝 움찔
  if (anim === 'hurt') A.ox = -1;
  fam(A, cr.pal, mats(cr.pal), anim, f, (cr as { v?: Var }).v ?? {});
  return A.finish();
}
