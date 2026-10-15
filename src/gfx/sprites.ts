import type { Look, PoseName } from '../game/types';
import { CHAR_MAP } from '../data/characters';
import { drawHumanoid } from './humanoid';
import { Pix, shade, silhouette } from './pixel';
import { drawCreature } from './creatures';
import { STORY_LOOKS } from './looks2';
import { ENEMY_MAP } from '../data/enemies';

/** 모든 스프라이트는 최초 요청 시 코드로 그려 오프스크린 캔버스에 캐싱된다. */
const cache = new Map<string, HTMLCanvasElement>();
const whiteCache = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>();
const tintCache = new Map<string, WeakMap<HTMLCanvasElement, HTMLCanvasElement>>();

export function lookFrame(key: string, look: Look, pose: PoseName): HTMLCanvasElement {
  const k = `${key}|${pose}`;
  let c = cache.get(k);
  if (!c) {
    c = drawHumanoid(look, pose);
    cache.set(k, c);
  }
  return c;
}

export function charFrame(id: string, pose: PoseName): HTMLCanvasElement {
  return lookFrame(`c:${id}`, CHAR_MAP[id].look, pose);
}

export function white(c: HTMLCanvasElement): HTMLCanvasElement {
  let w = whiteCache.get(c);
  if (!w) {
    w = silhouette(c, '#ffffff');
    whiteCache.set(c, w);
  }
  return w;
}

export function tinted(c: HTMLCanvasElement, col: string): HTMLCanvasElement {
  let m = tintCache.get(col);
  if (!m) {
    m = new WeakMap();
    tintCache.set(col, m);
  }
  let t = m.get(c);
  if (!t) {
    t = silhouette(c, col);
    m.set(c, t);
  }
  return t;
}

// ───────────── 인간형 적 외형 ─────────────
const bone = '#e8e0c8';
export const ENEMY_LOOKS: Record<string, Look> = {
  skeleton: { skin: bone, hair: bone, hairStyle: 'skull', body: '#d8d0b8', trim: '#8a7a5a', legs: '#d0c8b0', boots: '#a8a088', eye: '#ff4a2a', weapon: 'sword', wcol: '#9a8a70', wcol2: '#5a4a3a', build: 'slim', glow: '#ff4a2a' },
  bone_archer: { skin: bone, hair: bone, hairStyle: 'skull', body: '#c8c0a8', trim: '#5a7a4a', legs: '#c8c0a8', boots: '#989078', eye: '#ffb02a', weapon: 'bow', wcol: '#7a5a3a', wcol2: '#c8c0a8', build: 'slim', glow: '#ffb02a', cape: '#3a4a2a' },
  bone_shield: { skin: bone, hair: bone, hairStyle: 'skull', body: '#b8b098', trim: '#6a5a4a', legs: '#c8c0a8', boots: '#888070', eye: '#ff4a2a', weapon: 'mace', wcol: '#8a8a8a', wcol2: '#5a4a3a', shield: '#7a6a50', build: 'normal', glow: '#ff4a2a' },
  smith_skel: { skin: bone, hair: bone, hairStyle: 'skull', body: '#5a3a2a', trim: '#ff8a3a', legs: '#c8b8a0', boots: '#4a2a1a', eye: '#ff8a2a', weapon: 'hammer', wcol: '#6a6a72', wcol2: '#4a3020', build: 'normal', glow: '#ff8a2a' },
  royal_guard: { skin: '#a0a0b0', hair: '#7a7aa0', hairStyle: 'helm', body: '#6a6a90', trim: '#c0a060', legs: '#4a4a6a', boots: '#2a2a3a', eye: '#c0a0ff', weapon: 'mace', wcol: '#b0b0c8', wcol2: '#5a4a3a', shield: '#c0a060', build: 'big', cape: '#3a1a4a' },
  shade: { skin: '#2a1a3a', hair: '#1a1028', hairStyle: 'hood', body: '#1a1028', trim: '#6a4aaa', legs: '#140c20', boots: '#0c0814', eye: '#c0a0ff', weapon: 'daggers', wcol: '#6a5a9a', wcol2: '#2a1a3a', build: 'slim', cape: '#1a1028', glow: '#c0a0ff', extra: 'scarf' },
  shadow_mage: { skin: '#3a2a4a', hair: '#2a1a4a', hairStyle: 'hood', body: '#2a1a4a', trim: '#a080ff', legs: '#1a1030', boots: '#100820', eye: '#c0a0ff', weapon: 'staff', wcol: '#a080ff', wcol2: '#3a2a4a', build: 'slim', cape: '#20103a', glow: '#c0a0ff' },
  royal_lancer: { skin: '#a0a0b0', hair: '#8a7a50', hairStyle: 'helm', body: '#8a7a50', trim: '#e0c070', legs: '#5a4a30', boots: '#2a2018', eye: '#ffe060', weapon: 'spear', wcol: '#d0d0e0', wcol2: '#5a4030', build: 'normal', cape: '#6a1a1a' },
  drowned: { skin: '#8ab0a0', hair: '#3a5a6a', hairStyle: 'short', body: '#4a6a7a', trim: '#c0a060', legs: '#3a4a5a', boots: '#2a3038', eye: '#e0ffe0', weapon: 'sword', wcol: '#a0b0b0', wcol2: '#5a4a3a', build: 'normal', extra: 'scarf' },
  harpooner: { skin: '#8ab0a0', hair: '#c0c8c8', hairStyle: 'bald', body: '#5a4a3a', trim: '#80c0e0', legs: '#3a3a42', boots: '#2a2a30', eye: '#e0ffe0', weapon: 'spear', wcol: '#c0d0d8', wcol2: '#6a5030', build: 'big' },
  frost_librarian: { skin: '#c0d8f0', hair: '#e0f0ff', hairStyle: 'hood', body: '#3a5a8a', trim: '#a8e4ff', legs: '#2a3a5a', boots: '#1a2438', eye: '#a8e4ff', weapon: 'staff', wcol: '#a8e4ff', wcol2: '#4a5a7a', build: 'big', cape: '#2a4a7a', glow: '#a8e4ff' },
  ink_shade: { skin: '#1a2040', hair: '#101830', hairStyle: 'hood', body: '#14203a', trim: '#4a6aff', legs: '#0c1428', boots: '#080c18', eye: '#80a0ff', weapon: 'daggers', wcol: '#4a6aff', wcol2: '#1a2040', build: 'slim', cape: '#14203a', glow: '#80a0ff', extra: 'scarf' },
  void_knight: { skin: '#2a1a3a', hair: '#3a2a5a', hairStyle: 'helm', body: '#3a2a5a', trim: '#ff80d0', legs: '#24183a', boots: '#140c24', eye: '#ff80d0', weapon: 'mace', wcol: '#c0a0ff', wcol2: '#2a1a3a', shield: '#6a4aa0', build: 'big', cape: '#2a1030' },
  morten: { skin: '#8ab0a0', hair: '#1a2028', hairStyle: 'witch', body: '#1a3048', trim: '#e0c060', legs: '#14202e', boots: '#0c141c', eye: '#80ffe0', weapon: 'hammer', wcol: '#6a7a80', wcol2: '#4a3a2a', build: 'big', cape: '#3a1a1a', glow: '#80ffe0', extra: 'chains' },
  libra: { skin: '#e8f0ff', hair: '#c0e8ff', hairStyle: 'long', body: '#2a4a7a', trim: '#a8e4ff', legs: '#1a2a4a', boots: '#10182c', eye: '#a8e4ff', weapon: 'clock', wcol: '#e0f4ff', wcol2: '#5a6a9a', build: 'slim', cape: '#4a6aa0', glow: '#a8e4ff', extra: 'halo' },
  oblivion: { skin: '#2a1028', hair: '#ff80d0', hairStyle: 'crown', body: '#14081c', trim: '#ff80d0', legs: '#0c0412', boots: '#06020a', eye: '#ffffff', weapon: 'greatsword', wcol: '#ff80d0', wcol2: '#3a1a3a', build: 'big', glow: '#ff80d0', cape: '#3a0a2a', extra: 'wings' },
  graven: { skin: bone, hair: bone, hairStyle: 'skull', body: '#3a3448', trim: '#80e0ff', legs: '#2a2438', boots: '#1a1828', eye: '#80e0ff', weapon: 'shovel', wcol: '#8a8a7a', wcol2: '#4a3a2a', build: 'big', glow: '#80e0ff', cape: '#2a2438', extra: 'chains' },
  ...STORY_LOOKS,
  king: { skin: '#c8b8d0', hair: '#e0e0f0', hairStyle: 'crown', body: '#2a1a3a', trim: '#e0b040', legs: '#1a1028', boots: '#100818', eye: '#ff4ab0', weapon: 'greatsword', wcol: '#c8a8ff', wcol2: '#e0b040', build: 'big', glow: '#c8a8ff', cape: '#6a0a2a' },
};

// ───────────── 비인간형 적 그리기 ─────────────
type Drawer = (p: Pix, anim: string, f: number) => void;

const DRAW: Record<string, Drawer> = {
  wraith(p, anim, f) {
    const cx = 24;
    const cy = 30 + Math.round(Math.sin(f * 1.6) * 1);
    const body = '#80c8e0';
    const hi = '#d0f4ff';
    const raise = anim === 'wind' ? -4 : anim === 'atk' ? 3 : 0;
    p.ellipse(cx, cy - 4, 6, 7, body);
    for (let i = 0; i < 8; i++) {
      const w = 6 - i * 0.6;
      p.rect(cx - w + Math.sin(f + i * 0.8) * 1.5, cy + 2 + i, w * 2, 1, i % 2 ? body : shade(body, -0.2));
    }
    p.ellipse(cx, cy - 7, 4, 3, hi);
    p.rect(cx + 1, cy - 6, 2, 2, '#102030');
    p.rect(cx - 3, cy - 6, 2, 2, '#102030');
    p.px(cx + 2, cy - 6, anim === 'wind' ? '#ff4040' : '#80ffff');
    p.px(cx - 2, cy - 6, anim === 'wind' ? '#ff4040' : '#80ffff');
    p.line(cx + 5, cy - 2, cx + 10, cy - 4 + raise, body);
    p.line(cx - 5, cy - 2, cx - 9, cy - 4 + raise, body);
    p.px(cx + 11, cy - 5 + raise, hi);
    if (anim === 'hurt') p.rect(cx - 6, cy - 10, 12, 2, '#ffffff');
  },
  slime(p, anim, f) {
    const sq = anim === 'wind' ? 3 : anim === 'atk' ? -3 : Math.round(Math.sin(f * 1.5));
    const rx = 9 + sq;
    const ry = 7 - sq;
    const cy = 44 - ry;
    const c = '#8bdc3a';
    p.ellipse(24, cy, rx, ry, c);
    p.ellipse(24, cy + 2, rx - 1, ry - 2, shade(c, -0.15));
    p.ellipse(21, cy - 3, 3, 2, '#d0ff90');
    p.rect(25, cy - 2, 2, 3, '#203010');
    p.rect(29, cy - 2, 2, 3, '#203010');
    p.px(19, cy + 2, '#5a9a20');
    p.px(28, cy + 4, '#5a9a20');
    p.rect(24, cy + 2, 6, 1, anim === 'wind' ? '#ff4040' : '#305010');
  },
  venom_bug(p, anim, f) {
    const c = '#90b040';
    const d = '#506020';
    const up = anim === 'wind' ? -3 : 0;
    for (let i = 0; i < 3; i++) p.ellipse(16 + i * 6, 39, 4, 3, i % 2 ? c : shade(c, -0.1));
    p.ellipse(34, 37 + up, 4, 3, shade(c, 0.1));
    p.px(36, 36 + up, '#ff3030');
    p.line(37, 37 + up, 41, 35 + up, d);
    p.line(37, 38 + up, 41, 40 + up, d);
    for (let i = 0; i < 4; i++) {
      const k = (f + i) % 2;
      p.line(14 + i * 5, 41, 12 + i * 5 + k * 2, 44, d);
    }
    for (let i = 0; i < 3; i++) p.px(15 + i * 6, 36, '#e0ff80');
    if (anim === 'atk') p.line(10, 39, 6, 37, '#c0ff60');
  },
  spore_cap(p, anim, f) {
    const puff = anim === 'wind' ? 2 : anim === 'atk' ? -1 : Math.round(Math.sin(f) * 0.6);
    p.rect(21, 34, 6, 10, '#e0d0b0');
    p.rect(22, 34, 2, 10, '#f8f0d8');
    p.ellipse(24, 30 - puff, 10 + puff, 6 + puff, '#c050a0');
    p.ellipse(24, 28 - puff, 8, 3, '#e070c0');
    p.disc(19, 28 - puff, 1, '#f8e0f0');
    p.disc(27, 26 - puff, 1, '#f8e0f0');
    p.disc(29, 30 - puff, 1, '#f8e0f0');
    p.rect(25, 37, 1, 2, '#302020');
    p.rect(22, 37, 1, 2, '#302020');
    if (anim === 'wind') for (let i = 0; i < 4; i++) p.px(16 + i * 5, 20 - (f % 3), '#c0f060');
  },
  moth(p, anim, f) {
    const flap = f % 2 === 0 ? -4 : 2;
    const w = '#e0c060';
    p.ellipse(24, 30, 2, 6, '#806030');
    p.line(24, 28, 13, 22 + flap, w);
    p.line(24, 30, 12, 26 + flap, w);
    p.ellipse(16, 25 + flap / 2, 5, 4, w);
    p.ellipse(32, 25 + flap / 2, 5, 4, w);
    p.disc(16, 25 + flap / 2, 1, '#a04020');
    p.disc(32, 25 + flap / 2, 1, '#a04020');
    p.ellipse(19, 34, 3, 3, shade(w, -0.2));
    p.ellipse(29, 34, 3, 3, shade(w, -0.2));
    p.px(25, 25, anim === 'wind' ? '#ff3030' : '#202020');
    p.line(24, 24, 22, 20, '#806030');
    p.line(24, 24, 27, 20, '#806030');
    if (anim === 'atk') for (let i = 0; i < 5; i++) p.px(20 + i * 2, 38 + (i % 2) * 2, '#c0f060');
  },
  fire_sprite(p, anim, f) {
    const cy = 30 + Math.round(Math.sin(f * 1.3));
    const k = anim === 'wind' ? 2 : 0;
    p.ellipse(24, cy, 6 + k, 7 + k, '#ff6a1a');
    p.ellipse(24, cy + 1, 4 + k, 5 + k, '#ffb02a');
    p.ellipse(24, cy + 2, 2, 3, '#fff0a0');
    for (let i = 0; i < 4; i++) p.px(20 + i * 3 + ((f + i) % 2), cy - 8 - ((f + i) % 3) - k, i % 2 ? '#ff8a2a' : '#ffd040');
    p.rect(21, cy - 2, 2, 2, '#401000');
    p.rect(26, cy - 2, 2, 2, '#401000');
  },
  magma_golem(p, anim, f) {
    const arm = anim === 'wind' ? -12 : anim === 'atk' ? 6 : Math.round(Math.sin(f) * 1);
    const r = '#5a3a30';
    const rh = '#7a5a48';
    p.rect(14, 22, 20, 16, r);
    p.rect(14, 22, 20, 2, rh);
    p.rect(17, 38, 5, 6, r);
    p.rect(27, 38, 5, 6, r);
    p.rect(18, 15, 12, 8, rh);
    p.rect(21, 18, 2, 2, '#ffd040');
    p.rect(26, 18, 2, 2, '#ffd040');
    p.line(18, 26, 24, 32, '#ff6a1a');
    p.line(24, 32, 30, 27, '#ff6a1a');
    p.line(22, 34, 26, 37, '#ffa02a');
    p.rect(8, 22 + arm, 6, 12, r);
    p.rect(34, 22 + arm, 6, 12, r);
    p.rect(7, 32 + arm, 8, 5, rh);
    p.rect(33, 32 + arm, 8, 5, rh);
    p.px(36, 28 + arm, '#ff6a1a');
    p.px(10, 27 + arm, '#ff6a1a');
  },
  forge_hound(p, anim, f) {
    const run = anim === 'move' || anim === 'atk' ? f % 2 : 0;
    const c = '#4a3028';
    p.rect(14, 33, 18, 7, c);
    p.rect(30, 29, 8, 7, c);
    p.rect(36, 32, 4, 3, shade(c, 0.1));
    p.px(34, 31, anim === 'wind' ? '#ffffff' : '#ffd040');
    p.rect(16, 40, 2, 4 - run, c);
    p.rect(20, 40, 2, 4 - (1 - run), c);
    p.rect(27, 40, 2, 4 - run, c);
    p.rect(30, 40, 2, 4 - (1 - run), c);
    for (let i = 0; i < 6; i++) p.px(15 + i * 3, 31 - ((f + i) % 2), i % 2 ? '#ff8a2a' : '#ffd040');
    p.line(14, 34, 9, 30 - run, '#ff6a1a');
    p.px(38, 36, '#e0e0e0');
  },
  gull(p, anim, f) {
    const flap = f % 2 === 0 ? -5 : 2;
    const c = '#d0e0f0';
    p.ellipse(24, 30, 6, 3, c);
    p.line(22, 29, 13, 25 + flap, c);
    p.line(26, 29, 35, 25 + flap, c);
    p.line(21, 30, 15, 27 + flap, shade(c, -0.2));
    p.line(27, 30, 33, 27 + flap, shade(c, -0.2));
    p.rect(29, 28, 3, 2, '#e0a040');
    p.px(28, 28, anim === 'wind' ? '#ff3030' : '#203040');
    p.rect(17, 30, 3, 2, shade(c, -0.3));
    for (let i = 0; i < 3; i++) p.px(18 + i * 4, 34 + ((f + i) % 2), '#a0c0e0');
  },
  crab(p, anim, f) {
    const c = '#d05a3a';
    const up = anim === 'wind' ? -4 : anim === 'atk' ? 2 : 0;
    p.ellipse(24, 38, 9, 5, c);
    p.ellipse(24, 36, 7, 2, shade(c, 0.2));
    p.px(21, 33, '#101010');
    p.px(27, 33, '#101010');
    p.line(21, 34, 20, 31, c);
    p.line(27, 34, 28, 31, c);
    p.rect(32, 30 + up, 7, 9, shade(c, 0.1));
    p.rect(33, 31 + up, 5, 7, '#e0a080');
    p.rect(9, 32, 6, 7, c);
    for (let i = 0; i < 3; i++) {
      const k = (f + i) % 2;
      p.line(17 + i * 3, 41, 15 + i * 3 - k, 44, shade(c, -0.3));
      p.line(29 + i * 2, 41, 31 + i * 2 + k, 44, shade(c, -0.3));
    }
  },
  tome(p, anim, f) {
    const cy = 30 + Math.round(Math.sin(f * 1.4));
    const open = anim === 'wind' ? 6 : 3;
    p.rect(16, cy - 5, 8, 10, '#3a5a8a');
    p.rect(24, cy - 5, 8, 10, '#3a5a8a');
    p.rect(17, cy - 4 - open / 3, 7, 8, '#e8f0ff');
    p.rect(24, cy - 4 - open / 3, 7, 8, '#e8f0ff');
    for (let i = 0; i < 3; i++) {
      p.rect(18, cy - 2 + i * 2, 5, 1, '#8aa0c0');
      p.rect(25, cy - 2 + i * 2, 5, 1, '#8aa0c0');
    }
    p.rect(23, cy - 5, 2, 11, '#a8e4ff');
    if (anim === 'wind') for (let i = 0; i < 4; i++) p.px(20 + i * 3, cy - 10 - (f % 3), '#a8e4ff');
  },
  mimic(p, anim, f) {
    const jaw = anim === 'wind' ? 5 : anim === 'atk' ? 3 + (f % 2) * 2 : 1;
    const c = '#7a4a2a';
    p.rect(13, 28, 22, 16, c);
    p.rect(13, 28 - jaw, 22, 4, shade(c, 0.15));
    for (let i = 0; i < 4; i++) p.rect(15 + i * 5, 33, 4, 9, ['#a03030', '#305090', '#a08030', '#307040'][i]);
    for (let i = 0; i < 5; i++) {
      p.px(15 + i * 4, 32 - jaw + 3, '#f0f0e0');
      p.px(15 + i * 4, 32, '#f0f0e0');
    }
    p.px(18, 26 - jaw, '#ff3030');
    p.px(29, 26 - jaw, '#ff3030');
    p.rect(14, 44, 3, 2 - (f % 2), c);
    p.rect(31, 44, 3, 2 - ((f + 1) % 2), c);
  },
  void_eye(p, anim, f) {
    const cy = 30 + Math.round(Math.sin(f * 1.3));
    p.disc(24, cy, 8, '#3a1a4a');
    p.disc(24, cy, 6, '#f0e0f0');
    p.disc(24 + (anim === 'wind' ? 0 : 1), cy, 3, anim === 'wind' ? '#ff3030' : '#ff80d0');
    p.disc(24 + (anim === 'wind' ? 0 : 1), cy, 1, '#100010');
    for (let i = 0; i < 5; i++) p.line(24, cy + 6, 18 + i * 3 + ((f + i) % 2), cy + 14, '#6a3a8a');
  },
  devourer(p, anim, f) {
    const sq = anim === 'wind' ? 3 : anim === 'atk' ? -3 : Math.round(Math.sin(f * 1.5));
    const rx = 10 + sq;
    const ry = 8 - sq;
    const cy = 44 - ry;
    p.ellipse(24, cy, rx, ry, '#7a2a7a');
    p.ellipse(24, cy + 1, rx - 2, ry - 2, '#a040a0');
    p.rect(17, cy, 14, 3, '#200010');
    for (let i = 0; i < 6; i++) p.px(18 + i * 2, cy, '#f0e0f0');
    p.px(19, cy - 4, '#ff80d0');
    p.px(29, cy - 4, '#ff80d0');
    p.px(24, cy - 5, '#ff80d0');
  },
  lost_soul(p, anim, f) {
    const cy = 30 + Math.round(Math.sin(f * 1.5));
    p.ellipse(24, cy - 2, 5, 6, '#e0c0ff');
    for (let i = 0; i < 6; i++) p.rect(20 + Math.sin(f + i) * 1.5, cy + 3 + i, 8 - i, 1, i % 2 ? '#c0a0ff' : '#e0c0ff');
    p.rect(22, cy - 3, 1, 2, anim === 'wind' ? '#ff3030' : '#4a2a6a');
    p.rect(26, cy - 3, 1, 2, anim === 'wind' ? '#ff3030' : '#4a2a6a');
    p.rect(23, cy + 1, 3, 1, '#4a2a6a');
  },
  dummy(p, anim, f) {
    const tilt = anim === 'hurt' ? 2 : 0;
    p.rect(23, 26, 2, 18, '#7a5a3a');
    p.rect(14 + tilt, 28, 20, 2, '#7a5a3a');
    p.ellipse(24 + tilt, 30, 6, 8, '#d0b070');
    p.disc(24 + tilt, 19, 4, '#e0c080');
    p.rect(22 + tilt, 18, 1, 1, '#302010');
    p.rect(26 + tilt, 18, 1, 1, '#302010');
    p.rect(19 + tilt, 30, 10, 1, '#a08040');
    p.rect(19 + tilt, 34, 10, 1, '#a08040');
    p.ring(24 + tilt, 30, 3, '#c03030');
    void f;
  },
};

const HUMANOID_ANIM: Record<string, Record<string, PoseName>> = {
  default: { wind: 'windHigh', atk: 'slashDown', hurt: 'hurt' },
  bone_archer: { wind: 'shootWind', atk: 'shoot', hurt: 'hurt' },
  shadow_mage: { wind: 'castUp', atk: 'cast', hurt: 'hurt' },
  royal_lancer: { wind: 'thrustWind', atk: 'thrust', hurt: 'hurt' },
  royal_guard: { wind: 'windHigh', atk: 'slashDown', hurt: 'hurt', block: 'guard' },
  harpooner: { wind: 'windHigh', atk: 'throw', hurt: 'hurt' },
  frost_librarian: { wind: 'slamWind', atk: 'slam', hurt: 'hurt' },
  ink_shade: { wind: 'thrustWind', atk: 'thrust', hurt: 'hurt' },
  void_knight: { wind: 'windHigh', atk: 'slashDown', hurt: 'hurt', block: 'guard' },
  bone_shield: { wind: 'windHigh', atk: 'slashDown', hurt: 'hurt', block: 'guard' },
  shade: { wind: 'thrustWind', atk: 'thrust', hurt: 'hurt' },
};

/** AI 유형별 기본 공격 포즈 (HUMANOID_ANIM에 없는 인간형 적) */
const AI_ANIM: Record<string, Record<string, PoseName>> = {
  archer: { wind: 'shootWind', atk: 'shoot', hurt: 'hurt' },
  caster: { wind: 'castUp', atk: 'cast', hurt: 'hurt' },
  turret: { wind: 'castUp', atk: 'cast', hurt: 'hurt' },
  lancer: { wind: 'thrustWind', atk: 'thrust', hurt: 'hurt' },
  teleporter: { wind: 'thrustWind', atk: 'thrust', hurt: 'hurt' },
  shield: { wind: 'windHigh', atk: 'slashDown', hurt: 'hurt', block: 'guard' },
  golem: { wind: 'slamWind', atk: 'slam', hurt: 'hurt' },
};

/** 적 프레임: anim = idle|move|wind|atk|hurt|block, f = 프레임 번호 */
export function enemyFrame(id: string, anim: string, f: number): HTMLCanvasElement {
  const look = ENEMY_LOOKS[id];
  if (look) {
    let pose: PoseName;
    if (anim === 'idle') pose = f % 2 ? 'idle1' : 'idle0';
    else if (anim === 'move') pose = (['run0', 'run1', 'run2', 'run3', 'run4', 'run5'] as PoseName[])[f % 6];
    else {
      const m = HUMANOID_ANIM[id] ?? AI_ANIM[ENEMY_MAP[id]?.ai ?? ''] ?? HUMANOID_ANIM.default;
      pose = m[anim] ?? HUMANOID_ANIM.default[anim] ?? 'idle0';
    }
    return lookFrame(`e:${id}`, look, pose);
  }
  const ff = anim === 'idle' || anim === 'move' ? f % 4 : 0;
  const k = `e:${id}|${anim}|${ff}`;
  let c = cache.get(k);
  if (!c) {
    const p = new Pix(48, 48);
    if (!drawCreature(p, id, anim, ff)) (DRAW[id] ?? DRAW.dummy)(p, anim, ff);
    p.finish();
    c = p.c;
    cache.set(k, c);
  }
  return c;
}

// ───────────── 보스 (비인간형) ─────────────
export function mycoraFrame(anim: string, f: number): HTMLCanvasElement {
  const ff = f % 4;
  const k = `b:mycora|${anim}|${ff}`;
  let c = cache.get(k);
  if (c) return c;
  const p = new Pix(48, 48, 0.5);
  const sq = anim === 'wind' ? 4 : anim === 'atk' ? -4 : Math.round(Math.sin(ff * 1.57) * 2);
  // 몸체 (슬라임)
  p.ellipse(48, 78 - sq / 2, 30 + sq, 14 - sq / 2, '#4a8a2a');
  p.ellipse(48, 76 - sq / 2, 26 + sq, 10, '#6ab03a');
  // 줄기
  p.rect(38, 44, 20, 32, '#d8c8a8');
  p.rect(40, 44, 6, 32, '#f0e4c8');
  // 갓
  p.ellipse(48, 38 - sq, 38 + sq, 18, '#9a2a7a');
  p.ellipse(48, 34 - sq, 32, 11, '#c050a0');
  p.ellipse(42, 30 - sq, 12, 4, '#e070c0');
  for (const [x, y, r] of [[28, 34, 3], [46, 26, 4], [64, 32, 3], [56, 42, 2], [34, 44, 2], [72, 42, 2]]) p.disc(x, y - sq, r, '#f8e0f0');
  // 얼굴
  const eye = anim === 'wind' ? '#ff3030' : '#ffe040';
  p.rect(40, 56, 4, 4, '#200a10');
  p.rect(52, 56, 4, 4, '#200a10');
  p.px(41, 57, eye);
  p.px(53, 57, eye);
  p.rect(42, 66, 12, 3, '#300a10');
  for (let i = 0; i < 6; i++) p.px(43 + i * 2, 66, '#e0e0c0');
  // 균사
  for (let i = 0; i < 6; i++) p.line(20 + i * 11, 88, 18 + i * 11 + ((ff + i) % 2) * 3, 94, '#6ab03a');
  p.finish();
  c = p.c;
  cache.set(k, c);
  return c;
}

export function ignisFrame(anim: string, f: number, phase2: boolean): HTMLCanvasElement {
  const ff = f % 4;
  const k = `b:ignis|${anim}|${ff}|${phase2 ? 1 : 0}`;
  let c = cache.get(k);
  if (c) return c;
  const p = new Pix(56, 56, 0.5);
  const arm = anim === 'wind' ? -18 : anim === 'atk' ? 10 : Math.round(Math.sin(ff * 1.57) * 2);
  const r = '#4a2a24';
  const rh = '#6a4034';
  const rl = '#2a1410';
  // 다리
  p.rect(36, 82, 14, 26, r);
  p.rect(62, 82, 14, 26, r);
  p.rect(34, 102, 18, 6, rl);
  p.rect(60, 102, 18, 6, rl);
  // 몸통
  p.rect(28, 40, 56, 44, r);
  p.rect(28, 40, 56, 4, rh);
  p.rect(32, 46, 48, 34, rh);
  // 용광로 핵
  const core = phase2 ? '#fff0a0' : '#ffa02a';
  p.disc(56, 62, 10, '#3a0a04');
  p.disc(56, 62, 8, '#ff5a1a');
  p.disc(56, 62, 5, core);
  if (phase2) for (let i = 0; i < 8; i++) p.line(56, 62, 56 + Math.cos(i * 0.785) * 14, 62 + Math.sin(i * 0.785) * 14, '#ffb02a');
  // 균열
  p.line(32, 50, 44, 58, '#ff6a1a');
  p.line(80, 48, 70, 56, '#ff6a1a');
  p.line(40, 78, 52, 72, '#ff8a2a');
  // 머리
  p.rect(42, 20, 28, 22, rh);
  p.rect(42, 20, 28, 3, '#8a5a44');
  p.rect(46, 28, 6, 4, '#200804');
  p.rect(60, 28, 6, 4, '#200804');
  p.rect(47, 29, 4, 2, anim === 'wind' ? '#ffffff' : '#ffd040');
  p.rect(61, 29, 4, 2, anim === 'wind' ? '#ffffff' : '#ffd040');
  p.rect(48, 36, 16, 3, '#ff5a1a');
  for (let i = 0; i < 5; i++) p.rect(44 + i * 6, 14 - ((ff + i) % 3), 3, 6, i % 2 ? '#ff8a2a' : '#ffd040');
  // 팔 + 망치
  p.rect(12, 40 + arm, 16, 34, r);
  p.rect(84, 40 + arm, 16, 34, r);
  p.rect(10, 70 + arm, 20, 12, rh);
  p.rect(82, 70 + arm, 20, 12, rh);
  p.rect(100, 30 + arm, 6, 60, '#3a3030');
  p.rect(94, 20 + arm, 18, 16, '#5a5258');
  p.rect(94, 20 + arm, 18, 3, '#7a7278');
  p.finish();
  c = p.c;
  cache.set(k, c);
  return c;
}

// ───────────── 문(門), 상자, 시설 ─────────────
export function propSprite(kind: string, f = 0): HTMLCanvasElement {
  const k = `prop:${kind}:${f}`;
  let c = cache.get(k);
  if (c) return c;
  let p: Pix;
  switch (kind) {
    case 'door_closed':
    case 'door_open': {
      p = new Pix(28, 36);
      p.rect(2, 2, 24, 34, '#3a3048');
      p.rect(4, 4, 20, 32, kind === 'door_open' ? '#0a0612' : '#5a4030');
      p.rect(2, 0, 24, 4, '#6a6078');
      if (kind === 'door_closed') {
        for (let i = 0; i < 4; i++) p.rect(5 + i * 5, 4, 1, 32, '#3a2818');
        p.rect(4, 16, 20, 2, '#2a2030');
        p.disc(20, 22, 1, '#e0c060');
      } else {
        for (let i = 0; i < 6; i++) p.px(8 + ((i * 7) % 12), 10 + i * 4, '#4a3a6a');
      }
      break;
    }
    case 'chest':
    case 'chest_open': {
      p = new Pix(20, 16);
      p.rect(1, 5, 18, 11, '#7a4a20');
      p.rect(1, 9, 18, 2, '#e0b040');
      p.rect(8, 8, 4, 5, '#e0b040');
      if (kind === 'chest') {
        p.rect(1, 2, 18, 5, '#9a5a28');
        p.rect(1, 2, 18, 1, '#c07a38');
      } else {
        p.rect(1, 0, 18, 3, '#9a5a28');
        p.rect(3, 5, 14, 3, '#ffe080');
      }
      break;
    }
    case 'altar': {
      p = new Pix(40, 40);
      p.rect(6, 28, 28, 12, '#4a4458');
      p.rect(4, 26, 32, 3, '#6a6478');
      p.rect(10, 14, 20, 12, '#3a3448');
      p.disc(20, 10 + Math.round(Math.sin(f) * 1), 5, '#9ef0ff');
      p.disc(20, 10 + Math.round(Math.sin(f) * 1), 3, '#e0ffff');
      break;
    }
    case 'anvil': {
      p = new Pix(40, 40);
      p.rect(8, 22, 24, 6, '#5a5a62');
      p.rect(4, 20, 30, 3, '#7a7a82');
      p.rect(14, 28, 12, 8, '#4a4a52');
      p.rect(10, 36, 20, 4, '#3a3a42');
      for (let i = 0; i < 3; i++) p.rect(8 + i * 9, 6 + (i % 2) * 2, 2, 14, '#8a8a92');
      break;
    }
    case 'shopkeeper': {
      p = new Pix(40, 40);
      p.rect(2, 26, 36, 14, '#5a3a20');
      p.rect(2, 24, 36, 3, '#7a5a30');
      p.ellipse(20, 16, 6, 7, '#2a1a3a');
      p.rect(16, 12, 8, 6, '#e8e0c8');
      p.px(18, 14, '#ffb02a');
      p.px(22, 14, '#ffb02a');
      p.rect(14, 6, 12, 4, '#4a2a6a');
      p.disc(8, 20, 2, '#ff4a6a');
      p.disc(32, 20, 2, '#80c0ff');
      break;
    }
    case 'campfire': {
      p = new Pix(32, 32);
      p.rect(6, 26, 20, 3, '#5a3a20');
      p.line(8, 28, 24, 24, '#7a4a28');
      p.line(8, 24, 24, 28, '#7a4a28');
      const fl = f % 3;
      p.ellipse(16, 20 - fl, 5, 7, '#ff6a1a');
      p.ellipse(16, 21 - fl, 3, 5, '#ffb02a');
      p.ellipse(16, 23, 1, 2, '#fff0a0');
      break;
    }
    case 'question': {
      p = new Pix(32, 40);
      p.rect(10, 24, 12, 16, '#4a4458');
      p.disc(16, 14, 8, '#6a4a9a');
      p.rect(14, 8, 5, 2, '#f0e0ff');
      p.rect(18, 10, 2, 4, '#f0e0ff');
      p.rect(15, 14, 3, 2, '#f0e0ff');
      p.rect(15, 18, 3, 2, '#f0e0ff');
      break;
    }
    case 'sign': {
      p = new Pix(20, 20);
      p.rect(9, 10, 2, 10, '#5a3a20');
      p.rect(2, 3, 16, 9, '#8a6a3a');
      p.rect(4, 5, 12, 1, '#5a3a20');
      p.rect(4, 8, 9, 1, '#5a3a20');
      break;
    }
    case 'portal': {
      p = new Pix(40, 52);
      p.ellipse(20, 26, 14, 22, '#2a1a4a');
      p.ellipse(20, 26, 11, 19, '#6a3aaa');
      p.ellipse(20, 26, 7, 14, '#a080ff');
      for (let i = 0; i < 6; i++) p.px(14 + ((i * 5 + f) % 12), 10 + i * 6, '#ffffff');
      break;
    }
    case 'stele': {
      p = new Pix(32, 44);
      p.rect(6, 6, 20, 34, '#5a5468');
      p.rect(6, 4, 20, 4, '#7a7488');
      p.rect(4, 40, 24, 4, '#3a3448');
      for (let i = 0; i < 5; i++) p.rect(10, 12 + i * 5, 12, 1, '#e0c060');
      break;
    }
    case 'book': {
      p = new Pix(32, 40);
      p.rect(12, 18, 8, 22, '#5a3a20');
      p.rect(4, 12, 24, 8, '#8a2a2a');
      p.rect(6, 12, 9, 6, '#f0e8d0');
      p.rect(17, 12, 9, 6, '#f0e8d0');
      for (let i = 0; i < 3; i++) p.rect(7, 13 + i * 2, 7, 1, '#7a6a5a');
      break;
    }
    case 'banner': {
      p = new Pix(32, 44);
      p.rect(15, 0, 2, 44, '#5a3a20');
      p.rect(4, 4, 24, 26, '#3a5aa0');
      p.rect(4, 4, 24, 2, '#e0c060');
      p.disc(16, 16, 5, '#e0c060');
      p.rect(4, 30, 6, 4, '#3a5aa0');
      p.rect(22, 30, 6, 4, '#3a5aa0');
      break;
    }
    case 'crystal': {
      p = new Pix(32, 40);
      p.rect(8, 34, 16, 6, '#4a4458');
      p.line(16, 4, 9, 20, '#9ef0ff');
      p.line(16, 4, 23, 20, '#9ef0ff');
      p.line(9, 20, 16, 33, '#5ab0d0');
      p.line(23, 20, 16, 33, '#5ab0d0');
      for (let y = 6; y < 32; y++) {
        const w = y < 20 ? (y - 4) * 0.45 : (33 - y) * 0.5;
        p.rect(16 - w, y, w * 2, 1, y < 20 ? '#80d8f0' : '#5ab0d0');
      }
      p.line(14, 10, 12, 18, '#e0ffff');
      break;
    }
    default:
      p = new Pix(8, 8);
      p.rect(0, 0, 8, 8, '#ff00ff');
  }
  p.finish();
  c = p.c;
  cache.set(k, c);
  return c;
}
