import { OUTLINE } from './pixel';

/**
 * 날개 없는 구체 보스(스토리 5·6의 비행 보스) 그림. 48×48 프레임, 구체 중심 (24, 24), 오른쪽을 본다.
 * 화면에는 2배로 그려진다(다른 보스와 같은 픽셀 크기).
 *  - 구체: 왼쪽 위 광원 5단계 음영 + 오른쪽 아래 역광 테두리 + 표면 무늬(폭풍 소용돌이 / 오로라 띠)
 *  - 가운데 큰 눈 하나 (예고 중에는 붉게 커지고, 가끔 깜빡임)
 *  - 기울어진 궤도 고리와 그 위를 도는 파편 3개 (뒤쪽 절반은 구체에 가려진다)
 */
export interface OrbStyle {
  base: string; // 몸 색
  glow: string; // 빛·테두리·고리 색
  eye: string; // 눈동자 색
  skin: 'storm' | 'aurora';
}

export const ORB_STYLES: Record<string, OrbStyle> = {
  kalais: { base: '#2a3a6a', glow: '#c0e0ff', eye: '#ffffff', skin: 'storm' },
  noctis: { base: '#0e2422', glow: '#80ffc0', eye: '#c0ffe0', skin: 'aurora' },
};

const S = 48;
const C = 24;
const R = 14;

type RGB = [number, number, number];
const hex = (c: string): RGB => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const mul = (a: RGB, k: number): RGB => [a[0] * k, a[1] * k, a[2] * k];

const cache = new Map<string, HTMLCanvasElement>();

/** f: 0~11 애니메이션 프레임, angry: 공격 예고 중 */
export function orbFrame(id: string, f: number, angry: boolean): HTMLCanvasElement {
  const blink = !angry && f === 7;
  const key = `${id}|${f}|${angry ? 1 : 0}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const st = ORB_STYLES[id] ?? ORB_STYLES.kalais;
  const base = hex(st.base);
  const glow = hex(st.glow);
  const white: RGB = [255, 255, 255];
  const ramp: RGB[] = [mul(base, 0.35), mul(base, 0.65), base, mix(base, glow, 0.35), mix(glow, white, 0.4)];
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d')!;
  const img = g.createImageData(S, S);
  const px = img.data;
  const filled = new Uint8Array(S * S);
  const put = (x: number, y: number, c: RGB, a = 1): void => {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= S || y >= S) return;
    const i = (y * S + x) * 4;
    const ia = px[i + 3] / 255;
    if (a >= 1 || ia === 0) {
      px[i] = c[0];
      px[i + 1] = c[1];
      px[i + 2] = c[2];
      px[i + 3] = Math.round(255 * Math.max(a, ia));
    } else {
      px[i] = px[i] + (c[0] - px[i]) * a;
      px[i + 1] = px[i + 1] + (c[1] - px[i + 1]) * a;
      px[i + 2] = px[i + 2] + (c[2] - px[i + 2]) * a;
    }
    filled[y * S + x] = 1;
  };
  const inside = (x: number, y: number): boolean => (x - C + 0.5) ** 2 + (y - C + 0.5) ** 2 <= R * R;

  // 궤도 고리 (기울어진 타원) — 뒤쪽 먼저, 앞쪽은 구체 뒤에
  const tilt = -0.28;
  const ring = (front: boolean): void => {
    for (let k = 0; k < 160; k++) {
      const a = (k / 160) * Math.PI * 2;
      const isFront = Math.sin(a) > 0;
      if (isFront !== front) continue;
      const seg = Math.floor(a * (12 / Math.PI) + f * 0.75) % 4;
      if (seg === 3) continue;
      const lx = Math.cos(a) * 22;
      const ly = Math.sin(a) * 6;
      const x = C + lx * Math.cos(tilt) - ly * Math.sin(tilt);
      const y = C + 2 + lx * Math.sin(tilt) + ly * Math.cos(tilt);
      if (!front && inside(Math.round(x), Math.round(y))) continue;
      put(x, y, front ? (seg === 0 ? mix(glow, white, 0.5) : glow) : mul(glow, 0.55), front ? 1 : 0.8);
    }
  };
  // 궤도 파편 3개
  const shards = (front: boolean): void => {
    for (let i = 0; i < 3; i++) {
      const a = (f / 12) * Math.PI * 2 + (i * Math.PI * 2) / 3;
      if (Math.sin(a) > 0 !== front) continue;
      const lx = Math.cos(a) * 22;
      const ly = Math.sin(a) * 6;
      const x = Math.round(C + lx * Math.cos(tilt) - ly * Math.sin(tilt));
      const y = Math.round(C + 2 + lx * Math.sin(tilt) + ly * Math.cos(tilt));
      const c = front ? mix(glow, white, 0.3) : mul(glow, 0.6);
      if (!front && inside(x, y)) continue;
      if (st.skin === 'storm') {
        // 번개 조각: 지그재그
        put(x, y - 2, c);
        put(x + 1, y - 1, c);
        put(x, y, white);
        put(x - 1, y + 1, c);
        put(x, y + 2, c);
      } else {
        // 결정: 마름모
        put(x, y - 2, c);
        put(x - 1, y - 1, c);
        put(x + 1, y - 1, c);
        put(x, y - 1, white);
        put(x - 1, y, c);
        put(x + 1, y, c);
        put(x, y, c);
        put(x, y + 1, mul(c, 0.7));
      }
    }
  };
  ring(false);
  shards(false);

  // 구체
  const L = [-0.5, -0.62, 0.6];
  const ll = Math.hypot(L[0], L[1], L[2]);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      if (!inside(x, y)) continue;
      const nx = (x - C + 0.5) / R;
      const ny = (y - C + 0.5) / R;
      const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      const d = Math.max(0, (nx * L[0] + ny * L[1] + nz * L[2]) / ll);
      let lv = Math.min(4, Math.floor(d * 4.6));
      // 4×4 정렬 디더: 단계 경계를 거칠게
      const dz = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5][(y & 3) * 4 + (x & 3)] / 16;
      if (d * 4.6 - Math.floor(d * 4.6) > 0.75 + dz * 0.25 && lv < 4) lv++;
      let c = ramp[lv];
      // 표면 무늬
      const ang = Math.atan2(ny, nx);
      if (st.skin === 'storm') {
        const sw = Math.sin(ang * 3 + Math.hypot(nx, ny) * 7 - f * 0.52);
        if (sw > 0.82) c = mix(c, glow, 0.45);
        else if (sw < -0.9) c = mul(c, 0.8);
      } else {
        const wv = Math.sin(nx * 9 + Math.sin(ny * 5 + f * 0.52) * 1.6);
        if (wv > 0.85 && ny < 0.4) c = mix(c, glow, 0.55 * (1 - ny));
      }
      // 역광 테두리 (오른쪽 아래)
      if (nz < 0.42 && nx + ny > 0.45) c = mix(c, glow, 0.75);
      // 정반사
      if (Math.hypot(nx + 0.42, ny + 0.5) < 0.16) c = mix(c, white, 0.85);
      put(x, y, c);
    }
  }

  // 눈 (오른쪽으로 약간)
  const ex = C + 3;
  const ey = C;
  const ew = angry ? 6 : 5;
  const eh = blink ? 0.6 : angry ? 3.4 : 2.8;
  const iris = angry ? hex('#ff4040') : hex(st.eye);
  for (let y = -4; y <= 4; y++) {
    for (let x = -ew - 1; x <= ew + 1; x++) {
      const t = 1 - (x / (ew + 0.5)) ** 2;
      if (t <= 0) continue;
      const hh = eh * t;
      if (Math.abs(y) <= hh + 0.9 && Math.abs(y) > hh - 0.1) put(ex + x, ey + y, mul(base, 0.2));
      else if (Math.abs(y) <= hh) {
        const r = Math.hypot(x * 0.8, y);
        let c: RGB = r < 2.2 ? iris : mix(mul(glow, 0.6), iris, 0.3);
        if (Math.abs(x) <= 0 && Math.abs(y) <= hh) c = [10, 6, 16]; // 세로 동공
        put(ex + x, ey + y, c);
      }
    }
  }
  if (!blink) put(ex - 2, ey - 1, white);
  if (angry) {
    // 눈 주변 균열 빛
    for (const [dx, dy] of [[-8, -3], [-9, -4], [8, -3], [9, -5], [-7, 4], [7, 4], [8, 5]]) put(ex + dx, ey + dy, iris, 0.85);
  }

  ring(true);
  shards(true);

  // 외곽선: 구체 둘레에만 (고리·파편은 가는 빛이라 외곽선 없음)
  const oc = hex(OUTLINE);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      if (inside(x, y) || filled[y * S + x]) continue;
      if (inside(x - 1, y) || inside(x + 1, y) || inside(x, y - 1) || inside(x, y + 1)) put(x, y, oc);
    }
  }

  g.putImageData(img, 0, 0);
  cache.set(key, cv);
  return cv;
}
