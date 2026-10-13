import { app, type Scene } from '../app';
import { audio } from '../core/audio';
import { ACTIONS, ACTION_LABELS, cloneBindings, DEFAULT_BINDINGS, keyName, padName, WASD_BINDINGS, type Action } from '../core/input';
import { text } from '../gfx/renderer';
import { clearSave, newSave, sanitize } from '../game/save';
import { button, hot, keyHint, Menu, panel } from '../ui/widgets';

type Mode = 'main' | 'keys' | 'capture' | 'reset' | 'io';

/** 설정: 음량, 흔들림, 데미지 숫자, 키 재설정, 저장 내보내기/가져오기/초기화 */
export class SettingsScene implements Scene {
  mode: Mode = 'main';
  main = new Menu([], 'set');
  keys = new Menu([], 'keys');
  confirm = new Menu([{ label: '초기화', col: '#ff4060' }, { label: '취소' }], 'rst');
  capAction: Action = 'jump';
  capPad = false;
  dom: HTMLDivElement | null = null;

  constructor(public back: Scene, public onReset?: () => void) {
    this.refresh();
  }

  private refresh(): void {
    const s = app.save.settings;
    const pctS = (v: number): string => `${Math.round(v * 100)}%`;
    this.main.items = [
      { label: `배경음 음량  ◀ ${pctS(s.music)} ▶` },
      { label: `효과음 음량  ◀ ${pctS(s.sfx)} ▶` },
      { label: `화면 흔들림  ◀ ${pctS(s.shake)} ▶` },
      { label: `데미지 숫자  ◀ ${s.dmgNumbers ? '켜기' : '끄기'} ▶` },
      { label: '키 재설정' },
      { label: '저장 데이터 내보내기 / 가져오기' },
      { label: '저장 데이터 초기화', col: '#ff6080' },
      { label: '돌아가기' },
    ];
    this.keys.items = [
      ...ACTIONS.map((a) => ({ label: `${ACTION_LABELS[a]}` })),
      { label: '기본 배치로 (방향키)' },
      { label: 'WASD 배치로' },
      { label: '돌아가기' },
    ];
  }

  leave(): void {
    this.closeDom();
  }

  private adjust(i: number, d: number): void {
    const s = app.save.settings;
    const step = (v: number, max = 1): number => Math.max(0, Math.min(max, Math.round((v + d * 0.1) * 10) / 10));
    if (i === 0) s.music = step(s.music);
    if (i === 1) s.sfx = step(s.sfx);
    if (i === 2) s.shake = Math.max(0, Math.min(1.5, Math.round((s.shake + d * 0.25) * 4) / 4));
    if (i === 3) s.dmgNumbers = !s.dmgNumbers;
    app.applySettings();
    if (this.back.room) {
      this.back.room.cam.shakeScale = s.shake;
      this.back.room.fx.showNumbers = s.dmgNumbers;
    }
    audio.play('select');
    if (i === 2) this.back.room?.cam.shake(4);
    app.persist();
    this.refresh();
  }

  update(): void {
    const inp = app.input;
    if (this.mode === 'capture') return;
    if (this.mode === 'io') {
      if (inp.rawHeld('Escape')) this.closeDom();
      return;
    }
    if (this.mode === 'reset') {
      const r = this.confirm.update(inp, true);
      if (r === 'back' || (r === 'ok' && this.confirm.sel === 1)) this.mode = 'main';
      else if (r === 'ok') {
        clearSave();
        app.save = newSave();
        app.hasSave = false;
        app.applySettings();
        app.toast('저장 데이터를 초기화했다', '#ff8090');
        this.mode = 'main';
        this.refresh();
        this.onReset?.();
      }
      return;
    }
    if (this.mode === 'keys') {
      const r = this.keys.update(inp);
      const i = this.keys.sel;
      if (r === 'back' || (r === 'ok' && i === ACTIONS.length + 2)) {
        this.mode = 'main';
        return;
      }
      if (r === 'ok') {
        if (i < ACTIONS.length) {
          this.capAction = ACTIONS[i];
          this.mode = 'capture';
          inp.captureHandler = (code, pad) => {
            const b = app.save.settings.bindings;
            if (code === 'Escape' && this.capAction !== 'pause') {
              this.mode = 'keys';
              return;
            }
            if (code) {
              for (const a of ACTIONS) b[a].keys = b[a].keys.filter((k) => k !== code);
              b[this.capAction].keys = [code];
            }
            if (pad !== null) {
              for (const a of ACTIONS) b[a].pad = b[a].pad.filter((k) => k !== pad);
              b[this.capAction].pad = [pad];
            }
            app.applySettings();
            app.persist();
            audio.play('confirm');
            this.mode = 'keys';
          };
        } else if (i === ACTIONS.length) {
          app.save.settings.bindings = cloneBindings(DEFAULT_BINDINGS);
          app.applySettings();
          app.persist();
          app.toast('기본 키 배치로 되돌렸다');
        } else if (i === ACTIONS.length + 1) {
          app.save.settings.bindings = cloneBindings(WASD_BINDINGS);
          app.applySettings();
          app.persist();
          app.toast('WASD 배치 적용 (J 공격 · K 점프 · L 대시 · U/I 스킬 · O 교대 · E 상호작용)');
        }
      }
      return;
    }
    const i = this.main.sel;
    if (i <= 3) {
      if (inp.menu('mleft')) this.adjust(i, -1);
      if (inp.menu('mright')) this.adjust(i, 1);
    }
    const r = this.main.update(inp);
    if (r === 'back' || (r === 'ok' && i === 7)) {
      app.persist();
      app.go(this.back, false);
      return;
    }
    if (r === 'ok') {
      if (i <= 3) this.adjust(i, 1);
      if (i === 4) this.mode = 'keys';
      if (i === 5) this.openDom();
      if (i === 6) {
        this.mode = 'reset';
        this.confirm.sel = 1;
      }
    }
  }

  private openDom(): void {
    this.mode = 'io';
    const d = document.createElement('div');
    d.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);background:#140c22;border:2px solid #8a6ad0;padding:14px;z-index:10;color:#e8e0f0;font-family:sans-serif;width:min(560px,90vw)';
    d.innerHTML = `<div style="font-weight:bold;margin-bottom:6px">저장 데이터 내보내기 / 가져오기</div>
      <div style="font-size:12px;margin-bottom:6px;color:#a8a0c0">아래 JSON을 복사해 보관하거나, 다른 데이터를 붙여넣고 [가져오기]를 누르세요.</div>
      <textarea id="savejson" style="width:100%;height:180px;background:#0a0612;color:#c8f0c8;border:1px solid #4a3a6a;font-size:11px"></textarea>
      <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">
        <button id="sv-copy">복사</button><button id="sv-imp">가져오기</button><button id="sv-close">닫기</button>
      </div><div id="sv-msg" style="font-size:12px;margin-top:6px;color:#ffe080"></div>`;
    document.body.appendChild(d);
    this.dom = d;
    const ta = d.querySelector('#savejson') as HTMLTextAreaElement;
    ta.value = JSON.stringify(app.save, null, 1);
    const msg = d.querySelector('#sv-msg') as HTMLDivElement;
    (d.querySelector('#sv-copy') as HTMLButtonElement).onclick = () => {
      ta.select();
      try {
        void navigator.clipboard?.writeText(ta.value);
      } catch {
        /* 클립보드 미지원 */
      }
      msg.textContent = '복사했습니다';
    };
    (d.querySelector('#sv-imp') as HTMLButtonElement).onclick = () => {
      try {
        const data = sanitize(JSON.parse(ta.value));
        app.save = data;
        app.applySettings();
        app.persist();
        msg.textContent = '가져오기 완료!';
        app.toast('저장 데이터를 불러왔다', '#80ffa0');
        this.refresh();
        this.onReset?.();
      } catch {
        msg.textContent = '올바른 JSON이 아닙니다';
      }
    };
    (d.querySelector('#sv-close') as HTMLButtonElement).onclick = () => this.closeDom();
  }

  private closeDom(): void {
    if (this.dom) {
      this.dom.remove();
      this.dom = null;
    }
    this.mode = 'main';
    (document.getElementById('game') as HTMLCanvasElement | null)?.focus();
  }

  world(g: CanvasRenderingContext2D): void {
    this.back.world(g);
  }

  ui(g: CanvasRenderingContext2D): void {
    g.fillStyle = 'rgba(4,2,10,0.85)';
    g.fillRect(0, 0, 480, 270);
    text(g, '설정', 240, 10, { size: 14, align: 'center', color: '#e0d0ff', bold: true });
    if (this.mode === 'keys' || this.mode === 'capture') {
      panel(g, 60, 30, 360, 226);
      const b = app.save.settings.bindings;
      this.keys.items.forEach((it, i) => {
        const y = 36 + i * 13;
        const sel = i === this.keys.sel;
        g.fillStyle = sel ? 'rgba(138,106,208,0.35)' : 'transparent';
        g.fillRect(66, y - 1, 348, 12);
        hot.add(`keys:${i}`, 66, y - 1, 348, 12);
        text(g, it.label, 72, y, { size: 7, color: sel ? '#ffffff' : '#c8c0d8' });
        if (i < ACTIONS.length) {
          const a = ACTIONS[i];
          const cap = this.mode === 'capture' && a === this.capAction;
          text(g, cap ? '키 또는 패드 버튼을 누르세요…' : b[a].keys.map(keyName).join(' / '), 260, y, { size: 7, color: cap ? '#ff8080' : '#ffe080' });
          text(g, b[a].pad.map(padName).join('/'), 400, y, { size: 7, align: 'right', color: '#a0d0ff' });
        }
      });
      keyHint(g, [['↑↓', '선택'], ['Enter', '변경'], ['Esc', '돌아가기']], 260);
      return;
    }
    this.main.render(g, 120, 34, 240, 22, 4, 8);
    if (this.mode === 'reset') {
      panel(g, 120, 100, 240, 70, { border: '#ff4060' });
      text(g, '모든 진행(영웅·무기·재화)이 사라집니다. 정말 초기화할까요?', 240, 112, { size: 7, align: 'center', color: '#ffffff', maxW: 230 });
      this.confirm.items.forEach((it, i) => {
        button(g, 150 + i * 94, 136, 86, 20, it.label, this.confirm.sel === i, { col: it.col });
        hot.add(`rst:${i}`, 150 + i * 94, 136, 86, 20);
      });
    }
    if (app.saveFailed) text(g, '※ 브라우저 저장소에 저장할 수 없습니다 (내보내기로 백업하세요)', 240, 242, { size: 7, align: 'center', color: '#ff8080' });
    keyHint(g, [['↑↓', '선택'], ['←→', '조절'], ['Esc', '돌아가기']], 258);
  }
}
