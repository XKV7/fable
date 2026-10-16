import type { PoseName } from '../game/types';
import { POSES } from './humanoid';
import { OUTLINE, Pix } from './pixel';
import { CAELUS_FRAMES, CAELUS_SHEET } from './caelusSheet';

/**
 * ★7 전용 고해상도(2배 정밀) 스프라이트. 96×96 프레임, 발 y=88, 키 약 48픽셀.
 * 화면에는 다른 영웅과 같은 크기(48×48 칸)로 그려지지만 픽셀이 절반 크기라 더 섬세하다.
 * 얼굴·후드·별 나침반은 손으로 찍은 픽셀 맵, 몸·팔·다리·검은 기존 포즈 데이터(POSES)를 2배로 따른다.
 * 컨셉아트(카일루스): 검은 후드 + 흰 삼각 문양, 은발, 보라 눈, 흰 셔츠 위 검은 롱코트(흰·청 줄무늬, 보라 보석),
 * 흰 운동화, 푸른 별빛 장검, 등 뒤에 떠 있는 별의 나침반.
 */
export const HD = 2;
export const HD_FW = 96;
const FOOT = 88;

const C = {
  H: '#1a1828', // 후드
  h: '#2a283e',
  g: '#45436a', // 후드 테두리 빛
  W: '#f4f4ff', // 흰 문양
  w: '#b8b8d0',
  S: '#ecebf6', // 은발
  s: '#c6c6de',
  z: '#9696b8',
  F: '#f7ede9', // 피부
  f: '#e3cfd1',
  L: '#e6d8ff', // 눈
  E: '#9a6aff',
  e: '#4e2f9a',
  M: '#b07a86',
  B: '#f0c4cc',
  a: '#a8c4ff', // 나침반
  R: '#6a5ae0',
  p: '#8a5aff',
  V: '#b080ff',
  l: '#f0e0ff',
};

/** 얼굴 (오른쪽을 보는 3/4 정면, 20×20) */
const HEAD = [
  '......ghhhhg........',
  '....ghHHHWHHhg......',
  '...gHHHHWWwHHHhg....',
  '..gHHHHWWWWwHHHHg...',
  '.gHHHHHHHHHHHHHHHg..',
  '.HHHHHHzSSSSSSzHHHg.',
  'gHHHHHzSSSSsSSSSzHH.',
  'HHHHHzSSsSSSSsSSSSHh',
  'HHHHzSSSsSSSSSsSSSzH',
  'HHHHzSsSFsSSSFsSsSSH',
  'HHHHzsSFFFsSSFFFsSzH',
  'HHHHzSFFFFFFFFFFFSzH',
  'HHHHzSFFLEFFFFLEFsHh',
  'hHHHzsFFEeFFFFEeFszH',
  '.hHHHzFFeeFFFFeeFzH.',
  '.hHHHzFBFFFFFFFBFzH.',
  '..hHHzfFFFFMMFFFfzh.',
  '..hHHz.ffFFFFFFff.h.',
  '...hHz...ffffff..h..',
  '....hz..............',
];

/** 별의 나침반 (13×13) */
const COMPASS = [
  '......W......',
  '......a......',
  '.....aWa.....',
  '...p.aWa.p...',
  '....pRRRp....',
  '..aaRpVpRaa..',
  'WaWWRVlVRWWaW',
  '..aaRpVpRaa..',
  '....pRRRp....',
  '...p.aWa.p...',
  '.....aWa.....',
  '......a......',
  '......W......',
];

function stamp(p: Pix, map: string[], x: number, y: number): void {
  for (let r = 0; r < map.length; r++) {
    for (let c = 0; c < map[r].length; c++) {
      const k = map[r][c];
      if (k !== '.') p.px(x + c, y + r, C[k as keyof typeof C]);
    }
  }
}

const D = Math.PI / 180;

/** 두꺼운 팔다리 (코트 소매·바지) */
function limb(p: Pix, x0: number, y0: number, x1: number, y1: number, w: number, col: string): void {
  const len = Math.hypot(x1 - x0, y1 - y0);
  p.bar(x0, y0, Math.atan2(y1 - y0, x1 - x0), len, w, col);
}

function starblade(p: Pix, hx: number, hy: number, deg: number): void {
  const a = deg * D;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const at = (t: number): [number, number] => [hx + ca * t, hy + sa * t];
  // 손잡이 + 폼멜
  p.bar(hx, hy, a + Math.PI, 6, 2, '#2a2838');
  const [px0, py0] = at(-7);
  p.rect(px0 - 1, py0 - 1, 3, 3, '#c8c8e0');
  // 칼날: 바깥 → 안 → 심선, 끝은 가늘게
  p.bar(hx, hy, a, 32, 5, '#3a48a8', 4);
  p.bar(hx, hy, a, 33, 3, '#6a86ff', 4);
  p.bar(hx, hy, a, 31, 1, '#d8f4ff', 5);
  const [tx, ty] = at(35);
  p.px(tx, ty, '#ffffff');
  p.bar(...at(32), a, 3, 1, '#a8c4ff');
  // 가드: 넓은 은색 + 보라 보석
  const [gx, gy] = at(3);
  p.bar(gx, gy, a + Math.PI / 2, 6, 2, '#d0d0e8');
  p.bar(gx, gy, a - Math.PI / 2, 6, 2, '#d0d0e8');
  p.bar(gx, gy, a + Math.PI / 2, 6, 1, '#8a8ab0');
  p.rect(gx - 1, gy - 1, 3, 3, '#8a5aff');
  p.px(gx, gy - 1, '#f0e0ff');
  // 칼날 주위 반짝임
  for (const t of [12, 22, 30]) {
    const [sx, sy] = at(t);
    p.px(sx - sa * 4, sy + ca * 4, '#a8c4ff');
  }
}

/** 카일루스 한 포즈 */
function drawCaelus(pose: PoseName): HTMLCanvasElement {
  const P = POSES[pose];
  const p = new Pix(HD_FW, HD_FW);
  const cx = 48;
  const crouch = (P.crouch ?? 0) * HD;
  const legLen = 16 - crouch;
  const hipY = FOOT - legLen;
  const bob = P.bob > 0 ? Math.min(P.bob, 1) * HD : P.bob * HD;
  const torsoBot = hipY + bob;
  const torsoTop = torsoBot - 16;
  const lean = P.lean * HD;
  const tx = cx - 6 + Math.round(lean * 0.5);
  const tw = 12;
  const cape = P.cape ?? 0;

  // ── 뒤 코트 자락 (휘날림) + 보라 보석
  const flare = Math.round(cape * 14);
  const backX = tx - 2 - flare;
  const hemY = Math.min(FOOT - 3, torsoBot + 14 - Math.round(cape * 8));
  p.g.fillStyle = '#16141f';
  p.g.beginPath();
  p.g.moveTo(tx + 1, torsoTop + 4);
  p.g.lineTo(tx + 9, torsoBot + 2);
  p.g.lineTo(tx + 6, hemY);
  p.g.lineTo(backX - 2, hemY + 1);
  p.g.lineTo(backX, torsoBot - 2);
  p.g.closePath();
  p.g.fill();
  p.line(backX - 2, hemY + 1, tx + 6, hemY, '#6a86ff');
  p.line(backX, torsoBot - 2, backX - 2, hemY + 1, '#2c2a44');
  p.rect(backX + 2, hemY - 3, 3, 3, '#8a5aff');
  p.px(backX + 3, hemY - 3, '#f0e0ff');

  // ── 별의 나침반 (등 뒤 위)
  stamp(p, COMPASS, tx - 22, torsoTop - 16 - (P.bob > 0 ? 1 : 0));

  // ── 뒤 팔
  const shY = torsoTop + 4;
  const armLen = 12;
  const ab = P.ab * D;
  const bsx = tx + 2;
  const bhx = bsx + Math.cos(ab) * armLen;
  const bhy = shY + Math.sin(ab) * armLen;
  limb(p, bsx, shY, bhx, bhy, 4, '#13111c');
  p.rect(bhx - 1, bhy - 1, 3, 3, '#2a2838');

  // ── 다리 (검은 바지 + 흰 운동화)
  const hipF = cx + 2;
  const hipB = cx - 3;
  const ffx = cx + P.fl[0] * HD;
  const ffy = FOOT + P.fl[1] * HD;
  const bfx = cx - 2 + P.bl[0] * HD;
  const bfy = FOOT + P.bl[1] * HD;
  limb(p, hipB, hipY, bfx, bfy - 3, 4, '#100e18');
  p.rect(bfx - 2, bfy - 4, 7, 3, '#a8a8c0');
  p.rect(bfx - 2, bfy - 1, 7, 1, '#6a6a88');

  // ── 몸통: 흰 셔츠 위 검은 코트, 청·흰 줄무늬, 벨트
  p.rect(tx, torsoTop, tw, 16, '#1c1a2c');
  p.rect(tx + 4, torsoTop + 1, 4, 7, '#ecebf6');
  p.rect(tx + 5, torsoTop + 1, 2, 8, '#ffffff');
  p.px(tx + 6, torsoTop + 4, '#2a283e');
  p.rect(tx + 3, torsoTop, 6, 1, '#ffffff');
  p.rect(tx + 9, torsoTop + 1, 1, 14, '#6a86ff');
  p.rect(tx + 10, torsoTop + 1, 1, 14, '#dcdcee');
  p.rect(tx + 1, torsoTop + 2, 1, 12, '#2c2a44');
  p.rect(tx, torsoBot - 5, tw, 2, '#2c2a44');
  p.rect(tx + 5, torsoBot - 5, 2, 2, '#d0d0e8');
  p.rect(tx - 1, torsoTop + 1, 3, 4, '#2c2a44');
  p.rect(tx + tw - 2, torsoTop + 1, 3, 4, '#2c2a44');
  p.px(tx + tw - 1, torsoTop + 2, '#a8c4ff');

  // ── 앞 코트 자락
  for (let i = 0; i < 12; i++) {
    const y = torsoBot - 2 + i;
    const x0 = tx + 5 - Math.round(i * 0.2);
    const x1 = tx + tw + 1 + Math.round(i * (0.2 + cape * 0.4));
    p.rect(x0, y, x1 - x0, 1, i === 11 ? '#26244a' : '#1c1a2c');
    p.px(x1 - 1, y, '#dcdcee');
    p.px(x1 - 2, y, '#6a86ff');
  }

  // ── 앞다리
  limb(p, hipF, hipY + 3, ffx, ffy - 3, 4, '#15131f');
  p.rect(ffx - 2, ffy - 4, 8, 3, '#e8e8f4');
  p.rect(ffx - 2, ffy - 1, 8, 1, '#8a8ab0');
  p.px(ffx + 2, ffy - 4, '#6a86ff');

  // ── 머리
  const headX = cx - 9 + Math.round(lean);
  const headY = torsoTop - 18;
  stamp(p, HEAD, headX, headY);

  // ── 앞 팔 + 검
  const af = P.af * D;
  const fsx = tx + tw - 1;
  const fhx = fsx + Math.cos(af) * armLen;
  const fhy = shY + Math.sin(af) * armLen;
  limb(p, fsx, shY, fhx, fhy, 4, '#1c1a2c');
  const cuff = 0.75;
  p.rect(fsx + Math.cos(af) * armLen * cuff - 1, shY + Math.sin(af) * armLen * cuff - 1, 3, 3, '#dcdcee');
  starblade(p, fhx, fhy, P.w);
  p.rect(fhx - 1, fhy - 1, 3, 3, '#2a2838');

  p.outline(OUTLINE);
  return p.c;
}

/**
 * 컨셉아트에서 직접 잘라낸 시트 (카일루스). 게임 포즈 → 시트 프레임 이름.
 * 시트 이미지가 아직 안 불러와졌으면 손으로 찍은 픽셀 버전(drawCaelus)으로 대신 그리고 캐시하지 않는다.
 */
const CAELUS_POSE: Record<PoseName, string> = {
  idle0: 'idle0', idle1: 'idle2', crouch: 'crouch',
  run0: 'run0', run1: 'run1', run2: 'run2', run3: 'run3', run4: 'run0', run5: 'run1',
  jump: 'jump', fall: 'fall', dash: 'dash',
  hurt: 'hit1', guard: 'hit0', dead: 'die3',
  windHigh: 'attack0', slashDown: 'attack1', windLow: 'attack2', slashUp: 'attack3',
  thrustWind: 'attack4', thrust: 'attack5', spin: 'attack3', slamWind: 'attack0', slam: 'attack1',
  kick: 'attack5', uppercut: 'attack3', throw: 'attack5',
  cast: 'cast0', castUp: 'cast1', shootWind: 'cast0', shoot: 'cast1',
};
/** 반복 동작: 원본 칸 사이에 만든 사이 동작(이름에 '_')을 끼워 더 부드럽게 */
const CYCLES: Record<string, { frames: string[]; tick: number }> = {
  idle: { frames: ['idle0', 'idle1', 'idle2', 'idle3', 'idle4'], tick: 9 },
  run: { frames: ['run0', 'run0_1', 'run1', 'run1_2', 'run2', 'run2_3', 'run3', 'run3_0'], tick: 4 },
  walk: { frames: ['walk0', 'walk0_1', 'walk1', 'walk1_2', 'walk2', 'walk2_3', 'walk3', 'walk3_4', 'walk4'], tick: 5 },
  hurt: { frames: ['hit0', 'hit1', 'hit2', 'hit3', 'hit4'], tick: 4 },
  dead: { frames: ['hit1', 'hit_die', 'die0', 'die0_1', 'die1', 'die1_2', 'die2', 'die2_3', 'die3'], tick: 4 },
};
interface Sheet { img: HTMLImageElement; ok: boolean; frames: typeof CAELUS_FRAMES; pose: Record<PoseName, string> }
const SHEETS: Record<string, Sheet> = {};
function sheetOf(id: string): Sheet | null {
  if (id !== 'caelus' || typeof Image === 'undefined') return null;
  let s = SHEETS[id];
  if (!s) {
    const img = new Image();
    s = SHEETS[id] = { img, ok: false, frames: CAELUS_FRAMES, pose: CAELUS_POSE };
    img.onload = () => (s.ok = true);
    img.src = CAELUS_SHEET;
  }
  return s;
}

/** 전투 중 애니메이션 정보 (없으면 포즈의 대표 칸) */
export interface HDAnim {
  t: number; // 반복 동작 시계 (대기·달리기)
  since: number; // 지금 포즈가 시작된 뒤 지난 틱 (피격·쓰러짐 진행, 동작 전환)
  prev?: PoseName; // 바로 앞 포즈 (공격 칸 사이 동작)
  walk?: boolean; // 느리게 움직이는 중
}

function sheetFrameName(s: Sheet, pose: PoseName, an?: HDAnim): string {
  const base = s.pose[pose];
  if (!an) return base;
  const cyc = (k: string, t: number, loop = true): string => {
    const c = CYCLES[k];
    const i = Math.floor(t / c.tick);
    return c.frames[loop ? i % c.frames.length : Math.min(i, c.frames.length - 1)];
  };
  if (pose === 'idle0' || pose === 'idle1') return cyc('idle', an.t);
  if (pose.startsWith('run')) return cyc(an.walk ? 'walk' : 'run', an.t);
  if (pose === 'hurt') return cyc('hurt', an.since, false);
  if (pose === 'dead') return cyc('dead', an.since, false);
  // 공격·시전: 포즈가 막 바뀐 2틱 동안은 앞 칸 → 이 칸 사이 동작
  if (an.prev && an.since < 2) {
    const m = /^(attack|cast)(\d)$/.exec(base);
    const pm = /^(attack|cast)(\d)$/.exec(s.pose[an.prev]);
    if (m && pm && m[1] === pm[1] && +m[2] === +pm[2] + 1) {
      const k = `${pm[0]}_${m[2]}`;
      if (s.frames[k]) return k;
    }
  }
  return base;
}

function fromSheet(s: Sheet, name: string): HTMLCanvasElement {
  const f = s.frames[name] ?? s.frames.idle0;
  const c = document.createElement('canvas');
  c.width = c.height = HD_FW;
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  // 발 기준점(머리 아래 가장 낮은 점)을 96×96 칸의 (48, 88)에 맞춘다
  g.drawImage(s.img, f.x, f.y, f.w, f.h, HD_FW / 2 - f.ax, FOOT - f.ay, f.w, f.h);
  return c;
}

const DRAW: Record<string, (pose: PoseName) => HTMLCanvasElement> = { caelus: drawCaelus };
const cache = new Map<string, HTMLCanvasElement>();

/** 고해상도 스프라이트가 있는 영웅이면 96×96 프레임, 없으면 null. an을 주면 사이 동작·반복 동작까지 고른다 */
export function charFrameHD(id: string, pose: PoseName, an?: HDAnim): HTMLCanvasElement | null {
  const d = DRAW[id];
  if (!d) return null;
  const s = sheetOf(id);
  if (s && !s.ok) return d(pose === 'dead' ? 'hurt' : pose); // 시트 불러오는 중 (아주 잠깐)
  const name = s ? sheetFrameName(s, pose, an) : pose;
  const k = `${id}|${name}`;
  let c = cache.get(k);
  if (!c) {
    c = s ? fromSheet(s, name) : d(pose);
    cache.set(k, c);
  }
  return c;
}

const lowCache = new Map<string, HTMLCanvasElement>();
/**
 * 월드 해상도(48×48)용 그림: 컨셉아트 시트가 있는 영웅은 고해상도 칸을 면적 평균으로 절반 축소해
 * 잔상·거울 보스·타이틀 데모도 같은 모습으로 나오게 한다. 시트가 없거나 아직 불러오는 중이면 null.
 */
export function charFrameLow(id: string, pose: PoseName): HTMLCanvasElement | null {
  const s = sheetOf(id);
  if (!s || !s.ok) return null;
  const name = sheetFrameName(s, pose);
  const k = `${id}|${name}`;
  let c = lowCache.get(k);
  if (!c) {
    const hd = charFrameHD(id, pose)!;
    c = document.createElement('canvas');
    c.width = c.height = HD_FW / HD;
    const g = c.getContext('2d')!;
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.drawImage(hd, 0, 0, c.width, c.height);
    // 반투명 가장자리를 없애 픽셀 경계를 또렷하게
    const im = g.getImageData(0, 0, c.width, c.height);
    for (let i = 3; i < im.data.length; i += 4) im.data[i] = im.data[i] >= 110 ? 255 : 0;
    g.putImageData(im, 0, 0);
    lowCache.set(k, c);
  }
  return c;
}

/** 쓰러진 모습이 그림에 들어 있는 영웅(컨셉아트 시트): 회전 없이 'dead' 프레임을 쓴다 */
export const hasLyingFrame = (id: string): boolean => id === 'caelus';

export const hasHD = (id: string): boolean => !!DRAW[id];

/**
 * 고해상도 그리기 층: 월드(480×270)에 그리면 정밀도가 사라지므로,
 * 월드 좌표로 요청을 모아 두었다가 확대된 화면에 직접 그린다 (App.render).
 */
export interface HDDraw {
  img: HTMLCanvasElement;
  x: number; // 월드 화면 좌표 (카메라 적용 후), 48×48 칸의 왼쪽 위
  y: number;
  flip: boolean;
  alpha: number;
  rot?: { ox: number; oy: number; a: number }; // 회전 (쓰러짐)
}
export const hdQueue: HDDraw[] = [];

/**
 * 고해상도 스프라이트보다 위에 그려야 하는 월드 요소(투사체·앞 이펙트·예고·조명·화면 색조)를 받을 층.
 * App이 프레임마다 연결하고, 이번 프레임에 쓰였는지(used) 보고 고해상도 층 다음에 표시한다.
 */
export const hdTop: { ctx: CanvasRenderingContext2D | null; used: boolean } = { ctx: null, used: false };
/** 고해상도 그리기 요청이 있으면 위 층, 없으면 원래 월드 컨텍스트 */
export function worldAbove(g: CanvasRenderingContext2D): CanvasRenderingContext2D {
  if (!hdQueue.length || !hdTop.ctx) return g;
  hdTop.used = true;
  return hdTop.ctx;
}

export function drawHDQueue(d: CanvasRenderingContext2D, shakeX: number, shakeY: number): void {
  if (!hdQueue.length) return;
  d.save();
  d.imageSmoothingEnabled = false;
  for (const q of hdQueue) {
    d.save();
    d.globalAlpha = q.alpha;
    d.translate(Math.round(shakeX), Math.round(shakeY));
    if (q.rot) {
      d.translate(q.x + q.rot.ox, q.y + q.rot.oy);
      d.rotate(q.rot.a);
      if (q.flip) d.scale(-1, 1);
      d.drawImage(q.img, -24, -44 + 6, 48, 48);
    } else if (q.flip) {
      d.translate(q.x + 24, q.y);
      d.scale(-1, 1);
      d.drawImage(q.img, -24, 0, 48, 48);
    } else d.drawImage(q.img, q.x, q.y, 48, 48);
    d.restore();
  }
  d.restore();
  hdQueue.length = 0;
}


// 시트는 시작하자마자 미리 불러 둔다
sheetOf('caelus');
