import { text, measure, wrap } from '../gfx/renderer';
import type { Input } from '../core/input';
import { audio } from '../core/audio';
import { rgba } from '../gfx/pixel';
import { RARITY_COL } from './theme';

export function panel(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, o: { col?: string; border?: string; alpha?: number; glow?: string } = {}): void {
  g.save();
  g.globalAlpha *= o.alpha ?? 1;
  g.fillStyle = o.col ?? 'rgba(14,10,24,0.92)';
  g.fillRect(x, y, w, h);
  g.strokeStyle = o.border ?? '#4a3a6a';
  g.lineWidth = 1;
  g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  g.strokeStyle = 'rgba(255,255,255,0.06)';
  g.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
  // 모서리 장식
  g.fillStyle = o.glow ?? '#8a6ad0';
  for (const [cx, cy] of [[x, y], [x + w - 3, y], [x, y + h - 3], [x + w - 3, y + h - 3]]) g.fillRect(cx, cy, 3, 3);
  g.restore();
}

export function bar(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, frac: number, col: string, back = '#1a1424', ghost?: number): void {
  g.fillStyle = '#05030a';
  g.fillRect(x - 1, y - 1, w + 2, h + 2);
  g.fillStyle = back;
  g.fillRect(x, y, w, h);
  if (ghost !== undefined && ghost > frac) {
    g.fillStyle = '#ffffff';
    g.fillRect(x, y, Math.max(0, Math.min(1, ghost)) * w, h);
  }
  g.fillStyle = col;
  g.fillRect(x, y, Math.max(0, Math.min(1, frac)) * w, h);
  g.fillStyle = 'rgba(255,255,255,0.25)';
  g.fillRect(x, y, Math.max(0, Math.min(1, frac)) * w, Math.max(1, Math.floor(h / 3)));
}

export function stars(g: CanvasRenderingContext2D, x: number, y: number, n: number, size = 6, align: 'left' | 'center' = 'left'): void {
  const col = RARITY_COL[n as 3 | 4 | 5 | 6 | 7] ?? '#ffffff';
  const total = n * (size + 1);
  const sx = align === 'center' ? x - total / 2 : x;
  for (let i = 0; i < n; i++) {
    const cx = sx + i * (size + 1) + size / 2;
    const cy = y + size / 2;
    g.fillStyle = col;
    g.beginPath();
    for (let k = 0; k < 10; k++) {
      const r = k % 2 ? size * 0.22 : size * 0.5;
      const a = (k / 10) * Math.PI * 2 - Math.PI / 2;
      g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    g.fill();
  }
}

export function button(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, label: string, sel: boolean, o: { disabled?: boolean; col?: string; size?: number; sub?: string } = {}): void {
  const col = o.col ?? '#8a6ad0';
  g.fillStyle = sel ? rgba(col, 0.35) : 'rgba(20,14,34,0.9)';
  g.fillRect(x, y, w, h);
  g.strokeStyle = sel ? col : '#3a2e52';
  g.lineWidth = 1;
  g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  if (sel) {
    g.fillStyle = col;
    g.fillRect(x, y, 2, h);
  }
  const size = o.size ?? 8;
  text(g, label, x + w / 2, y + h / 2 - (o.sub ? 4 : 0), { size, align: 'center', base: 'middle', color: o.disabled ? '#6a6078' : sel ? '#ffffff' : '#d8d0e8', bold: sel });
  if (o.sub) text(g, o.sub, x + w / 2, y + h / 2 + 6, { size: 6, align: 'center', base: 'middle', color: o.disabled ? '#5a5068' : '#a8a0c0' });
}

/** 마우스 히트 영역 관리 (렌더 시 등록 → 다음 업데이트에서 판정) */
export class Hot {
  rects: { x: number; y: number; w: number; h: number; id: string }[] = [];
  mouse = { x: -1, y: -1, moved: false, click: false };
  clear(): void {
    this.rects = [];
  }
  add(id: string, x: number, y: number, w: number, h: number): void {
    this.rects.push({ x, y, w, h, id });
  }
  hover(): string | null {
    for (let i = this.rects.length - 1; i >= 0; i--) {
      const r = this.rects[i];
      if (this.mouse.x >= r.x && this.mouse.x < r.x + r.w && this.mouse.y >= r.y && this.mouse.y < r.y + r.h) return r.id;
    }
    return null;
  }
}
export const hot = new Hot();

/** 세로 목록 메뉴 */
export class Menu {
  sel = 0;
  constructor(
    public items: { label: string; disabled?: boolean; sub?: string; col?: string }[],
    public id = 'menu',
  ) {}
  update(inp: Input, horizontal = false): 'ok' | 'back' | null {
    const n = this.items.length;
    if (!n) return inp.menu('back') ? 'back' : null;
    const prev = horizontal ? 'mleft' : 'mup';
    const next = horizontal ? 'mright' : 'mdown';
    if (inp.menu(prev)) {
      this.sel = (this.sel - 1 + n) % n;
      audio.play('select');
    }
    if (inp.menu(next)) {
      this.sel = (this.sel + 1) % n;
      audio.play('select');
    }
    const h = hot.hover();
    if (h && h.startsWith(this.id + ':')) {
      const i = Number(h.slice(this.id.length + 1));
      if (hot.mouse.moved && i !== this.sel) this.sel = i;
      if (hot.mouse.click) {
        this.sel = i;
        if (this.items[i].disabled) {
          audio.play('error');
          return null;
        }
        audio.play('confirm');
        return 'ok';
      }
    }
    if (inp.menu('ok')) {
      if (this.items[this.sel]?.disabled) {
        audio.play('error');
        return null;
      }
      audio.play('confirm');
      return 'ok';
    }
    if (inp.menu('back')) {
      audio.play('back');
      return 'back';
    }
    return null;
  }
  render(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, gap = 4, size = 8): void {
    this.items.forEach((it, i) => {
      const yy = y + i * (h + gap);
      button(g, x, yy, w, h, it.label, i === this.sel, { disabled: it.disabled, sub: it.sub, col: it.col, size });
      hot.add(`${this.id}:${i}`, x, yy, w, h);
    });
  }
}

export function tooltip(g: CanvasRenderingContext2D, x: number, y: number, w: number, title: string, body: string, col = '#c0a0ff'): number {
  const lines = wrap(g, body, w - 12, 7);
  const h = 22 + lines.length * 10;
  panel(g, x, y, w, h, { border: col });
  text(g, title, x + 6, y + 5, { size: 8, color: col, bold: true });
  lines.forEach((l, i) => text(g, l, x + 6, y + 18 + i * 10, { size: 7, color: '#d8d0e8' }));
  return h;
}

export function centerText(g: CanvasRenderingContext2D, s: string, y: number, size = 8, color = '#f0e8d8', bold = false): void {
  text(g, s, 240, y, { size, color, align: 'center', bold });
}

export function keyHint(g: CanvasRenderingContext2D, items: [string, string][], y = 258): void {
  const parts = items.map(([k, l]) => `[${k}] ${l}`);
  const s = parts.join('   ');
  const w = measure(g, s, 7);
  g.fillStyle = 'rgba(0,0,0,0.5)';
  g.fillRect(240 - w / 2 - 6, y - 2, w + 12, 12);
  text(g, s, 240, y, { size: 7, align: 'center', color: '#b8b0c8' });
}
