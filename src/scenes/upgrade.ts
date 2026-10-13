import { app, type Scene } from '../app';
import { audio } from '../core/audio';
import { UPGRADES } from '../data/meta';
import { text } from '../gfx/renderer';
import { drawIcon } from '../ui/icons';
import { hot, keyHint, panel } from '../ui/widgets';

/** 영구 강화 상점 (영혼 결정 소모) */
export class UpgradeScene implements Scene {
  sel = 0;
  constructor(public back: Scene) {}
  update(): void {
    const inp = app.input;
    if (inp.menu('back')) {
      app.go(this.back);
      return;
    }
    const n = UPGRADES.length;
    if (inp.menu('mup')) this.sel = (this.sel - 1 + n) % n;
    if (inp.menu('mdown')) this.sel = (this.sel + 1) % n;
    const h = hot.hover();
    let click = false;
    if (h?.startsWith('up:')) {
      if (hot.mouse.moved) this.sel = Number(h.slice(3));
      if (hot.mouse.click) {
        this.sel = Number(h.slice(3));
        click = true;
      }
    }
    if (inp.menu('ok') || click) {
      const u = UPGRADES[this.sel];
      const lv = app.save.upgrades[u.id] ?? 0;
      if (lv >= u.max) {
        audio.play('error');
        return;
      }
      const cost = u.cost[lv];
      if (app.save.crystals < cost) {
        audio.play('error');
        app.toast('영혼 결정이 부족하다', '#ff8080');
        return;
      }
      app.save.crystals -= cost;
      app.save.upgrades[u.id] = lv + 1;
      audio.play('buy');
      app.persist();
    }
  }
  world(g: CanvasRenderingContext2D): void {
    g.fillStyle = '#100a14';
    g.fillRect(0, 0, 480, 270);
  }
  ui(g: CanvasRenderingContext2D): void {
    const save = app.save;
    text(g, '영구 강화 — 망자의 대장간', 12, 8, { size: 12, color: '#ffb060', bold: true });
    drawIcon(g, 'shard', 360, 9, 10, '#40d0e0');
    text(g, `영혼 결정 ${save.crystals}`, 374, 10, { size: 8, color: '#a0f0ff' });
    panel(g, 8, 28, 464, 226);
    UPGRADES.forEach((u, i) => {
      const lv = save.upgrades[u.id] ?? 0;
      const y = 34 + i * 21;
      const sel = i === this.sel;
      g.fillStyle = sel ? 'rgba(255,176,96,0.25)' : 'rgba(255,255,255,0.03)';
      g.fillRect(14, y, 452, 19);
      hot.add(`up:${i}`, 14, y, 452, 19);
      text(g, u.name, 20, y + 5, { size: 8, color: sel ? '#ffffff' : '#e0d0c0', bold: sel });
      text(g, u.desc.replace('{v}', String(u.per * Math.max(1, lv))), 120, y + 5, { size: 7, color: lv ? '#ffe080' : '#8a8098' });
      for (let k = 0; k < u.max; k++) {
        g.fillStyle = k < lv ? '#ffb060' : '#2a2030';
        g.fillRect(320 + k * 10, y + 6, 8, 7);
      }
      text(g, lv >= u.max ? '완료' : `${u.cost[lv]}`, 460, y + 5, { size: 7, align: 'right', color: lv >= u.max ? '#80ff80' : save.crystals >= u.cost[lv] ? '#a0f0ff' : '#806070' });
    });
    keyHint(g, [['↑↓', '선택'], [app.input.label('attack'), '강화'], ['Esc', '나가기']], 258);
  }
}
