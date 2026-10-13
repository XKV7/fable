import { BOSS_MAP, type BossDef } from '../data/bosses';
import type { EnemyDef } from '../data/enemies';
import { audio } from '../core/audio';
import { ENEMY_LOOKS, ignisFrame, lookFrame, mycoraFrame, white, tinted, charFrame } from '../gfx/sprites';
import { CHAR_MAP } from '../data/characters';
import type { PoseName } from './types';
import { Enemy } from './enemy';
import type { Room } from './room';


interface PactShadow {
  id: string;
  x: number;
  y: number;
  dir: number;
  t: number;
  done: boolean;
  hit: boolean;
}

/** 보스: 페이즈별 패턴 풀에서 무작위로 고르며, 각 패턴은 프레임 타임라인으로 구현 */
export class Boss extends Enemy {
  bd: BossDef;
  phase = 0;
  pattern = '';
  pt = 0;
  last = '';
  idleT = 90;
  intro = 100;
  phaseT = 0;
  pose: PoseName = 'idle0';
  anim = 'idle';
  shadows: PactShadow[] = [];
  combo = 0;
  deathT = 0;
  vulnT = 0;

  constructor(id: string, x: number, y: number, curse: number) {
    const bd = BOSS_MAP[id];
    const fake: EnemyDef = { id, name: bd.name, chapter: bd.chapter, ai: 'dummy', hp: bd.hp, atk: bd.atk, speed: 1, w: bd.w, h: bd.h, range: 0, windup: 0, cd: 0, kbRes: 1, gold: 0, col: bd.col, eliteSkill: 'enrage', weight: 0 };
    super(fake, x, y, false, 1, 0, 0);
    this.bd = bd;
    this.isBoss = true;
    this.maxHp = this.hp = Math.round(bd.hp * (1 + curse));
    this.atk = Math.round(bd.atk * (1 + curse * 0.8));
    this.state = 'idle';
    this.st = 0;
    this.name = bd.name;
    this.b.w = bd.w * 0.6;
    this.b.h = bd.h;
    this.b.x = x - this.b.w / 2;
    this.b.y = y - this.b.h;
    this.facing = -1;
  }

  get invulnerable(): boolean {
    return this.intro > 0 || this.phaseT > 0 || this.deathT > 0;
  }

  override step(room: Room): void {
    // 상태이상은 짧게
    super.step(room);
  }

  override ai(room: Room): void {
    if (this.intro > 0) {
      this.intro--;
      this.anim = 'idle';
      this.pose = 'idle0';
      if (this.intro === 60) {
        audio.play('boss_roar');
        room.cam.shake(5, 40);
      }
      return;
    }
    if (this.phaseT > 0) {
      this.phaseT--;
      this.anim = 'wind';
      this.pose = 'castUp';
      if (this.phaseT % 10 === 0) room.fx.ring(this.cx, this.cy, this.bd.col, 60);
      if (this.phaseT === 0) {
        this.idleT = 30;
        this.pattern = '';
      }
      return;
    }
    // 페이즈 전환 판정
    const next = this.bd.phases[this.phase];
    if (next !== undefined && this.hp / this.maxHp <= next) {
      this.phase++;
      this.phaseT = 110;
      this.pattern = '';
      this.b.vx = 0;
      audio.play('phase');
      room.cam.shake(7, 50);
      room.flash('#ffffff', 0.7);
      room.bossPhaseBanner(this.phase);
      if (this.bd.id === 'king' && this.phase === 2) room.darkBoost = 0.25;
      return;
    }
    if (!this.pattern) {
      this.anim = 'idle';
      this.pose = 'idle0';
      this.face(room);
      const dx = room.player.cx - this.cx;
      if (this.bd.id === 'graven' || this.bd.id === 'king' || this.bd.id === 'ignis') {
        if (Math.abs(dx) > 50 && this.b.onGround) {
          this.b.vx = Math.sign(dx) * (this.bd.id === 'ignis' ? 0.5 : 0.9);
          this.anim = 'move';
        } else this.b.vx = 0;
      }
      if (--this.idleT <= 0) {
        const pool = this.bd.patterns[this.phase].filter((p) => p !== this.last);
        this.pattern = pool[Math.floor(Math.random() * pool.length)];
        this.last = this.pattern;
        this.pt = 0;
        this.combo = 0;
      }
      return;
    }
    this.pt++;
    const done = this.runPattern(room, this.pattern, this.pt);
    if (done) {
      this.pattern = '';
      this.idleT = [55, 40, 30][this.phase] ?? 30;
      this.anim = 'idle';
      this.b.vx = 0;
    }
  }

  private wind(t: number, until: number): boolean {
    if (t < until) {
      this.anim = 'wind';
      this.state = 'wind';
      return true;
    }
    this.state = 'atk';
    return false;
  }

  private ground(room: Room): number {
    return room.world.groundBelow(this.cx, this.b.y + this.b.h - 4);
  }

  private wave(room: Room, dirs: number[], col: string, spd = 3.4, h = 20, st?: 'burn' | 'poison'): void {
    for (const dir of dirs) room.addProj('enemy', { spr: 'wave', spd, life: 120, w: 12, h, col, ground: true, pierce: 99, st }, this.cx + dir * 10, this.b.y + this.b.h - h / 2, dir > 0 ? 0 : Math.PI, Math.round(this.atk * 0.8), 'normal');
  }

  private skyDrop(room: Room, x: number, delay: number, spr: 'bone' | 'blade' | 'fireball', col: string, dmgMul = 0.7, st?: 'burn'): void {
    const gy = room.world.groundBelow(x, 40);
    room.marker(x - 6, gy - 4, 12, 4, delay, '#ff3030');
    room.later(delay - 22, () => {
      room.addProj('enemy', { spr, spd: 6, life: 80, w: 8, h: 12, col, st }, x, 24, Math.PI / 2, Math.round(this.atk * dmgMul), 'normal');
    });
  }

  private pillar(room: Room, x: number, delay: number, vis: 'fire' | 'holy' | 'void' | 'poison', w = 22, h = 110, st?: 'burn' | 'poison'): void {
    const gy = room.world.groundBelow(x, 60);
    room.marker(x - w / 2, gy - h, w, h, delay, '#ff3030', true);
    room.later(delay, () => {
      room.addField('enemy', { vis, w, h, life: 34, tick: 12, m: 1, st }, x - w / 2, gy - h, Math.round(this.atk * 0.9), 'normal');
      room.fx.burst(x, gy - 4, vis === 'fire' ? '#ff8a2a' : vis === 'holy' ? '#ffe080' : vis === 'poison' ? '#8bdc3a' : '#9a6bff', 14, 3);
      audio.play(vis === 'fire' ? 'burn' : 'cast', 0.7);
    });
  }

  /** 패턴 실행. true 반환 시 종료 */
  private runPattern(room: Room, name: string, t: number): boolean {
    const p = room.player;
    const p2 = this.phase >= 1;
    switch (name) {
      // ─────────── 그라벤 ───────────
      case 'shovelSlam': {
        if (t < 40 && Math.abs(p.cx - this.cx) > 50) {
          this.face(room);
          this.b.vx = this.facing * 1.6;
          this.anim = 'move';
          return false;
        }
        if (t < 40) this.pt = 40;
        if (this.wind(t, 70)) {
          this.b.vx = 0;
          this.pose = 'windHigh';
          if (t === 41) audio.play('warn');
          return false;
        }
        if (t === 70) {
          this.pose = 'slam';
          this.anim = 'atk';
          room.enemyHit({ x: this.facing > 0 ? this.cx : this.cx - 70, y: this.b.y, w: 70, h: this.b.h }, this.atk * 1.3, this.cx, this.name);
          this.wave(room, [-1, 1], '#80e0ff');
          room.cam.shake(6);
          audio.play('hit_power', 0.6);
          room.fx.dust(this.cx + this.facing * 30, this.b.y + this.b.h, 14);
        }
        if (p2 && t === 90) this.wave(room, [-1, 1], '#80e0ff', 4.5);
        return t > 110;
      }
      case 'charge': {
        if (this.wind(t, 34)) {
          this.face(room);
          this.pose = 'dash';
          this.b.vx = -this.facing * 0.4;
          if (t === 1) audio.play('warn');
          return false;
        }
        this.pose = 'dash';
        this.anim = 'atk';
        this.b.vx = this.facing * (p2 ? 6.5 : 5.5);
        this.contact(room, this.atk);
        if (t % 3 === 0) room.fx.dust(this.cx, this.b.y + this.b.h, 2);
        if (this.b.hitWall || t > 130) {
          room.cam.shake(6);
          audio.play('crumble');
          for (let i = 0; i < (p2 ? 6 : 3); i++) this.skyDrop(room, 40 + Math.random() * (room.world.pxW - 80), 40 + i * 6, 'bone', '#e8e0c8');
          this.b.vx = -this.facing * 2;
          return true;
        }
        return false;
      }
      case 'boneRain': {
        this.pose = 'castUp';
        this.anim = 'wind';
        if (t === 1) audio.play('cast', 0.6);
        const n = p2 ? 12 : 8;
        if (t <= n * 6 && t % 6 === 0) this.skyDrop(room, p.cx + (Math.random() - 0.5) * 200, 46, 'bone', '#e8e0c8');
        return t > n * 6 + 50;
      }
      case 'lanternFire': {
        this.pose = 'cast';
        this.anim = 'wind';
        const n = p2 ? 4 : 3;
        if (t % 30 === 1 && t < n * 30) this.pillar(room, p.cx, 40, 'void', 24, 100);
        return t > n * 30 + 50;
      }
      case 'summonSkel': {
        this.pose = 'castUp';
        this.anim = 'wind';
        if (t === 20) {
          room.spawnMinions(this, 2, 'skeleton');
          audio.play('crumble');
        }
        return t > 50;
      }
      case 'leapSmash': {
        if (t === 1) {
          this.face(room);
          this.pose = 'crouch';
          audio.play('warn');
        }
        if (t < 24) {
          this.anim = 'wind';
          this.state = 'wind';
          return false;
        }
        if (t === 24) {
          this.b.vy = -8;
          this.b.vx = (p.cx - this.cx) / 52;
          this.pose = 'jump';
          audio.play('jump', 0.4);
        }
        if (t > 30 && this.b.onGround) {
          this.b.vx = 0;
          this.pose = 'slam';
          room.enemyExplode(this.cx, this.b.y + this.b.h - 10, 60, this.atk * 1.2);
          this.wave(room, [-1, 1], '#80e0ff', 4);
          room.cam.shake(8);
          room.fx.dust(this.cx, this.b.y + this.b.h, 20);
          return true;
        }
        return t > 140;
      }
      case 'ghostFlames': {
        this.pose = 'cast';
        this.anim = 'wind';
        if (t === 20 || t === 40) {
          for (let i = 0; i < 3; i++) room.addProj('enemy', { spr: 'soul', spd: 1.8, life: 200, w: 8, h: 8, col: '#80e0ff', home: 0.035 }, this.cx, this.b.y + 10, -Math.PI / 2 + (i - 1) * 0.8, Math.round(this.atk * 0.7), 'normal');
          audio.play('cast', 0.7);
        }
        return t > 70;
      }
      // ─────────── 미코라 ───────────
      case 'sporeCloud': {
        this.anim = 'wind';
        if (t === 1) audio.play('poison');
        if (t === 30) {
          for (let i = 0; i < (p2 ? 4 : 3); i++) {
            const x = p.cx + (i - 1) * 60 + (Math.random() - 0.5) * 20;
            const gy = room.world.groundBelow(x, p.b.y - 20);
            room.marker(x - 25, gy - 30, 50, 30, 30, '#8bdc3a', true);
            room.later(30, () => room.addField('enemy', { vis: 'poison', w: 50, h: 30, life: 220, tick: 30, m: 1, st: 'poison' }, x - 25, gy - 30, Math.round(this.atk * 0.45), 'normal'));
          }
        }
        return t > 80;
      }
      case 'bounceChain':
      case 'bodySlam': {
        const reps = name === 'bounceChain' ? 3 : 1;
        const cycle = 90;
        const lt = (t - 1) % cycle;
        const k = Math.floor((t - 1) / cycle);
        if (k >= reps) return true;
        if (lt === 0) audio.play('warn');
        if (lt < 26) {
          this.anim = 'wind';
          this.state = 'wind';
          return false;
        }
        if (lt === 26) {
          this.b.vy = -7.5;
          this.b.vx = (p.cx - this.cx) / 48;
          this.anim = 'atk';
          this.state = 'atk';
        }
        if (lt > 30 && this.b.onGround && this.b.vx !== 0) {
          this.b.vx = 0;
          room.enemyExplode(this.cx, this.b.y + this.b.h - 8, 64, this.atk * 1.1, 'poison');
          this.wave(room, [-1, 1], '#8bdc3a', 3.6, 16, 'poison');
          room.cam.shake(7);
          room.fx.dust(this.cx, this.b.y + this.b.h, 20);
          audio.play('hit_power', 0.5);
        }
        if (lt > 30 && !this.b.onGround) this.contact(room, this.atk);
        return false;
      }
      case 'spitVolley': {
        this.anim = 'wind';
        if (t === 1) audio.play('warn');
        if (t === 30) {
          this.anim = 'atk';
          const n = p2 ? 8 : 5;
          for (let i = 0; i < n; i++) {
            const tx = p.cx + (i - (n - 1) / 2) * 34;
            const T = 50;
            const gg = 0.12;
            const vx = (tx - this.cx) / T;
            const vy = (p.cy - this.b.y - 0.5 * gg * T * T) / T;
            room.addProj('enemy', { spr: 'spore', spd: Math.hypot(vx, vy), life: 120, w: 9, h: 9, col: '#c0f060', grav: gg, st: 'poison', boom: { r: 18, m: 1, st: 'poison' } }, this.cx, this.b.y + 10, Math.atan2(vy, vx), Math.round(this.atk * 0.7), 'normal');
          }
          audio.play('poison');
        }
        return t > 70;
      }
      case 'rootSpikes': {
        this.anim = 'wind';
        const n = p2 ? 5 : 3;
        if (t % 24 === 1 && t < n * 24) {
          const x = p.cx;
          const gy = room.world.groundBelow(x, p.b.y);
          room.marker(x - 10, gy - 4, 20, 4, 34, '#ff3030');
          room.later(34, () => {
            room.enemyHit({ x: x - 10, y: gy - 50, w: 20, h: 50 }, this.atk, x, this.name);
            room.spike(x, gy, '#6ab03a');
            audio.play('spike');
          });
        }
        return t > n * 24 + 40;
      }
      case 'birthSlimes': {
        this.anim = 'wind';
        if (t === 24) room.spawnMinions(this, p2 ? 3 : 2, 'slime');
        return t > 50;
      }
      case 'toxicFlood': {
        this.anim = 'wind';
        if (t === 1) {
          room.bossShout('독이 차오른다! 높은 곳으로!', '#8bdc3a');
          audio.play('warn');
          const gy = room.world.groundBelow(this.cx, this.b.y + this.b.h - 4);
          room.marker(16, gy - 18, room.world.pxW - 32, 18, 70, '#8bdc3a', true);
        }
        if (t === 70) {
          const gy = room.world.groundBelow(this.cx, this.b.y + this.b.h - 4);
          room.addField('enemy', { vis: 'poison', w: room.world.pxW - 32, h: 18, life: 200, tick: 24, m: 1, st: 'poison' }, 16, gy - 18, Math.round(this.atk * 0.6), 'normal');
          audio.play('poison');
        }
        return t > 120;
      }
      // ─────────── 이그니스 ───────────
      case 'doubleQuake':
      case 'hammerQuake': {
        const reps = name === 'doubleQuake' ? 2 : 1;
        const cycle = 80;
        const lt = (t - 1) % cycle;
        if (Math.floor((t - 1) / cycle) >= reps) return true;
        if (lt === 0) {
          this.face(room);
          audio.play('warn');
        }
        if (lt < 44) {
          this.anim = 'wind';
          this.state = 'wind';
          return false;
        }
        if (lt === 44) {
          this.anim = 'atk';
          room.enemyHit({ x: this.facing > 0 ? this.cx : this.cx - 80, y: this.b.y + 20, w: 80, h: this.b.h - 20 }, this.atk * 1.3, this.cx, this.name);
          this.wave(room, [-1, 1], '#ff6a1a', 3.8, 22, 'burn');
          room.cam.shake(8);
          audio.play('explode', 0.6);
          room.fx.dust(this.cx + this.facing * 40, this.b.y + this.b.h, 20);
        }
        return false;
      }
      case 'flameBreath': {
        if (t === 1) {
          this.face(room);
          audio.play('warn');
        }
        if (this.wind(t, 34)) return false;
        this.anim = 'atk';
        if (t % 4 === 0 && t < 100) {
          const base = Math.atan2(p.cy - (this.b.y + 30), p.cx - this.cx);
          const sweep = Math.sin((t - 34) * 0.06) * 0.4;
          room.addProj('enemy', { spr: 'fireball', spd: 3.6, life: 90, w: 10, h: 10, col: '#ff7a2a', st: 'burn' }, this.cx + this.facing * 16, this.b.y + 30, base + sweep, Math.round(this.atk * 0.5), 'normal');
          if (t % 12 === 0) audio.play('burn');
        }
        return t > 110;
      }
      case 'lavaPillars': {
        this.anim = 'wind';
        if (t === 1) {
          audio.play('warn');
          const n = p2 ? 7 : 5;
          const xs: number[] = [p.cx];
          for (let i = 1; i < n; i++) xs.push(40 + Math.random() * (room.world.pxW - 80));
          xs.forEach((x, i) => this.pillar(room, x, 50 + i * 4, 'fire', 24, 130, 'burn'));
        }
        return t > 100;
      }
      case 'boulderRoll': {
        this.anim = t < 30 ? 'wind' : 'atk';
        if (t === 1) {
          this.face(room);
          audio.play('warn');
        }
        if (t === 30 || (p2 && t === 60)) {
          room.addProj('enemy', { spr: 'rock', spd: 3.6, life: 200, w: 16, h: 16, col: '#5a3a30', ground: true, pierce: 99, st: 'burn' }, this.cx + this.facing * 30, this.b.y + this.b.h - 8, this.facing > 0 ? 0 : Math.PI, this.atk, 'normal');
          audio.play('crumble');
        }
        return t > 80;
      }
      case 'moltenRain': {
        this.anim = 'wind';
        const n = p2 ? 18 : 12;
        if (t <= n * 5 && t % 5 === 0) this.skyDrop(room, 30 + Math.random() * (room.world.pxW - 60), 44, 'fireball', '#ff7a2a', 0.7, 'burn');
        return t > n * 5 + 50;
      }
      case 'coreLaser': {
        if (t === 1) {
          this.face(room);
          audio.play('warn');
          room.bossShout('용광로의 핵이 달아오른다!', '#ffb02a');
        }
        const gy = this.ground(room);
        const y = gy - 16;
        const x0 = this.facing > 0 ? this.cx : 16;
        const w = this.facing > 0 ? room.world.pxW - 16 - this.cx : this.cx - 16;
        if (t === 2) room.marker(x0, y, w, 12, 54, '#ffb02a', true);
        if (t < 56) {
          this.anim = 'wind';
          return false;
        }
        this.anim = 'atk';
        if (t === 56) {
          room.addField('enemy', { vis: 'fire', w, h: 12, life: 40, tick: 8, m: 1, st: 'burn' }, x0, y, Math.round(this.atk * 0.8), 'normal');
          room.cam.shake(5, 40);
          audio.play('explode', 1.4);
          room.flash('#ffb02a', 0.3);
        }
        return t > 100;
      }
      // ─────────── 끝없는 왕 ───────────
      case 'swordCombo': {
        const n = this.phase >= 2 ? 4 : 3;
        const cycle = 34;
        const k = Math.floor((t - 1) / cycle);
        const lt = (t - 1) % cycle;
        if (k >= n) return true;
        if (lt === 0) {
          this.face(room);
          audio.play('warn');
        }
        if (lt < 18) {
          this.anim = 'wind';
          this.state = 'wind';
          this.pose = k % 2 ? 'windLow' : 'windHigh';
          this.b.vx = 0;
          return false;
        }
        if (lt === 18) {
          this.state = 'atk';
          this.anim = 'atk';
          this.pose = k % 2 ? 'slashUp' : 'slashDown';
          this.b.vx = this.facing * 4;
          room.enemyHit({ x: this.facing > 0 ? this.cx : this.cx - 64, y: this.b.y - 4, w: 64, h: this.b.h + 4 }, this.atk, this.cx, this.name);
          room.fx.slash(this.cx, this.cy, this.facing, { arc: k % 2 ? 'up' : 'down', r: 40 }, '#c8a8ff');
          audio.play('swing_heavy', 0.8);
          if (k === n - 1) this.wave(room, [this.facing], '#c8a8ff', 4.5, 26);
        }
        if (lt > 18) this.b.vx *= 0.85;
        return false;
      }
      case 'shadowBlades': {
        this.pose = 'castUp';
        this.anim = 'wind';
        const n = this.phase >= 1 ? 8 : 5;
        if (t === 1) {
          audio.play('cast', 0.6);
          for (let i = 0; i < n; i++) {
            const bx = this.cx + (i - (n - 1) / 2) * 26;
            const by = this.b.y - 30 - Math.abs(i - (n - 1) / 2) * 6;
            room.marker(bx - 3, by - 3, 6, 6, 40 + i * 5, '#c8a8ff');
            room.later(40 + i * 5, () => {
              const a = Math.atan2(room.player.cy - by, room.player.cx - bx);
              room.addProj('enemy', { spr: 'blade', spd: 5, life: 90, w: 10, h: 6, col: '#c8a8ff' }, bx, by, a, Math.round(this.atk * 0.7), 'normal');
              audio.play('proj', 0.6);
            });
          }
        }
        return t > 40 + n * 5 + 20;
      }
      case 'crownBeam': {
        this.pose = 'castUp';
        this.anim = 'wind';
        if (t === 1) {
          audio.play('warn');
          const n = this.phase >= 2 ? 5 : 3;
          for (let i = 0; i < n; i++) this.pillar(room, i === 0 ? p.cx : p.cx + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 70, 45 + i * 6, 'holy', 26, 240);
        }
        return t > 100;
      }
      case 'teleSlam': {
        if (t === 1) {
          room.fx.burst(this.cx, this.cy, '#9a6bff', 20, 3);
          audio.play('dash', 0.8);
          this.flash = 0;
        }
        if (t < 30) {
          this.anim = 'wind';
          this.pose = 'dash';
          const gy = room.world.groundBelow(p.cx, p.b.y);
          if (t === 2) room.marker(p.cx - 30, gy - 4, 60, 4, 28, '#ff3030');
          if (t === 2) this.aim = { x: p.cx, y: gy };
          return false;
        }
        if (t === 30) {
          this.b.x = this.aim.x - this.b.w / 2;
          this.b.y = this.aim.y - this.b.h - 80;
          this.b.vy = 9;
          this.pose = 'slam';
          room.fx.burst(this.cx, this.cy, '#9a6bff', 20, 3);
        }
        if (t > 30 && this.b.onGround) {
          room.enemyExplode(this.cx, this.b.y + this.b.h - 10, 56, this.atk * 1.2);
          room.cam.shake(7);
          room.fx.dust(this.cx, this.b.y + this.b.h, 16);
          return true;
        }
        return t > 120;
      }
      case 'summonGuards': {
        this.pose = 'castUp';
        this.anim = 'wind';
        if (t === 24) room.spawnMinions(this, 2, Math.random() < 0.5 ? 'royal_guard' : 'shade');
        return t > 50;
      }
      case 'swordRain': {
        this.pose = 'castUp';
        this.anim = 'wind';
        const n = this.phase >= 2 ? 16 : 12;
        if (t <= n * 5 && t % 5 === 0) this.skyDrop(room, t % 15 === 0 ? p.cx : 30 + Math.random() * (room.world.pxW - 60), 44, 'blade', '#c8a8ff', 0.8);
        return t > n * 5 + 50;
      }
      case 'darkWave': {
        this.pose = t < 40 ? 'slamWind' : 'slam';
        this.anim = t < 40 ? 'wind' : 'atk';
        if (t === 1) audio.play('warn');
        if (t === 40) {
          this.wave(room, [-1, 1], '#9a6bff', 3, 40);
          room.cam.shake(6);
          audio.play('explode', 0.8);
        }
        if (this.phase >= 2 && t === 75) this.wave(room, [-1, 1], '#9a6bff', 3.8, 30);
        return t > 95;
      }
      case 'pactShadows': {
        this.pose = 'castUp';
        this.anim = 'wind';
        if (t === 1) {
          room.bossShout('계약자여, 네가 부린 혼들도 결국 나의 것이다!', '#c8a8ff');
          audio.play('boss_roar', 0.8);
          const pool = room.pactPool();
          this.shadows = pool.slice(0, 4).map((id, i) => {
            const dir = i % 2 ? -1 : 1;
            const x = dir > 0 ? 24 : room.world.pxW - 24;
            const gy = room.world.groundBelow(x, 100);
            return { id, x, y: i >= 2 ? gy - 60 : gy, dir, t: -i * 34, done: false, hit: false };
          });
        }
        let allDone = true;
        for (const s of this.shadows) {
          s.t++;
          if (s.done) continue;
          allDone = false;
          if (s.t === 1) {
            room.marker(Math.min(s.x, s.x + s.dir * 2000), s.y - 22, room.world.pxW, 20, 40, '#9a6bff', true);
            room.toastWorld(s.x, s.y - 34, CHAR_MAP[s.id]?.name ?? '', '#c8a8ff');
          }
          if (s.t > 40) {
            s.x += s.dir * 7;
            if (!s.hit && Math.abs(room.player.cx - s.x) < 16 && Math.abs(room.player.cy - (s.y - 10)) < 20) {
              s.hit = room.damagePlayer(Math.round(this.atk * 0.9), s.x, `${CHAR_MAP[s.id]?.name ?? ''}의 그림자`, { kb: 4 });
            }
            if (s.t % 2 === 0) room.fx.ghost(charFrame(s.id, 'thrust'), s.x - 24, s.y - 44, s.dir < 0, '#3a1a5a', 12);
            if (s.x < -30 || s.x > room.world.pxW + 30) s.done = true;
          }
        }
        return (allDone && t > 10) || t > 400;
      }
    }
    return true;
  }

  override render(g: CanvasRenderingContext2D, cx: number, cy: number, time: number): void {
    if (this.dead && this.deadT > 60) return;
    let img: HTMLCanvasElement;
    let sc = 1;
    let footOff = 44;
    const f = Math.floor(this.animT / 10);
    switch (this.bd.id) {
      case 'mycora':
        img = mycoraFrame(this.anim, f);
        footOff = 92;
        break;
      case 'ignis':
        img = ignisFrame(this.anim, f, this.phase >= 1);
        footOff = 108;
        break;
      default: {
        sc = 2;
        let pose = this.pose;
        if (this.anim === 'move') pose = (['run0', 'run1', 'run2', 'run3', 'run4', 'run5'] as PoseName[])[Math.floor(this.animT / 6) % 6];
        else if (this.anim === 'idle') pose = f % 2 ? 'idle1' : 'idle0';
        img = lookFrame(`b:${this.bd.id}`, ENEMY_LOOKS[this.bd.id], pose);
      }
    }
    const fw = img.width * sc;
    const fh = img.height * sc;
    const x = Math.round(this.cx - fw / 2 - cx);
    const y = Math.round(this.b.y + this.b.h - footOff * sc - cy);
    g.save();
    if (this.dead) g.globalAlpha = 1 - this.deadT / 60;
    if (this.intro > 0) g.globalAlpha = Math.min(1, (100 - this.intro) / 40);
    const flip = this.facing < 0 && (this.bd.id === 'graven' || this.bd.id === 'king' || this.bd.id === 'ignis');
    const draw = (im: HTMLCanvasElement, ox = 0, oy = 0): void => {
      if (flip) {
        g.save();
        g.translate(x + fw / 2 + ox, 0);
        g.scale(-1, 1);
        g.drawImage(im, -fw / 2, y + oy, fw, fh);
        g.restore();
      } else g.drawImage(im, x + ox, y + oy, fw, fh);
    };
    // 오라
    const aura = tinted(img, this.bd.col);
    const a0 = g.globalAlpha;
    g.globalAlpha = a0 * (0.35 + 0.2 * Math.sin(time * 0.1) + (this.phase > 0 ? 0.2 : 0));
    draw(aura, -2, 0);
    draw(aura, 2, 0);
    draw(aura, 0, -2);
    g.globalAlpha = a0;
    let sx = 0;
    if (this.state === 'wind' && (time >> 1) % 2) sx = 1;
    draw(img, sx);
    if (this.flash > 0 || this.dead) draw(white(img), sx);
    else if (this.status.freeze) {
      g.globalAlpha = a0 * 0.5;
      draw(tinted(img, '#bfefff'));
    } else if (this.state === 'wind' && (time >> 2) % 2 === 0) {
      g.globalAlpha = a0 * 0.35;
      draw(tinted(img, '#ff3030'));
    }
    g.restore();
    // 계약의 그림자
    for (const s of this.shadows) {
      if (s.done || s.t < 1) continue;
      const im = tinted(charFrame(s.id, s.t > 40 ? 'thrust' : 'thrustWind'), '#2a0e40');
      g.save();
      g.globalAlpha = Math.min(1, s.t / 20) * 0.9;
      const sxp = Math.round(s.x - 24 - cx);
      const syp = Math.round(s.y - 44 - cy);
      if (s.dir < 0) {
        g.translate(sxp + 24, 0);
        g.scale(-1, 1);
        g.drawImage(im, -24, syp);
      } else g.drawImage(im, sxp, syp);
      g.restore();
      g.fillStyle = '#ff40c0';
      g.fillRect(Math.round(s.x - cx) + s.dir * 2, Math.round(s.y - 34 - cy), 2, 1);
    }
  }
}
