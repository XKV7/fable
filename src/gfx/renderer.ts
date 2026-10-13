import { makeCanvas } from './pixel';

export const W = 480;
export const H = 270;
export const FONT = '"Noto Sans KR","Malgun Gothic","Apple SD Gothic Neo","WenQuanYi Zen Hei","NanumGothic",sans-serif';

/**
 * 월드는 480×270 오프스크린 캔버스에 그린 뒤 정수 배율로 확대(픽셀 선명),
 * UI는 확대된 디스플레이 캔버스에 같은 좌표계(scale 변환)로 그려 한글이 또렷하게 보이게 한다.
 */
export class Renderer {
  display: HTMLCanvasElement;
  d: CanvasRenderingContext2D;
  world: HTMLCanvasElement;
  w: CanvasRenderingContext2D;
  scale = 2;

  constructor(canvas: HTMLCanvasElement) {
    this.display = canvas;
    this.d = canvas.getContext('2d')!;
    this.world = makeCanvas(W, H);
    this.w = this.world.getContext('2d')!;
    this.w.imageSmoothingEnabled = false;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const availW = window.innerWidth * dpr;
    const availH = window.innerHeight * dpr;
    this.scale = Math.max(1, Math.floor(Math.min(availW / W, availH / H)));
    this.display.width = W * this.scale;
    this.display.height = H * this.scale;
    this.display.style.width = `${(W * this.scale) / dpr}px`;
    this.display.style.height = `${(H * this.scale) / dpr}px`;
    this.d.imageSmoothingEnabled = false;
  }

  beginFrame(): void {
    this.w.setTransform(1, 0, 0, 1, 0, 0);
    this.w.globalAlpha = 1;
    this.w.globalCompositeOperation = 'source-over';
    this.w.fillStyle = '#000';
    this.w.fillRect(0, 0, W, H);
  }

  present(shakeX = 0, shakeY = 0): void {
    const d = this.d;
    d.setTransform(1, 0, 0, 1, 0, 0);
    d.globalAlpha = 1;
    d.globalCompositeOperation = 'source-over';
    d.fillStyle = '#000';
    d.fillRect(0, 0, this.display.width, this.display.height);
    d.imageSmoothingEnabled = false;
    d.drawImage(this.world, Math.round(shakeX) * this.scale, Math.round(shakeY) * this.scale, W * this.scale, H * this.scale);
    d.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    d.imageSmoothingEnabled = false;
  }
}

export interface TextOpts {
  size?: number;
  color?: string;
  align?: CanvasTextAlign;
  base?: CanvasTextBaseline;
  shadow?: string | null;
  bold?: boolean;
  alpha?: number;
  maxW?: number;
}

export function text(g: CanvasRenderingContext2D, s: string, x: number, y: number, o: TextOpts = {}): void {
  const size = o.size ?? 8;
  g.save();
  g.font = `${o.bold ? '700 ' : ''}${size}px ${FONT}`;
  g.textAlign = o.align ?? 'left';
  g.textBaseline = o.base ?? 'top';
  if (o.alpha !== undefined) g.globalAlpha *= o.alpha;
  if (o.shadow !== null) {
    g.fillStyle = o.shadow ?? 'rgba(0,0,0,0.85)';
    g.fillText(s, x + 0.6, y + 0.6, o.maxW);
  }
  g.fillStyle = o.color ?? '#f0e8d8';
  g.fillText(s, x, y, o.maxW);
  g.restore();
}

export function measure(g: CanvasRenderingContext2D, s: string, size = 8, bold = false): number {
  g.save();
  g.font = `${bold ? '700 ' : ''}${size}px ${FONT}`;
  const w = g.measureText(s).width;
  g.restore();
  return w;
}

/** 폭에 맞춰 줄바꿈 (한글은 글자 단위로 끊을 수 있음) */
export function wrap(g: CanvasRenderingContext2D, s: string, maxW: number, size = 8): string[] {
  const out: string[] = [];
  for (const para of s.split('\n')) {
    const words = para.split(' ');
    let line = '';
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (measure(g, test, size) <= maxW) {
        line = test;
        continue;
      }
      if (line) out.push(line);
      if (measure(g, word, size) <= maxW) {
        line = word;
      } else {
        let cur = '';
        for (const ch of word) {
          if (measure(g, cur + ch, size) > maxW) {
            out.push(cur);
            cur = ch;
          } else cur += ch;
        }
        line = cur;
      }
    }
    out.push(line);
  }
  return out;
}

export function textBlock(g: CanvasRenderingContext2D, s: string, x: number, y: number, maxW: number, o: TextOpts = {}, lineH?: number): number {
  const size = o.size ?? 8;
  const lines = wrap(g, s, maxW, size);
  const lh = lineH ?? size + 3;
  lines.forEach((l, i) => text(g, l, x, y + i * lh, o));
  return lines.length * lh;
}
