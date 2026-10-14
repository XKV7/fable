import { audio } from './core/audio';
import { Input } from './core/input';
import { Loop } from './core/loop';
import { Renderer, text, W, H } from './gfx/renderer';
import { loadSave, newSave, writeSave, type SaveData } from './game/save';
import { hot } from './ui/widgets';
import { ACHIEVEMENTS } from './data/meta';
import type { Room } from './game/room';

export interface Scene {
  enter?(): void;
  leave?(): void;
  update(): void;
  world(g: CanvasRenderingContext2D): void;
  ui(g: CanvasRenderingContext2D): void;
  shake?(): [number, number];
  room?: Room | null;
}

interface Toast {
  msg: string;
  col: string;
  t: number;
}

/** 전역 앱: 루프·입력·렌더러·저장·장면 전환·토스트·디버그 */
export class App {
  r: Renderer;
  input: Input;
  loop: Loop;
  save: SaveData;
  hasSave: boolean;
  scene!: Scene;
  private next: Scene | null = null;
  private fade = 0;
  private fadeDir = 0;
  toasts: Toast[] = [];
  debug = false;
  frame = 0;
  saveFailed = false;

  constructor(canvas: HTMLCanvasElement) {
    this.r = new Renderer(canvas);
    this.input = new Input(canvas);
    const s = loadSave();
    this.hasSave = !!s;
    this.save = s ?? newSave();
    this.applySettings();
    this.loop = new Loop(
      () => this.update(),
      () => this.render(),
    );
    const unlock = (): void => audio.unlock();
    window.addEventListener('keydown', unlock);
    window.addEventListener('mousedown', unlock);
    window.addEventListener('touchstart', unlock);
    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      hot.mouse.x = ((e.clientX - rect.left) / rect.width) * W;
      hot.mouse.y = ((e.clientY - rect.top) / rect.height) * H;
      hot.mouse.moved = true;
    });
    canvas.addEventListener('mousedown', (e) => {
      const rect = canvas.getBoundingClientRect();
      hot.mouse.x = ((e.clientX - rect.left) / rect.width) * W;
      hot.mouse.y = ((e.clientY - rect.top) / rect.height) * H;
      hot.mouse.click = true;
    });
  }

  applySettings(): void {
    const s = this.save.settings;
    this.input.bindings = s.bindings;
    audio.musicVol = s.music;
    audio.sfxVol = s.sfx;
    audio.applyVolumes();
  }

  start(first: Scene): void {
    this.scene = first;
    first.enter?.();
    this.loop.start();
  }

  go(s: Scene, fade = true): void {
    if (!fade) {
      this.scene.leave?.();
      this.scene = s;
      s.enter?.();
      return;
    }
    if (this.next) return;
    this.next = s;
    this.fadeDir = 1;
  }

  persist(): void {
    this.hasSave = true;
    this.saveFailed = !writeSave(this.save);
  }

  toast(msg: string, col = '#f0e8d8'): void {
    this.toasts.push({ msg, col, t: 180 });
    if (this.toasts.length > 4) this.toasts.shift();
  }

  achToast(ids: string[]): void {
    for (const id of ids) {
      const a = ACHIEVEMENTS.find((x) => x.id === id);
      if (a) {
        this.toast(`업적 달성: ${a.name} — 비석에서 보상을 받으세요`, '#ffe080');
        audio.play('relic');
      }
    }
  }

  private update(): void {
    this.frame++;
    this.input.poll();
    const held = (a: string, b: string): boolean => this.input.rawHeld(a) || this.input.rawHeld(b);
    // 디버그 토글: Ctrl + Shift + ` (실수로 켜지지 않도록 조합키)
    if (this.input.raw('Backquote') && held('ControlLeft', 'ControlRight') && held('ShiftLeft', 'ShiftRight')) {
      this.debug = !this.debug;
      this.toast(this.debug ? '디버그 모드 ON (1 무적 · 2 재화 · 3 방 클리어 · 4 보스방 · 5 회복 · 제단에서 P 픽업 선택)' : '디버그 모드 OFF', '#80ffa0');
    }
    if (this.debug) this.cheats();
    if (this.fadeDir === 1) {
      this.fade += 0.08;
      if (this.fade >= 1) {
        this.fade = 1;
        this.scene.leave?.();
        this.scene = this.next!;
        this.next = null;
        this.scene.enter?.();
        this.fadeDir = -1;
      }
    } else if (this.fadeDir === -1) {
      this.fade -= 0.06;
      if (this.fade <= 0) {
        this.fade = 0;
        this.fadeDir = 0;
      }
    }
    if (this.fadeDir !== 1) this.scene.update();
    for (const t of this.toasts) t.t--;
    this.toasts = this.toasts.filter((t) => t.t > 0);
    this.input.endStep();
    hot.mouse.click = false;
    hot.mouse.moved = false;
    if (this.scene.room) audio.intensity = this.scene.room.intensity;
  }

  /** 디버그 모드 전용 치트: 숫자 1~5 (상단 숫자열·숫자 패드 모두) */
  private cheats(): void {
    const key = (n: number): boolean => this.input.raw(`Digit${n}`) || this.input.raw(`Numpad${n}`);
    const room = this.scene.room;
    const needRoom = (): boolean => {
      if (!room) this.toast('전투 공간(거점·런)에서만 사용할 수 있다', '#ff9090');
      return !!room;
    };
    if (key(1) && needRoom()) {
      room!.god = !room!.god;
      this.toast(`무적 ${room!.god ? 'ON' : 'OFF'}`, '#80ffa0');
    }
    if (key(2)) {
      this.save.stones += 1600;
      this.save.crystals += 1000;
      this.persist();
      this.toast('영혼석 +1600, 영혼 결정 +1000', '#80ffa0');
    }
    if (key(3) && needRoom()) {
      let n = 0;
      for (const e of room!.allEnemies()) {
        if (e.dead || e.def.ai === 'dummy') continue;
        if ('intro' in e) {
          const b = e as unknown as { intro: number; phaseT: number };
          b.intro = 0;
          b.phaseT = 0;
        }
        e.hp = 1;
        room!.damageEnemy(e, { m: 99, kind: 'proc', kb: 0, up: 0, hs: 0, dir: 0, proc: true });
        if (!e.dead) room!.killEnemy(e);
        n++;
      }
      room!.waves = [];
      this.toast(n ? `적 ${n}마리 처치` : '처치할 적이 없다', '#80ffa0');
    }
    if (key(4)) {
      const s = this.scene as Scene & { debugBoss?: () => boolean };
      if (!s.debugBoss?.()) this.toast('보스방 이동은 런 중에만 사용할 수 있다', '#ff9090');
    }
    if (key(5) && needRoom()) {
      room!.heal(room!.maxHp());
      room!.player.skillCd = [0, 0];
      room!.player.swapCd = 0;
      this.toast('체력·쿨타임 회복', '#80ffa0');
    }
  }

  private render(): void {
    const r = this.r;
    r.beginFrame();
    this.scene.world(r.w);
    const [sx, sy] = this.scene.shake?.() ?? [0, 0];
    r.present(sx, sy);
    const g = r.d;
    hot.clear();
    this.scene.ui(g);
    // 토스트
    this.toasts.forEach((t, i) => {
      const a = Math.min(1, t.t / 20);
      const y = 40 + i * 14;
      g.save();
      g.globalAlpha = a;
      g.font = `8px sans-serif`;
      const w = Math.min(460, g.measureText(t.msg).width + 30);
      g.fillStyle = 'rgba(10,6,20,0.85)';
      g.fillRect(240 - w / 2, y - 2, w, 12);
      g.restore();
      text(g, t.msg, 240, y, { size: 8, align: 'center', color: t.col, alpha: a });
    });
    if (this.fade > 0) {
      g.fillStyle = `rgba(4,2,8,${this.fade})`;
      g.fillRect(0, 0, W, H);
    }
    if (this.debug) this.renderDebug(g);
  }

  private renderDebug(g: CanvasRenderingContext2D): void {
    const room = this.scene.room;
    const lines = [`FPS ${this.loop.fps}`];
    if (room) {
      lines.push(`적 ${room.allEnemies().length} · 투사체 ${room.projs.length} · 장판 ${room.fields.length}`);
      lines.push(`파티클 ${room.fx.parts.length} · 소환 ${room.summons.length} · 픽업 ${room.pickups.length}`);
      lines.push(`무적 ${room.god ? 'ON' : 'OFF'} · 히트박스 표시`);
      const p = room.player;
      lines.push(`플레이어 ${Math.round(p.b.x)},${Math.round(p.b.y)} ${p.state} vx ${p.b.vx.toFixed(1)}`);
    }
    g.fillStyle = 'rgba(0,0,0,0.6)';
    g.fillRect(2, H - 12 - lines.length * 9, 200, lines.length * 9 + 4);
    lines.forEach((l, i) => text(g, l, 5, H - 10 - (lines.length - i) * 9 + 2, { size: 7, color: '#80ffa0' }));
  }
}

export let app: App;
export function setApp(a: App): void {
  app = a;
}
