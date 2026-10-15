import { Pix, shade } from './pixel';

/**
 * 스토리 2~4의 비인간형 적 그리기. 48×48 프레임, 발 y=44, 오른쪽을 향함.
 * 같은 생김새(kind)를 팔레트만 바꿔 여러 적이 나눠 쓴다.
 * anim: idle | move | wind | atk | hurt | block, f: 0~3
 */
export interface Pal {
  a: string; // 본색
  b: string; // 밝은 색
  c: string; // 어두운 색
  e: string; // 눈·강조색
}

type Draw = (p: Pix, pal: Pal, anim: string, f: number) => void;

const bob = (f: number, k = 1): number => Math.round(Math.sin(f * 1.57) * k);

const KINDS: Record<string, Draw> = {
  bat(p, c, anim, f) {
    const cy = 28 + bob(f, 2);
    const up = f % 2 === 0 ? -5 : 1;
    const dive = anim === 'atk' ? 3 : 0;
    p.ellipse(24, cy + dive, 4, 4, c.a);
    p.rect(22, cy - 6 + dive, 2, 3, c.a);
    p.rect(26, cy - 6 + dive, 2, 3, c.a);
    for (const s of [-1, 1]) {
      p.line(24 + s * 3, cy + dive, 24 + s * 12, cy - 2 + up + dive, c.c);
      p.line(24 + s * 12, cy - 2 + up + dive, 24 + s * 16, cy + 3 + up + dive, c.c);
      p.line(24 + s * 4, cy + 2 + dive, 24 + s * 14, cy + 4 + up + dive, c.a);
      p.line(24 + s * 12, cy - 1 + up + dive, 24 + s * 12, cy + 4 + up + dive, c.a);
    }
    p.px(23, cy - 1 + dive, anim === 'wind' ? '#ff3030' : c.e);
    p.px(26, cy - 1 + dive, anim === 'wind' ? '#ff3030' : c.e);
    p.px(25, cy + 2 + dive, c.b);
  },
  swarm(p, c, anim, f) {
    for (let i = 0; i < 5; i++) {
      const x = 14 + ((i * 7 + f * 3) % 20);
      const y = 20 + ((i * 11 + f * 2) % 16) + (anim === 'atk' ? 3 : 0);
      const up = (f + i) % 2 === 0 ? -2 : 1;
      p.rect(x - 1, y - 1, 3, 2, c.a);
      p.line(x - 1, y, x - 5, y + up, c.c);
      p.line(x + 1, y, x + 5, y + up, c.c);
      p.px(x, y - 1, anim === 'wind' ? '#ff3030' : c.e);
    }
  },
  scorpion(p, c, anim, f) {
    const run = anim === 'move' || anim === 'atk' ? f % 2 : 0;
    const tail = anim === 'wind' ? -4 : anim === 'atk' ? 6 : 0;
    p.ellipse(22, 38, 9, 4, c.a);
    p.ellipse(22, 37, 7, 2, c.b);
    for (let i = 0; i < 3; i++) {
      p.line(16 + i * 5, 40, 13 + i * 5, 44 - ((run + i) % 2), c.c);
      p.line(20 + i * 5, 40, 23 + i * 5, 44 - ((run + i + 1) % 2), c.c);
    }
    // 집게
    p.line(30, 37, 36, 34, c.a);
    p.rect(35, 32, 4, 3, c.b);
    p.px(39, 31, c.b);
    // 꼬리
    p.line(14, 37, 9, 30, c.a);
    p.line(9, 30, 12 + tail, 23, c.a);
    p.line(12 + tail, 23, 17 + tail, 22, c.a);
    p.rect(17 + tail, 21, 3, 3, c.e);
    p.px(29, 36, anim === 'wind' ? '#ff3030' : '#201010');
  },
  spider(p, c, anim, f) {
    const sq = anim === 'wind' ? 2 : anim === 'atk' ? -2 : bob(f);
    const cy = 37 + sq;
    p.ellipse(20, cy, 7, 5, c.a);
    p.ellipse(19, cy - 2, 4, 2, c.b);
    p.ellipse(29, cy + 1, 4, 3, c.c);
    for (let i = 0; i < 4; i++) {
      const k = (f + i) % 2;
      p.line(18 + i * 3, cy + 2, 12 + i * 5, cy - 4 + k, c.c);
      p.line(12 + i * 5, cy - 4 + k, 10 + i * 6, 44, c.c);
    }
    for (let i = 0; i < 3; i++) p.px(30 + (i % 2), cy - (i > 0 ? 1 : 0) + i, anim === 'wind' ? '#ff3030' : c.e);
    p.px(18, cy - 4, c.e);
    p.px(22, cy - 3, c.e);
  },
  gargoyle(p, c, anim, f) {
    const cy = 28 + bob(f, 2);
    const flap = f % 2 === 0 ? -6 : 0;
    const d = anim === 'atk' ? 4 : 0;
    p.line(22, cy - 2 + d, 10, cy - 10 + flap + d, c.c);
    p.line(10, cy - 10 + flap + d, 8, cy + 2 + d, c.c);
    p.line(22, cy + d, 9, cy + 2 + d, c.a);
    p.ellipse(24, cy + 2 + d, 5, 6, c.a);
    p.ellipse(23, cy + d, 3, 3, c.b);
    p.rect(25, cy - 7 + d, 6, 5, c.a);
    p.px(25, cy - 9 + d, c.c);
    p.px(30, cy - 9 + d, c.c);
    p.px(29, cy - 5 + d, anim === 'wind' ? '#ff3030' : c.e);
    p.line(21, cy + 8 + d, 20, cy + 12 + d, c.c);
    p.line(27, cy + 8 + d, 28, cy + 12 + d, c.c);
    p.line(19, cy + 6 + d, 14, cy + 11 + d, c.a);
  },
  golem(p, c, anim, f) {
    const arm = anim === 'wind' ? -12 : anim === 'atk' ? 6 : bob(f);
    p.rect(14, 22, 20, 16, c.a);
    p.rect(14, 22, 20, 2, c.b);
    p.rect(17, 38, 5, 6, c.a);
    p.rect(27, 38, 5, 6, c.a);
    p.rect(18, 15, 12, 8, c.b);
    p.rect(21, 18, 2, 2, c.e);
    p.rect(26, 18, 2, 2, c.e);
    p.line(18, 27, 22, 33, c.e);
    p.line(30, 26, 26, 31, c.e);
    p.rect(8, 22 + arm, 6, 12, c.a);
    p.rect(34, 22 + arm, 6, 12, c.a);
    p.rect(7, 32 + arm, 8, 5, c.b);
    p.rect(33, 32 + arm, 8, 5, c.b);
    p.rect(20, 10, 3, 5, c.b);
    p.rect(26, 12, 2, 3, c.b);
  },
  treant(p, c, anim, f) {
    const arm = anim === 'wind' ? -10 : anim === 'atk' ? 6 : bob(f);
    p.rect(17, 18, 14, 22, c.a);
    p.rect(17, 18, 3, 22, c.b);
    p.line(24, 18, 24, 40, c.c);
    p.rect(14, 40, 6, 4, c.a);
    p.rect(28, 40, 6, 4, c.a);
    p.ellipse(24, 12, 12, 7, c.c);
    p.ellipse(22, 10, 8, 4, shade(c.c, 0.2));
    p.rect(20, 23, 2, 2, c.e);
    p.rect(26, 23, 2, 2, c.e);
    p.line(17, 26, 8, 20 + arm, c.a);
    p.line(8, 20 + arm, 5, 15 + arm, c.a);
    p.line(31, 26, 40, 20 + arm, c.a);
    p.line(40, 20 + arm, 43, 15 + arm, c.a);
    p.rect(21, 30, 6, 1, c.c);
  },
  wisp(p, c, anim, f) {
    const cy = 28 + bob(f, 2);
    const k = anim === 'wind' ? 2 : 0;
    p.disc(24, cy, 6 + k, c.c);
    p.disc(24, cy, 4 + k, c.a);
    p.disc(23, cy - 1, 2, c.b);
    for (let i = 0; i < 4; i++) {
      const a = f * 0.8 + i * 1.57;
      p.px(24 + Math.cos(a) * (10 + k), cy + Math.sin(a) * (8 + k), c.b);
    }
    for (let i = 0; i < 3; i++) p.px(22 + i * 2, cy + 7 + ((f + i) % 3), c.a);
    p.px(22, cy, anim === 'wind' ? '#ff3030' : c.e);
    p.px(26, cy, anim === 'wind' ? '#ff3030' : c.e);
  },
  plant(p, c, anim, f) {
    const puff = anim === 'wind' ? 2 : anim === 'atk' ? -1 : bob(f) * 0.5;
    p.line(24, 44, 24, 30, c.c);
    p.line(23, 44, 23, 31, c.c);
    for (const s of [-1, 1]) {
      p.ellipse(24 + s * 6, 38, 4, 2, c.a);
      p.line(24, 36, 24 + s * 10, 32 - puff, c.c);
      p.px(24 + s * 10, 31 - puff, c.e);
    }
    p.ellipse(24, 26 - puff, 7 + puff, 6 + puff, c.a);
    p.ellipse(24, 24 - puff, 5, 3, c.b);
    p.rect(22, 27 - puff, 4, 2, anim === 'wind' ? '#ff3030' : '#201010');
    for (let i = 0; i < 5; i++) p.px(18 + i * 3, 20 - puff - (i % 2) * 2, c.e);
  },
  jelly(p, c, anim, f) {
    const cy = 24 + bob(f, 2);
    const pulse = anim === 'wind' ? 2 : f % 2;
    p.ellipse(24, cy, 8 + pulse, 6, c.a);
    p.ellipse(24, cy - 2, 6, 3, c.b);
    p.rect(17 - pulse, cy + 4, 15 + pulse * 2, 2, c.c);
    for (let i = 0; i < 5; i++) {
      const x = 18 + i * 3;
      for (let y = 0; y < 10 + (i % 2) * 4; y++) p.px(x + Math.round(Math.sin((y + f * 2 + i) * 0.6)), cy + 6 + y, y % 3 === 0 ? c.b : c.a);
    }
    p.px(21, cy, anim === 'wind' ? '#ff3030' : c.e);
    p.px(27, cy, anim === 'wind' ? '#ff3030' : c.e);
    if (anim === 'atk') for (let i = 0; i < 4; i++) p.px(16 + i * 5, cy + 18, c.e);
  },
  armillary(p, c, anim, f) {
    const cy = 26 + bob(f, 1);
    const k = anim === 'wind' ? 2 : 0;
    p.ring(24, cy, 10 + k, c.a);
    p.ellipse(24, cy, 10 + k, 3, c.c);
    p.ellipse(24, cy, 3, 10 + k, c.c);
    for (let i = 0; i < 3; i++) {
      const a = f * 0.9 + i * 2.1;
      p.disc(24 + Math.cos(a) * (10 + k), cy + Math.sin(a) * 3, 1, c.b);
    }
    p.disc(24, cy, 3, c.e);
    p.px(24, cy - 1, '#ffffff');
    p.line(24, cy + 11, 24, cy + 16, c.c);
    p.rect(21, cy + 16, 7, 2, c.a);
  },
  eye(p, c, anim, f) {
    const cy = 26 + bob(f, 2);
    const k = anim === 'wind' ? 1 : 0;
    p.disc(24, cy, 9 + k, c.c);
    p.disc(24, cy, 7 + k, c.a);
    p.disc(25, cy, 4, '#f0e8f0');
    p.disc(26, cy, 2, anim === 'wind' ? '#ff3030' : c.e);
    p.px(26, cy - 1, '#ffffff');
    for (let i = 0; i < 6; i++) {
      const a = i * 1.05 + f * 0.3;
      p.line(24 + Math.cos(a) * 9, cy + Math.sin(a) * 9, 24 + Math.cos(a) * 14, cy + Math.sin(a) * 14, i % 2 ? c.a : c.b);
    }
  },
  worm(p, c, anim, f) {
    const up = anim === 'wind' ? -6 : anim === 'atk' ? 2 : 0;
    for (let i = 0; i < 6; i++) {
      const x = 12 + i * 4;
      const y = 40 - Math.max(0, i - 3) * 3 + (i >= 4 ? up : 0) + Math.round(Math.sin(f + i) * 0.6);
      p.disc(x, y, 3, i % 2 ? c.a : c.b);
    }
    const hx = 36;
    const hy = 30 + up;
    p.disc(hx, hy, 4, c.a);
    p.rect(hx + 2, hy - 1, 3, 3, c.c);
    for (let i = 0; i < 3; i++) p.px(hx + 3 + i, hy + (i % 2 ? 2 : -2), c.b);
    p.px(hx, hy - 2, anim === 'wind' ? '#ff3030' : c.e);
  },
  bird(p, c, anim, f) {
    const cy = 26 + bob(f, 2);
    const flap = f % 2 === 0 ? -6 : 2;
    const d = anim === 'atk' ? 4 : 0;
    p.ellipse(24, cy + d, 6, 3, c.a);
    p.ellipse(31, cy - 2 + d, 3, 3, c.a);
    p.line(34, cy - 1 + d, 37, cy + d, c.e);
    p.px(32, cy - 3 + d, anim === 'wind' ? '#ff3030' : '#ffffff');
    p.line(22, cy - 1 + d, 14, cy - 7 + flap + d, c.c);
    p.line(14, cy - 7 + flap + d, 8, cy - 3 + flap + d, c.c);
    p.line(23, cy + d, 13, cy - 3 + flap + d, c.b);
    p.line(18, cy + d, 12, cy + 3 + d, c.a);
    p.line(17, cy + 1 + d, 11, cy + 5 + d, c.c);
  },
  blob(p, c, anim, f) {
    const sq = anim === 'wind' ? 3 : anim === 'atk' ? -3 : bob(f);
    const rx = 9 + sq;
    const ry = 7 - sq;
    const cy = 44 - ry;
    p.ellipse(24, cy, rx, ry, c.a);
    p.ellipse(24, cy + 2, rx - 1, ry - 2, c.c);
    p.ellipse(21, cy - 3, 3, 2, c.b);
    p.rect(25, cy - 2, 2, 3, '#201020');
    p.rect(29, cy - 2, 2, 3, '#201020');
    p.rect(24, cy + 2, 6, 1, anim === 'wind' ? '#ff4040' : c.e);
    p.px(18, cy + 3, c.b);
  },
  hound(p, c, anim, f) {
    const run = anim === 'move' || anim === 'atk' ? f % 2 : 0;
    const big = anim === 'wind' ? 1 : 0;
    p.rect(13, 32, 20, 8, c.a);
    p.rect(13, 32, 20, 2, c.b);
    p.rect(30, 27, 9, 8, c.a);
    p.rect(37, 31, 5, 3, c.c);
    p.px(36, 27, c.c);
    p.px(33, 26, c.a);
    p.px(35, 29, anim === 'wind' ? '#ff3030' : c.e);
    p.rect(15, 40, 3, 4 - run, c.c);
    p.rect(20, 40, 3, 4 - (1 - run), c.c);
    p.rect(27, 40, 3, 4 - run, c.c);
    p.rect(31, 40, 3, 4 - (1 - run), c.c);
    p.line(13, 33, 7, 29 - run - big, c.a);
    for (let i = 0; i < 4; i++) p.px(16 + i * 4, 31, c.e);
  },
  raptor(p, c, anim, f) {
    const run = anim === 'move' || anim === 'atk' ? f % 2 : 0;
    const lean = anim === 'atk' ? 3 : 0;
    p.ellipse(22, 32, 8, 5, c.a);
    p.ellipse(21, 30, 5, 2, c.b);
    p.line(28 + lean, 30, 32 + lean, 22, c.a);
    p.line(29 + lean, 30, 33 + lean, 22, c.a);
    p.rect(31 + lean, 19, 8, 4, c.a);
    p.rect(36 + lean, 22, 4, 1, c.c);
    p.px(34 + lean, 20, anim === 'wind' ? '#ff3030' : c.e);
    p.line(14, 32, 5, 28, c.a);
    p.line(20, 36, 18 + run * 3, 44, c.c);
    p.line(24, 36, 27 - run * 3, 44, c.c);
    p.line(29, 32, 32, 34, c.c);
  },
  gear(p, c, anim, f) {
    const rot = f * 0.4 + (anim === 'wind' ? 0.8 : 0);
    p.rect(14, 34, 20, 10, c.c);
    p.rect(14, 34, 20, 2, c.a);
    p.disc(24, 26, 8, c.a);
    for (let i = 0; i < 8; i++) {
      const a = rot + i * 0.785;
      p.rect(24 + Math.cos(a) * 9 - 1, 26 + Math.sin(a) * 9 - 1, 3, 3, c.a);
    }
    p.disc(24, 26, 3, c.c);
    p.px(24, 26, c.e);
    p.rect(32, 24, 8, 3, c.b);
    p.rect(39, 23, 2, 5, anim === 'wind' ? '#ff3030' : c.e);
  },
  moth(p, c, anim, f) {
    const flap = f % 2 === 0 ? -4 : 2;
    p.ellipse(24, 30, 2, 6, c.c);
    p.ellipse(16, 25 + flap / 2, 5, 4, c.a);
    p.ellipse(32, 25 + flap / 2, 5, 4, c.a);
    p.disc(16, 25 + flap / 2, 1, c.e);
    p.disc(32, 25 + flap / 2, 1, c.e);
    p.ellipse(19, 34, 3, 3, c.b);
    p.ellipse(29, 34, 3, 3, c.b);
    p.px(25, 25, anim === 'wind' ? '#ff3030' : '#202020');
    p.line(24, 24, 22, 20, c.c);
    p.line(24, 24, 27, 20, c.c);
    if (anim === 'atk') for (let i = 0; i < 5; i++) p.px(20 + i * 2, 38 + (i % 2) * 2, c.e);
  },
  fish(p, c, anim, f) {
    const run = anim === 'move' || anim === 'atk' ? f % 2 : 0;
    const jaw = anim === 'wind' ? 3 : anim === 'atk' ? 1 : 0;
    p.ellipse(22, 34, 10, 7, c.a);
    p.ellipse(21, 31, 7, 3, c.b);
    p.line(30, 36, 37, 36 + jaw, c.c);
    p.line(30, 32, 37, 31 - jaw, c.c);
    for (let i = 0; i < 3; i++) p.px(32 + i * 2, 33 - jaw + (i % 2), '#f0f0f0');
    p.px(27, 31, anim === 'wind' ? '#ff3030' : '#ffffff');
    p.line(26, 27, 30, 18, c.c);
    p.disc(31, 17, 2, c.e);
    p.line(12, 34, 6, 30 - run, c.a);
    p.line(12, 34, 6, 38 + run, c.a);
    p.rect(16, 40, 3, 4, c.c);
    p.rect(24, 40, 3, 4 - run, c.c);
  },
  crab(p, c, anim, f) {
    const run = anim === 'move' ? f % 2 : 0;
    const raise = anim === 'wind' || anim === 'block' ? -6 : anim === 'atk' ? 2 : 0;
    p.ellipse(24, 36, 10, 5, c.a);
    p.ellipse(24, 34, 7, 2, c.b);
    for (let i = 0; i < 3; i++) {
      p.line(16 + i * 2, 39, 11 + i * 2, 44 - ((run + i) % 2), c.c);
      p.line(32 - i * 2, 39, 37 - i * 2, 44 - ((run + i + 1) % 2), c.c);
    }
    p.line(31, 34, 36, 28 + raise, c.a);
    p.rect(35, 24 + raise, 6, 5, c.b);
    p.line(17, 34, 12, 28 + raise, c.a);
    p.rect(8, 24 + raise, 6, 5, c.b);
    p.px(22, 31, anim === 'wind' ? '#ff3030' : c.e);
    p.px(27, 31, anim === 'wind' ? '#ff3030' : c.e);
  },
  shard(p, c, anim, f) {
    const cy = 26 + bob(f, 2);
    const k = anim === 'wind' ? 2 : 0;
    for (let y = -10 - k; y <= 10 + k; y++) {
      const w = Math.round((10 + k - Math.abs(y)) * 0.45);
      p.rect(24 - w, cy + y, w * 2 + 1, 1, y < 0 ? c.b : c.a);
    }
    p.line(24, cy - 10 - k, 24, cy + 10 + k, c.c);
    p.px(22, cy - 3, '#ffffff');
    p.px(25, cy, anim === 'wind' ? '#ff3030' : c.e);
    for (let i = 0; i < 3; i++) p.px(24 + Math.cos(f + i * 2) * 13, cy + Math.sin(f + i * 2) * 6, c.b);
  },
  prism(p, c, anim, f) {
    const k = anim === 'wind' ? 1 : 0;
    p.rect(16, 38, 16, 6, c.c);
    p.rect(16, 38, 16, 1, c.a);
    for (let y = 0; y < 22; y++) {
      const w = Math.round(y * 0.4) + k;
      p.rect(24 - w, 16 + y, w * 2 + 1, 1, y < 8 ? c.b : y % 4 === 0 ? c.e : c.a);
    }
    p.px(24, 14 - (f % 2), '#ffffff');
    p.px(24, 26, anim === 'wind' ? '#ff3030' : '#ffffff');
  },
  hourglass(p, c, anim, f) {
    const arm = anim === 'wind' ? -10 : anim === 'atk' ? 6 : bob(f);
    p.rect(14, 12, 20, 3, c.c);
    p.rect(14, 40, 20, 4, c.c);
    for (let y = 0; y < 25; y++) {
      const w = Math.round(Math.abs(12 - y) * 0.6) + 1;
      p.rect(24 - w, 15 + y, w * 2, 1, c.a);
    }
    const sand = (f % 4) + 2;
    p.rect(22, 30 + (4 - sand), 4, sand + 6, c.e);
    p.rect(23, 18, 2, 6 - sand, c.e);
    p.px(23, 27, c.e);
    p.rect(8, 22 + arm, 6, 10, c.b);
    p.rect(34, 22 + arm, 6, 10, c.b);
    p.rect(18, 20, 2, 2, anim === 'wind' ? '#ff3030' : '#201010');
    p.rect(28, 20, 2, 2, anim === 'wind' ? '#ff3030' : '#201010');
  },
};

/** 적 id → 생김새·팔레트 */
export const CREATURES: Record<string, { kind: string; pal: Pal }> = {
  // 스토리 2
  ember_bat: { kind: 'bat', pal: { a: '#5a3a30', b: '#9a6a50', c: '#3a2420', e: '#ffb040' } },
  fossil_scorpion: { kind: 'scorpion', pal: { a: '#a08a60', b: '#d0c090', c: '#5a4a30', e: '#ff8a4a' } },
  bronze_gargoyle: { kind: 'gargoyle', pal: { a: '#8a6a40', b: '#c09a60', c: '#4a3a20', e: '#ffe080' } },
  crystal_golem: { kind: 'golem', pal: { a: '#5a5aa0', b: '#a0a0ff', c: '#2a2a5a', e: '#e0e0ff' } },
  crystal_spider: { kind: 'spider', pal: { a: '#7a6ac0', b: '#c0b0ff', c: '#3a2a6a', e: '#ffffff' } },
  star_wisp: { kind: 'wisp', pal: { a: '#c0c0ff', b: '#ffffff', c: '#6a6ac0', e: '#20204a' } },
  thorn_sprite: { kind: 'plant', pal: { a: '#5a9a3a', b: '#a0e060', c: '#2a4a1a', e: '#ff80a0' } },
  sky_jelly: { kind: 'jelly', pal: { a: '#80c0e0', b: '#e0f8ff', c: '#4a80a0', e: '#ffffff' } },
  armillary: { kind: 'armillary', pal: { a: '#c0a060', b: '#ffe080', c: '#7a6030', e: '#ff8a4a' } },
  meteor_sprite: { kind: 'wisp', pal: { a: '#ff7a2a', b: '#ffe080', c: '#a03a10', e: '#401000' } },
  hole_eye: { kind: 'eye', pal: { a: '#4a2a7a', b: '#9a6bff', c: '#1a0a30', e: '#0a0010' } },
  star_eater: { kind: 'worm', pal: { a: '#5a4a7a', b: '#8a7aa0', c: '#2a1a40', e: '#ffe080' } },
  // 스토리 3
  carrion_crow: { kind: 'bird', pal: { a: '#2a2a34', b: '#5a5a6a', c: '#14141a', e: '#c0a040' } },
  mud_golem: { kind: 'golem', pal: { a: '#5a4430', b: '#7a6448', c: '#2a2014', e: '#a0c040' } },
  blood_bat: { kind: 'bat', pal: { a: '#6a1a24', b: '#a03040', c: '#3a0a10', e: '#ff4060' } },
  wine_slime: { kind: 'blob', pal: { a: '#7a2a5a', b: '#c060a0', c: '#4a1434', e: '#ff80c0' } },
  chain_hound: { kind: 'hound', pal: { a: '#4a4a52', b: '#7a7a82', c: '#2a2a30', e: '#c0c0c8' } },
  torture_engine: { kind: 'gear', pal: { a: '#7a5a3a', b: '#c0c0c8', c: '#3a2a1a', e: '#ff4040' } },
  red_gargoyle: { kind: 'gargoyle', pal: { a: '#7a2a2a', b: '#a04a4a', c: '#3a1010', e: '#ffd040' } },
  werewolf: { kind: 'hound', pal: { a: '#5a5a4a', b: '#8a8a70', c: '#2a2a20', e: '#ffe040' } },
  moon_moth: { kind: 'moth', pal: { a: '#8ab08a', b: '#c0e0c0', c: '#3a5a3a', e: '#e0ffa0' } },
  blood_hound: { kind: 'hound', pal: { a: '#6a1a24', b: '#a03040', c: '#3a0a10', e: '#ff8090' } },
  bat_swarm: { kind: 'swarm', pal: { a: '#5a1a24', b: '#8a3040', c: '#2a0a10', e: '#ff4060' } },
  // 스토리 4
  deep_angler: { kind: 'fish', pal: { a: '#1a4a5a', b: '#3a7a8a', c: '#0a2a34', e: '#80ffe0' } },
  first_crab: { kind: 'crab', pal: { a: '#b05a3a', b: '#e08a60', c: '#5a2a1a', e: '#ffffff' } },
  sea_jelly: { kind: 'jelly', pal: { a: '#5a6ac0', b: '#a0b0ff', c: '#2a3a7a', e: '#e0ffff' } },
  stone_treant: { kind: 'treant', pal: { a: '#6a6a5a', b: '#9a9a80', c: '#4a5a3a', e: '#e0e0a0' } },
  fossil_raptor: { kind: 'raptor', pal: { a: '#8a8470', b: '#b0aa90', c: '#4a4638', e: '#ffb040' } },
  moss_spirit: { kind: 'wisp', pal: { a: '#7ab050', b: '#c0f090', c: '#3a5a2a', e: '#203010' } },
  storm_harpy: { kind: 'bird', pal: { a: '#4a5a7a', b: '#8aa0d0', c: '#2a3448', e: '#e0f0ff' } },
  spark_wisp: { kind: 'wisp', pal: { a: '#a0d0ff', b: '#ffffff', c: '#4a7ac0', e: '#203050' } },
  cloud_golem: { kind: 'golem', pal: { a: '#9aaac0', b: '#e0e8f0', c: '#5a6a80', e: '#80d0ff' } },
  glass_shard: { kind: 'shard', pal: { a: '#b0c0e0', b: '#ffffff', c: '#6a7aa0', e: '#4060ff' } },
  prism_turret: { kind: 'prism', pal: { a: '#a080e0', b: '#ffe0ff', c: '#4a3a7a', e: '#80ffe0' } },
  time_eater: { kind: 'worm', pal: { a: '#a09060', b: '#e0d090', c: '#5a4a2a', e: '#ffffff' } },
  hourglass_golem: { kind: 'hourglass', pal: { a: '#c0a060', b: '#e0c080', c: '#6a5430', e: '#ffe0a0' } },
  first_soul: { kind: 'wisp', pal: { a: '#ffe0a0', b: '#ffffff', c: '#c0a060', e: '#604020' } },
  origin_eye: { kind: 'eye', pal: { a: '#c0a060', b: '#fff0c0', c: '#5a4430', e: '#201008' } },
};

export function drawCreature(p: Pix, id: string, anim: string, f: number): boolean {
  const cr = CREATURES[id];
  if (!cr) return false;
  KINDS[cr.kind](p, cr.pal, anim, f);
  return true;
}
