import { BOSS_MAP, bossAtk, bossHp, type BossDef, type BossElem } from '../data/bosses';
import type { EnemyDef } from '../data/enemies';
import { audio } from '../core/audio';
import { orbFrame } from '../gfx/orb';
import { ENEMY_LOOKS, ignisFrame, lookFrame, mycoraFrame, white, tinted, charFrame } from '../gfx/sprites';
import { CHAR_MAP } from '../data/characters';
import type { FieldVis, PoseName, StatusId } from './types';
import { Enemy } from './enemy';
import type { Room } from './room';


/** 몸을 움직이지 않는 원거리·장판·소환 패턴. 다른 패턴과 동시에(보조 패턴으로) 쓸 수 있다. */
const REMOTE = new Set([
  'boneRain', 'lanternFire', 'ghostFlames', 'sporeCloud', 'spitVolley', 'rootSpikes', 'toxicFlood', 'lavaPillars', 'moltenRain',
  'shadowBlades', 'crownBeam', 'swordRain', 'cannonBarrage', 'whirlpool', 'iceSpears', 'pageStorm', 'shelfCollapse', 'blizzard', 'voidPillars',
  'starfall', 'pillarMarch', 'homingOrbs', 'crossBeam', 'laserSweep', 'gravityWell', 'floorHalf', 'meteor',
]);
/** 즉사기 */
const EXECUTE = new Set(['royalExecution', 'oblivionErase', 'execGround', 'execZones', 'execHalf']);
/**
 * 스토리 2~4 마지막·직전 보스의 즉사기 (공통 방식 3가지, 보스마다 이름·대사·색).
 * execGround: 바닥을 휩쓸어 땅에 서 있으면 즉사 → 뛰어오르거나 발판 위로
 * execZones: 화면 전체가 지워지고 빛의 기둥 안만 안전
 * execHalf: 플레이어가 있는 쪽 절반이 지워짐 → 반대편으로
 */
const EXEC_TXT: Record<string, { name: string; shout: string; col: string }> = {
  orbis: { name: '궤도 붕괴', shout: '별들이 궤도를 벗어난다… 빛의 기둥 안으로!', col: '#ffe080' },
  nemesia: { name: '블랙홀 붕괴', shout: '모든 빛은 삼켜진다… 반대편으로 달아나라!', col: '#c0a0ff' },
  fenrik: { name: '달의 포효', shout: '달이 울부짖는다! — 뛰어올라라!', col: '#c8d8ff' },
  carmilla: { name: '피의 심판', shout: '피의 왕좌 앞에 엎드려라… 빛 안으로!', col: '#ff4060' },
  aeon: { name: '시간 단절', shout: '이 시간을 끊어 낸다… 반대편으로!', col: '#a0e0ff' },
  arche: { name: '계약 파기', shout: '모든 계약은 여기서 끝난다! — 뛰어올라라!', col: '#ffd070' },
};
/** 즉사기 재사용 대기 (프레임) */
const EXECUTE_CD = 900;
// 스토리 5~6: 새 원거리·광역 패턴(보조로 동시 사용 가능)과 즉사기
for (const n of ['galeWaves', 'floorSweep', 'checkerFloor', 'beamGrid', 'skyCurtain', 'bladeHalo']) REMOTE.add(n);
for (const n of ['eclipseDive', 'worldSever']) EXECUTE.add(n);
/** 스토리 5~6 즉사기 대사·이름 */
const EXEC56: Record<string, { name: string; shout: string; col: string }> = {
  kalais: { name: '폭풍의 낙인', shout: '하늘이 너를 표시했다! — 그림자 밖으로 벗어나라!', col: '#c0e0ff' },
  noctis: { name: '극야의 낙하', shout: '밤의 날개가 너를 덮는다… 그림자에서 벗어나라!', col: '#80ffc0' },
  sever: { name: '세계 절단', shout: '하늘과 땅을 갈라 놓겠다! — 땅에 엎드려라!', col: '#e0c0ff' },
  iska: { name: '바깥의 해일', shout: '바다가 하늘을 덮는다… 땅에 붙어 있어라!', col: '#a0ffe0' },
};

interface Clone {
  x: number;
  y: number;
  dir: number;
  t: number;
  done: boolean;
  hit: boolean;
  mk?: { end: () => void };
}

interface SubPattern {
  name: string;
  t: number;
}

interface PactShadow {
  id: string;
  x: number;
  y: number;
  dir: number;
  t: number;
  done: boolean;
  hit: boolean;
  mk?: { end: () => void };
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
  subs: SubPattern[] = [];
  /** 보조 패턴 실행 중 (몸 동작·예고 상태를 건드리지 않는다) */
  private asSub = false;
  private execCd = 600;
  /** execHalf: 지워지는 쪽 (왼쪽 절반?) */
  private halfLeft = false;
  private landMark: { end: () => void } | null = null;
  private safe: { x: number; y: number }[] = [];
  private clones: Clone[] = [];
  private side = 0;
  /** 스토리 5~6 패턴 상태 (급강하 시작점·활강·즉사 기둥·바닥 쓸기 방향 등) */
  private air = { x: 0, y: 0, tx: 0, ty: 0, dir: 1, hit: false, mk: null as { end: () => void } | null };
  /** 분열 보스: 이미 분열했는지 / 분열체인지 */
  private splitDone = false;
  /** 완전체를 쓰러뜨려 4페이즈 전환 중 — 전환 중간에 분열체가 나온다 */
  private splitPending = false;
  twin = false;
  /** floorSweep: 왼쪽에서 시작? */
  private sweepL = true;
  /** 거울의 계약자: 플레이어의 현재 영웅 모습을 비춘다 */
  mirrorOf = '';

  constructor(id: string, x: number, y: number, curse: number, power = { hp: 1, atk: 1 }) {
    const bd = BOSS_MAP[id];
    const fake: EnemyDef = { id, name: bd.name, chapter: bd.chapter, ai: 'boss', hp: bd.hp, atk: bd.atk, speed: 1, w: bd.w, h: bd.h, range: 0, windup: 0, cd: 0, kbRes: 1, gold: 0, col: bd.col, eliteSkill: 'enrage', weight: 0, flying: bd.flying };
    super(fake, x, y, false, 1, 0, 0);
    this.bd = bd;
    this.isBoss = true;
    this.maxHp = this.hp = Math.round(bossHp(bd) * (1 + curse) * power.hp);
    this.atk = Math.round(bossAtk(bd) * (1 + curse * 0.8) * power.atk);
    this.state = 'idle';
    this.st = 0;
    this.name = bd.name;
    this.b.w = bd.orb ? 36 : bd.w * 0.6;
    this.b.h = bd.orb ? 36 : bd.h;
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
      if (this.phaseT === 60 && this.splitPending) {
        this.splitPending = false;
        this.doSplit(room);
      }
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
      this.subs = [];
      this.landMark?.end();
      this.landMark = null;
      this.b.vx = 0;
      audio.play('phase');
      room.cam.shake(7, 50);
      room.flash('#ffffff', 0.7);
      room.bossPhaseBanner(this.phase);
      if ((this.bd.id === 'king' || this.bd.id === 'oblivion') && this.phase === 2) room.darkBoost = 0.25;
      return;
    }
    if (this.execCd > 0) this.execCd--;
    this.runSubs(room);
    if (this.pattern && !EXECUTE.has(this.pattern)) this.fillSubs();
    if (!this.pattern) {
      this.anim = 'idle';
      this.pose = 'idle0';
      this.state = 'idle';
      this.face(room);
      const dx = room.player.cx - this.cx;
      if (this.bd.flying) this.hover(room);
      else if (this.bd.id !== 'mycora' && !this.bd.still) {
        if (Math.abs(dx) > 50 && this.b.onGround) {
          this.b.vx = Math.sign(dx) * (this.bd.id === 'ignis' ? 0.5 : this.bd.id === 'libra' ? 0.7 : 0.9);
          this.anim = 'move';
        } else this.b.vx = 0;
      }
      if (--this.idleT <= 0) this.pickPattern();
      return;
    }
    this.pt++;
    this.state = 'atk'; // 예고(빨간 번쩍임)는 각 패턴이 판정 직전 구간에만 'wind'로 켠다
    const done = this.runPattern(room, this.pattern, this.pt);
    if (done) {
      this.pattern = '';
      this.idleT = [40, 28, 18][this.phase] ?? 18;
      this.anim = 'idle';
      this.state = 'idle';
      this.b.vx = 0;
      this.landMark?.end();
      this.landMark = null;
    }
  }

  /** 주 패턴 선택 + 보조 패턴(동시 사용) 추가 */
  private pickPattern(): void {
    const all = this.bd.patterns[this.phase];
    const exec = all.filter((p) => EXECUTE.has(p));
    let pool = all.filter((p) => p !== this.last && !EXECUTE.has(p));
    if (exec.length && this.execCd <= 0) pool = exec;
    this.pattern = pool[Math.floor(Math.random() * pool.length)];
    this.last = this.pattern;
    this.pt = 0;
    this.combo = 0;
    if (EXECUTE.has(this.pattern)) {
      this.execCd = EXECUTE_CD;
      if (this.bd.multi) this.subs = []; // 동시 패턴 보스도 즉사기 중에는 보조 패턴을 멈춘다
      return; // 즉사기 중에는 다른 패턴을 겹치지 않는다
    }
    if (this.bd.multi) {
      this.fillSubs();
      return;
    }
    const heavy = this.bd.id === 'king' || this.bd.id === 'oblivion';
    const chance = ([0.4, 0.65, 0.85][this.phase] ?? 0.85) + (heavy ? 0.15 : 0);
    const maxSubs = this.phase >= 1 ? 2 : 1;
    for (let i = 0; i < maxSubs; i++) {
      if (this.subs.length >= maxSubs || Math.random() > chance - i * 0.3) break;
      const cands = all.filter((p) => REMOTE.has(p) && p !== this.pattern && !this.subs.some((s) => s.name === p));
      if (!cands.length) break;
      this.subs.push({ name: cands[Math.floor(Math.random() * cands.length)], t: 0 });
    }
  }

  /** multi 보스: 주 패턴과 함께 항상 (multi[페이즈] - 1)개의 보조 패턴이 돌아가도록 채운다 */
  private fillSubs(): void {
    const need = (this.bd.multi?.[this.phase] ?? 0) - 1;
    if (need <= 0) return;
    const all = this.bd.patterns[this.phase];
    while (this.subs.length < need) {
      const cands = all.filter((p) => REMOTE.has(p) && p !== this.pattern && !this.subs.some((s) => s.name === p));
      if (!cands.length) break;
      this.subs.push({ name: cands[Math.floor(Math.random() * cands.length)], t: 0 });
    }
  }

  /** 아레나 바닥 높이 (공중 발판 아래의 땅) */
  private floorY(room: Room, x: number): number {
    return room.world.groundBelow(x, room.world.pxH - 64);
  }

  /** 비행 보스: 플레이어 위쪽 비스듬히 맴돈다 (점프 + 공중 공격이 닿는 높이) */
  private hover(room: Room): void {
    const p = room.player;
    const gy = this.floorY(room, this.cx);
    const side = Math.floor(room.time / 240) % 2 ? 1 : -1;
    const tx = Math.max(40, Math.min(room.world.pxW - 40, p.cx + side * 60));
    const ty = gy - 58 - this.b.h + Math.sin(room.time * 0.05) * 8;
    this.b.vx = Math.max(-1.8, Math.min(1.8, (tx - this.cx) * 0.04));
    this.b.vy = Math.max(-1.6, Math.min(1.6, (ty - this.b.y) * 0.05));
    this.anim = Math.abs(this.b.vx) > 0.4 ? 'move' : 'idle';
  }

  /**
   * 분열 보스: 완전체(마지막 페이즈)가 쓰러지면 죽는 대신 별도의 페이즈(patterns 마지막 목록)로 되살아나 둘로 갈라진다.
   * 본체·분열체 모두 원래 최대 체력의 50%. room.killEnemy가 부르며, true면 처치를 취소한다.
   */
  reborn(room: Room): boolean {
    if (!this.bd.split || this.splitDone || this.twin) return false;
    this.splitDone = true;
    this.splitPending = true;
    this.phase = this.bd.patterns.length - 1;
    this.bd = { ...this.bd, phases: [] };
    this.maxHp = this.hp = Math.round(this.maxHp * 0.5);
    this.phaseT = 130;
    this.pattern = '';
    this.subs = [];
    this.landMark?.end();
    this.landMark = null;
    this.b.vx = 0;
    this.execCd = 300;
    audio.play('phase');
    room.cam.shake(10, 60);
    room.flash('#ffffff', 0.9);
    room.hitstop = Math.max(room.hitstop, 24);
    room.fx.burst(this.cx, this.cy, this.bd.col, 60, 4);
    room.bossPhaseBanner(this.phase);
    room.bossShout(`완전체가 무너졌다… 그러나 ${this.bd.name.split(' ').pop()}의 몸이 갈라지기 시작한다!`, this.bd.col);
    return true;
  }

  /** 4페이즈 분열: 본체와 같은 체력(원래의 50%)·공격력 70%의 분열체 (즉사기 없음, 동시 패턴 2개) */
  private doSplit(room: Room): void {
    const W = room.world.pxW;
    const x = Math.max(40, Math.min(W - 40, this.cx + (this.cx < W / 2 ? 140 : -140)));
    const gy = room.world.groundBelow(x, this.b.y);
    const tw = new Boss(this.bd.id, x, gy, 0);
    tw.bd = { ...this.bd, name: `${this.bd.name}의 분열체`, phases: [], patterns: [this.bd.patterns[this.phase].filter((p) => !EXECUTE.has(p))], multi: [2], split: undefined };
    tw.twin = true;
    tw.splitDone = true;
    tw.name = tw.bd.name;
    tw.maxHp = tw.hp = this.maxHp;
    tw.atk = Math.round(this.atk * 0.7);
    tw.intro = 70;
    tw.idleT = 60;
    tw.facing = -this.facing;
    room.enemies.push(tw);
    room.bossShout(`${this.bd.name.split(' ').pop()}의 몸이 둘로 갈라졌다! 두 몸을 모두 쓰러뜨려라!`, this.bd.col);
    room.fx.burst(this.cx, this.cy, this.bd.col, 40, 4);
    room.fx.burst(x, gy - 20, this.bd.col, 40, 4);
    room.flash(this.bd.col, 0.5);
    audio.play('boss_roar', 1.2);
  }

  /** 보조 패턴 진행: 몸 상태를 저장했다가 되돌려 주 패턴의 동작·예고와 섞이지 않게 한다 */
  private runSubs(room: Room): void {
    if (!this.subs.length) return;
    const keep = { pose: this.pose, anim: this.anim, state: this.state, vx: this.b.vx, facing: this.facing };
    this.asSub = true;
    this.subs = this.subs.filter((s) => !this.runPattern(room, s.name, ++s.t));
    this.asSub = false;
    this.pose = keep.pose;
    this.anim = keep.anim;
    this.state = keep.state;
    this.b.vx = keep.vx;
    this.facing = keep.facing;
  }

  /** 범용 패턴 속성 (스토리 2~4 보스). 원래 보스는 기본값 */
  private get E(): BossElem {
    return this.bd.elem ?? { col: this.bd.col, vis: 'void', drop: 'blade', proj: 'orb' };
  }

  /** 기존 패턴의 고유 색 — 새 보스가 쓰면 그 보스의 색으로 */
  private ec(def: string): string {
    return this.bd.elem?.col ?? def;
  }

  /** 판정 직전 예고 구간: t < until 동안 빨간 번쩍임(state 'wind'). 판정 프레임(until)부터 꺼진다. */
  private wind(t: number, until: number): boolean {
    if (t < until) {
      this.anim = 'wind';
      this.tele(true);
      return true;
    }
    this.tele(false);
    return false;
  }

  private tele(on: boolean): void {
    if (this.asSub) return;
    this.state = on ? 'wind' : 'atk';
  }

  /** 점프·순간이동 착지 지점 예고: 착지(판정) 순간에 끈다 */
  private markLanding(room: Room, x: number, w: number): void {
    this.landMark?.end();
    const gy = room.world.groundBelow(x, room.player.b.y);
    this.landMark = room.marker(x - w / 2, gy - 4, w, 4, 200, '#ff3030');
  }

  private landed(): void {
    this.landMark?.end();
    this.landMark = null;
  }

  private ground(room: Room): number {
    return room.world.groundBelow(this.cx, this.b.y + this.b.h - 4);
  }

  private wave(room: Room, dirs: number[], col: string, spd = 3.4, h = 20, st?: StatusId): void {
    for (const dir of dirs) room.addProj('enemy', { spr: 'wave', spd, life: 120, w: 12, h, col, ground: true, pierce: 99, st }, this.cx + dir * 10, this.b.y + this.b.h - h / 2, dir > 0 ? 0 : Math.PI, Math.round(this.atk * 0.8), 'normal');
  }

  private skyDrop(room: Room, x: number, delay: number, spr: BossElem['drop'], col: string, dmgMul = 0.7, st?: StatusId): void {
    const gy = room.world.groundBelow(x, 40);
    // 낙하 시간만큼 먼저 떨어뜨려, 예고가 꺼지는 순간 바닥에 닿게 한다
    const fall = Math.max(1, Math.round((gy - 24) / 6));
    const dur = Math.max(delay, fall + 1);
    room.marker(x - 6, gy - 4, 12, 4, dur, '#ff3030');
    room.enemyLater(dur - fall, () => {
      room.addProj('enemy', { spr, spd: 6, life: 80, w: spr === 'rock' ? 14 : 8, h: spr === 'rock' ? 14 : 12, col, st, landY: gy - 2 }, x, 24, Math.PI / 2, Math.round(this.atk * dmgMul), 'normal');
    });
  }

  private pillar(room: Room, x: number, delay: number, vis: FieldVis, w = 22, h = 110, st?: StatusId): void {
    const gy = room.world.groundBelow(x, 60);
    room.marker(x - w / 2, gy - h, w, h, delay, '#ff3030', true);
    room.enemyLater(delay, () => {
      room.addField('enemy', { vis, w, h, life: 34, tick: 12, m: 1, st }, x - w / 2, gy - h, Math.round(this.atk * 0.9), 'normal');
      room.fx.burst(x, gy - 4, this.bd.elem?.col ?? (vis === 'fire' ? '#ff8a2a' : vis === 'holy' ? '#ffe080' : vis === 'poison' ? '#8bdc3a' : vis === 'ice' ? '#d0f4ff' : '#9a6bff'), 14, 3);
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
          this.wave(room, [-1, 1], this.ec('#80e0ff'));
          room.cam.shake(6);
          audio.play('hit_power', 0.6);
          room.fx.dust(this.cx + this.facing * 30, this.b.y + this.b.h, 14);
        }
        if (p2 && t === 90) this.wave(room, [-1, 1], this.ec('#80e0ff'), 4.5);
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
          for (let i = 0; i < (p2 ? 6 : 3); i++) this.skyDrop(room, 40 + Math.random() * (room.world.pxW - 80), 40 + i * 6, this.bd.elem?.drop ?? 'bone', this.ec('#e8e0c8'));
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
          this.tele(true);
          return false;
        }
        if (t === 24) {
          this.b.vy = -8;
          this.b.vx = (p.cx - this.cx) / 52;
          this.pose = 'jump';
          this.markLanding(room, p.cx, 120);
          audio.play('jump', 0.4);
        }
        if (t > 30 && this.b.onGround) {
          this.landed();
          this.b.vx = 0;
          this.pose = 'slam';
          room.enemyExplode(this.cx, this.b.y + this.b.h - 10, 60, this.atk * 1.2);
          this.wave(room, [-1, 1], this.ec('#80e0ff'), 4);
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
            room.enemyLater(30, () => room.addField('enemy', { vis: 'poison', w: 50, h: 30, life: 220, tick: 30, m: 1, st: 'poison' }, x - 25, gy - 30, Math.round(this.atk * 0.45), 'normal'));
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
          this.tele(true);
          return false;
        }
        if (lt === 26) {
          this.b.vy = -7.5;
          this.b.vx = (p.cx - this.cx) / 48;
          this.anim = 'atk';
          this.markLanding(room, p.cx, 128);
        }
        if (lt > 30 && this.b.onGround && this.b.vx !== 0) {
          this.landed();
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
        this.tele(t < 30);
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
            const gy = room.world.groundBelow(tx, p.b.y);
            room.marker(tx - 10, gy - 4, 20, 4, T, '#8bdc3a');
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
          room.enemyLater(34, () => {
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
          this.tele(true);
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
        this.tele(t < 30 || (p2 && t >= 44 && t < 60));
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
          this.tele(true);
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
          this.tele(true);
          this.pose = k % 2 ? 'windLow' : 'windHigh';
          this.b.vx = 0;
          return false;
        }
        if (lt === 18) {
          this.anim = 'atk';
          this.pose = k % 2 ? 'slashUp' : 'slashDown';
          this.b.vx = this.facing * 4;
          room.enemyHit({ x: this.facing > 0 ? this.cx : this.cx - 64, y: this.b.y - 4, w: 64, h: this.b.h + 4 }, this.atk, this.cx, this.name);
          room.fx.slash(this.cx, this.cy, this.facing, { arc: k % 2 ? 'up' : 'down', r: 40 }, this.ec('#c8a8ff'));
          audio.play('swing_heavy', 0.8);
          if (k === n - 1) this.wave(room, [this.facing], this.ec('#c8a8ff'), 4.5, 26);
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
            room.enemyLater(40 + i * 5, () => {
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
          room.fx.burst(this.cx, this.cy, this.ec('#9a6bff'), 20, 3);
          audio.play('dash', 0.8);
          this.flash = 0;
        }
        this.tele(true); // 사라진 뒤 내려찍어 착지할 때까지 예고
        if (t < 30) {
          this.anim = 'wind';
          this.pose = 'dash';
          const gy = room.world.groundBelow(p.cx, p.b.y);
          if (t === 2) {
            this.aim = { x: p.cx, y: gy };
            this.markLanding(room, p.cx, 112);
          }
          return false;
        }
        if (t === 30) {
          this.b.x = this.aim.x - this.b.w / 2;
          this.b.y = this.aim.y - this.b.h - 80;
          this.b.vy = 9;
          this.pose = 'slam';
          room.fx.burst(this.cx, this.cy, this.ec('#9a6bff'), 20, 3);
        }
        if (t > 30 && this.b.onGround) {
          this.landed();
          this.tele(false);
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
        this.tele(t < 40 || (this.phase >= 2 && t >= 60 && t < 75));
        if (t === 1) audio.play('warn');
        if (t === 40) {
          this.wave(room, [-1, 1], '#9a6bff', 3, 40);
          room.cam.shake(6);
          audio.play('explode', 0.8);
        }
        if (this.phase >= 2 && t === 75) this.wave(room, [-1, 1], '#9a6bff', 3.8, 30);
        return t > 95;
      }
      // ─────────── 범용 패턴 (스토리 2~4 보스, 속성은 bd.elem) ───────────
      case 'starfall': {
        const E = this.E;
        this.pose = 'castUp';
        this.anim = 'wind';
        if (t === 1) audio.play('cast', 0.6);
        const n = p2 ? 14 : 9;
        if (t <= n * 6 && t % 6 === 0) this.skyDrop(room, t % 18 === 0 ? p.cx : 30 + Math.random() * (room.world.pxW - 60), 44, E.drop, E.col, 0.75, E.st);
        return t > n * 6 + 50;
      }
      case 'pillarMarch': {
        // 보스 앞에서부터 기둥이 차례로 솟는다
        const E = this.E;
        this.pose = 'castUp';
        this.anim = 'wind';
        const n = p2 ? 9 : 7;
        if (t === 1) {
          this.face(room);
          audio.play('warn');
          const dirs = p2 ? [this.facing, -this.facing] : [this.facing];
          for (const dir of dirs) {
            for (let i = 0; i < n; i++) {
              const x = this.cx + dir * (30 + i * 34);
              if (x < 20 || x > room.world.pxW - 20) break;
              this.pillar(room, x, 40 + i * 7, E.vis, 22, 110, E.st);
            }
          }
        }
        return t > 40 + n * 7 + 24;
      }
      case 'radialBurst': {
        // 사방으로 퍼지는 탄막 (2페이즈: 엇갈린 두 번째 고리)
        const E = this.E;
        this.pose = t < 30 ? 'castUp' : 'cast';
        this.anim = t < 30 ? 'wind' : 'atk';
        this.tele(t < 30 || (p2 && t >= 40 && t < 55));
        if (t === 1) audio.play('warn');
        const ring = (off: number): void => {
          const n = p2 ? 16 : 12;
          for (let i = 0; i < n; i++) room.addProj('enemy', { spr: E.proj, spd: 2.4, life: 200, w: 9, h: 9, col: E.col, st: E.st }, this.cx, this.cy, off + (i / n) * Math.PI * 2, Math.round(this.atk * 0.6), 'normal');
          audio.play('cast', 0.8);
        };
        if (t === 30) ring(0);
        if (p2 && t === 55) ring(Math.PI / 16);
        return t > 80;
      }
      case 'aimedFan': {
        // 조준 부채꼴 사격 3연발, 매 사격 직전 예고
        const E = this.E;
        const n = 3;
        const cycle = 26;
        const k = Math.floor((t - 1) / cycle);
        const lt = (t - 1) % cycle;
        if (k >= n) return true;
        this.pose = lt < 14 ? 'shootWind' : 'shoot';
        this.anim = lt < 14 ? 'wind' : 'atk';
        this.tele(lt < 14);
        if (lt === 0) {
          this.face(room);
          audio.play('warn', 0.6);
        }
        if (lt === 14) {
          const base = Math.atan2(p.cy - (this.cy - 4), p.cx - this.cx);
          const m = p2 ? 7 : 5;
          for (let i = 0; i < m; i++) room.addProj('enemy', { spr: E.proj, spd: 3.6, life: 120, w: 10, h: 6, col: E.col, st: E.st }, this.cx + this.facing * 10, this.cy - 4, base + (i - (m - 1) / 2) * 0.16, Math.round(this.atk * 0.55), 'normal');
          audio.play('proj', 0.8);
        }
        return false;
      }
      case 'dashSlash': {
        // 경로가 표시된 뒤 순식간에 돌진해 벤다
        const E = this.E;
        const n = p2 ? 4 : 3;
        const cycle = 40;
        const k = Math.floor((t - 1) / cycle);
        const lt = (t - 1) % cycle;
        if (k >= n) return true;
        if (lt === 0) {
          this.face(room);
          const tx = Math.max(24, Math.min(room.world.pxW - 24, p.cx + this.facing * 50));
          this.aim = { x: tx, y: 0 };
          room.marker(Math.min(this.cx, tx) - 8, this.b.y, Math.abs(tx - this.cx) + 16, this.b.h, 30, E.col, true);
          audio.play('warn', 0.7);
        }
        if (lt < 22) {
          this.anim = 'wind';
          this.pose = 'thrustWind';
          this.tele(true);
          this.b.vx = 0;
          return false;
        }
        if (lt === 22) audio.play('dash', 0.9);
        if (lt < 30) {
          this.anim = 'atk';
          this.pose = 'thrust';
          this.b.vx = (this.aim.x - this.cx) / (30 - lt);
          this.contact(room, this.atk);
          if (lt % 2 === 0) room.fx.dust(this.cx, this.b.y + this.b.h, 2);
          return false;
        }
        if (lt === 30) {
          this.b.vx = 0;
          room.fx.slash(this.cx, this.cy, this.facing, { arc: 'h', r: 30 }, E.col);
        }
        return false;
      }
      case 'shockRing': {
        // 양옆으로 퍼지는 충격파 연속 — 점프 타이밍
        const E = this.E;
        const n = p2 ? 4 : 3;
        const cycle = 36;
        const k = Math.floor((t - 1) / cycle);
        const lt = (t - 1) % cycle;
        if (k >= n) return t > n * cycle + 20;
        this.pose = lt < 20 ? 'slamWind' : 'slam';
        this.anim = lt < 20 ? 'wind' : 'atk';
        this.tele(lt < 20);
        if (lt === 0) audio.play('warn', 0.6);
        if (lt === 20) {
          this.wave(room, [-1, 1], E.col, 3.6 + k * 0.3, 20, E.st);
          room.cam.shake(4);
          room.fx.dust(this.cx, this.b.y + this.b.h, 10);
          audio.play('hit_power', 0.5);
        }
        return false;
      }
      case 'gravityWell': {
        // 플레이어 쪽을 끌어당기는 장판 (2페이즈: 장판 중심에서 탄 방출)
        const E = this.E;
        this.pose = 'castUp';
        this.anim = 'wind';
        if (t === 1) {
          audio.play('warn');
          const x = p.cx;
          const gy = room.world.groundBelow(x, p.b.y);
          room.marker(x - 60, gy - 50, 120, 50, 40, E.col, true);
          // 위치는 지역 변수로 고정 (다른 패턴과 동시에 쓰여도 this.aim이 덮어써지지 않게)
          room.enemyLater(40, () => {
            room.addField('enemy', { vis: E.vis, w: 120, h: 50, life: 150, tick: 24, m: 1, pull: 1.6, st: E.st }, x - 60, gy - 50, Math.round(this.atk * 0.45), 'normal');
            audio.play('cast');
          });
          if (p2) room.enemyLater(80, () => {
            for (let i = 0; i < 8; i++) room.addProj('enemy', { spr: E.proj, spd: 2.2, life: 160, w: 9, h: 9, col: E.col, st: E.st }, x, gy - 25, (i / 8) * Math.PI * 2, Math.round(this.atk * 0.5), 'normal');
          });
        }
        return t > 120;
      }
      case 'cloneDash': {
        // 보스의 분신이 화면 끝에서 차례로 돌진 (경로 표시는 분신이 지나갈 때까지)
        const E = this.E;
        this.pose = 'castUp';
        this.anim = 'wind';
        if (t === 1) {
          audio.play('cast', 0.8);
          const gy = this.ground(room);
          const n = p2 ? 3 : 2;
          this.clones = [];
          for (let i = 0; i < n; i++) {
            const dir = i % 2 ? -1 : 1;
            this.clones.push({ x: dir > 0 ? -20 : room.world.pxW + 20, y: i === 2 ? gy - 60 : gy, dir, t: -i * 30, done: false, hit: false });
          }
        }
        let allDone = true;
        for (const c of this.clones) {
          c.t++;
          if (c.done) continue;
          allDone = false;
          if (c.t === 1) c.mk = room.marker(0, c.y - 24, room.world.pxW, 22, 999, E.col, true);
          if (c.t > 36) {
            c.x += c.dir * 7;
            if (!c.hit && Math.abs(room.player.cx - c.x) < 16 && Math.abs(room.player.cy - (c.y - 12)) < 20) c.hit = room.damagePlayer(Math.round(this.atk * 0.9), c.x, `${this.name}의 분신`, { kb: 4, st: E.st });
            if ((c.dir > 0 && c.x > room.world.pxW + 30) || (c.dir < 0 && c.x < -30)) {
              c.done = true;
              c.mk?.end();
            }
          }
        }
        return (allDone && t > 10) || t > 400;
      }
      case 'crossBeam': {
        // 플레이어 위치의 세로 기둥 + 가로 광선(낮게: 점프 / 높게: 엎드려 피하기)
        const E = this.E;
        this.pose = 'castUp';
        this.anim = 'wind';
        if (t === 1) {
          audio.play('warn');
          const gy = this.ground(room);
          this.pillar(room, p.cx, 50, E.vis, 26, 260, E.st);
          const hy = Math.random() < 0.5 ? gy - 16 : gy - 62;
          const w = room.world.pxW - 32;
          room.marker(16, hy, w, 14, 50, E.col, true);
          room.enemyLater(50, () => {
            room.addField('enemy', { vis: E.vis, w, h: 14, life: 30, tick: 8, m: 1, st: E.st }, 16, hy, Math.round(this.atk * 0.8), 'normal');
            room.cam.shake(4);
          });
        }
        if (p2 && t === 40) this.pillar(room, p.cx, 40, E.vis, 26, 260, E.st);
        return t > 110;
      }
      case 'homingOrbs': {
        const E = this.E;
        this.pose = 'cast';
        this.anim = 'wind';
        const waves = p2 ? 3 : 2;
        if (t % 22 === 10 && t < 22 * waves) {
          for (let i = 0; i < 4; i++) room.addProj('enemy', { spr: E.proj, spd: 1.9, life: 200, w: 8, h: 8, col: E.col, home: 0.035, st: E.st }, this.cx, this.b.y + 10, -Math.PI / 2 + (i - 1.5) * 0.7, Math.round(this.atk * 0.55), 'normal');
          audio.play('cast', 0.6);
        }
        return t > 22 * waves + 40;
      }
      case 'spikeWave': {
        // 내려찍으면 바닥 가시가 양옆으로 번져 나간다
        const E = this.E;
        const n = p2 ? 9 : 7;
        this.pose = t < 24 ? 'slamWind' : 'slam';
        this.anim = t < 24 ? 'wind' : 'atk';
        this.tele(t < 24);
        if (t === 1) {
          audio.play('warn');
          for (const dir of [-1, 1]) {
            for (let i = 1; i <= n; i++) {
              const x = this.cx + dir * i * 26;
              if (x < 16 || x > room.world.pxW - 16) break;
              const gy = room.world.groundBelow(x, this.b.y);
              const d = 24 + i * 5;
              room.marker(x - 9, gy - 4, 18, 4, d, '#ff3030');
              room.enemyLater(d, () => {
                room.enemyHit({ x: x - 9, y: gy - 40, w: 18, h: 40 }, this.atk * 0.9, x, this.name);
                room.spike(x, gy, E.col);
              });
            }
          }
        }
        if (t === 24) {
          room.cam.shake(4);
          audio.play('hit_power', 0.5);
        }
        return t > 24 + n * 5 + 20;
      }
      case 'floorHalf': {
        // 바닥의 절반이 차례로 뒤덮인다 — 반대편으로
        const E = this.E;
        this.pose = 'castUp';
        this.anim = 'wind';
        const reps = this.phase >= 2 ? 3 : 2;
        const cycle = 70;
        const k = Math.floor((t - 1) / cycle);
        const lt = (t - 1) % cycle;
        if (k >= reps) return t > reps * cycle + 10;
        if (lt === 0) {
          this.side = k === 0 ? (p.cx < room.world.pxW / 2 ? 0 : 1) : 1 - this.side;
          const gy = this.ground(room);
          const w = room.world.pxW / 2 - 16;
          const x0 = this.side === 0 ? 16 : room.world.pxW / 2;
          room.marker(x0, gy - 56, w, 56, 50, E.col, true);
          room.enemyLater(50, () => {
            room.addField('enemy', { vis: E.vis, w, h: 56, life: 24, tick: 8, m: 1, st: E.st }, x0, gy - 56, Math.round(this.atk * 0.9), 'normal');
            audio.play('explode', 0.9);
          });
          audio.play('warn');
        }
        return false;
      }
      case 'laserSweep': {
        // 높이가 다른 가로 광선이 차례로
        const E = this.E;
        this.pose = 'thrustWind';
        this.anim = 'wind';
        const n = p2 ? 3 : 2;
        if (t === 1) {
          audio.play('warn');
          const gy = this.ground(room);
          const ys = [gy - 16, gy - 50, gy - 90].sort(() => Math.random() - 0.5);
          const w = room.world.pxW - 32;
          for (let i = 0; i < n; i++) {
            const y = ys[i];
            const d = 40 + i * 30;
            room.marker(16, y, w, 12, d, E.col, true);
            room.enemyLater(d, () => {
              room.addField('enemy', { vis: E.vis, w, h: 12, life: 24, tick: 8, m: 1, st: E.st }, 16, y, Math.round(this.atk * 0.8), 'normal');
              audio.play('explode', 1.3);
              room.cam.shake(3);
            });
          }
        }
        return t > 40 + n * 30 + 20;
      }
      case 'meteor': {
        // 거대한 운석 하나 — 넓은 범위, 예고가 끝나는 순간 폭발
        const E = this.E;
        this.pose = 'castUp';
        this.anim = 'wind';
        const T = 80;
        if (t === 1) {
          room.bossShout('하늘이 무너진다!', E.col);
          audio.play('warn');
          const x = p.cx;
          const gy = room.world.groundBelow(x, p.b.y);
          room.marker(x - 70, gy - 70, 140, 70, T, E.col, true);
          // 위치는 지역 변수로 고정 (다른 패턴과 동시에 쓰여도 this.aim이 덮어써지지 않게)
          for (let i = 1; i < 16; i++) {
            const k = (16 - i) / 16;
            room.enemyLater(T - 16 + i, () => room.fx.parts.push({ x: x + k * 60, y: gy - 40 - k * 200, vx: 0, vy: 0, life: 0, max: 6, col: E.col, size: 6, grav: 0, kind: 'px', drag: 1 }));
          }
          room.enemyLater(T, () => {
            room.enemyExplode(x, gy - 20, 70, this.atk * 1.6, E.st);
            room.fx.burst(x, gy - 10, E.col, 40, 5);
            room.flash(E.col, 0.5);
            room.cam.shake(10, 30);
            audio.play('explode', 0.6);
          });
        }
        return t > T + 30;
      }
      case 'summon': {
        this.pose = 'castUp';
        this.anim = 'wind';
        if (t === 20) room.spawnMinions(this, p2 ? 3 : 2);
        return t > 50;
      }
      // ─────────── 즉사기 ───────────
      case 'royalExecution': {
        // 왕의 참수: 바닥 높이를 가로지르는 칼날. 판정 순간 땅에 서 있으면 즉사 — 점프하거나 발판 위로.
        const T = 110;
        const gy = this.ground(room);
        this.pose = t < T ? 'windHigh' : 'slashDown';
        this.anim = t < T ? 'wind' : 'atk';
        this.b.vx = 0;
        this.tele(t < T);
        if (t === 1) {
          this.face(room);
          room.bossShout(this.bd.id === 'king' ? '무릎 꿇어라. 왕의 참수다! — 뛰어올라라!' : '왕의 칼은 이제 나의 것… — 뛰어올라라!', '#ff4060');
          audio.play('boss_roar', 0.9);
          room.marker(16, gy - 30, room.world.pxW - 32, 30, T, '#ff2040', true);
        }
        if (t === T - 60 || t === T - 40 || t === T - 20) {
          room.toastWorld(room.player.cx, room.player.b.y - 16, `${(T - t) / 20}`, '#ff4060');
          audio.play('warn');
        }
        if (t === T) {
          for (let x = 40; x < room.world.pxW; x += 80) room.fx.slash(x, gy - 15, this.facing, { arc: 'h', r: 44 }, '#ff4060');
          room.flash('#ff4060', 0.6);
          room.cam.shake(10, 30);
          audio.play('swing_heavy', 1.4);
          const pl = room.player;
          if (pl.b.y + pl.b.h > gy - 30) room.instantKill('왕의 참수');
        }
        return t > T + 30;
      }
      case 'oblivionErase': {
        // 망각의 선고: 화면 전체가 지워진다. 「기억의 빛」 안에 있어야만 살아남는다.
        const T = 130;
        this.pose = 'castUp';
        this.anim = 'wind';
        this.b.vx = 0;
        this.tele(t < T);
        if (t === 1) {
          room.bossShout('모든 기억은 지워진다… 빛을 붙잡아라.', '#ff80d0');
          audio.play('boss_roar', 0.7);
          const n = this.phase >= 2 ? 1 : 2;
          this.safe = [];
          for (let i = 0; i < n; i++) {
            const x = 60 + Math.random() * (room.world.pxW - 120);
            const gy = room.world.groundBelow(x, 60);
            this.safe.push({ x, y: gy });
            room.marker(x - 22, gy - 60, 44, 60, T, '#fff0a0', true);
          }
          room.marker(0, 0, room.world.pxW, room.world.pxH, T, '#ff80d0', true);
        }
        if (t === T - 60 || t === T - 40 || t === T - 20) {
          room.toastWorld(room.player.cx, room.player.b.y - 16, `${(T - t) / 20}`, '#ff80d0');
          audio.play('warn');
        }
        if (t === T) {
          room.flash('#ffffff', 1);
          room.cam.shake(10, 40);
          audio.play('explode', 1.6);
          const pl = room.player;
          const ok = this.safe.some((z) => Math.abs(pl.cx - z.x) <= 22 && pl.b.y + pl.b.h > z.y - 60 && pl.b.y < z.y);
          if (!ok) room.instantKill('망각의 선고');
          for (const z of this.safe) room.fx.burst(z.x, z.y - 30, '#fff0a0', 24, 3);
        }
        return t > T + 30;
      }
      case 'execGround': {
        const X = EXEC_TXT[this.bd.id] ?? { name: '처형', shout: '뛰어올라라!', col: '#ff4060' };
        const T = 110;
        const gy = this.ground(room);
        this.pose = t < T ? 'windHigh' : 'slam';
        this.anim = t < T ? 'wind' : 'atk';
        this.b.vx = 0;
        this.tele(t < T);
        if (t === 1) {
          this.face(room);
          room.bossShout(X.shout, X.col);
          audio.play('boss_roar', 0.9);
          room.marker(16, gy - 30, room.world.pxW - 32, 30, T, X.col, true);
        }
        if (t === T - 60 || t === T - 40 || t === T - 20) {
          room.toastWorld(room.player.cx, room.player.b.y - 16, `${(T - t) / 20}`, X.col);
          audio.play('warn');
        }
        if (t === T) {
          for (let x = 40; x < room.world.pxW; x += 80) room.fx.slash(x, gy - 15, this.facing, { arc: 'h', r: 44 }, X.col);
          room.flash(X.col, 0.6);
          room.cam.shake(10, 30);
          audio.play('explode', 1.2);
          const pl = room.player;
          if (pl.b.y + pl.b.h > gy - 30) room.instantKill(X.name);
        }
        return t > T + 30;
      }
      case 'execZones': {
        const X = EXEC_TXT[this.bd.id] ?? { name: '소멸', shout: '빛 안으로!', col: '#ff80d0' };
        const T = 130;
        this.pose = 'castUp';
        this.anim = 'wind';
        this.b.vx = 0;
        this.tele(t < T);
        if (t === 1) {
          room.bossShout(X.shout, X.col);
          audio.play('boss_roar', 0.7);
          const n = this.phase >= 2 ? 1 : 2;
          this.safe = [];
          for (let i = 0; i < n; i++) {
            const x = 60 + Math.random() * (room.world.pxW - 120);
            const gy = room.world.groundBelow(x, 60);
            this.safe.push({ x, y: gy });
            room.marker(x - 22, gy - 60, 44, 60, T, '#fff0a0', true);
          }
          room.marker(0, 0, room.world.pxW, room.world.pxH, T, X.col, true);
        }
        if (t === T - 60 || t === T - 40 || t === T - 20) {
          room.toastWorld(room.player.cx, room.player.b.y - 16, `${(T - t) / 20}`, X.col);
          audio.play('warn');
        }
        if (t === T) {
          room.flash('#ffffff', 1);
          room.cam.shake(10, 40);
          audio.play('explode', 1.6);
          const pl = room.player;
          const ok = this.safe.some((z) => Math.abs(pl.cx - z.x) <= 22 && pl.b.y + pl.b.h > z.y - 60 && pl.b.y < z.y);
          if (!ok) room.instantKill(X.name);
          for (const z of this.safe) room.fx.burst(z.x, z.y - 30, '#fff0a0', 24, 3);
        }
        return t > T + 30;
      }
      case 'execHalf': {
        const X = EXEC_TXT[this.bd.id] ?? { name: '절단', shout: '반대편으로!', col: '#ff4060' };
        const T = 120;
        const W = room.world.pxW;
        this.pose = 'castUp';
        this.anim = 'wind';
        this.b.vx = 0;
        this.tele(t < T);
        if (t === 1) {
          // 플레이어가 있는 쪽 절반이 지워진다 → 반대편으로 건너가야 산다
          this.halfLeft = room.player.cx < W / 2;
          room.bossShout(X.shout, X.col);
          audio.play('boss_roar', 0.8);
          room.marker(this.halfLeft ? 0 : W / 2, 0, W / 2, room.world.pxH, T, X.col, true);
        }
        if (t === T - 60 || t === T - 40 || t === T - 20) {
          room.toastWorld(room.player.cx, room.player.b.y - 16, `${(T - t) / 20}`, X.col);
          audio.play('warn');
        }
        if (t === T) {
          room.flash(X.col, 0.8);
          room.cam.shake(10, 35);
          audio.play('explode', 1.4);
          for (let x = this.halfLeft ? 20 : W / 2 + 20; x < (this.halfLeft ? W / 2 : W); x += 40) room.fx.burst(x, room.player.cy, X.col, 6, 3);
          const pl = room.player;
          if (this.halfLeft ? pl.cx < W / 2 : pl.cx >= W / 2) room.instantKill(X.name);
        }
        return t > T + 30;
      }
      // ─────────── 스토리 5~6 범용 패턴 (속성은 bd.elem) ───────────
      case 'diveBomb': {
        // 비행 보스: 착지 지점 예고 → 급강하 폭발(예고가 꺼지는 순간) → 잠시 땅에 머문다(공격 기회) → 다시 떠오른다
        const E = this.E;
        const A = this.air;
        const D = p2 ? 40 : 46;
        if (t === 1) {
          this.face(room);
          audio.play('warn');
          A.tx = Math.max(40, Math.min(room.world.pxW - 40, p.cx));
          A.ty = this.floorY(room, A.tx);
          room.marker(A.tx - 52, A.ty - 4, 104, 4, D, '#ff3030');
        }
        if (t < D) {
          this.anim = 'wind';
          this.tele(true);
          this.b.vx = 0;
          if (t < D - 12) {
            this.pose = 'crouch';
            this.b.vy = -0.6;
            A.x = this.b.x;
            A.y = this.b.y;
          } else {
            this.pose = 'dash';
            const k = (t - (D - 12) + 1) / 13;
            this.b.x = A.x + (A.tx - this.b.w / 2 - A.x) * k;
            this.b.y = A.y + (A.ty - this.b.h - A.y) * k;
            this.b.vy = 0;
          }
          return false;
        }
        if (t === D) {
          this.b.x = A.tx - this.b.w / 2;
          this.b.y = A.ty - this.b.h;
          this.tele(false);
          this.anim = 'atk';
          room.enemyExplode(A.tx, A.ty - 12, 52, this.atk * 1.2, E.st);
          this.wave(room, [-1, 1], E.col, 3.8, 18, E.st);
          room.cam.shake(8);
          room.fx.dust(A.tx, A.ty, 20);
          audio.play('explode', 0.8);
        }
        // 땅에 잠시 머문다 — 공격 기회
        this.b.vx = 0;
        this.b.vy = 0;
        this.pose = t < D + 40 ? 'slam' : 'idle0';
        return t > D + 60;
      }
      case 'swoop': {
        // 비행 보스: 화면 끝으로 순간이동한 뒤 바닥 높이로 낮게 가로질러 활강한다 — 뛰어넘기
        const E = this.E;
        const A = this.air;
        const W = room.world.pxW;
        if (t === 1) {
          audio.play('warn');
          room.fx.burst(this.cx, this.cy, E.col, 20, 3);
          A.dir = p.cx > W / 2 ? 1 : -1; // 플레이어 반대편 끝에서 출발
          A.ty = this.floorY(room, A.dir > 0 ? 30 : W - 30);
          this.b.x = (A.dir > 0 ? 30 : W - 30) - this.b.w / 2;
          this.b.y = A.ty - this.b.h - 2;
          this.b.vy = 0;
          A.hit = false;
          // 활강 경로는 보스가 다 지나갈 때까지 표시 (페이즈 전환·패턴 종료 시 함께 꺼진다)
          this.landMark?.end();
          this.landMark = room.marker(16, A.ty - 30, W - 32, 30, 999, E.col, true);
          room.fx.burst(this.cx, this.cy, E.col, 20, 3);
        }
        this.facing = A.dir;
        if (t < 36) {
          this.anim = 'wind';
          this.pose = 'thrustWind';
          this.tele(true);
          this.b.vx = 0;
          this.b.vy = 0;
          return false;
        }
        this.tele(false);
        this.anim = 'atk';
        this.pose = 'dash';
        this.b.vx = A.dir * 7.5;
        this.b.vy = 0;
        if (t === 36) audio.play('dash', 0.8);
        if (!A.hit && Math.abs(p.cx - this.cx) < 18 && p.b.y + p.b.h > A.ty - 30) A.hit = room.damagePlayer(Math.round(this.atk * 1.1), this.cx, this.name, { kb: 4, st: E.st });
        if (t % 2 === 0) room.fx.dust(this.cx, A.ty, 2);
        if ((A.dir > 0 && this.cx > W - 44) || (A.dir < 0 && this.cx < 44) || t > 200) {
          this.landed();
          this.b.vx = 0;
          return true;
        }
        return false;
      }
      case 'galeWaves': {
        // 화면 양 끝에서 바닥을 타고 밀려오는 돌풍 — 낮은 것과 높은 것이 번갈아
        const E = this.E;
        const n = p2 ? 3 : 2;
        const cyc = 40;
        this.pose = 'castUp';
        this.anim = 'wind';
        const k = Math.floor((t - 1) / cyc);
        if (k < n && (t - 1) % cyc === 0) {
          audio.play('warn', 0.6);
          const W = room.world.pxW;
          const h = k % 2 ? 34 : 18;
          for (const dir of [1, -1]) {
            const x = dir > 0 ? 26 : W - 26;
            const gy = this.floorY(room, x);
            room.marker(x - 8, gy - h, 16, h, 30, E.col, true);
            room.enemyLater(30, () => room.addProj('enemy', { spr: 'wave', spd: 3, life: 260, w: 12, h, col: E.col, ground: true, pierce: 99, st: E.st }, x, gy - h / 2, dir > 0 ? 0 : Math.PI, Math.round(this.atk * 0.7), 'normal'));
          }
        }
        return t > n * cyc + 30;
      }
      case 'floorSweep': {
        // 바닥 전체를 한쪽 끝에서 반대편 끝까지 쓸고 지나가는 띠 — 다가올 때 뛰어넘기 (2페이즈: 되돌아온다)
        const E = this.E;
        const W = room.world.pxW;
        const sw = 32;
        const n = Math.ceil((W - 32) / sw);
        const reps = p2 ? 2 : 1;
        const gap = n * 3 + 30;
        const L = 34;
        this.pose = 'castUp';
        this.anim = 'wind';
        if (t === 1) {
          audio.play('warn');
          this.sweepL = p.cx > W / 2; // 플레이어 반대편에서 시작
        }
        for (let r = 0; r < reps; r++) {
          const i = (t - 1 - r * gap) / 3;
          if (i < 0 || i >= n || !Number.isInteger(i)) continue;
          const fromLeft = r % 2 === 0 ? this.sweepL : !this.sweepL;
          const x = fromLeft ? 16 + i * sw : W - 16 - (i + 1) * sw;
          const w = Math.min(sw, W - 16 - x);
          const gy = this.floorY(room, x + w / 2);
          room.marker(x, gy - 24, w, 24, L, E.col, true);
          room.enemyLater(L, () => {
            room.addField('enemy', { vis: E.vis, w, h: 24, life: 8, tick: 8, m: 1, st: E.st }, x, gy - 24, Math.round(this.atk * 0.8), 'normal');
            if (i % 4 === 0) audio.play('explode', 1.5);
          });
        }
        return t > (reps - 1) * gap + n * 3 + L + 12;
      }
      case 'checkerFloor': {
        // 바닥이 체스판처럼 번갈아 터진다 — 한 칸 옆으로 (3페이즈: 한 번 더)
        const E = this.E;
        const W = room.world.pxW;
        const cw = 48;
        const n = Math.ceil((W - 32) / cw);
        const waves = this.phase >= 2 ? 3 : 2;
        const starts = [1, 51, 95];
        const durs = [50, 44, 40];
        this.pose = 'castUp';
        this.anim = 'wind';
        for (let k = 0; k < waves; k++) {
          if (t !== starts[k]) continue;
          audio.play('warn', 0.7);
          for (let i = k % 2; i < n; i += 2) {
            const x = 16 + i * cw;
            const w = Math.min(cw, W - 16 - x);
            const gy = this.floorY(room, x + w / 2);
            room.marker(x, gy - 40, w, 40, durs[k], E.col, true);
            room.enemyLater(durs[k], () => {
              room.addField('enemy', { vis: E.vis, w, h: 40, life: 14, tick: 14, m: 1, st: E.st }, x, gy - 40, Math.round(this.atk * 0.85), 'normal');
              if (i < 2) {
                audio.play('explode', 1);
                room.cam.shake(3);
              }
            });
          }
        }
        return t > starts[waves - 1] + durs[waves - 1] + 20;
      }
      case 'beamGrid': {
        // 세로 기둥 격자 + 가로 광선 — 기둥 사이에서 광선 높이에 맞춰 (낮으면 점프, 높으면 그대로)
        const E = this.E;
        const W = room.world.pxW;
        const D = 56;
        const sets = p2 ? 2 : 1;
        this.pose = 'castUp';
        this.anim = 'wind';
        for (let k = 0; k < sets; k++) {
          if (t !== 1 + k * 44) continue;
          audio.play('warn');
          const off = 40 + Math.random() * 60 + k * 56;
          for (let x = off; x < W - 20; x += 112) this.pillar(room, x, D, E.vis, 24, 240, E.st);
          const gy = this.floorY(room, W / 2);
          const hy = Math.random() < 0.5 ? gy - 62 : gy - 16;
          room.marker(16, hy, W - 32, 12, D, E.col, true);
          room.enemyLater(D, () => {
            room.addField('enemy', { vis: E.vis, w: W - 32, h: 12, life: 24, tick: 8, m: 1, st: E.st }, 16, hy, Math.round(this.atk * 0.8), 'normal');
            room.cam.shake(3);
          });
        }
        return t > 1 + (sets - 1) * 44 + D + 20;
      }
      case 'skyCurtain': {
        // 화면 전체에 쏟아지는 낙하물의 장막 — 비어 있는 틈으로 (2페이즈: 틈이 다른 두 번째 장막)
        const E = this.E;
        const W = room.world.pxW;
        const sets = p2 ? 2 : 1;
        this.pose = 'castUp';
        this.anim = 'wind';
        for (let k = 0; k < sets; k++) {
          if (t !== 1 + k * 60) continue;
          audio.play('warn', 0.7);
          const gap = 60 + Math.random() * (W - 190);
          let i = 0;
          for (let x = 26; x < W - 20; x += 18) {
            if (x > gap && x < gap + 70) continue;
            this.skyDrop(room, x, 52 + (i++ % 3) * 4, E.drop, E.col, 0.7, E.st);
          }
        }
        return t > 1 + (sets - 1) * 60 + 80;
      }
      case 'bladeHalo': {
        // 머리 위에 떠오른 탄이 차례로 플레이어를 향해 날아온다
        const E = this.E;
        this.pose = 'castUp';
        this.anim = 'wind';
        const n = p2 ? 9 : 6;
        if (t === 1) {
          audio.play('cast', 0.6);
          for (let i = 0; i < n; i++) {
            const bx = this.cx + (i - (n - 1) / 2) * 24;
            const by = this.b.y - 28 - Math.abs(i - (n - 1) / 2) * 6;
            room.marker(bx - 3, by - 3, 6, 6, 38 + i * 5, E.col);
            room.enemyLater(38 + i * 5, () => {
              const a = Math.atan2(room.player.cy - by, room.player.cx - bx);
              room.addProj('enemy', { spr: E.proj, spd: 4.6, life: 100, w: 10, h: 8, col: E.col, st: E.st }, bx, by, a, Math.round(this.atk * 0.65), 'normal');
              audio.play('proj', 0.5);
            });
          }
        }
        return t > 38 + n * 5 + 20;
      }
      // ─────────── 스토리 5~6 즉사기 ───────────
      case 'eclipseDive': {
        // 비행 보스: 높이 솟아올라 플레이어를 따라다니는 그림자 기둥 → 기둥 고정 → 그 기둥으로 내리꽂힌다. 기둥 안에 있으면 즉사.
        const X = EXEC56[this.bd.id] ?? { name: '낙하', shout: '그림자에서 벗어나라!', col: '#ff4060' };
        const A = this.air;
        const W = room.world.pxW;
        const T = 120;
        const L = 75;
        const hw = 40;
        this.b.vx = 0;
        this.tele(t < T);
        this.anim = t < T ? 'wind' : 'atk';
        this.pose = t < T ? 'castUp' : 'slam';
        if (t === 1) {
          room.bossShout(X.shout, X.col);
          audio.play('boss_roar', 0.9);
        }
        if (t < L) {
          A.tx = Math.max(16 + hw, Math.min(W - 16 - hw, p.cx));
          A.ty = this.floorY(room, A.tx);
          room.marker(A.tx - hw, 16, hw * 2, A.ty - 16, 2, '#ff2040'); // 따라다니는 그림자 (테두리)
        }
        if (t === L) {
          room.marker(A.tx - hw, 16, hw * 2, A.ty - 16, T - L, '#ff2040', true);
          audio.play('warn');
        }
        if (t < T) {
          this.b.vy = Math.max(-3, (24 - this.b.y) * 0.1); // 천장 가까이 솟아오른다
          this.b.x += (A.tx - this.cx) * (t < L ? 0.12 : 0.3);
        }
        if (t === T - 45 || t === T - 30 || t === T - 15) {
          room.toastWorld(room.player.cx, room.player.b.y - 16, `${(T - t) / 15}`, X.col);
          audio.play('warn');
        }
        if (t === T) {
          this.b.x = A.tx - this.b.w / 2;
          this.b.y = A.ty - this.b.h;
          room.flash(X.col, 0.7);
          room.cam.shake(12, 35);
          audio.play('explode', 0.7);
          for (let y = 30; y < A.ty; y += 30) room.fx.burst(A.tx, y, X.col, 6, 3);
          room.fx.dust(A.tx, A.ty, 24);
          const pl = room.player;
          if (pl.b.x < A.tx + hw && pl.b.x + pl.b.w > A.tx - hw) room.instantKill(X.name);
        }
        if (t >= T) this.b.vy = 0; // 내리꽂힌 뒤 잠시 땅에 머문다 — 공격 기회
        return t > T + 50;
      }
      case 'worldSever': {
        // 세계를 가로로 베어 낸다 — 땅 위에 서 있지 않으면(점프 중·발판 위) 즉사. 땅에 붙어 있어라.
        const X = EXEC56[this.bd.id] ?? { name: '절단', shout: '땅에 엎드려라!', col: '#ff4060' };
        const A = this.air;
        const W = room.world.pxW;
        const T = 120;
        this.pose = t < T ? 'windHigh' : 'slashDown';
        this.anim = t < T ? 'wind' : 'atk';
        this.b.vx = 0;
        this.tele(t < T);
        if (t === 1) {
          this.face(room);
          A.ty = this.floorY(room, W / 2);
          room.bossShout(X.shout, X.col);
          audio.play('boss_roar', 0.9);
          room.marker(16, 16, W - 32, A.ty - 24 - 16, T, '#ff2040', true);
        }
        if (t === T - 60 || t === T - 40 || t === T - 20) {
          room.toastWorld(room.player.cx, room.player.b.y - 16, `${(T - t) / 20}`, X.col);
          audio.play('warn');
        }
        if (t === T) {
          for (let y = 44; y < A.ty - 30; y += 44) for (let x = 60; x < W; x += 140) room.fx.slash(x, y, this.facing, { arc: 'h', r: 50 }, X.col);
          room.flash(X.col, 0.7);
          room.cam.shake(10, 30);
          audio.play('swing_heavy', 1.2);
          const pl = room.player;
          if (pl.b.y + pl.b.h < A.ty - 3) room.instantKill(X.name);
        }
        return t > T + 30;
      }
      // ─────────── 모르텐 ───────────
      case 'harpoonVolley': {
        const n = p2 ? 5 : 3;
        this.pose = 'throw';
        this.anim = 'wind';
        // 매 투척 직전 10프레임 예고
        this.tele(t < 20 || (t > 20 && (t - 20) % 14 >= 4 && (t - 20) / 14 < n - 1));
        if (t === 1) audio.play('warn');
        if (t >= 20 && (t - 20) % 14 === 0 && (t - 20) / 14 < n) {
          this.face(room);
          const a = Math.atan2(p.cy - (this.b.y + 16), p.cx - this.cx);
          room.addProj('enemy', { spr: 'spear', spd: 5.5, life: 100, w: 18, h: 4, col: '#c0d8e0' }, this.cx + this.facing * 14, this.b.y + 16, a, Math.round(this.atk * 0.8), 'normal');
          audio.play('arrow', 0.7);
        }
        return t > 20 + n * 14 + 20;
      }
      case 'tidalWave': {
        this.pose = t < 36 ? 'slamWind' : 'slam';
        this.anim = t < 36 ? 'wind' : 'atk';
        this.tele(t < 36 || (p2 && t >= 56 && t < 70));
        if (t === 1) {
          audio.play('warn');
          room.bossShout('파도가 덮쳐온다! 뛰어넘어라!', '#80d0ff');
        }
        if (t === 36) {
          this.wave(room, [-1, 1], '#80d0ff', 3.2, 34);
          room.cam.shake(6);
          audio.play('explode', 0.7);
        }
        if (p2 && t === 70) this.wave(room, [-1, 1], '#80d0ff', 4, 24);
        return t > 95;
      }
      case 'summonCrew': {
        this.pose = 'castUp';
        this.anim = 'wind';
        if (t === 20) room.spawnMinions(this, p2 ? 3 : 2, Math.random() < 0.6 ? 'drowned' : 'harpooner');
        return t > 50;
      }
      case 'cannonBarrage': {
        this.pose = 'castUp';
        this.anim = 'wind';
        if (t === 1) room.bossShout('포격 개시!', '#ffb060');
        const n = p2 ? 14 : 9;
        if (t <= n * 6 && t % 6 === 0) this.skyDrop(room, t % 18 === 0 ? p.cx : 30 + Math.random() * (room.world.pxW - 60), 44, 'fireball', '#ff9a4a', 0.8, 'burn');
        return t > n * 6 + 50;
      }
      case 'whirlpool': {
        this.anim = 'wind';
        this.pose = 'castUp';
        if (t === 1) {
          audio.play('warn');
          const x = p.cx;
          const gy = room.world.groundBelow(x, p.b.y);
          room.marker(x - 50, gy - 30, 100, 30, 40, '#80d0ff', true);
          room.enemyLater(40, () => room.addField('enemy', { vis: 'ice', w: 100, h: 30, life: 180, tick: 24, m: 1, pull: 1.4 }, x - 50, gy - 30, Math.round(this.atk * 0.5), 'normal'));
        }
        return t > 80;
      }
      // ─────────── 리브라 ───────────
      case 'iceSpears': {
        this.pose = 'castUp';
        this.anim = 'wind';
        const n = p2 ? 9 : 6;
        if (t === 1) {
          audio.play('freeze', 0.7);
          for (let i = 0; i < n; i++) {
            const bx = this.cx + (i - (n - 1) / 2) * 22;
            const by = this.b.y - 26 - Math.abs(i - (n - 1) / 2) * 5;
            room.marker(bx - 3, by - 3, 6, 6, 36 + i * 5, '#a8e4ff');
            room.enemyLater(36 + i * 5, () => {
              const a = Math.atan2(room.player.cy - by, room.player.cx - bx);
              room.addProj('enemy', { spr: 'shard', spd: 5, life: 90, w: 10, h: 6, col: '#d0f4ff', st: 'chill' }, bx, by, a, Math.round(this.atk * 0.65), 'normal');
            });
          }
        }
        return t > 36 + n * 5 + 20;
      }
      case 'pageStorm': {
        this.pose = 'cast';
        this.anim = 'wind';
        if (t % 16 === 8 && t < 70) {
          for (let i = 0; i < 3; i++) room.addProj('enemy', { spr: 'blade', spd: 1.8, life: 220, w: 8, h: 6, col: '#e8f0ff', home: 0.03 }, this.cx, this.b.y + 8, -Math.PI / 2 + (i - 1) * 0.9, Math.round(this.atk * 0.55), 'normal');
          audio.play('flip', 0.8);
        }
        return t > 90;
      }
      case 'frostNova': {
        this.pose = t < 40 ? 'castUp' : 'cast';
        this.anim = t < 40 ? 'wind' : 'atk';
        this.tele(t < 40);
        if (t === 1) {
          audio.play('warn');
          room.marker(this.cx - 75, this.cy - 75, 150, 150, 40, '#a8e4ff', true);
        }
        if (t === 40) {
          room.enemyExplode(this.cx, this.cy, 75, this.atk * 1.1, 'chill');
          room.fx.burst(this.cx, this.cy, '#d0f4ff', 40, 4);
          room.cam.shake(5);
          audio.play('freeze');
        }
        return t > 70;
      }
      case 'shelfCollapse': {
        this.anim = 'wind';
        this.pose = 'castUp';
        if (t === 1) {
          audio.play('crumble');
          room.bossShout('서가가 무너진다!', '#c0d8f0');
          const n = p2 ? 6 : 4;
          for (let i = 0; i < n; i++) this.skyDrop(room, i === 0 ? p.cx : 30 + Math.random() * (room.world.pxW - 60), 50 + i * 8, 'rock', '#6a5a4a', 1);
        }
        return t > 110;
      }
      case 'summonTomes': {
        this.pose = 'castUp';
        this.anim = 'wind';
        if (t === 20) room.spawnFlyers(this, p2 ? 3 : 2, 'tome');
        return t > 50;
      }
      case 'blizzard': {
        this.pose = 'castUp';
        this.anim = 'wind';
        if (t === 1) room.bossShout('눈보라가 휘몰아친다!', '#d0f4ff');
        if (t <= 90 && t % 4 === 0) this.skyDrop(room, 30 + Math.random() * (room.world.pxW - 60), 36, 'shard', '#d0f4ff', 0.5, 'chill');
        return t > 140;
      }
      // ─────────── 망각 ───────────
      case 'voidPillars': {
        this.pose = 'castUp';
        this.anim = 'wind';
        if (t === 1) {
          audio.play('warn');
          const n = 3 + this.phase * 2;
          for (let i = 0; i < n; i++) this.pillar(room, i === 0 ? p.cx : 30 + Math.random() * (room.world.pxW - 60), 44 + i * 6, 'void', 26, 240);
        }
        return t > 100;
      }
      case 'voidBeam': {
        if (t === 1) {
          this.face(room);
          audio.play('warn');
          room.bossShout('모든 것을 잊어라…', '#ff80d0');
        }
        const gy = this.ground(room);
        const y = gy - 16;
        const x0 = this.facing > 0 ? this.cx : 16;
        const w = this.facing > 0 ? room.world.pxW - 16 - this.cx : this.cx - 16;
        if (t === 2) room.marker(x0, y, w, 12, 50, '#ff80d0', true);
        if (t < 52) {
          this.anim = 'wind';
          this.pose = 'thrustWind';
          this.tele(true);
          return false;
        }
        this.anim = 'atk';
        this.pose = 'thrust';
        if (t === 52) {
          room.addField('enemy', { vis: 'void', w, h: 12, life: 36, tick: 8, m: 1 }, x0, y, Math.round(this.atk * 0.8), 'normal');
          room.cam.shake(5, 30);
          audio.play('explode', 1.3);
          room.flash('#ff80d0', 0.3);
        }
        if (this.phase >= 1 && t === 80) {
          room.marker(16, gy - 46, room.world.pxW - 32, 12, 30, '#ff80d0', true);
          room.enemyLater(30, () => room.addField('enemy', { vis: 'void', w: room.world.pxW - 32, h: 12, life: 30, tick: 8, m: 1 }, 16, gy - 46, Math.round(this.atk * 0.7), 'normal'));
        }
        return t > 120;
      }
      case 'pactShadows': {
        this.pose = 'castUp';
        this.anim = 'wind';
        if (t === 1) {
          room.bossShout(this.bd.id === 'oblivion' ? '네가 계약한 혼들… 모두 내가 기억하고 있다.' : this.bd.id === 'arche' ? '그 혼들과의 계약도, 처음엔 내가 맺은 것이다.' : '계약자여, 네가 부린 혼들도 결국 나의 것이다!', this.ec('#c8a8ff'));
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
            // 그림자가 화면을 다 가로지를 때까지 경로 표시
            s.mk = room.marker(0, s.y - 22, room.world.pxW, 20, 999, this.ec('#9a6bff'), true);
            room.toastWorld(s.x, s.y - 34, CHAR_MAP[s.id]?.name ?? '', '#c8a8ff');
          }
          if (s.t > 40) {
            s.x += s.dir * 7;
            if (!s.hit && Math.abs(room.player.cx - s.x) < 16 && Math.abs(room.player.cy - (s.y - 10)) < 20) {
              s.hit = room.damagePlayer(Math.round(this.atk * 0.9), s.x, `${CHAR_MAP[s.id]?.name ?? ''}의 그림자`, { kb: 4 });
            }
            if (s.t % 2 === 0) room.fx.ghost(charFrame(s.id, 'thrust'), s.x - 24, s.y - 44, s.dir < 0, '#3a1a5a', 12);
            if (s.x < -30 || s.x > room.world.pxW + 30) {
              s.done = true;
              s.mk?.end();
            }
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
    if (this.bd.orb) {
      // 날개 없는 구체: 몸통 중심에 구체 중심(프레임 24,24)을 맞춘다
      img = orbFrame(this.bd.id, Math.floor(this.animT / 6) % 12, this.state === 'wind');
      sc = 2;
      footOff = (this.b.h / 2 + 48) / 2;
    } else switch (this.bd.id) {
      case 'mycora':
        img = mycoraFrame(this.anim, f);
        sc = 2;
        footOff = 46;
        break;
      case 'ignis':
        img = ignisFrame(this.anim, f, this.phase >= 1);
        sc = 2;
        footOff = 54;
        break;
      default: {
        sc = 2;
        let pose = this.pose;
        if (this.anim === 'move') pose = (['run0', 'run1', 'run2', 'run3', 'run4', 'run5'] as PoseName[])[Math.floor(this.animT / 6) % 6];
        else if (this.anim === 'idle') pose = f % 2 ? 'idle1' : 'idle0';
        img = this.mirrorOf ? charFrame(this.mirrorOf, pose) : lookFrame(`b:${this.bd.id}`, ENEMY_LOOKS[this.bd.id], pose);
      }
    }
    const fw = img.width * sc;
    const fh = img.height * sc;
    const x = Math.round(this.cx - fw / 2 - cx);
    const y = Math.round(this.b.y + this.b.h - footOff * sc - cy);
    g.save();
    if (this.dead) g.globalAlpha = 1 - this.deadT / 60;
    if (this.intro > 0) g.globalAlpha = Math.min(1, (100 - this.intro) / 40);
    const flip = this.facing < 0 && this.bd.id !== 'mycora';
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
    if (this.flash > 0 || this.dead) {
      g.globalAlpha = a0 * (this.dead ? 1 : 0.55);
      draw(white(img), sx);
      g.globalAlpha = a0;
    }
    else if (this.status.freeze) {
      g.globalAlpha = a0 * 0.5;
      draw(tinted(img, '#bfefff'));
    } else if (this.state === 'wind' && (time >> 2) % 2 === 0) {
      g.globalAlpha = a0 * 0.35;
      draw(tinted(img, '#ff3030'));
    }
    g.restore();
    // 분열체: 머리 위 체력 바 (본체 체력은 HUD)
    if (this.twin && !this.dead && this.intro < 60) {
      const bw = 44;
      const bx = Math.round(this.cx - bw / 2 - cx);
      const by = Math.round(this.b.y - 16 - cy);
      g.fillStyle = 'rgba(10,4,12,0.8)';
      g.fillRect(bx - 1, by - 1, bw + 2, 5);
      g.fillStyle = '#d02050';
      g.fillRect(bx, by, Math.max(0, Math.round((bw * this.hp) / this.maxHp)), 3);
      g.fillStyle = '#ffd0e0';
      g.fillRect(bx, by, Math.max(0, Math.round((bw * this.hp) / this.maxHp)), 1);
    }
    // 분신 돌진
    for (const c of this.clones) {
      if (c.done || c.t < 1) continue;
      const base = this.mirrorOf ? charFrame(this.mirrorOf, c.t > 36 ? 'dash' : 'thrustWind') : lookFrame(`b:${this.bd.id}`, ENEMY_LOOKS[this.bd.id], c.t > 36 ? 'dash' : 'thrustWind');
      const im = tinted(base, this.ec('#9a6bff'));
      g.save();
      g.globalAlpha = Math.min(1, c.t / 20) * 0.75;
      const cxp = Math.round(c.x - 24 - cx);
      const cyp = Math.round(c.y - 44 - cy);
      if (c.dir < 0) {
        g.translate(cxp + 24, 0);
        g.scale(-1, 1);
        g.drawImage(im, -24, cyp);
      } else g.drawImage(im, cxp, cyp);
      g.restore();
    }
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
