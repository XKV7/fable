import type { ActEvent, ActionDef, Element, PoseName, ProjDef, SlashFx, StatusId } from '../game/types';

/** 캐릭터 데이터를 간결하게 쓰기 위한 액션 빌더. 결과는 순수 데이터(ActionDef). */
export interface MeleeOpts {
  dur: number;
  t: number;
  m: number;
  box: [number, number, number, number];
  w?: PoseName;
  s?: PoseName;
  fx?: SlashFx;
  kb?: number;
  up?: number;
  hs?: number;
  lunge?: number;
  cancel?: number;
  el?: Element;
  st?: StatusId;
  fin?: boolean;
  sfx?: string;
  armor?: boolean;
  shake?: number;
  air?: boolean;
  grav?: number;
  extra?: ActEvent[];
  inv?: [number, number];
}

export function melee(o: MeleeOpts): ActionDef {
  const ev: ActEvent[] = [
    { t: Math.max(0, o.t - 2), k: 'sfx', s: o.sfx ?? 'swing' },
    { t: o.t, k: 'hit', box: o.box, m: o.m, kb: o.kb, up: o.up, hs: o.hs, el: o.el, st: o.st, fin: o.fin, fx: o.fx, shake: o.shake },
  ];
  if (o.extra) ev.push(...o.extra);
  return {
    dur: o.dur,
    pose: [
      [0, o.w ?? 'windHigh'],
      [Math.max(1, o.t - 2), o.s ?? 'slashDown'],
    ],
    cancel: o.cancel ?? Math.min(o.dur - 2, o.t + 6),
    move: o.lunge ? [[Math.max(0, o.t - 3), o.lunge], [o.t + 3, 0]] : [[0, 0]],
    armor: o.armor,
    grav: o.grav,
    airOk: o.air,
    inv: o.inv,
    ev,
  };
}

export interface ShotOpts {
  dur: number;
  t: number;
  m: number;
  p: ProjDef;
  n?: number;
  spread?: number;
  ang?: number;
  w?: PoseName;
  s?: PoseName;
  sfx?: string;
  dx?: number;
  dy?: number;
  cancel?: number;
  air?: boolean;
  grav?: number;
  move?: [number, number, number?][];
  extra?: ActEvent[];
  inv?: [number, number];
}

export function shot(o: ShotOpts): ActionDef {
  const ev: ActEvent[] = [
    { t: o.t, k: 'sfx', s: o.sfx ?? 'proj' },
    { t: o.t, k: 'proj', p: o.p, m: o.m, n: o.n, spread: o.spread, ang: o.ang, dx: o.dx ?? 8, dy: o.dy ?? -4 },
  ];
  if (o.extra) ev.push(...o.extra);
  return {
    dur: o.dur,
    pose: [
      [0, o.w ?? 'shootWind'],
      [Math.max(1, o.t - 1), o.s ?? 'shoot'],
    ],
    cancel: o.cancel ?? Math.min(o.dur - 2, o.t + 4),
    move: o.move ?? [[0, 0]],
    airOk: o.air,
    grav: o.grav,
    inv: o.inv,
    ev,
  };
}

/** 여러 번 때리는 연타 */
export function multi(o: { dur: number; times: number[]; m: number; box: [number, number, number, number]; pose: [number, PoseName][]; fx?: SlashFx; kb?: number; up?: number; lastKb?: number; lastUp?: number; lastM?: number; el?: Element; st?: StatusId; hs?: number; sfx?: string; move?: [number, number, number?][]; armor?: boolean; air?: boolean; grav?: number; inv?: [number, number]; fin?: boolean; cancel?: number; extra?: ActEvent[] }): ActionDef {
  const ev: ActEvent[] = [];
  o.times.forEach((t, i) => {
    const last = i === o.times.length - 1;
    ev.push({ t: Math.max(0, t - 1), k: 'sfx', s: o.sfx ?? 'swing' });
    ev.push({
      t, k: 'hit', box: o.box, m: last && o.lastM !== undefined ? o.lastM : o.m,
      kb: last && o.lastKb !== undefined ? o.lastKb : o.kb ?? 0.6,
      up: last && o.lastUp !== undefined ? o.lastUp : o.up,
      el: o.el, st: o.st, hs: o.hs ?? 2, fx: o.fx, fin: last && o.fin, g: i,
    });
  });
  if (o.extra) ev.push(...o.extra);
  return { dur: o.dur, pose: o.pose, move: o.move ?? [[0, 0]], armor: o.armor, airOk: o.air, grav: o.grav, inv: o.inv, cancel: o.cancel ?? o.dur - 2, ev };
}

// 자주 쓰는 투사체
export const P = {
  arrow: (col = '#e8d8a0', extra: Partial<ProjDef> = {}): ProjDef => ({ spr: 'arrow', spd: 7, life: 60, w: 12, h: 4, col, kb: 1.5, ...extra }),
  orb: (col: string, extra: Partial<ProjDef> = {}): ProjDef => ({ spr: 'orb', spd: 4.5, life: 70, w: 8, h: 8, col, kb: 1, ...extra }),
  star: (col = '#ffe680', extra: Partial<ProjDef> = {}): ProjDef => ({ spr: 'star', spd: 5, life: 80, w: 9, h: 9, col, kb: 1, home: 0.12, ...extra }),
};
