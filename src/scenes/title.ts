import { app, type Scene } from '../app';
import { audio } from '../core/audio';
import { CHARACTERS } from '../data/characters';
import { CHAPTERS } from '../data/meta';
import { ROOMS } from '../data/rooms';
import { text } from '../gfx/renderer';
import { Room } from '../game/room';
import { RunState } from '../game/run';
import { newSave } from '../game/save';
import { NO_INPUT, type PlayerInput } from '../game/player';
import { button, hot, keyHint, Menu, panel } from '../ui/widgets';
import { HubScene } from './hub';
import { IntroScene } from './intro';
import { SettingsScene } from './settings';
import { ControlsScene } from './controls';
import { clearSave } from '../game/save';

/** 타이틀: 배경에서 영웅들이 자동 전투하는 데모 + 메뉴 */
export class TitleScene implements Scene {
  room!: Room;
  menu!: Menu;
  confirm: Menu | null = null;
  t = 0;
  ai = { jumpCd: 0, swapT: 300, dashCd: 60 };

  enter(): void {
    this.buildMenu();
    this.makeDemo();
    audio.playMusic('title');
  }

  private buildMenu(): void {
    this.menu = new Menu(
      app.hasSave
        ? [{ label: '이어하기' }, { label: '새로 시작' }, { label: '설정' }, { label: '조작법' }]
        : [{ label: '시작하기' }, { label: '설정' }, { label: '조작법' }],
      'title',
    );
  }

  private makeDemo(): void {
    const demoSave = newSave();
    const pool = [...CHARACTERS].sort(() => Math.random() - 0.5);
    demoSave.loadout.chars = [pool[0].id, pool[1].id];
    for (const p of pool) demoSave.chars[p.id] = { lv: 10, aw: 2, count: 1 };
    const run = new RunState(demoSave);
    const ch = CHAPTERS[Math.floor(Math.random() * 4)];
    run.chapter = ch.n;
    this.room = new Room({ template: ROOMS.find((r) => r.id === 'c_arena')!, chapter: ch, mode: 'title', type: 'combat', next: [], depth: 2 }, run, demoSave);
    this.room.god = true;
    this.room.demo = true;
    this.room.cam.shakeScale = 0.5;
    this.room.fx.showNumbers = app.save.settings.dmgNumbers;
  }

  private demoInput(): PlayerInput {
    const r = this.room;
    const p = r.player;
    const inp: PlayerInput = { ...NO_INPUT };
    const e = r.nearestEnemy(p.cx, p.cy, 600);
    if (this.ai.jumpCd > 0) this.ai.jumpCd--;
    if (this.ai.dashCd > 0) this.ai.dashCd--;
    if (--this.ai.swapT <= 0 && p.canSwap() && e) {
      inp.swapP = true;
      this.ai.swapT = 360 + Math.random() * 200;
      return inp;
    }
    if (!e) {
      inp.right = p.cx < r.world.pxW / 2 - 20;
      inp.left = p.cx > r.world.pxW / 2 + 20;
      return inp;
    }
    const dx = e.cx - p.cx;
    const dy = e.cy - p.cy;
    const ranged = p.def.type === 'ranged' || p.def.type === 'magic';
    const want = ranged ? 80 : 22;
    if (Math.abs(dx) > want) {
      inp.right = dx > 0;
      inp.left = dx < 0;
    } else if (Math.abs(dx) < want - 30 && ranged) {
      inp.right = dx < 0;
      inp.left = dx > 0;
    }
    if (Math.sign(dx) !== p.facing && Math.abs(dx) < want + 10) {
      inp.right = dx > 0;
      inp.left = dx < 0;
    }
    if ((dy < -30 || p.b.hitWall) && this.ai.jumpCd <= 0) {
      inp.jumpP = true;
      inp.jumpH = true;
      this.ai.jumpCd = 30;
    }
    if (Math.abs(dx) < want + 20 && Math.abs(dy) < 40) {
      inp.atkP = r.time % 4 === 0;
      if (p.skillCd[0] <= 0 && Math.random() < 0.02) inp.s1P = true;
      if (p.skillCd[1] <= 0 && Math.random() < 0.015) inp.s2P = true;
    }
    if (Math.abs(dx) > 140 && this.ai.dashCd <= 0) {
      inp.dashP = true;
      this.ai.dashCd = 90;
    }
    return inp;
  }

  update(): void {
    this.t++;
    // 데모 진행
    this.room.input = this.demoInput();
    this.room.update();
    if (this.room.cleared && this.room.time > 60) {
      if (this.t % 400 === 0 || !this.room.enemies.some((e) => !e.dead)) {
        if (!this.respawnT) this.respawnT = 90;
      }
    }
    if (this.respawnT > 0 && --this.respawnT === 0) this.makeDemo();
    if (this.confirm) {
      const r = this.confirm.update(app.input, true);
      if (r === 'back' || (r === 'ok' && this.confirm.sel === 1)) this.confirm = null;
      else if (r === 'ok') {
        clearSave();
        app.save = newSave();
        app.hasSave = false;
        app.applySettings();
        this.confirm = null;
        this.start();
      }
      return;
    }
    const r = this.menu.update(app.input);
    if (r === 'ok') {
      const label = this.menu.items[this.menu.sel].label;
      if (label === '이어하기') app.go(new HubScene());
      else if (label === '시작하기') this.start();
      else if (label === '새로 시작') {
        this.confirm = new Menu([{ label: '새로 시작', col: '#ff4060' }, { label: '취소' }], 'tconf');
        this.confirm.sel = 1;
      } else if (label === '설정') app.go(new SettingsScene(this, () => this.buildMenu()), false);
      else if (label === '조작법') app.go(new ControlsScene(this), false);
    }
  }

  respawnT = 0;

  private start(): void {
    app.persist();
    app.go(app.save.introSeen ? new HubScene() : new IntroScene());
  }

  shake(): [number, number] {
    return [this.room.cam.sx, this.room.cam.sy];
  }

  world(g: CanvasRenderingContext2D): void {
    this.room.render(g);
    g.fillStyle = 'rgba(6,4,14,0.45)';
    g.fillRect(0, 0, 480, 270);
  }

  ui(g: CanvasRenderingContext2D): void {
    const a = Math.min(1, this.t / 60);
    // 로고
    g.save();
    g.globalAlpha = a;
    g.fillStyle = 'rgba(0,0,0,0.5)';
    g.fillRect(0, 34, 480, 64);
    g.restore();
    text(g, '망자의 계약', 241, 40, { size: 30, align: 'center', color: '#3a1a10', bold: true, alpha: a, shadow: null });
    text(g, '망자의 계약', 240, 38, { size: 30, align: 'center', color: '#ffd070', bold: true, alpha: a, shadow: '#5a2a10' });
    text(g, 'PACT  OF  THE  FALLEN', 240, 76, { size: 8, align: 'center', color: '#c0a0ff', alpha: a });
    this.menu.render(g, 190, 140, 100, 18, 4, 8);
    if (this.confirm) {
      panel(g, 130, 112, 220, 64, { border: '#ff4060' });
      text(g, '기존 저장 데이터를 지우고 새로 시작할까요?', 240, 122, { size: 8, align: 'center', color: '#ffffff' });
      this.confirm.items.forEach((it, i) => {
        button(g, 150 + i * 94, 144, 86, 20, it.label, this.confirm!.sel === i, { col: it.col });
        hot.add(`tconf:${i}`, 150 + i * 94, 144, 86, 20);
      });
    }
    keyHint(g, [['W/S · ↑↓', '선택'], [`Enter / ${app.input.label('attack')}`, '결정']], 246);
    text(g, 'v1.0 · 싱글 플레이 전용 · 현실 결제 없음', 476, 260, { size: 6, align: 'right', color: '#6a6078' });
  }
}
