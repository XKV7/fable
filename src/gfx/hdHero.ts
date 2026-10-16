import type { Look, PoseName } from '../game/types';
import { POSES } from './humanoid';
import { OUTLINE } from './pixel';

/**
 * ★3~5 영웅용 고해상도(2배 정밀) 절차 스프라이트. 96×96 프레임, 발 (48, 88), 오른쪽을 본다.
 * 화면에는 48×48 칸으로 그려져 ★6·7 컨셉아트 영웅과 같은 픽셀 밀도가 된다.
 * 포즈는 기존 48px 생성기와 같은 POSES(관절 오프셋 ×2)를, 색·무기·머리 모양·체형·장식은 Look을 그대로 따른다.
 *
 * 그리는 방식: 부위마다 마스크(모양)를 만들고 칠할 때 자동으로
 *  - 왼쪽 위 가장자리 = 밝은 색, 오른쪽 아래 가장자리 = 그림자 (광원 왼쪽 위)
 *  - 이미 그려진 다른 부위와 맞닿은 가장자리 = 그 부위 색의 짙은 선 (부위 구분선)
 * 을 넣고, 마지막에 전체 실루엣에 공용 1px 외곽선(#0a0810)을 두른다.
 * 얼굴(눈·입), 머리카락 결, 옷 주름, 벨트·장식 같은 세부는 그 위에 픽셀로 찍는다.
 */

const W = 96;
const FOOT = 88;
const D = Math.PI / 180;

// ───────────── 색 ─────────────
const rgbCache = new Map<string, [number, number, number]>();
function rgb(c: string): [number, number, number] {
  let v = rgbCache.get(c);
  if (!v) {
    v = [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
    rgbCache.set(c, v);
  }
  return v;
}
const hex = (r: number, g: number, b: number): string =>
  `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
function mix(a: string, b: string, t: number): string {
  const x = rgb(a);
  const y = rgb(b);
  return hex(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t);
}
/** 밝게 (따뜻한 빛 쪽으로) */
const lt = (c: string, f: number): string => mix(c, '#fff8ec', f);
/** 어둡게 (차가운 보라 그림자 쪽으로 — 색상 이동) */
const dk = (c: string, f: number): string => mix(c, '#140c24', f);
const lum = (c: string): number => {
  const [r, g, b] = rgb(c);
  return (r * 0.3 + g * 0.59 + b * 0.11) / 255;
};
const u32Cache = new Map<string, number>();
function u32(c: string): number {
  let v = u32Cache.get(c);
  if (v === undefined) {
    const [r, g, b] = rgb(c);
    v = ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
    u32Cache.set(c, v);
  }
  return v;
}

interface Ink {
  base: string;
  hi: string;
  lo: string;
  line: string;
}
function ink(base: string, hiF = 0.3, loF = 0.3): Ink {
  return { base, hi: lt(base, hiF), lo: dk(base, loF), line: dk(base, 0.6) };
}

// ───────────── 래스터 ─────────────
type Pt = [number, number];

class Mask {
  m = new Uint8Array(W * W);
  x0 = W;
  y0 = W;
  x1 = -1;
  y1 = -1;
  clear(): this {
    if (this.x1 >= 0) {
      for (let y = this.y0; y <= this.y1; y++) this.m.fill(0, y * W + this.x0, y * W + this.x1 + 1);
    }
    this.x0 = this.y0 = W;
    this.x1 = this.y1 = -1;
    return this;
  }
  set(x: number, y: number): void {
    if (x < 0 || y < 0 || x >= W || y >= W) return;
    this.m[y * W + x] = 1;
    if (x < this.x0) this.x0 = x;
    if (x > this.x1) this.x1 = x;
    if (y < this.y0) this.y0 = y;
    if (y > this.y1) this.y1 = y;
  }
  unset(x: number, y: number): void {
    if (x < 0 || y < 0 || x >= W || y >= W) return;
    this.m[y * W + x] = 0;
  }
  has(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < W && y < W && this.m[y * W + x] === 1;
  }
  rect(x: number, y: number, w: number, h: number): this {
    x = Math.round(x);
    y = Math.round(y);
    for (let j = 0; j < Math.round(h); j++) for (let i = 0; i < Math.round(w); i++) this.set(x + i, y + j);
    return this;
  }
  ellipse(cx: number, cy: number, rx: number, ry: number, cut?: (x: number, y: number) => boolean): this {
    const xa = Math.floor(cx - rx - 1);
    const xb = Math.ceil(cx + rx + 1);
    const ya = Math.floor(cy - ry - 1);
    const yb = Math.ceil(cy + ry + 1);
    for (let y = ya; y <= yb; y++) {
      for (let x = xa; x <= xb; x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1 && (!cut || cut(x, y))) this.set(x, y);
      }
    }
    return this;
  }
  /** 두 점 사이의 굵은 선 (반지름 r0 → r1로 가늘어짐) */
  cap(ax: number, ay: number, bx: number, by: number, r0: number, r1 = r0): this {
    const rm = Math.max(r0, r1);
    const xa = Math.floor(Math.min(ax, bx) - rm - 1);
    const xb = Math.ceil(Math.max(ax, bx) + rm + 1);
    const ya = Math.floor(Math.min(ay, by) - rm - 1);
    const yb = Math.ceil(Math.max(ay, by) + rm + 1);
    const vx = bx - ax;
    const vy = by - ay;
    const ll = vx * vx + vy * vy || 1;
    for (let y = ya; y <= yb; y++) {
      for (let x = xa; x <= xb; x++) {
        const px = x + 0.5 - ax;
        const py = y + 0.5 - ay;
        const t = Math.max(0, Math.min(1, (px * vx + py * vy) / ll));
        const dx = px - vx * t;
        const dy = py - vy * t;
        const r = r0 + (r1 - r0) * t;
        if (dx * dx + dy * dy <= r * r) this.set(x, y);
      }
    }
    return this;
  }
  /** 이어진 점들을 따라 굵기가 변하는 선 (머리카락 다발·꼬리·깃털) */
  path(pts: Pt[], r0: number, r1: number): this {
    const n = pts.length - 1;
    for (let i = 0; i < n; i++) {
      this.cap(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], r0 + ((r1 - r0) * i) / n, r0 + ((r1 - r0) * (i + 1)) / n);
    }
    return this;
  }
  poly(pts: Pt[]): this {
    let ya = Infinity;
    let yb = -Infinity;
    for (const p of pts) {
      ya = Math.min(ya, p[1]);
      yb = Math.max(yb, p[1]);
    }
    const xs: number[] = [];
    for (let y = Math.floor(ya); y <= Math.ceil(yb); y++) {
      const sy = y + 0.5;
      xs.length = 0;
      for (let i = 0; i < pts.length; i++) {
        const [x0, y0] = pts[i];
        const [x1, y1] = pts[(i + 1) % pts.length];
        if ((y0 <= sy && y1 > sy) || (y1 <= sy && y0 > sy)) xs.push(x0 + ((sy - y0) / (y1 - y0)) * (x1 - x0));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        for (let x = Math.ceil(xs[k] - 0.5); x <= Math.floor(xs[k + 1] - 0.5); x++) this.set(x, y);
      }
    }
    return this;
  }
}

class Raster {
  buf = new Uint32Array(W * W);
  /** 부위 번호 (같은 부위끼리는 구분선을 넣지 않는다) */
  part = new Uint16Array(W * W);
  pid = 0;
  px(x: number, y: number, c: string): void {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= W || y >= W) return;
    this.buf[y * W + x] = u32(c);
  }
  /** 이미 칠해진 곳에만 찍는다 */
  pxOn(x: number, y: number, c: string): void {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= W || y >= W || !this.buf[y * W + x]) return;
    this.buf[y * W + x] = u32(c);
  }
  rect(x: number, y: number, w: number, h: number, c: string): void {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, c);
  }
  line(x0: number, y0: number, x1: number, y1: number, c: string, m?: Mask): void {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (let i = 0; i < 200; i++) {
      if (!m || m.has(x0, y0)) this.px(x0, y0, c);
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
  /**
   * 마스크를 칠한다. 위·왼쪽 가장자리는 밝게, 아래·오른쪽은 어둡게,
   * 뒤에 이미 그려진 다른 부위와 맞닿은 가장자리는 짙은 구분선.
   */
  paint(m: Mask, k: Ink, opt: { flat?: boolean; noLine?: boolean; soft?: boolean } = {}): void {
    if (m.x1 < 0) return;
    const id = ++this.pid;
    const B = u32(k.base);
    const H = u32(k.hi);
    const Lo = u32(k.lo);
    const Ln = u32(k.line);
    const Mid = u32(mix(k.base, k.lo, 0.5));
    const out: number[] = [];
    for (let y = m.y0; y <= m.y1; y++) {
      for (let x = m.x0; x <= m.x1; x++) {
        if (!m.has(x, y)) continue;
        const i = y * W + x;
        let c = B;
        if (!opt.flat) {
          const u = m.has(x, y - 1);
          const d = m.has(x, y + 1);
          const l = m.has(x - 1, y);
          const r = m.has(x + 1, y);
          let touch = false;
          if (!opt.noLine) {
            // 이미 그려진 다른 부위와 맞닿았는가
            const chk = (xx: number, yy: number): void => {
              if (xx < 0 || yy < 0 || xx >= W || yy >= W) return;
              const j = yy * W + xx;
              if (this.buf[j] && this.part[j] !== id) touch = true;
            };
            if (!u) chk(x, y - 1);
            if (!d) chk(x, y + 1);
            if (!l) chk(x - 1, y);
            if (!r) chk(x + 1, y);
          }
          if (touch) c = Ln;
          else if (!u || !l) c = H;
          else if (!d || !r) c = Lo;
          else if (!opt.soft && (!m.has(x, y + 2) || !m.has(x + 2, y + 1))) c = Mid;
        }
        out.push(i, c);
      }
    }
    for (let j = 0; j < out.length; j += 2) {
      this.buf[out[j]] = out[j + 1];
      this.part[out[j]] = id;
    }
  }
  fill(m: Mask, c: string): void {
    this.paint(m, { base: c, hi: c, lo: c, line: c }, { flat: true });
  }
  /** 실루엣 바깥 1px 외곽선 → 캔버스 */
  finish(): HTMLCanvasElement {
    const b = this.buf;
    const o = u32(OUTLINE);
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
    new Uint32Array(img.data.buffer).set(b);
    g.putImageData(img, 0, 0);
    return c;
  }
}

const M = new Mask();
const M2 = new Mask();

// ───────────── 무기 ─────────────
interface Hand {
  x: number;
  y: number;
}

function drawWeapon(R: Raster, L: Look, h: Hand, deg: number, pose: PoseName, backHand: Hand): void {
  const a = deg * D;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  // 칼날 방향에 수직, 화면 위쪽을 향하는 쪽 (빛 받는 면)
  let nx = -sa;
  let ny = ca;
  if (ny > 0 || (ny === 0 && nx > 0)) {
    nx = -nx;
    ny = -ny;
  }
  const A = (t: number, q = 0): Pt => [h.x + ca * t + nx * q, h.y + sa * t + ny * q];
  const c = L.wcol;
  const c2 = L.wcol2;
  const metal = ink(c, 0.4, 0.35);
  const wood = ink(c2, 0.3, 0.35);
  const glow = L.glow;
  const shaft = (t0: number, t1: number, r: number, k: Ink = wood): void => {
    const [x0, y0] = A(t0);
    const [x1, y1] = A(t1);
    R.paint(M.clear().cap(x0, y0, x1, y1, r), k, { soft: true });
  };
  const sheen = (t0: number, t1: number, q: number, col: string): void => {
    const [x0, y0] = A(t0, q);
    const [x1, y1] = A(t1, q);
    R.line(x0, y0, x1, y1, col);
  };
  switch (L.weapon) {
    case 'sword': {
      shaft(-6, 2, 1.3);
      R.paint(M.clear().ellipse(...A(-6.5), 1.9, 1.9), ink(lt(c2, 0.2)));
      R.paint(M.clear().cap(...A(3), ...A(25), 2.4, 0.7), metal);
      sheen(4, 21, 0.5, lt(c, 0.7));
      sheen(4, 16, -0.6, dk(c, 0.15));
      R.paint(M.clear().cap(...A(2.5, -4.5), ...A(2.5, 4.5), 1.3), ink(c2 === L.wcol ? '#c8a040' : lt(c2, 0.15), 0.35));
      R.px(...A(2.5), lt(c2, 0.6));
      if (glow) R.px(...A(26), lt(glow, 0.5));
      break;
    }
    case 'greatsword': {
      shaft(-8, 3, 1.8);
      R.paint(M.clear().ellipse(...A(-8.5), 2.4, 2.4), ink(lt(c2, 0.2)));
      R.paint(M.clear().cap(...A(4), ...A(35), 4, 1.2), metal);
      R.paint(M.clear().cap(...A(6), ...A(26), 1, 0.8), ink(dk(c, 0.25)), { flat: true });
      sheen(5, 31, 2.2, lt(c, 0.75));
      R.paint(M.clear().cap(...A(3.5, -7), ...A(3.5, 7), 1.8), ink(c2, 0.35));
      R.paint(M.clear().ellipse(...A(3.5), 2, 2), ink(L.trim));
      break;
    }
    case 'rapier': {
      shaft(-5, 2, 1.1);
      R.paint(M.clear().cap(...A(2), ...A(30), 1, 0.5), metal, { soft: true });
      sheen(3, 28, 0, lt(c, 0.7));
      // 둥근 손 보호대 + 고리
      R.paint(M.clear().ellipse(...A(2.5), 3.2, 3.2), ink(c2, 0.4));
      R.px(...A(2.5, 1.5), lt(c2, 0.7));
      R.paint(M.clear().ellipse(...A(-6), 1.5, 1.5), ink(c2));
      if (glow) {
        R.px(...A(18, 2), glow);
        R.px(...A(25, -2), lt(glow, 0.4));
      }
      break;
    }
    case 'daggers': {
      shaft(-3, 1.5, 1.1);
      R.paint(M.clear().cap(...A(2), ...A(13), 1.8, 0.5), metal);
      sheen(3, 11, 0.4, lt(c, 0.7));
      R.paint(M.clear().cap(...A(1.5, -3), ...A(1.5, 3), 0.9), ink(c2));
      break;
    }
    case 'spear': {
      shaft(-16, 26, 1.1);
      R.paint(M.clear().cap(...A(26), ...A(39), 2.6, 0.4), metal);
      sheen(27, 37, 0.5, lt(c, 0.7));
      R.paint(M.clear().cap(...A(24, -2.5), ...A(24, 2.5), 1.2), ink(L.trim));
      // 술 장식
      R.paint(M.clear().path([A(23), [A(23)[0] - 2, A(23)[1] + 3], [A(23)[0] - 3, A(23)[1] + 7]], 1.4, 0.6), ink(L.trim, 0.3));
      break;
    }
    case 'lance': {
      shaft(-12, 6, 2);
      R.paint(M.clear().cap(...A(8), ...A(40), 6, 0.5), metal);
      for (let t = 12; t < 36; t += 5) {
        const w0 = 6 - (t - 8) * 0.17;
        R.line(...A(t, -w0 + 1), ...A(t + 3, w0 - 1), dk(c, 0.3));
      }
      sheen(10, 36, 2.5, lt(c, 0.6));
      R.paint(M.clear().ellipse(...A(7), 4, 4), ink(c2 === '#3a1a1a' ? dk(c, 0.2) : c2, 0.35));
      R.paint(M.clear().ellipse(...A(7), 1.6, 1.6), ink(glow ?? L.trim));
      break;
    }
    case 'scythe': {
      shaft(-14, 25, 1.2);
      const [tx, ty] = A(25);
      // 날: 자루 끝에서 뒤로 휘어 내려오는 초승달
      const back = Math.atan2(-sa, -ca);
      const side = a - Math.PI / 2;
      const pts: Pt[] = [];
      for (let i = 0; i <= 8; i++) {
        const t = i / 8;
        const ang = side + (back - side) * t * 0.55;
        const rr = 18 * (1 - t * 0.15);
        pts.push([tx + Math.cos(ang) * rr * t * 1.1 + Math.cos(side) * 2, ty + Math.sin(ang) * rr * t * 1.1 + Math.sin(side) * 2]);
      }
      M.clear();
      for (let i = 0; i < pts.length - 1; i++) M.cap(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], 3.2 - i * 0.35, 3.2 - (i + 1) * 0.35);
      R.paint(M, metal);
      for (let i = 1; i < pts.length - 2; i++) R.pxOn(pts[i][0] + Math.cos(a) * 1.5, pts[i][1] + Math.sin(a) * 1.5, lt(c, 0.75));
      R.paint(M.clear().ellipse(tx, ty, 2.2, 2.2), ink(L.trim));
      break;
    }
    case 'shovel': {
      shaft(-14, 18, 1.4);
      // D 손잡이
      R.paint(M.clear().cap(...A(-15, -3), ...A(-15, 3), 1.2), wood);
      M.clear().poly([A(18, -3.5), A(18, 3.5), A(27, 4.5), A(31, 0), A(27, -4.5)]);
      R.paint(M, metal);
      sheen(19, 27, 2, lt(c, 0.6));
      R.paint(M.clear().cap(...A(17, -2), ...A(17, 2), 1.2), ink(dk(c, 0.2)));
      break;
    }
    case 'hammer': {
      shaft(-6, 22, 1.4);
      R.paint(M.clear().rect(...A(-7), 1, 1), wood);
      const [tx, ty] = A(22);
      M.clear().cap(tx - nx * 7, ty - ny * 7, tx + nx * 7, ty + ny * 7, 4.5);
      R.paint(M, metal);
      R.paint(M.clear().cap(tx - nx * 3, ty - ny * 3, tx - nx * 4, ty - ny * 4, 4.6), ink(c2, 0.35));
      R.paint(M.clear().cap(tx + nx * 3, ty + ny * 3, tx + nx * 4, ty + ny * 4, 4.6), ink(c2, 0.35));
      R.px(tx + nx * 6 - ca * 2, ty + ny * 6 - sa * 2, lt(c, 0.8));
      if (L.glow) R.paint(M.clear().ellipse(tx, ty, 1.5, 1.5), ink(L.glow));
      break;
    }
    case 'mace': {
      shaft(-5, 14, 1.3);
      const [tx, ty] = A(17);
      // 미늘
      for (let i = 0; i < 6; i++) {
        const b = (i / 6) * Math.PI * 2 + a;
        R.paint(M.clear().cap(tx, ty, tx + Math.cos(b) * 6.5, ty + Math.sin(b) * 6.5, 1.6, 0.6), ink(dk(c, 0.1)));
      }
      R.paint(M.clear().ellipse(tx, ty, 4.4, 4.4), metal);
      R.px(tx - 2, ty - 2, '#ffffff');
      R.paint(M.clear().cap(...A(12.5, -2.5), ...A(12.5, 2.5), 1.1), ink(c2));
      break;
    }
    case 'staff': {
      shaft(-14, 21, 1.2);
      const [tx, ty] = A(25);
      // 해골 머리 장식
      R.paint(M.clear().ellipse(tx, ty - 1, 4.6, 4.2), ink(c, 0.25));
      R.paint(M.clear().rect(tx - 2.5, ty + 2, 5, 3), ink(dk(c, 0.1)));
      const e = glow ?? '#101010';
      R.rect(Math.round(tx - 3), Math.round(ty - 1), 2, 2, glow ? '#101010' : e);
      R.rect(Math.round(tx + 1), Math.round(ty - 1), 2, 2, glow ? '#101010' : e);
      if (glow) {
        R.px(tx - 2, ty - 1, glow);
        R.px(tx + 1, ty - 1, glow);
      }
      R.px(tx - 2, ty - 4, lt(c, 0.7));
      for (let i = -2; i <= 2; i += 2) R.px(tx + i, ty + 4, dk(c, 0.5));
      R.paint(M.clear().cap(...A(20, -2.5), ...A(20, 2.5), 1.1), ink(L.trim));
      break;
    }
    case 'clock': {
      shaft(-14, 19, 1.2);
      const [tx, ty] = A(25);
      R.paint(M.clear().ellipse(tx, ty, 6.6, 6.6), ink(c, 0.35));
      R.paint(M.clear().ellipse(tx, ty, 4.6, 4.6), ink('#f8f0e0', 0.2, 0.15), { noLine: true });
      for (let i = 0; i < 4; i++) R.px(tx + Math.cos((i * Math.PI) / 2) * 3.6 - 0.5, ty + Math.sin((i * Math.PI) / 2) * 3.6 - 0.5, '#7a6a5a');
      R.line(tx - 0.5, ty - 0.5, tx - 0.5, ty - 3.5, '#201828');
      R.line(tx - 0.5, ty - 0.5, tx + 1.5, ty + 0.5, '#201828');
      R.px(tx - 3, ty - 3, '#ffffff');
      if (glow) {
        R.px(tx + 8, ty - 4, glow);
        R.px(tx - 7, ty + 5, lt(glow, 0.5));
      }
      break;
    }
    case 'orb': {
      const tx = h.x + ca * 6;
      const ty = h.y + sa * 6 - 5;
      const g = glow ?? c;
      // 고리 (뒤)
      M.clear().ellipse(tx, ty, 9, 3.2);
      M2.clear().ellipse(tx, ty, 7.4, 2);
      for (let y = M.y0; y <= M.y1; y++) for (let x = M.x0; x <= M.x1; x++) if (M2.has(x, y) || y > ty) M.unset(x, y);
      R.paint(M, ink(c2, 0.4), { soft: true });
      R.paint(M.clear().ellipse(tx, ty, 5, 5), ink(c, 0.45, 0.4));
      R.paint(M.clear().ellipse(tx - 1, ty - 1, 2.4, 2.4), ink(lt(g, 0.5)), { flat: true });
      R.px(tx - 2, ty - 2, '#ffffff');
      R.px(tx - 1, ty - 3, '#ffffff');
      // 고리 (앞)
      M.clear().ellipse(tx, ty, 9, 3.2);
      M2.clear().ellipse(tx, ty, 7.4, 2);
      for (let y = M.y0; y <= M.y1; y++) for (let x = M.x0; x <= M.x1; x++) if (M2.has(x, y) || y <= ty) M.unset(x, y);
      R.paint(M, ink(c2, 0.4), { soft: true });
      R.px(tx + 7, ty - 7, lt(g, 0.6));
      R.px(tx - 8, ty - 5, g);
      break;
    }
    case 'flask': {
      const tx = h.x + ca * 3;
      const ty = h.y + sa * 3 - 2;
      R.paint(M.clear().rect(tx - 1.5, ty - 9, 3, 4), ink('#c8e0f0', 0.3));
      R.paint(M.clear().rect(tx - 2, ty - 11, 4, 2), ink('#8a6a4a'));
      R.paint(M.clear().ellipse(tx, ty, 5, 5), ink(lt(c2, 0.3), 0.4, 0.25));
      // 액체
      M.clear().ellipse(tx, ty, 4, 4, (x, y) => y >= ty - 1);
      R.paint(M, ink(c, 0.35), { noLine: true });
      R.px(tx - 3, ty - 3, '#ffffff');
      R.px(tx - 2, ty - 4, '#ffffff');
      R.px(tx + 1, ty + 1, lt(c, 0.6));
      R.px(tx - 1, ty - 7, lt(c, 0.4));
      R.px(tx + 1, ty - 10 - 2, lt(c, 0.5));
      break;
    }
    case 'fists': {
      R.paint(M.clear().ellipse(h.x + ca * 1.5, h.y + sa * 1.5, 3.4, 3.4), ink(c, 0.35));
      R.line(h.x + ca * 1.5 - 2, h.y + sa * 1.5 - 1, h.x + ca * 1.5 + 2, h.y + sa * 1.5 - 1, dk(c, 0.25));
      R.paint(M.clear().cap(h.x - ca * 2, h.y - sa * 2, h.x - ca * 4, h.y - sa * 4, 2.6), ink(c2, 0.3));
      break;
    }
    case 'bow': {
      // 활대: 손잡이를 중심으로 활 방향(a)으로 굽은 두 가지
      const pts: Pt[] = [];
      for (let i = -12; i <= 12; i += 2) {
        const t = i / 12;
        pts.push(A(4 - t * t * 5, i));
      }
      M.clear();
      for (let i = 0; i < pts.length - 1; i++) {
        const mid = Math.abs(i - (pts.length - 2) / 2) / ((pts.length - 2) / 2);
        M.cap(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], 1.8 - mid * 0.8, 1.8 - mid * 0.8);
      }
      R.paint(M, ink(c, 0.35));
      R.paint(M.clear().cap(...A(3.5, -2.5), ...A(3.5, 2.5), 1.6), ink(c2 === '#f0f0d0' ? '#7a4a2a' : dk(c2, 0.2)));
      const s0 = pts[0];
      const s1 = pts[pts.length - 1];
      if (pose === 'shootWind') {
        const bx = backHand.x;
        const by = backHand.y;
        R.line(s0[0], s0[1], bx, by, '#f0f0e0');
        R.line(s1[0], s1[1], bx, by, '#f0f0e0');
        // 화살
        R.paint(M.clear().cap(bx, by, ...A(14), 0.6), ink('#c8a878'), { soft: true });
        R.paint(M.clear().cap(...A(13), ...A(17), 1.6, 0.3), ink('#e0e0f0'));
        R.px(bx - ca, by - sa - 1, L.trim);
        R.px(bx - ca, by - sa + 1, L.trim);
      } else R.line(s0[0], s0[1], s1[0], s1[1], '#f0f0e0');
      break;
    }
    case 'axe': {
      shaft(-6, 23, 1.5);
      R.paint(M.clear().ellipse(...A(-6.5), 1.8, 1.8), ink(dk(c2, 0.2)));
      // 도끼날: 손잡이 끝 아래쪽(칼날 방향의 반대 수직)으로 넓게
      const [tx, ty] = A(19);
      const bx = -nx;
      const by = -ny;
      M.clear().poly([
        [tx - ca * 4 + bx * 1, ty - sa * 4 + by * 1],
        [tx + ca * 4 + bx * 1, ty + sa * 4 + by * 1],
        [tx + ca * 7 + bx * 9, ty + sa * 7 + by * 9],
        [tx + ca * 1 + bx * 11, ty + sa * 1 + by * 11],
        [tx - ca * 6 + bx * 9, ty - sa * 6 + by * 9],
      ]);
      R.paint(M, metal);
      R.line(tx + ca * 6 + bx * 9, ty + sa * 6 + by * 9, tx - ca * 5 + bx * 9, ty - sa * 5 + by * 9, lt(c, 0.75));
      R.paint(M.clear().cap(...A(19, -2), ...A(19, 2), 2.2), ink(dk(c, 0.3)));
      break;
    }
    case 'cannon': {
      R.paint(M.clear().cap(...A(-8), ...A(-1), 4.2), ink(dk(c, 0.15)));
      R.paint(M.clear().cap(...A(0), ...A(22), 4.4, 4), ink(c, 0.35));
      for (const t of [3, 13]) R.paint(M.clear().cap(...A(t), ...A(t + 2), 4.8), ink(c2, 0.35));
      R.paint(M.clear().cap(...A(22), ...A(25), 5.4), ink(c2, 0.35));
      R.paint(M.clear().ellipse(...A(25.5), 1.6, 3), ink('#100c10'), { flat: true });
      sheen(4, 21, 2.5, lt(c, 0.45));
      R.paint(M.clear().cap(...A(-6, -5), ...A(-2, -6), 1.4), ink(c2));
      break;
    }
    case 'lute': {
      const tx = h.x + ca * 3;
      const ty = h.y + sa * 3 + 2;
      const na = a - 1.3;
      R.paint(M.clear().cap(tx, ty, tx + Math.cos(na) * 17, ty + Math.sin(na) * 17, 1.4), ink(dk(c, 0.2)));
      R.paint(M.clear().cap(tx + Math.cos(na) * 16, ty + Math.sin(na) * 16, tx + Math.cos(na) * 19, ty + Math.sin(na) * 19 - 2, 1.6), ink(dk(c, 0.35)));
      R.paint(M.clear().ellipse(tx, ty, 6, 5.4), ink(c, 0.35));
      R.paint(M.clear().ellipse(tx, ty, 1.8, 1.8), ink('#2a1a10'), { flat: true });
      R.line(tx - 3, ty + 3, tx + Math.cos(na) * 16, ty + Math.sin(na) * 16, c2);
      R.px(tx - 3, ty - 3, lt(c, 0.6));
      break;
    }
    case 'claws': {
      R.paint(M.clear().ellipse(h.x, h.y, 3.2, 3.2), ink(c2, 0.35));
      for (let k = -1; k <= 1; k++) {
        const b = a + k * 0.32;
        R.paint(M.clear().cap(h.x + Math.cos(b) * 2, h.y + Math.sin(b) * 2, h.x + Math.cos(b + 0.15) * 12, h.y + Math.sin(b + 0.15) * 12, 1.3, 0.4), metal);
        R.px(h.x + Math.cos(b) * 5, h.y + Math.sin(b) * 5 - 1, lt(c, 0.7));
      }
      break;
    }
    case 'strings': {
      const tx = h.x + ca * 4;
      const ty = h.y + sa * 4 - 2;
      R.paint(M.clear().cap(tx - 6, ty, tx + 6, ty, 1.2), ink(c2, 0.35));
      R.paint(M.clear().cap(tx, ty - 3, tx, ty + 3, 1.1), ink(c2, 0.35));
      const by = ty + 15;
      for (const k of [-5, 0, 5]) R.line(tx + k, ty + 1, tx + k * 0.4, by - 3, lt(c, 0.2));
      // 매달린 작은 인형
      R.paint(M.clear().ellipse(tx, by - 2, 2.4, 2.4), ink('#f8e8e0'));
      R.paint(M.clear().poly([[tx - 3, by + 5], [tx + 3, by + 5], [tx + 1.5, by], [tx - 1.5, by]]), ink(L.trim));
      R.px(tx + 1, by - 2, '#201018');
      if (glow) R.px(tx - 7, ty - 3, glow);
      break;
    }
    case 'talisman': {
      const tx = h.x + ca * 2;
      const ty = h.y + sa * 2 - 5;
      R.paint(M.clear().rect(tx - 3, ty - 7, 6, 13), ink(c, 0.3, 0.2));
      R.rect(Math.round(tx - 1), Math.round(ty - 5), 2, 1, c2);
      R.rect(Math.round(tx - 2), Math.round(ty - 3), 4, 1, c2);
      R.rect(Math.round(tx - 0.5), Math.round(ty - 3), 1, 6, c2);
      R.rect(Math.round(tx - 2), Math.round(ty + 2), 4, 1, c2);
      R.px(tx - 2, ty - 6, '#ffffff');
      break;
    }
    case 'starblade': {
      shaft(-6, 2, 1.3, ink('#2a2838'));
      R.paint(M.clear().ellipse(...A(-7), 1.8, 1.8), ink('#c8c8e0'));
      R.paint(M.clear().cap(...A(3), ...A(32), 2.8, 0.6), ink(c, 0.4));
      sheen(4, 30, 0, '#d8f4ff');
      R.paint(M.clear().cap(...A(3, -5), ...A(3, 5), 1.2), ink('#d0d0e8'));
      R.paint(M.clear().ellipse(...A(3), 1.6, 1.6), ink('#8a5aff'));
      break;
    }
    case 'none':
      break;
  }
}

/** 무기 끝까지의 길이 (손 기준) — 땅을 뚫지 않게 각도를 줄일 때 쓴다 */
const REACH: Partial<Record<Look['weapon'], number>> = {
  sword: 26, greatsword: 36, rapier: 30, daggers: 13, spear: 40, lance: 41, scythe: 28, shovel: 31,
  hammer: 27, mace: 23, staff: 30, clock: 32, axe: 30, cannon: 27, starblade: 33,
};
const POLE: Partial<Record<Look['weapon'], boolean>> = { staff: true, clock: true, spear: true, scythe: true, shovel: true, lance: true };

/**
 * 고해상도 무기는 길어서 아래를 향하면 땅을 뚫는다.
 * 대기·달리기 중의 긴 자루 무기는 세워 들고, 나머지는 끝이 발밑 높이를 넘지 않게 눕힌다.
 */
function weaponAngle(L: Look, pose: PoseName, deg: number, h: Hand): number {
  const reach = REACH[L.weapon];
  if (!reach) return deg;
  if (POLE[L.weapon] && /^(idle|run|crouch)/.test(pose)) return -66 + (deg - 50) * 0.25;
  const a = deg * D;
  const s = Math.sin(a);
  const maxS = (FOOT + 3 - h.y) / reach;
  if (s <= maxS || maxS >= 1) return deg;
  const lim = Math.asin(Math.max(-1, maxS));
  return (Math.cos(a) >= 0 ? lim : Math.PI - lim) / D;
}

// ───────────── 머리 ─────────────
interface HeadGeo {
  hx: number; // 머리 중심
  hy: number;
}

/** 앞머리 아래 끝선 (오른쪽을 보는 3/4 얼굴): 뒤쪽은 길게, 이마는 들쭉날쭉한 결 */
function fringeY(L: Look, g: HeadGeo, x: number): number {
  const { hx, hy } = g;
  const dx = x - hx;
  if (dx <= -6) return hy + 8;
  if (dx <= -4) return hy + 4;
  if (dx >= 9) return hy + 5;
  const jag = L.hairStyle === 'spiky' ? [0, 3, 5, 2][(x + 400) % 4] : [0, 2, 3, 1][(x + 400) % 4];
  return hy - 3 + jag;
}

/** 머리카락 덩어리 마스크 (머리 위·뒤를 감싸는 부분) */
function hairCap(L: Look, g: HeadGeo, m: Mask): Mask {
  const { hx, hy } = g;
  m.clear().ellipse(hx - 0.5, hy - 1.5, 12.5, 11.5, (x, y) => y < fringeY(L, g, x));
  return m;
}

/** 머리카락 결: 정수리에서 앞머리 끝으로 흐르는 짙은 선 + 천사 고리 광택 */
function hairDetail(R: Raster, L: Look, g: HeadGeo, m: Mask, col: string): void {
  const { hx, hy } = g;
  const dark = dk(col, 0.35);
  const crown: Pt = [hx - 3, hy - 11];
  for (const fx of [-8, -2, 2, 6]) {
    const tx = hx + fx;
    R.line(crown[0] + fx * 0.3, crown[1] + 3, tx, fringeY(L, g, tx) - 2, dark, m);
  }
  // 광택 고리
  // 광택: 머리 곡면을 따라 끊긴 두 줄기 (가운데가 가장 밝다)
  for (const [x0, x1] of [[hx - 8, hx - 5], [hx - 3, hx + 4]]) {
    for (let x = x0; x <= x1; x++) {
      const t = (x - hx + 1.5) / 11;
      const y = Math.round(hy - 5 - Math.sqrt(Math.max(0, 1 - t * t)) * 3 + (x === x0 || x === x1 ? 1 : 0));
      if (m.has(x, y) && m.has(x, y + 1)) {
        R.px(x, y, lt(col, x === x0 || x === x1 ? 0.3 : 0.55));
        if (m.has(x, y + 2) && x > x0 && x < x1) R.px(x, y + 1, lt(col, 0.22));
      }
    }
  }
}

/** 얼굴: 피부 + 눈 + 입 + 볼. shadowTop = 후드 그늘 줄 수 */
function face(R: Raster, L: Look, g: HeadGeo, o: { eyes?: boolean; shadowTop?: number; skin?: string; glowEyes?: boolean; mouth?: boolean } = {}): void {
  const { hx, hy } = g;
  const skin = o.skin ?? L.skin;
  R.paint(M.clear().ellipse(hx + 1, hy + 1, 10, 9.5), ink(skin, 0.25, 0.18), { soft: true });
  // 턱 아래 그늘
  for (let x = hx - 6; x <= hx + 9; x++) R.pxOn(x, hy + 9, dk(skin, 0.2));
  if (o.eyes !== false) eyes(R, L, g, !!o.glowEyes);
  if (o.mouth !== false) {
    R.px(hx + 4, hy + 7, dk(skin, 0.45));
    R.px(hx + 5, hy + 7, dk(skin, 0.35));
    // 볼 홍조
    const blush = mix(skin, '#ff6a7a', 0.3);
    R.px(hx + 8, hy + 5, blush);
    R.px(hx + 9, hy + 5, blush);
    R.px(hx - 3, hy + 5, blush);
  }
}

function eyes(R: Raster, L: Look, g: HeadGeo, glowEyes: boolean): void {
  const { hx, hy } = g;
  const e = L.eye;
  const ey = hy + 1;
  const lash = '#1a1020';
  const deep = lum(e) < 0.2 ? '#000000' : dk(e, 0.45);
  const light = lum(e) < 0.2 ? '#5a5060' : lt(e, 0.35);
  const one = (x: number, w: number): void => {
    if (glowEyes) {
      R.rect(x, ey + 1, w, 3, e);
      R.rect(x, ey + 1, w, 1, lt(e, 0.6));
      return;
    }
    R.rect(x - (w === 3 ? 0 : 0), ey, w + 1, 1, lash);
    R.rect(x, ey + 1, w, 3, e);
    R.rect(x + w - 2, ey + 1, 2, 2, deep);
    R.rect(x, ey + 3, w, 1, light);
    R.px(x, ey + 1, '#ffffff');
  };
  one(hx + 5, 3); // 앞 눈
  one(hx - 2, 2); // 뒤 눈 (3/4라 좁다)
}

/** 뒤로 늘어지는 머리 (몸 뒤에 먼저 그림) */
function backHair(R: Raster, L: Look, g: HeadGeo, torsoBot: number, flow: number): void {
  const { hx, hy } = g;
  const hs = L.hairStyle;
  const col = L.hair;
  const k = ink(dk(col, 0.1), 0.25, 0.3);
  if (hs === 'long' || hs === 'crown' || hs === 'witch') {
    const sw = flow * 6;
    const bot = Math.min(torsoBot - (hs === 'witch' ? 4 : 0), FOOT - 6);
    M.clear().poly([
      [hx - 11, hy - 6],
      [hx - 3, hy - 6],
      [hx - 1, bot - 6],
      [hx - 4 - sw, bot + 1],
      [hx - 8 - sw, bot - 1],
      [hx - 12 - sw, bot + 1],
      [hx - 13 - sw * 0.6, hy + 6],
    ]);
    R.paint(M, k);
    for (const f of [-9, -6]) R.line(hx + f, hy, hx + f - 1 - sw * 0.6, bot - 2, dk(col, 0.35), M);
  } else if (hs === 'pony') {
    const p0: Pt = [hx - 10, hy - 5];
    const pts: Pt[] = [p0, [hx - 16 - flow * 3, hy - 1 - flow * 4], [hx - 17 - flow * 8, hy + 7 - flow * 7], [hx - 15 - flow * 13, hy + 15 - flow * 10]];
    R.paint(M.clear().path(pts, 4, 1.2), k);
    R.line(pts[1][0], pts[1][1] + 1, pts[3][0] + 1, pts[3][1] - 2, dk(col, 0.35), M);
    R.paint(M.clear().ellipse(p0[0] - 1, p0[1] + 1, 2.4, 2.4), ink(L.trim));
  } else if (hs === 'veil') {
    // 머리 뒤로 늘어진 천
    const sw = flow * 8;
    M.clear().poly([[hx - 10, hy - 4], [hx - 5, hy + 2], [hx - 8 - sw, torsoBot - 2 - flow * 6], [hx - 14 - sw, torsoBot - 4 - flow * 6]]);
    R.paint(M, ink(dk(L.trim, 0.25)));
  } else if (hs === 'bun') {
    R.paint(M.clear().ellipse(hx - 5, hy - 11, 5.5, 5), ink(col, 0.3));
    R.line(hx - 9, hy - 13, hx - 3, hy - 9, dk(col, 0.35), M);
  }
}

function head(R: Raster, L: Look, g: HeadGeo, flow: number): void {
  const { hx, hy } = g;
  const hs = L.hairStyle;
  const col = L.hair;
  const hk = ink(col, 0.3, 0.3);
  switch (hs) {
    case 'short':
    case 'long':
    case 'pony':
    case 'bun':
    case 'crown': {
      face(R, L, g);
      hairCap(L, g, M2);
      R.paint(M2, hk);
      hairDetail(R, L, g, M2, col);
      if (hs === 'long' || hs === 'crown') {
        // 얼굴 옆으로 내려오는 앞머리 한 가닥
        R.paint(M.clear().path([[hx + 10, hy - 2], [hx + 11, hy + 4], [hx + 10, hy + 9]], 1.8, 0.8), hk);
      }
      if (hs === 'bun') R.paint(M.clear().cap(hx - 9, hy - 9, hx - 5, hy - 13, 0.9), ink(L.trim));
      if (hs === 'crown') {
        const gold = ink('#e8b840', 0.4, 0.35);
        M.clear().rect(hx - 6, hy - 13, 13, 3);
        M.poly([[hx - 6, hy - 12], [hx - 6, hy - 17], [hx - 3, hy - 13]]);
        M.poly([[hx - 2, hy - 12], [hx + 0.5, hy - 19], [hx + 3, hy - 12]]);
        M.poly([[hx + 4, hy - 13], [hx + 7, hy - 17], [hx + 7, hy - 12]]);
        R.paint(M, gold);
        R.paint(M.clear().ellipse(hx + 0.5, hy - 12, 1.6, 1.6), ink(L.eye), { flat: true });
        R.px(hx, hy - 13, '#ffffff');
        R.px(hx - 5, hy - 16, '#fff0b0');
        R.px(hx + 6, hy - 16, '#fff0b0');
      }
      break;
    }
    case 'spiky': {
      // 뾰족한 머리 다발 (뒤로 뻗침)
      M2.clear();
      const spikes: [number, number, number][] = [
        [-140, 15, 4],
        [-115, 14, 4],
        [-90, 13, 4],
        [-65, 12, 3.5],
        [-165, 15, 3.5],
        [170, 13, 3.5],
      ];
      for (const [ang, len, r] of spikes) {
        const b = ang * D;
        M2.cap(hx - 1 + Math.cos(b) * 5, hy - 2 + Math.sin(b) * 5, hx - 1 + Math.cos(b) * len - flow * 2, hy - 2 + Math.sin(b) * len, r, 0.3);
      }
      R.paint(M2, ink(dk(col, 0.08), 0.3, 0.3));
      face(R, L, g);
      hairCap(L, g, M2);
      R.paint(M2, hk);
      hairDetail(R, L, g, M2, col);
      break;
    }
    case 'bald': {
      face(R, L, g);
      M2.clear().ellipse(hx - 0.5, hy - 1.5, 11, 10.5, (x, y) => y < hy - 2 || x < hx - 4);
      R.paint(M2, ink(L.skin, 0.25, 0.2));
      R.px(hx - 3, hy - 9, lt(L.skin, 0.65));
      R.px(hx - 2, hy - 9, lt(L.skin, 0.5));
      R.px(hx - 4, hy - 8, lt(L.skin, 0.45));
      // 귀
      R.paint(M.clear().ellipse(hx - 4, hy + 2, 2, 2.6), ink(L.skin, 0.2, 0.2));
      R.px(hx - 4, hy + 2, dk(L.skin, 0.3));
      // 눈썹 + 이마의 수행 점
      R.rect(hx + 5, hy - 1, 3, 1, dk(col === '#202020' ? '#3a2a20' : col, 0.2));
      R.rect(hx - 2, hy - 1, 2, 1, dk(col === '#202020' ? '#3a2a20' : col, 0.2));
      R.px(hx + 2, hy - 5, dk(L.skin, 0.35));
      R.px(hx + 4, hy - 5, dk(L.skin, 0.35));
      break;
    }
    case 'hood':
    case 'starhood': {
      const hood = L.cape ?? L.body;
      const k = ink(hood, 0.28, 0.32);
      // 후드 바깥 (뾰족한 꼭지가 뒤로)
      M2.clear().ellipse(hx - 0.5, hy - 1, 13, 12);
      M2.poly([[hx - 12, hy - 4], [hx - 18 - flow * 4, hy - 8 - flow * 2], [hx - 6, hy - 11]]);
      M2.rect(hx - 12, hy + 4, 10, 8);
      R.paint(M2, k);
      // 얼굴 구멍
      face(R, L, g, { glowEyes: !!L.glow && hs === 'hood', mouth: !L.glow });
      // 얼굴 구멍 밖은 다시 후드로 덮는다: 후드 앞 테두리
      M.clear().ellipse(hx - 0.5, hy - 1, 13, 12, (x, y) => {
        const dx = (x + 0.5 - (hx + 3)) / 8.5;
        const dy = (y + 0.5 - (hy + 3)) / 8.5;
        return dx * dx + dy * dy > 1;
      });
      R.paint(M, k);
      // 후드 안쪽 그늘: 이마
      for (let x = hx - 3; x <= hx + 10; x++) {
        for (let y = hy - 6; y <= hy - 3; y++) if (!M.has(x, y)) R.pxOn(x, y, dk(hood, 0.55));
      }
      // 앞머리 몇 가닥
      for (const fx of [0, 2, 5, 7]) R.line(hx + fx, hy - 4, hx + fx + 1, hy - 2 + (fx % 3), hs === 'starhood' ? col : dk(col, 0.05));
      // 후드 주름
      R.line(hx - 9, hy - 6, hx - 5, hy + 4, dk(hood, 0.45), M);
      R.line(hx - 4, hy - 11, hx - 1, hy - 7, lt(hood, 0.25), M);
      if (hs === 'starhood') {
        R.px(hx + 1, hy - 12, '#f4f4ff');
        R.rect(hx, hy - 11, 3, 1, '#f4f4ff');
        R.rect(hx - 1, hy - 10, 5, 1, '#c8c8e0');
      }
      if (L.trim && hs === 'hood') {
        // 테두리 바느질 선
        for (let i = 0; i < 12; i += 2) {
          const ang = -2.4 + i * 0.32;
          R.pxOn(hx + 3 + Math.cos(ang) * 9.5, hy + 3 + Math.sin(ang) * 9.5, dk(L.trim, 0.3));
        }
      }
      break;
    }
    case 'witch': {
      face(R, L, g);
      hairCap(L, g, M2);
      R.paint(M2, hk);
      hairDetail(R, L, g, M2, col);
      R.paint(M.clear().path([[hx + 10, hy - 3], [hx + 11, hy + 4], [hx + 10, hy + 9]], 1.8, 0.8), hk);
      const hat = L.cape ?? L.body;
      const k = ink(hat, 0.3, 0.32);
      // 뾰족 고깔 (끝이 뒤로 꺾임)
      const tip = flow * 4;
      M.clear().poly([[hx - 9, hy - 8], [hx + 8, hy - 8], [hx + 2, hy - 17], [hx - 3 - tip, hy - 24], [hx - 9 - tip, hy - 25], [hx - 5, hy - 18]]);
      R.paint(M, k);
      R.line(hx - 4, hy - 9, hx - 4 - tip * 0.5, hy - 20, dk(hat, 0.4), M);
      // 넓은 챙
      R.paint(M.clear().ellipse(hx - 0.5, hy - 7, 17, 3.2), k);
      // 띠 + 장식
      R.paint(M.clear().rect(hx - 8, hy - 11, 16, 2.5), ink(L.trim, 0.35));
      R.paint(M.clear().ellipse(hx + 3, hy - 10, 1.8, 1.8), ink(L.glow ?? L.eye), { flat: true });
      R.px(hx + 2, hy - 11, '#ffffff');
      break;
    }
    case 'helm':
    case 'horned': {
      const horned = hs === 'horned';
      const metalC = !horned && L.trim === '#b08a3a' ? '#6a6a7a' : L.body;
      const mk = ink(metalC, 0.35, 0.35);
      if (horned) {
        // 뿔 (뒤로 휘어 위로)
        const bone = ink('#e0d0b0', 0.3, 0.35);
        R.paint(M.clear().path([[hx - 5, hy - 8], [hx - 11, hy - 13], [hx - 17 - flow * 2, hy - 13], [hx - 21 - flow * 3, hy - 18]], 3.2, 0.6), bone);
        R.paint(M.clear().path([[hx + 5, hy - 9], [hx + 7, hy - 15], [hx + 4, hy - 20], [hx + 1, hy - 22]], 3, 0.6), bone);
        R.line(hx - 9, hy - 12, hx - 15, hy - 13, '#a89070');
        R.line(hx + 7, hy - 13, hx + 5, hy - 18, '#a89070');
        face(R, L, g);
      }
      // 투구 몸체 (뿔 투구는 얼굴이 드러나고 뒤쪽 뺨 가리개만)
      M2.clear().ellipse(hx - 0.5, hy - 1.5, 12, 11.5, horned ? (x, y) => y < hy - 2 + (x > hx + 3 ? 0 : 1) || x < hx - 4 : undefined);
      if (!horned) M2.rect(hx - 10, hy + 2, 20, 7);
      R.paint(M2, mk);
      // 가운데 볏 줄
      R.line(hx + 1, hy - 12, hx + 3, hy - 2, lt(metalC, 0.5), M2);
      R.line(hx + 2, hy - 12, hx + 4, hy - 2, dk(metalC, 0.25), M2);
      if (!horned) {
        // 눈 틈 (+ 빛나는 눈)
        R.rect(hx + 1, hy + 1, 10, 2, '#0c0a12');
        R.rect(hx + 5, hy + 1, 2, 2, L.eye);
        R.px(hx + 5, hy + 1, lt(L.eye, 0.6));
        R.rect(hx - 1, hy + 1, 2, 2, dk(L.eye, 0.3));
        // 숨구멍 + 테두리 리벳
        for (let i = 0; i < 3; i++) R.px(hx + 7 + i, hy + 5, '#0c0a12');
        for (let i = 0; i < 3; i++) R.px(hx + 7 + i, hy + 7, '#0c0a12');
        R.rect(hx - 9, hy - 3, 20, 1, dk(metalC, 0.35));
        for (const rx of [-7, -3, 1]) R.px(hx + rx, hy - 4, lt(L.trim, 0.3));
        R.paint(M.clear().rect(hx - 10, hy + 8, 20, 2), ink(L.trim, 0.35));
        if (L.glow) {
          // 안테나 (로봇)
          R.paint(M.clear().cap(hx - 3, hy - 12, hx - 6, hy - 18, 0.8), ink(dk(metalC, 0.2)));
          R.paint(M.clear().ellipse(hx - 6.5, hy - 19.5, 2.2, 2.2), ink(L.glow, 0.5));
          R.px(hx - 7, hy - 20, '#ffffff');
        } else {
          if (L.cape) {
            // 말총 깃털 장식 (뒤로 늘어짐)
            const pc = L.cape;
            M.clear().path([[hx + 1, hy - 12], [hx - 4, hy - 15], [hx - 10 - flow * 3, hy - 14 + flow], [hx - 15 - flow * 5, hy - 8 + flow * 2], [hx - 16 - flow * 7, hy - 2 + flow * 2]], 3.4, 1.4);
            R.paint(M, ink(pc, 0.35, 0.3));
            R.line(hx - 3, hy - 14, hx - 13 - flow * 5, hy - 7 + flow * 2, dk(pc, 0.35), M);
            R.line(hx - 5, hy - 15, hx - 11 - flow * 3, hy - 13 + flow, lt(pc, 0.35), M);
          } else {
            // 금속 볏
            M.clear().poly([[hx - 7, hy - 9], [hx - 4, hy - 15], [hx + 2, hy - 15], [hx + 4, hy - 11]]);
            R.paint(M, ink(L.trim, 0.4, 0.3));
          }
        }
      } else {
        // 이마 띠 + 가운데 보석, 뺨 가리개 테두리
        R.paint(M.clear().rect(hx - 6, hy - 4, 18, 2), ink(L.trim, 0.4, 0.3));
        R.paint(M.clear().poly([[hx + 2, hy - 6], [hx + 5, hy - 6], [hx + 3.5, hy - 2]]), ink(L.glow ?? L.eye, 0.5));
        R.line(hx - 4, hy - 2, hx - 4, hy + 6, L.trim, M2);
        // 앞머리 몇 가닥
        for (const fx of [5, 8, 10]) R.line(hx + fx, hy - 2, hx + fx + 1, hy, L.hair);
      }
      break;
    }
    case 'veil': {
      face(R, L, g, { mouth: false });
      hairCap(L, g, M2);
      R.paint(M2, hk);
      hairDetail(R, L, g, M2, col);
      // 얼굴 아래를 가리는 천
      M.clear().ellipse(hx + 1, hy + 1, 10.5, 10, (x, y) => y >= hy + 5 - (x > hx + 8 ? 1 : 0));
      R.paint(M, ink(L.trim, 0.3, 0.35));
      R.line(hx - 2, hy + 7, hx + 9, hy + 6, dk(L.trim, 0.3), M);
      break;
    }
    case 'skull': {
      const bone = '#e8e0c8';
      R.paint(M.clear().ellipse(hx, hy - 1, 10.5, 10), ink(bone, 0.25, 0.25));
      R.paint(M.clear().rect(hx - 3, hy + 6, 12, 4), ink(dk(bone, 0.08)));
      R.paint(M.clear().ellipse(hx + 6, hy + 1, 2.5, 2.6), ink('#100c10'), { flat: true });
      R.paint(M.clear().ellipse(hx - 1, hy + 1, 2, 2.6), ink('#100c10'), { flat: true });
      if (L.glow) {
        R.px(hx + 6, hy + 1, L.glow);
        R.px(hx - 1, hy + 1, L.glow);
      }
      for (let i = 0; i < 5; i++) R.px(hx - 2 + i * 2, hy + 8, '#3a3428');
      break;
    }
  }
}

// ───────────── 몸 ─────────────
export function drawHeroHD(L: Look, pose: PoseName): HTMLCanvasElement {
  const P = POSES[pose] ?? POSES.idle0;
  const R = new Raster();
  const big = L.build === 'big';
  const slim = L.build === 'slim';
  const cx = 48;
  const crouch = (P.crouch ?? 0) * 2;
  const legLen = 12 - crouch;
  const hipY = FOOT - legLen;
  const bob = P.bob > 0 ? Math.min(P.bob, 1) * 2 : P.bob * 2;
  const th = big ? 15 : slim ? 12 : 13;
  const tw = big ? 16 : slim ? 11 : 12;
  const torsoBot = hipY + bob;
  const torsoTop = torsoBot - th;
  const lean = P.lean * 2;
  const tx = Math.round(cx - tw / 2 + lean * 0.5);
  const flow = P.cape ?? 0;
  const g: HeadGeo = { hx: Math.round(cx + 1 + lean), hy: torsoTop - 8 };
  const shY = torsoTop + 4;
  const sxF = tx + tw - 3;
  const sxB = tx + 3;
  const armLen = big ? 11 : 10;
  const armR = big ? 3 : 2.5;
  const body = ink(L.body, 0.28, 0.3);
  const bodyBack = ink(dk(L.body, 0.25), 0.2, 0.3);
  const trim = ink(L.trim, 0.35, 0.3);

  const ab = P.ab * D;
  const backHand: Hand = { x: sxB + Math.cos(ab) * armLen, y: shY + Math.sin(ab) * armLen };
  const af = P.af * D;
  const frontHand: Hand = { x: sxF + Math.cos(af) * armLen, y: shY + Math.sin(af) * armLen };

  // ── 날개
  if (L.extra === 'wings') {
    const wc = L.cape ?? L.body;
    const root: Pt = [tx + 3, torsoTop + 3];
    const flap = flow * 10;
    if (L.hairStyle === 'horned') {
      // 용 날개: 뼈대 + 막
      const tips: Pt[] = [
        [root[0] - 10 - flap * 0.4, root[1] - 18 + flap * 0.3],
        [root[0] - 20 - flap, root[1] - 9 + flap * 0.4],
        [root[0] - 19 - flap, root[1] + 3 + flap * 0.2],
        [root[0] - 12 - flap * 0.7, root[1] + 10],
      ];
      M.clear().poly([root, ...tips, [root[0] - 2, root[1] + 7]]);
      // 막 가장자리를 뼈대 사이에서 안으로 파낸다
      const all = [...tips, [root[0] - 2, root[1] + 7] as Pt];
      for (let i = 0; i + 1 < all.length; i++) {
        const mx = (all[i][0] + all[i + 1][0]) / 2;
        const my = (all[i][1] + all[i + 1][1]) / 2;
        const rr = Math.hypot(all[i][0] - all[i + 1][0], all[i][1] - all[i + 1][1]) * 0.3;
        const ox = mx + (mx - root[0]) * 0.12;
        const oy = my + (my - root[1]) * 0.12;
        M2.clear().ellipse(ox, oy, rr, rr);
        for (let y = M2.y0; y <= M2.y1; y++) for (let x = M2.x0; x <= M2.x1; x++) if (M2.has(x, y)) M.unset(x, y);
      }
      R.paint(M, ink(mix(wc, L.body, 0.4), 0.25, 0.3));
      for (const t of tips) R.paint(M.clear().cap(root[0], root[1], t[0], t[1], 1.3, 0.5), ink(dk(L.body, 0.1), 0.3));
      R.paint(M.clear().ellipse(...tips[0], 1.4, 1.4), ink('#e0d0b0'));
    } else {
      // 깃털 날개
      // 긴 날개깃 (뒤) → 짧은 덮깃 (앞), 깃마다 짙은 깃대
      const tipC = L.glow ? lt(L.glow, 0.35) : lt(wc, 0.4);
      for (let i = 0; i < 6; i++) {
        const ang = (-100 - i * 17 - flow * 20) * D;
        const len = 21 - Math.abs(i - 2) * 2;
        const ex = root[0] + Math.cos(ang) * len;
        const ey = root[1] + Math.sin(ang) * len + 2;
        const fc = mix(dk(wc, 0.15), tipC, 0.25);
        R.paint(M.clear().cap(root[0] - 1, root[1] + 1, ex, ey, 2.6, 1.3), ink(fc, 0.35, 0.3));
        R.line(root[0] - 1 + Math.cos(ang) * 6, root[1] + 1 + Math.sin(ang) * 6, ex - Math.cos(ang) * 2, ey - Math.sin(ang) * 2, dk(fc, 0.3), M);
        R.px(ex, ey, tipC);
      }
      for (let i = 0; i < 4; i++) {
        const ang = (-110 - i * 22 - flow * 15) * D;
        const ex = root[0] + Math.cos(ang) * 10;
        const ey = root[1] + Math.sin(ang) * 10 + 1;
        R.paint(M.clear().cap(root[0], root[1] + 1, ex, ey, 2.8, 1.8), ink(dk(wc, 0.05), 0.3, 0.3));
      }
    }
  }
  // ── 뒤 머리카락
  backHair(R, L, g, torsoBot, flow);

  // ── 망토
  if (L.cape) {
    const fl = flow * 16;
    const hemY = Math.min(FOOT - 2, torsoBot + 10 - flow * 9);
    const wave = (i: number): number => Math.sin(i * 1.7 + flow * 3) * 1.2;
    M.clear().poly([
      [tx + tw - 4, torsoTop],
      [tx + 1, torsoTop - 1],
      [tx - 3 - fl * 0.5, torsoTop + 8],
      [tx - 5 - fl, hemY - fl * 0.35 + wave(0)],
      [tx - 1 - fl * 0.75, hemY - fl * 0.2 + 1 + wave(1)],
      [tx + 3 - fl * 0.5, hemY + wave(2)],
      [tx + tw - 2 - fl * 0.3, hemY + 1],
    ]);
    const ck = ink(L.cape, 0.25, 0.32);
    R.paint(M, ck);
    // 주름 (세로로 흐르는 짙은 선)
    for (const f of [0.25, 0.55]) {
      R.line(tx + 1 - f * 4, torsoTop + 3, tx - 5 - fl * f * 1.6 + f * 8, hemY - fl * 0.3 * (1 - f) - 1, dk(L.cape, 0.35), M);
    }
    // 밑단 안감
    for (let x = M.x0; x <= M.x1; x++) {
      for (let y = M.y1; y >= M.y0; y--) {
        if (M.has(x, y)) {
          if (M.has(x, y - 1)) R.px(x, y - 1, dk(L.cape, 0.5));
          break;
        }
      }
    }
  }
  // ── 별 나침반
  if (L.extra === 'compass') {
    const ox = sxB - 16;
    const oy = shY - 14 - (P.bob > 0 ? 1 : 0);
    R.paint(M.clear().cap(ox, oy - 9, ox, oy + 9, 1, 1).cap(ox - 8, oy, ox + 8, oy, 1), ink('#a8c4ff'));
    R.paint(M.clear().ellipse(ox, oy, 3, 3), ink('#7a4ae0'));
    R.px(ox - 1, oy - 1, '#f4f4ff');
  }
  // ── 스카프 꼬리 (몸 뒤)
  if (L.extra === 'scarf') {
    const dir = (180 - (1 - flow) * 65) * D;
    const r0: Pt = [tx + 2, torsoTop];
    const p1: Pt = [r0[0] + Math.cos(dir) * 7, r0[1] + Math.sin(dir) * 7 + 1];
    const p2: Pt = [p1[0] + Math.cos(dir + 0.25) * 7, p1[1] + Math.sin(dir + 0.25) * 7 - 1];
    const p3: Pt = [p2[0] + Math.cos(dir - 0.2) * 6, p2[1] + Math.sin(dir - 0.2) * 6 + 1];
    R.paint(M.clear().path([r0, p1, p2, p3], 2.6, 1.6), ink(dk(L.trim, 0.12), 0.3, 0.3));
    R.paint(M.clear().path([[r0[0], r0[1] + 2], [p1[0] + 1, p1[1] + 3], [p2[0] + 2, p2[1] + 4]], 2, 1.2), ink(dk(L.trim, 0.3), 0.25, 0.3));
  }

  // ── 뒤 팔 (+ 방패, 뒤 단검)
  R.paint(M.clear().cap(sxB, shY, backHand.x, backHand.y, armR, armR - 0.4), bodyBack);
  R.paint(M.clear().ellipse(backHand.x, backHand.y, 2, 2), ink(dk(L.skin, 0.2)));
  if (L.weapon === 'daggers') drawWeapon(R, L, backHand, P.ab + 20, pose, backHand);
  if (L.shield) {
    const sx = backHand.x - 1;
    const sy = backHand.y - 2;
    const sk = ink(L.shield, 0.4, 0.35);
    M.clear().poly([[sx - 7, sy - 9], [sx + 7, sy - 9], [sx + 7, sy + 2], [sx, sy + 11], [sx - 7, sy + 2]]);
    R.paint(M, sk);
    M2.clear().poly([[sx - 5, sy - 7], [sx + 5, sy - 7], [sx + 5, sy + 1.5], [sx, sy + 8.5], [sx - 5, sy + 1.5]]);
    R.paint(M2, ink(L.body === '#d8d8e8' ? '#2a4aa0' : dk(L.shield, 0.35), 0.3, 0.3));
    R.paint(M.clear().rect(sx - 1, sy - 6, 2, 13).rect(sx - 4, sy - 3, 8, 2), ink(lt(L.shield, 0.35), 0.3, 0.2), { noLine: true });
    R.px(sx - 6, sy - 8, '#ffffff');
  }

  // ── 다리
  const hipF: Pt = [cx + 3 + lean * 0.3, hipY];
  const hipB: Pt = [cx - 3 + lean * 0.3, hipY];
  const ff: Pt = [cx + 1 + P.fl[0] * 2, FOOT + P.fl[1] * 2];
  const bf: Pt = [cx - 3 + P.bl[0] * 2, FOOT + P.bl[1] * 2];
  const legR = big ? 3 : 2.6;
  const boot = (f: Pt, k: Ink): void => {
    M.clear().rect(f[0] - 3, f[1] - 6, 6, 6);
    M.ellipse(f[0] + 2.5, f[1] - 2, 3.2, 2);
    R.paint(M, k);
    for (let x = M.x0; x <= M.x1; x++) if (M.has(x, f[1] - 1)) R.px(x, f[1] - 1, dk(k.base, 0.45));
    for (let x = f[0] - 3; x < f[0] + 3; x++) R.pxOn(x, f[1] - 6, lt(k.base, 0.3));
  };
  R.paint(M.clear().cap(hipB[0], hipB[1], bf[0], bf[1] - 4, legR, legR - 0.4), ink(dk(L.legs, 0.25), 0.2, 0.3));
  boot(bf, ink(dk(L.boots, 0.2), 0.25, 0.3));

  // ── 몸통
  const torso = (): void => {
    M.clear().rect(tx, torsoTop + 1, tw, th - 1);
    M.ellipse(tx + tw / 2, torsoTop + 3, tw / 2 + 0.5, 3.5);
    R.paint(M, body);
    const tm = M;
    // 옷깃 (V넥)
    const nx = tx + tw / 2 + 1;
    R.paint(M2.clear().poly([[nx - 3, torsoTop], [nx + 3, torsoTop], [nx, torsoTop + 4]]), ink(L.skin, 0.2, 0.2), { noLine: true });
    R.line(nx - 3, torsoTop + 1, nx, torsoTop + 4, L.trim, tm);
    R.line(nx + 3, torsoTop + 1, nx, torsoTop + 4, L.trim, tm);
    // 앞섶 선 + 주름
    R.line(nx + 1, torsoTop + 5, nx + 1, torsoBot - 4, dk(L.body, 0.3), tm);
    R.line(tx + 2, torsoTop + 5, tx + 3, torsoBot - 5, dk(L.body, 0.2), tm);
    R.px(nx + 3, torsoTop + 7, lt(L.body, 0.25));
    // 벨트 + 버클
    R.paint(M2.clear().rect(tx, torsoBot - 4, tw, 2), ink(L.trim === L.body ? dk(L.trim, 0.3) : L.trim, 0.35, 0.3));
    R.paint(M2.clear().rect(nx - 1, torsoBot - 5, 3, 4), ink(L.wcol2 === L.trim ? '#e8d090' : lt(L.wcol2, 0.15), 0.4, 0.3));
    // 옷자락 (엉덩이 위를 덮는다)
    const fl = flow * 3;
    M2.clear().poly([
      [tx, torsoBot - 2],
      [tx + tw, torsoBot - 2],
      [tx + tw + 1.5, torsoBot + (slim ? 4 : 3)],
      [tx - 1.5 - fl, torsoBot + (slim ? 4 : 3) - fl * 0.5],
    ]);
    R.paint(M2, body);
    for (let x = M2.x0; x <= M2.x1; x++) {
      for (let y = M2.y1; y >= M2.y0; y--) {
        if (M2.has(x, y)) {
          R.px(x, y, dk(L.trim, 0.1));
          break;
        }
      }
    }
    R.line(tx + tw / 2 - 1, torsoBot, tx + tw / 2 - 2 - fl, torsoBot + 3, dk(L.body, 0.35), M2);
    if (big) {
      // 어깨 보호대
      const plate = mix(L.body, L.trim, 0.35);
      for (const [sx, back] of [[tx + 1, true], [tx + tw - 2, false]] as [number, boolean][]) {
        M2.clear().ellipse(sx, torsoTop + 2.5, back ? 3.4 : 4.4, 3.2);
        R.paint(M2, ink(back ? dk(plate, 0.25) : plate, 0.4, 0.3));
        for (let x = M2.x0; x <= M2.x1; x++) {
          for (let y = M2.y1; y >= M2.y0; y--) {
            if (M2.has(x, y)) {
              R.px(x, y, back ? dk(L.trim, 0.25) : L.trim);
              break;
            }
          }
        }
        if (!back) R.px(sx - 2, torsoTop + 1, lt(plate, 0.7));
      }
    }
    if (L.hairStyle === 'skull') {
      for (let i = 0; i < 3; i++) R.rect(tx + 2, torsoTop + 4 + i * 3, tw - 4, 1, '#2a2620');
    }
  };
  torso();

  // ── 쇠사슬
  if (L.extra === 'chains') {
    const c0: Pt = [tx + 1, torsoBot - 2];
    for (let i = 0; i < 5; i++) {
      const x = c0[0] - 1 - i * 1.6 - flow * i * 1.5;
      const y = c0[1] + 1 + i * 2.6 - flow * i;
      if (i % 2 === 0) {
        M.clear().ellipse(x, y, 1.8, 2);
        M.unset(Math.floor(x), Math.floor(y));
        R.paint(M, ink('#a0a0b0', 0.4, 0.35), { soft: true });
      } else R.paint(M.clear().rect(x - 0.5, y - 1.5, 1, 3), ink('#80808c'), { soft: true });
    }
  }

  // ── 앞다리
  R.paint(M.clear().cap(hipF[0], hipF[1], ff[0], ff[1] - 4, legR, legR - 0.4), ink(L.legs, 0.25, 0.3));
  // 무릎 주름
  R.pxOn((hipF[0] + ff[0]) / 2 + 1, (hipF[1] + ff[1] - 4) / 2, dk(L.legs, 0.3));
  boot(ff, ink(L.boots, 0.3, 0.3));

  // ── 스카프 (목 둘레)
  if (L.extra === 'scarf') {
    R.paint(M.clear().ellipse(tx + tw / 2 + 0.5, torsoTop, tw / 2 + 1, 2.8), ink(L.trim, 0.35, 0.3));
    R.line(tx + 2, torsoTop - 1, tx + tw - 1, torsoTop + 1, dk(L.trim, 0.3), M);
  }

  // ── 머리
  head(R, L, g, flow);

  // ── 후광
  if (L.extra === 'halo') {
    M.clear().ellipse(g.hx - 1, g.hy - 15, 8.5, 3);
    M2.clear().ellipse(g.hx - 1, g.hy - 15, 6, 1.5);
    for (let y = M.y0; y <= M.y1; y++) for (let x = M.x0; x <= M.x1; x++) if (M2.has(x, y)) M.unset(x, y);
    R.paint(M, ink('#ffe890', 0.6, 0.2), { noLine: true });
  }

  // ── 앞 팔 + 무기
  const sleeve = L.weapon === 'fists' ? ink(L.skin, 0.25, 0.25) : body;
  R.paint(M.clear().cap(sxF, shY, frontHand.x, frontHand.y, armR, armR - 0.4), sleeve);
  // 소매 끝 장식
  const cf: Pt = [sxF + (frontHand.x - sxF) * 0.72, shY + (frontHand.y - shY) * 0.72];
  if (L.weapon !== 'fists') R.paint(M2.clear().cap(cf[0], cf[1], cf[0] + Math.cos(af) * 1.5, cf[1] + Math.sin(af) * 1.5, armR + 0.2), trim);
  // 어깨 장식
  if (!big) R.paint(M2.clear().ellipse(sxF, shY - 1, 2.6, 2.2), ink(L.trim, 0.4, 0.3));
  const handOver = L.weapon !== 'bow' && L.weapon !== 'fists' && L.weapon !== 'claws';
  if (L.weapon === 'bow' || L.weapon === 'orb' || L.weapon === 'flask' || L.weapon === 'talisman' || L.weapon === 'strings' || L.weapon === 'lute') {
    R.paint(M.clear().ellipse(frontHand.x, frontHand.y, 2.1, 2.1), ink(L.skin, 0.25, 0.25));
  }
  drawWeapon(R, L, frontHand, weaponAngle(L, pose, P.w, frontHand), pose, backHand);
  if (handOver && L.weapon !== 'orb' && L.weapon !== 'flask' && L.weapon !== 'talisman' && L.weapon !== 'strings' && L.weapon !== 'lute') {
    R.paint(M.clear().ellipse(frontHand.x, frontHand.y, 2.1, 2.1), ink(L.skin, 0.25, 0.25));
  }
  if (L.glow && (L.weapon === 'staff' || L.weapon === 'orb' || L.weapon === 'clock')) {
    // 손 주위 마력 반짝임
    R.px(frontHand.x + 4, frontHand.y - 6, L.glow);
  }
  return R.finish();
}
