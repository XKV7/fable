import { app, type Scene } from '../app';
import { audio } from '../core/audio';
import { CHARACTERS, CHAR_MAP, TYPE_COL, TYPE_LABEL } from '../data/characters';
import { text } from '../gfx/renderer';
import { charArt } from '../gfx/sprites';
import { charAtk, charHp } from '../game/combat';
import { checkAchievements } from '../game/meta';
import { levelCost, MAX_LEVEL } from '../game/save';
import { drawIcon } from '../ui/icons';
import { RARITY_COL } from '../ui/theme';
import { bar, button, hot, keyHint, panel, stars } from '../ui/widgets';
import { rgba } from '../gfx/pixel';

/** 영웅 육성: 영혼 결정으로 레벨업, 각성 현황 */
export class GrowthScene implements Scene {
  sel = 0;
  t = 0;
  flash = 0;
  constructor(public back: Scene) {}
  private list(): string[] {
    return CHARACTERS.filter((c) => app.save.chars[c.id]).map((c) => c.id);
  }
  update(): void {
    this.t++;
    if (this.flash > 0) this.flash--;
    const inp = app.input;
    const list = this.list();
    if (inp.menu('back')) {
      app.go(this.back);
      return;
    }
    if (inp.menu('mup')) this.sel = (this.sel - 1 + list.length) % list.length;
    if (inp.menu('mdown')) this.sel = (this.sel + 1) % list.length;
    const h = hot.hover();
    let click = false;
    if (h?.startsWith('gr:') && (hot.mouse.moved || hot.mouse.click)) this.sel = Number(h.slice(3));
    if (h === 'lvup' && hot.mouse.click) click = true;
    if (inp.menu('ok') || click) {
      const id = list[this.sel];
      const c = app.save.chars[id];
      if (c.lv >= MAX_LEVEL) {
        audio.play('error');
        return;
      }
      const cost = levelCost(c.lv);
      if (app.save.crystals < cost) {
        audio.play('error');
        app.toast('영혼 결정이 부족하다', '#ff8080');
        return;
      }
      app.save.crystals -= cost;
      c.lv++;
      this.flash = 30;
      audio.play('levelup');
      app.achToast(checkAchievements(app.save));
      app.persist();
    }
  }
  world(g: CanvasRenderingContext2D): void {
    g.fillStyle = '#0c0818';
    g.fillRect(0, 0, 480, 270);
    g.save();
    g.globalCompositeOperation = 'lighter';
    const gr = g.createRadialGradient(330, 140, 0, 330, 140, 120);
    gr.addColorStop(0, 'rgba(80,200,230,0.25)');
    gr.addColorStop(1, 'rgba(80,200,230,0)');
    g.fillStyle = gr;
    g.fillRect(200, 20, 260, 240);
    g.restore();
  }
  ui(g: CanvasRenderingContext2D): void {
    const save = app.save;
    const list = this.list();
    text(g, '영웅 육성', 12, 8, { size: 12, color: '#a0f0ff', bold: true });
    drawIcon(g, 'shard', 360, 9, 10, '#40d0e0');
    text(g, `영혼 결정 ${save.crystals}`, 374, 10, { size: 8, color: '#a0f0ff' });
    panel(g, 8, 28, 130, 228);
    const VIS = 14;
    const off = Math.max(0, Math.min(list.length - VIS, this.sel - Math.floor(VIS / 2)));
    if (off > 0) text(g, '▲', 73, 29, { size: 5, align: 'center', color: '#a8a0c0' });
    if (off + VIS < list.length) text(g, '▼', 73, 250, { size: 5, align: 'center', color: '#a8a0c0' });
    list.forEach((id, i) => {
      if (i < off || i >= off + VIS) return;
      const c = CHAR_MAP[id];
      const y = 34 + (i - off) * 15.5;
      g.fillStyle = i === this.sel ? rgba(RARITY_COL[c.rarity], 0.35) : 'transparent';
      g.fillRect(12, y, 122, 15);
      hot.add(`gr:${i}`, 12, y, 122, 15);
      text(g, c.name, 16, y + 3, { size: 7, color: RARITY_COL[c.rarity] });
      text(g, `Lv.${save.chars[id].lv}`, 130, y + 3, { size: 7, align: 'right', color: '#ffffff' });
    });
    const id = list[this.sel];
    const c = CHAR_MAP[id];
    const o = save.chars[id];
    panel(g, 144, 28, 328, 228, { border: RARITY_COL[c.rarity] });
    const pose = this.flash > 0 ? 'castUp' : (['idle0', 'idle1'] as const)[Math.floor(this.t / 30) % 2];
    g.drawImage(charArt(id, pose), 210 - 72, 170 - 132, 144, 144);
    if (this.flash > 0) {
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = rgba('#a0f0ff', this.flash / 60);
      g.fillRect(150, 34, 120, 140);
      g.restore();
    }
    stars(g, 280, 36, c.rarity, 7);
    text(g, c.name, 280, 46, { size: 12, color: '#ffffff', bold: true });
    text(g, `${c.title} · ${TYPE_LABEL[c.type]}`, 280, 62, { size: 7, color: TYPE_COL[c.type] });
    text(g, `레벨 ${o.lv} / ${20}`, 280, 78, { size: 9, color: '#ffe080', bold: true });
    bar(g, 280, 92, 180, 5, o.lv / MAX_LEVEL, '#40d0e0');
    const nx = Math.min(MAX_LEVEL, o.lv + 1);
    text(g, `공격력 ${charAtk(c.atk, o.lv, 0)} → ${charAtk(c.atk, nx, 0)}`, 280, 104, { size: 7, color: '#f0e8d8' });
    text(g, `기본 체력 ${charHp(c.hp, o.lv)} → ${charHp(c.hp, nx)}`, 280, 116, { size: 7, color: '#f0e8d8' });
    text(g, `각성 ${o.aw} / 5 (중복 계약 시 상승)`, 280, 130, { size: 7, color: '#c080ff' });
    c.awaken.forEach((a, i) => text(g, `${i < o.aw ? '◆' : '◇'} ${a.desc}`, 280, 142 + i * 11, { size: 6, color: i < o.aw ? '#ffe080' : '#6a6078', maxW: 186 }));
    const maxed = o.lv >= MAX_LEVEL;
    const cost = levelCost(o.lv);
    button(g, 160, 206, 300, 30, maxed ? '최대 레벨' : '레벨 업', true, { sub: maxed ? '' : `영혼 결정 ${cost} (보유 ${save.crystals})`, disabled: maxed || save.crystals < cost, col: '#40d0e0', size: 10 });
    hot.add('lvup', 160, 206, 300, 30);
    keyHint(g, [['↑↓', '영웅'], [app.input.label('attack'), '레벨 업'], ['Esc', '나가기']], 258);
  }
}
