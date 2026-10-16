import { app } from '../app';
import { drawWeaponArt } from '../gfx/weaponArt';
import { audio } from '../core/audio';
import { CHAR_MAP, TYPE_COL, TYPE_LABEL } from '../data/characters';
import { CREST_MAP } from '../data/crests';
import { EVENTS, ITEM_MAP, ITEMS, type EventDef } from '../data/meta';
import { RELIC_MAP } from '../data/relics';
import { WEAPON_MAP, weaponDesc } from '../data/weapons';
import { text, textBlock, wrap } from '../gfx/renderer';
import type { Room } from '../game/room';
import type { RunState } from '../game/run';
import { drawIcon, ITEM_ICON } from '../ui/icons';
import { charCard, crestTags, relicCard, weaponCard } from '../ui/cards';
import { portrait } from '../ui/hud';
import { RELIC_RARITY_COL } from '../ui/theme';
import { button, hot, keyHint, Menu, panel, stars } from '../ui/widgets';
import { pct } from '../core/math';
import type { StatKey } from '../game/types';

export interface Overlay {
  update(): 'close' | null;
  render(g: CanvasRenderingContext2D): void;
}

function dim(g: CanvasRenderingContext2D, a = 0.65): void {
  g.fillStyle = `rgba(4,2,10,${a})`;
  g.fillRect(0, 0, 480, 270);
}

function horiz(n: number, sel: number): number {
  const inp = app.input;
  if (inp.menu('mleft')) {
    audio.play('select');
    return (sel - 1 + n) % n;
  }
  if (inp.menu('mright')) {
    audio.play('select');
    return (sel + 1) % n;
  }
  return sel;
}

function clickPick(prefix: string, sel: number): { sel: number; ok: boolean } {
  const h = hot.hover();
  if (h && h.startsWith(prefix)) {
    const i = Number(h.slice(prefix.length));
    if (hot.mouse.moved) sel = i;
    if (hot.mouse.click) return { sel: i, ok: true };
  }
  return { sel, ok: false };
}

// ───────────────────── 유물 선택 ─────────────────────
export class RelicChoice implements Overlay {
  sel = 0;
  t = 0;
  constructor(
    public options: string[],
    public title: string,
    public onPick: (id: string | null) => void,
  ) {}
  update(): 'close' | null {
    this.t++;
    const n = this.options.length + 1;
    this.sel = horiz(n, this.sel);
    const c = clickPick('relic:', this.sel);
    this.sel = c.sel;
    if ((app.input.menu('ok') || c.ok) && this.t > 20) {
      audio.play(this.sel < this.options.length ? 'relic' : 'coin');
      this.onPick(this.sel < this.options.length ? this.options[this.sel] : null);
      return 'close';
    }
    return null;
  }
  render(g: CanvasRenderingContext2D): void {
    dim(g);
    text(g, this.title, 240, 16, { size: 12, align: 'center', color: '#ffe080', bold: true });
    text(g, '하나를 선택하세요 — 문장이 같으면 세트 효과가 강해집니다', 240, 32, { size: 7, align: 'center', color: '#b8b0c8' });
    const n = this.options.length;
    const w = 110;
    const gap = 8;
    const x0 = 240 - (n * w + (n - 1) * gap) / 2;
    this.options.forEach((id, i) => {
      const a = Math.min(1, (this.t - i * 5) / 12);
      g.save();
      g.globalAlpha = Math.max(0, a);
      const y = 46 + (1 - a) * 20 - (this.sel === i ? 4 : 0);
      relicCard(g, id, x0 + i * (w + gap), y, w, 170, this.sel === i);
      hot.add(`relic:${i}`, x0 + i * (w + gap), y, w, 170);
      g.restore();
    });
    button(g, 190, 226, 100, 18, '건너뛰기 (금화 +30)', this.sel === n, { size: 7 });
    hot.add(`relic:${n}`, 190, 226, 100, 18);
    keyHint(g, [['←→', '선택'], [app.input.label('attack'), '획득']]);
  }
}

// ───────────────────── 상점 ─────────────────────
interface Stock {
  kind: 'relic' | 'item' | 'heal';
  id: string;
  price: number;
  sold: boolean;
}

export class ShopOverlay implements Overlay {
  menu: Menu;
  constructor(
    public run: RunState,
    public room: Room,
    public stock: Stock[],
  ) {
    this.menu = new Menu([], 'shop');
    this.refresh();
  }
  static makeStock(run: RunState): Stock[] {
    const ch = run.chapter;
    const relics = run.rollRelics(3);
    const s: Stock[] = relics.map((id) => ({ kind: 'relic', id, price: Math.round([0, 85, 140, 230][RELIC_MAP[id].rarity] * (1 + ch * 0.15)), sold: false }));
    const items = [...ITEMS].sort(() => Math.random() - 0.5).slice(0, 2);
    for (const it of items) s.push({ kind: 'item', id: it.id, price: Math.round(it.price * (1 + ch * 0.1)), sold: false });
    s.push({ kind: 'heal', id: 'heal', price: Math.round(45 + ch * 15), sold: false });
    return s;
  }
  refresh(): void {
    this.menu.items = [
      ...this.stock.map((s) => ({ label: this.label(s), disabled: s.sold || this.run.gold < s.price, sub: s.sold ? '판매 완료' : `${s.price} 금화` })),
      { label: '나가기' },
    ];
  }
  label(s: Stock): string {
    if (s.kind === 'relic') return RELIC_MAP[s.id].name;
    if (s.kind === 'item') return ITEM_MAP[s.id].name;
    return '치료 (체력 40%)';
  }
  update(): 'close' | null {
    const r = this.menu.update(app.input);
    if (r === 'back') return 'close';
    if (r === 'ok') {
      const i = this.menu.sel;
      if (i >= this.stock.length) return 'close';
      const s = this.stock[i];
      if (s.sold || this.run.gold < s.price) return null;
      if (s.kind === 'item' && this.run.items.length >= 3) {
        app.toast('소모품은 3개까지 들 수 있다', '#ff8080');
        audio.play('error');
        return null;
      }
      this.run.gold -= s.price;
      s.sold = true;
      audio.play('buy');
      if (s.kind === 'relic') {
        this.run.relics.push(s.id);
        this.room.rebuild();
        app.toast(`유물 획득: ${RELIC_MAP[s.id].name}`, RELIC_RARITY_COL[RELIC_MAP[s.id].rarity]);
      } else if (s.kind === 'item') this.run.items.push(s.id);
      else this.room.heal(this.room.maxHp() * 0.4);
      this.refresh();
    }
    return null;
  }
  render(g: CanvasRenderingContext2D): void {
    dim(g, 0.55);
    panel(g, 20, 20, 440, 230);
    text(g, '떠돌이 해골 상인', 34, 28, { size: 11, color: '#80ff80', bold: true });
    text(g, '"살아있는 손님은 오랜만이군. 둘러보게."', 34, 44, { size: 7, color: '#a8c0a8' });
    drawIcon(g, 'coin', 360, 28, 10, '#ffd040');
    text(g, `${this.run.gold} 금화`, 374, 29, { size: 8, color: '#ffe080' });
    this.menu.render(g, 30, 60, 170, 22, 4, 7);
    const i = this.menu.sel;
    const s = this.stock[i];
    if (s) {
      if (s.kind === 'relic') relicCard(g, s.id, 290, 58, 150, 180, true);
      else if (s.kind === 'item') {
        const it = ITEM_MAP[s.id];
        panel(g, 290, 58, 150, 100);
        drawIcon(g, ITEM_ICON[s.id], 345, 66, 40, it.col);
        text(g, it.name, 365, 112, { size: 9, align: 'center', color: '#ffffff', bold: true });
        text(g, it.desc, 365, 126, { size: 7, align: 'center', color: '#c8c0d8' });
        text(g, `소모품 (${this.run.items.length}/3)`, 365, 140, { size: 6, align: 'center', color: '#8a8098' });
      } else {
        panel(g, 290, 58, 150, 80);
        drawIcon(g, 'heart', 345, 66, 40, '#ff4a6a');
        text(g, '상처를 치료한다', 365, 116, { size: 8, align: 'center', color: '#ffffff' });
      }
    }
    keyHint(g, [['↑↓', '선택'], [app.input.label('attack'), '구매'], ['Esc', '나가기']]);
  }
}

// ───────────────────── 영혼 제단 (임시 영웅) ─────────────────────
export class AltarOverlay implements Overlay {
  menu: Menu;
  t = 0;
  constructor(
    public run: RunState,
    public room: Room,
    public charId: string,
  ) {
    const p = run.party;
    this.menu = new Menu([{ label: `${CHAR_MAP[p[0].id].name}와 교체` }, { label: `${CHAR_MAP[p[1].id].name}와 교체` }, { label: '계약하지 않는다' }], 'altar');
  }
  update(): 'close' | null {
    this.t++;
    const r = this.menu.update(app.input, true);
    if (r === 'back') return 'close';
    if (r === 'ok') {
      if (this.menu.sel === 2) return 'close';
      const slot = this.menu.sel;
      const owned = app.save.chars[this.charId];
      const avgLv = Math.round(this.run.party.reduce((a, p) => a + p.lv, 0) / 2);
      this.run.party[slot] = { id: this.charId, lv: owned ? Math.max(owned.lv, avgLv) : avgLv, aw: owned?.aw ?? 0, temp: !owned };
      if (this.run.party[0].id === this.run.party[1].id) this.run.party[1 - slot] = { ...this.run.party[1 - slot] };
      this.room.rebuild();
      this.room.player.flash = 20;
      this.room.fx.ring(this.room.player.cx, this.room.player.cy, CHAR_MAP[this.charId].fx, 50);
      audio.play('reveal_4');
      app.toast(`${CHAR_MAP[this.charId].name}이(가) 계약에 응했다!`, CHAR_MAP[this.charId].fx);
      return 'close';
    }
    return null;
  }
  render(g: CanvasRenderingContext2D): void {
    dim(g);
    const c = CHAR_MAP[this.charId];
    text(g, '영혼 제단', 240, 14, { size: 12, align: 'center', color: '#9ef0ff', bold: true });
    text(g, '떠도는 영웅의 혼이 응답했다. 이번 런 동안 함께 싸울 수 있다.', 240, 30, { size: 7, align: 'center', color: '#b8c8d8' });
    const pose = (['idle0', 'windHigh', 'slashDown', 'castUp', 'thrust'] as const)[Math.floor(this.t / 25) % 5];
    charCard(g, this.charId, 40, 44, 110, 150, true, app.save.chars[this.charId] ? '보유 중' : '미보유 — 체험 계약', pose);
    panel(g, 160, 44, 290, 150);
    text(g, `${c.title} ${c.name}`, 170, 50, { size: 9, color: '#ffffff', bold: true });
    text(g, TYPE_LABEL[c.type], 440, 51, { size: 7, align: 'right', color: TYPE_COL[c.type] });
    let y = 66;
    for (const [n, d] of [[c.skills[0].name, c.skills[0].desc], [c.skills[1].name, c.skills[1].desc], [c.swap.name, c.swap.desc], [`패시브: ${c.passive.name}`, c.passive.desc]]) {
      text(g, n, 170, y, { size: 7, color: '#ffe080' });
      y += 10;
      y += textBlock(g, d, 170, y, 272, { size: 6, color: '#c8c0d8' }, 9) + 3;
    }
    this.menu.render(g, 0, 0, 0, 0);
    hot.clear();
    this.menu.items.forEach((it, i) => {
      button(g, 60 + i * 125, 206, 115, 20, it.label, this.menu.sel === i, { size: 7 });
      hot.add(`altar:${i}`, 60 + i * 125, 206, 115, 20);
    });
    keyHint(g, [['←→', '선택'], [app.input.label('attack'), '결정']]);
  }
}

// ───────────────────── 무기고 ─────────────────────
export class ArmoryOverlay implements Overlay {
  sel = 0;
  constructor(
    public run: RunState,
    public room: Room,
    public weapons: string[],
  ) {}
  update(): 'close' | null {
    const n = this.weapons.length + 1;
    this.sel = horiz(n, this.sel);
    const c = clickPick('arm:', this.sel);
    this.sel = c.sel;
    if (app.input.menu('back')) return 'close';
    if (app.input.menu('ok') || c.ok) {
      if (this.sel >= this.weapons.length) return 'close';
      const id = this.weapons[this.sel];
      const rf = app.save.weapons[id]?.rf ?? 1;
      this.run.weapon = { id, rf };
      this.room.rebuild();
      audio.play('reveal_4');
      app.toast(`무기 교체: ${WEAPON_MAP[id].name}`, '#ffe080');
      return 'close';
    }
    return null;
  }
  render(g: CanvasRenderingContext2D): void {
    dim(g);
    text(g, '망자의 무기고', 240, 12, { size: 12, align: 'center', color: '#c0c8d0', bold: true });
    const cur = this.run.weapon;
    text(g, `현재: ${WEAPON_MAP[cur.id].name} (재련 ${cur.rf}) — ${weaponDesc(WEAPON_MAP[cur.id], cur.rf)}`, 240, 28, { size: 7, align: 'center', color: '#a8a0c0', maxW: 460 });
    const w = 120;
    const x0 = 240 - (this.weapons.length * (w + 8) - 8) / 2;
    this.weapons.forEach((id, i) => {
      const y = 42 - (this.sel === i ? 4 : 0);
      weaponCard(g, id, app.save.weapons[id]?.rf ?? 1, x0 + i * (w + 8), y, w, 172, this.sel === i, app.save.weapons[id] ? '보유 무기' : undefined);
      hot.add(`arm:${i}`, x0 + i * (w + 8), y, w, 172);
    });
    button(g, 200, 224, 80, 18, '그대로 둔다', this.sel === this.weapons.length, { size: 7 });
    hot.add(`arm:${this.weapons.length}`, 200, 224, 80, 18);
    keyHint(g, [['←→', '선택'], [app.input.label('attack'), '교체'], ['Esc', '나가기']]);
  }
}

// ───────────────────── 휴식 ─────────────────────
export class RestOverlay implements Overlay {
  menu = new Menu([{ label: '휴식한다', sub: '체력 40% 회복' }, { label: '명상한다', sub: '이번 런 최대 체력 +12' }, { label: '단련한다', sub: '이번 런 공격력 +6%' }], 'rest');
  constructor(
    public run: RunState,
    public room: Room,
  ) {}
  update(): 'close' | null {
    const r = this.menu.update(app.input);
    if (r === 'back') return 'close';
    if (r === 'ok') {
      const restUp = 1 + (app.save.upgrades.rest ?? 0) * 0.1;
      if (this.menu.sel === 0) this.room.heal(this.room.maxHp() * 0.4 * restUp * (this.run.curse >= 5 ? 0.7 : 1));
      else if (this.menu.sel === 1) {
        this.run.bonusMaxHp += 12;
        this.room.rebuild();
        this.room.heal(12);
        app.toast('최대 체력 +12', '#ff80a0');
      } else {
        this.run.bonusAtk += 0.06;
        this.room.rebuild();
        app.toast('공격력 +6%', '#ff9a6a');
        audio.play('levelup');
      }
      return 'close';
    }
    return null;
  }
  render(g: CanvasRenderingContext2D): void {
    dim(g, 0.5);
    panel(g, 140, 60, 200, 150);
    text(g, '모닥불', 240, 68, { size: 11, align: 'center', color: '#ffb060', bold: true });
    text(g, '따뜻한 불꽃이 지친 몸을 감싼다.', 240, 84, { size: 7, align: 'center', color: '#c8b8a8' });
    this.menu.render(g, 160, 100, 160, 28, 6, 8);
    keyHint(g, [['↑↓', '선택'], [app.input.label('attack'), '결정']]);
  }
}

// ───────────────────── 이벤트 ─────────────────────
export class EventOverlay implements Overlay {
  menu: Menu;
  result: string | null = null;
  ev: EventDef;
  constructor(
    public run: RunState,
    public room: Room,
    public onTempChar: () => void,
    public onWeapon: () => void,
    public onRelic: () => void,
    public onFight: () => void,
  ) {
    this.ev = EVENTS[Math.floor(run.rng.next() * EVENTS.length)];
    this.menu = new Menu(
      this.ev.choices.map((c) => ({ label: c.label, disabled: (c.needGold !== undefined && run.gold < c.needGold) || (!!c.fx.usePotion && !run.items.includes('potion')) })),
      'ev',
    );
    this.menu.sel = Math.max(0, this.menu.items.findIndex((i) => !i.disabled));
  }
  update(): 'close' | null {
    if (this.result !== null) {
      if (app.input.menu('ok') || app.input.menu('back') || hot.mouse.click) return 'close';
      return null;
    }
    const r = this.menu.update(app.input);
    if (r === 'ok') {
      const ch = this.ev.choices[this.menu.sel];
      let fx = ch.fx;
      let res = ch.result;
      if (fx.chance !== undefined && this.run.rng.next() >= fx.chance) {
        res = fx.failResult ?? res;
        fx = fx.failFx ?? {};
      }
      const run = this.run;
      const room = this.room;
      if (fx.gold) run.gold = Math.max(0, run.gold + fx.gold);
      if (fx.hpPct) {
        if (fx.hpPct > 0) room.heal(room.maxHp() * fx.hpPct);
        else run.hp = Math.max(1, run.hp + room.maxHp() * fx.hpPct);
      }
      if (fx.maxHp) {
        run.bonusMaxHp += fx.maxHp;
        room.rebuild();
      }
      if (fx.atk) {
        run.bonusAtk += fx.atk;
        room.rebuild();
      }
      if (fx.stone) run.stats.stones += fx.stone;
      if (fx.crystal) run.stats.crystals += fx.crystal;
      if (fx.usePotion) run.items.splice(run.items.indexOf('potion'), 1);
      this.result = res;
      audio.play('confirm');
      if (fx.relic) this.onRelic();
      if (fx.tempChar) this.onTempChar();
      if (fx.weapon) this.onWeapon();
      if (fx.curseFight) this.onFight();
    }
    return null;
  }
  render(g: CanvasRenderingContext2D): void {
    dim(g, 0.6);
    panel(g, 60, 40, 360, 190, { border: '#c080ff' });
    text(g, this.ev.title, 240, 50, { size: 11, align: 'center', color: '#e0c0ff', bold: true });
    textBlock(g, this.ev.text, 76, 70, 328, { size: 8, color: '#e0d8f0' }, 12);
    if (this.result === null) {
      this.menu.render(g, 90, 120, 300, 24, 6, 8);
      keyHint(g, [['↑↓', '선택'], [app.input.label('attack'), '결정']]);
    } else {
      panel(g, 80, 130, 320, 60, { border: '#ffe080' });
      textBlock(g, this.result, 92, 142, 296, { size: 8, color: '#ffe8c0' }, 12);
      keyHint(g, [[app.input.label('attack'), '계속']]);
    }
  }
}

// ───────────────────── 빌드 확인 (Tab) ─────────────────────
export class BuildOverlay implements Overlay {
  sel = 0;
  constructor(
    public run: RunState,
    public room: Room,
  ) {}
  update(): 'close' | null {
    const inp = app.input;
    if (inp.pressed('build') || inp.menu('back')) return 'close';
    const n = Math.max(1, this.run.relics.filter((r) => RELIC_MAP[r]).length);
    if (inp.menu('mleft')) this.sel = (this.sel - 1 + n) % n;
    if (inp.menu('mright')) this.sel = (this.sel + 1) % n;
    if (inp.menu('mup')) this.sel = Math.max(0, this.sel - 8);
    if (inp.menu('mdown')) this.sel = Math.min(n - 1, this.sel + 8);
    const h = hot.hover();
    if (h?.startsWith('br:') && hot.mouse.moved) this.sel = Number(h.slice(3));
    return null;
  }
  render(g: CanvasRenderingContext2D): void {
    dim(g, 0.82);
    const run = this.run;
    const room = this.room;
    text(g, '빌드', 12, 6, { size: 12, color: '#e0d0ff', bold: true });
    // 파티
    panel(g, 8, 24, 196, 96);
    run.party.forEach((p, i) => {
      const c = CHAR_MAP[p.id];
      const y = 30 + i * 44;
      portrait(g, p.id, 14, y, 30, i !== run.active);
      text(g, `${c.name}  Lv.${p.lv}${p.aw ? ` 각성${p.aw}` : ''}${p.temp ? ' (임시)' : ''}`, 50, y, { size: 7, color: i === run.active ? c.fx : '#a8a0c0', bold: i === run.active });
      text(g, `${TYPE_LABEL[c.type]} · 패시브: ${c.passive.name}`, 50, y + 10, { size: 6, color: TYPE_COL[c.type] });
      textBlock(g, c.passive.desc, 50, y + 19, 150, { size: 6, color: '#a8a0c0' }, 8);
    });
    // 무기
    panel(g, 8, 124, 196, 48);
    const w = WEAPON_MAP[run.weapon.id];
    if (!drawWeaponArt(g, w.id, 14, 130, 24)) drawIcon(g, w.icon, 14, 130, 24, w.col);
    text(g, `${w.name}`, 44, 129, { size: 7, color: '#ffffff', bold: true });
    stars(g, 44, 139, w.rarity, 5);
    text(g, `재련 ${run.weapon.rf}`, 70, 139, { size: 6, color: '#a8a0c0' });
    textBlock(g, weaponDesc(w, run.weapon.rf), 44, 148, 156, { size: 6, color: '#c8c0d8' }, 8);
    // 스탯
    panel(g, 8, 176, 196, 88);
    const s = room.stats;
    const rows: [string, string][] = [
      ['공격력', `${Math.round(room.player.atk() * (1 + (s.atk ?? 0)))}`],
      ['최대 체력', `${room.maxHp()}`],
      ['치명타', pct(Math.min(1, 0.05 + (s.crit ?? 0)))],
      ['치명 피해', pct(1.5 + (s.critDmg ?? 0))],
      ['공격 속도', `+${pct(s.aspd ?? 0)}`],
      ['이동 속도', `+${pct(s.mspd ?? 0)}`],
      ['스킬 쿨감', pct(Math.min(0.6, s.cdr ?? 0))],
      ['교대 쿨감', pct(Math.min(0.7, s.swapCdr ?? 0))],
      ['받는 피해', `${Math.round((1 + (s.dmgTaken ?? 0)) * 100)}%`],
      ['교대 피해', `+${pct(s.swapDmg ?? 0)}`],
      ['스킬 피해', `+${pct((s.skillDmg ?? 0) as number)}`],
      ['흡혈', pct((s as Record<StatKey, number>).lifesteal ?? 0, 1)],
    ];
    rows.forEach(([k, v], i) => {
      const x = 14 + (i % 2) * 96;
      const y = 182 + Math.floor(i / 2) * 13;
      text(g, k, x, y, { size: 6, color: '#8a8098' });
      text(g, v, x + 88, y, { size: 7, align: 'right', color: '#f0e8d8' });
    });
    // 문장
    panel(g, 210, 24, 262, 108);
    text(g, '문장 세트', 218, 28, { size: 8, color: '#e0d0ff', bold: true });
    const cs = room.build.crests;
    if (!cs.length) text(g, '아직 모은 문장이 없다', 218, 44, { size: 7, color: '#6a6078' });
    cs.slice(0, 6).forEach((c, i) => {
      const cd = CREST_MAP[c.id];
      const y = 42 + i * 15;
      drawIcon(g, cd.icon, 218, y, 10, cd.col);
      text(g, `${cd.name} ${c.count}`, 232, y + 1, { size: 7, color: cd.col, bold: true });
      cd.tiers.forEach((t, k) => {
        const on = k < c.tier;
        g.fillStyle = on ? cd.col : '#2a2238';
        g.fillRect(270 + k * 10, y + 2, 8, 6);
        text(g, String(t.n), 274 + k * 10, y + 1.5, { size: 5, align: 'center', color: on ? '#000' : '#6a6078' });
      });
      const nextTier = cd.tiers[Math.min(2, c.tier)];
      const desc = c.tier >= 3 ? cd.tiers[2].desc : `${c.tier ? '▶ ' : ''}${nextTier.n}개: ${nextTier.desc}`;
      text(g, desc, 304, y + 2, { size: 6, color: c.tier >= 3 ? cd.col : '#a8a0c0', maxW: 164 });
    });
    // 유물
    panel(g, 210, 136, 262, 128);
    const relics = run.relics.filter((r) => RELIC_MAP[r]);
    text(g, `유물 ${relics.length}`, 218, 140, { size: 8, color: '#e0d0ff', bold: true });
    relics.forEach((id, i) => {
      const r = RELIC_MAP[id];
      const x = 218 + (i % 8) * 31;
      const y = 154 + Math.floor(i / 8) * 26;
      g.fillStyle = i === this.sel ? 'rgba(160,128,255,0.35)' : 'rgba(255,255,255,0.05)';
      g.fillRect(x, y, 26, 22);
      drawIcon(g, r.icon, x + 4, y + 2, 18, r.col);
      hot.add(`br:${i}`, x, y, 26, 22);
    });
    const sr = relics[this.sel];
    if (sr) {
      const r = RELIC_MAP[sr];
      const y = 154 + Math.ceil(relics.length / 8) * 26 + 2;
      text(g, r.name, 218, Math.min(236, y), { size: 7, color: RELIC_RARITY_COL[r.rarity], bold: true });
      crestTags(g, r.crest, 330, Math.min(236, y));
      text(g, r.desc, 218, Math.min(248, y + 12), { size: 6, color: '#c8c0d8', maxW: 250 });
    }
    void wrap;
    keyHint(g, [['←→', '유물 선택'], [app.input.label('build'), '닫기']], 262);
  }
}

// ───────────────────── 일시정지 ─────────────────────
export class PauseOverlay implements Overlay {
  menu: Menu;
  confirm: Menu | null = null;
  constructor(
    public inRun: boolean,
    public onAction: (a: 'resume' | 'build' | 'settings' | 'controls' | 'quit' | 'title') => void,
  ) {
    this.menu = new Menu(
      inRun
        ? [{ label: '계속하기' }, { label: '빌드 확인' }, { label: '설정' }, { label: '조작법' }, { label: '런 포기', col: '#ff6080' }]
        : [{ label: '계속하기' }, { label: '설정' }, { label: '조작법' }, { label: '타이틀로', col: '#ff6080' }],
      'pause',
    );
  }
  update(): 'close' | null {
    if (this.confirm) {
      const r = this.confirm.update(app.input, true);
      if (r === 'back' || (r === 'ok' && this.confirm.sel === 1)) this.confirm = null;
      else if (r === 'ok') {
        this.onAction(this.inRun ? 'quit' : 'title');
        return 'close';
      }
      return null;
    }
    if (app.input.pressed('pause') && !app.input.menu('back')) return 'close';
    const r = this.menu.update(app.input);
    if (r === 'back') {
      this.onAction('resume');
      return 'close';
    }
    if (r === 'ok') {
      const acts: ('resume' | 'build' | 'settings' | 'controls' | 'quit' | 'title')[] = this.inRun ? ['resume', 'build', 'settings', 'controls', 'quit'] : ['resume', 'settings', 'controls', 'title'];
      const a = acts[this.menu.sel];
      if (a === 'quit' || a === 'title') {
        this.confirm = new Menu([{ label: '예', col: '#ff6080' }, { label: '아니오' }], 'pconf');
        this.confirm.sel = 1;
        return null;
      }
      this.onAction(a);
      return 'close';
    }
    return null;
  }
  render(g: CanvasRenderingContext2D): void {
    dim(g, 0.6);
    text(g, '일시정지', 240, 50, { size: 16, align: 'center', color: '#e0d0ff', bold: true });
    this.menu.render(g, 180, 82, 120, 22, 5, 8);
    if (this.confirm) {
      panel(g, 140, 110, 200, 60, { border: '#ff6080' });
      text(g, this.inRun ? '런을 포기할까요? (보상은 정산됩니다)' : '타이틀로 돌아갈까요?', 240, 120, { size: 8, align: 'center', color: '#ffffff' });
      this.confirm.items.forEach((it, i) => {
        button(g, 160 + i * 84, 140, 76, 20, it.label, this.confirm!.sel === i, { col: it.col });
        hot.add(`pconf:${i}`, 160 + i * 84, 140, 76, 20);
      });
    }
  }
}
