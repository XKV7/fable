import type { Action, Input } from '../core/input';

/**
 * 화면 터치 패드 (스마트폰·태블릿). 캔버스 위에 반투명 HTML 버튼을 겹쳐 놓고,
 * 누르고 있는 동작을 Input.touch에 넣는다 — 키보드·게임패드와 똑같이 처리된다.
 *  - 왼쪽 아래: 방향 패드 (손가락을 미끄러뜨려 방향 전환, 대각선 가능)
 *  - 오른쪽 아래: 공격(크게)·점프·대시, 그 위로 스킬 1·2·궁극기·교대·상호작용·아이템
 *  - 위: 일시정지·빌드, 패드 숨기기/보이기 버튼
 */
export type TouchMode = 'auto' | 'on' | 'off';

interface Btn {
  a: Action;
  label: string;
  /** 오른쪽·아래 기준 위치와 크기 (패드 단위 u의 배수) */
  r: number;
  b: number;
  s: number;
  col: string;
}

const BTNS: Btn[] = [
  { a: 'attack', label: '공격', r: 1.25, b: 0.55, s: 1.5, col: '#ff6070' },
  { a: 'jump', label: '점프', r: 0.25, b: 1.55, s: 1.05, col: '#80c0ff' },
  { a: 'dash', label: '대시', r: 2.95, b: 0.35, s: 1.05, col: '#c0a0ff' },
  { a: 'skill1', label: '스킬1', r: 3.05, b: 1.6, s: 0.95, col: '#ffd060' },
  { a: 'skill2', label: '스킬2', r: 2.05, b: 2.35, s: 0.95, col: '#ffd060' },
  { a: 'ult', label: '궁극', r: 0.85, b: 2.85, s: 0.95, col: '#ff80e0' },
  { a: 'swap', label: '교대', r: 4.15, b: 0.45, s: 0.85, col: '#80ffc0' },
  { a: 'interact', label: '상호', r: 4.25, b: 1.55, s: 0.8, col: '#e0e0e0' },
  { a: 'item', label: '아이템', r: 3.1, b: 2.75, s: 0.8, col: '#a0ff80' },
];

export function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return (navigator.maxTouchPoints ?? 0) > 0 || window.matchMedia?.('(pointer: coarse)').matches === true;
}

export class TouchPad {
  private root: HTMLDivElement;
  private pad: HTMLDivElement;
  private toggle: HTMLButtonElement;
  private hint: HTMLDivElement;
  /** 버튼마다 누르고 있는 손가락 */
  private down = new Map<number, Action[]>();
  mode: TouchMode = 'auto';
  /** 화면의 숨기기 버튼으로 잠깐 숨김 (설정은 그대로) */
  hidden = false;
  onToggle: ((visible: boolean) => void) | null = null;

  constructor(private input: Input) {
    const root = document.createElement('div');
    root.id = 'touchpad';
    root.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:5;font-family:"Noto Sans KR",sans-serif;';
    this.root = root;

    const pad = document.createElement('div');
    pad.style.cssText = 'position:absolute;inset:0;pointer-events:none;';
    this.pad = pad;
    root.appendChild(pad);

    // 방향 패드
    const dp = document.createElement('div');
    dp.dataset.tp = 'dpad';
    dp.style.cssText = 'position:absolute;left:calc(env(safe-area-inset-left,0px) + var(--u)*0.35);bottom:calc(var(--u)*0.35);width:calc(var(--u)*3);height:calc(var(--u)*3);border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,0.10),rgba(255,255,255,0.04) 70%);border:2px solid rgba(255,255,255,0.22);pointer-events:auto;touch-action:none;';
    for (const [t, x, y] of [['▲', 50, 14], ['▼', 50, 86], ['◀', 14, 50], ['▶', 86, 50]] as const) {
      const ar = document.createElement('div');
      ar.textContent = t;
      ar.style.cssText = `position:absolute;left:${x}%;top:${y}%;transform:translate(-50%,-50%);color:rgba(255,255,255,0.55);font-size:calc(var(--u)*0.42);pointer-events:none;`;
      dp.appendChild(ar);
    }
    const knob = document.createElement('div');
    knob.style.cssText = 'position:absolute;left:50%;top:50%;width:calc(var(--u)*1.1);height:calc(var(--u)*1.1);margin:calc(var(--u)*-0.55) 0 0 calc(var(--u)*-0.55);border-radius:50%;background:rgba(255,255,255,0.18);border:2px solid rgba(255,255,255,0.35);pointer-events:none;';
    dp.appendChild(knob);
    pad.appendChild(dp);
    const dirOf = (e: PointerEvent): Action[] => {
      const rc = dp.getBoundingClientRect();
      const dx = (e.clientX - (rc.left + rc.width / 2)) / (rc.width / 2);
      const dy = (e.clientY - (rc.top + rc.height / 2)) / (rc.height / 2);
      const m = Math.min(1, Math.hypot(dx, dy));
      const k = m > 0 ? m / Math.hypot(dx, dy) : 0;
      knob.style.transform = `translate(${dx * k * rc.width * 0.3}px,${dy * k * rc.height * 0.3}px)`;
      const out: Action[] = [];
      if (Math.hypot(dx, dy) < 0.22) return out;
      const ang = Math.atan2(dy, dx);
      // 8방향: 가로는 넓게(±67.5°), 세로는 위아래 ±67.5°
      if (Math.cos(ang) > 0.38) out.push('right');
      if (Math.cos(ang) < -0.38) out.push('left');
      if (Math.sin(ang) < -0.38) out.push('up');
      if (Math.sin(ang) > 0.38) out.push('down');
      return out;
    };
    this.bindZone(dp, dirOf, () => (knob.style.transform = ''));

    // 동작 버튼
    for (const b of BTNS) {
      const el = document.createElement('div');
      el.dataset.tp = b.a;
      el.textContent = b.label;
      el.style.cssText = `position:absolute;right:calc(env(safe-area-inset-right,0px) + var(--u)*${b.r});bottom:calc(var(--u)*${b.b});width:calc(var(--u)*${b.s});height:calc(var(--u)*${b.s});border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:calc(var(--u)*${(0.26 * Math.sqrt(b.s)).toFixed(2)});text-shadow:0 1px 2px #000;background:${b.col}22;border:2px solid ${b.col}88;opacity:0.85;pointer-events:auto;touch-action:none;`;
      pad.appendChild(el);
      this.bindZone(el, () => [b.a]);
    }
    // 위쪽 작은 버튼: 일시정지·빌드
    const small = (a: Action, label: string, css: string): void => {
      const el = document.createElement('div');
      el.dataset.tp = a;
      el.textContent = label;
      el.style.cssText = `position:absolute;top:calc(env(safe-area-inset-top,0px) + var(--u)*0.2);${css};min-width:calc(var(--u)*0.9);height:calc(var(--u)*0.62);padding:0 calc(var(--u)*0.15);border-radius:calc(var(--u)*0.18);display:flex;align-items:center;justify-content:center;color:#fff;font-size:calc(var(--u)*0.24);font-weight:700;background:rgba(20,12,34,0.55);border:2px solid rgba(200,180,255,0.45);pointer-events:auto;touch-action:none;`;
      pad.appendChild(el);
      this.bindZone(el, () => [a]);
    };
    small('pause', 'Ⅱ 메뉴', 'left:50%;transform:translateX(calc(-100% - var(--u)*0.1))');
    small('build', '빌드', 'left:50%;transform:translateX(calc(var(--u)*0.1))');

    // 패드 숨기기/보이기 (터치 화면에서만)
    const tg = document.createElement('button');
    tg.style.cssText = 'position:absolute;left:50%;top:calc(env(safe-area-inset-top,0px) + var(--u)*0.2);transform:translateX(calc(var(--u)*1.35));width:calc(var(--u)*0.62);height:calc(var(--u)*0.62);border-radius:8px;border:1px solid rgba(200,180,255,0.45);background:rgba(20,12,34,0.55);color:#e0d8f0;font-size:15px;pointer-events:auto;touch-action:none;padding:0;';
    tg.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.hidden = !this.hidden;
      this.refresh();
      this.onToggle?.(this.visible);
    });
    this.toggle = tg;
    root.appendChild(tg);

    // 세로 화면 안내
    const hint = document.createElement('div');
    hint.textContent = '가로로 돌리면 화면이 더 크게 보입니다';
    hint.style.cssText = 'position:absolute;left:50%;top:calc(50% - 28.125vw - 44px);transform:translateX(-50%);padding:6px 12px;border-radius:8px;background:rgba(20,12,34,0.8);color:#e0d8f0;font-size:13px;white-space:nowrap;pointer-events:none;';
    this.hint = hint;
    root.appendChild(hint);

    document.body.appendChild(root);
    const relayout = (): void => this.layout();
    window.addEventListener('resize', relayout);
    window.addEventListener('orientationchange', () => setTimeout(relayout, 120));
    window.addEventListener('blur', () => this.releaseAll());
    this.layout();
    this.refresh();
  }

  get visible(): boolean {
    const on = this.mode === 'on' || (this.mode === 'auto' && isTouchDevice());
    return on && !this.hidden;
  }

  setMode(m: TouchMode): void {
    this.mode = m;
    this.hidden = false;
    this.refresh();
  }

  /** 패드 단위 크기: 작은 폰 ~50px, 태블릿 ~80px */
  private layout(): void {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const u = Math.max(36, Math.min(84, Math.min(vw / 13, vh / 7.2)));
    this.root.style.setProperty('--u', `${u}px`);
    this.hint.style.display = vh > vw * 1.1 && this.visible ? 'block' : 'none';
  }

  refresh(): void {
    const showPad = this.visible;
    this.pad.style.display = showPad ? 'block' : 'none';
    // 숨기기 버튼은 패드를 쓸 수 있는 상황(켜짐 또는 자동+터치 화면)에서만
    const usable = this.mode === 'on' || (this.mode === 'auto' && isTouchDevice());
    this.toggle.style.display = usable ? 'block' : 'none';
    this.toggle.textContent = this.hidden ? '🎮' : '✕';
    this.toggle.title = this.hidden ? '터치 패드 보이기' : '터치 패드 숨기기';
    if (!showPad) this.releaseAll();
    this.layout();
  }

  private sync(): void {
    const set = new Set<Action>();
    for (const as of this.down.values()) for (const a of as) set.add(a);
    for (const a of set) if (!this.input.touch.has(a)) this.input.touchTap.add(a);
    this.input.touch.clear();
    for (const a of set) this.input.touch.add(a);
    this.input.lastDevice = 'kb';
  }

  private releaseAll(): void {
    this.down.clear();
    this.input.touch.clear();
  }

  private bindZone(el: HTMLElement, map: (e: PointerEvent) => Action[], onUp?: () => void): void {
    const press = (e: PointerEvent): void => {
      e.preventDefault();
      e.stopPropagation();
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* 일부 브라우저 */
      }
      this.down.set(e.pointerId, map(e));
      el.style.filter = 'brightness(1.6)';
      this.sync();
    };
    const move = (e: PointerEvent): void => {
      if (!this.down.has(e.pointerId)) return;
      e.preventDefault();
      this.down.set(e.pointerId, map(e));
      this.sync();
    };
    const up = (e: PointerEvent): void => {
      if (!this.down.has(e.pointerId)) return;
      this.down.delete(e.pointerId);
      el.style.filter = '';
      onUp?.();
      this.sync();
    };
    el.addEventListener('pointerdown', press);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('lostpointercapture', up);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }
}
