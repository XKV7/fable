import { app, type Scene } from '../app';
import { audio } from '../core/audio';
import { CHAPTERS } from '../data/meta';
import { ROOMS } from '../data/rooms';
import { text } from '../gfx/renderer';
import { Room } from '../game/room';
import { RunState } from '../game/run';
import { checkAchievements } from '../game/meta';
import { Hud } from '../ui/hud';
import { readPlayerInput } from './common';
import { PauseOverlay, type Overlay } from './overlays';
import { SettingsScene } from './settings';
import { ControlsScene } from './controls';
import { drawIcon } from '../ui/icons';
import type { Prop } from '../game/entities';

/** 거점 「계약의 성소」: 걸어다니며 시설과 상호작용 */
export class HubScene implements Scene {
  room!: Room;
  hud = new Hud();
  overlay: Overlay | null = null;
  pos: { x: number; y: number } | null = null;
  t = 0;

  enter(): void {
    const save = app.save;
    // 편성 보정
    const owned = Object.keys(save.chars);
    if (!save.chars[save.loadout.chars[0]]) save.loadout.chars[0] = owned[0];
    if (!save.loadout.chars[1] || !save.chars[save.loadout.chars[1]] || save.loadout.chars[1] === save.loadout.chars[0]) {
      save.loadout.chars[1] = owned.find((id) => id !== save.loadout.chars[0]) ?? '';
    }
    if (!save.weapons[save.loadout.weapon]) save.loadout.weapon = Object.keys(save.weapons)[0];
    app.achToast(checkAchievements(save));
    app.persist();
    const run = new RunState(save);
    this.room = new Room({ template: ROOMS.find((r) => r.id === 'hub')!, chapter: CHAPTERS[0], mode: 'hub', type: 'rest', next: [], depth: 0 }, run, save);
    if (this.pos) {
      this.room.player.b.x = this.pos.x;
      this.room.player.b.y = this.pos.y;
      this.room.cam.follow(this.room.player.cx, this.room.player.cy, this.room.world.pxW, this.room.world.pxH, 480, 270, true);
    }
    this.room.hooks = { onInteract: (p) => this.interact(p), toast: (m, c) => app.toast(m, c) };
    audio.playMusic('hub');
  }

  leave(): void {
    if (this.room) this.pos = { x: this.room.player.b.x, y: this.room.player.b.y };
  }

  private async interact(p: Prop): Promise<void> {
    if (p.kind !== 'hub') return;
    audio.play('confirm');
    switch (p.hub) {
      case 'gacha': {
        const { GachaScene } = await import('./gacha');
        app.go(new GachaScene(this));
        break;
      }
      case 'codex': {
        const { CodexScene } = await import('./codex');
        app.go(new CodexScene(this));
        break;
      }
      case 'portal':
      case 'loadout': {
        const { LoadoutScene } = await import('./loadout');
        app.go(new LoadoutScene(this));
        break;
      }
      case 'growth': {
        const { GrowthScene } = await import('./growth');
        app.go(new GrowthScene(this));
        break;
      }
      case 'upgrade': {
        const { UpgradeScene } = await import('./upgrade');
        app.go(new UpgradeScene(this));
        break;
      }
      case 'ach': {
        const { AchScene } = await import('./ach');
        app.go(new AchScene(this));
        break;
      }
    }
  }

  update(): void {
    this.t++;
    if (this.overlay) {
      if (this.overlay.update() === 'close') this.overlay = null;
      return;
    }
    if (app.input.pressed('pause')) {
      this.overlay = new PauseOverlay(false, async (a) => {
        if (a === 'settings') app.go(new SettingsScene(this, () => this.enter()), false);
        if (a === 'controls') app.go(new ControlsScene(this), false);
        if (a === 'title') {
          const { TitleScene } = await import('./title');
          app.go(new TitleScene());
        }
      });
      return;
    }
    this.room.input = readPlayerInput(app.input);
    this.room.update();
  }

  shake(): [number, number] {
    return [this.room.cam.sx, this.room.cam.sy];
  }

  world(g: CanvasRenderingContext2D): void {
    this.room.render(g);
  }

  ui(g: CanvasRenderingContext2D): void {
    const room = this.room;
    const save = app.save;
    this.hud.worldUi(g, room, room.run, app.input);
    this.hud.render(g, room, room.run, app.input, 'hub');
    // 시설 이름표
    const names: Record<string, string> = { ach: '업적 비석', codex: '도감', gacha: '계약의 제단', portal: '출정의 문', loadout: '편성', growth: '영웅 육성', upgrade: '영구 강화', dummy: '훈련용 허수아비' };
    for (const p of room.props) {
      if (p.kind !== 'hub') continue;
      const x = Math.round(p.x - room.cam.x);
      const y = Math.round(p.y - room.cam.y - (p.hub === 'dummy' ? 40 : 52));
      if (x < -40 || x > 520) continue;
      text(g, names[p.hub ?? ''] ?? '', x + (p.hub === 'dummy' ? 30 : 0), y - (p.hub === 'portal' ? 10 : 0), { size: 7, align: 'center', color: p.hub === 'gacha' ? '#9ef0ff' : p.hub === 'portal' ? '#c0a0ff' : '#e0d8c8' });
      if (p.hub === 'gacha' && !save.freePullUsed) {
        const by = y - 22 + Math.sin(this.t * 0.1) * 3;
        text(g, '첫 계약: 무료 10연!', x, by - 6, { size: 8, align: 'center', color: '#ffe080', bold: true });
        g.fillStyle = '#ffe080';
        g.beginPath();
        g.moveTo(x - 4, by + 6);
        g.lineTo(x + 4, by + 6);
        g.lineTo(x, by + 11);
        g.fill();
      }
      if (p.hub === 'ach' && Object.values(save.ach).includes('done')) text(g, '보상!', x, y - 10, { size: 7, align: 'center', color: '#ffe080', bold: true });
    }
    // 상단 재화
    const bx = 330;
    g.fillStyle = 'rgba(10,6,20,0.8)';
    g.fillRect(bx, 4, 146, 16);
    drawIcon(g, 'gem', bx + 4, 7, 10, '#6a9aff');
    text(g, `${save.stones}`, bx + 17, 8, { size: 8, color: '#9ec0ff' });
    drawIcon(g, 'shard', bx + 76, 7, 10, '#40d0e0');
    text(g, `${save.crystals}`, bx + 89, 8, { size: 8, color: '#a0f0ff' });
    text(g, '계약의 성소', 476, 24, { size: 8, align: 'right', color: '#c0b0d8' });
    text(g, `[${app.input.label('interact')}] 상호작용 · [Esc] 메뉴`, 476, 34, { size: 6, align: 'right', color: '#8a8098' });
    if (this.overlay) this.overlay.render(g);
  }
}
