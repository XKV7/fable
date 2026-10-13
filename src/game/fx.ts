import type { SlashFx } from './types';
import { FONT } from '../gfx/renderer';
import { rgba } from '../gfx/pixel';

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  col: string;
  size: number;
  grav: number;
  kind: 'px' | 'spark' | 'ring' | 'soul' | 'glow' | 'smoke' | 'line' | 'rubble';
  drag: number;
  target?: { x: number; y: number };
  add?: boolean;
}

export interface DmgText {
  x: number;
  y: number;
  vy: number;
  life: number;
  text: string;
  col: string;
  size: number;
  crit: boolean;
}

export interface Slash {
  x: number;
  y: number;
  dir: number;
  fx: SlashFx;
  life: number;
  max: number;
  col: string;
}

export interface Ghost {
  img: HTMLCanvasElement;
  x: number;
  y: number;
  flip: boolean;
  life: number;
  max: number;
  col: string;
}

export interface Light {
  x: number;
  y: number;
  r: number;
  col: string;
  life: number;
  max: number;
}

/** 파티클·데미지 숫자·베기 궤적·잔상·순간광 */
export class Fx {
  parts: Particle[] = [];
  texts: DmgText[] = [];
  slashes: Slash[] = [];
  ghosts: Ghost[] = [];
  lights: Light[] = [];
  bolts: { pts: [number, number][]; life: number; max: number; col: string }[] = [];
  showNumbers = true;

  lightning(x0: number, y0: number, x1: number, y1: number, col = '#bff0ff'): void {
    const pts: [number, number][] = [[x0, y0]];
    const n = Math.max(3, Math.floor(Math.hypot(x1 - x0, y1 - y0) / 10));
    for (let i = 1; i < n; i++) {
      const t = i / n;
      pts.push([x0 + (x1 - x0) * t + (Math.random() - 0.5) * 10, y0 + (y1 - y0) * t + (Math.random() - 0.5) * 10]);
    }
    pts.push([x1, y1]);
    this.bolts.push({ pts, life: 0, max: 10, col });
    this.light((x0 + x1) / 2, (y0 + y1) / 2, 60, col, 8);
  }

  burst(x: number, y: number, col: string, n: number, spd = 2, opts: Partial<Particle> = {}): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = spd * (0.3 + Math.random() * 0.9);
      this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - (opts.grav ? 1 : 0), life: 0, max: 18 + Math.random() * 18, col, size: 1 + Math.floor(Math.random() * 2), grav: 0.08, kind: 'px', drag: 0.92, ...opts });
    }
  }

  sparks(x: number, y: number, dir: number, col: string, n = 6): void {
    for (let i = 0; i < n; i++) {
      const a = (dir > 0 ? 0 : Math.PI) + (Math.random() - 0.5) * 1.6;
      const s = 2 + Math.random() * 3.5;
      this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0, max: 8 + Math.random() * 8, col, size: 1, grav: 0.05, kind: 'spark', drag: 0.85 });
    }
  }

  ring(x: number, y: number, col: string, r = 20, max = 16): void {
    this.parts.push({ x, y, vx: 0, vy: 0, life: 0, max, col, size: r, grav: 0, kind: 'ring', drag: 1 });
  }

  glow(x: number, y: number, col: string, r = 16, max = 12): void {
    this.parts.push({ x, y, vx: 0, vy: 0, life: 0, max, col, size: r, grav: 0, kind: 'glow', drag: 1, add: true });
  }

  smoke(x: number, y: number, col = '#504858', n = 4): void {
    for (let i = 0; i < n; i++) this.parts.push({ x: x + (Math.random() - 0.5) * 8, y, vx: (Math.random() - 0.5) * 1.2, vy: -Math.random() * 0.6, life: 0, max: 20 + Math.random() * 14, col, size: 2 + Math.random() * 2, grav: -0.01, kind: 'smoke', drag: 0.95 });
  }

  dust(x: number, y: number, n = 6): void {
    for (let i = 0; i < n; i++) {
      const d = i % 2 ? 1 : -1;
      this.parts.push({ x, y, vx: d * (0.5 + Math.random() * 1.5), vy: -Math.random() * 0.8, life: 0, max: 14 + Math.random() * 10, col: '#a8a0b0', size: 2, grav: 0.02, kind: 'smoke', drag: 0.9 });
    }
  }

  souls(x: number, y: number, target: { x: number; y: number }, n = 4, col = '#9ef0ff'): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      this.parts.push({ x, y, vx: Math.cos(a) * 2.5, vy: Math.sin(a) * 2.5 - 1, life: 0, max: 90, col, size: 2, grav: 0, kind: 'soul', drag: 0.94, target });
    }
  }

  number(x: number, y: number, v: number | string, col: string, crit = false, size = 7): void {
    if (!this.showNumbers && typeof v === 'number') return;
    this.texts.push({ x: x + (Math.random() - 0.5) * 8, y, vy: crit ? -1.6 : -1.1, life: crit ? 50 : 38, text: typeof v === 'number' ? String(Math.round(v)) : v, col, size: crit ? size + 3 : size, crit });
    if (this.texts.length > 60) this.texts.shift();
  }

  slash(x: number, y: number, dir: number, fx: SlashFx, col: string): void {
    const max = fx.arc === 'thrust' ? 8 : fx.arc === 'circle' ? 14 : 10;
    this.slashes.push({ x: x + (fx.dx ?? 0) * dir, y: y + (fx.dy ?? 0), dir, fx, life: 0, max, col: fx.col ?? col });
  }

  ghost(img: HTMLCanvasElement, x: number, y: number, flip: boolean, col: string, max = 16): void {
    this.ghosts.push({ img, x, y, flip, life: 0, max, col });
  }

  light(x: number, y: number, r: number, col: string, max = 10): void {
    this.lights.push({ x, y, r, col, life: 0, max });
  }

  update(): void {
    for (const p of this.parts) {
      p.life++;
      if (p.kind === 'soul' && p.target && p.life > 14) {
        const dx = p.target.x - p.x;
        const dy = p.target.y - p.y;
        const d = Math.hypot(dx, dy) || 1;
        const s = Math.min(8, 1 + p.life * 0.15);
        p.vx += (dx / d) * s * 0.25;
        p.vy += (dy / d) * s * 0.25;
        if (d < 8) p.life = p.max;
      }
      p.vx *= p.drag;
      p.vy = p.vy * p.drag + p.grav;
      p.x += p.vx;
      p.y += p.vy;
    }
    this.parts = this.parts.filter((p) => p.life < p.max);
    if (this.parts.length > 900) this.parts.splice(0, this.parts.length - 900);
    for (const t of this.texts) {
      t.life--;
      t.y += t.vy;
      t.vy *= 0.92;
    }
    this.texts = this.texts.filter((t) => t.life > 0);
    for (const s of this.slashes) s.life++;
    this.slashes = this.slashes.filter((s) => s.life < s.max);
    for (const g of this.ghosts) g.life++;
    this.ghosts = this.ghosts.filter((g) => g.life < g.max);
    for (const b of this.bolts) b.life++;
    this.bolts = this.bolts.filter((b) => b.life < b.max);
    for (const l of this.lights) l.life++;
    this.lights = this.lights.filter((l) => l.life < l.max);
  }

  renderBack(g: CanvasRenderingContext2D, cx: number, cy: number): void {
    for (const gh of this.ghosts) {
      const a = 1 - gh.life / gh.max;
      g.save();
      g.globalAlpha = a * 0.55;
      const img = gh.img;
      const x = Math.round(gh.x - cx);
      const y = Math.round(gh.y - cy);
      if (gh.flip) {
        g.translate(x + img.width / 2, 0);
        g.scale(-1, 1);
        g.drawImage(img, -img.width / 2, y);
      } else g.drawImage(img, x, y);
      g.restore();
    }
  }

  renderFront(g: CanvasRenderingContext2D, cx: number, cy: number): void {
    // 베기 궤적
    for (const s of this.slashes) this.drawSlash(g, s, cx, cy);
    for (const b of this.bolts) {
      const a = 1 - b.life / b.max;
      g.save();
      g.globalCompositeOperation = 'lighter';
      for (const [w, c] of [[3, rgba(b.col, a * 0.5)], [1, rgba('#ffffff', a)]] as [number, string][]) {
        g.strokeStyle = c;
        g.lineWidth = w;
        g.beginPath();
        b.pts.forEach(([x, y], i) => (i ? g.lineTo(x - cx, y - cy) : g.moveTo(x - cx, y - cy)));
        g.stroke();
      }
      g.restore();
    }
    for (const p of this.parts) {
      const t = p.life / p.max;
      const x = p.x - cx;
      const y = p.y - cy;
      if (p.kind === 'ring') {
        g.strokeStyle = rgba(p.col, 1 - t);
        g.lineWidth = Math.max(1, 3 * (1 - t));
        g.beginPath();
        g.arc(x, y, p.size * (0.3 + t * 0.9), 0, Math.PI * 2);
        g.stroke();
      } else if (p.kind === 'glow') {
        g.save();
        g.globalCompositeOperation = 'lighter';
        const r = p.size * (1 - t * 0.5);
        const gr = g.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, rgba(p.col, 0.8 * (1 - t)));
        gr.addColorStop(1, rgba(p.col, 0));
        g.fillStyle = gr;
        g.fillRect(x - r, y - r, r * 2, r * 2);
        g.restore();
      } else if (p.kind === 'smoke') {
        g.fillStyle = rgba(p.col, 0.6 * (1 - t));
        const s = p.size * (1 + t);
        g.fillRect(Math.round(x - s / 2), Math.round(y - s / 2), Math.ceil(s), Math.ceil(s));
      } else if (p.kind === 'spark') {
        g.strokeStyle = rgba(p.col, 1 - t * 0.5);
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x - p.vx * 2, y - p.vy * 2);
        g.stroke();
      } else if (p.kind === 'soul') {
        g.fillStyle = p.col;
        g.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 2);
        g.fillStyle = rgba(p.col, 0.35);
        g.fillRect(Math.round(x - p.vx) - 1, Math.round(y - p.vy) - 1, 2, 2);
      } else {
        g.fillStyle = t > 0.7 ? rgba(p.col, (1 - t) / 0.3) : p.col;
        g.fillRect(Math.round(x), Math.round(y), p.size, p.size);
      }
    }
  }

  renderLights(g: CanvasRenderingContext2D, cx: number, cy: number): void {
    for (const l of this.lights) {
      const t = l.life / l.max;
      const x = l.x - cx;
      const y = l.y - cy;
      const gr = g.createRadialGradient(x, y, 0, x, y, l.r);
      gr.addColorStop(0, rgba(l.col, 0.9 * (1 - t)));
      gr.addColorStop(1, rgba(l.col, 0));
      g.fillStyle = gr;
      g.fillRect(x - l.r, y - l.r, l.r * 2, l.r * 2);
    }
  }

  renderTexts(g: CanvasRenderingContext2D, cx: number, cy: number): void {
    for (const t of this.texts) {
      const a = Math.min(1, t.life / 12);
      const s = t.crit && t.life > 40 ? t.size + (t.life - 40) * 0.4 : t.size;
      g.save();
      g.globalAlpha = a;
      g.font = `700 ${s}px ${FONT}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.lineWidth = 2.2;
      g.strokeStyle = 'rgba(10,6,16,0.95)';
      g.strokeText(t.text, t.x - cx, t.y - cy);
      g.fillStyle = t.col;
      g.fillText(t.text, t.x - cx, t.y - cy);
      g.restore();
    }
  }

  private drawSlash(g: CanvasRenderingContext2D, s: Slash, cx: number, cy: number): void {
    const t = s.life / s.max;
    const x = s.x - cx;
    const y = s.y - cy;
    const r = s.fx.r;
    const d = s.dir;
    g.save();
    g.translate(x, y);
    g.scale(d, 1);
    const a = 1 - t;
    g.globalCompositeOperation = 'lighter';
    const col = s.col;
    const width = Math.max(1, 6 * (1 - t));
    const arcDraw = (a0: number, a1: number, rr: number, w: number, alpha: number): void => {
      g.strokeStyle = rgba(col, alpha);
      g.lineWidth = w;
      g.beginPath();
      g.arc(0, 0, rr, a0, a1);
      g.stroke();
    };
    switch (s.fx.arc) {
      case 'h': {
        const sweep = Math.min(1, t * 2.5);
        arcDraw(-1.4, -1.4 + 2.6 * sweep, r, width, a);
        arcDraw(-1.4, -1.4 + 2.6 * sweep, r - 3, width * 0.5, a * 0.5);
        break;
      }
      case 'down': {
        const sweep = Math.min(1, t * 2.5);
        arcDraw(-1.7, -1.7 + 2.6 * sweep, r, width, a);
        arcDraw(-1.7, -1.7 + 2.6 * sweep, r * 0.7, width * 0.5, a * 0.6);
        break;
      }
      case 'up': {
        const sweep = Math.min(1, t * 2.5);
        arcDraw(1.6 - 2.8 * sweep, 1.6, r, width, a);
        arcDraw(1.6 - 2.8 * sweep, 1.6, r * 0.7, width * 0.5, a * 0.6);
        break;
      }
      case 'thrust': {
        const len = r * Math.min(1, t * 3);
        g.strokeStyle = rgba(col, a);
        g.lineWidth = Math.max(1, 4 * (1 - t));
        g.beginPath();
        g.moveTo(4, 0);
        g.lineTo(4 + len, 0);
        g.stroke();
        g.lineWidth = 1;
        g.strokeStyle = rgba('#ffffff', a);
        g.beginPath();
        g.moveTo(4 + len * 0.3, -2);
        g.lineTo(4 + len, 0);
        g.lineTo(4 + len * 0.3, 2);
        g.stroke();
        break;
      }
      case 'spin':
        arcDraw(t * 6, t * 6 + 4.5, r, width, a);
        arcDraw(t * 6 + Math.PI, t * 6 + Math.PI + 2, r * 0.75, width * 0.6, a * 0.6);
        break;
      case 'slam': {
        const sweep = Math.min(1, t * 2.2);
        arcDraw(-2.2, -2.2 + 3 * sweep, r, width * 1.3, a);
        if (t > 0.35) {
          g.strokeStyle = rgba(col, a);
          g.lineWidth = 2;
          g.beginPath();
          g.moveTo(r * 0.2, 14);
          g.lineTo(r * 1.4 * t + 10, 14);
          g.stroke();
        }
        break;
      }
      case 'x':
        g.strokeStyle = rgba(col, a);
        g.lineWidth = Math.max(1, 3 * (1 - t));
        g.beginPath();
        g.moveTo(r * 0.1, -r * 0.8);
        g.lineTo(r * 1.4, r * 0.8);
        g.moveTo(r * 0.1, r * 0.8);
        g.lineTo(r * 1.4, -r * 0.8);
        g.stroke();
        break;
      case 'circle':
        arcDraw(0, Math.PI * 2, r * (0.4 + t * 0.8), width, a);
        break;
    }
    g.restore();
  }
}

/** 카메라 + 흔들림 */
export class Camera {
  x = 0;
  y = 0;
  shakeT = 0;
  shakeMag = 0;
  sx = 0;
  sy = 0;
  shakeScale = 1;

  shake(mag: number, dur = 12): void {
    if (mag * this.shakeScale > this.shakeMag * (this.shakeT > 0 ? 1 : 0)) this.shakeMag = mag * this.shakeScale;
    this.shakeT = Math.max(this.shakeT, dur);
  }

  follow(tx: number, ty: number, worldW: number, worldH: number, vw: number, vh: number, snap = false): void {
    const dx = tx - vw / 2;
    const dy = ty - vh / 2 - 10;
    if (snap) {
      this.x = dx;
      this.y = dy;
    } else {
      this.x += (dx - this.x) * 0.14;
      this.y += (dy - this.y) * 0.1;
    }
    this.x = Math.max(0, Math.min(worldW - vw, this.x));
    this.y = Math.max(0, Math.min(worldH - vh, this.y));
  }

  update(): void {
    if (this.shakeT > 0) {
      this.shakeT--;
      const m = this.shakeMag * (this.shakeT / 12 > 1 ? 1 : this.shakeT / 12);
      this.sx = (Math.random() * 2 - 1) * m;
      this.sy = (Math.random() * 2 - 1) * m;
      if (this.shakeT === 0) this.shakeMag = 0;
    } else {
      this.sx = 0;
      this.sy = 0;
    }
  }
}
