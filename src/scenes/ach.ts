import { app, type Scene } from '../app';
import { audio } from '../core/audio';
import { ACHIEVEMENTS } from '../data/meta';
import { text } from '../gfx/renderer';
import { drawIcon } from '../ui/icons';
import { hot, keyHint, panel } from '../ui/widgets';

/** 업적 비석: 달성 업적의 영혼석 보상 수령 */
export class AchScene implements Scene {
  sel = 0;
  scroll = 0;
  constructor(public back: Scene) {}
  update(): void {
    const inp = app.input;
    if (inp.menu('back')) {
      app.go(this.back);
      return;
    }
    const n = ACHIEVEMENTS.length;
    if (inp.menu('mup')) this.sel = (this.sel - 1 + n) % n;
    if (inp.menu('mdown')) this.sel = (this.sel + 1) % n;
    if (this.sel < this.scroll) this.scroll = this.sel;
    if (this.sel >= this.scroll + 10) this.scroll = this.sel - 9;
    const h = hot.hover();
    let click = false;
    if (h?.startsWith('ac:')) {
      if (hot.mouse.moved) this.sel = Number(h.slice(3));
      if (hot.mouse.click) {
        this.sel = Number(h.slice(3));
        click = true;
      }
    }
    if (inp.menu('ok') || click) {
      const a = ACHIEVEMENTS[this.sel];
      if (app.save.ach[a.id] === 'done') {
        app.save.ach[a.id] = 'claimed';
        app.save.stones += a.reward;
        audio.play('gem');
        app.toast(`영혼석 +${a.reward}`, '#9ec0ff');
        app.persist();
      } else audio.play('error');
    }
    if (inp.pressed('skill1')) {
      let total = 0;
      for (const a of ACHIEVEMENTS)
        if (app.save.ach[a.id] === 'done') {
          app.save.ach[a.id] = 'claimed';
          total += a.reward;
        }
      if (total) {
        app.save.stones += total;
        audio.play('gem');
        app.toast(`영혼석 +${total}`, '#9ec0ff');
        app.persist();
      }
    }
  }
  world(g: CanvasRenderingContext2D): void {
    g.fillStyle = '#0c0a14';
    g.fillRect(0, 0, 480, 270);
  }
  ui(g: CanvasRenderingContext2D): void {
    const save = app.save;
    text(g, '업적 비석', 12, 8, { size: 12, color: '#ffe080', bold: true });
    const done = ACHIEVEMENTS.filter((a) => save.ach[a.id]).length;
    text(g, `${done} / ${ACHIEVEMENTS.length} 달성`, 120, 11, { size: 7, color: '#a8a0c0' });
    drawIcon(g, 'gem', 360, 9, 10, '#6a9aff');
    text(g, `영혼석 ${save.stones}`, 374, 10, { size: 8, color: '#9ec0ff' });
    panel(g, 8, 28, 464, 224);
    ACHIEVEMENTS.slice(this.scroll, this.scroll + 10).forEach((a, k) => {
      const i = k + this.scroll;
      const st = save.ach[a.id];
      const y = 34 + k * 21;
      const sel = i === this.sel;
      g.fillStyle = sel ? 'rgba(255,224,128,0.2)' : 'rgba(255,255,255,0.03)';
      g.fillRect(14, y, 452, 19);
      hot.add(`ac:${i}`, 14, y, 452, 19);
      drawIcon(g, st ? 'star' : 'lock', 18, y + 4, 11, st === 'claimed' ? '#8a8098' : st ? '#ffe080' : '#4a4058');
      text(g, a.name, 34, y + 5, { size: 8, color: st ? '#ffffff' : '#8a8098', bold: sel });
      text(g, a.desc, 140, y + 5, { size: 7, color: '#a8a0c0' });
      text(g, st === 'claimed' ? '수령 완료' : st === 'done' ? `수령 ▶ 영혼석 ${a.reward}` : `영혼석 ${a.reward}`, 460, y + 5, { size: 7, align: 'right', color: st === 'done' ? '#ffe080' : '#6a6078', bold: st === 'done' });
    });
    keyHint(g, [['↑↓', '선택'], [app.input.label('attack'), '수령'], [app.input.label('skill1'), '모두 수령'], ['Esc', '나가기']], 258);
  }
}
