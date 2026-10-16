import { app, type Scene } from '../app';
import { audio } from '../core/audio';
import { BOSS_MAP } from '../data/bosses';
import { CHAR_MAP } from '../data/characters';
import { chapterDef, ITEM_MAP } from '../data/meta';
import { RELIC_MAP } from '../data/relics';
import { ROOMS } from '../data/rooms';
import { text } from '../gfx/renderer';
import { Room } from '../game/room';
import type { RunState } from '../game/run';
import { markAch } from '../game/meta';
import { Hud } from '../ui/hud';
import { RELIC_RARITY_COL } from '../ui/theme';
import { readPlayerInput } from './common';
import { AltarOverlay, ArmoryOverlay, BuildOverlay, EventOverlay, PauseOverlay, RelicChoice, RestOverlay, ShopOverlay, type Overlay } from './overlays';
import { NO_INPUT } from '../game/player';
import { ENEMY_MAP } from '../data/enemies';
import { Enemy } from '../game/enemy';
import { Pickup, type Prop } from '../game/entities';
import { ResultScene } from './result';
import { SettingsScene } from './settings';
import { ControlsScene } from './controls';
import { snapRun, type RunSnap } from '../game/runsave';

/** 런 진행 장면: 방 이동, 보상, 오버레이, HUD */
export class RunScene implements Scene {
  room!: Room;
  hud = new Hud();
  overlay: Overlay | null = null;
  started = false;
  card = { title: '', sub: '', t: 0 };
  trans = 0;
  transTarget: number | null = null;
  lastTemplate = '';
  stock = new Map<number, ReturnType<typeof ShopOverlay.makeStock>>();
  ended = false;
  nextTheme = 0;
  bossCard = 0;

  /** 이어하기용: 현재 방에 들어가기 직전의 난수 상태·방 템플릿 기록 */
  private entryRng = 0;
  private entryTemplate = '';
  private bossDone = false;

  constructor(
    public run: RunState,
    private resume: RunSnap | null = null,
  ) {}

  enter(): void {
    if (this.started) return;
    this.started = true;
    if (this.resume) this.resumeRun(this.resume);
    else this.enterNode(0, true);
  }

  /** 저장된 런 이어하기: 같은 방을 같은 난수로 다시 만들고, 정화·사용 상태를 되돌린다 */
  private resumeRun(s: RunSnap): void {
    const run = this.run;
    this.lastTemplate = s.template;
    this.enterNode(run.cur, false, true);
    run.rng.state = s.rngNow;
    const room = this.room;
    room.props.filter((p) => p.kind !== 'door').forEach((p, i) => (p.used = s.room.used[i] ?? p.used));
    if (s.room.bossDown) {
      this.bossDone = true;
      room.boss = null;
      room.markCleared();
      this.exitDoors();
      audio.playMusic('none');
    } else if (s.room.cleared) room.markCleared();
    this.card = { title: '이어하기', sub: `제${run.chapter}장 ${chapterDef(run.theme).name}`, t: 120 };
    this.checkpoint();
  }

  /** 현재 런 상태 저장 (런 이어하기) */
  checkpoint(): void {
    if (this.ended || !this.room) return;
    // 보스 러시는 이어하기 저장을 하지 않는다 (중간에 나가면 기록만 남고 끝)
    if (this.run.bossRush) {
      app.save.run = null;
      return;
    }
    app.save.run = snapRun(this.run, {
      rngEntry: this.entryRng,
      template: this.entryTemplate,
      cleared: this.room.cleared,
      bossDown: this.bossDone,
      used: this.room.props.filter((p) => p.kind !== 'door').map((p) => p.used),
    });
    app.persist();
  }

  private template(type: string): typeof ROOMS[number] {
    if (type === 'tutorial') return ROOMS.find((r) => r.id === 'tutorial')!;
    if (type === 'boss') return ROOMS.find((r) => r.id === 'boss')!;
    if (type === 'combat' || type === 'elite' || type === 'start') {
      const pool = ROOMS.filter((r) => r.kind === 'combat' && r.id !== this.lastTemplate);
      const t = this.run.rng.pick(pool);
      this.lastTemplate = t.id;
      return t;
    }
    return ROOMS.find((r) => r.id === 's_room')!;
  }

  enterNode(id: number, chapterStart = false, resuming = false): void {
    const run = this.run;
    this.entryRng = run.rng.state;
    this.entryTemplate = this.lastTemplate;
    this.bossDone = false;
    run.cur = id;
    const node = run.nodes[id];
    node.visited = true;
    const ch = chapterDef(run.theme);
    const bossId = node.type === 'boss' ? ch.boss : undefined;
    const prevRoom = this.room as Room | undefined;
    this.room = new Room({ template: this.template(node.type), chapter: ch, mode: 'run', type: node.type, next: node.next, depth: node.layer, bossId }, run, app.save);
    if (prevRoom) this.room.combo = 0;
    this.room.debug = app.debug;
    this.room.showHitboxes = app.debug;
    this.room.god = prevRoom?.god ?? false;
    this.room.hooks = {
      onClear: () => this.onClear(),
      onInteract: (p) => this.onInteract(p),
      onDeath: () => this.end(false),
      onBossDefeated: (b) => this.onBoss(b.bd.id),
      onRelicOrb: () => this.relicChoice(3 + (app.save.upgrades.relic ?? 0), '정예의 유물'),
      toast: (m, c) => app.toast(m, c),
    };
    this.room.useItemRequest = () => this.useItem();
    this.room.build.fire('roomStart', {}, Math.random);
    if (node.type === 'boss') {
      audio.playMusic(run.bossRush ? (run.chapter >= run.rushList.length ? 'finalboss' : 'boss') : run.chapter >= run.storyDef.finalStage ? 'finalboss' : 'boss');
      this.bossCard = 150;
    } else audio.playMusic(ch.music);
    if (chapterStart && run.bossRush) this.card = { title: `보스 러시  ${run.chapter} / ${run.rushList.length}`, sub: `스토리 ${run.story} · ${ch.name}`, t: 150 };
    else if (chapterStart) this.card = { title: `제${run.chapter}장  ${ch.name}`, sub: run.storyDef.cards[run.chapter - 1] ?? '더 깊은 곳으로', t: 180 };
    else if (node.type !== 'combat' && node.type !== 'boss') this.card = { title: { start: '입구', tutorial: '훈련의 방', elite: '정예의 방', altar: '영혼 제단', armory: '무기고', shop: '상점', rest: '휴식처', event: '???', treasure: '보물방', combat: '', boss: '' }[node.type], sub: '', t: 90 };
    if (node.type === 'elite') this.card = { title: '정예의 방', sub: '강력한 적이 유물을 지키고 있다', t: 100 };
    if (!resuming) this.checkpoint();
  }

  private onClear(): void {
    const run = this.run;
    const node = run.node;
    const room = this.room;
    run.stats.rooms++;
    const p = room.player;
    if (node.type === 'combat' || node.type === 'start') {
      const gold = Math.round((14 + run.chapter * 8 + node.layer * 2) * (1 + (room.stats.gold ?? 0)));
      room.dropReward('gold', p.cx, p.cy - 30, gold, 8);
      room.dropReward('stone', p.cx, p.cy - 30, 8, 2);
      if (run.rng.chance(0.35)) room.dropReward('heal', p.cx, p.cy - 30, 1, 1);
      app.toast('방 정화 완료', '#c0b0ff');
    } else if (node.type === 'elite') {
      const e = room.enemies.find((x) => x.elite) ?? room.enemies[0];
      const x = e ? e.cx : p.cx;
      // 유물은 항상 안전한 바닥 위에 (구덩이·가시·용암·벽 속 금지). 쓰러진 자리 근처에서 찾고, 없으면 플레이어 발밑
      const ey = e ? e.b.y + e.b.h : p.b.y + p.b.h;
      const spot = room.safeSpot(x, room.world.groundBelow(x, ey - 8, 200), false) ?? room.safeSpot(p.cx, p.b.y + p.b.h, false) ?? { x: p.cx, y: p.b.y + p.b.h };
      room.pickups.push(new Pickup('relicOrb', spot.x, spot.y - 14, 1));
      room.dropReward('gold', x, p.cy - 30, 40 + run.chapter * 15, 10);
      room.dropReward('stone', x, p.cy - 30, 20, 4);
    } else if (node.type === 'tutorial') {
      app.toast('훈련 완료! 문으로 나아가자', '#80ffa0');
    }
    if (room.build.crests.some((c) => c.tier >= 3) && markAch(app.save, 'crest6')) app.achToast(['crest6']);
    this.checkpoint();
  }

  private onInteract(p: Prop): void {
    const run = this.run;
    const room = this.room;
    switch (p.kind) {
      case 'door':
        if (!p.open || this.trans > 0) return;
        audio.play('door');
        if (p.nodeId === -2) {
          run.victory = true;
          this.end(true);
          return;
        }
        this.transTarget = p.nodeId ?? 0;
        this.nextTheme = p.nextCh ?? 0;
        this.trans = 1;
        break;
      case 'chest': {
        const big = p.label === 'big';
        const gold = Math.round((big ? 80 : 30 + Math.random() * 30) * (1 + run.chapter * 0.3));
        room.dropReward('gold', p.x, p.y - 12, gold, 10);
        room.dropReward('stone', p.x, p.y - 12, big ? 15 : 10, 3);
        if (big) this.relicChoice(3, '보물 상자');
        else if (Math.random() < 0.45 || p.hidden === false) room.dropReward('relicOrb', p.x, p.y - 20, 1, 1);
        this.checkpoint();
        break;
      }
      case 'shop': {
        let s = this.stock.get(run.cur);
        if (!s) {
          s = ShopOverlay.makeStock(run);
          this.stock.set(run.cur, s);
        }
        this.overlay = new ShopOverlay(run, room, s);
        break;
      }
      case 'altar':
        if (p.used) {
          app.toast('제단의 빛이 사그라들었다', '#8a8098');
          return;
        }
        p.used = true;
        audio.play('beam_4');
        this.overlay = new AltarOverlay(run, room, run.rollChar());
        break;
      case 'armory':
        if (p.used) {
          app.toast('무기고는 이미 비었다', '#8a8098');
          return;
        }
        p.used = true;
        this.overlay = new ArmoryOverlay(run, room, run.rollWeapons(3));
        break;
      case 'rest':
        if (p.used) {
          app.toast('모닥불이 꺼졌다', '#8a8098');
          return;
        }
        p.used = true;
        this.overlay = new RestOverlay(run, room);
        break;
      case 'event':
        if (p.used) return;
        p.used = true;
        this.overlay = new EventOverlay(
          run,
          room,
          () => (this.queued = () => (this.overlay = new AltarOverlay(run, room, run.rollChar()))),
          () => (this.queued = () => (this.overlay = new ArmoryOverlay(run, room, run.rollWeapons(2)))),
          () => (this.queued = () => this.relicChoice(3, '이벤트 보상')),
          () => (this.queued = () => this.ambush()),
        );
        break;
    }
  }

  queued: (() => void) | null = null;

  private ambush(): void {
    const room = this.room;
    const pool = Object.values(ENEMY_MAP).filter((e) => e.chapter === this.run.theme && !e.flying);
    for (let i = 0; i < 3; i++) {
      const d = pool[i % pool.length];
      const e = new Enemy(d, room.player.cx + (i - 1) * 70 + 20, room.player.b.y + room.player.b.h, i === 0, this.run.chapter, this.run.curseEnemy, this.run.node.layer, this.run.power);
      room.enemies.push(e);
    }
    room.cleared = false;
    for (const p of room.props) if (p.kind === 'door') p.open = false;
    app.toast('망령이 덮쳐온다!', '#ff6080');
    audio.play('boss_roar', 1.5);
  }

  relicChoice(n: number, title: string, minRarity = 1): void {
    const opts = this.run.rollRelics(n, minRarity);
    if (!opts.length) {
      this.run.gold += 60;
      app.toast('더 얻을 유물이 없다 — 금화 +60', '#ffe080');
      return;
    }
    this.overlay = new RelicChoice(opts, title, (id) => {
      if (id) {
        this.run.relics.push(id);
        this.room.rebuild();
        const r = RELIC_MAP[id];
        app.toast(`유물 획득: ${r.name}`, RELIC_RARITY_COL[r.rarity]);
        if (this.run.relics.filter((x) => RELIC_MAP[x]).length >= 10 && markAch(app.save, 'relic10')) app.achToast(['relic10']);
        if (this.room.build.crests.some((c) => c.tier >= 3) && markAch(app.save, 'crest6')) app.achToast(['crest6']);
      } else this.run.gold += 30;
    });
  }

  private onBoss(id: string): void {
    const run = this.run;
    run.stats.bosses.push(id);
    run.stats.stones += 60 + run.chapter * 20;
    run.stats.crystals += 60 + run.chapter * 20;
    this.room.heal(this.room.maxHp() * 0.3);
    if (!this.room.bossHit && markAch(app.save, 'nodamage')) app.achToast(['nodamage']);
    const nm = BOSS_MAP[id].name;
    app.toast(`${nm} 처치!`, '#ffe080');
    audio.play('victory');
    this.relicChoice(3, `${nm}의 유산`, 2);
    if (!run.bossRush && run.chapter >= run.storyDef.finalStage) run.kingDown = true;
    if (!run.bossRush && run.storyDef.trueStage && run.chapter >= run.storyDef.trueStage) run.trueEnd = true;
    this.bossDone = true;
    this.exitDoors();
    audio.playMusic('none');
    this.checkpoint();
  }

  /** 보스 처치 후 출구 문 */
  private exitDoors(): void {
    const run = this.run;
    const sd = run.storyDef;
    const next = run.nextThemes();
    if (run.bossRush) {
      // 다음 보스로, 마지막이면 완주
      this.room.addExitDoors(next.length ? [{ nodeId: -1, nextCh: next[0] }] : [{ nodeId: -2 }]);
      if (!next.length) app.toast('보스 러시 완주!', '#ffe080');
      return;
    }
    if (sd.trueStage && run.chapter >= sd.trueStage) {
      this.room.addExitDoors([{ nodeId: -2 }]);
    } else if (run.chapter >= sd.finalStage) {
      if (sd.trueStage && next.length) {
        this.room.addExitDoors([{ nodeId: -2 }, { nodeId: -1, nextCh: next[0] }]);
        app.toast('계약을 완수할 수 있다 — 혹은 망각의 심연으로…', '#ff80d0');
      } else this.room.addExitDoors([{ nodeId: -2 }]);
    } else this.room.addExitDoors((next.length ? next : [run.theme]).map((n) => ({ nodeId: -1, nextCh: n })));
  }

  private useItem(): void {
    const run = this.run;
    const room = this.room;
    const it = run.items.shift();
    if (!it) {
      audio.play('error');
      return;
    }
    const p = room.player;
    const pot = 1 + room.build.flag('potionPower');
    switch (it) {
      case 'potion':
        room.heal(room.maxHp() * 0.35 * pot * (run.curse >= 5 ? 0.7 : 1));
        break;
      case 'bomb':
        room.explode(p.cx + p.facing * 40, p.cy, 60, 5, 'skill', 'fire', 'burn', -3);
        room.cam.shake(6);
        audio.play('explode');
        break;
      case 'frost':
        for (const e of room.allEnemies()) if (!e.dead && Math.hypot(e.cx - p.cx, e.cy - p.cy) < 200) e.applyStatus('freeze', 1, room);
        room.fx.ring(p.cx, p.cy, '#d0f4ff', 200, 24);
        audio.play('freeze');
        break;
      case 'lantern':
        p.skillCd = [0, 0];
        p.swapCd = 0;
        room.fx.ring(p.cx, p.cy, '#9ef0ff', 40);
        audio.play('gem');
        break;
      case 'ward':
        room.addShield(room.maxHp() * 0.35);
        break;
    }
    app.toast(`${ITEM_MAP[it].name} 사용`, ITEM_MAP[it].col);
  }

  private end(victory: boolean): void {
    if (this.ended) return;
    this.ended = true;
    this.run.finished = true;
    this.run.victory = victory || this.run.kingDown;
    app.save.run = null; // 끝난 런은 이어하기 대상에서 제외 (결과 화면에서 저장)
    audio.playMusic('none');
    app.go(new ResultScene(this.run));
  }

  private nextRoom(): void {
    const t = this.transTarget!;
    this.transTarget = null;
    if (t === -1) {
      this.run.newChapter(this.run.chapter + 1, this.nextTheme || (this.run.nextThemes()[0] ?? this.run.theme));
      this.enterNode(0, true);
    } else this.enterNode(t);
  }

  /** 디버그 치트(4): 보스방 이동 — App의 공용 치트 처리에서 호출 */
  debugBoss(): boolean {
    if (this.trans > 0 || this.ended) return false;
    const last = this.run.layers[this.run.layers.length - 1][0];
    if (this.run.cur === last) {
      app.toast('이미 보스방이다', '#80ffa0');
      return true;
    }
    this.overlay = null;
    this.transTarget = last;
    this.trans = 1;
    app.toast('보스방으로 이동', '#80ffa0');
    return true;
  }

  update(): void {
    const room = this.room;
    room.showHitboxes = app.debug;
    room.debug = app.debug;
    if (this.card.t > 0) this.card.t--;
    if (this.bossCard > 0) this.bossCard--;
    if (this.trans > 0) {
      this.trans++;
      if (this.trans === 18) this.nextRoom();
      if (this.trans > 36) this.trans = 0;
      room.input = NO_INPUT;
      if (this.trans < 18) room.update();
      return;
    }
    if (this.overlay) {
      const r = this.overlay.update();
      if (r === 'close') {
        this.overlay = null;
        if (this.queued) {
          const q = this.queued;
          this.queued = null;
          q();
        }
        if (!this.overlay) this.checkpoint(); // 보상·구매·이벤트 결과 저장
      }
      return;
    }
    const inp = app.input;
    if (inp.pressed('pause')) {
      audio.play('select');
      this.overlay = new PauseOverlay(true, (a) => {
        if (a === 'build') this.overlay = new BuildOverlay(this.run, this.room);
        if (a === 'settings') app.go(new SettingsScene(this), false);
        if (a === 'controls') app.go(new ControlsScene(this), false);
        if (a === 'quit') {
          this.run.stats.cause = '포기';
          this.end(false);
        }
      });
      return;
    }
    if (inp.pressed('build')) {
      this.overlay = new BuildOverlay(this.run, this.room);
      return;
    }
    room.input = readPlayerInput(inp);
    room.update();
  }

  shake(): [number, number] {
    return [this.room.cam.sx, this.room.cam.sy];
  }

  world(g: CanvasRenderingContext2D): void {
    this.room.render(g);
  }

  ui(g: CanvasRenderingContext2D): void {
    const room = this.room;
    this.hud.worldUi(g, room, this.run, app.input);
    this.hud.render(g, room, this.run, app.input, 'run');
    if (this.card.t > 0 && this.card.title) {
      const t = this.card.t;
      const a = Math.min(1, t / 30, (180 - t) / 20 + 0.3);
      g.fillStyle = `rgba(0,0,0,${0.5 * a})`;
      g.fillRect(0, 96, 480, this.card.sub ? 44 : 30);
      text(g, this.card.title, 240, 102, { size: 14, align: 'center', color: '#f0e0ff', bold: true, alpha: a });
      if (this.card.sub) text(g, this.card.sub, 240, 124, { size: 8, align: 'center', color: '#b8a8d0', alpha: a });
    }
    if (this.bossCard > 0 && room.boss) {
      const t = this.bossCard;
      const a = Math.min(1, t / 20, (150 - t) / 15);
      const bd = room.boss.bd;
      g.fillStyle = `rgba(20,0,8,${0.7 * a})`;
      g.fillRect(0, 150, 480, 40);
      g.fillStyle = `rgba(255,60,100,${a})`;
      g.fillRect(0, 150, 480, 1);
      g.fillRect(0, 189, 480, 1);
      text(g, bd.title, 240, 156, { size: 7, align: 'center', color: '#c090a0', alpha: a });
      text(g, bd.name, 240, 166, { size: 16, align: 'center', color: '#ffd0e0', bold: true, alpha: a });
    }
    if (this.overlay) this.overlay.render(g);
    if (this.trans > 0) {
      const a = this.trans < 18 ? this.trans / 18 : 1 - (this.trans - 18) / 18;
      g.fillStyle = `rgba(4,2,8,${a})`;
      g.fillRect(0, 0, 480, 270);
    }
    void CHAR_MAP;
  }
}

