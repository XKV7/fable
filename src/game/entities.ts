import type { Element, FieldDef, ProjDef, StatusId, SummonDef } from './types';
import type { Room } from './room';
import { newBody, type Body } from './world';
import { rgba, shade } from '../gfx/pixel';
import { audio } from '../core/audio';

export type DmgKind = 'normal' | 'skill' | 'swap' | 'finisher' | 'air' | 'dash' | 'dot' | 'proc';

// ─────────────────────────── 투사체 ───────────────────────────
export class Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  hit = new Set<object>();
  pierceLeft: number;
  dead = false;
  returning = false;
  t = 0;
  constructor(
    public team: 'player' | 'enemy',
    public def: ProjDef,
    x: number,
    y: number,
    ang: number,
    public mult: number, // 플레이어: 피해 배율 / 적: 고정 피해
    public kind: DmgKind,
  ) {
    this.x = x;
    this.y = y;
    this.vx = Math.cos(ang) * def.spd;
    this.vy = Math.sin(ang) * def.spd + (def.vy ?? 0);
    this.life = def.life;
    this.pierceLeft = def.pierce ?? 0;
  }

  get w(): number {
    return this.def.w;
  }
  get h(): number {
    return this.def.h;
  }

  update(room: Room): void {
    this.t++;
    const d = this.def;
    if (d.home) {
      const tgt = this.team === 'player' ? room.nearestEnemy(this.x, this.y, 220) : room.player;
      if (tgt) {
        const tx = tgt === room.player ? room.player.cx : (tgt as { cx: number }).cx;
        const ty = tgt === room.player ? room.player.cy : (tgt as { cy: number }).cy;
        const a = Math.atan2(ty - this.y, tx - this.x);
        const sp = Math.hypot(this.vx, this.vy) || d.spd;
        const cur = Math.atan2(this.vy, this.vx);
        let diff = a - cur;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const na = cur + Math.max(-d.home, Math.min(d.home, diff));
        this.vx = Math.cos(na) * sp;
        this.vy = Math.sin(na) * sp;
      }
    }
    if (d.ret) {
      if (!this.returning && this.t > d.life * 0.4) {
        this.returning = true;
        this.hit.clear();
      }
      if (this.returning) {
        const a = Math.atan2(room.player.cy - this.y, room.player.cx - this.x);
        this.vx += Math.cos(a) * 0.6;
        this.vy += Math.sin(a) * 0.6;
        const sp = Math.hypot(this.vx, this.vy);
        if (sp > d.spd * 1.3) {
          this.vx *= (d.spd * 1.3) / sp;
          this.vy *= (d.spd * 1.3) / sp;
        }
        if (Math.hypot(room.player.cx - this.x, room.player.cy - this.y) < 12) this.dead = true;
      }
    }
    if (d.grav) this.vy += d.grav;
    this.x += this.vx;
    this.y += this.vy;
    if (d.ground) {
      const gy = room.world.groundBelow(this.x, this.y - 8, 40);
      this.y = gy - d.h / 2;
      if (room.world.solidPx(this.x + Math.sign(this.vx) * d.w * 0.5, this.y - 2)) this.die(room);
      if (this.t % 3 === 0) room.fx.dust(this.x, gy, 2);
    } else if (!d.ret && room.world.solidPx(this.x, this.y)) {
      this.die(room);
    }
    if (--this.life <= 0) this.die(room);
    // 꼬리 파티클
    if (this.t % 2 === 0 && (d.spr === 'fireball' || d.spr === 'star' || d.spr === 'soul' || d.spr === 'orb' || d.spr === 'blade' || d.spr === 'spore')) {
      room.fx.parts.push({ x: this.x, y: this.y, vx: -this.vx * 0.1, vy: -this.vy * 0.1, life: 0, max: 12, col: d.col ?? '#ffffff', size: 1, grav: 0, kind: 'px', drag: 0.9 });
    }
  }

  die(room: Room): void {
    if (this.dead) return;
    this.dead = true;
    const b = this.def.boom;
    if (b) {
      if (this.team === 'player') room.explode(this.x, this.y, b.r, this.mult * b.m, this.kind === 'normal' ? 'proc' : this.kind, b.el, b.st);
      else room.enemyExplode(this.x, this.y, b.r, this.mult * b.m, b.st);
      if (b.field) room.addField(this.team, b.field, this.x - b.field.w / 2, this.y - b.field.h / 2, this.mult, 'proc');
    } else {
      room.fx.burst(this.x, this.y, this.def.col ?? '#ffffff', 4, 1.5);
    }
  }

  render(g: CanvasRenderingContext2D, cx: number, cy: number, time: number): void {
    const d = this.def;
    const x = Math.round(this.x - cx);
    const y = Math.round(this.y - cy);
    const col = d.col ?? '#ffffff';
    const ang = Math.atan2(this.vy, this.vx);
    g.save();
    g.translate(x, y);
    switch (d.spr) {
      case 'arrow':
      case 'spear':
      case 'dagger': {
        g.rotate(ang);
        const L = d.spr === 'spear' ? 22 : d.spr === 'dagger' ? 8 : d.w;
        g.fillStyle = d.spr === 'arrow' ? '#8a6a40' : shade(col, -0.3);
        g.fillRect(-L / 2, -0.5, L, d.spr === 'spear' ? 2 : 1);
        g.fillStyle = col;
        g.fillRect(L / 2 - 4, -1.5, 4, 3);
        g.fillStyle = '#ffffff';
        g.fillRect(L / 2 - 1, -0.5, 1, 1);
        if (d.spr === 'arrow') {
          g.fillStyle = '#e0e0e0';
          g.fillRect(-L / 2, -2, 3, 1);
          g.fillRect(-L / 2, 1, 3, 1);
        }
        break;
      }
      case 'fireball':
      case 'orb':
      case 'soul':
      case 'spore': {
        const r = d.w / 2;
        g.globalCompositeOperation = 'lighter';
        const gr = g.createRadialGradient(0, 0, 0, 0, 0, r * 2);
        gr.addColorStop(0, rgba(col, 0.7));
        gr.addColorStop(1, rgba(col, 0));
        g.fillStyle = gr;
        g.fillRect(-r * 2, -r * 2, r * 4, r * 4);
        g.globalCompositeOperation = 'source-over';
        g.fillStyle = col;
        g.fillRect(-r + 1, -r + 1, r * 2 - 2, r * 2 - 2);
        g.fillStyle = '#ffffff';
        g.fillRect(-1, -1, 2, 2);
        break;
      }
      case 'star':
      case 'shard': {
        g.rotate(d.spr === 'star' ? time * 0.2 : ang);
        g.fillStyle = col;
        if (d.spr === 'star') {
          g.beginPath();
          for (let i = 0; i < 10; i++) {
            const rr = i % 2 ? 2 : 5;
            const a = (i / 10) * Math.PI * 2;
            g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
          }
          g.fill();
          g.fillStyle = '#ffffff';
          g.fillRect(-1, -1, 2, 2);
        } else {
          g.beginPath();
          g.moveTo(6, 0);
          g.lineTo(0, -2.5);
          g.lineTo(-5, 0);
          g.lineTo(0, 2.5);
          g.fill();
          g.fillStyle = '#ffffff';
          g.fillRect(0, -1, 4, 1);
        }
        break;
      }
      case 'bone':
        g.rotate(this.t * 0.4);
        g.fillStyle = col;
        g.fillRect(-5, -1, 10, 2);
        g.fillRect(-6, -2, 2, 4);
        g.fillRect(4, -2, 2, 4);
        break;
      case 'scythe':
        g.rotate(this.t * 0.5);
        g.strokeStyle = col;
        g.lineWidth = 2;
        g.beginPath();
        g.arc(0, 0, 8, 0, Math.PI * 1.2);
        g.stroke();
        g.fillStyle = '#5a3a2a';
        g.fillRect(-1, -1, 2, 2);
        break;
      case 'flask':
        g.rotate(this.t * 0.3);
        g.fillStyle = '#c0e0f0';
        g.fillRect(-1, -4, 2, 2);
        g.fillStyle = col;
        g.fillRect(-2.5, -2, 5, 5);
        g.fillStyle = '#ffffff';
        g.fillRect(-1.5, -1, 1, 1);
        break;
      case 'wave': {
        const h = d.h;
        g.globalCompositeOperation = 'lighter';
        g.fillStyle = rgba(col, 0.5);
        g.beginPath();
        g.moveTo(-6 * Math.sign(this.vx), h / 2);
        g.lineTo(0, -h / 2);
        g.lineTo(6 * Math.sign(this.vx), h / 2);
        g.fill();
        g.fillStyle = rgba('#ffffff', 0.6);
        g.fillRect(-1, -h / 2 + 4, 2, h - 4);
        break;
      }
      case 'blade':
        g.rotate(ang);
        g.globalCompositeOperation = 'lighter';
        g.fillStyle = rgba(col, 0.9);
        g.beginPath();
        g.moveTo(7, 0);
        g.lineTo(-5, -3);
        g.lineTo(-2, 0);
        g.lineTo(-5, 3);
        g.fill();
        break;
      case 'bolt':
        g.strokeStyle = col;
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(-5, -3);
        g.lineTo(0, 1);
        g.lineTo(2, -2);
        g.lineTo(6, 3);
        g.stroke();
        break;
      case 'rock':
        g.rotate(this.t * 0.15);
        g.fillStyle = '#5a3a30';
        g.fillRect(-d.w / 2, -d.h / 2, d.w, d.h);
        g.fillStyle = '#ff6a1a';
        g.fillRect(-2, -2, 4, 4);
        break;
    }
    g.restore();
  }
}

// ─────────────────────────── 장판 ───────────────────────────
export class Field {
  life: number;
  t = 0;
  dead = false;
  touched = new Set<object>();
  constructor(
    public team: 'player' | 'enemy',
    public def: FieldDef,
    public x: number,
    public y: number,
    public mult: number,
    public kind: DmgKind,
  ) {
    this.life = def.life;
  }
  get w(): number {
    return this.def.w;
  }
  get h(): number {
    return this.def.h;
  }
  update(room: Room): void {
    this.t++;
    if (this.def.follow) {
      this.x = room.player.cx - this.def.w / 2;
      this.y = room.player.cy - this.def.h / 2;
    }
    if (--this.life <= 0) this.dead = true;
    const rect = { x: this.x, y: this.y, w: this.def.w, h: this.def.h };
    if (this.team === 'player') {
      for (const e of room.allEnemies()) {
        if (e.dead || !room.overlapsEnemy(e, rect)) continue;
        if (this.def.oneShot) {
          room.explode(this.x + this.def.w / 2, this.y + this.def.h / 2, 34, this.mult * this.def.m, 'skill', this.def.el, this.def.st);
          room.fx.ring(this.x + this.def.w / 2, this.y + this.def.h / 2, '#ff6040', 40);
          this.dead = true;
          return;
        }
        if (this.def.pull && !e.isBoss) {
          const c = this.x + this.def.w / 2;
          e.b.vx += Math.sign(c - e.cx) * this.def.pull * 0.4 * (1 - e.kbRes);
        }
        if (this.def.slow) e.applyStatus('slow', 1, room);
      }
      if (this.def.oneShot) return;
      if (this.t % this.def.tick === 0) {
        for (const e of room.allEnemies()) {
          if (e.dead || !room.overlapsEnemy(e, rect)) continue;
          room.damageEnemy(e, { m: this.mult * this.def.m, kind: this.kind === 'normal' ? 'proc' : this.kind, el: this.def.el, st: this.def.st, kb: 0, up: 0, hs: 0, dir: 0, proc: true });
        }
      }
    } else {
      if (this.def.pull && room.player.overlaps({ x: rect.x - 40, y: rect.y, w: rect.w + 80, h: rect.h })) {
        room.player.b.vx += Math.sign(this.x + this.def.w / 2 - room.player.cx) * this.def.pull * 0.35;
      }
      if (this.t % this.def.tick === 0 && room.player.overlaps(rect)) {
        room.damagePlayer(this.mult, this.x + this.def.w / 2, '장판', { st: this.def.st, kb: 0.5 });
      }
    }
  }
  render(g: CanvasRenderingContext2D, cx: number, cy: number, time: number): void {
    const d = this.def;
    const x = Math.round(this.x - cx);
    const y = Math.round(this.y - cy);
    const fade = Math.min(1, this.life / 20, this.t / 8);
    const cols: Record<string, string> = { fire: '#ff6a1a', poison: '#8bdc3a', ice: '#a8e4ff', thunder: '#80d8ff', void: '#7a4aff', holy: '#ffe080', time: '#a8c8ff', blood: '#d8203a', trap: '#c0a060', star: '#ffe680' };
    const col = cols[d.vis] ?? '#ffffff';
    g.save();
    g.globalAlpha = fade;
    if (d.vis === 'trap') {
      g.fillStyle = '#5a4a3a';
      g.fillRect(x + 2, y + d.h - 3, d.w - 4, 3);
      g.fillStyle = (time >> 4) % 2 ? '#ff4040' : '#c0a060';
      for (let i = 0; i < 4; i++) g.fillRect(x + 3 + i * 4, y + d.h - 6, 2, 3);
      g.restore();
      return;
    }
    g.globalCompositeOperation = 'lighter';
    const gr = g.createLinearGradient(0, y, 0, y + d.h);
    gr.addColorStop(0, rgba(col, 0));
    gr.addColorStop(1, rgba(col, d.vis === 'time' || d.vis === 'void' ? 0.22 : 0.3));
    g.fillStyle = gr;
    g.fillRect(x, y, d.w, d.h);
    if (d.vis === 'time') {
      g.strokeStyle = rgba(col, 0.6);
      g.lineWidth = 1;
      g.beginPath();
      g.arc(x + d.w / 2, y + d.h / 2, Math.min(d.w, d.h) / 2 - 2, 0, Math.PI * 2);
      g.stroke();
      const a = time * 0.05;
      g.beginPath();
      g.moveTo(x + d.w / 2, y + d.h / 2);
      g.lineTo(x + d.w / 2 + Math.cos(a) * d.h * 0.4, y + d.h / 2 + Math.sin(a) * d.h * 0.4);
      g.stroke();
    }
    const n = Math.max(3, Math.floor(d.w / 6));
    for (let i = 0; i < n; i++) {
      const px = x + ((i * 37 + time * (d.vis === 'fire' ? 0.7 : 0.3)) % d.w);
      const ph = (time * 0.15 + i) % 1;
      const py = y + d.h - ((time * 0.6 + i * 13) % d.h);
      g.fillStyle = rgba(i % 2 ? col : shade(col, 0.4), 0.7 * (1 - ph * 0.5));
      g.fillRect(Math.round(px), Math.round(py), 2, d.vis === 'fire' ? 3 : 2);
    }
    g.fillStyle = rgba(col, 0.5);
    g.fillRect(x, y + d.h - 2, d.w, 2);
    g.restore();
  }
}

// ─────────────────────────── 소환수 ───────────────────────────
export class Summon {
  b: Body;
  life: number;
  t = 0;
  dead = false;
  facing = 1;
  atkCd = 30;
  angle: number;
  constructor(
    public def: SummonDef,
    x: number,
    y: number,
    public mult: number,
    idx: number,
  ) {
    this.b = newBody(x - 5, y - 18, 10, 18);
    this.life = def.life;
    this.angle = idx * 2.1;
  }
  get cx(): number {
    return this.b.x + this.b.w / 2;
  }
  get cy(): number {
    return this.b.y + this.b.h / 2;
  }
  update(room: Room): void {
    this.t++;
    if (--this.life <= 0) {
      this.dead = true;
      room.fx.burst(this.cx, this.cy, this.def.kind === 'skeleton' ? '#e8e0c8' : this.def.kind === 'puppet' ? '#ff80c0' : this.def.kind === 'turret' ? '#80e0ff' : '#ffe680', 8, 1.5);
      return;
    }
    if (this.atkCd > 0) this.atkCd--;
    const tgt = room.nearestEnemy(this.cx, this.cy, 260);
    if (this.def.kind === 'turret') {
      this.b.vy = Math.min(6, this.b.vy + 0.28);
      room.world.move(this.b);
      if (tgt) {
        this.facing = Math.sign(tgt.cx - this.cx) || 1;
        if (this.atkCd <= 0) {
          this.atkCd = 40;
          const a = Math.atan2(tgt.cy - (this.cy - 4), tgt.cx - this.cx);
          room.addProj('player', { spr: 'bolt', spd: 6, life: 60, w: 8, h: 6, col: '#80e0ff', el: 'thunder', st: 'shock' }, this.cx, this.cy - 4, a, this.mult, 'proc');
          audio.play('proj', 1.4);
        }
      }
      return;
    }
    if (this.def.kind === 'skeleton' || this.def.kind === 'puppet') {
      this.b.vy = Math.min(6, this.b.vy + 0.28);
      if (tgt) {
        const dx = tgt.cx - this.cx;
        this.facing = Math.sign(dx) || 1;
        if (Math.abs(dx) > 18) this.b.vx = this.facing * 1.4;
        else {
          this.b.vx = 0;
          if (this.atkCd <= 0) {
            this.atkCd = 45;
            const pup = this.def.kind === 'puppet';
            room.hitEnemiesBox({ x: this.cx + (this.facing > 0 ? 0 : -24), y: this.cy - 12, w: 24, h: 22 }, { m: this.mult, kind: 'proc', kb: 1.5, up: 0, hs: 1, dir: this.facing, el: 'shadow', st: pup ? 'bleed' : undefined, proc: true });
            room.fx.slash(this.cx, this.cy, this.facing, { arc: pup ? 'x' : 'h', r: 12 }, pup ? '#ff80c0' : '#b0ff90');
            audio.play('swing', 1.3);
          }
        }
      } else {
        const dx = room.player.cx - 20 * room.player.facing - this.cx;
        this.b.vx = Math.abs(dx) > 10 ? Math.sign(dx) * 1.5 : 0;
        if (this.b.vx) this.facing = Math.sign(this.b.vx);
      }
      room.world.move(this.b);
    } else {
      // 공전하는 별 위성
      this.angle += 0.05;
      const r = 26;
      this.b.x = room.player.cx + Math.cos(this.angle) * r - this.b.w / 2;
      this.b.y = room.player.cy - 8 + Math.sin(this.angle) * r * 0.5 - this.b.h / 2;
      if (tgt && this.atkCd <= 0) {
        this.atkCd = 50;
        const a = Math.atan2(tgt.cy - this.cy, tgt.cx - this.cx);
        room.addProj('player', { spr: 'star', spd: 5, life: 60, w: 8, h: 8, col: '#ffe680', home: 0.1, el: 'holy' }, this.cx, this.cy, a, this.mult, 'proc');
      }
    }
  }
  render(g: CanvasRenderingContext2D, cx: number, cy: number, time: number, skelFrame: (pose: number, kind: string) => HTMLCanvasElement): void {
    if (this.def.kind === 'turret') {
      const x = Math.round(this.cx - cx);
      const y = Math.round(this.b.y + this.b.h - cy);
      // 삼각대 + 포신 + 전기 코어
      g.fillStyle = '#3a4048';
      g.fillRect(x - 8, y - 2, 4, 2);
      g.fillRect(x + 4, y - 2, 4, 2);
      g.fillRect(x - 6, y - 5, 2, 3);
      g.fillRect(x + 4, y - 5, 2, 3);
      g.fillStyle = '#4a5058';
      g.fillRect(x - 5, y - 7, 10, 3);
      g.fillStyle = '#7a8088';
      g.fillRect(x - 5, y - 15, 10, 8);
      g.fillStyle = '#ffb040';
      g.fillRect(x - 5, y - 9, 10, 1);
      g.fillStyle = (time >> 3) % 2 ? '#80e0ff' : '#c0f4ff';
      g.fillRect(x - 2, y - 13, 4, 3);
      g.fillStyle = '#5a6068';
      g.fillRect(this.facing > 0 ? x + 5 : x - 11, y - 13, 6, 3);
      if (this.life < 60 && (time >> 2) % 2) {
        g.fillStyle = 'rgba(255,255,255,0.4)';
        g.fillRect(x - 5, y - 15, 10, 15);
      }
      return;
    }
    if (this.def.kind === 'skeleton' || this.def.kind === 'puppet') {
      const img = skelFrame(Math.abs(this.b.vx) > 0.1 ? Math.floor(time / 5) % 6 : -1, this.def.kind);
      const x = Math.round(this.cx - 24 - cx);
      const y = Math.round(this.b.y + this.b.h - 44 - cy);
      g.save();
      g.globalAlpha = this.life < 60 ? 0.5 + 0.5 * Math.sin(time * 0.5) : 0.9;
      if (this.facing < 0) {
        g.translate(x + 24, 0);
        g.scale(-1, 1);
        g.drawImage(img, -24, y);
      } else g.drawImage(img, x, y);
      g.restore();
    } else {
      const x = this.cx - cx;
      const y = this.cy - cy;
      g.save();
      g.globalCompositeOperation = 'lighter';
      const gr = g.createRadialGradient(x, y, 0, x, y, 8);
      gr.addColorStop(0, 'rgba(255,240,160,0.9)');
      gr.addColorStop(1, 'rgba(255,240,160,0)');
      g.fillStyle = gr;
      g.fillRect(x - 8, y - 8, 16, 16);
      g.fillStyle = '#ffffff';
      g.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3);
      g.restore();
    }
  }
}

// ─────────────────────────── 픽업 ───────────────────────────
export type PickupKind = 'gold' | 'stone' | 'crystal' | 'heal' | 'relicOrb';

export class Pickup {
  b: Body;
  t = 0;
  dead = false;
  constructor(
    public kind: PickupKind,
    x: number,
    y: number,
    public value: number,
  ) {
    const s = kind === 'relicOrb' ? 12 : 5;
    this.b = newBody(x - s / 2, y - s / 2, s, s);
    this.b.vx = (Math.random() - 0.5) * 3;
    this.b.vy = -2 - Math.random() * 2.5;
  }
  get cx(): number {
    return this.b.x + this.b.w / 2;
  }
  get cy(): number {
    return this.b.y + this.b.h / 2;
  }
  update(room: Room): void {
    this.t++;
    const p = room.player;
    const dx = p.cx - this.cx;
    const dy = p.cy - this.cy;
    const d = Math.hypot(dx, dy);
    if (this.kind !== 'relicOrb' && this.t > 35 && room.cleared !== false) {
      const s = Math.min(7, 1 + (this.t - 35) * 0.15);
      this.b.x += (dx / (d || 1)) * s;
      this.b.y += (dy / (d || 1)) * s;
    } else if (this.kind === 'relicOrb') {
      this.b.vy = Math.sin(this.t * 0.08) * 0.3;
      this.b.vx = 0;
      if (this.t < 20) this.b.y -= 0.5;
    } else {
      this.b.vy = Math.min(5, this.b.vy + 0.22);
      this.b.vx *= 0.97;
      room.world.move(this.b, false);
      if (this.b.onGround) this.b.vx *= 0.8;
    }
    if (d < (this.kind === 'relicOrb' ? 16 : 10) && this.t > 12) room.collect(this);
  }
  render(g: CanvasRenderingContext2D, cx: number, cy: number, time: number): void {
    const x = Math.round(this.cx - cx);
    const y = Math.round(this.cy - cy);
    switch (this.kind) {
      case 'gold': {
        const w = Math.abs(Math.cos(time * 0.15 + this.b.x)) * 3 + 1;
        g.fillStyle = '#a07010';
        g.fillRect(x - w / 2, y - 2, w, 5);
        g.fillStyle = '#ffd040';
        g.fillRect(x - w / 2, y - 3, w, 4);
        break;
      }
      case 'stone':
        g.fillStyle = '#3a6aff';
        g.fillRect(x - 2, y - 3, 5, 6);
        g.fillStyle = '#9ec0ff';
        g.fillRect(x - 1, y - 2, 2, 2);
        break;
      case 'crystal':
        g.fillStyle = '#40d0e0';
        g.fillRect(x - 1, y - 3, 3, 6);
        g.fillStyle = '#e0ffff';
        g.fillRect(x, y - 2, 1, 2);
        break;
      case 'heal':
        g.fillStyle = '#ff4a6a';
        g.fillRect(x - 3, y - 1, 7, 3);
        g.fillRect(x - 1, y - 3, 3, 7);
        break;
      case 'relicOrb': {
        g.save();
        g.globalCompositeOperation = 'lighter';
        const r = 14 + Math.sin(time * 0.1) * 2;
        const gr = g.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, 'rgba(255,220,120,0.9)');
        gr.addColorStop(1, 'rgba(255,160,40,0)');
        g.fillStyle = gr;
        g.fillRect(x - r, y - r, r * 2, r * 2);
        g.restore();
        g.fillStyle = '#ffe080';
        g.fillRect(x - 3, y - 3, 7, 7);
        g.fillStyle = '#ffffff';
        g.fillRect(x - 1, y - 1, 3, 3);
        break;
      }
    }
  }
}

// ─────────────────────────── 시설/문 ───────────────────────────
export type PropKind = 'door' | 'chest' | 'shop' | 'altar' | 'armory' | 'rest' | 'event' | 'sign' | 'hub';

export interface Prop {
  kind: PropKind;
  x: number; // 중심 x
  y: number; // 바닥 y
  w: number;
  h: number;
  used: boolean;
  nodeId?: number; // 문: 다음 노드 (-1: 다음 장, -2: 런 클리어)
  nextCh?: number; // -1일 때 이동할 챕터 테마
  open?: boolean;
  hidden?: boolean;
  text?: string;
  hub?: string;
  label?: string;
}

export type { Element, StatusId };
