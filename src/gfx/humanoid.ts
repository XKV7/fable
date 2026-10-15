import type { Look, PoseName } from '../game/types';
import { Pix, shade } from './pixel';

/** 절차적 인간형 픽셀 스프라이트 생성기. 포즈 데이터 → 48×48 프레임. */
export const FW = 48;
export const FH = 48;
export const FOOT_Y = 44;

interface Pose {
  bob: number;
  lean: number;
  fl: [number, number];
  bl: [number, number];
  af: number;
  ab: number;
  w: number;
  crouch?: number;
  cape?: number; // 망토 휘날림 (0 아래 ~ 1 수평)
}

const run = (i: number): Pose => {
  const ph = (i / 6) * Math.PI * 2;
  return {
    bob: Math.abs(Math.sin(ph)) > 0.7 ? 0 : 1,
    lean: 1,
    fl: [Math.round(Math.sin(ph) * 4), -Math.round(Math.max(0, Math.cos(ph)) * 2)],
    bl: [Math.round(-Math.sin(ph) * 4), -Math.round(Math.max(0, -Math.cos(ph)) * 2)],
    af: 90 - Math.sin(ph) * 50,
    ab: 90 + Math.sin(ph) * 50,
    w: 40 - Math.sin(ph) * 20,
    cape: 0.4,
  };
};

export const POSES: Record<PoseName, Pose> = {
  idle0: { bob: 0, lean: 0, fl: [2, 0], bl: [-2, 0], af: 75, ab: 100, w: 50, cape: 0 },
  idle1: { bob: 1, lean: 0, fl: [2, 0], bl: [-2, 0], af: 80, ab: 105, w: 55, cape: 0.05 },
  run0: run(0), run1: run(1), run2: run(2), run3: run(3), run4: run(4), run5: run(5),
  jump: { bob: -1, lean: 0, fl: [2, -4], bl: [-1, -2], af: -20, ab: -130, w: -40, cape: 0.2 },
  fall: { bob: 0, lean: 0, fl: [2, 0], bl: [-3, -1], af: -50, ab: -150, w: -60, cape: 0.8 },
  dash: { bob: 1, lean: 3, fl: [-3, -2], bl: [-7, -3], af: 160, ab: 170, w: 175, cape: 1 },
  hurt: { bob: 1, lean: -2, fl: [3, 0], bl: [-3, 0], af: -120, ab: -150, w: -110, cape: 0.3 },
  crouch: { bob: 3, lean: 1, fl: [4, 0], bl: [-4, 0], af: 40, ab: 120, w: 20, crouch: 3, cape: 0.1 },
  windHigh: { bob: 0, lean: -1, fl: [3, 0], bl: [-3, 0], af: -115, ab: -140, w: -130, cape: 0.2 },
  slashDown: { bob: 1, lean: 2, fl: [5, 0], bl: [-4, 0], af: 35, ab: 130, w: 50, cape: 0.5 },
  windLow: { bob: 1, lean: -1, fl: [3, 0], bl: [-3, 0], af: 125, ab: 150, w: 150, cape: 0.2 },
  slashUp: { bob: -1, lean: 2, fl: [4, 0], bl: [-4, 0], af: -55, ab: 100, w: -70, cape: 0.5 },
  thrustWind: { bob: 1, lean: -2, fl: [3, 0], bl: [-4, 0], af: 165, ab: 120, w: 0, cape: 0.2 },
  thrust: { bob: 1, lean: 3, fl: [6, 0], bl: [-5, 0], af: 0, ab: 160, w: 0, cape: 0.7 },
  spin: { bob: 0, lean: 0, fl: [3, -1], bl: [-3, 0], af: 180, ab: 10, w: 190, cape: 0.9 },
  slamWind: { bob: -1, lean: -1, fl: [2, 0], bl: [-3, 0], af: -95, ab: -100, w: -100, cape: 0.1 },
  slam: { bob: 3, lean: 3, fl: [6, 0], bl: [-5, 0], af: 55, ab: 65, w: 80, crouch: 2, cape: 0.6 },
  cast: { bob: 0, lean: 1, fl: [3, 0], bl: [-3, 0], af: -5, ab: 140, w: -35, cape: 0.3 },
  castUp: { bob: -1, lean: 0, fl: [2, 0], bl: [-2, 0], af: -80, ab: -100, w: -95, cape: 0.3 },
  shootWind: { bob: 0, lean: -1, fl: [3, 0], bl: [-3, 0], af: 0, ab: 175, w: 0, cape: 0.1 },
  shoot: { bob: 0, lean: 1, fl: [3, 0], bl: [-3, 0], af: 0, ab: 150, w: 0, cape: 0.4 },
  kick: { bob: 0, lean: -2, fl: [9, -7], bl: [-2, 0], af: -40, ab: 150, w: -40, cape: 0.5 },
  uppercut: { bob: -2, lean: 1, fl: [2, -2], bl: [-3, 0], af: -80, ab: 110, w: -80, cape: 0.4 },
  guard: { bob: 1, lean: 1, fl: [3, 0], bl: [-3, 0], af: 15, ab: 5, w: -70, cape: 0.2 },
  throw: { bob: 0, lean: 2, fl: [5, 0], bl: [-4, 0], af: 20, ab: 160, w: 20, cape: 0.5 },
  dead: { bob: 1, lean: -2, fl: [3, 0], bl: [-3, 0], af: -120, ab: -150, w: -110, cape: 0.3 },
};

const D = Math.PI / 180;

function drawWeapon(p: Pix, L: Look, hx: number, hy: number, deg: number, back: boolean): void {
  const a = deg * D;
  const c = L.wcol;
  const c2 = L.wcol2;
  const hi = shade(c, 0.45);
  const lo = shade(c, -0.35);
  switch (L.weapon) {
    case 'sword':
      p.bar(hx, hy, a + Math.PI, 2, 1, c2);
      p.bar(hx, hy, a, 11, 2, c, 2);
      p.bar(hx, hy, a, 11, 1, hi, 3);
      p.bar(hx + Math.cos(a) * 2, hy + Math.sin(a) * 2, a + Math.PI / 2, 2, 1, c2);
      p.bar(hx + Math.cos(a) * 2, hy + Math.sin(a) * 2, a - Math.PI / 2, 2, 1, c2);
      break;
    case 'greatsword':
      p.bar(hx, hy, a + Math.PI, 3, 2, c2);
      p.bar(hx, hy, a, 18, 4, c, 3);
      p.bar(hx, hy, a, 17, 1, hi, 4);
      p.bar(hx, hy, a, 18, 1, lo, 3);
      p.bar(hx + Math.cos(a) * 3, hy + Math.sin(a) * 3, a + Math.PI / 2, 4, 2, c2);
      p.bar(hx + Math.cos(a) * 3, hy + Math.sin(a) * 3, a - Math.PI / 2, 4, 2, c2);
      break;
    case 'rapier':
      p.bar(hx, hy, a, 14, 1, c, 2);
      p.disc(hx + Math.cos(a) * 2, hy + Math.sin(a) * 2, 1, c2);
      break;
    case 'daggers':
      p.bar(hx, hy, a, 6, 1, c, 1);
      p.px(hx, hy, c2);
      break;
    case 'spear':
      p.bar(hx, hy, a + Math.PI, 7, 1, c2);
      p.bar(hx, hy, a, 13, 1, c2);
      p.bar(hx, hy, a, 18, 2, c, 13);
      p.px(hx + Math.cos(a) * 19, hy + Math.sin(a) * 19, hi);
      break;
    case 'lance':
      p.bar(hx, hy, a + Math.PI, 6, 2, c2);
      p.bar(hx, hy, a, 8, 2, c2);
      for (let t = 8; t <= 20; t += 1) p.bar(hx + Math.cos(a) * t, hy + Math.sin(a) * t, a + Math.PI / 2, Math.max(0, (20 - t) / 4), 1, t % 3 === 0 ? hi : c, -Math.max(0, (20 - t) / 4));
      break;
    case 'scythe': {
      p.bar(hx, hy, a + Math.PI, 7, 1, c2);
      p.bar(hx, hy, a, 11, 1, c2);
      const tx = hx + Math.cos(a) * 11;
      const ty = hy + Math.sin(a) * 11;
      for (let i = 0; i < 12; i++) {
        const b = a - Math.PI / 2 - i * 0.12;
        p.bar(tx, ty, b, 2, 1, i < 3 ? hi : c, 0);
        p.px(tx + Math.cos(a - Math.PI / 2) * i * 0.9 - Math.cos(a) * i * 0.25, ty + Math.sin(a - Math.PI / 2) * i * 0.9 - Math.sin(a) * i * 0.25, i % 2 ? c : hi);
      }
      break;
    }
    case 'shovel': {
      p.bar(hx, hy, a + Math.PI, 8, 2, c2);
      p.bar(hx, hy, a, 12, 2, c2);
      const tx = hx + Math.cos(a) * 14;
      const ty = hy + Math.sin(a) * 14;
      p.bar(tx, ty, a, 5, 5, c);
      p.bar(tx, ty, a, 5, 1, hi);
      break;
    }
    case 'hammer': {
      p.bar(hx, hy, a + Math.PI, 3, 2, c2);
      p.bar(hx, hy, a, 12, 2, c2);
      const tx = hx + Math.cos(a) * 12;
      const ty = hy + Math.sin(a) * 12;
      p.bar(tx, ty, a + Math.PI / 2, 4, 6, c, -4);
      p.bar(tx, ty, a + Math.PI / 2, 4, 1, hi, -4);
      break;
    }
    case 'mace':
      p.bar(hx, hy, a, 7, 1, c2);
      p.disc(hx + Math.cos(a) * 8, hy + Math.sin(a) * 8, 2, c);
      p.px(hx + Math.cos(a) * 8 - 1, hy + Math.sin(a) * 8 - 1, hi);
      break;
    case 'staff': {
      p.bar(hx, hy, a + Math.PI, 6, 1, c2);
      p.bar(hx, hy, a, 10, 1, c2);
      const tx = hx + Math.cos(a) * 11;
      const ty = hy + Math.sin(a) * 11;
      p.rect(tx - 2, ty - 2, 4, 4, c);
      p.px(tx - 1, ty - 1, '#101010');
      p.px(tx + 1, ty - 1, '#101010');
      if (L.glow) p.px(tx, ty + 1, L.glow);
      break;
    }
    case 'clock': {
      p.bar(hx, hy, a + Math.PI, 6, 1, c2);
      p.bar(hx, hy, a, 10, 1, c2);
      const tx = hx + Math.cos(a) * 12;
      const ty = hy + Math.sin(a) * 12;
      p.disc(tx, ty, 3, c);
      p.disc(tx, ty, 2, '#f8f0e0');
      p.px(tx, ty - 1, '#202020');
      p.px(tx + 1, ty, '#202020');
      break;
    }
    case 'orb': {
      const tx = hx + Math.cos(a) * 4;
      const ty = hy + Math.sin(a) * 4 - 2;
      p.disc(tx, ty, 2, c);
      p.px(tx - 1, ty - 1, '#ffffff');
      p.ring(tx, ty, 4, c2);
      break;
    }
    case 'flask': {
      const tx = hx + Math.cos(a) * 2;
      const ty = hy + Math.sin(a) * 2;
      p.rect(tx - 1, ty - 4, 2, 2, c2);
      p.disc(tx, ty, 2, c);
      p.px(tx - 1, ty - 1, hi);
      break;
    }
    case 'fists':
      p.rect(hx - 1, hy - 1, 3, 3, c);
      p.px(hx, hy - 1, hi);
      break;
    case 'bow': {
      for (let i = -6; i <= 6; i++) {
        const t = i / 6;
        const bx = hx + Math.cos(a) * (3 - t * t * 3) + Math.cos(a + Math.PI / 2) * i;
        const by = hy + Math.sin(a) * (3 - t * t * 3) + Math.sin(a + Math.PI / 2) * i;
        p.px(bx, by, Math.abs(i) < 2 ? c2 : c);
      }
      const sx1 = hx + Math.cos(a + Math.PI / 2) * 6;
      const sy1 = hy + Math.sin(a + Math.PI / 2) * 6;
      const sx2 = hx - Math.cos(a + Math.PI / 2) * 6;
      const sy2 = hy - Math.sin(a + Math.PI / 2) * 6;
      p.line(sx1, sy1, sx2, sy2, '#f0f0e0');
      break;
    }
    case 'axe': {
      p.bar(hx, hy, a + Math.PI, 3, 2, c2);
      p.bar(hx, hy, a, 11, 2, c2);
      const tx = hx + Math.cos(a) * 9;
      const ty = hy + Math.sin(a) * 9;
      for (let k = 0; k < 6; k++) p.bar(tx + Math.cos(a) * k * 0.5, ty + Math.sin(a) * k * 0.5, a - Math.PI / 2, 5 - Math.abs(k - 2.5) * 0.6, 1, k < 2 ? hi : c, 0);
      break;
    }
    case 'cannon':
      p.bar(hx, hy, a + Math.PI, 5, 5, lo);
      p.bar(hx, hy, a, 12, 5, c);
      p.bar(hx, hy, a, 12, 1, hi);
      p.bar(hx + Math.cos(a) * 12, hy + Math.sin(a) * 12, a, 2, 6, c2);
      break;
    case 'lute':
      p.ellipse(hx + Math.cos(a) * 2, hy + Math.sin(a) * 2 + 1, 3, 3, c);
      p.px(hx + Math.cos(a) * 2, hy + Math.sin(a) * 2 + 1, lo);
      p.bar(hx, hy, a - 0.6, 8, 1, c2, 3);
      break;
    case 'claws':
      for (let k = -1; k <= 1; k++) p.bar(hx, hy, a + k * 0.35, 5, 1, k === 0 ? hi : c, 1);
      p.rect(hx - 1, hy - 1, 3, 3, c2);
      break;
    case 'strings': {
      const tx = hx + Math.cos(a) * 3;
      const ty = hy + Math.sin(a) * 3;
      p.bar(tx, ty, a + Math.PI / 2, 4, 1, c2, -4);
      for (let k = -1; k <= 1; k++) p.line(tx + Math.cos(a + Math.PI / 2) * k * 3, ty + Math.sin(a + Math.PI / 2) * k * 3, tx + Math.cos(a + Math.PI / 2) * k * 3, ty + 9, c);
      break;
    }
    case 'talisman':
      p.rect(hx - 1, hy - 4, 3, 6, c);
      p.px(hx, hy - 3, c2);
      p.px(hx, hy - 1, c2);
      break;
    case 'none':
      break;
  }
  void back;
}

/** 한 포즈를 그린다. 스케일 1, 오른쪽을 향함. */
export function drawHumanoid(L: Look, poseName: PoseName): HTMLCanvasElement {
  const P = POSES[poseName];
  const p = new Pix(FW, FH);
  const big = L.build === 'big';
  const slim = L.build === 'slim';
  const cx = 24;
  const legLen = 8 - (P.crouch ?? 0);
  const hipY = FOOT_Y - legLen + P.bob * 0 + (P.crouch ?? 0) * 0;
  const tw = big ? 8 : slim ? 5 : 6;
  const th = big ? 10 : 8;
  const torsoBot = hipY + (P.bob > 0 ? Math.min(P.bob, 1) : P.bob);
  const torsoTop = torsoBot - th;
  const lean = P.lean;
  const tx = cx - Math.floor(tw / 2) + Math.round(lean * 0.5);
  const headX = cx - 3 + lean;
  const headY = torsoTop - 7;
  const shoulderY = torsoTop + 2;
  const sxF = tx + tw - 1;
  const sxB = tx;
  const skinShade = shade(L.skin, -0.2);

  // 날개
  if (L.extra === 'wings') {
    const wc = shade(L.cape ?? L.body, -0.1);
    for (let i = 0; i < 9; i++) {
      p.line(sxB, shoulderY, sxB - 6 - i * 0.6, shoulderY - 8 + i * 1.6, i % 3 === 0 ? shade(wc, 0.3) : wc);
    }
  }
  // 망토
  if (L.cape) {
    const cl = P.cape ?? 0;
    for (let i = 0; i < th + 6; i++) {
      const off = Math.round(i * (0.15 + cl * 0.9));
      const yy = shoulderY - 1 + Math.round(i * (1 - cl * 0.55));
      p.rect(sxB - off - 1, yy, 3 + (i > 6 ? 1 : 0), 1, i % 4 === 3 ? shade(L.cape, -0.25) : L.cape);
    }
  }
  // 스카프
  if (L.extra === 'scarf') {
    const sc = L.trim;
    const cl = P.cape ?? 0;
    for (let i = 0; i < 6; i++) p.px(headX - 1 - i, torsoTop - 1 + Math.round(i * (0.6 - cl * 0.5)) + (i % 2), sc);
  }
  // 뒤쪽 팔
  const armLen = big ? 7 : 6;
  const ab = P.ab * D;
  const bhx = sxB + Math.cos(ab) * armLen;
  const bhy = shoulderY + Math.sin(ab) * armLen;
  p.bar(sxB, shoulderY, ab, armLen, 2, shade(L.body, -0.3));
  p.px(bhx, bhy, skinShade);
  if (L.shield) {
    p.rect(bhx - 3, bhy - 5, 6, 9, L.shield);
    p.rect(bhx - 2, bhy - 4, 4, 7, shade(L.shield, -0.25));
    p.rect(bhx - 1, bhy - 3, 2, 5, shade(L.shield, 0.4));
  }
  if (L.weapon === 'daggers') drawWeapon(p, L, bhx, bhy, P.ab + 20, true);
  // 다리
  const legCol = L.legs;
  const hipFx = cx + 1;
  const hipBx = cx - 2;
  const ffx = cx + P.fl[0];
  const ffy = FOOT_Y + P.fl[1];
  const bfx = cx - 1 + P.bl[0];
  const bfy = FOOT_Y + P.bl[1];
  p.line(hipBx, hipY, bfx, bfy - 1, shade(legCol, -0.25));
  p.line(hipBx + 1, hipY, bfx + 1, bfy - 1, shade(legCol, -0.25));
  p.rect(bfx - 1, bfy - 2, 3, 2, shade(L.boots, -0.2));
  // 몸통
  p.rect(tx, torsoTop, tw, th, L.body);
  p.rect(tx, torsoTop, tw, 1, shade(L.body, 0.25));
  p.rect(tx, torsoBot - 2, tw, 1, L.trim);
  p.rect(tx + Math.floor(tw / 2), torsoTop + 1, 1, th - 3, shade(L.body, -0.15));
  if (big) {
    p.rect(tx - 1, torsoTop, 3, 3, L.trim);
    p.rect(tx + tw - 2, torsoTop, 3, 3, L.trim);
  }
  if (L.hairStyle === 'skull') {
    // 갈비뼈
    for (let i = 0; i < 3; i++) p.rect(tx + 1, torsoTop + 2 + i * 2, tw - 2, 1, '#2a2620');
  }
  // 앞다리
  p.line(hipFx, hipY, ffx, ffy - 1, legCol);
  p.line(hipFx + 1, hipY, ffx + 1, ffy - 1, legCol);
  p.rect(ffx - 1, ffy - 2, 4, 2, L.boots);
  // 머리
  const hs = L.hairStyle;
  const hc = L.hair;
  if (hs === 'long' || hs === 'veil') p.rect(headX - 1, headY + 1, 4, 9, hs === 'veil' ? L.trim : hc);
  if (hs === 'pony') {
    p.rect(headX - 3, headY + 1, 3, 2, hc);
    p.rect(headX - 4, headY + 2, 2, 5, hc);
  }
  if (hs === 'bun') p.disc(headX + 1, headY - 1, 2, hc);
  if (hs === 'hood' || hs === 'witch') p.rect(headX - 2, headY - 1, 9, 9, L.cape ?? L.body);
  p.rect(headX, headY, 7, 7, hs === 'skull' ? '#e8e0c8' : L.skin);
  p.rect(headX, headY + 6, 7, 1, hs === 'skull' ? '#c8c0a8' : skinShade);
  switch (hs) {
    case 'short':
      p.rect(headX - 1, headY - 1, 8, 3, hc);
      p.rect(headX - 1, headY + 1, 2, 3, hc);
      break;
    case 'long':
    case 'pony':
      p.rect(headX - 1, headY - 1, 8, 3, hc);
      p.rect(headX - 1, headY + 1, 2, 4, hc);
      break;
    case 'bun':
      p.rect(headX - 1, headY - 1, 8, 2, hc);
      p.rect(headX - 1, headY, 2, 4, hc);
      break;
    case 'spiky':
      p.rect(headX - 1, headY - 1, 8, 2, hc);
      for (let i = 0; i < 4; i++) p.px(headX - 1 + i * 2, headY - 2 - (i % 2), hc);
      p.rect(headX - 2, headY, 3, 4, hc);
      break;
    case 'helm':
      p.rect(headX - 1, headY - 1, 9, 8, L.trim === '#b08a3a' ? '#6a6a7a' : L.body);
      p.rect(headX - 1, headY - 1, 9, 1, shade(L.body, 0.3));
      p.rect(headX + 3, headY + 3, 4, 1, '#101014');
      p.px(headX + 5, headY + 3, L.eye);
      p.rect(headX + 2, headY - 3, 2, 2, L.cape ?? L.trim);
      break;
    case 'horned':
      p.rect(headX - 1, headY - 1, 9, 5, L.body);
      p.rect(headX + 3, headY + 3, 4, 1, '#100808');
      p.px(headX + 5, headY + 3, L.eye);
      p.line(headX, headY - 1, headX - 3, headY - 5, '#e0d0b0');
      p.line(headX + 6, headY - 1, headX + 8, headY - 5, '#e0d0b0');
      break;
    case 'crown':
      p.rect(headX - 1, headY - 1, 8, 3, hc);
      p.rect(headX - 1, headY + 1, 2, 6, hc);
      p.rect(headX, headY - 3, 7, 2, '#e0b040');
      p.px(headX, headY - 4, '#e0b040');
      p.px(headX + 3, headY - 4, '#ff4ab0');
      p.px(headX + 6, headY - 4, '#e0b040');
      break;
    case 'hood':
      p.rect(headX - 2, headY - 2, 9, 3, L.cape ?? L.body);
      p.rect(headX + 1, headY + 1, 6, 5, shade(L.skin, -0.55));
      break;
    case 'witch':
      p.rect(headX - 3, headY - 1, 13, 2, L.cape ?? L.body);
      p.rect(headX - 1, headY - 3, 8, 2, L.cape ?? L.body);
      p.rect(headX + 1, headY - 5, 5, 2, L.cape ?? L.body);
      p.rect(headX + 2, headY - 7, 3, 2, L.cape ?? L.body);
      p.px(headX + 2, headY - 8, L.cape ?? L.body);
      p.rect(headX - 1, headY - 2, 8, 1, L.trim);
      p.rect(headX - 1, headY + 1, 2, 5, hc);
      break;
    case 'veil':
      p.rect(headX - 1, headY - 1, 8, 3, hc);
      p.rect(headX + 2, headY + 4, 5, 3, L.trim);
      break;
    case 'skull':
      p.rect(headX + 3, headY + 2, 2, 2, '#101010');
      p.rect(headX + 6, headY + 2, 1, 2, '#101010');
      p.rect(headX + 2, headY + 5, 5, 1, '#3a3428');
      break;
    case 'bald':
      p.rect(headX, headY, 7, 1, shade(L.skin, 0.15));
      break;
  }
  if (hs !== 'helm' && hs !== 'horned' && hs !== 'skull') {
    p.px(headX + 5, headY + 3, L.eye);
    if (hs !== 'hood') p.px(headX + 5, headY + 2, shade(L.skin, -0.1));
    if (hs === 'hood' && L.glow) p.px(headX + 3, headY + 3, L.glow);
  } else if (hs === 'skull' && L.glow) {
    p.px(headX + 3, headY + 2, L.glow);
  }
  if (L.extra === 'halo') p.ring(headX + 3, headY - 3, 3, '#fff0a0');
  if (L.extra === 'chains') {
    p.px(tx, torsoBot, '#a0a0a8');
    p.px(tx - 1, torsoBot + 1, '#808088');
    p.px(tx - 1, torsoBot + 2, '#a0a0a8');
  }
  // 앞쪽 팔 + 무기
  const af = P.af * D;
  const fhx = sxF + Math.cos(af) * armLen;
  const fhy = shoulderY + Math.sin(af) * armLen;
  p.bar(sxF, shoulderY, af, armLen, 2, L.weapon === 'fists' ? L.skin : L.body);
  p.px(sxF, shoulderY, L.trim);
  drawWeapon(p, L, fhx, fhy, P.w, false);
  if (L.weapon !== 'fists' && L.weapon !== 'bow') p.px(fhx, fhy, L.skin);
  p.finish();
  return p.c;
}
