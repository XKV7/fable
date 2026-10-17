import { app, type Scene } from '../app';
import { audio } from '../core/audio';
import { ACTIONS, ACTION_LABELS, cloneBindings, DEFAULT_BINDINGS, keyName, ARROW_BINDINGS, type Action } from '../core/input';
import { text } from '../gfx/renderer';
import { newSave, sanitize } from '../game/save';
import { redeemCoupon } from '../data/coupons';
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
      { label: '조작 키 설정 (키 바꾸기)' },
      { label: '저장 데이터 내보내기 / 가져오기' },
      { label: '쿠폰 코드 입력', col: '#ffe080' },
      { label: '저장 데이터 초기화', col: '#ff6080' },
      { label: '돌아가기' },
    ];
    this.keys.items = [
      ...ACTIONS.map((a) => ({ label: `${ACTION_LABELS[a]}` })),
      { label: '기본 배치로 (WASD)' },
      { label: '방향키 배치로' },
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
        app.save = newSave();
        app.applySettings();
        app.persist();
        app.hasSave = false;
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
          app.save.settings.bindings = cloneBindings(ARROW_BINDINGS);
          app.applySettings();
          app.persist();
          app.toast('방향키 배치 적용 (C 점프 · X 공격 · Z 대시 · A/S 스킬 · D 교대 · Q 아이템)');
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
    if (r === 'back' || (r === 'ok' && i === 8)) {
      app.persist();
      app.go(this.back, false);
      return;
    }
    if (r === 'ok') {
      if (i <= 3) this.adjust(i, 1);
      if (i === 4) this.mode = 'keys';
      if (i === 5) this.openDom();
      if (i === 6) this.openCoupon();
      if (i === 7) {
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

  /** 쿠폰 코드 입력창 (계정마다 코드당 한 번) */
  private openCoupon(): void {
    this.mode = 'io';
    const d = document.createElement('div');
    d.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);background:#140c22;border:2px solid #c0a060;padding:16px;z-index:10;color:#e8e0f0;font-family:"Noto Sans KR",sans-serif;width:min(360px,88vw)';
    d.innerHTML = `<div style="font-weight:bold;margin-bottom:8px;color:#ffe080">쿠폰 코드 입력</div>
      <form id="cp-form" style="display:flex;gap:8px">
        <input id="cp-code" maxlength="32" autocomplete="off" spellcheck="false" placeholder="코드" style="flex:1;padding:8px;background:#0a0612;color:#fff;border:1px solid #4a3a6a;font-size:15px;text-transform:uppercase">
        <button type="submit" style="padding:8px 14px;background:#c0a060;border:0;font-weight:bold;cursor:pointer">사용</button>
      </form>
      <div id="cp-msg" style="min-height:18px;font-size:12px;margin-top:8px;color:#a8a0c0">한 계정에서 같은 쿠폰은 한 번만 쓸 수 있습니다.</div>
      <div style="text-align:right;margin-top:6px"><button id="cp-close" style="padding:6px 12px;background:#2a2040;color:#e0d8f0;border:1px solid #4a3a6a;cursor:pointer">닫기</button></div>`;
    document.body.appendChild(d);
    this.dom = d;
    const input = d.querySelector('#cp-code') as HTMLInputElement;
    const msg = d.querySelector('#cp-msg') as HTMLDivElement;
    setTimeout(() => input.focus(), 30);
    (d.querySelector('#cp-form') as HTMLFormElement).onsubmit = (e) => {
      e.preventDefault();
      const r = redeemCoupon(app.save, input.value);
      if (r.ok) {
        app.persist();
        audio.play('confirm');
        msg.style.color = '#80ffa0';
        msg.textContent = `쿠폰 사용 완료! ${r.desc}`;
        app.toast(`쿠폰 보상: ${r.desc}`, '#80ffa0');
        input.value = '';
      } else {
        audio.play('error');
        msg.style.color = '#ff8090';
        msg.textContent = r.error;
      }
    };
    (d.querySelector('#cp-close') as HTMLButtonElement).onclick = () => this.closeDom();
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
        const y = 35 + i * 11;
        const sel = i === this.keys.sel;
        g.fillStyle = sel ? 'rgba(138,106,208,0.35)' : 'transparent';
        g.fillRect(66, y - 1, 348, 11);
        hot.add(`keys:${i}`, 66, y - 1, 348, 11);
        text(g, it.label, 72, y, { size: 7, color: sel ? '#ffffff' : '#c8c0d8' });
        if (i < ACTIONS.length) {
          const a = ACTIONS[i];
          const cap = this.mode === 'capture' && a === this.capAction;
          const none = !b[a].keys.length;
          text(g, cap ? '바꿀 키를 누르세요… (Esc 취소)' : none ? '(없음)' : b[a].keys.map(keyName).join(' / '), 260, y, { size: 7, color: cap ? '#ff8080' : none ? '#ff6070' : '#ffe080', maxW: 150 });
        }
      });
      text(g, '항목을 고르고 Enter(또는 공격 키) → 새 키를 누르면 바뀝니다. 다른 동작에 쓰던 키면 그쪽에서는 빠집니다.', 240, 245, { size: 6, align: 'center', color: '#a8a0c0', maxW: 400 });
      keyHint(g, [['↑↓', '선택'], ['Enter', '변경'], ['Esc', '돌아가기']], 260);
      return;
    }
    this.main.render(g, 120, 30, 240, 20, 3, 8);
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
