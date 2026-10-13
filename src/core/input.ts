export type Action =
  | 'left'
  | 'right'
  | 'up'
  | 'down'
  | 'jump'
  | 'attack'
  | 'dash'
  | 'skill1'
  | 'skill2'
  | 'swap'
  | 'interact'
  | 'item'
  | 'build'
  | 'pause';

export const ACTIONS: Action[] = [
  'left', 'right', 'up', 'down', 'jump', 'attack', 'dash', 'skill1', 'skill2', 'swap', 'interact', 'item', 'build', 'pause',
];

export const ACTION_LABELS: Record<Action, string> = {
  left: '왼쪽',
  right: '오른쪽',
  up: '위',
  down: '아래',
  jump: '점프',
  attack: '기본 공격',
  dash: '대시',
  skill1: '스킬 1',
  skill2: '스킬 2',
  swap: '교대',
  interact: '상호작용',
  item: '소모 아이템',
  build: '빌드 확인',
  pause: '일시정지',
};

export interface Binding {
  keys: string[];
  pad: number[];
}
export type Bindings = Record<Action, Binding>;

export const DEFAULT_BINDINGS: Bindings = {
  left: { keys: ['ArrowLeft'], pad: [14] },
  right: { keys: ['ArrowRight'], pad: [15] },
  up: { keys: ['ArrowUp'], pad: [12] },
  down: { keys: ['ArrowDown'], pad: [13] },
  jump: { keys: ['KeyC', 'Space'], pad: [0] },
  attack: { keys: ['KeyX'], pad: [2] },
  dash: { keys: ['KeyZ', 'ShiftLeft'], pad: [1, 7] },
  skill1: { keys: ['KeyA'], pad: [4] },
  skill2: { keys: ['KeyS'], pad: [5] },
  swap: { keys: ['KeyD'], pad: [3] },
  interact: { keys: ['KeyF'], pad: [11] },
  item: { keys: ['KeyQ'], pad: [6] },
  build: { keys: ['Tab'], pad: [8] },
  pause: { keys: ['Escape'], pad: [9] },
};

/** WASD 이동 프리셋: 스킬 키가 겹치므로 손 위치를 오른쪽으로 옮긴다. */
export const WASD_BINDINGS: Bindings = {
  left: { keys: ['KeyA'], pad: [14] },
  right: { keys: ['KeyD'], pad: [15] },
  up: { keys: ['KeyW'], pad: [12] },
  down: { keys: ['KeyS'], pad: [13] },
  jump: { keys: ['KeyK', 'Space'], pad: [0] },
  attack: { keys: ['KeyJ'], pad: [2] },
  dash: { keys: ['KeyL', 'ShiftLeft'], pad: [1, 7] },
  skill1: { keys: ['KeyU'], pad: [4] },
  skill2: { keys: ['KeyI'], pad: [5] },
  swap: { keys: ['KeyO'], pad: [3] },
  interact: { keys: ['KeyE'], pad: [11] },
  item: { keys: ['KeyQ'], pad: [6] },
  build: { keys: ['Tab'], pad: [8] },
  pause: { keys: ['Escape'], pad: [9] },
};

export function cloneBindings(b: Bindings): Bindings {
  const out = {} as Bindings;
  for (const a of ACTIONS) out[a] = { keys: [...(b[a]?.keys ?? DEFAULT_BINDINGS[a].keys)], pad: [...(b[a]?.pad ?? DEFAULT_BINDINGS[a].pad)] };
  return out;
}

const KEY_NAMES: Record<string, string> = {
  ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', Space: 'Space', Escape: 'Esc', Tab: 'Tab', Enter: 'Enter',
  ShiftLeft: 'L-Shift', ShiftRight: 'R-Shift', ControlLeft: 'L-Ctrl', ControlRight: 'R-Ctrl', AltLeft: 'L-Alt', AltRight: 'R-Alt',
  Backspace: 'Bksp', Comma: ',', Period: '.', Slash: '/', Semicolon: ';', Quote: "'", BracketLeft: '[', BracketRight: ']',
  Minus: '-', Equal: '=', Backquote: '`', Backslash: '\\',
};
const PAD_NAMES = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'Back', 'Start', 'LS', 'RS', 'D↑', 'D↓', 'D←', 'D→', 'Home'];

export function keyName(code: string): string {
  if (KEY_NAMES[code]) return KEY_NAMES[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'Num' + code.slice(6);
  return code;
}
export function padName(i: number): string {
  return PAD_NAMES[i] ?? `B${i}`;
}

type MenuKey = 'ok' | 'back' | 'mleft' | 'mright' | 'mup' | 'mdown' | 'tabL' | 'tabR';
const MENU_KEYS: Record<MenuKey, { keys: string[]; pad: number[] }> = {
  ok: { keys: ['Enter', 'NumpadEnter'], pad: [0] },
  back: { keys: ['Escape', 'Backspace'], pad: [1] },
  mleft: { keys: ['ArrowLeft'], pad: [14] },
  mright: { keys: ['ArrowRight'], pad: [15] },
  mup: { keys: ['ArrowUp'], pad: [12] },
  mdown: { keys: ['ArrowDown'], pad: [13] },
  tabL: { keys: ['KeyQ', 'PageUp'], pad: [4] },
  tabR: { keys: ['KeyE', 'PageDown'], pad: [5] },
};

/** 키보드 + 게임패드 입력. 고정 스텝마다 poll() → 질의 → endStep(). */
export class Input {
  bindings: Bindings = cloneBindings(DEFAULT_BINDINGS);
  private keys = new Set<string>();
  private keyLatch = new Set<string>();
  private prevKeys = new Set<string>();
  private curKeys = new Set<string>();
  private padButtons: boolean[] = [];
  private prevPad: boolean[] = [];
  private axisX = 0;
  private axisY = 0;
  private prevAxisX = 0;
  private prevAxisY = 0;
  lastDevice: 'kb' | 'pad' = 'kb';
  /** 키 재설정 중이면 다음 키/버튼을 여기로 전달 */
  captureHandler: ((code: string | null, pad: number | null) => void) | null = null;
  private repeatTimers = new Map<string, number>();
  anyPressedFlag = false;
  mouseClicked = false;

  constructor(target: HTMLElement) {
    window.addEventListener('keydown', (e) => {
      if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Backquote'].includes(e.code)) e.preventDefault();
      this.lastDevice = 'kb';
      if (this.captureHandler) {
        e.preventDefault();
        const h = this.captureHandler;
        this.captureHandler = null;
        h(e.code, null);
        return;
      }
      if (!this.keys.has(e.code)) this.keyLatch.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });
    window.addEventListener('blur', () => this.keys.clear());
    target.addEventListener('mousedown', () => {
      this.mouseClicked = true;
      target.focus();
    });
  }

  /** 매 고정 스텝 시작 시 호출 */
  poll(): void {
    this.curKeys = new Set([...this.keys, ...this.keyLatch]);
    this.keyLatch.clear();
    const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
    const nb: boolean[] = [];
    let ax = 0;
    let ay = 0;
    for (const p of pads) {
      if (!p) continue;
      p.buttons.forEach((b, i) => {
        if (b.pressed || b.value > 0.5) nb[i] = true;
      });
      if (Math.abs(p.axes[0] ?? 0) > 0.45) ax = Math.sign(p.axes[0]);
      if (Math.abs(p.axes[1] ?? 0) > 0.55) ay = Math.sign(p.axes[1]);
    }
    if (nb.some((v) => v) || ax || ay) this.lastDevice = 'pad';
    if (this.captureHandler) {
      for (let i = 0; i < nb.length; i++) {
        if (nb[i] && !this.padButtons[i]) {
          const h = this.captureHandler;
          this.captureHandler = null;
          h(null, i);
          break;
        }
      }
    }
    this.prevPad = this.padButtons;
    this.padButtons = nb;
    this.prevAxisX = this.axisX;
    this.prevAxisY = this.axisY;
    this.axisX = ax;
    this.axisY = ay;
    this.anyPressedFlag = this.computeAnyPressed();
  }

  endStep(): void {
    this.prevKeys = new Set(this.curKeys);
    this.mouseClicked = false;
  }

  private computeAnyPressed(): boolean {
    for (const k of this.curKeys) if (!this.prevKeys.has(k)) return true;
    for (let i = 0; i < this.padButtons.length; i++) if (this.padButtons[i] && !this.prevPad[i]) return true;
    return false;
  }

  private axisHeld(a: Action, prev = false): boolean {
    const x = prev ? this.prevAxisX : this.axisX;
    const y = prev ? this.prevAxisY : this.axisY;
    if (a === 'left') return x < 0;
    if (a === 'right') return x > 0;
    if (a === 'up') return y < 0;
    if (a === 'down') return y > 0;
    return false;
  }

  private bindHeld(b: { keys: string[]; pad: number[] }, prev: boolean): boolean {
    const ks = prev ? this.prevKeys : this.curKeys;
    const pb = prev ? this.prevPad : this.padButtons;
    for (const k of b.keys) if (ks.has(k)) return true;
    for (const p of b.pad) if (pb[p]) return true;
    return false;
  }

  held(a: Action): boolean {
    return this.bindHeld(this.bindings[a], false) || this.axisHeld(a);
  }
  pressed(a: Action): boolean {
    return (this.bindHeld(this.bindings[a], false) || this.axisHeld(a)) && !(this.bindHeld(this.bindings[a], true) || this.axisHeld(a, true));
  }
  released(a: Action): boolean {
    return !this.held(a) && (this.bindHeld(this.bindings[a], true) || this.axisHeld(a, true));
  }
  raw(code: string): boolean {
    return this.curKeys.has(code) && !this.prevKeys.has(code);
  }
  rawHeld(code: string): boolean {
    return this.curKeys.has(code);
  }

  private menuHeld(k: MenuKey, prev = false): boolean {
    if (this.bindHeld(MENU_KEYS[k], prev)) return true;
    const x = prev ? this.prevAxisX : this.axisX;
    const y = prev ? this.prevAxisY : this.axisY;
    if (k === 'mleft') return x < 0 || this.bindHeld(this.bindings.left, prev);
    if (k === 'mright') return x > 0 || this.bindHeld(this.bindings.right, prev);
    if (k === 'mup') return y < 0 || this.bindHeld(this.bindings.up, prev);
    if (k === 'mdown') return y > 0 || this.bindHeld(this.bindings.down, prev);
    if (k === 'ok') return this.bindHeld(this.bindings.attack, prev) || this.bindHeld(this.bindings.jump, prev) || this.bindHeld(this.bindings.interact, prev);
    if (k === 'back') return this.bindHeld(this.bindings.pause, prev) || this.bindHeld(this.bindings.dash, prev);
    return false;
  }

  /** 메뉴용: 누른 순간 + 길게 누를 때 자동 반복 */
  menu(k: MenuKey): boolean {
    const h = this.menuHeld(k);
    const p = this.menuHeld(k, true);
    if (h && !p) {
      this.repeatTimers.set(k, 18);
      return true;
    }
    if (h && (k === 'mleft' || k === 'mright' || k === 'mup' || k === 'mdown')) {
      const t = (this.repeatTimers.get(k) ?? 18) - 1;
      if (t <= 0) {
        this.repeatTimers.set(k, 5);
        return true;
      }
      this.repeatTimers.set(k, t);
    }
    return false;
  }

  label(a: Action): string {
    const b = this.bindings[a];
    if (this.lastDevice === 'pad' && b.pad.length) return padName(b.pad[0]);
    return b.keys.length ? keyName(b.keys[0]) : '-';
  }
}
