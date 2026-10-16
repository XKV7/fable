import { app, type Scene } from '../app';
import { audio } from '../core/audio';
import { CHAR_MAP, CHARACTERS, TYPE_COL, TYPE_LABEL } from '../data/characters';
import { BANNER_INFO, GACHA, RATE_TABLE, type BannerKind } from '../data/gacha';
import { WEAPON_MAP, WEAPONS, weaponDesc } from '../data/weapons';
import { text } from '../gfx/renderer';
import { charArt, tinted } from '../gfx/sprites';
import { rgba } from '../gfx/pixel';
import { currentPickup, performPull, pullCost, type PullOutcome } from '../game/meta';
import { drawIcon } from '../ui/icons';
import { RARITY_BG, RARITY_COL } from '../ui/theme';
import { button, hot, keyHint, panel, stars } from '../ui/widgets';
import { pct } from '../core/math';
import type { PoseName, Rarity } from '../game/types';

type Phase = 'menu' | 'throw' | 'beam' | 'cards' | 'reveal' | 'summary';

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  col: string;
}

const BANNERS: BannerKind[] = ['pickup', 'char', 'weapon'];
const PICK5 = (): typeof CHARACTERS => CHARACTERS.filter((c) => c.rarity === 5);
const PICK4 = (): typeof CHARACTERS => CHARACTERS.filter((c) => c.rarity === 4);

export class GachaScene implements Scene {
  banner = 0;
  btn = 1;
  phase: Phase = 'menu';
  t = 0;
  results: PullOutcome[] = [];
  flipped = 0;
  flipT = 0;
  flipAnim = 0;
  revealIdx = -1;
  revealT = 0;
  sparks: Spark[] = [];
  shakeT = 0;
  maxR: Rarity = 3;
  stoneAnim = 0;
  /** 디버그 픽업 선택 창 */
  picker: { row: number; col: number; five: string; four: string[] } | null = null;

  constructor(public back: Scene) {}

  enter(): void {
    audio.playMusic('gacha');
    if (!app.save.freePullUsed) this.btn = 2;
  }

  get kind(): BannerKind {
    return BANNERS[this.banner];
  }

  private freeAvailable(): boolean {
    return !app.save.freePullUsed && this.kind !== 'weapon';
  }

  private buttons(): { label: string; sub: string; count: number; free: boolean; ok: boolean }[] {
    const s = app.save.stones;
    const out = [
      { label: '1회 계약', sub: `영혼석 ${pullCost(1)}`, count: 1, free: false, ok: s >= pullCost(1) },
      { label: '10회 계약', sub: `영혼석 ${pullCost(10)} · ★4↑ 확정`, count: 10, free: false, ok: s >= pullCost(10) },
    ];
    if (this.freeAvailable()) out.push({ label: '첫 계약 · 무료 10회', sub: '★4 이상 확정!', count: 10, free: true, ok: true });
    return out;
  }

  private doPull(count: number, free: boolean): void {
    const res = performPull(app.save, this.kind, count, free);
    if (!res) {
      audio.play('error');
      app.toast('영혼석이 부족하다 — 런에서 영혼석을 모으자', '#ff8080');
      return;
    }
    app.persist();
    this.results = res;
    this.maxR = Math.max(...res.map((r) => r.rarity)) as Rarity;
    this.phase = 'throw';
    this.t = 0;
    this.flipped = 0;
    this.flipT = 0;
    audio.play('gacha_throw');
  }

  private burst(x: number, y: number, col: string, n: number, spd = 3): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = spd * (0.3 + Math.random());
      this.sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 30 + Math.random() * 30, col });
    }
  }

  private cardPos(i: number): [number, number, number, number] {
    const n = this.results.length;
    if (n === 1) return [210, 70, 60, 90];
    const w = 64;
    const h = 92;
    const col = i % 5;
    const row = Math.floor(i / 5);
    return [240 - (5 * (w + 8) - 8) / 2 + col * (w + 8), 36 + row * (h + 12), w, h];
  }

  private startReveal(i: number): boolean {
    const r = this.results[i];
    if (r.rarity >= 5 || (r.rarity === 4 && r.isNew && r.type === 'char')) {
      this.phase = 'reveal';
      this.revealIdx = i;
      this.revealT = 0;
      audio.play(r.rarity >= 5 ? 'reveal_5' : 'reveal_4');
      if (r.rarity >= 5) this.shakeT = 40;
      return true;
    }
    return false;
  }

  private flipNext(): void {
    if (this.flipped >= this.results.length) return;
    const i = this.flipped++;
    this.flipAnim = 12;
    const r = this.results[i];
    const [x, y, w, h] = this.cardPos(i);
    this.burst(x + w / 2, y + h / 2, RARITY_COL[r.rarity], r.rarity >= 5 ? 40 : r.rarity === 4 ? 20 : 8, r.rarity >= 5 ? 4 : 2.5);
    audio.play(`reveal_${Math.min(5, r.rarity)}`);
    audio.play('flip');
    if (r.rarity >= 5) this.shakeT = 20;
    this.startReveal(i);
  }

  update(): void {
    const inp = app.input;
    this.t++;
    if (this.shakeT > 0) this.shakeT--;
    if (this.flipAnim > 0) this.flipAnim--;
    for (const s of this.sparks) {
      s.x += s.vx;
      s.y += s.vy;
      s.vy += 0.05;
      s.vx *= 0.97;
      s.life--;
    }
    this.sparks = this.sparks.filter((s) => s.life > 0);
    const skip = inp.menu('back');
    switch (this.phase) {
      case 'menu': {
        if (this.picker) {
          this.updatePicker();
          break;
        }
        if (app.debug && this.kind === 'pickup' && (inp.raw('KeyP') || (hot.hover() === 'pkopen' && hot.mouse.click))) {
          this.openPicker();
          break;
        }
        if (inp.menu('back')) {
          app.go(this.back);
          return;
        }
        if (inp.menu('mup')) {
          this.banner = (this.banner + BANNERS.length - 1) % BANNERS.length;
          audio.play('select');
        }
        if (inp.menu('mdown')) {
          this.banner = (this.banner + 1) % BANNERS.length;
          audio.play('select');
        }
        const btns = this.buttons();
        if (this.btn >= btns.length) this.btn = btns.length - 1;
        if (inp.menu('mleft')) this.btn = (this.btn + btns.length - 1) % btns.length;
        if (inp.menu('mright')) this.btn = (this.btn + 1) % btns.length;
        const h = hot.hover();
        let click = false;
        if (h?.startsWith('gb:') && hot.mouse.moved) this.btn = Number(h.slice(3));
        if (h?.startsWith('gb:') && hot.mouse.click) click = true;
        if (h?.startsWith('gt:') && hot.mouse.click) this.banner = Number(h.slice(3));
        if (inp.menu('ok') || click) {
          const b = btns[this.btn];
          if (!b.ok) {
            audio.play('error');
            app.toast('영혼석이 부족하다', '#ff8080');
          } else this.doPull(b.count, b.free);
        }
        break;
      }
      case 'throw':
        if (this.t === 50) {
          audio.play('gacha_impact');
          this.shakeT = 10;
          this.burst(240, 150, '#ffffff', 30, 3);
        }
        if (this.t >= 62) {
          this.phase = 'beam';
          this.t = 0;
          audio.play(`beam_${Math.min(5, this.maxR)}`);
          if (this.maxR >= 5) this.shakeT = 60;
        }
        if (skip) this.toSummary();
        break;
      case 'beam':
        if (this.t % 4 === 0) this.burst(240 + (Math.random() - 0.5) * 40, 160, RARITY_COL[this.maxR], 3, 2);
        if (this.t >= (this.maxR >= 5 ? 110 : 80) || (inp.menu('ok') && this.t > 30)) {
          this.phase = 'cards';
          this.t = 0;
          this.flipT = 20;
        }
        if (skip) this.toSummary();
        break;
      case 'cards': {
        if (skip) {
          this.toSummary();
          break;
        }
        if (this.flipped < this.results.length) {
          this.flipT--;
          const next = this.results[this.flipped];
          const delay = next && next.rarity >= 5 ? 40 : 12;
          if (this.flipT <= 0 || inp.menu('ok') || hot.mouse.click) {
            this.flipNext();
            this.flipT = delay;
          }
        } else if (this.flipT > 0) this.flipT--;
        else if (inp.menu('ok') || hot.mouse.click) {
          this.phase = 'summary';
          this.flipT = 0;
          this.t = 0;
        }
        break;
      }
      case 'reveal':
        this.revealT++;
        if (this.revealT % 3 === 0) this.burst(240, 130, RARITY_COL[this.results[this.revealIdx].rarity], 2, 4);
        if (this.revealT > 40 && (inp.menu('ok') || hot.mouse.click || skip)) {
          this.phase = 'cards';
          this.flipT = 10;
          if (skip) this.toSummary();
        }
        break;
      case 'summary':
        if (this.t > 15 && (inp.menu('ok') || inp.menu('back') || hot.mouse.click)) {
          this.phase = 'menu';
          this.t = 0;
          audio.playMusic('gacha');
          if (this.btn === 2 && !this.freeAvailable()) this.btn = 1;
        }
        break;
    }
  }

  private toSummary(): void {
    this.phase = 'summary';
    this.flipT = 0;
    this.flipped = this.results.length;
    this.t = 0;
    audio.play(`reveal_${this.maxR}`);
  }

  shake(): [number, number] {
    if (this.shakeT <= 0) return [0, 0];
    const m = Math.min(4, this.shakeT / 6);
    return [(Math.random() - 0.5) * m * 2, (Math.random() - 0.5) * m * 2];
  }

  world(g: CanvasRenderingContext2D): void {
    // 제단 배경
    const gr = g.createLinearGradient(0, 0, 0, 270);
    gr.addColorStop(0, '#0a0818');
    gr.addColorStop(1, '#1a1030');
    g.fillStyle = gr;
    g.fillRect(0, 0, 480, 270);
    for (let i = 0; i < 60; i++) {
      const x = (i * 131) % 480;
      const y = (i * 71 + this.t * 0.1 * ((i % 3) + 1)) % 270;
      g.fillStyle = `rgba(200,180,255,${0.15 + (i % 5) * 0.08})`;
      g.fillRect(x, 270 - y, 1, 1);
    }
    // 제단 구조물
    g.fillStyle = '#2a2040';
    g.fillRect(180, 190, 120, 80);
    g.fillStyle = '#3a3058';
    g.fillRect(170, 184, 140, 8);
    g.fillStyle = '#4a4070';
    g.fillRect(200, 150, 80, 36);
    g.fillStyle = '#5a5088';
    g.fillRect(196, 146, 88, 6);
    // 마법진
    g.save();
    g.translate(240, 196);
    g.scale(1, 0.3);
    g.strokeStyle = rgba('#9ef0ff', 0.4 + 0.2 * Math.sin(this.t * 0.05));
    g.lineWidth = 2;
    g.beginPath();
    g.arc(0, 0, 70, 0, Math.PI * 2);
    g.stroke();
    g.beginPath();
    for (let i = 0; i <= 6; i++) {
      const a = (i / 6) * Math.PI * 2 + this.t * 0.01;
      g.lineTo(Math.cos(a) * 60, Math.sin(a) * 60);
    }
    g.stroke();
    g.restore();
    // 빛 기둥
    if (this.phase === 'beam' || this.phase === 'throw' && this.t > 50) {
      const col = this.phase === 'beam' ? RARITY_COL[this.maxR] : '#ffffff';
      const k = this.phase === 'beam' ? Math.min(1, this.t / 20) : 1 - (62 - this.t) / 12;
      const w = (this.maxR >= 5 ? 60 : this.maxR === 4 ? 40 : 28) * k;
      g.save();
      g.globalCompositeOperation = 'lighter';
      const bg = g.createLinearGradient(240 - w, 0, 240 + w, 0);
      bg.addColorStop(0, rgba(col, 0));
      bg.addColorStop(0.5, rgba(col, 0.85));
      bg.addColorStop(1, rgba(col, 0));
      g.fillStyle = bg;
      g.fillRect(240 - w, 0, w * 2, 180);
      g.fillStyle = rgba('#ffffff', 0.7 * k);
      g.fillRect(240 - w * 0.12, 0, w * 0.24, 180);
      if (this.maxR >= 5 && this.phase === 'beam') {
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2 + this.t * 0.02;
          g.strokeStyle = rgba('#ffe080', 0.25);
          g.lineWidth = 6;
          g.beginPath();
          g.moveTo(240, 150);
          g.lineTo(240 + Math.cos(a) * 400, 150 + Math.sin(a) * 400);
          g.stroke();
        }
      }
      g.restore();
    }
  }

  private openPicker(): void {
    const p = currentPickup(app.save);
    this.picker = { row: 0, col: Math.max(0, PICK5().findIndex((c) => c.id === p.five)), five: p.five, four: [...p.four] };
    audio.play('select');
  }

  private updatePicker(): void {
    const pk = this.picker!;
    const inp = app.input;
    if (!app.debug || inp.menu('back')) {
      this.picker = null;
      return;
    }
    const rowLen = (r: number): number => (r === 0 ? PICK5().length : r === 1 ? PICK4().length : 3);
    const prevRow = pk.row;
    if (inp.menu('mup')) pk.row = (pk.row + 2) % 3;
    if (inp.menu('mdown')) pk.row = (pk.row + 1) % 3;
    if (pk.row !== prevRow) pk.col = pk.row === 2 ? 0 : Math.min(pk.col, rowLen(pk.row) - 1);
    if (inp.menu('mleft')) pk.col--;
    if (inp.menu('mright')) pk.col++;
    pk.col = (pk.col + rowLen(pk.row)) % rowLen(pk.row);
    const h = hot.hover();
    let click = false;
    const m = h?.match(/^pk([54b]):(\d+)$/);
    if (m) {
      if (hot.mouse.moved || hot.mouse.click) {
        pk.row = m[1] === '5' ? 0 : m[1] === '4' ? 1 : 2;
        pk.col = Number(m[2]);
      }
      if (hot.mouse.click) click = true;
    }
    if (!(inp.menu('ok') || click)) return;
    if (pk.row === 0) {
      pk.five = PICK5()[pk.col].id;
      audio.play('select');
    } else if (pk.row === 1) {
      const id = PICK4()[pk.col].id;
      if (pk.four.includes(id)) pk.four = pk.four.filter((x) => x !== id);
      else {
        pk.four.push(id);
        if (pk.four.length > 2) pk.four.shift();
      }
      audio.play('select');
    } else if (pk.col === 0) {
      if (pk.four.length !== 2) {
        audio.play('error');
        app.toast('★4 픽업은 2명을 골라야 한다', '#ff8080');
        return;
      }
      app.save.pickupOverride = { five: pk.five, four: [pk.four[0], pk.four[1]] };
      app.persist();
      audio.play('confirm');
      app.toast(`[디버그] 픽업 지정: ${CHAR_MAP[pk.five].name} / ${pk.four.map((id) => CHAR_MAP[id].name).join(' · ')}`, '#80ffa0');
      this.picker = null;
    } else if (pk.col === 1) {
      app.save.pickupOverride = null;
      app.persist();
      audio.play('confirm');
      app.toast('[디버그] 자동 로테이션 픽업으로 복귀', '#80ffa0');
      this.picker = null;
    } else this.picker = null;
  }

  private renderPicker(g: CanvasRenderingContext2D): void {
    const pk = this.picker!;
    g.fillStyle = 'rgba(4,2,10,0.95)';
    g.fillRect(0, 0, 480, 270);
    panel(g, 36, 18, 408, 230, { border: '#80ffa0' });
    text(g, '[디버그] 픽업 직접 선택', 46, 24, { size: 10, color: '#80ffa0', bold: true });
    text(g, app.save.pickupOverride ? '현재: 직접 지정' : '현재: 자동 로테이션', 434, 27, { size: 6, align: 'right', color: '#a8a0c0' });
    const cell = (c: { id: string; name: string; rarity: Rarity }, x: number, y: number, w: number, on: boolean, cur: boolean, hid: string): void => {
      g.fillStyle = on ? rgba(RARITY_COL[c.rarity], 0.4) : 'rgba(255,255,255,0.05)';
      g.fillRect(x, y, w, 46);
      g.strokeStyle = cur ? '#ffffff' : on ? RARITY_COL[c.rarity] : '#3a3048';
      g.strokeRect(x + 0.5, y + 0.5, w - 1, 45);
      g.drawImage(charArt(c.id, on ? 'castUp' : 'idle0'), x + w / 2 - 24, y - 12, 48, 48);
      text(g, c.name, x + w / 2, y + 36, { size: 6, align: 'center', color: on ? '#ffe080' : '#ffffff', maxW: w - 2 });
      if (on) text(g, '✔', x + w - 3, y + 2, { size: 6, align: 'right', color: '#80ffa0', bold: true });
      hot.add(hid, x, y, w, 46);
    };
    text(g, '★5 픽업 (1명)', 46, 42, { size: 7, color: RARITY_COL[5] });
    PICK5().forEach((c, i) => cell(c, 46 + i * 52, 54, 48, pk.five === c.id, pk.row === 0 && pk.col === i, `pk5:${i}`));
    text(g, `★4 픽업 (2명) — ${pk.four.length}/2`, 46, 108, { size: 7, color: RARITY_COL[4] });
    PICK4().forEach((c, i) => cell(c, 46 + i * 43, 120, 41, pk.four.includes(c.id), pk.row === 1 && pk.col === i, `pk4:${i}`));
    ['적용', '자동 로테이션 복귀', '취소'].forEach((l, i) => {
      button(g, 70 + i * 116, 184, 108, 22, l, pk.row === 2 && pk.col === i, { col: i === 0 ? '#80ffa0' : '#9ef0ff' });
      hot.add(`pkb:${i}`, 70 + i * 116, 184, 108, 22);
    });
    text(g, '천장 카운트는 그대로 유지된다', 240, 214, { size: 6, align: 'center', color: '#8a8098' });
    keyHint(g, [['방향키', '이동'], [app.input.label('attack'), '선택'], ['Esc', '취소']]);
  }

  ui(g: CanvasRenderingContext2D): void {
    if (this.phase === 'menu') this.renderMenu(g);
    else if (this.phase === 'throw') {
      const t = Math.min(1, this.t / 50);
      const x = 240;
      const y = 280 - Math.sin(t * Math.PI) * 150 - t * 120;
      drawIcon(g, 'gem', x - 8, y, 16, '#6a9aff');
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = 'rgba(120,160,255,0.4)';
      g.beginPath();
      g.arc(x, y + 8, 12, 0, Math.PI * 2);
      g.fill();
      g.restore();
      text(g, '영혼석을 바친다…', 240, 240, { size: 9, align: 'center', color: '#c0d0ff' });
      keyHint(g, [['Esc', '건너뛰기']]);
    } else if (this.phase === 'beam') {
      const msg = this.maxR >= 5 ? '하늘이 금빛으로 갈라진다…!' : this.maxR === 4 ? '보랏빛 혼이 응답한다…' : '푸른 혼이 응답한다';
      text(g, msg, 240, 230, { size: 10, align: 'center', color: RARITY_COL[this.maxR], bold: true });
      keyHint(g, [[app.input.label('attack'), '계속'], ['Esc', '건너뛰기']]);
    } else if (this.phase === 'cards' || this.phase === 'summary') {
      this.renderCards(g);
      if (this.phase === 'summary') {
        const news = this.results.filter((r) => r.isNew).length;
        text(g, `결과: ★5↑ ${this.results.filter((r) => r.rarity >= 5).length} · ★4 ${this.results.filter((r) => r.rarity === 4).length} · 신규 ${news}`, 240, 244, { size: 8, align: 'center', color: '#ffe080' });
        keyHint(g, [[app.input.label('attack'), '확인']]);
      } else keyHint(g, [[app.input.label('attack'), '뒤집기'], ['Esc', '건너뛰기']]);
    } else if (this.phase === 'reveal') this.renderReveal(g);
    if (this.picker) this.renderPicker(g);
    // 파티클
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (const s of this.sparks) {
      g.fillStyle = rgba(s.col, Math.min(1, s.life / 20));
      g.fillRect(s.x, s.y, 2, 2);
    }
    g.restore();
  }

  private renderMenu(g: CanvasRenderingContext2D): void {
    const save = app.save;
    // 상단
    text(g, '계약의 제단', 12, 8, { size: 12, color: '#9ef0ff', bold: true });
    g.fillStyle = 'rgba(10,6,20,0.8)';
    g.fillRect(350, 6, 124, 16);
    drawIcon(g, 'gem', 354, 9, 10, '#6a9aff');
    text(g, `영혼석 ${save.stones}`, 368, 9, { size: 8, color: '#9ec0ff' });
    // 탭
    BANNERS.forEach((b, i) => {
      const y = 32 + i * 30;
      button(g, 8, y, 92, 26, BANNER_INFO[b].name, i === this.banner, { size: 7, sub: b === 'pickup' ? '픽업' : b === 'char' ? '상시 영웅' : '상시 무기', col: b === 'pickup' ? '#ffcc40' : b === 'char' ? '#c080ff' : '#80c0ff' });
      hot.add(`gt:${i}`, 8, y, 92, 26);
    });
    // 배너 그림
    panel(g, 106, 30, 236, 166, { border: this.kind === 'pickup' ? '#ffcc40' : '#6a5a9a' });
    const k = this.kind;
    text(g, BANNER_INFO[k].name, 116, 36, { size: 11, color: '#ffffff', bold: true });
    text(g, BANNER_INFO[k].desc, 116, 50, { size: 6, color: '#a8a0c0' });
    if (k === 'pickup') {
      const p = currentPickup(save);
      const c5 = CHAR_MAP[p.five];
      const pose = (['idle0', 'windHigh', 'slashDown', 'castUp', 'thrust', 'spin'] as PoseName[])[Math.floor(this.t / 30) % 6];
      g.save();
      g.globalCompositeOperation = 'lighter';
      const gr = g.createRadialGradient(190, 130, 0, 190, 130, 70);
      gr.addColorStop(0, 'rgba(255,200,80,0.45)');
      gr.addColorStop(1, 'rgba(255,200,80,0)');
      g.fillStyle = gr;
      g.fillRect(120, 60, 140, 140);
      g.restore();
      g.drawImage(charArt(p.five, pose), 190 - 72, 190 - 132, 144, 144);
      stars(g, 116, 162, 5, 8);
      text(g, `${c5.title}`, 116, 172, { size: 7, color: '#ffe080' });
      text(g, c5.name, 116, 182, { size: 10, color: '#ffffff', bold: true });
      p.four.forEach((id, i) => {
        g.drawImage(charArt(id, 'idle0'), 262 + i * 36 - 48, 134 - 88, 96, 96);
        text(g, CHAR_MAP[id].name, 262 + i * 36, 146, { size: 6, align: 'center', color: '#c080ff' });
      });
      text(g, '★4 픽업', 298, 156, { size: 6, align: 'center', color: '#c080ff' });
      text(g, save.pickupOverride ? '[디버그] 직접 지정한 픽업' : `런 ${GACHA.rotationRuns - save.runsSinceRotation}회 후 교체`, 336, 182, { size: 6, align: 'right', color: save.pickupOverride ? '#80ffa0' : '#a8a0c0' });
      if (app.debug) {
        const hov = hot.hover() === 'pkopen';
        g.fillStyle = hov ? 'rgba(128,255,160,0.3)' : 'rgba(128,255,160,0.12)';
        g.fillRect(262, 50, 76, 13);
        g.strokeStyle = '#80ffa0';
        g.strokeRect(262.5, 50.5, 75, 12);
        text(g, '픽업 선택 (P)', 300, 53, { size: 6, align: 'center', color: '#80ffa0' });
        hot.add('pkopen', 262, 50, 76, 13);
      }
    } else if (k === 'char') {
      const show = CHARACTERS.filter((c) => c.rarity >= 5).sort((a, b) => b.rarity - a.rarity);
      show.forEach((c, i) => {
        const x = 112 + i * (show.length > 5 ? 38 : 46);
        g.drawImage(tinted(charArt(c.id, 'idle0'), save.chars[c.id] ? RARITY_COL[c.rarity] : '#1a1028'), x - 39, 62, 96, 96);
        g.drawImage(charArt(c.id, i === Math.floor(this.t / 60) % show.length ? 'castUp' : 'idle0'), x - 38, 62, 96, 96);
        text(g, c.name, x + 10, i % 2 ? 168 : 160, { size: 7, align: 'center', color: c.rarity >= 6 ? RARITY_COL[c.rarity] : '#ffe080' });
      });
      text(g, `영웅 ${CHARACTERS.length}명 · 보유 ${Object.keys(save.chars).length}명`, 116, 180, { size: 7, color: '#c8c0d8' });
    } else {
      WEAPONS.filter((w) => w.rarity === 5).forEach((w, i) => {
        const x = 124 + (i % 3) * 72;
        const y = 66 + Math.floor(i / 3) * 56;
        g.fillStyle = 'rgba(255,200,80,0.1)';
        g.fillRect(x, y, 64, 50);
        drawIcon(g, w.icon, x + 18, y + 4, 28, w.col);
        text(g, w.name.replace(/「.*」/, '').trim(), x + 32, y + 36, { size: 6, align: 'center', color: '#ffe080', maxW: 62 });
      });
    }
    // 확률표
    panel(g, 348, 30, 126, 166);
    text(g, '확률표', 356, 36, { size: 8, color: '#e0d0ff', bold: true });
    const ready = (r: number): boolean => (k === 'weapon' ? WEAPONS : CHARACTERS).some((x) => x.rarity === r);
    RATE_TABLE.forEach(([r, p], i) => {
      const y = 47 + i * 10;
      stars(g, 356, y + 1, r, r >= 6 ? 4 : 5);
      text(g, pct(p, Number.isInteger(Math.round(p * 1e6) / 1e4) ? 0 : p < 0.001 ? 2 : p < 0.01 ? 1 : 2), 466, y, { size: 6, align: 'right', color: RARITY_COL[r] });
      if (!ready(r)) text(g, '준비 중', 430, y, { size: 5, align: 'right', color: '#8a8098' });
    });
    const pity = save.pity[k];
    text(g, '천장 (배너별)', 356, 100, { size: 7, color: '#e0d0ff' });
    text(g, `★5 이상 확정까지 ${GACHA.hardPity - pity.since5}회`, 356, 111, { size: 6, color: '#ffe080' });
    g.fillStyle = '#1a1424';
    g.fillRect(356, 121, 110, 5);
    g.fillStyle = pity.since5 >= GACHA.hardPity * 0.8 ? '#ffcc40' : '#a080ff';
    g.fillRect(356, 121, (110 * pity.since5) / GACHA.hardPity, 5);
    text(g, `현재 ${pity.since5}/${GACHA.hardPity}회`, 356, 129, { size: 6, color: '#c8c0d8' });
    text(g, '10회 계약: ★4 이상 확정', 356, 140, { size: 6, color: '#c080ff' });
    if (k === 'pickup') text(g, '★5의 50%는 픽업 영웅', 356, 151, { size: 6, color: '#a8a0c0' });
    const notReady = RATE_TABLE.map(([r]) => r).filter((r) => r > 5 && !ready(r));
    if (notReady.length) {
      let to = Math.min(...notReady) - 1;
      while (to > 5 && !ready(to)) to--;
      text(g, `${notReady.sort().map((r) => `★${r}`).join('·')} 준비 중: 나오면 ★${to}로`, 356, 163, { size: 5, color: '#8a8098' });
    }
    text(g, `누적 ${pity.total}회`, 356, 174, { size: 6, color: '#8a8098' });
    text(g, '중복: 영웅 각성 / 무기 재련', 356, 186, { size: 6, color: '#8a8098' });
    // 버튼
    const btns = this.buttons();
    const bw = 116;
    const x0 = 240 - (btns.length * (bw + 8) - 8) / 2;
    btns.forEach((b, i) => {
      button(g, x0 + i * (bw + 8), 204, bw, 30, b.label, this.btn === i, { sub: b.sub, disabled: !b.ok, col: b.free ? '#ffcc40' : '#9ef0ff' });
      hot.add(`gb:${i}`, x0 + i * (bw + 8), 204, bw, 30);
    });
    keyHint(g, [['↑↓', '배너'], ['←→', '선택'], [app.input.label('attack'), '계약'], ['Esc', '나가기']]);
  }

  private drawCard(g: CanvasRenderingContext2D, r: PullOutcome, x: number, y: number, w: number, h: number, faceUp: boolean): void {
    if (!faceUp) {
      g.fillStyle = '#1a1030';
      g.fillRect(x, y, w, h);
      g.strokeStyle = '#6a5a9a';
      g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
      drawIcon(g, 'soul', x + w / 2 - 10, y + h / 2 - 10, 20, '#6a5a9a');
      if (r.rarity >= 5 && this.flipped < this.results.length && (this.t >> 2) % 2) {
        g.strokeStyle = '#ffcc40';
        g.strokeRect(x - 0.5, y - 0.5, w + 1, h + 1);
      }
      return;
    }
    const [b0, b1] = RARITY_BG[r.rarity];
    const gr = g.createLinearGradient(0, y, 0, y + h);
    gr.addColorStop(0, b0);
    gr.addColorStop(1, b1);
    g.fillStyle = gr;
    g.fillRect(x, y, w, h);
    g.strokeStyle = RARITY_COL[r.rarity];
    g.lineWidth = r.rarity >= 5 ? 2 : 1;
    g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    g.lineWidth = 1;
    if (r.type === 'char') {
      g.drawImage(charArt(r.id, 'idle0'), x + w / 2 - 48, y - 38, 96, 96);
      text(g, CHAR_MAP[r.id].name, x + w / 2, y + h - 26, { size: 7, align: 'center', color: '#ffffff', bold: true });
    } else {
      const wd = WEAPON_MAP[r.id];
      drawIcon(g, wd.icon, x + w / 2 - 16, y + 12, 32, wd.col);
      text(g, wd.name.replace(/「.*」/, '').trim(), x + w / 2, y + h - 26, { size: 6, align: 'center', color: '#ffffff', bold: true, maxW: w - 4 });
    }
    stars(g, x + w / 2, y + h - 36, r.rarity, 5, 'center');
    text(g, r.note, x + w / 2, y + h - 14, { size: 6, align: 'center', color: r.isNew ? '#ffe080' : '#a0ffd0', bold: r.isNew });
    if (r.pickup) text(g, 'PICK UP', x + 3, y + 3, { size: 5, color: '#ffcc40', bold: true });
  }

  private renderCards(g: CanvasRenderingContext2D): void {
    this.results.forEach((r, i) => {
      const [x, y, w, h] = this.cardPos(i);
      const up = i < this.flipped;
      const justFlipped = i === this.flipped - 1 && this.flipAnim > 6 && this.phase === 'cards';
      if (justFlipped) {
        const k = (this.flipAnim - 6) / 6;
        g.save();
        g.translate(x + w / 2, y + h / 2);
        g.scale(Math.max(0.05, 1 - k), 1);
        this.drawCard(g, r, -w / 2, -h / 2, w, h, true);
        g.restore();
      } else this.drawCard(g, r, x, y, w, h, up);
    });
  }

  private renderReveal(g: CanvasRenderingContext2D): void {
    const r = this.results[this.revealIdx];
    const col = RARITY_COL[r.rarity];
    const t = this.revealT;
    g.fillStyle = 'rgba(4,2,10,0.88)';
    g.fillRect(0, 0, 480, 270);
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + t * 0.01;
      g.strokeStyle = rgba(col, 0.12);
      g.lineWidth = 10;
      g.beginPath();
      g.moveTo(180, 140);
      g.lineTo(180 + Math.cos(a) * 500, 140 + Math.sin(a) * 500);
      g.stroke();
    }
    const gr = g.createRadialGradient(180, 140, 0, 180, 140, 120);
    gr.addColorStop(0, rgba(col, 0.5));
    gr.addColorStop(1, rgba(col, 0));
    g.fillStyle = gr;
    g.fillRect(60, 20, 240, 240);
    g.restore();
    const k = Math.min(1, t / 25);
    if (r.type === 'char') {
      const c = CHAR_MAP[r.id];
      const pose = (['castUp', 'windHigh', 'slashDown', 'idle0'] as PoseName[])[Math.min(3, Math.floor(t / 18))];
      const sc = r.rarity >= 5 ? 5 : 4;
      const s = 48 * sc;
      g.globalAlpha = k;
      if (t < 25) g.drawImage(tinted(charArt(r.id, pose), '#ffffff'), 180 - s / 2, 255 - s, s, s);
      else g.drawImage(charArt(r.id, pose), 180 - s / 2, 255 - s, s, s);
      g.globalAlpha = 1;
      const tx = 300;
      const ta = Math.min(1, (t - 15) / 20);
      if (ta > 0) {
        stars(g, tx, 70, r.rarity, 12);
        text(g, c.title, tx, 90, { size: 9, color: col, alpha: ta });
        text(g, c.name, tx, 104, { size: 22, color: '#ffffff', bold: true, alpha: ta });
        text(g, `${TYPE_LABEL[c.type]} · ${c.passive.name}`, tx, 136, { size: 8, color: TYPE_COL[c.type], alpha: ta });
        text(g, c.lore, tx, 152, { size: 7, color: '#c8c0d8', alpha: ta, maxW: 170 });
        text(g, r.note, tx, 176, { size: 10, color: r.isNew ? '#ffe080' : '#a0ffd0', bold: true, alpha: ta });
      }
    } else {
      const w = WEAPON_MAP[r.id];
      g.globalAlpha = k;
      drawIcon(g, w.icon, 120, 80, 120, w.col);
      g.globalAlpha = 1;
      stars(g, 300, 80, r.rarity, 12);
      text(g, w.name, 300, 100, { size: 14, color: '#ffffff', bold: true, maxW: 175 });
      text(g, weaponDesc(w, app.save.weapons[r.id]?.rf ?? 1), 300, 124, { size: 7, color: '#c8c0d8', maxW: 170 });
      text(g, r.note, 300, 170, { size: 10, color: '#ffe080', bold: true });
    }
    if (t > 40) keyHint(g, [[app.input.label('attack'), '계속']]);
  }
}
