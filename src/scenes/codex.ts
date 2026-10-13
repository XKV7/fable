import { app, type Scene } from '../app';
import { audio } from '../core/audio';
import { CHARACTERS, CHAR_MAP, TYPE_COL, TYPE_LABEL } from '../data/characters';
import { CRESTS } from '../data/crests';
import { RELICS } from '../data/relics';
import { WEAPONS, weaponDesc } from '../data/weapons';
import { text, textBlock } from '../gfx/renderer';
import { charFrame, tinted } from '../gfx/sprites';
import { rgba } from '../gfx/pixel';
import type { ActionDef, PoseName } from '../game/types';
import { drawIcon } from '../ui/icons';
import { crestTags } from '../ui/cards';
import { RARITY_COL, RELIC_RARITY_COL, RELIC_RARITY_NAME } from '../ui/theme';
import { button, hot, keyHint, panel, stars } from '../ui/widgets';
import { MAX_AWAKEN, MAX_REFINE } from '../game/save';
import { Fx } from '../game/fx';

const TABS = ['영웅', '무기', '유물', '문장'];

/** 도감: 전체 목록(미획득은 실루엣), 각성/재련 단계, 상세 + 미리보기 애니메이션 */
export class CodexScene implements Scene {
  tab = 0;
  sel = 0;
  t = 0;
  scroll = 0;
  fx = new Fx();
  preview = { act: 0, f: 0, which: 0 };

  constructor(public back: Scene) {}

  private count(): number {
    return [CHARACTERS.length, WEAPONS.length, RELICS.length, CRESTS.length][this.tab];
  }

  update(): void {
    this.t++;
    const inp = app.input;
    if (inp.menu('back')) {
      app.go(this.back);
      return;
    }
    if (inp.menu('tabL') || inp.pressed('skill1')) {
      this.tab = (this.tab + 3) % 4;
      this.sel = 0;
      audio.play('select');
    }
    if (inp.menu('tabR') || inp.pressed('skill2')) {
      this.tab = (this.tab + 1) % 4;
      this.sel = 0;
      audio.play('select');
    }
    const n = this.count();
    const cols = this.tab === 3 ? 1 : 5;
    const prev = this.sel;
    if (inp.menu('mleft')) this.sel = Math.max(0, this.sel - 1);
    if (inp.menu('mright')) this.sel = Math.min(n - 1, this.sel + 1);
    if (inp.menu('mup')) this.sel = Math.max(0, this.sel - cols);
    if (inp.menu('mdown')) this.sel = Math.min(n - 1, this.sel + cols);
    const h = hot.hover();
    if (h?.startsWith('cx:') && (hot.mouse.moved || hot.mouse.click)) this.sel = Number(h.slice(3));
    if (h?.startsWith('ct:') && hot.mouse.click) {
      this.tab = Number(h.slice(3));
      this.sel = 0;
    }
    if (prev !== this.sel) {
      audio.play('select');
      this.preview = { act: 0, f: 0, which: 0 };
    }
    // 미리보기 재생
    if (this.tab === 0) {
      const c = CHARACTERS[this.sel];
      if (c && app.save.newChars.includes(c.id)) {
        app.save.newChars = app.save.newChars.filter((x) => x !== c.id);
        app.persist();
      }
      const seq = this.seq();
      const a = seq[this.preview.act % seq.length];
      this.preview.f++;
      for (const ev of a.ev) {
        if (ev.t === this.preview.f && ev.k === 'hit' && ev.fx) this.fx.slash(120, 150, 1, ev.fx, c.fx);
        if (ev.t === this.preview.f && (ev.k === 'nova' || ev.k === 'meteor' || ev.k === 'field' || ev.k === 'proj')) this.fx.ring(150, 150, c.fx, 30);
      }
      if (this.preview.f > a.dur + 10) {
        this.preview.f = 0;
        this.preview.act++;
      }
    }
    this.fx.update();
  }

  private seq(): ActionDef[] {
    const c = CHARACTERS[this.sel];
    return [...c.combo, c.skills[0].act, c.skills[1].act, c.swap.act];
  }

  private pose(): PoseName {
    const seq = this.seq();
    const a = seq[this.preview.act % seq.length];
    let p: PoseName = a.pose[0][1];
    for (const [f, n] of a.pose) if (this.preview.f >= f) p = n;
    if (this.preview.f > a.dur) p = 'idle0';
    return p;
  }

  world(g: CanvasRenderingContext2D): void {
    const gr = g.createLinearGradient(0, 0, 0, 270);
    gr.addColorStop(0, '#120c20');
    gr.addColorStop(1, '#0a0614');
    g.fillStyle = gr;
    g.fillRect(0, 0, 480, 270);
  }

  ui(g: CanvasRenderingContext2D): void {
    text(g, '도감', 10, 6, { size: 12, color: '#e0d0ff', bold: true });
    TABS.forEach((t, i) => {
      button(g, 60 + i * 56, 6, 52, 16, t, i === this.tab, { size: 7 });
      hot.add(`ct:${i}`, 60 + i * 56, 6, 52, 16);
    });
    const save = app.save;
    const owned = this.tab === 0 ? Object.keys(save.chars).length : this.tab === 1 ? Object.keys(save.weapons).length : 0;
    if (this.tab < 2) text(g, `수집 ${owned} / ${this.count()}`, 474, 9, { size: 7, align: 'right', color: '#a8a0c0' });
    panel(g, 6, 28, 190, 226);
    if (this.tab === 0) this.charGrid(g);
    else if (this.tab === 1) this.weaponGrid(g);
    else if (this.tab === 2) this.relicGrid(g);
    else this.crestList(g);
    keyHint(g, [['Q/E', '탭'], ['방향키', '선택'], ['Esc', '나가기']], 258);
  }

  private gridCell(i: number): [number, number] {
    return [12 + (i % 5) * 36, 34 + Math.floor(i / 5) * 36];
  }

  private charGrid(g: CanvasRenderingContext2D): void {
    const save = app.save;
    CHARACTERS.forEach((c, i) => {
      const [x, y] = this.gridCell(i);
      const own = save.chars[c.id];
      g.fillStyle = i === this.sel ? rgba(RARITY_COL[c.rarity], 0.35) : 'rgba(255,255,255,0.04)';
      g.fillRect(x, y, 32, 32);
      g.strokeStyle = own ? RARITY_COL[c.rarity] : '#2a2238';
      g.strokeRect(x + 0.5, y + 0.5, 31, 31);
      const f = charFrame(c.id, 'idle0');
      g.drawImage(own ? f : tinted(f, '#05030a'), 13, 12, 22, 22, x + 2, y + 2, 28, 28);
      if (own?.aw) text(g, `${own.aw}`, x + 29, y + 22, { size: 6, align: 'right', color: '#ffe080', bold: true });
      if (save.newChars.includes(c.id)) text(g, 'NEW', x + 2, y + 1, { size: 5, color: '#ff6080', bold: true });
      hot.add(`cx:${i}`, x, y, 32, 32);
    });
    const c = CHARACTERS[this.sel];
    const own = save.chars[c.id];
    panel(g, 200, 28, 274, 226, { border: RARITY_COL[c.rarity] });
    // 미리보기
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.fillRect(204, 32, 110, 128);
    g.fillStyle = '#2a2238';
    g.fillRect(204, 150, 110, 2);
    const f = charFrame(c.id, this.pose());
    g.drawImage(own ? f : tinted(f, '#05030a'), 259 - 48, 150 - 88, 96, 96);
    g.save();
    g.beginPath();
    g.rect(204, 32, 110, 128);
    g.clip();
    g.translate(259 - 120, 128 - 150);
    this.fx.renderFront(g, 0, 0);
    g.restore();
    const seq = this.seq();
    const idx = this.preview.act % seq.length;
    const lbl = idx < c.combo.length ? `기본 공격 ${idx + 1}타` : idx === c.combo.length ? c.skills[0].name : idx === c.combo.length + 1 ? c.skills[1].name : c.swap.name;
    text(g, lbl, 259, 152, { size: 6, align: 'center', color: '#a8a0c0' });
    // 정보
    stars(g, 320, 34, c.rarity, 7);
    text(g, c.title, 320, 44, { size: 7, color: RARITY_COL[c.rarity] });
    text(g, own ? c.name : `${c.name} (미획득)`, 320, 54, { size: 11, color: '#ffffff', bold: true });
    text(g, `${TYPE_LABEL[c.type]}`, 320, 70, { size: 7, color: TYPE_COL[c.type], bold: true });
    if (c.crest) crestTags(g, [c.crest], 360, 69);
    text(g, `공격 ${c.atk} · 체력 ${c.hp} · 속도 ${c.speed}`, 320, 82, { size: 6, color: '#c8c0d8' });
    text(g, own ? `Lv.${own.lv} · 각성 ${own.aw}/${MAX_AWAKEN}` : '계약의 제단에서 획득', 320, 92, { size: 7, color: own ? '#ffe080' : '#8a8098' });
    textBlock(g, c.lore, 320, 104, 150, { size: 6, color: '#a8a0c0' }, 8);
    // 스킬
    let y = 164;
    const rows: [string, string][] = [
      [`기본 공격 (${c.combo.length}타 콤보)`, `${c.combo.length}타 콤보 · 공중 공격 · 대시 공격`],
      [`[스킬1] ${c.skills[0].name} (${c.skills[0].cd}초)`, c.skills[0].desc],
      [`[스킬2] ${c.skills[1].name} (${c.skills[1].cd}초)`, c.skills[1].desc],
      [c.swap.name, c.swap.desc],
      [`[패시브] ${c.passive.name}`, c.passive.desc],
    ];
    for (const [n, d] of rows) {
      text(g, n, 206, y, { size: 6, color: '#ffe080' });
      text(g, d, 206, y + 8, { size: 6, color: '#c8c0d8', maxW: 150 });
      y += 18;
    }
    text(g, '각성', 362, 164, { size: 7, color: '#e0d0ff', bold: true });
    c.awaken.forEach((a, i) => {
      const on = !!own && own.aw > i;
      text(g, `${i + 1}`, 362, 176 + i * 15, { size: 6, color: on ? '#ffe080' : '#5a5068', bold: true });
      text(g, a.desc, 370, 176 + i * 15, { size: 6, color: on ? '#f0e8d8' : '#6a6078', maxW: 100 });
    });
  }

  private weaponGrid(g: CanvasRenderingContext2D): void {
    const save = app.save;
    WEAPONS.forEach((w, i) => {
      const [x, y] = this.gridCell(i);
      const own = save.weapons[w.id];
      g.fillStyle = i === this.sel ? rgba(RARITY_COL[w.rarity], 0.35) : 'rgba(255,255,255,0.04)';
      g.fillRect(x, y, 32, 32);
      g.strokeStyle = own ? RARITY_COL[w.rarity] : '#2a2238';
      g.strokeRect(x + 0.5, y + 0.5, 31, 31);
      drawIcon(g, w.icon, x + 4, y + 4, 24, own ? w.col : '#2e2640');
      if (own && own.rf > 1) text(g, `${own.rf}`, x + 29, y + 22, { size: 6, align: 'right', color: '#ffe080', bold: true });
      hot.add(`cx:${i}`, x, y, 32, 32);
    });
    const w = WEAPONS[this.sel];
    const own = save.weapons[w.id];
    panel(g, 200, 28, 274, 226, { border: RARITY_COL[w.rarity] });
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.fillRect(208, 36, 80, 80);
    drawIcon(g, w.icon, 216, 44, 64, own ? w.col : '#2e2640');
    stars(g, 296, 38, w.rarity, 8);
    text(g, w.name, 296, 52, { size: 10, color: '#ffffff', bold: true, maxW: 172 });
    text(g, `공격력 +${w.atk}`, 296, 68, { size: 7, color: '#c8c0d8' });
    if (w.crest) crestTags(g, w.crest, 296, 80);
    text(g, own ? `보유 · 재련 ${own.rf}/${MAX_REFINE}` : '미획득', 296, 96, { size: 7, color: own ? '#ffe080' : '#8a8098' });
    text(g, '효과', 210, 126, { size: 8, color: '#e0d0ff', bold: true });
    textBlock(g, weaponDesc(w, own?.rf ?? 1), 210, 140, 254, { size: 7, color: '#f0e8d8' }, 10);
    text(g, '재련 단계별 효과', 210, 176, { size: 7, color: '#e0d0ff' });
    for (let r = 1; r <= 5; r++) text(g, `${r}단계: ${weaponDesc(w, r)}`, 210, 186 + (r - 1) * 11, { size: 6, color: own && own.rf >= r ? '#ffe080' : '#6a6078', maxW: 256 });
  }

  private relicGrid(g: CanvasRenderingContext2D): void {
    RELICS.forEach((r, i) => {
      const x = 12 + (i % 8) * 22;
      const y = 34 + Math.floor(i / 8) * 22;
      g.fillStyle = i === this.sel ? 'rgba(160,128,255,0.35)' : 'rgba(255,255,255,0.04)';
      g.fillRect(x, y, 20, 20);
      drawIcon(g, r.icon, x + 2, y + 2, 16, r.col);
      hot.add(`cx:${i}`, x, y, 20, 20);
    });
    const r = RELICS[this.sel];
    panel(g, 200, 28, 274, 226, { border: RELIC_RARITY_COL[r.rarity] });
    drawIcon(g, r.icon, 214, 40, 56, r.col);
    text(g, r.name, 282, 44, { size: 11, color: '#ffffff', bold: true });
    text(g, RELIC_RARITY_NAME[r.rarity], 282, 60, { size: 7, color: RELIC_RARITY_COL[r.rarity] });
    crestTags(g, r.crest, 282, 72);
    textBlock(g, r.desc, 212, 110, 250, { size: 8, color: '#f0e8d8' }, 12);
    text(g, '유물은 런 중 정예·보물·상점·이벤트에서 얻는다.', 212, 230, { size: 6, color: '#8a8098' });
    void this.sel;
  }

  private crestList(g: CanvasRenderingContext2D): void {
    CRESTS.forEach((c, i) => {
      const y = 34 + i * 21;
      g.fillStyle = i === this.sel ? rgba(c.col, 0.25) : 'rgba(255,255,255,0.03)';
      g.fillRect(12, y, 178, 19);
      drawIcon(g, c.icon, 16, y + 3, 13, c.col);
      text(g, c.name, 34, y + 5, { size: 8, color: c.col, bold: true });
      const n = RELICS.filter((r) => r.crest.includes(c.id)).length;
      text(g, `유물 ${n}종`, 184, y + 6, { size: 6, align: 'right', color: '#8a8098' });
      hot.add(`cx:${i}`, 12, y, 178, 19);
    });
    const c = CRESTS[this.sel];
    panel(g, 200, 28, 274, 226, { border: c.col });
    drawIcon(g, c.icon, 212, 38, 32, c.col);
    text(g, `${c.name}의 문장`, 252, 44, { size: 12, color: c.col, bold: true });
    c.tiers.forEach((t, i) => {
      const y = 86 + i * 40;
      g.fillStyle = rgba(c.col, 0.12);
      g.fillRect(210, y, 254, 34);
      text(g, `${t.n}개`, 216, y + 4, { size: 9, color: c.col, bold: true });
      textBlock(g, t.desc, 246, y + 5, 212, { size: 7, color: '#f0e8d8' }, 10);
    });
    const chars = CHARACTERS.filter((x) => x.crest === c.id).map((x) => x.name);
    const ws = WEAPONS.filter((w) => w.crest?.includes(c.id)).map((w) => w.name.replace(/「.*」/, '').trim());
    text(g, `영웅: ${chars.join(', ') || '-'}`, 212, 212, { size: 6, color: '#c8c0d8', maxW: 254 });
    text(g, `무기: ${ws.join(', ') || '-'}`, 212, 224, { size: 6, color: '#c8c0d8', maxW: 254 });
    void CHAR_MAP;
  }
}
