import { app, type Scene } from '../app';
import { audio } from '../core/audio';
import { CHARACTERS, CHAR_MAP, TYPE_COL, TYPE_LABEL } from '../data/characters';
import { CURSES } from '../data/meta';
import { WEAPONS, WEAPON_MAP, weaponDesc } from '../data/weapons';
import { text } from '../gfx/renderer';
import { charArt } from '../gfx/sprites';
import { RunState } from '../game/run';
import { markAch } from '../game/meta';
import { drawIcon } from '../ui/icons';
import { RARITY_COL } from '../ui/theme';
import { button, hot, keyHint, panel, stars } from '../ui/widgets';
import { crestTags } from '../ui/cards';
import { RunScene } from './run';
import { rgba } from '../gfx/pixel';
import { STORIES, storyDef } from '../data/stories';
import { StoryTextScene } from './story';

type Focus = 0 | 1 | 2 | 3 | 4 | 5; // 슬롯1, 슬롯2, 무기, 저주, 출정, 스토리

/** 편성: 영웅 2명 + 무기 1개 + 저주 단계 선택 후 출정 */
export class LoadoutScene implements Scene {
  focus: Focus = 4;
  /** 무기 칸에서 위로 갈 때 돌아갈 영웅 칸 */
  lastSlot: 0 | 1 = 0;
  picking: 'char' | 'weapon' | null = null;
  pick = 0;
  t = 0;
  constructor(public back: Scene) {}

  /** 직전 프레임의 디버그 상태 (편성 화면에서 디버그를 끄면 바로 원복) */
  private wasDebug = app.debug;

  enter(): void {
    this.wasDebug = app.debug;
    this.fixOwned();
  }

  /** 디버그로 골랐던 미보유 영웅·무기는 디버그를 끄면 보유한 것으로 되돌린다 */
  private fixOwned(): void {
    if (app.debug) return;
    const lo = app.save.loadout;
    const owned = this.ownedChars();
    for (const i of [0, 1] as const) if (lo.chars[i] && !app.save.chars[lo.chars[i]]) lo.chars[i] = owned.find((id) => !lo.chars.includes(id)) ?? '';
    // 1번 칸이 비면 2번 칸 영웅을 당겨 온다
    if (!lo.chars[0]) [lo.chars[0], lo.chars[1]] = [lo.chars[1] || owned[0] || '', ''];
    if (!app.save.weapons[lo.weapon]) lo.weapon = this.ownedWeapons()[0];
  }

  /** 선택 가능한 영웅: 보유한 영웅 (디버그 모드에서는 전부 — 테스트용) */
  private ownedChars(): string[] {
    return CHARACTERS.filter((c) => app.debug || app.save.chars[c.id]).map((c) => c.id);
  }
  private ownedWeapons(): string[] {
    return WEAPONS.filter((w) => app.debug || app.save.weapons[w.id]).map((w) => w.id);
  }

  update(): void {
    this.t++;
    const inp = app.input;
    const lo = app.save.loadout;
    if (this.wasDebug && !app.debug) {
      this.fixOwned();
      this.picking = null;
    }
    this.wasDebug = app.debug;
    if (this.picking) {
      const list = this.picking === 'char' ? this.ownedChars() : this.ownedWeapons();
      this.pick = Math.max(0, Math.min(this.pick, list.length - 1));
      const cols = 8;
      const before = this.pick;
      // 좌우는 끝에서 반대쪽으로 순환, 상하는 같은 열 유지
      if (inp.menu('mleft')) this.pick = (this.pick - 1 + list.length) % list.length;
      if (inp.menu('mright')) this.pick = (this.pick + 1) % list.length;
      if (inp.menu('mup') && this.pick - cols >= 0) this.pick -= cols;
      if (inp.menu('mdown')) this.pick = Math.min(list.length - 1, this.pick + cols);
      if (this.pick !== before) audio.play('select');
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
        if (!id) return;
        if (this.picking === 'char') {
          const slot = this.focus as 0 | 1;
          const other = lo.chars[1 - slot];
          // 다른 칸의 영웅을 고르면 서로 맞바꾼다. 이 칸이 비어 있으면 맞바꾸지 않는다 (1번 칸이 비는 것 방지)
          if (other === id) {
            if (!lo.chars[slot]) {
              audio.play('error');
              return;
            }
            lo.chars[1 - slot] = lo.chars[slot];
          }
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
    this.navigate();
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
        if (!this.curseLocked()) app.save.curse = app.save.curse >= app.save.curseMax ? 0 : app.save.curse + 1;
      } else if (this.focus === 5) {
        if (!this.storyLocked()) app.save.story = app.save.story >= app.save.storyMax ? 1 : app.save.story + 1;
      } else this.depart();
    }
  }

  /** 저주 단계가 아직 해금되지 않았으면 안내하고 true */
  private curseLocked(): boolean {
    if (app.save.curseMax > 0) return false;
    audio.play('error');
    app.toast('저주 단계는 끝없는 왕을 쓰러뜨리면 해금된다', '#ff9090');
    return true;
  }

  /** 다음 스토리가 아직 잠겨 있으면 안내하고 true */
  private storyLocked(): boolean {
    if (app.save.storyMax > 1) return false;
    audio.play('error');
    app.toast('후속 스토리는 「망자의 계약」을 완수하면 열린다', '#ff9090');
    return true;
  }

  /**
   * 화면 배치대로 2차원 이동:
   *   [0 선봉] [1 교대]
   *   [2 무기          ] [5 스토리]
   *   [3 저주          ] [4 출정!]
   * 저주·스토리 칸에서 A/D는 값 변경, 끝에서 한 번 더 누르면 옆 칸으로.
   */
  private navigate(): void {
    const inp = app.input;
    const f = this.focus;
    let n: Focus = f;
    if (inp.menu('mleft')) {
      if (f === 1) n = 0;
      else if (f === 0) n = 1;
      else if (f === 4) n = 3;
      else if (f === 5 && app.save.story > 1) {
        app.save.story--;
        audio.play('select');
      } else if (f === 5) n = 2;
      else if (f === 3 && app.save.curse > 0) {
        app.save.curse--;
        audio.play('select');
      } else if (f === 3) this.curseLocked();
    }
    if (inp.menu('mright')) {
      if (f === 0) n = 1;
      else if (f === 1) n = 0;
      else if (f === 2) n = 5;
      else if (f === 5 && app.save.story < app.save.storyMax) {
        app.save.story++;
        audio.play('select');
      } else if (f === 5) this.storyLocked();
      else if (f === 3 && app.save.curse < app.save.curseMax) {
        app.save.curse++;
        audio.play('select');
      } else if (f === 3) n = 4;
    }
    if (inp.menu('mup')) {
      if (f === 2) n = this.lastSlot;
      else if (f === 3) n = 2;
      else if (f === 4) n = 5;
      else if (f === 5) n = 1;
    }
    if (inp.menu('mdown')) {
      if (f === 0 || f === 1) n = 2;
      else if (f === 2) n = 3;
      else if (f === 3 || f === 5) n = 4;
    }
    if (n !== f) {
      this.focus = n;
      audio.play('select');
    }
    if (this.focus === 0 || this.focus === 1) this.lastSlot = this.focus;
  }

  private depart(): void {
    const lo = app.save.loadout;
    const ok = (id: string): boolean => !!id && !!CHAR_MAP[id] && (app.debug || !!app.save.chars[id]);
    if (!ok(lo.chars[0]) || !ok(lo.chars[1]) || lo.chars[0] === lo.chars[1]) {
      audio.play('error');
      app.toast('영웅 2명이 필요하다 — 계약의 제단에서 영웅을 부르자', '#ff8080');
      return;
    }
    if (!WEAPON_MAP[lo.weapon] || (!app.debug && !app.save.weapons[lo.weapon])) lo.weapon = Object.keys(app.save.weapons)[0];
    app.persist();
    const run = new RunState(app.save);
    if (markAch(app.save, 'first_run')) app.achToast(['first_run']);
    const sd = run.storyDef;
    const first = !app.save.storySeen[sd.id];
    app.save.storySeen[sd.id] = true;
    app.persist();
    // 후속 스토리는 처음 출정할 때 이야기를 먼저 보여 준다 (스토리 1은 게임 첫 인트로가 대신한다)
    if (first && sd.id > 1) app.go(new StoryTextScene(`스토리 ${sd.id}  「${sd.name}」`, sd.sub, sd.intro, () => app.go(new RunScene(run))));
    else app.go(new RunScene(run));
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
        // 그림은 칸 안으로 잘라 그린다 (공격 동작의 큰 검기가 칸 밖으로 나가지 않게)
        g.save();
        g.beginPath();
        g.rect(x + 2, y + 2, 72, 116);
        g.clip();
        g.drawImage(charArt(id, pose), x + 38 - 48, y + 102 - 88, 96, 96);
        g.restore();
        stars(g, x + 76, y + 14, c.rarity, 6);
        text(g, c.name, x + 76, y + 24, { size: 10, color: '#ffffff', bold: true, maxW: 64 });
        text(g, c.title, x + 76, y + 38, { size: 6, color: '#a8a0c0', maxW: 64 });
        text(g, TYPE_LABEL[c.type], x + 76, y + 48, { size: 7, color: TYPE_COL[c.type] });
        const own = save.chars[id];
        text(g, `Lv.${own?.lv ?? 1} · 각성 ${own?.aw ?? 0}`, x + 76, y + 58, { size: 6, color: '#ffe080' });
        if (c.crest) crestTags(g, [c.crest], x + 76, y + 68);
        text(g, c.skills[0].name, x + 76, y + 84, { size: 6, color: '#c8c0d8', maxW: 64 });
        text(g, c.skills[1].name, x + 76, y + 93, { size: 6, color: '#c8c0d8', maxW: 64 });
        text(g, c.swap.name.replace('교대: ', '교대 · '), x + 76, y + 102, { size: 6, color: '#a0ffd0', maxW: 64 });
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
    // 스토리
    const sd = storyDef(save.story);
    const ssel = this.focus === 5;
    panel(g, 316, 166, 156, 42, { border: ssel ? '#ffffff' : '#c0a060' });
    hot.add('lf:5', 316, 166, 156, 42);
    text(g, `스토리 ${sd.id} / ${STORIES.length}`, 322, 170, { size: 6, color: '#a8a0c0' });
    text(g, `◀ ${sd.name} ▶`, 394, 180, { size: 9, align: 'center', color: '#ffe0a0', bold: true });
    text(g, save.storyMax > 1 ? (save.storyClear[sd.id] ? `${sd.sub} · 완수` : sd.sub) : '「망자의 계약」을 완수하면 후속 스토리가 열린다', 394, 194, { size: 5, align: 'center', color: save.storyClear[sd.id] ? '#a0ffd0' : '#a8a0c0', maxW: 150 });
    // 출정
    button(g, 316, 210, 156, 28, '출정!', this.focus === 4, { size: 11, col: '#ffcc40', sub: sd.id === 1 ? '끝없는 왕좌를 향해' : sd.sub });
    hot.add('lf:4', 316, 210, 156, 28);
    // 피커
    if (this.picking) {
      const list = this.picking === 'char' ? this.ownedChars() : this.ownedWeapons();
      g.fillStyle = 'rgba(4,2,10,0.8)';
      g.fillRect(0, 0, 480, 270);
      panel(g, 40, 24, 400, 220);
      text(g, this.picking === 'char' ? '영웅 선택' : '무기 선택', 50, 30, { size: 10, color: '#e0d0ff', bold: true });
      if (app.debug) text(g, '[디버그] 보유하지 않은 영웅·무기도 선택 가능 (기록에는 추가되지 않음)', 430, 33, { size: 6, align: 'right', color: '#80ffa0' });
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
          g.drawImage(charArt(id, sel ? 'castUp' : 'idle0'), x + 23 - 24, y - 13, 48, 48);
          text(g, c.name, x + 23, y + 33, { size: 6, align: 'center', color: lo.chars.includes(id) ? '#ffe080' : '#ffffff', maxW: 44 });
          if (!save.chars[id]) text(g, '디버그', x + 2, y + 1, { size: 5, color: '#80ffa0' });
        } else {
          const wd = WEAPON_MAP[id];
          g.fillStyle = sel ? rgba(RARITY_COL[wd.rarity], 0.4) : 'rgba(255,255,255,0.05)';
          g.fillRect(x, y, 46, 42);
          g.strokeStyle = RARITY_COL[wd.rarity];
          g.strokeRect(x + 0.5, y + 0.5, 45, 41);
          drawIcon(g, wd.icon, x + 13, y + 3, 20, wd.col);
          text(g, wd.name.replace(/「.*」/, '').trim(), x + 23, y + 26, { size: 5, align: 'center', color: '#ffffff', maxW: 44 });
          text(g, save.weapons[id] ? `재련${save.weapons[id].rf}` : '디버그', x + 23, y + 34, { size: 5, align: 'center', color: save.weapons[id] ? '#a8a0c0' : '#80ffa0' });
        }
        hot.add(`lp:${i}`, x, y, 46, 42);
      });
      const cur = list[this.pick];
      if (cur && this.picking === 'weapon') text(g, weaponDesc(WEAPON_MAP[cur], save.weapons[cur]?.rf ?? 1), 240, 232, { size: 7, align: 'center', color: '#ffe8c0', maxW: 390 });
      if (cur && this.picking === 'char') text(g, `${CHAR_MAP[cur].passive.name}: ${CHAR_MAP[cur].passive.desc}`, 240, 232, { size: 7, align: 'center', color: '#ffe8c0', maxW: 390 });
      keyHint(g, [['WASD/방향키', '선택'], [`${app.input.label('attack')}/${app.input.label('interact')}`, '결정'], ['Esc', '취소']]);
    } else keyHint(g, [['WASD/방향키', '항목'], [`${app.input.label('attack')}/${app.input.label('interact')}`, '변경/출정'], ['Esc', '나가기']], 258);
  }
}
