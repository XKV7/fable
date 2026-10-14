import type { ChapterDef } from '../data/meta';
import { makeCanvas, shade } from './pixel';

/** 챕터별 3레이어 시차 스크롤 배경 (절차 생성, 캐시) */
const cache = new Map<string, HTMLCanvasElement[]>();
const LW = 640;
const LH = 270;

function rnd(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function layer(ch: ChapterDef | 'hub', depth: number): HTMLCanvasElement {
  const c = makeCanvas(LW, LH);
  const g = c.getContext('2d')!;
  const r = rnd(1234 + depth * 99 + (ch === 'hub' ? 0 : ch.n * 777));
  const bg: [string, string, string] = ch === 'hub' ? ['#121020', '#1e1a34', '#2a2448'] : ch.bg;
  const kind = ch === 'hub' ? 0 : ch.n;
  if (depth === 0) {
    const gr = g.createLinearGradient(0, 0, 0, LH);
    gr.addColorStop(0, shade(bg[0], -0.3));
    gr.addColorStop(1, bg[1]);
    g.fillStyle = gr;
    g.fillRect(0, 0, LW, LH);
    if (kind === 0) {
      // 성소: 별과 달
      for (let i = 0; i < 80; i++) {
        g.fillStyle = `rgba(255,255,255,${0.2 + r() * 0.6})`;
        g.fillRect(Math.floor(r() * LW), Math.floor(r() * 160), 1, 1);
      }
      g.fillStyle = '#e8e0ff';
      g.beginPath();
      g.arc(480, 60, 18, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = shade(bg[0], -0.3);
      g.beginPath();
      g.arc(488, 54, 16, 0, Math.PI * 2);
      g.fill();
    }
    // 먼 실루엣
    g.fillStyle = bg[1];
    for (let x = 0; x < LW; x += 20 + Math.floor(r() * 30)) {
      const h = 60 + r() * 110;
      if (kind === 1 || kind === 0) {
        g.fillRect(x, LH - h, 14, h);
        g.beginPath();
        g.moveTo(x - 3, LH - h);
        g.lineTo(x + 7, LH - h - 14);
        g.lineTo(x + 17, LH - h);
        g.fill();
      } else if (kind === 2) {
        g.fillRect(x + 6, LH - h, 4, h);
        g.beginPath();
        g.ellipse(x + 8, LH - h, 14, 6, 0, Math.PI, 0);
        g.fill();
      } else if (kind === 3) {
        g.fillRect(x, LH - h, 18, h);
        g.fillRect(x + 4, LH - h - 20, 8, 20);
      } else if (kind === 5) {
        // 돛대와 기울어진 난파선
        g.fillRect(x + 6, LH - h - 30, 3, h + 30);
        g.fillRect(x - 6, LH - h - 10, 28, 2);
        g.beginPath();
        g.moveTo(x - 20, LH - 30);
        g.lineTo(x + 40, LH - 50);
        g.lineTo(x + 34, LH);
        g.lineTo(x - 14, LH);
        g.fill();
      } else if (kind === 6) {
        // 높은 서가
        g.fillRect(x, LH - h - 20, 24, h + 20);
        g.fillStyle = shade(bg[1], 0.12);
        for (let yy = LH - h - 14; yy < LH; yy += 12) g.fillRect(x + 2, yy, 20, 2);
        g.fillStyle = bg[1];
      } else if (kind === 7) {
        // 떠 있는 바위섬
        const y = 40 + r() * 140;
        g.beginPath();
        g.moveTo(x - 10, y);
        g.lineTo(x + 30, y);
        g.lineTo(x + 14, y + 20 + r() * 20);
        g.fill();
      } else {
        g.fillRect(x, LH - h - 40, 10, h + 40);
        g.fillRect(x - 4, LH - h - 44, 18, 6);
      }
    }
    if (kind === 7) {
      for (let i = 0; i < 90; i++) {
        g.fillStyle = `rgba(255,${120 + Math.floor(r() * 120)},230,${0.2 + r() * 0.6})`;
        g.fillRect(Math.floor(r() * LW), Math.floor(r() * LH), 1, 1);
      }
    }
  } else {
    const col = depth === 1 ? bg[2] : shade(bg[2], 0.08);
    const alpha = depth === 1 ? 0.75 : 0.55;
    g.globalAlpha = alpha;
    g.fillStyle = col;
    if (depth === 1) {
      for (let x = 0; x < LW; x += 80 + Math.floor(r() * 50)) {
        if (kind === 2) {
          // 버섯 군락
          const h = 50 + r() * 70;
          g.fillRect(x + 10, LH - h, 6, h);
          g.beginPath();
          g.ellipse(x + 13, LH - h, 24, 10, 0, Math.PI, 0);
          g.fill();
          g.fillStyle = shade(col, 0.15);
          g.fillRect(x + 4, LH - h - 6, 3, 2);
          g.fillStyle = col;
        } else if (kind === 5) {
          // 부두 기둥과 그물
          const h = 70 + r() * 50;
          g.fillRect(x, LH - h, 8, h);
          g.fillRect(x + 40, LH - h + 10, 8, h - 10);
          g.fillRect(x - 6, LH - h, 60, 4);
          g.globalAlpha = alpha * 0.5;
          for (let k = 0; k < 6; k++) g.fillRect(x + 8 + k * 6, LH - h + 4, 1, 30);
          g.globalAlpha = alpha;
        } else if (kind === 6) {
          // 얼어붙은 서가와 고드름
          const h = 130 + r() * 60;
          g.fillRect(x, LH - h, 50, h);
          g.fillStyle = shade(col, 0.2);
          for (let yy = LH - h + 8; yy < LH; yy += 16) g.fillRect(x + 3, yy, 44, 3);
          for (let k = 0; k < 5; k++) g.fillRect(x + 4 + k * 10, LH - h, 2, 6 + r() * 8);
          g.fillStyle = col;
        } else if (kind === 7) {
          // 금이 간 허공의 기둥 조각
          const y = 60 + r() * 120;
          g.fillRect(x, y, 14, 40 + r() * 40);
          g.fillStyle = '#ff80d0';
          g.globalAlpha = 0.3;
          g.fillRect(x + 6, y + 4, 1, 30);
          g.globalAlpha = alpha;
          g.fillStyle = col;
        } else if (kind === 3) {
          // 굴뚝과 체인
          const h = 120 + r() * 80;
          g.fillRect(x, LH - h, 26, h);
          g.fillStyle = '#ff6a1a';
          g.globalAlpha = 0.4;
          g.fillRect(x + 6, LH - h + 20, 14, 6);
          g.globalAlpha = alpha;
          g.fillStyle = col;
        } else {
          // 아치 회랑
          const h = 140 + r() * 60;
          g.fillRect(x, LH - h, 16, h);
          g.fillRect(x + 56, LH - h, 16, h);
          g.beginPath();
          g.arc(x + 36, LH - h + 10, 36, Math.PI, 0);
          g.lineWidth = 10;
          g.strokeStyle = col;
          g.stroke();
          if (kind === 4 || kind === 0) {
            g.fillStyle = kind === 4 ? '#6a2a4a' : '#3a5aa0';
            g.globalAlpha = 0.5;
            g.fillRect(x + 22, LH - h + 30, 28, 50);
            g.globalAlpha = alpha;
            g.fillStyle = col;
          }
        }
      }
    } else {
      for (let x = 0; x < LW; x += 140 + Math.floor(r() * 80)) {
        // 가까운 기둥 / 사슬
        g.fillRect(x, 0, 10, LH);
        g.fillStyle = shade(col, 0.12);
        g.fillRect(x, 0, 2, LH);
        g.fillStyle = col;
        const cx = x + 60;
        for (let y = 0; y < 60 + r() * 60; y += 6) {
          g.fillRect(cx, y, 2, 4);
        }
      }
    }
  }
  return c;
}

export function drawBackground(g: CanvasRenderingContext2D, ch: ChapterDef | 'hub', camX: number, camY: number): void {
  const key = ch === 'hub' ? 'hub' : `c${ch.n}`;
  let ls = cache.get(key);
  if (!ls) {
    ls = [layer(ch, 0), layer(ch, 1), layer(ch, 2)];
    cache.set(key, ls);
  }
  const fac = [0.08, 0.25, 0.5];
  ls.forEach((l, i) => {
    const off = -((camX * fac[i]) % LW);
    const oy = -Math.round(camY * fac[i] * 0.5);
    for (let x = Math.floor(off) - LW; x < 480; x += LW) if (x + LW > 0) g.drawImage(l, x, oy);
  });
}
