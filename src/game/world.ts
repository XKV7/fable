import type { ChapterDef } from '../data/meta';
import { shade } from '../gfx/pixel';

export const TS = 16;

export const enum Tile {
  Empty = 0,
  Solid = 1,
  OneWay = 2,
  Spike = 3,
  Break = 4,
  Crumble = 5,
  Lava = 6,
}

export interface Body {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  onGround: boolean;
  dropTimer: number;
  hitWall: number; // 이번 프레임 벽 충돌 방향
  /** 무너지는 발판을 밟아도 무너뜨리지 않음 (적) */
  noCrumble?: boolean;
}

export function newBody(x: number, y: number, w: number, h: number): Body {
  return { x, y, w, h, vx: 0, vy: 0, onGround: false, dropTimer: 0, hitWall: 0 };
}

/** 타일맵 + 충돌. 부서지는 벽/무너지는 바닥 상태 포함 */
export class World {
  w: number;
  h: number;
  t: Uint8Array;
  breakHp = new Map<number, number>();
  crumble = new Map<number, number>(); // idx → 남은 프레임(양수: 무너지는 중, 음수: 재생성 대기)
  pxW: number;
  pxH: number;
  cache: HTMLCanvasElement | null = null;
  dirty = true;
  deco: { x: number; y: number; kind: number }[] = [];
  openBottom = false; // 심연: 바닥 아래가 허공

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.t = new Uint8Array(w * h);
    this.pxW = w * TS;
    this.pxH = h * TS;
  }

  get(tx: number, ty: number): Tile {
    if (tx < 0 || tx >= this.w) return Tile.Solid;
    if (ty < 0) return Tile.Empty;
    if (ty >= this.h) return this.openBottom ? Tile.Empty : Tile.Solid;
    return this.t[ty * this.w + tx] as Tile;
  }
  set(tx: number, ty: number, v: Tile): void {
    if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return;
    this.t[ty * this.w + tx] = v;
    this.dirty = true;
  }
  solid(tx: number, ty: number): boolean {
    const v = this.get(tx, ty);
    if (v === Tile.Solid || v === Tile.Break) return true;
    if (v === Tile.Crumble) {
      const c = this.crumble.get(ty * this.w + tx);
      return c === undefined || c > 0;
    }
    return false;
  }
  solidPx(x: number, y: number): boolean {
    return this.solid(Math.floor(x / TS), Math.floor(y / TS));
  }

  /** 축 분리 이동 + 일방향 발판 + 바닥 판정 */
  move(b: Body, ignoreOneWay = false): void {
    b.hitWall = 0;
    // X
    b.x += b.vx;
    if (b.vx !== 0) {
      const dir = b.vx > 0 ? 1 : -1;
      const edge = dir > 0 ? b.x + b.w : b.x;
      const tx = Math.floor((dir > 0 ? edge - 0.001 : edge) / TS);
      const ty0 = Math.floor(b.y / TS);
      const ty1 = Math.floor((b.y + b.h - 0.001) / TS);
      for (let ty = ty0; ty <= ty1; ty++) {
        if (this.solid(tx, ty)) {
          if (dir > 0) b.x = tx * TS - b.w;
          else b.x = (tx + 1) * TS;
          b.hitWall = dir;
          b.vx = 0;
          break;
        }
      }
    }
    // Y
    const prevBottom = b.y + b.h;
    b.y += b.vy;
    b.onGround = false;
    const tx0 = Math.floor(b.x / TS);
    const tx1 = Math.floor((b.x + b.w - 0.001) / TS);
    if (b.vy > 0) {
      const ty = Math.floor((b.y + b.h - 0.001) / TS);
      for (let tx = tx0; tx <= tx1; tx++) {
        const v = this.get(tx, ty);
        const isOneWay = v === Tile.OneWay && !ignoreOneWay && b.dropTimer <= 0 && prevBottom <= ty * TS + 0.5;
        if (this.solid(tx, ty) || isOneWay) {
          b.y = ty * TS - b.h;
          b.vy = 0;
          b.onGround = true;
          if (v === Tile.Crumble && !b.noCrumble) this.touchCrumble(tx, ty);
          break;
        }
      }
    } else if (b.vy < 0) {
      const ty = Math.floor(b.y / TS);
      for (let tx = tx0; tx <= tx1; tx++) {
        if (this.solid(tx, ty)) {
          b.y = (ty + 1) * TS;
          b.vy = 0;
          break;
        }
      }
    } else {
      // 정지 상태에서도 접지 확인
      const ty = Math.floor((b.y + b.h + 0.5) / TS);
      for (let tx = tx0; tx <= tx1; tx++) {
        const v = this.get(tx, ty);
        if (this.solid(tx, ty) || (v === Tile.OneWay && !ignoreOneWay && b.dropTimer <= 0 && Math.abs(b.y + b.h - ty * TS) < 0.6)) {
          b.onGround = true;
          if (v === Tile.Crumble && !b.noCrumble) this.touchCrumble(tx, ty);
          break;
        }
      }
    }
    if (b.dropTimer > 0) b.dropTimer--;
  }

  /** 발 아래가 일방향 발판인지 */
  onOneWay(b: Body): boolean {
    const ty = Math.floor((b.y + b.h + 1) / TS);
    const tx0 = Math.floor(b.x / TS);
    const tx1 = Math.floor((b.x + b.w - 0.001) / TS);
    let any = false;
    for (let tx = tx0; tx <= tx1; tx++) {
      const v = this.get(tx, ty);
      if (this.solid(tx, ty)) return false;
      if (v === Tile.OneWay) any = true;
    }
    return any;
  }

  /** 몸이 닿은 위험 타일 */
  hazardAt(b: Body): Tile {
    const tx0 = Math.floor((b.x + 2) / TS);
    const tx1 = Math.floor((b.x + b.w - 2) / TS);
    const ty0 = Math.floor((b.y + 4) / TS);
    const ty1 = Math.floor((b.y + b.h) / TS);
    for (let ty = ty0; ty <= ty1; ty++)
      for (let tx = tx0; tx <= tx1; tx++) {
        const v = this.get(tx, ty);
        if (v === Tile.Spike || v === Tile.Lava) {
          // 가시는 타일 아래쪽 절반
          if (b.y + b.h > ty * TS + 6) return v;
        }
      }
    return Tile.Empty;
  }

  touchCrumble(tx: number, ty: number): void {
    const i = ty * this.w + tx;
    if (!this.crumble.has(i)) this.crumble.set(i, 34);
  }

  /** 프레임 갱신: 무너지는 바닥 타이머. 무너진 타일 목록 반환 */
  tick(): { tx: number; ty: number; ev: 'fall' | 'back' }[] {
    const ev: { tx: number; ty: number; ev: 'fall' | 'back' }[] = [];
    for (const [i, v] of this.crumble) {
      const tx = i % this.w;
      const ty = Math.floor(i / this.w);
      if (v > 0) {
        const nv = v - 1;
        if (nv === 0) {
          this.crumble.set(i, -240);
          ev.push({ tx, ty, ev: 'fall' });
          this.dirty = true;
        } else this.crumble.set(i, nv);
      } else {
        const nv = v + 1;
        if (nv >= 0) {
          this.crumble.delete(i);
          ev.push({ tx, ty, ev: 'back' });
          this.dirty = true;
        } else this.crumble.set(i, nv);
      }
    }
    return ev;
  }

  /** 부서지는 벽 타격. 부서지면 true */
  hitBreak(tx: number, ty: number): boolean {
    if (this.get(tx, ty) !== Tile.Break) return false;
    const i = ty * this.w + tx;
    const hp = (this.breakHp.get(i) ?? 3) - 1;
    if (hp <= 0) {
      this.set(tx, ty, Tile.Empty);
      this.breakHp.delete(i);
      return true;
    }
    this.breakHp.set(i, hp);
    return false;
  }

  /** 레이캐스트(시야) */
  los(x0: number, y0: number, x1: number, y1: number): boolean {
    const d = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.ceil(d / 8);
    for (let i = 1; i < n; i++) {
      const t = i / n;
      if (this.solidPx(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return false;
    }
    return true;
  }

  groundBelow(x: number, y: number, maxDist = 400): number {
    for (let yy = y; yy < y + maxDist; yy += 4) if (this.solidPx(x, yy) || this.get(Math.floor(x / TS), Math.floor(yy / TS)) === Tile.OneWay) return Math.floor(yy / TS) * TS;
    return y + maxDist;
  }

  /** 타일 렌더 캐시 (챕터 색) */
  render(g: CanvasRenderingContext2D, ch: ChapterDef, camX: number, camY: number, time: number): void {
    if (!this.cache || this.dirty) this.buildCache(ch);
    g.drawImage(this.cache!, -Math.round(camX), -Math.round(camY));
    // 무너지는 중 흔들림 표시, 용암 애니메이션
    for (const [i, v] of this.crumble) {
      if (v <= 0) continue;
      const tx = i % this.w;
      const ty = Math.floor(i / this.w);
      if ((v >> 2) % 2) {
        g.fillStyle = 'rgba(255,220,180,0.25)';
        g.fillRect(tx * TS - camX, ty * TS - camY, TS, 4);
      }
    }
    void time;
  }

  buildCache(ch: ChapterDef): void {
    const c = this.cache ?? document.createElement('canvas');
    c.width = this.pxW;
    c.height = this.pxH;
    const g = c.getContext('2d')!;
    g.clearRect(0, 0, c.width, c.height);
    const [base, hi, lo] = ch.tile;
    const rnd = (x: number, y: number): number => {
      const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
      return s - Math.floor(s);
    };
    for (let ty = 0; ty < this.h; ty++) {
      for (let tx = 0; tx < this.w; tx++) {
        const v = this.get(tx, ty);
        const x = tx * TS;
        const y = ty * TS;
        if (v === Tile.Solid || v === Tile.Break) {
          const exposedTop = !this.solid(tx, ty - 1) && ty > 0;
          const exposed = exposedTop || !this.solid(tx - 1, ty) || !this.solid(tx + 1, ty) || !this.solid(tx, ty + 1);
          g.fillStyle = exposed ? base : shade(lo, -0.2);
          g.fillRect(x, y, TS, TS);
          if (exposed) {
            // 벽돌 무늬
            g.fillStyle = lo;
            const off = ty % 2 ? 8 : 0;
            g.fillRect(x, y + 7, TS, 1);
            g.fillRect(x + ((off + 4) % 16), y, 1, 7);
            g.fillRect(x + ((off + 12) % 16), y + 8, 1, 8);
            if (rnd(tx, ty) > 0.7) {
              g.fillStyle = shade(base, 0.1);
              g.fillRect(x + 2 + Math.floor(rnd(ty, tx) * 10), y + 2 + Math.floor(rnd(tx + 1, ty) * 10), 3, 2);
            }
          }
          if (exposedTop) {
            g.fillStyle = hi;
            g.fillRect(x, y, TS, 2);
            g.fillStyle = shade(hi, 0.2);
            g.fillRect(x, y, TS, 1);
            if (ch.n === 2 && rnd(tx, ty + 9) > 0.5) {
              g.fillStyle = '#5a9a3a';
              g.fillRect(x + Math.floor(rnd(tx, ty) * 12), y - 2, 2, 3);
            }
          }
          if (v === Tile.Break) {
            g.fillStyle = 'rgba(0,0,0,0.35)';
            g.fillRect(x, y, TS, TS);
            g.strokeStyle = shade(hi, 0.3);
            g.lineWidth = 1;
            g.beginPath();
            g.moveTo(x + 3, y + 2);
            g.lineTo(x + 8, y + 7);
            g.lineTo(x + 6, y + 12);
            g.moveTo(x + 8, y + 7);
            g.lineTo(x + 13, y + 9);
            g.stroke();
          }
        } else if (v === Tile.OneWay) {
          g.fillStyle = shade(hi, -0.1);
          g.fillRect(x, y, TS, 4);
          g.fillStyle = shade(hi, 0.25);
          g.fillRect(x, y, TS, 1);
          g.fillStyle = lo;
          g.fillRect(x + 2, y + 4, 2, 3);
          g.fillRect(x + 12, y + 4, 2, 3);
        } else if (v === Tile.Crumble) {
          const i = ty * this.w + tx;
          const st = this.crumble.get(i);
          if (st === undefined || st > 0) {
            g.fillStyle = shade(base, -0.15);
            g.fillRect(x, y, TS, 8);
            g.fillStyle = hi;
            g.fillRect(x, y, TS, 1);
            g.fillStyle = lo;
            g.fillRect(x + 5, y + 1, 1, 6);
            g.fillRect(x + 11, y + 2, 1, 5);
            g.fillRect(x + 2, y + 4, 4, 1);
          }
        } else if (v === Tile.Spike) {
          g.fillStyle = '#2a2430';
          g.fillRect(x, y + 13, TS, 3);
          for (let k = 0; k < 4; k++) {
            const sx = x + k * 4;
            g.fillStyle = '#c8c8d8';
            g.beginPath();
            g.moveTo(sx, y + 14);
            g.lineTo(sx + 2, y + 5);
            g.lineTo(sx + 4, y + 14);
            g.fill();
            g.fillStyle = '#f0f0ff';
            g.fillRect(sx + 2, y + 6, 1, 3);
          }
        } else if (v === Tile.Lava) {
          g.fillStyle = '#ff5a1a';
          g.fillRect(x, y + 4, TS, TS - 4);
          g.fillStyle = '#ffb02a';
          g.fillRect(x, y + 4, TS, 2);
        }
      }
    }
    this.cache = c;
    this.dirty = false;
  }
}
