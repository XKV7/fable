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
  constructor(
    public w: number,
    public h: number,
  ) {
    this.c = makeCanvas(w, h);
    this.g = this.c.getContext('2d')!;
    this.g.imageSmoothingEnabled = false;
  }
  px(x: number, y: number, col: string): void {
    this.g.fillStyle = col;
    this.g.fillRect(Math.round(x), Math.round(y), 1, 1);
  }
  rect(x: number, y: number, w: number, h: number, col: string): void {
    this.g.fillStyle = col;
    this.g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }
  line(x0: number, y0: number, x1: number, y1: number, col: string): void {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
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
    this.g.fillStyle = col;
    for (let y = -r; y <= r; y++) {
      for (let x = -r; x <= r; x++) {
        if (x * x + y * y <= r * r + r * 0.6) this.g.fillRect(Math.round(cx + x), Math.round(cy + y), 1, 1);
      }
    }
  }
  ring(cx: number, cy: number, r: number, col: string): void {
    this.g.fillStyle = col;
    const steps = Math.max(12, Math.floor(r * 8));
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      this.g.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), 1, 1);
    }
  }
  ellipse(cx: number, cy: number, rx: number, ry: number, col: string): void {
    this.g.fillStyle = col;
    for (let y = -ry; y <= ry; y++) {
      for (let x = -rx; x <= rx; x++) {
        if ((x * x) / (rx * rx + 0.3) + (y * y) / (ry * ry + 0.3) <= 1) this.g.fillRect(Math.round(cx + x), Math.round(cy + y), 1, 1);
      }
    }
  }
  /** 각도 a(라디안) 방향으로 길이 len, 두께 w의 막대 */
  bar(x: number, y: number, a: number, len: number, w: number, col: string, from = 0): void {
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    const px = -dy;
    const py = dx;
    this.g.fillStyle = col;
    for (let t = from; t <= len; t += 0.5) {
      for (let k = -(w - 1) / 2; k <= (w - 1) / 2 + 0.01; k += 0.5) {
        this.g.fillRect(Math.round(x + dx * t + px * k), Math.round(y + dy * t + py * k), 1, 1);
      }
    }
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
