import { audio } from '../core/audio';
import type { Rect } from '../core/math';
import { overlap } from '../core/math';
import { CHAR_MAP, TYPE_SFX } from '../data/characters';
import { ENEMY_MAP, type EnemyDef } from '../data/enemies';
import type { ChapterDef, RoomType } from '../data/meta';
import type { RoomTemplate } from '../data/rooms';
import { drawBackground } from '../gfx/background';
import { rgba } from '../gfx/pixel';
import { W, H } from '../gfx/renderer';
import { lookFrame, ENEMY_LOOKS, propSprite } from '../gfx/sprites';
import { Boss } from './boss';
import { computeDamage, computeTaken } from './combat';
import { Build, type TriggerCtx } from './effects';
import { Enemy, enemyPool } from './enemy';
import { Field, Pickup, Projectile, Summon, type DmgKind, type PickupKind, type Prop } from './entities';
import { Fx, Camera } from './fx';
import { NO_INPUT, Player, type ActKind, type PlayerInput } from './player';
import type { PartyMember, RunState } from './run';
import type { SaveData } from './save';
import type { ActEvent, CondKey, EffectDo, Element, FieldDef, ProjDef, Stats, StatusId, SummonDef } from './types';
import { Tile, TS, World } from './world';
import { makeCanvas } from '../gfx/pixel';

export interface HitOpts {
  m: number;
  kind: DmgKind;
  el?: Element;
  st?: StatusId;
  stn?: number;
  kb: number;
  up: number;
  hs: number;
  dir: number;
  fin?: boolean;
  proc?: boolean;
  label?: string;
  shake?: number;
  noTrigger?: boolean;
}

export interface RoomHooks {
  onClear?(): void;
  onInteract?(p: Prop): void;
  onDeath?(): void;
  onBossDefeated?(b: Boss): void;
  onRelicOrb?(): void;
  toast?(msg: string, col?: string): void;
}

export interface RoomInit {
  template: RoomTemplate;
  chapter: ChapterDef;
  mode: 'run' | 'hub' | 'title';
  type: RoomType;
  next: number[];
  depth: number;
  bossId?: string;
}

interface Marker {
  x: number;
  y: number;
  w: number;
  h: number;
  t: number;
  max: number;
  col: string;
  fill: boolean;
}

interface WorldText {
  x: number;
  y: number;
  text: string;
  col: string;
  t: number;
}

const ELEM_COL: Record<string, string> = { fire: '#ff8a3a', thunder: '#bff0ff', poison: '#a0e040', frost: '#c0f0ff', shadow: '#c0a0ff', holy: '#fff0a0', blood: '#ff4060', phys: '#ffffff' };

/** 하나의 방(전투 공간): 월드·엔티티·전투 판정·연출을 모두 소유 */
export class Room {
  world: World;
  ch: ChapterDef;
  fx = new Fx();
  cam = new Camera();
  player: Player;
  enemies: Enemy[] = [];
  boss: Boss | null = null;
  projs: Projectile[] = [];
  fields: Field[] = [];
  summons: Summon[] = [];
  pickups: Pickup[] = [];
  props: Prop[] = [];
  markers: Marker[] = [];
  texts: WorldText[] = [];
  timers: { t: number; fn: () => void }[] = [];
  torches: { x: number; y: number }[] = [];
  spawnE: { x: number; y: number }[] = [];
  spawnF: { x: number; y: number }[] = [];
  waves: { def: EnemyDef; elite: boolean; flying: boolean }[][] = [];
  build = new Build();
  stats: Stats = {};
  input: PlayerInput = NO_INPUT;
  time = 0;
  hitstop = 0;
  slowT = 0;
  slowScale = 1;
  slowAcc = 0;
  timestop = 0;
  enemySlow = 0;
  flashCol = '#ffffff';
  flashA = 0;
  hurtVignette = 0;
  darkBoost = 0;
  combo = 0;
  comboT = 0;
  cleared: boolean;
  hooks: RoomHooks = {};
  prompt: Prop | null = null;
  debug = false;
  showHitboxes = false;
  god = false;
  debugBoxes: { x: number; y: number; w: number; h: number; t: number; col: string }[] = [];
  bossBanner = 0;
  bossBannerText = '';
  shout = { text: '', col: '#fff', t: 0 };
  light: HTMLCanvasElement;
  lightG: CanvasRenderingContext2D;
  demo = false;
  swapHitSlowDone = false;
  intensity = 0;

  constructor(
    public init: RoomInit,
    public run: RunState,
    public save: SaveData,
  ) {
    this.ch = init.chapter;
    const t = init.template;
    const rows = t.rows;
    const h = rows.length;
    const w = Math.max(...rows.map((r) => r.length));
    this.world = new World(w, h);
    let px = 40;
    let py = 200;
    const doors: { x: number; y: number }[] = [];
    const npcs: { x: number; y: number }[] = [];
    const chests: { x: number; y: number; hidden: boolean }[] = [];
    const signs: { x: number; y: number }[] = [];
    let bossPos = { x: 300, y: 200 };
    const rng = run.rng;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const c = rows[y][x] ?? '.';
        const wx = x * TS + TS / 2;
        const wy = (y + 1) * TS;
        switch (c) {
          case '#':
            this.world.set(x, y, Tile.Solid);
            break;
          case '=':
            this.world.set(x, y, Tile.OneWay);
            break;
          case '^':
            this.world.set(x, y, this.ch.n === 3 && y >= h - 3 ? Tile.Lava : Tile.Spike);
            break;
          case 'L':
            this.world.set(x, y, Tile.Lava);
            break;
          case 'B':
            this.world.set(x, y, Tile.Break);
            break;
          case 'C':
            this.world.set(x, y, Tile.Crumble);
            break;
          case 't':
            if (init.mode === 'run' && rng.chance(0.5) && rows[y + 1]?.[x] === '#') this.world.set(x, y, Tile.Spike);
            break;
          case 'P':
            px = wx;
            py = wy;
            break;
          case 'D':
            doors.push({ x: wx, y: wy });
            break;
          case 'e':
            this.spawnE.push({ x: wx, y: wy });
            break;
          case 'f':
            this.spawnF.push({ x: wx, y: wy });
            break;
          case '$': {
            const left = rows[y][x - 1];
            if (!chests.some((ch) => Math.abs(ch.y - wy) < 20 && Math.abs(ch.x - wx) < 40)) chests.push({ x: wx + 8, y: wy, hidden: left === 'B' || left === '$' || rows[y - 1]?.[x] === 'B' || rows[y - 1]?.[x] === '#' });
            break;
          }
          case 'N':
            npcs.push({ x: wx, y: wy });
            break;
          case 'X':
            bossPos = { x: wx, y: wy };
            break;
          case 'T':
            this.torches.push({ x: wx, y: wy - 8 });
            break;
          case 'S':
            signs.push({ x: wx, y: wy });
            break;
        }
      }
    }
    this.player = new Player(this, px, py);
    this.light = makeCanvas(W, H);
    this.lightG = this.light.getContext('2d')!;
    this.build.exec = (d, ctx) => this.execEffect(d, ctx);
    this.rebuild();
    if (!run.initialized) {
      run.hp = this.maxHp();
      run.initialized = true;
    }
    this.cleared = !(init.type === 'combat' || init.type === 'elite' || init.type === 'boss' || init.type === 'start');
    // 문 배치
    const nd = init.next.length;
    if (doors.length && nd) {
      const idxs = nd === 1 ? [doors.length - 1] : nd === 2 && doors.length >= 3 ? [0, doors.length - 1] : doors.map((_, i) => i).slice(0, nd);
      idxs.forEach((di, k) => {
        const d = doors[di] ?? doors[doors.length - 1];
        this.props.push({ kind: 'door', x: d.x, y: d.y, w: 28, h: 36, used: false, nodeId: init.next[k], open: this.cleared });
      });
    }
    if (init.type === 'boss') this.bossDoor = doors[0] ?? { x: w * TS - 40, y: 14 * TS };
    for (const c of chests) this.props.push({ kind: 'chest', x: c.x, y: c.y, w: 20, h: 16, used: false, hidden: c.hidden });
    if (init.type === 'treasure' && npcs.length) this.props.push({ kind: 'chest', x: npcs[0].x, y: npcs[0].y, w: 20, h: 16, used: false, label: 'big' });
    const npcKind: Partial<Record<RoomType, Prop['kind']>> = { shop: 'shop', altar: 'altar', armory: 'armory', rest: 'rest', event: 'event' };
    const nk = npcKind[init.type];
    if (nk && npcs.length) this.props.push({ kind: nk, x: npcs[0].x, y: npcs[0].y, w: 40, h: 40, used: false });
    signs.forEach((s, i) => this.props.push({ kind: 'sign', x: s.x, y: s.y, w: 20, h: 20, used: false, text: String(i) }));
    if (init.mode === 'hub') {
      const st = ['ach', 'codex', 'gacha', 'portal', 'loadout', 'growth', 'upgrade', 'dummy'];
      npcs.forEach((n, i) => this.props.push({ kind: 'hub', x: n.x, y: n.y, w: 40, h: 44, used: false, hub: st[i] ?? 'dummy' }));
      const dn = npcs[7];
      if (dn) this.enemies.push(this.makeEnemy(ENEMY_MAP.dummy, dn.x + 30, dn.y, false));
    }
    // 적 웨이브 구성
    if (init.mode !== 'hub') this.planWaves(init);
    if (init.type === 'boss' && init.bossId) {
      this.boss = new Boss(init.bossId, bossPos.x, bossPos.y, run.curseEnemy);
      this.cleared = false;
    }
    // 튜토리얼 적
    if (init.type === 'tutorial') {
      for (const s of this.spawnE) {
        const e = this.makeEnemy(ENEMY_MAP.skeleton, s.x, s.y, false);
        e.maxHp = e.hp = 40;
        e.atk = 4;
        this.enemies.push(e);
      }
      this.cleared = false;
    }
    this.cam.follow(this.player.cx, this.player.cy, this.world.pxW, this.world.pxH, W, H, true);
    this.cam.shakeScale = save.settings.shake;
    this.fx.showNumbers = save.settings.dmgNumbers;
    if (this.cleared) this.openDoors(false);
  }

  bossDoor: { x: number; y: number } | null = null;

  // ─────────── 파티/빌드 접근자 ───────────
  get party(): PartyMember[] {
    return this.run.party;
  }
  get activeIdx(): number {
    return this.run.active;
  }
  get weapon(): { id: string; rf: number } {
    return this.run.weapon;
  }
  get shield(): number {
    return this.run.shield;
  }
  set shield(v: number) {
    this.run.shield = v;
  }

  rebuild(): void {
    const ratio = this.run.initialized ? this.run.hp / Math.max(1, this.maxHp()) : 1;
    this.build.rebuild(this.run, this.save);
    this.refreshStats();
    if (this.run.initialized) this.run.hp = Math.min(this.maxHp(), Math.max(1, Math.round(ratio * this.maxHp())));
  }

  maxHp(): number {
    const base = this.player.maxHpBase();
    const s = this.build.base;
    return Math.round((base + (s.maxHp ?? 0)) * (1 + (s.hpPct ?? 0)));
  }

  private condCheck = (c: CondKey): boolean => {
    switch (c) {
      case 'lowHp':
        return this.run.hp <= this.maxHp() * 0.5;
      case 'fullHp':
        return this.run.hp >= this.maxHp();
      case 'shielded':
        return this.run.shield > 0;
      case 'airborne':
        return !this.player.b.onGround;
      case 'afterDash':
        return this.player.afterDash > 0;
      case 'afterSwap':
        return this.player.afterSwap > 0;
      case 'comboHigh':
        return this.combo >= 15;
    }
    return false;
  };

  refreshStats(): void {
    this.stats = this.build.stats(this.condCheck);
  }

  private makeEnemy(def: EnemyDef, x: number, y: number, elite: boolean): Enemy {
    return new Enemy(def, x, y, elite, this.ch.n, this.run.curseEnemy, this.run.node?.layer ?? 0);
  }

  private planWaves(init: RoomInit): void {
    if (!(init.type === 'combat' || init.type === 'elite' || init.type === 'start')) return;
    const pool = enemyPool(this.ch.n);
    const rng = this.run.rng;
    const depth = init.depth;
    let count = Math.min(10, Math.round(3 + depth * 0.6 + this.ch.n * 0.4 + this.run.curse * 0.3));
    if (init.type === 'start') count = Math.max(3, count - 1);
    const flyers = pool.filter((d) => d.flying);
    const grounds = pool.filter((d) => !d.flying);
    const list: { def: EnemyDef; elite: boolean; flying: boolean }[] = [];
    if (init.type === 'elite') {
      const ed = rng.weighted(grounds, (d) => d.weight);
      list.push({ def: ed, elite: true, flying: false });
      if (this.run.curse >= 3) list.push({ def: rng.weighted(pool, (d) => d.weight), elite: true, flying: false });
      count = Math.max(2, Math.floor(count * 0.5));
    }
    for (let i = 0; i < count; i++) {
      const fly = this.spawnF.length > 0 && flyers.length > 0 && rng.chance(0.3);
      const d = rng.weighted(fly ? flyers : grounds, (x) => x.weight);
      list.push({ def: d, elite: false, flying: !!d.flying });
    }
    // 웨이브 분할
    const w1 = list.slice(0, list.length >= 6 ? Math.ceil(list.length * 0.6) : list.length);
    const w2 = list.slice(w1.length);
    this.waves = [w1];
    if (w2.length) this.waves.push(w2);
  }

  private spawnWave(): void {
    const wave = this.waves.shift();
    if (!wave) return;
    const rng = this.run.rng;
    const eSpots = rng.shuffle([...this.spawnE]);
    const fSpots = rng.shuffle([...this.spawnF]);
    let ei = 0;
    let fi = 0;
    for (const w of wave) {
      let spot: { x: number; y: number };
      if (w.flying && fSpots.length) spot = fSpots[fi++ % fSpots.length];
      else if (eSpots.length) spot = eSpots[ei++ % eSpots.length];
      else spot = { x: this.world.pxW / 2, y: 200 };
      // 플레이어 바로 옆 소환 방지
      if (Math.abs(spot.x - this.player.cx) < 60) spot = { x: spot.x + (spot.x < this.player.cx ? -60 : 60), y: spot.y };
      spot.x = Math.max(24, Math.min(this.world.pxW - 24, spot.x + (ei > eSpots.length ? (rng.next() - 0.5) * 40 : 0)));
      const e = this.makeEnemy(w.def, spot.x, w.flying ? spot.y - 20 : spot.y, w.elite);
      e.st = 40 + Math.floor(rng.next() * 30);
      this.enemies.push(e);
    }
    audio.play('door', 1.4);
  }

  allEnemies(): Enemy[] {
    return this.boss && !this.boss.dead ? [...this.enemies, this.boss] : this.enemies;
  }

  overlapsEnemy(e: Enemy, r: Rect): boolean {
    return overlap(e.b, r);
  }

  nearestEnemy(x: number, y: number, range: number, exclude?: Enemy): Enemy | null {
    let best: Enemy | null = null;
    let bd = range;
    for (const e of this.allEnemies()) {
      if (e.dead || e === exclude || e.state === 'spawn' || e.def.ai === 'dummy' && this.init.mode !== 'hub') continue;
      const d = Math.hypot(e.cx - x, e.cy - y);
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    return best;
  }

  // ─────────── 업데이트 ───────────
  update(): void {
    this.time++;
    if (this.flashA > 0) this.flashA = Math.max(0, this.flashA - 0.04);
    if (this.hurtVignette > 0) this.hurtVignette--;
    if (this.bossBanner > 0) this.bossBanner--;
    if (this.shout.t > 0) this.shout.t--;
    this.cam.update();
    this.fx.update();
    if (this.hitstop > 0) {
      this.hitstop--;
      return;
    }
    if (this.slowT > 0) {
      this.slowT--;
      this.slowAcc += this.slowScale;
      if (this.slowAcc < 1) return;
      this.slowAcc -= 1;
    }
    this.step();
  }

  private step(): void {
    this.build.tick(1 / 60, Math.random);
    this.refreshStats();
    if (this.timestop > 0) this.timestop--;
    if (this.enemySlow > 0) this.enemySlow--;
    if (this.comboT > 0) this.comboT--;
    else this.combo = 0;
    if (this.init.mode === 'run') this.run.stats.frames++;
    // 시작 웨이브
    if (this.time === 20 && this.waves.length && !this.enemies.some((e) => !e.dead)) this.spawnWave();

    this.player.update(this.input);
    for (const s of this.summons) s.update(this);
    for (const e of this.enemies) e.update(this);
    if (this.boss) {
      this.boss.update(this);
      if (this.boss.dead && this.boss.deadT === 60) this.hooks.onBossDefeated?.(this.boss);
    }
    for (const p of this.projs) {
      if (p.team === 'enemy' && this.timestop > 0) continue;
      p.update(this);
      if (p.dead) continue;
      const r = { x: p.x - p.w / 2, y: p.y - p.h / 2, w: p.w, h: p.h };
      if (p.team === 'player') {
        for (const e of this.allEnemies()) {
          if (e.dead || p.hit.has(e) || e.state === 'spawn' || !overlap(e.b, r)) continue;
          p.hit.add(e);
          const d = p.def;
          this.damageEnemy(e, { m: p.mult, kind: p.kind, el: d.el, st: d.st, stn: d.stn, kb: d.kb ?? 1.5, up: d.up ?? 0, hs: d.hs ?? 2, dir: Math.sign(p.vx) || 1, proc: p.kind === 'proc' });
          if (p.pierceLeft-- <= 0) {
            p.die(this);
            break;
          }
        }
      } else if (this.player.overlaps(r)) {
        if (this.damagePlayer(p.mult, p.x, '투사체', { st: p.def.st, kb: 2.5 })) {
          if (!p.def.pierce) p.dead = true;
          if (p.def.boom) p.die(this);
        }
      }
    }
    for (const f of this.fields) f.update(this);
    for (const p of this.pickups) p.update(this);
    for (const ev of this.world.tick()) {
      if (ev.ev === 'fall') {
        this.fx.burst(ev.tx * TS + 8, ev.ty * TS + 4, this.ch.tile[1], 10, 1.5, { grav: 0.2 });
        audio.play('crumble', 1.3);
      }
    }
    // 예약 콜백
    const due = this.timers.filter((t) => --t.t <= 0);
    this.timers = this.timers.filter((t) => t.t > 0);
    for (const t of due) t.fn();
    for (const m of this.markers) m.t++;
    this.markers = this.markers.filter((m) => m.t < m.max);
    for (const t of this.texts) t.t++;
    this.texts = this.texts.filter((t) => t.t < 70);
    for (const b of this.debugBoxes) b.t--;
    this.debugBoxes = this.debugBoxes.filter((b) => b.t > 0);
    // 정리
    this.enemies = this.enemies.filter((e) => !(e.dead && e.deadT > 30));
    this.projs = this.projs.filter((p) => !p.dead);
    this.fields = this.fields.filter((f) => !f.dead);
    this.summons = this.summons.filter((s) => !s.dead);
    this.pickups = this.pickups.filter((p) => !p.dead);
    // 다음 웨이브 / 클리어
    const alive = this.enemies.some((e) => !e.dead && e.def.ai !== 'dummy');
    if (!alive && this.waves.length && this.time > 30) this.spawnWave();
    else if (!this.cleared && !alive && !this.waves.length && (!this.boss || this.boss.dead) && this.time > 40) this.roomCleared();
    // 전투 강도 (음악)
    const target = alive || (this.boss && !this.boss.dead) ? 1 : 0;
    this.intensity += (target - this.intensity) * 0.02;
    // 상호작용
    this.prompt = null;
    let best = 30;
    for (const p of this.props) {
      if (p.kind === 'chest' && p.used) continue;
      if (p.kind === 'door' && !p.open) continue;
      const d = Math.abs(p.x - this.player.cx) + Math.abs(p.y - 10 - (this.player.b.y + this.player.b.h - 10)) * 0.5;
      const range = p.kind === 'hub' ? 26 : p.kind === 'sign' ? 40 : 22;
      if (d < range && d < best + range) {
        best = d;
        this.prompt = p;
      }
    }
    if (this.prompt && this.input.interactP && this.player.state !== 'dead') this.interact(this.prompt);
    if (this.input.itemP) this.useItemRequest();
    // 환경 파티클
    if (this.time % 8 === 0) this.ambient();
    // 카메라
    const look = this.player.facing * 20;
    this.cam.follow(this.player.cx + look, this.player.cy, this.world.pxW, this.world.pxH, W, H);
    // 체력 0 처리
    if (this.player.state === 'dead' && this.player.deadT === 80) this.hooks.onDeath?.();
  }

  useItemRequest: () => void = () => undefined;

  private ambient(): void {
    const k = this.ch.particles;
    const x = this.cam.x + Math.random() * W;
    const y = this.cam.y + Math.random() * H;
    const col = k === 'ember' ? '#ff8a3a' : k === 'spore' ? '#a0ff80' : k === 'shadow' ? '#9a6bff' : '#c0b8d0';
    this.fx.parts.push({ x, y, vx: (Math.random() - 0.5) * 0.3, vy: k === 'ember' ? -0.4 : k === 'dust' ? 0.1 : -0.15, life: 0, max: 160, col, size: 1, grav: 0, kind: 'px', drag: 1 });
  }

  private roomCleared(): void {
    this.cleared = true;
    this.openDoors(true);
    this.build.fire('roomClear', {}, Math.random);
    const restUp = (this.save.upgrades.rest ?? 0) * 0.1;
    if (restUp > 0 && this.init.mode === 'run') this.heal(this.maxHp() * 0.03 * restUp * 10 * 0.33);
    this.hooks.onClear?.();
  }

  openDoors(withSound: boolean): void {
    let any = false;
    for (const p of this.props) {
      if (p.kind === 'door' && !p.open) {
        p.open = true;
        any = true;
        this.fx.burst(p.x, p.y - 18, '#9a6bff', 14, 2);
      }
    }
    if (any && withSound) audio.play('door');
  }

  addExitDoor(nodeId: number): void {
    const d = this.bossDoor ?? { x: this.world.pxW - 40, y: 14 * TS };
    this.props.push({ kind: 'door', x: d.x, y: d.y, w: 28, h: 36, used: false, nodeId, open: true });
    this.fx.burst(d.x, d.y - 18, '#ffe080', 20, 2.5);
    audio.play('door');
  }

  private interact(p: Prop): void {
    if (p.kind === 'chest') {
      if (p.used) return;
      p.used = true;
      audio.play('chest');
      this.fx.burst(p.x, p.y - 8, '#ffe080', 20, 2.5);
      this.fx.glow(p.x, p.y - 8, '#ffe080', 30, 20);
    }
    this.hooks.onInteract?.(p);
  }

  // ─────────── 액션 이벤트 ───────────
  private kindOf(k: ActKind, fin?: boolean): DmgKind {
    switch (k) {
      case 'combo':
        return fin ? 'finisher' : 'normal';
      case 'air':
        return 'air';
      case 'dashAtk':
        return 'dash';
      case 'skill1':
      case 'skill2':
        return 'skill';
      case 'swap':
        return 'swap';
    }
  }

  private modOf(k: ActKind): { dmg: number; count: number; cd: number; size: number } {
    const t = k === 'skill1' ? 'skill1' : k === 'skill2' ? 'skill2' : k === 'swap' ? 'swap' : 'combo';
    return this.build.modFor(t);
  }

  runEvent(ev: ActEvent, k: ActKind): void {
    const p = this.player;
    const f = p.facing;
    const mod = this.modOf(k);
    const dm = 1 + mod.dmg;
    const sz = 1 + mod.size;
    const col = p.def.fx;
    switch (ev.k) {
      case 'hit': {
        const [bx, by, bw, bh] = ev.box;
        const w = bw * sz;
        const h = bh * (1 + mod.size * 0.5);
        const x = f > 0 ? p.cx + bx : p.cx - bx - w;
        const rect = { x, y: p.cy + by - (h - bh) / 2, w, h };
        if (ev.fx) this.fx.slash(p.cx, p.cy, f, { ...ev.fx, r: ev.fx.r * sz }, col);
        if (this.showHitboxes) this.debugBoxes.push({ ...rect, t: 8, col: '#40ff80' });
        const kind = this.kindOf(k, ev.fin);
        this.hitEnemiesBox(rect, { m: ev.m * dm, kind, el: ev.el, st: ev.st, stn: ev.stn, kb: ev.kb ?? 1.2, up: ev.up ?? 0, hs: ev.hs ?? 3, dir: f, fin: ev.fin, shake: ev.shake });
        this.breakTiles(rect);
        if (ev.shake) this.cam.shake(ev.shake * 0.5, 6);
        break;
      }
      case 'proj': {
        const n = (ev.n ?? 1) + (ev.n && ev.n > 1 || k === 'skill1' || k === 'skill2' || k === 'swap' || mod.count ? mod.count : 0);
        const base = ((ev.ang ?? 0) * Math.PI) / 180;
        const sp = ((ev.spread ?? 8) * Math.PI) / 180;
        for (let i = 0; i < n; i++) {
          const a = base + (i - (n - 1) / 2) * sp;
          const ang = f > 0 ? a : Math.PI - a;
          this.addProj('player', ev.p, p.cx + f * (ev.dx ?? 8), p.cy + (ev.dy ?? -4), ang, ev.m * dm, this.kindOf(k));
        }
        break;
      }
      case 'field': {
        const fd: FieldDef = { ...ev.f, w: ev.f.w * sz, h: ev.f.h * (1 + mod.size * 0.3), m: ev.f.m * dm };
        const cxp = p.cx + f * (ev.dx ?? 0);
        const y = ev.ground ? this.world.groundBelow(cxp, p.b.y + 4) - fd.h : p.cy + (ev.dy ?? 0) - fd.h / 2;
        this.addField('player', fd, cxp - fd.w / 2, y, ev.m ?? 1, this.kindOf(k));
        break;
      }
      case 'summon':
        this.summon(ev.s, (ev.n ?? 1) + mod.count, dm);
        break;
      case 'buff':
        this.build.addBuff(ev.id, ev.stats, ev.dur);
        break;
      case 'shield':
        this.addShield(this.maxHp() * ev.v);
        break;
      case 'timestop':
        this.timestop = Math.round(ev.dur * 60);
        this.flash('#a8c8ff', 0.5);
        break;
      case 'counter':
        p.counterT = ev.dur;
        p.counterM = ev.m * dm;
        break;
      case 'tp': {
        let tx: number;
        if (ev.toEnemy) {
          const e = this.nearestEnemy(p.cx, p.cy, 220);
          if (e) {
            const side = p.cx < e.cx ? 1 : -1;
            tx = e.cx + side * (e.b.w / 2 + 10);
            p.facing = -side;
          } else tx = p.cx + f * ev.dx;
        } else tx = p.cx + f * ev.dx;
        this.fx.ghost(p.frame(), p.cx - 24, p.b.y + p.b.h - 44, p.facing < 0, col, 18);
        tx = Math.max(16, Math.min(this.world.pxW - 16, tx));
        // 벽 속으로 가지 않도록
        const step = Math.sign(tx - p.cx);
        let x = p.cx;
        for (let i = 0; i < 400 && Math.abs(x - tx) > 2; i++) {
          if (this.world.solidPx(x + step * 6, p.cy) || this.world.solidPx(x + step * 6, p.b.y + 2)) break;
          x += step * 2;
        }
        p.b.x = x - p.b.w / 2;
        this.fx.burst(p.cx, p.cy, col, 10, 2);
        break;
      }
      case 'meteor': {
        const n = ev.n + mod.count;
        const tgt = this.nearestEnemy(p.cx, p.cy, 260);
        const cx0 = tgt ? tgt.cx : p.cx + f * 80;
        for (let i = 0; i < n; i++) {
          const ox = n === 1 ? 0 : (i / (n - 1) - 0.5) * ev.spread + (Math.random() - 0.5) * 16;
          this.later(i * 5, () => this.meteor(cx0 + ox, ev.m * dm, ev.el, ev.st, ev.big, ev.spr, this.kindOf(k)));
        }
        break;
      }
      case 'fx':
        this.fx.slash(p.cx, p.cy, f, ev.fx, col);
        break;
      case 'sfx':
        audio.play(ev.s);
        break;
      case 'heal':
        this.heal(this.maxHp() * ev.v);
        break;
      case 'shake':
        this.cam.shake(ev.v);
        break;
      case 'plunge':
        p.startPlunge(ev.vy, ev.m * dm, ev.r * sz, ev.el, ev.st);
        break;
      case 'nova':
        this.nova(p.cx, p.cy, ev.r * sz, ev.m * dm, this.kindOf(k), ev.el, ev.st, ev.up ?? -1.5);
        break;
      case 'chain':
        this.chain(p.cx, p.cy, ev.n + mod.count, ev.m * dm, this.kindOf(k));
        break;
    }
  }

  plungeImpact(m: number, r: number, el?: string, st?: string): void {
    const p = this.player;
    const y = p.b.y + p.b.h;
    this.nova(p.cx, y - 10, r, m, 'air', el as Element | undefined, st as StatusId | undefined, -3);
    this.cam.shake(Math.min(8, 3 + r / 12));
    this.fx.dust(p.cx, y, 14);
    this.fx.ring(p.cx, y - 4, p.def.fx, r);
    audio.play('hit_power', 0.7);
    this.breakTiles({ x: p.cx - r / 2, y: y - 20, w: r, h: 30 });
  }

  // ─────────── 피해 처리 ───────────
  hitEnemiesBox(r: Rect, o: HitOpts): number {
    let n = 0;
    for (const e of this.allEnemies()) {
      if (e.dead || e.state === 'spawn' || !overlap(e.b, r)) continue;
      this.damageEnemy(e, o);
      n++;
    }
    return n;
  }

  breakTiles(r: Rect): void {
    const tx0 = Math.floor(r.x / TS);
    const tx1 = Math.floor((r.x + r.w) / TS);
    const ty0 = Math.floor(r.y / TS);
    const ty1 = Math.floor((r.y + r.h) / TS);
    for (let ty = ty0; ty <= ty1; ty++)
      for (let tx = tx0; tx <= tx1; tx++) {
        if (this.world.get(tx, ty) !== Tile.Break) continue;
        const broke = this.world.hitBreak(tx, ty);
        this.fx.burst(tx * TS + 8, ty * TS + 8, this.ch.tile[1], broke ? 14 : 4, broke ? 2.5 : 1.2, { grav: 0.2 });
        audio.play(broke ? 'crumble' : 'hit_guard', broke ? 1 : 1.5);
        if (broke) {
          this.cam.shake(2);
          for (const p of this.props) {
            if (p.kind === 'chest' && p.hidden && Math.abs(p.x - (tx * TS + 8)) < 48 && Math.abs(p.y - (ty + 1) * TS) < 40) {
              p.hidden = false;
              this.hooks.toast?.('숨겨진 보물을 발견했다!', '#ffe080');
              this.run.stats.hidden++;
              audio.play('gem');
            }
          }
        }
      }
  }

  damageEnemy(e: Enemy, o: HitOpts): number {
    if (e.dead) return 0;
    if (e instanceof Boss && e.invulnerable) {
      if (!o.proc) {
        this.fx.sparks(e.cx, e.cy, -o.dir, '#ffffff', 3);
        audio.play('clang', 1.4);
      }
      return 0;
    }
    if (e.state === 'spawn') return 0;
    const p = this.player;
    let blockedMul = 1;
    if (!o.proc && e.blocks(o.dir) && o.kind !== 'skill' && o.kind !== 'swap') {
      blockedMul = 0.15;
      e.guardHits++;
      this.fx.sparks(e.cx - o.dir * 6, e.cy, -o.dir, '#ffe8a0', 6);
      audio.play('clang');
      if (e.guardHits >= 4) {
        e.state = 'stun';
        e.st = 150;
        e.guardHits = 0;
        e.vuln = 0.5;
        this.toastWorld(e.cx, e.b.y - 8, '방어 붕괴!', '#ffe080');
        audio.play('hit_guard', 0.6);
      }
    }
    const st = this.stats;
    const vuln = (e.state === 'stun' ? e.vuln : 0) + (e.status.freeze ? 0 : 0);
    const r = computeDamage({
      base: p.atk(),
      mult: o.m,
      stats: st,
      kind: o.kind,
      critRoll: Math.random(),
      varRoll: Math.random(),
      target: { def: e.defense, statuses: e.stacks, boss: e.isBoss, elite: e.elite, vuln },
      canCrit: o.kind !== 'dot',
    });
    let dmg = Math.max(1, Math.round(r.dmg * blockedMul));
    if (e.def.ai === 'dummy') {
      e.dmgTaken += dmg;
      e.dpsWindow.push({ t: this.time, d: dmg });
    } else e.hp -= dmg;
    if (this.init.mode === 'run') this.run.stats.dmg += dmg;
    e.flash = o.kind === 'dot' ? 2 : 6;
    e.lastHitT = this.time;
    // 수치
    const col = o.kind === 'dot' ? ELEM_COL[o.el ?? 'phys'] : r.crit ? '#ffd040' : o.kind === 'swap' ? '#a0ffd0' : o.kind === 'skill' ? '#c0e0ff' : '#ffffff';
    this.fx.number(e.cx, e.b.y - 2, o.label ? `${o.label} ${dmg}` : dmg, col, r.crit, o.kind === 'dot' ? 6 : 7);
    if (o.kind !== 'dot') {
      // 타격감
      const elc = ELEM_COL[o.el ?? 'phys'];
      this.fx.sparks(e.cx, e.cy, o.dir || 1, r.crit ? '#ffd040' : elc, r.crit ? 9 : 5);
      this.fx.glow(e.cx, e.cy, elc, r.crit ? 22 : 14, 8);
      if (!o.proc) {
        const hs = Math.round(o.hs + (r.crit ? 2 : 0) + (o.kind === 'finisher' ? 2 : 0));
        this.hitstop = Math.max(this.hitstop, Math.min(14, hs));
        audio.play(TYPE_SFX[p.def.type], o.kind === 'finisher' ? 0.8 : 1);
        if (r.crit) audio.play('hit_crit');
        if (o.shake) this.cam.shake(o.shake, 8);
        else if (o.hs >= 6) this.cam.shake(o.hs * 0.35, 6);
        this.combo++;
        this.comboT = 150;
        if (this.init.mode === 'run') this.run.stats.maxCombo = Math.max(this.run.stats.maxCombo, this.combo);
      } else audio.play('enemy_hurt', 1.3);
      // 넉백/띄우기/경직
      const kbRes = e.kbRes;
      if (!e.isBoss && e.def.ai !== 'dummy') {
        if (o.kb) e.b.vx = (o.dir || Math.sign(e.cx - p.cx) || 1) * o.kb * (1 - kbRes) * (o.kb < 0 ? -1 * -1 : 1);
        if (o.kb < 0) e.b.vx = Math.sign(p.cx - e.cx) * Math.min(Math.abs(p.cx - e.cx) / 8, -o.kb) * (1 - kbRes * 0.5);
        if (o.up) {
          e.b.vy = o.up * (1 - kbRes);
          e.b.onGround = false;
        } else if (!e.b.onGround && !e.flying) e.b.vy = Math.min(e.b.vy, -1.2);
        const heavy = o.hs >= 6 || o.kind === 'swap' || o.kind === 'finisher';
        if (!o.proc && e.state !== 'stun' && (!e.elite || heavy) && (!e.attacking || !e.elite)) {
          if (e.state !== 'atk' || !e.elite) {
            e.state = 'hurt';
            e.st = o.stn ?? (heavy ? 22 : 14);
          }
        }
      }
    }
    // 상태이상
    if (o.st) e.applyStatus(o.st, 1, this);
    // 흡혈
    const ls = st.lifesteal ?? 0;
    if (ls > 0 && o.kind !== 'dot') this.heal(dmg * ls, true);
    // 트리거
    if (!o.proc && !o.noTrigger && o.kind !== 'dot') {
      const ctx: TriggerCtx = { target: e, dmg };
      this.build.fire('hit', ctx, Math.random);
      if (r.crit) this.build.fire('crit', ctx, Math.random);
      if (o.kind === 'finisher') this.build.fire('finisher', ctx, Math.random);
      if (o.kind === 'skill') this.build.fire('skillHit', ctx, Math.random);
      if (o.kind === 'air') this.build.fire('airHit', ctx, Math.random);
      if (o.kind === 'swap') {
        this.build.fire('swapHit', ctx, Math.random);
        if (!p.swapHitDone) {
          p.swapHitDone = true;
          this.slowT = 22;
          this.slowScale = 0.3;
          this.flash('#ffffff', 0.25);
          audio.play('swap_hit');
          if (this.init.mode === 'run') {
            this.run.stats.swapHits++;
          }
        }
      }
    }
    if (e.hp <= 0 && e.def.ai !== 'dummy') this.killEnemy(e);
    return dmg;
  }

  dot(e: Enemy, mult: number, el: Element, col: string): void {
    void col;
    this.damageEnemy(e, { m: mult, kind: 'dot', el, kb: 0, up: 0, hs: 0, dir: 0, proc: true });
  }

  killEnemy(e: Enemy): void {
    if (e.dead) return;
    e.dead = true;
    e.deadT = 0;
    e.hp = 0;
    this.fx.burst(e.cx, e.cy, e.def.col, e.isBoss ? 60 : 18, e.isBoss ? 4 : 2.5);
    this.fx.souls(e.cx, e.cy, this.soulTarget, e.isBoss ? 30 : 5);
    this.fx.ring(e.cx, e.cy, e.def.col, 26);
    audio.play('kill', e.isBoss ? 0.5 : 1);
    this.hitstop = Math.max(this.hitstop, e.isBoss ? 30 : 4);
    if (this.init.mode === 'run') {
      this.run.stats.kills++;
    }
    const ctx: TriggerCtx = { target: e, x: e.cx, y: e.cy };
    if (!e.minion || this.init.mode === 'run') this.build.fire('kill', ctx, Math.random);
    const bs = this.build.flag('burnSpread');
    if (bs && e.stacks.burn) {
      this.explode(e.cx, e.cy, 44, bs, 'proc', 'fire', 'burn');
      audio.play('explode', 1.3);
    }
    if (this.build.flag('poisonCloud') && e.stacks.poison) {
      this.addField('player', { vis: 'poison', w: 56, h: 30, life: 180, tick: 20, m: 0.3, st: 'poison', el: 'poison' }, e.cx - 28, e.cy - 15, 1, 'proc');
    }
    // 드롭
    if (this.init.mode === 'run' && !e.isBoss) {
      const goldMul = 1 + (this.stats.gold ?? 0);
      const g = Math.round((e.minion ? 1 : e.def.gold) * (e.elite ? 4 : 1) * goldMul * (1 + this.ch.n * 0.15));
      const coins = Math.min(10, Math.max(1, Math.ceil(g / 3)));
      for (let i = 0; i < coins; i++) this.pickups.push(new Pickup('gold', e.cx, e.cy, Math.max(1, Math.round(g / coins))));
      const cr = e.elite ? 6 : Math.random() < 0.5 ? 2 : 1;
      this.pickups.push(new Pickup('crystal', e.cx, e.cy, cr));
      if (Math.random() < 0.04 + (e.elite ? 0.5 : 0)) this.pickups.push(new Pickup('stone', e.cx, e.cy, e.elite ? 8 : 4));
      if (Math.random() < 0.05) this.pickups.push(new Pickup('heal', e.cx, e.cy, 8));
    }
    // 마지막 적 처치: 짧은 슬로모션
    const remaining = this.allEnemies().filter((x) => !x.dead && x.def.ai !== 'dummy').length;
    if (remaining === 0 && !this.waves.length && this.init.mode === 'run') {
      this.slowT = e.isBoss ? 90 : 30;
      this.slowScale = 0.25;
      this.cam.shake(e.isBoss ? 10 : 3, e.isBoss ? 60 : 10);
      if (e.isBoss) this.flash('#ffffff', 1);
    }
  }

  soulTarget = { x: 0, y: 0 };

  explode(x: number, y: number, r: number, m: number, kind: DmgKind, el?: Element, st?: StatusId, up = -1.5): void {
    this.nova(x, y, r, m, kind, el, st, up);
  }

  nova(x: number, y: number, r: number, m: number, kind: DmgKind, el?: Element, st?: StatusId, up = -1.5): void {
    const col = ELEM_COL[el ?? 'phys'] ?? '#ffffff';
    this.fx.ring(x, y, col, r, 16);
    this.fx.glow(x, y, col, r * 0.9, 12);
    this.fx.burst(x, y, col, Math.min(30, Math.floor(r / 2)), r / 16);
    this.fx.light(x, y, r * 2, col, 12);
    const proc = kind === 'proc' || kind === 'dot';
    for (const e of this.allEnemies()) {
      if (e.dead || e.state === 'spawn') continue;
      const ex = Math.max(e.b.x, Math.min(x, e.b.x + e.b.w));
      const ey = Math.max(e.b.y, Math.min(y, e.b.y + e.b.h));
      if (Math.hypot(ex - x, ey - y) > r) continue;
      if (m > 0) this.damageEnemy(e, { m, kind, el, st, kb: 2, up, hs: proc ? 0 : 4, dir: Math.sign(e.cx - x) || 1, proc });
      else if (st) e.applyStatus(st, 1, this);
    }
    this.breakTiles({ x: x - r * 0.6, y: y - r * 0.6, w: r * 1.2, h: r * 1.2 });
  }

  chain(x: number, y: number, n: number, m: number, kind: DmgKind): void {
    const hit = new Set<Enemy>();
    let cx = x;
    let cy = y;
    for (let i = 0; i < n; i++) {
      let best: Enemy | null = null;
      let bd = 130;
      for (const e of this.allEnemies()) {
        if (e.dead || hit.has(e) || e.state === 'spawn') continue;
        const d = Math.hypot(e.cx - cx, e.cy - cy);
        if (d < bd) {
          bd = d;
          best = e;
        }
      }
      if (!best) break;
      hit.add(best);
      this.fx.lightning(cx, cy, best.cx, best.cy);
      this.damageEnemy(best, { m, kind: kind === 'normal' ? 'proc' : kind, el: 'thunder', st: 'shock', kb: 0.5, up: 0, hs: 0, dir: 0, proc: kind === 'proc' || kind === 'normal' });
      cx = best.cx;
      cy = best.cy;
    }
    if (hit.size) audio.play('thunder', 1.2);
  }

  meteor(x: number, m: number, el?: Element, st?: StatusId, big?: boolean, spr?: ProjDef['spr'], kind: DmgKind = 'skill'): void {
    const sx = x - 40;
    const sy = this.cam.y - 20;
    const gy = this.world.groundBelow(x, Math.max(10, this.player.b.y - 60));
    const ang = Math.atan2(gy - sy, x - sx);
    if (spr === 'arrow') {
      this.addProj('player', { spr: 'arrow', spd: 8, life: 70, w: 10, h: 4, col: '#e8d8a0', kb: 0.5 }, x - 20, sy, Math.atan2(gy - sy, 20), m, kind);
      return;
    }
    const r = big ? 70 : 24;
    this.addProj('player', { spr: big ? 'fireball' : 'star', spd: big ? 6 : 7, life: 120, w: big ? 22 : 9, h: big ? 22 : 9, col: el === 'fire' ? '#ff6a1a' : '#ffe680', boom: { r, m: 1, el: el ?? 'holy', st } }, sx, sy, ang, m, kind);
    if (big) this.later(40, () => this.cam.shake(8, 20));
  }

  // ─────────── 플레이어 피해 ───────────
  damagePlayer(raw: number, srcX: number, cause: string, o: { kb?: number; st?: StatusId } = {}): boolean {
    const p = this.player;
    if (p.state === 'dead' || this.god) return false;
    if (p.counterT > 0) {
      // 반격 성공
      p.counterT = 0;
      p.inv = 30;
      audio.play('parry');
      this.flash('#fff0a0', 0.6);
      this.slowT = 30;
      this.slowScale = 0.3;
      this.fx.ring(p.cx, p.cy, '#fff0a0', 50);
      this.toastWorld(p.cx, p.b.y - 12, '반격!', '#fff0a0');
      this.nova(p.cx, p.cy, 60, p.counterM, 'skill', 'holy', undefined, -3);
      this.fx.slash(p.cx, p.cy, p.facing, { arc: 'x', r: 34 }, '#fff0a0');
      this.build.fire('parry', {}, Math.random);
      return false;
    }
    if (p.invulnerable()) return false;
    let dmg = computeTaken(raw, this.stats, this.run.curse);
    if (this.run.shield > 0) {
      const ab = Math.min(this.run.shield, dmg);
      this.run.shield -= ab;
      dmg -= ab;
      this.fx.burst(p.cx, p.cy, '#ffd76a', 8, 2);
      audio.play('hit_guard', 1.3);
    }
    if (dmg > 0) {
      this.run.hp -= dmg;
      this.fx.number(p.cx, p.b.y - 4, dmg, '#ff4a4a', false, 8);
    }
    if (this.init.mode === 'run') this.run.stats.bossNoHit = this.run.stats.bossNoHit && !(this.boss && !this.boss.dead);
    if (this.boss && !this.boss.dead) this.bossHit = true;
    const dir = Math.sign(p.cx - srcX) || -p.facing;
    p.hurt(dir, o.kb ?? 2.5);
    this.hurtVignette = 30;
    this.hitstop = Math.max(this.hitstop, 6);
    this.cam.shake(4, 12);
    audio.play('hurt');
    this.fx.burst(p.cx, p.cy, '#ff3040', 10, 2.5);
    if (o.st === 'burn') p.dot.burn = 120;
    if (o.st === 'poison') p.dot.poison = 180;
    this.combo = 0;
    this.build.fire('hurt', {}, Math.random);
    const hw = this.build.flag('hurtWave');
    if (hw) this.nova(p.cx, p.cy, 54, hw, 'proc', 'shadow', undefined, -2);
    if (this.run.hp <= 0) this.playerDown(cause);
    return true;
  }

  bossHit = false;

  private playerDown(cause: string): void {
    const p = this.player;
    if (this.init.mode !== 'run') {
      this.run.hp = this.maxHp();
      return;
    }
    if (this.build.flag('revive') > 0 && !this.run.relics.includes('__phoenix_used')) {
      this.run.relics.push('__phoenix_used');
      this.revive(0.4, '불사조의 깃털이 타올랐다!');
      return;
    }
    if (this.run.revives > 0) {
      this.run.revives--;
      this.revive(0.5, '두 번째 숨결!');
      return;
    }
    this.run.hp = 0;
    this.run.stats.cause = cause;
    p.die();
    audio.play('death');
    this.slowT = 80;
    this.slowScale = 0.3;
  }

  private revive(pct: number, msg: string): void {
    this.run.hp = Math.round(this.maxHp() * pct);
    this.player.inv = 150;
    this.flash('#ffb060', 1);
    this.nova(this.player.cx, this.player.cy, 90, 2, 'proc', 'fire', 'burn', -4);
    this.hooks.toast?.(msg, '#ffb060');
    audio.play('heal');
  }

  enemyHit(r: Rect, dmg: number, srcX: number, cause: string): void {
    if (this.player.overlaps(r)) this.damagePlayer(Math.round(dmg), srcX, cause);
  }

  enemyExplode(x: number, y: number, r: number, dmg: number, st?: StatusId): void {
    const col = st === 'poison' ? '#8bdc3a' : st === 'burn' ? '#ff7a2a' : '#ff5060';
    this.fx.ring(x, y, col, r, 16);
    this.fx.burst(x, y, col, 16, r / 16);
    const p = this.player;
    const ex = Math.max(p.b.x, Math.min(x, p.b.x + p.b.w));
    const ey = Math.max(p.b.y, Math.min(y, p.b.y + p.b.h));
    if (Math.hypot(ex - x, ey - y) <= r) this.damagePlayer(Math.round(dmg), x, '폭발', { st, kb: 3.5 });
  }

  selfDot(pct: number, col: string, cause: string): void {
    if (this.player.state === 'dead') return;
    const d = Math.max(1, Math.round(this.maxHp() * pct));
    this.run.hp -= d;
    this.fx.number(this.player.cx, this.player.b.y, d, col, false, 6);
    if (this.run.hp <= 0) this.playerDown(cause);
  }

  hazardHit(t: Tile): void {
    const p = this.player;
    if (p.inv > 0 || p.state === 'dead') return;
    const dmg = Math.round(this.maxHp() * (t === Tile.Lava ? 0.12 : 0.1));
    this.run.hp -= dmg;
    this.fx.number(p.cx, p.b.y, dmg, '#ff4a4a');
    p.inv = 60;
    p.flash = 10;
    p.b.vy = -6.2;
    p.jumps = Math.max(p.jumps, 1);
    this.cam.shake(3);
    audio.play(t === Tile.Lava ? 'burn' : 'spike');
    audio.play('hurt');
    this.hurtVignette = 30;
    if (t === Tile.Lava) p.dot.burn = 90;
    if (this.run.hp <= 0) this.playerDown(t === Tile.Lava ? '용암' : '가시 함정');
  }

  fellOut(): void {
    const p = this.player;
    p.b.x = this.lastSafe.x;
    p.b.y = this.lastSafe.y - 30;
    p.b.vy = 0;
    this.hazardHit(Tile.Spike);
  }

  lastSafe = { x: 40, y: 200 };

  heal(v: number, quiet = false): void {
    const before = this.run.hp;
    this.run.hp = Math.min(this.maxHp(), this.run.hp + v);
    const d = Math.round(this.run.hp - before);
    if (d > 0 && !quiet) {
      this.fx.number(this.player.cx, this.player.b.y - 6, `+${d}`, '#60ff80');
      this.fx.burst(this.player.cx, this.player.cy, '#60ff80', 10, 1.5);
      audio.play('heal');
    }
  }

  addShield(v: number): void {
    this.run.shield = Math.min(this.maxHp(), this.run.shield + Math.round(v));
    audio.play('shield');
    this.fx.ring(this.player.cx, this.player.cy, '#ffd76a', 22);
  }

  // ─────────── 생성 ───────────
  addProj(team: 'player' | 'enemy', def: ProjDef, x: number, y: number, ang: number, mult: number, kind: DmgKind): Projectile {
    const p = new Projectile(team, def, x, y, ang, mult, kind);
    this.projs.push(p);
    return p;
  }

  addField(team: 'player' | 'enemy', def: FieldDef, x: number, y: number, mult: number, kind: DmgKind): Field {
    const f = new Field(team, def, x, y, mult, kind);
    this.fields.push(f);
    return f;
  }

  summon(s: SummonDef, n: number, dm = 1): void {
    const max = s.max ?? 99;
    for (let i = 0; i < n; i++) {
      const same = this.summons.filter((x) => x.def.kind === s.kind);
      if (same.length >= max) same[0].life = 0;
      const x = this.player.cx + (i - (n - 1) / 2) * 16 - this.player.facing * 10;
      const sm = new Summon(s, x, this.player.b.y + this.player.b.h, s.m * dm, this.summons.length + i);
      this.summons.push(sm);
      this.fx.burst(sm.cx, sm.cy, s.kind === 'skeleton' ? '#b0ff90' : '#ffe680', 12, 2);
    }
  }

  spawnMinions(src: Enemy, n: number, id?: string): void {
    const pool = enemyPool(this.ch.n).filter((d) => !d.flying);
    const alive = this.enemies.filter((e) => !e.dead && e.minion).length;
    for (let i = 0; i < n && alive + i < 4; i++) {
      const def = id ? ENEMY_MAP[id] : pool[Math.floor(Math.random() * pool.length)];
      const x = Math.max(30, Math.min(this.world.pxW - 30, src.cx + (i % 2 ? 1 : -1) * (30 + i * 16)));
      const gy = this.world.groundBelow(x, src.b.y);
      const e = new Enemy(def, x, gy, false, this.ch.n, this.run.curseEnemy, 0);
      e.minion = true;
      e.maxHp = e.hp = Math.round(e.maxHp * 0.6);
      e.st = 40;
      this.enemies.push(e);
    }
    audio.play('cast', 0.5);
  }

  collect(p: Pickup): void {
    p.dead = true;
    const run = this.run;
    switch (p.kind as PickupKind) {
      case 'gold':
        run.gold += p.value;
        audio.play('coin', 1 + Math.random() * 0.2);
        break;
      case 'stone':
        run.stats.stones += p.value;
        this.fx.number(this.player.cx, this.player.b.y - 8, `영혼석 +${p.value}`, '#9ec0ff');
        audio.play('gem');
        break;
      case 'crystal':
        run.stats.crystals += p.value;
        audio.play('soul', 1.4);
        break;
      case 'heal':
        this.heal(this.maxHp() * 0.08);
        break;
      case 'relicOrb':
        audio.play('relic');
        this.hooks.onRelicOrb?.();
        break;
    }
  }

  dropReward(kind: PickupKind, x: number, y: number, total: number, pieces: number): void {
    for (let i = 0; i < pieces; i++) this.pickups.push(new Pickup(kind, x, y, Math.max(1, Math.round(total / pieces))));
  }

  // ─────────── 효과 프리미티브 실행 ───────────
  private execEffect(d: EffectDo, ctx: TriggerCtx): void {
    const p = this.player;
    const tgt = ctx.target as Enemy | undefined;
    const tx = tgt ? tgt.cx : ctx.x ?? p.cx;
    const ty = tgt ? tgt.cy : ctx.y ?? p.cy;
    switch (d.k) {
      case 'status':
        if (tgt && !tgt.dead) tgt.applyStatus(d.s, d.n ?? 1, this);
        break;
      case 'explode':
        this.explode(tx, ty, d.r, d.m, 'proc', d.el, d.st);
        audio.play('explode', 1.4);
        break;
      case 'chain':
        this.chain(tx, ty, d.n, d.m, 'proc');
        break;
      case 'heal':
        this.heal(this.maxHp() * d.v);
        break;
      case 'shield':
        this.addShield(this.maxHp() * d.v);
        break;
      case 'proj': {
        const n = d.n ?? 1;
        const e = this.nearestEnemy(p.cx, p.cy, 300);
        const base = e ? Math.atan2(e.cy - p.cy, e.cx - p.cx) : p.facing > 0 ? 0 : Math.PI;
        for (let i = 0; i < n; i++) this.addProj('player', d.p, p.cx, p.cy - 6, base + (i - (n - 1) / 2) * 0.35 - (d.p.home ? Math.PI / 2 * 0 : 0), d.m, 'proc');
        break;
      }
      case 'buff':
        this.build.addBuff(d.id, d.stats, d.dur, d.max ?? 1);
        break;
      case 'cdr':
        p.skillCd[0] = Math.max(0, p.skillCd[0] - d.v);
        p.skillCd[1] = Math.max(0, p.skillCd[1] - d.v);
        break;
      case 'swapCd':
        p.swapCd = Math.max(0, p.swapCd - d.v);
        break;
      case 'echo': {
        const targets = this.allEnemies().filter((e) => !e.dead && e.state !== 'spawn' && Math.hypot(e.cx - p.cx, e.cy - p.cy) < 110).slice(0, 4);
        for (const e of targets) {
          this.fx.ghost(p.frame(), e.cx - 24 - p.facing * 10, e.b.y + e.b.h - 44, p.facing < 0, '#9a6bff', 14);
          this.fx.slash(e.cx, e.cy, p.facing, { arc: 'x', r: 16, col: '#c0a0ff' }, '#c0a0ff');
          this.damageEnemy(e, { m: d.m, kind: 'proc', el: 'shadow', kb: 1, up: 0, hs: 0, dir: p.facing, proc: true });
        }
        if (targets.length) audio.play('swing', 1.4);
        break;
      }
      case 'wave':
        this.addProj('player', { spr: 'wave', spd: 4.5, life: 40, w: 14, h: 20, col: p.def.fx, ground: true, pierce: 99, kb: 2, up: -2 }, p.cx + p.facing * 14, p.b.y + p.b.h - 10, p.facing > 0 ? 0 : Math.PI, d.m, 'proc');
        break;
      case 'gold':
        this.run.gold += d.v;
        break;
      case 'strike': {
        const e = tgt && !tgt.dead ? tgt : this.nearestEnemy(p.cx, p.cy, 260);
        if (!e) break;
        this.fx.lightning(e.cx + (Math.random() - 0.5) * 10, this.cam.y, e.cx, e.cy, '#bff0ff');
        this.fx.light(e.cx, e.cy, 80, '#bff0ff', 10);
        this.damageEnemy(e, { m: d.m, kind: 'proc', el: d.el ?? 'thunder', st: 'shock', kb: 0, up: -1, hs: 0, dir: 0, proc: true });
        audio.play('thunder');
        break;
      }
      case 'nova':
        this.nova(p.cx, p.cy, d.r, d.m, 'proc', d.el, d.st);
        break;
      case 'slowTime':
        this.enemySlow = Math.round(d.dur * 60);
        this.flash('#ffe8a0', 0.3);
        audio.play('timestop', 1.5);
        break;
      case 'meteor': {
        const e = this.nearestEnemy(p.cx, p.cy, 280);
        if (e) this.meteor(e.cx, d.m, 'holy', undefined, false, undefined, 'proc');
        break;
      }
      case 'summon':
        this.summon(d.s, 1);
        break;
    }
  }

  // ─────────── 이벤트 연결 ───────────
  onDash(): void {
    this.build.fire('dash', {}, Math.random);
    const dt = this.build.flag('dashThrough');
    if (dt) {
      const p = this.player;
      this.later(6, () => {
        const r = { x: p.cx - 50, y: p.b.y, w: 100, h: p.b.h };
        this.hitEnemiesBox(r, { m: dt, kind: 'proc', el: 'shadow', kb: 0.5, up: 0, hs: 0, dir: p.facing, proc: true });
      });
    }
  }

  onSkill(): void {
    this.build.fire('skill', {}, Math.random);
  }

  swapActive(): void {
    this.run.active = 1 - this.run.active;
    this.rebuild();
    this.build.fire('swap', {}, Math.random);
  }

  // ─────────── 연출 도우미 ───────────
  flash(col: string, a: number): void {
    this.flashCol = col;
    this.flashA = Math.max(this.flashA, a);
  }
  marker(x: number, y: number, w: number, h: number, dur: number, col: string, fill = false): void {
    this.markers.push({ x, y, w, h, t: 0, max: dur, col, fill });
  }
  later(t: number, fn: () => void): void {
    this.timers.push({ t: Math.max(1, t), fn });
  }
  spike(x: number, gy: number, col: string): void {
    for (let i = 0; i < 8; i++) this.fx.parts.push({ x: x + (Math.random() - 0.5) * 14, y: gy, vx: (Math.random() - 0.5) * 0.6, vy: -3 - Math.random() * 3, life: 0, max: 20, col, size: 2, grav: 0.2, kind: 'px', drag: 0.95 });
    this.fx.parts.push({ x, y: gy - 25, vx: 0, vy: 0, life: 0, max: 18, col, size: 50, grav: 0, kind: 'ring', drag: 1 });
  }
  bossPhaseBanner(n: number): void {
    this.bossBanner = 120;
    this.bossBannerText = `제${n + 1}페이즈`;
  }
  bossShout(text: string, col: string): void {
    this.shout = { text, col, t: 150 };
  }
  toastWorld(x: number, y: number, text: string, col: string): void {
    this.texts.push({ x, y, text, col, t: 0 });
  }
  pactPool(): string[] {
    const owned = Object.keys(this.save.chars);
    const ids = [...new Set([...this.party.map((p) => p.id), ...owned])].filter((id) => CHAR_MAP[id]);
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    return ids;
  }

  // ─────────── 렌더 ───────────
  render(g: CanvasRenderingContext2D): void {
    const cx = Math.round(this.cam.x);
    const cy = Math.round(this.cam.y);
    const t = this.time;
    if (this.player.b.onGround && this.player.state !== 'dead') this.lastSafe = { x: this.player.b.x, y: this.player.b.y };
    this.soulTarget.x = this.player.cx;
    this.soulTarget.y = this.player.cy;
    drawBackground(g, this.init.mode === 'hub' ? 'hub' : this.ch, cx, cy);
    // 횃불 (뒤)
    for (const tc of this.torches) {
      const x = tc.x - cx;
      const y = tc.y - cy;
      if (x < -20 || x > W + 20) continue;
      g.fillStyle = '#3a2a1a';
      g.fillRect(x - 1, y, 3, 8);
      g.fillStyle = '#5a4a3a';
      g.fillRect(x - 3, y - 1, 7, 2);
      const fl = (t >> 2) % 3;
      g.fillStyle = '#ff6a1a';
      g.fillRect(x - 2, y - 6 + fl * 0, 5, 5);
      g.fillStyle = '#ffd040';
      g.fillRect(x - 1, y - 5 - fl, 3, 4);
      g.fillStyle = '#fff0b0';
      g.fillRect(x, y - 3, 1, 2);
    }
    this.world.render(g, this.ch, cx, cy, t);
    // 시설
    for (const p of this.props) this.renderProp(g, p, cx, cy, t);
    for (const f of this.fields) f.render(g, cx, cy, t);
    for (const p of this.pickups) p.render(g, cx, cy, t);
    const skelLook = ENEMY_LOOKS.skeleton;
    for (const s of this.summons)
      s.render(g, cx, cy, t, (pose) => lookFrame('summon_skel', { ...skelLook, glow: '#7aff6a', eye: '#7aff6a', trim: '#7aff6a' }, pose < 0 ? 'idle0' : (['run0', 'run1', 'run2', 'run3', 'run4', 'run5'] as const)[pose]));
    for (const e of this.enemies) e.render(g, cx, cy, t);
    this.boss?.render(g, cx, cy, t);
    this.fx.renderBack(g, cx, cy);
    this.player.render(g, cx, cy, t);
    for (const p of this.projs) p.render(g, cx, cy, t);
    this.fx.renderFront(g, cx, cy);
    // 예고 표시
    for (const m of this.markers) {
      const a = (t >> 2) % 2 ? 0.9 : 0.45;
      g.fillStyle = rgba(m.col, m.fill ? a * 0.28 : a);
      g.fillRect(Math.round(m.x - cx), Math.round(m.y - cy), Math.round(m.w), Math.round(m.h));
      if (m.fill) {
        g.fillStyle = rgba(m.col, a);
        g.fillRect(Math.round(m.x - cx), Math.round(m.y - cy), Math.round(m.w), 1);
        g.fillRect(Math.round(m.x - cx), Math.round(m.y + m.h - 1 - cy), Math.round(m.w), 1);
      }
    }
    this.renderLighting(g, cx, cy);
    // 시간 정지 / 둔화 색조
    if (this.timestop > 0) {
      g.fillStyle = 'rgba(120,150,255,0.18)';
      g.fillRect(0, 0, W, H);
    } else if (this.enemySlow > 0) {
      g.fillStyle = 'rgba(255,230,150,0.08)';
      g.fillRect(0, 0, W, H);
    }
    if (this.flashA > 0) {
      g.fillStyle = rgba(this.flashCol, this.flashA * 0.6);
      g.fillRect(0, 0, W, H);
    }
    if (this.hurtVignette > 0 || this.run.hp < this.maxHp() * 0.25) {
      const a = this.hurtVignette > 0 ? this.hurtVignette / 30 : 0.25 + 0.15 * Math.sin(t * 0.1);
      const gr = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.85);
      gr.addColorStop(0, 'rgba(255,0,0,0)');
      gr.addColorStop(1, `rgba(200,0,20,${0.55 * a})`);
      g.fillStyle = gr;
      g.fillRect(0, 0, W, H);
    }
    if (this.showHitboxes) {
      g.lineWidth = 1;
      for (const b of this.debugBoxes) {
        g.strokeStyle = b.col;
        g.strokeRect(Math.round(b.x - cx) + 0.5, Math.round(b.y - cy) + 0.5, b.w, b.h);
      }
      g.strokeStyle = '#40a0ff';
      g.strokeRect(Math.round(this.player.b.x - cx) + 0.5, Math.round(this.player.b.y - cy) + 0.5, this.player.b.w, this.player.b.h);
      g.strokeStyle = '#ffa040';
      for (const e of this.allEnemies()) g.strokeRect(Math.round(e.b.x - cx) + 0.5, Math.round(e.b.y - cy) + 0.5, e.b.w, e.b.h);
      g.strokeStyle = '#ff40ff';
      for (const p of this.projs) g.strokeRect(Math.round(p.x - p.w / 2 - cx) + 0.5, Math.round(p.y - p.h / 2 - cy) + 0.5, p.w, p.h);
    }
  }

  private renderLighting(g: CanvasRenderingContext2D, cx: number, cy: number): void {
    const dark = Math.min(0.85, this.ch.dark + this.darkBoost) * (this.init.mode === 'hub' ? 0.6 : 1);
    if (dark <= 0) return;
    const l = this.lightG;
    l.globalCompositeOperation = 'source-over';
    l.clearRect(0, 0, W, H);
    l.fillStyle = rgba(this.ch.ambient, dark);
    l.fillRect(0, 0, W, H);
    l.globalCompositeOperation = 'destination-out';
    const hole = (x: number, y: number, r: number, a = 1): void => {
      if (x < -r || x > W + r || y < -r || y > H + r) return;
      const gr = l.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, `rgba(0,0,0,${a})`);
      gr.addColorStop(0.6, `rgba(0,0,0,${a * 0.6})`);
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      l.fillStyle = gr;
      l.fillRect(x - r, y - r, r * 2, r * 2);
    };
    hole(this.player.cx - cx, this.player.cy - cy, 120);
    const flick = Math.sin(this.time * 0.3) * 4 + Math.sin(this.time * 0.13) * 3;
    for (const tc of this.torches) hole(tc.x - cx, tc.y - cy, 70 + flick);
    for (const p of this.projs) hole(p.x - cx, p.y - cy, 30, 0.7);
    for (const f of this.fields) if (f.def.vis === 'fire' || f.def.vis === 'holy' || f.def.vis === 'thunder') hole(f.x + f.w / 2 - cx, f.y + f.h / 2 - cy, Math.max(f.w, 40), 0.6);
    for (const lt of this.fx.lights) hole(lt.x - cx, lt.y - cy, lt.r, 1 - lt.life / lt.max);
    for (const p of this.props) if (p.kind === 'door' && p.open) hole(p.x - cx, p.y - 18 - cy, 40, 0.6);
    if (this.boss && !this.boss.dead) hole(this.boss.cx - cx, this.boss.cy - cy, 90, 0.7);
    for (const e of this.enemies) if (!e.dead && (e.def.id === 'fire_sprite' || e.def.id === 'magma_golem' || e.def.id === 'forge_hound')) hole(e.cx - cx, e.cy - cy, 50, 0.7);
    // 용암 빛
    if (this.ch.n === 3) for (let x = 0; x < W; x += 40) hole(x + 20, H - 10 + (this.world.pxH - H - cy), 60, 0.3);
    g.drawImage(this.light, 0, 0);
    // 광원 가산 글로우
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (const tc of this.torches) {
      const x = tc.x - cx;
      const y = tc.y - cy - 4;
      if (x < -60 || x > W + 60) continue;
      const gr = g.createRadialGradient(x, y, 0, x, y, 36 + flick);
      gr.addColorStop(0, rgba(this.ch.light, 0.28));
      gr.addColorStop(1, rgba(this.ch.light, 0));
      g.fillStyle = gr;
      g.fillRect(x - 40, y - 40, 80, 80);
    }
    this.fx.renderLights(g, cx, cy);
    g.restore();
  }

  private renderProp(g: CanvasRenderingContext2D, p: Prop, cx: number, cy: number, t: number): void {
    let img: HTMLCanvasElement | null = null;
    switch (p.kind) {
      case 'door':
        img = propSprite(p.open ? 'door_open' : 'door_closed');
        break;
      case 'chest':
        if (p.hidden) return;
        img = propSprite(p.used ? 'chest_open' : 'chest');
        break;
      case 'shop':
        img = propSprite('shopkeeper');
        break;
      case 'altar':
        img = propSprite('altar', Math.floor(t / 8) % 6);
        break;
      case 'armory':
        img = propSprite('anvil');
        break;
      case 'rest':
        img = propSprite('campfire', Math.floor(t / 6) % 3);
        break;
      case 'event':
        img = propSprite('question');
        break;
      case 'sign':
        img = propSprite('sign');
        break;
      case 'hub': {
        const m: Record<string, string> = { ach: 'stele', codex: 'book', gacha: 'altar', portal: 'portal', loadout: 'banner', growth: 'crystal', upgrade: 'anvil', dummy: 'banner' };
        if (p.hub === 'dummy') return;
        img = propSprite(m[p.hub ?? ''] ?? 'stele', p.hub === 'portal' ? Math.floor(t / 6) % 12 : p.hub === 'gacha' ? Math.floor(t / 8) % 6 : 0);
        break;
      }
    }
    if (!img) return;
    const x = Math.round(p.x - img.width / 2 - cx);
    const y = Math.round(p.y - img.height - cy);
    if (x < -img.width || x > W) return;
    if ((p.kind === 'hub' && (p.hub === 'gacha' || p.hub === 'portal')) || p.kind === 'altar' || (p.kind === 'door' && p.open)) {
      g.save();
      g.globalCompositeOperation = 'lighter';
      const gr = g.createRadialGradient(x + img.width / 2, y + img.height / 2, 0, x + img.width / 2, y + img.height / 2, 30);
      const col = p.hub === 'portal' || p.kind === 'door' ? '#9a6bff' : '#9ef0ff';
      gr.addColorStop(0, rgba(col, 0.35 + 0.1 * Math.sin(t * 0.08)));
      gr.addColorStop(1, rgba(col, 0));
      g.fillStyle = gr;
      g.fillRect(x - 20, y - 20, img.width + 40, img.height + 40);
      g.restore();
    }
    g.drawImage(img, x, y);
    if (p.kind === 'chest' && !p.used && p.label === 'big') {
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = rgba('#ffe080', 0.2 + 0.1 * Math.sin(t * 0.1));
      g.fillRect(x - 2, y - 2, img.width + 4, img.height + 4);
      g.restore();
    }
  }
}
