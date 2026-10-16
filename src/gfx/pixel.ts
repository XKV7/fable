/** 오프스크린 캔버스에 픽셀 단위로 그리는 도우미. 모든 스프라이트는 이걸로 코드 생성된다. */
export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export class Pix {
  c: HTMLCanvasElement;
  g: CanvasRenderingContext2D;
  /**
   * @param k 좌표 배율. 큰 좌표계로 짜인 그림(보스 등)을 게임 공통 픽셀 밀도로 그릴 때 0.5 등을 준다.
   */
  constructor(
    public w: number,
    public h: number,
    public k = 1,
  ) {
    this.c = makeCanvas(w, h);
    this.g = this.c.getContext('2d', { willReadFrequently: true })!;
    this.g.imageSmoothingEnabled = false;
  }
  px(x: number, y: number, col: string): void {
    const k = this.k;
    this.g.fillStyle = col;
    this.g.fillRect(Math.round(x * k), Math.round(y * k), 1, 1);
  }
  rect(x: number, y: number, w: number, h: number, col: string): void {
    const k = this.k;
    this.g.fillStyle = col;
    this.g.fillRect(Math.round(x * k), Math.round(y * k), Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k)));
  }
  line(x0: number, y0: number, x1: number, y1: number, col: string): void {
    const k = this.k;
    x0 = Math.round(x0 * k);
    y0 = Math.round(y0 * k);
    x1 = Math.round(x1 * k);
    y1 = Math.round(y1 * k);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    this.g.fillStyle = col;
    for (let i = 0; i < 400; i++) {
      this.g.fillRect(x0, y0, 1, 1);
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
  disc(cx: number, cy: number, r: number, col: string): void {
    const k = this.k;
    cx *= k;
    cy *= k;
    r = Math.max(k < 1 ? 0 : 1, Math.round(r * k));
    this.g.fillStyle = col;
    for (let y = -r; y <= r; y++) {
      for (let x = -r; x <= r; x++) {
        if (x * x + y * y <= r * r + r * 0.6) this.g.fillRect(Math.round(cx + x), Math.round(cy + y), 1, 1);
      }
    }
  }
  ring(cx: number, cy: number, r: number, col: string): void {
    const k = this.k;
    cx *= k;
    cy *= k;
    r *= k;
    this.g.fillStyle = col;
    const steps = Math.max(12, Math.floor(r * 8));
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      this.g.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), 1, 1);
    }
  }
  ellipse(cx: number, cy: number, rx: number, ry: number, col: string): void {
    const k = this.k;
    cx *= k;
    cy *= k;
    rx = Math.round(rx * k);
    ry = Math.round(ry * k);
    this.g.fillStyle = col;
    for (let y = -ry; y <= ry; y++) {
      for (let x = -rx; x <= rx; x++) {
        if ((x * x) / (rx * rx + 0.3) + (y * y) / (ry * ry + 0.3) <= 1) this.g.fillRect(Math.round(cx + x), Math.round(cy + y), 1, 1);
      }
    }
  }
  /** 각도 a(라디안) 방향으로 길이 len, 두께 w의 막대 */
  bar(x: number, y: number, a: number, len: number, w: number, col: string, from = 0): void {
    const k = this.k;
    x *= k;
    y *= k;
    len *= k;
    from *= k;
    w = Math.max(1, Math.round(w * k));
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    const px = -dy;
    const py = dx;
    this.g.fillStyle = col;
    for (let t = from; t <= len; t += 0.5) {
      for (let q = -(w - 1) / 2; q <= (w - 1) / 2 + 0.01; q += 0.5) {
        this.g.fillRect(Math.round(x + dx * t + px * q), Math.round(y + dy * t + py * q), 1, 1);
      }
    }
  }
  /** 모든 스프라이트 공통 마감: 좌상단 광원 음영 → 공용 팔레트 스냅 → 공용 1px 외곽선 */
  finish(): HTMLCanvasElement {
    stylize(this.g, this.w, this.h);
    this.outline(OUTLINE);
    return this.c;
  }
  /** 불투명 픽셀 주위로 1px 외곽선 */
  outline(col: string): void {
    const { w, h } = this;
    const img = this.g.getImageData(0, 0, w, h);
    const d = img.data;
    const solid = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) solid[i] = d[i * 4 + 3] > 40 ? 1 : 0;
    const r = parseInt(col.slice(1, 3), 16);
    const gg = parseInt(col.slice(3, 5), 16);
    const b = parseInt(col.slice(5, 7), 16);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (solid[i]) continue;
        if ((x > 0 && solid[i - 1]) || (x < w - 1 && solid[i + 1]) || (y > 0 && solid[i - w]) || (y < h - 1 && solid[i + w])) {
          d[i * 4] = r;
          d[i * 4 + 1] = gg;
          d[i * 4 + 2] = b;
          d[i * 4 + 3] = 255;
        }
      }
    }
    this.g.putImageData(img, 0, 0);
  }
}

/** 공용 외곽선 색 */
export const OUTLINE = '#0a0810';

/**
 * 공용 팔레트. Resurrect 64(Kerrie Lake) + 짙은 갈색·금속·어둠 계열 보강.
 * 모든 스프라이트의 색은 마감 단계에서 이 팔레트로 스냅된다.
 */
const PALETTE_HEX = [
  '2e222f', '3e3546', '625565', '966c6c', 'ab947a', '694f62', '7f708a', '9babb2', 'c7dcd0', 'ffffff',
  '6e2727', 'b33831', 'ea4f36', 'f57d4a', 'ae2334', 'e83b3b', 'fb6b1d', 'f79617', 'f9c22b', '7a3045',
  '9e4539', 'cd683d', 'e6904e', 'fbb954', '4c3e24', '676633', 'a2a947', 'd5e04b', 'fbff86', '165a4c',
  '239063', '1ebc73', '91db69', 'cddf6c', '313638', '374e4a', '547e64', '92a984', 'b2ba90', '0b5e65',
  '0b8a8f', '0eaf9b', '30e1b9', '8ff8e2', '323353', '484a77', '4d65b4', '4d9be6', '8fd3ff', '45293f',
  '6b3e75', '905ea9', 'a884f3', 'eaaded', '753c54', 'a24b6f', 'cf657f', 'ed8099', '831c5d', 'c32454',
  'f04f78', 'f68181', 'fca790', 'fdcbb0',
  // 보강: 갈색(나무·가죽·바위)
  '2a1a14', '402a1e', '5c3a26', '7a5034', '9a6a44', 'c08a58', 'e0c090',
  // 보강: 금속·뼈
  '4a4a54', '6e6e78', 'a0a0aa', 'e8e0c8',
  // 보강: 어둠(그림자 계열 적)
  '0e0a16', '1a1226', '261a36', '14182c', '1e2a44',
  // 보강: 창백한 피부·은발·별빛 청보라 (★7 카일루스 컨셉아트 팔레트)
  'f4e8ee', 'dcdcee', 'b4b4d0', '8a8ab0', '6a86ff', 'a8c4ff', '26244a', '16141f', '2c2a44',
];

function srgbToLin(v: number): number {
  v /= 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}
/** OKLab (지각 균일 색공간) */
function oklab(r: number, g: number, b: number): [number, number, number] {
  const R = srgbToLin(r);
  const G = srgbToLin(g);
  const B = srgbToLin(b);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
const PAL = PALETTE_HEX.map((h) => {
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return { r, g, b, lab: oklab(r, g, b) };
});
const snapCache = new Map<number, number>();
/** 가장 가까운 팔레트 색. 색상 차이에 가중치를 둬 다른 색 계열로 튀지 않게 한다. */
function nearest(r: number, g: number, b: number): (typeof PAL)[number] {
  const key = (r << 16) | (g << 8) | b;
  let hit = snapCache.get(key);
  if (hit === undefined) {
    const [L, A, B] = oklab(r, g, b);
    let bd = Infinity;
    hit = 0;
    for (let i = 0; i < PAL.length; i++) {
      const q = PAL[i].lab;
      const d = (L - q[0]) ** 2 + 2 * ((A - q[1]) ** 2 + (B - q[2]) ** 2);
      if (d < bd) {
        bd = d;
        hit = i;
      }
    }
    snapCache.set(key, hit);
  }
  return PAL[hit];
}

/** #rrggbb → 공용 팔레트의 가장 가까운 색 (#rrggbb) */
export function snapColor(col: string): string {
  const p = nearest(parseInt(col.slice(1, 3), 16), parseInt(col.slice(3, 5), 16), parseInt(col.slice(5, 7), 16));
  return `#${[p.r, p.g, p.b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

const LIGHT = 0.2;
const DARK = -0.22;
/**
 * 공통 스타일 패스 (광원: 왼쪽 위).
 * - 두께 2px 이상인 면에서 위쪽 가장자리 = 하이라이트, 아래쪽 가장자리 = 그림자
 * - 그 다음 모든 색을 공용 팔레트로 스냅, 반투명 픽셀은 불투명/투명으로 정리
 */
export function stylize(g: CanvasRenderingContext2D, w: number, h: number): void {
  const img = g.getImageData(0, 0, w, h);
  const d = img.data;
  const src = new Uint8ClampedArray(d);
  const solid = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < w && y < h && src[(y * w + x) * 4 + 3] > 40;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (src[i + 3] <= 40) {
        d[i + 3] = 0;
        continue;
      }
      d[i + 3] = 255;
      const up = solid(x, y - 1);
      const dn = solid(x, y + 1);
      let f = 0;
      if (!up && dn && solid(x, y + 2)) f = LIGHT;
      else if (!dn && up && solid(x, y - 2)) f = DARK;
      let r = src[i];
      let gg = src[i + 1];
      let b = src[i + 2];
      if (f > 0) {
        r += (255 - r) * f;
        gg += (255 - gg) * f;
        b += (255 - b) * f;
      } else if (f < 0) {
        r *= 1 + f;
        gg *= 1 + f;
        b *= 1 + f;
      }
      const p = nearest(Math.round(r), Math.round(gg), Math.round(b));
      d[i] = p.r;
      d[i + 1] = p.g;
      d[i + 2] = p.b;
    }
  }
  g.putImageData(img, 0, 0);
}

/** 색 밝기 조절 (#rrggbb) */
export function shade(col: string, f: number): string {
  const r = parseInt(col.slice(1, 3), 16);
  const g = parseInt(col.slice(3, 5), 16);
  const b = parseInt(col.slice(5, 7), 16);
  const m = (v: number): number => Math.max(0, Math.min(255, Math.round(f >= 0 ? v + (255 - v) * f : v * (1 + f))));
  return `#${[m(r), m(g), m(b)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

export function rgba(col: string, a: number): string {
  const r = parseInt(col.slice(1, 3), 16);
  const g = parseInt(col.slice(3, 5), 16);
  const b = parseInt(col.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

/** 실루엣(도감 미획득용) */
export function silhouette(src: HTMLCanvasElement, col = '#0d0b14'): HTMLCanvasElement {
  const c = makeCanvas(src.width, src.height);
  const g = c.getContext('2d')!;
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = col;
  g.fillRect(0, 0, c.width, c.height);
  return c;
}

/** 흰색 섬광 버전 (피격 플래시) */
export function whiteOut(src: HTMLCanvasElement, col = '#ffffff'): HTMLCanvasElement {
  return silhouette(src, col);
}
