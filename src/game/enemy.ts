import { CHAPTER_SCALE, ELITE_MULT, ENEMIES, type EnemyDef } from '../data/enemies';
import { audio } from '../core/audio';
import { enemyFrame, tinted, white } from '../gfx/sprites';
import { rgba } from '../gfx/pixel';
import type { Room } from './room';
import type { StatusId } from './types';
import { newBody, Tile, type Body } from './world';

export type EState = 'spawn' | 'idle' | 'move' | 'wind' | 'atk' | 'recover' | 'hurt' | 'stun' | 'skill' | 'tele';

export const STATUS_COL: Record<StatusId, string> = { burn: '#ff7a2a', bleed: '#d8203a', poison: '#8bdc3a', shock: '#7fd8ff', chill: '#a8e4ff', freeze: '#d0f4ff', slow: '#a0a0ff' };
export const STATUS_NAME: Record<StatusId, string> = { burn: '화상', bleed: '출혈', poison: '독', shock: '감전', chill: '냉기', freeze: '빙결', slow: '둔화' };

/** 일반/정예 적. 보스는 이 클래스를 상속한다. */
export class Enemy {
  b: Body;
  hp: number;
  maxHp: number;
  /** 함정 피해 재사용 대기 */
  hazCd = 0;
  atk: number;
  dead = false;
  deadT = 0;
  facing = -1;
  state: EState = 'spawn';
  st = 50;
  cd = 60;
  flash = 0;
  /** 상태이상 남은 프레임 */
  status: Partial<Record<StatusId, number>> = {};
  stacks: Partial<Record<StatusId, number>> = {};
  kbRes: number;
  defense: number;
  isBoss = false;
  guardHits = 0;
  eliteT = 240;
  enraged = false;
  animT = 0;
  tAcc = 0;
  aim = { x: 0, y: 0 };
  skillName = '';
  scale = 1;
  dmgTaken = 0; // 허수아비 DPS
  dpsWindow: { t: number; d: number }[] = [];
  lastHitT = -999;
  vuln = 0;
  name: string;
  minion = false;

  constructor(
    public def: EnemyDef,
    x: number,
    y: number,
    public elite: boolean,
    chapter: number,
    curse: number,
    depth: number,
    power = { hp: 1, atk: 1 }, // 스토리 배율
  ) {
    const sc = (CHAPTER_SCALE[chapter] ?? 1) * (1 + curse) * (1 + depth * 0.05) * power.hp;
    this.scale = elite ? ELITE_MULT.size : 1;
    const w = Math.round(def.w * this.scale);
    const h = Math.round(def.h * this.scale);
    this.b = newBody(x - w / 2, y - h, w, h);
    this.maxHp = this.hp = Math.round(def.hp * sc * (elite ? ELITE_MULT.hp : 1));
    this.atk = Math.round(def.atk * (CHAPTER_SCALE[chapter] ?? 1) * (1 + curse * 0.8) * (elite ? ELITE_MULT.atk : 1) * power.atk);
    this.kbRes = elite ? Math.max(def.kbRes, 0.6) : def.kbRes;
    this.defense = def.def ?? 0;
    this.name = elite ? `정예 ${def.name}` : def.name;
    if (def.ai === 'dummy') {
      this.state = 'idle';
      this.st = 0;
    }
  }

  get cx(): number {
    return this.b.x + this.b.w / 2;
  }
  get cy(): number {
    return this.b.y + this.b.h / 2;
  }
  get alive(): boolean {
    return !this.dead;
  }
  get statuses(): Partial<Record<StatusId, number>> {
    return this.stacks;
  }
  get flying(): boolean {
    return !!this.def.flying;
  }
  get attacking(): boolean {
    return this.state === 'wind' || this.state === 'atk' || this.state === 'skill' || this.state === 'tele';
  }

  /** 상태이상 부여 */
  applyStatus(s: StatusId, n: number, room: Room): void {
    if (this.dead || this.def.ai === 'dummy' && s === 'freeze') return;
    const flags = room.build;
    const before = this.stacks[s] ?? 0;
    switch (s) {
      case 'burn':
        this.stacks.burn = Math.min(3 + flags.flag('burnMax'), before + n);
        this.status.burn = 180;
        break;
      case 'bleed': {
        this.stacks.bleed = Math.min(5 + Math.min(3, flags.flag('poisonMax')), before + n);
        this.status.bleed = 240;
        const rup = flags.flag('bleedRupture');
        if (rup && (this.stacks.bleed ?? 0) >= 5) {
          this.stacks.bleed = 0;
          this.status.bleed = 0;
          room.fx.burst(this.cx, this.cy, '#ff2040', 18, 3);
          room.fx.ring(this.cx, this.cy, '#ff2040', 26);
          audio.play('hit_crit', 0.7);
          room.damageEnemy(this, { m: rup, kind: 'proc', el: 'blood', kb: 1, up: -1, hs: 4, dir: 0, proc: true, label: '파열' });
        }
        break;
      }
      case 'poison':
        this.stacks.poison = Math.min(5 + flags.flag('poisonMax'), before + n);
        this.status.poison = 300;
        break;
      case 'shock':
        if (!this.status.shock && flags.flag('shockSpread')) {
          const other = room.nearestEnemy(this.cx, this.cy, 70, this);
          if (other && !other.status.shock) {
            other.stacks.shock = 1;
            other.status.shock = 150;
            room.fx.lightning(this.cx, this.cy, other.cx, other.cy);
          }
        }
        this.stacks.shock = 1;
        this.status.shock = 180;
        break;
      case 'chill':
        if (this.status.freeze) break;
        this.stacks.chill = before + n;
        this.status.chill = 240;
        if ((this.stacks.chill ?? 0) >= 5) {
          this.stacks.chill = 0;
          this.status.chill = 0;
          this.stacks.freeze = 1;
          this.status.freeze = this.isBoss ? 60 : 120;
          audio.play('freeze');
          room.fx.burst(this.cx, this.cy, '#d0f4ff', 12, 2);
          if (this.attacking && !this.isBoss) {
            this.state = 'idle';
            this.st = 0;
          }
        }
        break;
      case 'freeze':
        this.stacks.freeze = 1;
        this.status.freeze = this.isBoss ? 60 : 120;
        break;
      case 'slow':
        this.stacks.slow = 1;
        this.status.slow = 30;
        break;
    }
    if (s !== 'slow') room.build.fire('statusApplied', { target: this }, Math.random);
  }

  private tickStatuses(room: Room): void {
    for (const k of Object.keys(this.status) as StatusId[]) {
      const v = (this.status[k] ?? 0) - 1;
      if (v <= 0) {
        delete this.status[k];
        delete this.stacks[k];
        if (k === 'freeze') {
          const sh = room.build.flag('freezeShatter');
          if (sh) {
            room.fx.burst(this.cx, this.cy, '#d0f4ff', 20, 3);
            audio.play('freeze', 0.7);
            room.explode(this.cx, this.cy, 40, sh, 'proc', 'frost');
          }
        }
        continue;
      }
      this.status[k] = v;
      const st = this.stacks[k] ?? 1;
      if (k === 'burn' && v % 30 === 0) room.dot(this, 0.14 * st, 'fire', STATUS_COL.burn);
      if (k === 'bleed' && v % 40 === 0) room.dot(this, 0.1 * st, 'blood', STATUS_COL.bleed);
      if (k === 'poison' && v % 30 === 0) room.dot(this, 0.07 * st, 'poison', STATUS_COL.poison);
      if (k === 'burn' && v % 6 === 0) room.fx.parts.push({ x: this.cx + (Math.random() - 0.5) * this.b.w, y: this.b.y + Math.random() * this.b.h, vx: 0, vy: -0.6, life: 0, max: 16, col: '#ff8a2a', size: 1, grav: -0.02, kind: 'px', drag: 0.95 });
      if (k === 'poison' && v % 10 === 0) room.fx.parts.push({ x: this.cx + (Math.random() - 0.5) * this.b.w, y: this.b.y + this.b.h * 0.3, vx: 0, vy: -0.3, life: 0, max: 20, col: '#8bdc3a', size: 2, grav: 0, kind: 'smoke', drag: 0.95 });
      if (k === 'shock' && v % 20 === 0) room.fx.sparks(this.cx, this.cy, Math.random() > 0.5 ? 1 : -1, '#bff0ff', 2);
    }
  }

  /** 시간 배율 적용 업데이트 */
  update(room: Room): void {
    this.animT++;
    if (this.flash > 0) this.flash--;
    if (this.dead) {
      this.deadT++;
      return;
    }
    if (room.timestop > 0 && !this.isBoss) return;
    if (room.timestop > 0 && this.isBoss && room.time % 3 !== 0) return;
    let ts = 1;
    if (this.status.slow) ts *= 0.5;
    if (room.enemySlow > 0) ts *= 0.4;
    if (this.enraged) ts *= 1.25;
    this.tAcc += ts;
    while (this.tAcc >= 1) {
      this.tAcc -= 1;
      this.step(room);
      if (this.dead) break;
    }
  }

  step(room: Room): void {
    this.tickStatuses(room);
    if (this.dead) return;
    if (this.status.freeze) {
      if (!this.flying) {
        this.b.vy = Math.min(6, this.b.vy + 0.3);
        this.b.vx *= 0.8;
        room.world.move(this.b);
      }
      return;
    }
    if (this.st > 0) this.st--;
    if (this.cd > 0) this.cd--;
    this.ai(room);
    // 물리
    if (!this.flying || this.state === 'hurt' && !this.isBoss) {
      const airHurt = this.state === 'hurt' && !this.b.onGround;
      this.b.vy = Math.min(6, this.b.vy + (airHurt ? 0.2 : 0.3));
    }
    if (this.flying && this.state !== 'hurt') {
      this.b.vx *= 0.94;
      this.b.vy *= 0.94;
    } else if (this.b.onGround && (this.state === 'hurt' || this.state === 'stun' || this.state === 'idle' || this.state === 'recover')) {
      this.b.vx *= 0.8;
    }
    room.world.move(this.b, this.flying);
    // 함정: 가시·용암에 닿으면 적도 피해 (보스·날아다니는 적은 제외, 0.67초마다)
    if (this.hazCd > 0) this.hazCd--;
    else if (!this.isBoss && !this.flying) {
      const hz = room.world.hazardAt(this.b);
      if (hz === Tile.Spike || hz === Tile.Lava) room.enemyHazard(this, hz);
    }
    if (this.b.y > room.world.pxH + 40) {
      this.hp = 0;
      room.killEnemy(this);
    }
  }

  protected face(room: Room): void {
    const d = room.player.cx - this.cx;
    if (Math.abs(d) > 2) this.facing = d > 0 ? 1 : -1;
  }

  protected groundAhead(room: Room, dir: number): boolean {
    const x = dir > 0 ? this.b.x + this.b.w + 2 : this.b.x - 2;
    const y = this.b.y + this.b.h + 4;
    return room.world.solidPx(x, y) || room.world.get(Math.floor(x / 16), Math.floor(y / 16)) === 2 && true;
  }

  protected walk(room: Room, dir: number, spd: number): void {
    if (this.b.onGround && !this.groundAhead(room, dir)) {
      this.b.vx = 0;
      this.state = 'idle';
      return;
    }
    this.b.vx = dir * spd;
    this.state = 'move';
  }

  protected attackBox(room: Room, w: number, h: number, dmg: number, yOff = 0): void {
    const x = this.facing > 0 ? this.b.x + this.b.w - 4 : this.b.x - w + 4;
    room.enemyHit({ x, y: this.cy - h / 2 + yOff, w, h }, dmg, this.cx, this.name);
    if (room.debug) room.debugBoxes.push({ x, y: this.cy - h / 2 + yOff, w, h, t: 10, col: '#ff3030' });
  }

  protected shootAt(room: Room, n = 1, spread = 0.18, speedMul = 1): void {
    const p = this.def.proj!;
    const a = Math.atan2(room.player.cy - this.cy, room.player.cx - this.cx);
    for (let i = 0; i < n; i++) {
      const off = (i - (n - 1) / 2) * spread;
      room.addProj('enemy', { ...p, spd: p.spd * speedMul }, this.cx + this.facing * 6, this.cy - 4, a + off, this.atk, 'normal');
    }
    audio.play(this.def.id === 'bone_archer' || this.def.id === 'harpooner' ? 'arrow' : 'enemy_shot');
  }

  protected contact(room: Room, dmg: number): void {
    if (room.player.overlaps(this.b)) room.damagePlayer(dmg, this.cx, this.name, { kb: 3 });
  }

  /** 정예 추가 패턴 */
  protected eliteSkill(room: Room): boolean {
    if (!this.elite || this.attacking) return false;
    if (this.def.eliteSkill === 'enrage') {
      if (!this.enraged && this.hp < this.maxHp * 0.5) {
        this.enraged = true;
        room.fx.ring(this.cx, this.cy, '#ff3030', 30);
        room.toastWorld(this.cx, this.b.y - 10, '격노!', '#ff5050');
        audio.play('boss_roar', 1.6);
      }
      return false;
    }
    if (--this.eliteT > 0) return false;
    this.eliteT = 300 + Math.floor(Math.random() * 120);
    this.state = 'skill';
    this.skillName = this.def.eliteSkill;
    this.st = 36;
    this.b.vx = 0;
    audio.play('warn');
    return true;
  }

  protected doEliteSkill(room: Room): void {
    switch (this.skillName) {
      case 'shockwave':
        for (const dir of [-1, 1]) room.addProj('enemy', { spr: 'wave', spd: 3.2, life: 70, w: 12, h: 18, col: this.def.col, ground: true, pierce: 99 }, this.cx, this.b.y + this.b.h - 9, dir > 0 ? 0 : Math.PI, this.atk, 'normal');
        room.cam.shake(3);
        audio.play('hit_power', 0.6);
        break;
      case 'volley': {
        const a = Math.atan2(room.player.cy - this.cy, room.player.cx - this.cx);
        for (let i = -2; i <= 2; i++) room.addProj('enemy', { spr: 'orb', spd: 2.6, life: 140, w: 8, h: 8, col: this.def.col }, this.cx, this.cy, a + i * 0.22, Math.round(this.atk * 0.8), 'normal');
        audio.play('enemy_shot', 0.8);
        break;
      }
      case 'summon':
        room.spawnMinions(this, 2);
        break;
      case 'blink': {
        const tx = room.player.cx - room.player.facing * 40;
        room.fx.burst(this.cx, this.cy, '#9a6bff', 14, 2);
        this.b.x = Math.max(20, Math.min(room.world.pxW - 40, tx)) - this.b.w / 2;
        if (!this.flying) this.b.y = room.world.groundBelow(this.b.x + this.b.w / 2, room.player.b.y - 20) - this.b.h;
        else this.b.y = room.player.b.y - 30;
        room.fx.burst(this.cx, this.cy, '#9a6bff', 14, 2);
        this.face(room);
        this.cd = 0;
        audio.play('dash', 1.5);
        break;
      }
      case 'nova':
        room.enemyExplode(this.cx, this.cy, 56, this.atk, 'poison');
        room.addField('enemy', { vis: 'poison', w: 70, h: 30, life: 180, tick: 30, m: 1, st: 'poison' }, this.cx - 35, room.world.groundBelow(this.cx, this.cy) - 30, Math.round(this.atk * 0.4), 'normal');
        break;
    }
  }

  ai(room: Room): void {
    const d = this.def;
    const p = room.player;
    const dx = p.cx - this.cx;
    const dy = p.cy - this.cy;
    const adx = Math.abs(dx);
    const spd = d.speed * (this.enraged ? 1.4 : 1);
    if (this.state === 'spawn') {
      if (this.st <= 0) {
        this.state = 'idle';
        this.cd = 30 + Math.floor(Math.random() * 40);
      }
      return;
    }
    if (this.state === 'hurt') {
      if (this.st <= 0) this.state = 'idle';
      return;
    }
    if (this.state === 'stun') {
      if (this.st <= 0) {
        this.state = 'idle';
        this.guardHits = 0;
      }
      return;
    }
    if (this.state === 'skill') {
      if (this.st === 10) this.doEliteSkill(room);
      if (this.st <= 0) {
        this.state = 'recover';
        this.st = 30;
      }
      return;
    }
    if (this.state === 'recover') {
      if (this.st <= 0) this.state = 'idle';
      if (this.flying) {
        this.b.vx *= 0.9;
        this.b.vy *= 0.9;
      }
      return;
    }
    if (d.ai === 'dummy') return;
    if (this.eliteSkill(room)) return;

    switch (d.ai) {
      case 'melee':
      case 'shield':
      case 'lancer':
      case 'golem': {
        if (this.state === 'wind') {
          if (d.ai === 'lancer' && this.st === 4) this.b.vx = this.facing * 0.5;
          if (this.st <= 0) {
            this.state = 'atk';
            this.st = d.ai === 'golem' ? 24 : 18;
            if (d.ai === 'lancer') this.b.vx = this.facing * 5;
            else this.b.vx = this.facing * (d.ai === 'golem' ? 0.5 : 2.2);
            audio.play(d.ai === 'golem' ? 'swing_heavy' : 'swing', 0.8);
          }
          return;
        }
        if (this.state === 'atk') {
          const t = (d.ai === 'golem' ? 24 : 18) - this.st;
          if (d.ai === 'lancer' && t <= 10 && t % 3 === 0) this.attackBox(room, 46, 12, this.atk);
          if (d.ai !== 'lancer' && t === 3) {
            if (d.ai === 'golem') {
              this.attackBox(room, 40, 34, this.atk);
              for (const dir of [-1, 1]) room.addProj('enemy', { spr: 'wave', spd: 3, life: 60, w: 12, h: 16, col: d.elem ? d.col : '#ff6a1a', ground: true, pierce: 99, st: d.elem ? d.elem.st : 'burn' }, this.cx, this.b.y + this.b.h - 8, dir > 0 ? 0 : Math.PI, Math.round(this.atk * 0.7), 'normal');
              room.cam.shake(4);
              audio.play('hit_power', 0.5);
              room.fx.dust(this.cx + this.facing * 20, this.b.y + this.b.h, 10);
            } else this.attackBox(room, d.ai === 'shield' ? 26 : 30, 26, this.atk);
          }
          if (d.ai === 'lancer') this.b.vx *= 0.88;
          else this.b.vx *= 0.8;
          if (this.st <= 0) {
            this.state = 'recover';
            this.st = 20;
            this.cd = d.cd;
          }
          return;
        }
        this.face(room);
        if (adx > d.range - 4) this.walk(room, Math.sign(dx), spd);
        else {
          this.b.vx = 0;
          this.state = 'idle';
        }
        if (adx <= d.range && Math.abs(dy) < 34 && this.cd <= 0) this.startWind(d.windup);
        break;
      }
      case 'archer':
      case 'caster': {
        if (this.state === 'wind') {
          this.face(room);
          if (this.st <= 0) {
            this.shootAt(room, d.ai === 'caster' && this.def.id === 'fire_sprite' && this.enraged ? 3 : 1);
            this.state = 'recover';
            this.st = 20;
            this.cd = d.cd;
          }
          return;
        }
        this.face(room);
        const want = d.ai === 'archer' ? 100 : 120;
        if (this.flying) {
          const tx = p.cx - Math.sign(dx || 1) * want;
          const ty = p.cy - 50;
          this.b.vx += Math.sign(tx - this.cx) * 0.08 * spd;
          this.b.vy += Math.sign(ty - this.cy) * 0.06 * spd + Math.sin(this.animT * 0.05) * 0.03;
          this.state = 'move';
        } else if (adx < want - 30) this.walk(room, -Math.sign(dx), spd);
        else if (adx > d.range) this.walk(room, Math.sign(dx), spd);
        else {
          this.b.vx = 0;
          this.state = 'idle';
        }
        if (adx <= d.range && this.cd <= 0 && room.world.los(this.cx, this.cy, p.cx, p.cy)) this.startWind(d.windup);
        break;
      }
      case 'flyer': {
        if (this.state === 'wind') {
          this.b.vx *= 0.8;
          this.b.vy *= 0.8;
          if (this.st <= 0) {
            const a = Math.atan2(this.aim.y - this.cy, this.aim.x - this.cx);
            this.b.vx = Math.cos(a) * 4.2;
            this.b.vy = Math.sin(a) * 4.2;
            this.state = 'atk';
            this.st = 28;
            audio.play('dash', 1.3);
          }
          return;
        }
        if (this.state === 'atk') {
          this.b.vx *= 0.985;
          this.b.vy *= 0.985;
          this.contact(room, this.atk);
          if (this.st <= 0) {
            this.state = 'recover';
            this.st = 30;
            this.cd = d.cd;
          }
          return;
        }
        this.face(room);
        const tx = p.cx - this.facing * 50;
        const ty = p.cy - 45;
        this.b.vx += Math.sign(tx - this.cx) * 0.07 * spd;
        this.b.vy += Math.sign(ty - this.cy) * 0.06 * spd;
        this.state = 'move';
        if (Math.hypot(dx, dy) < d.range && this.cd <= 0) {
          this.startWind(d.windup);
          this.aim = { x: p.cx, y: p.cy };
        }
        break;
      }
      case 'jumper': {
        if (this.state === 'wind') {
          if (this.st <= 0) {
            this.b.vx = Math.max(-3.2, Math.min(3.2, dx / 34));
            this.b.vy = -5.6;
            this.state = 'atk';
            this.st = 80;
            audio.play('jump', 0.6);
          }
          return;
        }
        if (this.state === 'atk') {
          this.contact(room, this.atk);
          if ((this.b.onGround && this.st < 74) || this.st <= 0) {
            this.state = 'recover';
            this.st = 24;
            this.cd = d.cd;
            room.fx.dust(this.cx, this.b.y + this.b.h, 6);
            if (this.elite) room.addField('enemy', { vis: d.elem?.vis ?? 'poison', w: 40, h: 14, life: 120, tick: 30, m: 1, st: d.elem ? d.elem.st : 'poison' }, this.cx - 20, this.b.y + this.b.h - 14, Math.round(this.atk * 0.3), 'normal');
          }
          return;
        }
        this.face(room);
        if (this.b.onGround) {
          this.b.vx *= 0.7;
          if (this.animT % 60 === 0 && adx > 30) {
            this.b.vy = -2.6;
            this.b.vx = Math.sign(dx) * spd * 1.2;
          }
        }
        this.state = 'idle';
        if (adx < d.range && this.cd <= 0 && this.b.onGround) this.startWind(d.windup);
        break;
      }
      case 'charger': {
        if (this.state === 'wind') {
          this.b.vx = -this.facing * 0.3;
          if (this.st <= 0) {
            this.state = 'atk';
            this.st = 50;
            audio.play('dash', 0.7);
          }
          return;
        }
        if (this.state === 'atk') {
          this.b.vx = this.facing * (this.def.id === 'forge_hound' ? 5 : 4.2);
          this.contact(room, this.atk);
          if (this.animT % 3 === 0) room.fx.dust(this.cx - this.facing * 6, this.b.y + this.b.h, 1);
          if (this.def.id === 'forge_hound' && this.animT % 8 === 0) room.addField('enemy', { vis: 'fire', w: 16, h: 10, life: 90, tick: 30, m: 1, st: 'burn' }, this.cx - 8, this.b.y + this.b.h - 10, Math.round(this.atk * 0.3), 'normal');
          if (this.st <= 0 || this.b.hitWall || (this.b.onGround && !this.groundAhead(room, this.facing))) {
            this.state = 'recover';
            this.st = 34;
            this.cd = d.cd;
            this.b.vx = 0;
          }
          return;
        }
        this.face(room);
        if (adx > 40) this.walk(room, Math.sign(dx), spd);
        else {
          this.b.vx = 0;
          this.state = 'idle';
        }
        if (adx < d.range && Math.abs(dy) < 26 && this.cd <= 0 && this.b.onGround) this.startWind(d.windup);
        break;
      }
      case 'turret': {
        this.b.vx = 0;
        if (this.state === 'wind') {
          if (this.st <= 0) {
            const shots = this.elite ? 3 : 1;
            for (let i = 0; i < shots; i++) {
              const T = 46 + i * 10;
              const pr = d.proj!;
              const g = pr.grav ?? 0.1;
              const tx = p.cx + (i - (shots - 1) / 2) * 30;
              const vx = (tx - this.cx) / T;
              const vy = (p.cy - (this.b.y + 4) - 0.5 * g * T * T) / T;
              const proj = room.addProj('enemy', { ...pr, spd: Math.hypot(vx, vy), vy: 0, boom: { r: 16, m: 1, st: 'poison', field: { vis: 'poison', w: 36, h: 14, life: 150, tick: 30, m: 0.35, st: 'poison' } } }, this.cx, this.b.y + 4, Math.atan2(vy, vx), this.atk, 'normal');
              void proj;
            }
            audio.play('poison');
            this.state = 'recover';
            this.st = 20;
            this.cd = d.cd;
          }
          return;
        }
        this.face(room);
        this.state = 'idle';
        if (adx < d.range && this.cd <= 0) this.startWind(d.windup);
        break;
      }
      case 'teleporter': {
        if (this.state === 'wind') {
          if (this.st <= 0) {
            room.fx.burst(this.cx, this.cy, '#9a6bff', 12, 2);
            const tx = p.cx - p.facing * 26;
            const nx = Math.max(24, Math.min(room.world.pxW - 24, tx));
            this.b.x = nx - this.b.w / 2;
            this.b.y = room.world.groundBelow(nx, p.b.y - 10) - this.b.h;
            this.face(room);
            room.fx.burst(this.cx, this.cy, '#9a6bff', 12, 2);
            this.state = 'tele';
            this.st = 22;
            audio.play('warn');
          }
          return;
        }
        if (this.state === 'tele') {
          if (this.st <= 0) {
            this.attackBox(room, 30, 24, this.atk);
            audio.play('swing');
            this.state = 'recover';
            this.st = 24;
            this.cd = d.cd;
          }
          return;
        }
        this.face(room);
        if (adx > 60) this.walk(room, Math.sign(dx), spd);
        else {
          this.b.vx = 0;
          this.state = 'idle';
        }
        if (Math.hypot(dx, dy) < 220 && this.cd <= 0) {
          this.startWind(d.windup);
        }
        break;
      }
      case 'bomber': {
        if (this.state === 'wind') {
          this.b.vx *= 0.85;
          this.b.vy *= 0.85;
          if (this.st <= 0) {
            const gy = room.world.groundBelow(this.cx, this.cy);
            room.addField('enemy', { vis: d.elem?.vis ?? 'poison', w: 44, h: 22, life: 200, tick: 30, m: 1, st: d.elem ? d.elem.st : 'poison' }, this.cx - 22, gy - 22, Math.round(this.atk * 0.5), 'normal');
            room.fx.burst(this.cx, this.cy + 6, d.elem ? d.col : '#c0f060', 14, 1.5);
            audio.play('poison');
            this.state = 'recover';
            this.st = 24;
            this.cd = d.cd;
          }
          return;
        }
        this.face(room);
        const ty = p.cy - 56;
        this.b.vx += Math.sign(p.cx - this.cx) * 0.06 * spd;
        this.b.vy += Math.sign(ty - this.cy) * 0.05 * spd;
        this.state = 'move';
        if (adx < 24 && this.cd <= 0) this.startWind(d.windup);
        break;
      }
    }
  }

  protected startWind(f: number): void {
    this.state = 'wind';
    this.st = f;
    this.b.vx = 0;
  }

  /** 정면 방패 판정 */
  blocks(dir: number): boolean {
    if (this.def.ai !== 'shield') return false;
    if (this.state === 'stun' || this.state === 'atk' || this.state === 'recover' || this.state === 'hurt') return false;
    return dir !== 0 && Math.sign(dir) === -this.facing;
  }

  frame(): HTMLCanvasElement {
    let anim = 'idle';
    let f = Math.floor(this.animT / 12);
    switch (this.state) {
      case 'move':
        anim = 'move';
        f = Math.floor(this.animT / 6);
        break;
      case 'wind':
      case 'skill':
      case 'tele':
        anim = 'wind';
        break;
      case 'atk':
        anim = 'atk';
        break;
      case 'hurt':
      case 'stun':
        anim = 'hurt';
        break;
      case 'recover':
        anim = this.def.ai === 'jumper' || this.def.ai === 'charger' ? 'idle' : 'atk';
        break;
    }
    if (this.blocks(-this.facing) && this.state === 'idle' && (this.def.id === 'royal_guard' || this.def.id === 'bone_shield')) anim = 'block';
    return enemyFrame(this.def.id, anim, f);
  }

  render(g: CanvasRenderingContext2D, cx: number, cy: number, time: number): void {
    if (this.dead && this.deadT > 24) return;
    const img = this.frame();
    const sc = this.scale;
    const fw = img.width * sc;
    const fh = img.height * sc;
    const x = Math.round(this.cx - fw / 2 - cx);
    const y = Math.round(this.b.y + this.b.h - 44 * sc - cy);
    g.save();
    if (this.state === 'spawn') {
      const t = 1 - this.st / 50;
      g.globalAlpha = t;
      g.fillStyle = rgba('#9a6bff', 0.4 * (1 - t));
      g.beginPath();
      g.ellipse(this.cx - cx, this.b.y + this.b.h - cy, 16 * (1 - t * 0.5), 4, 0, 0, Math.PI * 2);
      g.fill();
    }
    if (this.dead) g.globalAlpha = 1 - this.deadT / 24;
    const flip = this.facing < 0;
    const draw = (im: HTMLCanvasElement, ox = 0, oy = 0): void => {
      if (flip) {
        g.save();
        g.translate(x + fw / 2 + ox, 0);
        g.scale(-1, 1);
        g.drawImage(im, -fw / 2, y + oy, fw, fh);
        g.restore();
      } else g.drawImage(im, x + ox, y + oy, fw, fh);
    };
    if (this.elite || this.enraged) {
      const ac = this.enraged ? '#ff3030' : '#ff5a8a';
      const t = tinted(img, ac);
      g.globalAlpha *= 0.55 + 0.25 * Math.sin(time * 0.15);
      draw(t, -1, 0);
      draw(t, 1, 0);
      draw(t, 0, -1);
      g.globalAlpha = this.dead ? 1 - this.deadT / 24 : this.state === 'spawn' ? 1 - this.st / 50 : 1;
    }
    let shakeX = 0;
    if (this.state === 'wind' || this.state === 'skill') shakeX = (time % 4 < 2 ? 1 : -1) * (this.st < 12 ? 1 : 0);
    draw(img, shakeX, 0);
    if (this.flash > 0 || this.dead) draw(white(img), shakeX, 0);
    else if (this.status.freeze) {
      g.globalAlpha *= 0.6;
      draw(tinted(img, '#bfefff'));
    } else if ((this.state === 'wind' || this.state === 'skill' || this.state === 'tele') && (time >> 2) % 2 === 0) {
      g.globalAlpha *= 0.45;
      draw(tinted(img, '#ff3030'));
    }
    g.restore();
    // 예고 느낌표
    if ((this.state === 'wind' || this.state === 'skill' || this.state === 'tele') && !this.dead) {
      const ex = Math.round(this.cx - cx);
      const ey = Math.round(this.b.y - cy - 10 - (this.isBoss ? 8 : 0));
      g.fillStyle = '#ff3030';
      g.fillRect(ex - 1, ey - 6, 3, 6);
      g.fillRect(ex - 1, ey + 2, 3, 2);
      g.fillStyle = '#ffd0d0';
      g.fillRect(ex, ey - 5, 1, 4);
    }
  }
}

export function enemyPool(chapter: number): EnemyDef[] {
  return ENEMIES.filter((e) => e.chapter === chapter);
}
