import { app, type Scene } from '../app';
import { audio } from '../core/audio';
import { CHARACTERS, CHAR_MAP, TYPE_COL, TYPE_LABEL } from '../data/characters';
import { CURSES } from '../data/meta';
import { WEAPONS, WEAPON_MAP, weaponDesc } from '../data/weapons';
import { text } from '../gfx/renderer';
import { charFrame } from '../gfx/sprites';
import { RunState } from '../game/run';
import { markAch } from '../game/meta';
import { drawIcon } from '../ui/icons';
import { RARITY_COL } from '../ui/theme';
import { button, hot, keyHint, panel, stars } from '../ui/widgets';
import { crestTags } from '../ui/cards';
import { RunScene } from './run';
import { rgba } from '../gfx/pixel';

type Focus = 0 | 1 | 2 | 3 | 4; // 슬롯1, 슬롯2, 무기, 저주, 출정

/** 편성: 영웅 2명 + 무기 1개 + 저주 단계 선택 후 출정 */
export class LoadoutScene implements Scene {
  focus: Focus = 4;
  picking: 'char' | 'weapon' | null = null;
  pick = 0;
  t = 0;
  constructor(public back: Scene) {}

  private ownedChars(): string[] {
    return CHARACTERS.filter((c) => app.save.chars[c.id]).map((c) => c.id);
  }
  private ownedWeapons(): string[] {
    return WEAPONS.filter((w) => app.save.weapons[w.id]).map((w) => w.id);
  }

  update(): void {
    this.t++;
    const inp = app.input;
    const lo = app.save.loadout;
    if (this.picking) {
      const list = this.picking === 'char' ? this.ownedChars() : this.ownedWeapons();
      const cols = 8;
      if (inp.menu('mleft')) this.pick = Math.max(0, this.pick - 1);
      if (inp.menu('mright')) this.pick = Math.min(list.length - 1, this.pick + 1);
      if (inp.menu('mup')) this.pick = Math.max(0, this.pick - cols);
      if (inp.menu('mdown')) this.pick = Math.min(list.length - 1, this.pick + cols);
      const h = hot.hover();
      let click = false;
      if (h?.startsWith('lp:')) {
        if (hot.mouse.moved) this.pick = Number(h.slice(3));
        if (hot.mouse.click) {
          this.pick = Number(h.slice(3));
          click = true;
        }
      }
      if (inp.menu('back')) {
        this.picking = null;
        audio.play('back');
      } else if (inp.menu('ok') || click) {
        const id = list[this.pick];
        if (this.picking === 'char') {
          const slot = this.focus as 0 | 1;
          const other = lo.chars[1 - slot];
          if (other === id) lo.chars[1 - slot] = lo.chars[slot];
          lo.chars[slot] = id;
        } else lo.weapon = id;
        audio.play('confirm');
        app.persist();
        this.picking = null;
      }
      return;
    }
    if (inp.menu('back')) {
      app.go(this.back);
      return;
    }
    if (inp.menu('mup')) {
      this.focus = Math.max(0, this.focus - 1) as Focus;
      audio.play('select');
    }
    if (inp.menu('mdown')) {
      this.focus = Math.min(4, this.focus + 1) as Focus;
      audio.play('select');
    }
    if (this.focus === 3) {
      if (inp.menu('mleft')) app.save.curse = Math.max(0, app.save.curse - 1);
      if (inp.menu('mright')) app.save.curse = Math.min(app.save.curseMax, app.save.curse + 1);
    }
    const h = hot.hover();
    let click = false;
    if (h?.startsWith('lf:')) {
      if (hot.mouse.moved) this.focus = Number(h.slice(3)) as Focus;
      if (hot.mouse.click) {
        this.focus = Number(h.slice(3)) as Focus;
        click = true;
      }
    }
    if (inp.menu('ok') || click) {
      audio.play('confirm');
      if (this.focus <= 1) {
        this.picking = 'char';
        this.pick = Math.max(0, this.ownedChars().indexOf(lo.chars[this.focus as 0 | 1]));
      } else if (this.focus === 2) {
        this.picking = 'weapon';
        this.pick = Math.max(0, this.ownedWeapons().indexOf(lo.weapon));
      } else if (this.focus === 3) {
        app.save.curse = app.save.curse >= app.save.curseMax ? 0 : app.save.curse + 1;
      } else this.depart();
    }
  }

  private depart(): void {
    const lo = app.save.loadout;
    if (!lo.chars[1] || lo.chars[0] === lo.chars[1] || !app.save.chars[lo.chars[1]]) {
      audio.play('error');
      app.toast('영웅 2명이 필요하다 — 계약의 제단에서 영웅을 부르자', '#ff8080');
      return;
    }
    app.persist();
    const run = new RunState(app.save);
    if (markAch(app.save, 'first_run')) app.achToast(['first_run']);
    app.persist();
    app.go(new RunScene(run));
  }

  world(g: CanvasRenderingContext2D): void {
    const gr = g.createLinearGradient(0, 0, 0, 270);
    gr.addColorStop(0, '#140c22');
    gr.addColorStop(1, '#080410');
    g.fillStyle = gr;
    g.fillRect(0, 0, 480, 270);
    // 포털
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 5; i++) {
      g.strokeStyle = rgba('#9a6bff', 0.15 + i * 0.05);
      g.lineWidth = 2;
      g.beginPath();
      g.ellipse(400, 150, 40 - i * 6 + Math.sin(this.t * 0.05 + i) * 2, 70 - i * 10, 0, 0, Math.PI * 2);
      g.stroke();
    }
    g.restore();
  }

  ui(g: CanvasRenderingContext2D): void {
    const save = app.save;
    const lo = save.loadout;
    text(g, '출정 편성', 12, 8, { size: 12, color: '#e0d0ff', bold: true });
    text(g, '함께할 영웅 2명과 무기를 고르세요. 전투 중 교대로 바꿔 싸울 수 있습니다.', 12, 26, { size: 7, color: '#a8a0c0' });
    // 슬롯
    for (let i = 0; i < 2; i++) {
      const id = lo.chars[i];
      const c = CHAR_MAP[id];
      const x = 12 + i * 150;
      const y = 40;
      const sel = this.focus === i;
      panel(g, x, y, 144, 120, { border: sel ? '#ffffff' : c ? RARITY_COL[c.rarity] : '#3a2e52' });
      hot.add(`lf:${i}`, x, y, 144, 120);
      text(g, i === 0 ? '선봉' : '교대', x + 6, y + 4, { size: 7, color: '#8a8098' });
      if (c) {
        const pose = sel ? (['idle0', 'windHigh', 'slashDown', 'thrust'] as const)[Math.floor(this.t / 20) % 4] : 'idle0';
        g.drawImage(charFrame(id, pose), x + 36 - 48, y + 102 - 88, 96, 96);
        stars(g, x + 76, y + 14, c.rarity, 6);
        text(g, c.name, x + 76, y + 24, { size: 10, color: '#ffffff', bold: true });
        text(g, c.title, x + 76, y + 38, { size: 6, color: '#a8a0c0' });
        text(g, TYPE_LABEL[c.type], x + 76, y + 48, { size: 7, color: TYPE_COL[c.type] });
        const own = save.chars[id];
        text(g, `Lv.${own?.lv ?? 1} · 각성 ${own?.aw ?? 0}`, x + 76, y + 58, { size: 6, color: '#ffe080' });
        if (c.crest) crestTags(g, [c.crest], x + 76, y + 68);
        text(g, c.skills[0].name, x + 76, y + 84, { size: 6, color: '#c8c0d8' });
        text(g, c.skills[1].name, x + 76, y + 93, { size: 6, color: '#c8c0d8' });
        text(g, c.swap.name.replace('교대: ', '교대 · '), x + 76, y + 102, { size: 6, color: '#a0ffd0', maxW: 66 });
      } else text(g, '비어 있음', x + 72, y + 56, { size: 9, align: 'center', color: '#6a6078' });
    }
    // 무기
    const w = WEAPON_MAP[lo.weapon];
    const wsel = this.focus === 2;
    panel(g, 12, 166, 294, 42, { border: wsel ? '#ffffff' : RARITY_COL[w.rarity] });
    hot.add('lf:2', 12, 166, 294, 42);
    drawIcon(g, w.icon, 18, 171, 30, w.col);
    stars(g, 54, 171, w.rarity, 5);
    text(g, `${w.name} (재련 ${save.weapons[w.id]?.rf ?? 1})`, 84, 170, { size: 8, color: '#ffffff', bold: true, maxW: 216 });
    text(g, weaponDesc(w, save.weapons[w.id]?.rf ?? 1), 54, 184, { size: 6, color: '#c8c0d8', maxW: 246 });
    if (w.crest) crestTags(g, w.crest, 54, 194);
    // 저주
    const csel = this.focus === 3;
    panel(g, 12, 212, 294, 24, { border: csel ? '#ffffff' : '#6a3a5a' });
    hot.add('lf:3', 12, 212, 294, 24);
    const cu = CURSES[save.curse];
    text(g, `◀ ${cu.name} ▶`, 20, 218, { size: 8, color: save.curse ? '#ff80a0' : '#c8c0d8', bold: true });
    text(g, save.curseMax ? cu.desc : '최종 보스를 쓰러뜨리면 저주 단계가 해금된다', 110, 219, { size: 6, color: '#a8a0c0', maxW: 190 });
    // 출정
    button(g, 316, 210, 156, 28, '출정!', this.focus === 4, { size: 11, col: '#ffcc40', sub: '끝없는 왕좌를 향해' });
    hot.add('lf:4', 316, 210, 156, 28);
    // 피커
    if (this.picking) {
      const list = this.picking === 'char' ? this.ownedChars() : this.ownedWeapons();
      g.fillStyle = 'rgba(4,2,10,0.8)';
      g.fillRect(0, 0, 480, 270);
      panel(g, 40, 24, 400, 220);
      text(g, this.picking === 'char' ? '영웅 선택' : '무기 선택', 50, 30, { size: 10, color: '#e0d0ff', bold: true });
      list.forEach((id, i) => {
        const x = 48 + (i % 8) * 48;
        const y = 46 + Math.floor(i / 8) * 44;
        const sel = i === this.pick;
        if (this.picking === 'char') {
          const c = CHAR_MAP[id];
          g.fillStyle = sel ? rgba(RARITY_COL[c.rarity], 0.4) : 'rgba(255,255,255,0.05)';
          g.fillRect(x, y, 46, 42);
          g.strokeStyle = RARITY_COL[c.rarity];
          g.strokeRect(x + 0.5, y + 0.5, 45, 41);
          g.drawImage(charFrame(id, sel ? 'castUp' : 'idle0'), x + 23 - 22, y - 9, 44, 44);
          text(g, c.name, x + 23, y + 33, { size: 6, align: 'center', color: lo.chars.includes(id) ? '#ffe080' : '#ffffff', maxW: 44 });
        } else {
          const wd = WEAPON_MAP[id];
          g.fillStyle = sel ? rgba(RARITY_COL[wd.rarity], 0.4) : 'rgba(255,255,255,0.05)';
          g.fillRect(x, y, 46, 42);
          g.strokeStyle = RARITY_COL[wd.rarity];
          g.strokeRect(x + 0.5, y + 0.5, 45, 41);
          drawIcon(g, wd.icon, x + 13, y + 3, 20, wd.col);
          text(g, wd.name.replace(/「.*」/, '').trim(), x + 23, y + 26, { size: 5, align: 'center', color: '#ffffff', maxW: 44 });
          text(g, `재련${save.weapons[id].rf}`, x + 23, y + 34, { size: 5, align: 'center', color: '#a8a0c0' });
        }
        hot.add(`lp:${i}`, x, y, 46, 42);
      });
      const cur = list[this.pick];
      if (cur && this.picking === 'weapon') text(g, weaponDesc(WEAPON_MAP[cur], save.weapons[cur].rf), 240, 232, { size: 7, align: 'center', color: '#ffe8c0', maxW: 390 });
      if (cur && this.picking === 'char') text(g, `${CHAR_MAP[cur].passive.name}: ${CHAR_MAP[cur].passive.desc}`, 240, 232, { size: 7, align: 'center', color: '#ffe8c0', maxW: 390 });
      keyHint(g, [['방향키', '선택'], [app.input.label('attack'), '결정'], ['Esc', '취소']]);
    } else keyHint(g, [['↑↓', '항목'], [app.input.label('attack'), '변경/출정'], ['Esc', '나가기']], 258);
  }
}
