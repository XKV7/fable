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
    if (kind >= 11) {
      storyFar(g, kind, bg, r);
      return c;
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
    if (depth === 1 && kind >= 11) {
      storyMid(g, kind, col, alpha, r);
    } else if (depth === 1) {
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

/** 스토리 2~4 테마의 먼 배경 (하늘 그라데이션 위) */
function storyFar(g: CanvasRenderingContext2D, kind: number, bg: [string, string, string], r: () => number): void {
  const tri = (x: number, y: number, w: number, h: number): void => {
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + w / 2, y - h);
    g.lineTo(x + w, y);
    g.fill();
  };
  const stars = (n: number, col: string): void => {
    for (let i = 0; i < n; i++) {
      g.fillStyle = col.replace('A', String(0.2 + r() * 0.6));
      g.fillRect(Math.floor(r() * LW), Math.floor(r() * 200), 1, 1);
    }
  };
  g.fillStyle = bg[1];
  switch (kind) {
    case 11: // 잿더미 언덕과 부러진 오벨리스크
      for (let x = -40; x < LW; x += 120 + r() * 60) {
        g.beginPath();
        g.ellipse(x + 60, LH, 110, 50 + r() * 40, 0, Math.PI, 0);
        g.fill();
      }
      for (let x = 30; x < LW; x += 150 + r() * 80) {
        const h = 60 + r() * 60;
        g.fillRect(x, LH - h, 10, h);
        tri(x - 1, LH - h, 12, 12 - r() * 8);
      }
      break;
    case 12: // 천장에 거꾸로 매달린 종탑
      for (let x = 0; x < LW; x += 50 + r() * 40) {
        const h = 60 + r() * 120;
        g.fillRect(x, 0, 16, h);
        g.beginPath();
        g.moveTo(x - 4, h);
        g.lineTo(x + 8, h + 22);
        g.lineTo(x + 20, h);
        g.fill();
        g.beginPath();
        g.ellipse(x + 8, h - 18, 8, 6, 0, 0, Math.PI);
        g.fill();
      }
      break;
    case 13: // 수정 군락 (바닥과 천장)
      stars(40, 'rgba(180,180,255,A)');
      g.fillStyle = bg[1];
      for (let x = 0; x < LW; x += 26 + r() * 30) {
        tri(x, LH, 18 + r() * 14, 50 + r() * 110);
        if (r() < 0.6) {
          g.beginPath();
          g.moveTo(x + 10, 0);
          g.lineTo(x + 18, 30 + r() * 60);
          g.lineTo(x + 26, 0);
          g.fill();
        }
      }
      break;
    case 14: // 구름과 떠 있는 정원 섬
      g.fillStyle = 'rgba(255,255,255,0.12)';
      for (let i = 0; i < 14; i++) {
        g.beginPath();
        g.ellipse(r() * LW, 40 + r() * 160, 40 + r() * 50, 10 + r() * 10, 0, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = bg[1];
      for (let x = 20; x < LW; x += 140 + r() * 60) {
        const y = 80 + r() * 100;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + 60, y);
        g.lineTo(x + 30, y + 30);
        g.fill();
        g.fillRect(x + 26, y - 26, 4, 26);
        g.beginPath();
        g.ellipse(x + 28, y - 30, 14, 10, 0, 0, Math.PI * 2);
        g.fill();
      }
      break;
    case 15: // 천문대 돔과 별
      stars(70, 'rgba(255,240,180,A)');
      g.fillStyle = bg[1];
      for (let x = 0; x < LW; x += 90 + r() * 60) {
        const h = 70 + r() * 90;
        g.fillRect(x, LH - h, 30, h);
        g.beginPath();
        g.arc(x + 15, LH - h, 17, Math.PI, 0);
        g.fill();
        g.fillRect(x + 22, LH - h - 26, 14, 4);
      }
      break;
    case 16: // 꺼진 별과 잔해
      g.fillStyle = shade(bg[1], 0.06);
      g.beginPath();
      g.arc(400, 110, 70, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = 'rgba(192,176,255,0.25)';
      g.lineWidth = 2;
      g.beginPath();
      g.arc(400, 110, 76, 0, Math.PI * 2);
      g.stroke();
      g.fillStyle = bg[1];
      for (let i = 0; i < 30; i++) g.fillRect(r() * LW, r() * LH, 2 + r() * 8, 2 + r() * 5);
      break;
    case 21: // 부서진 목책과 깃대
      for (let x = 0; x < LW; x += 12 + r() * 10) {
        const h = 30 + r() * 40;
        g.fillRect(x, LH - h, 6, h);
        tri(x - 1, LH - h, 8, 8);
      }
      for (let x = 40; x < LW; x += 160 + r() * 80) {
        g.fillRect(x, LH - 170, 3, 170);
        g.fillRect(x + 3, LH - 168, 26, 14);
      }
      break;
    case 22: // 포도밭 언덕과 저택
      for (let x = -60; x < LW; x += 160) {
        g.beginPath();
        g.ellipse(x + 80, LH, 140, 70, 0, Math.PI, 0);
        g.fill();
      }
      g.fillStyle = shade(bg[1], 0.08);
      for (let x = 0; x < LW; x += 8) g.fillRect(x, LH - 40 - Math.sin(x * 0.02) * 10, 2, 40);
      g.fillStyle = bg[1];
      g.fillRect(300, LH - 150, 90, 150);
      tri(296, LH - 150, 98, 40);
      g.fillRect(320, LH - 210, 14, 60);
      break;
    case 23: // 감옥 벽과 쇠창살 창
      for (let x = 0; x < LW; x += 70 + r() * 30) {
        const h = 120 + r() * 100;
        g.fillRect(x, LH - h, 50, h);
        g.fillStyle = shade(bg[0], -0.2);
        g.fillRect(x + 16, LH - h + 20, 16, 22);
        g.fillStyle = bg[1];
        for (let k = 0; k < 3; k++) g.fillRect(x + 19 + k * 5, LH - h + 20, 1, 22);
      }
      break;
    case 24: // 고딕 첨탑과 장미창
      for (let x = 0; x < LW; x += 60 + r() * 40) {
        const h = 100 + r() * 110;
        g.fillRect(x, LH - h, 20, h);
        tri(x - 2, LH - h, 24, 40);
      }
      g.fillStyle = 'rgba(255,80,96,0.25)';
      g.beginPath();
      g.arc(320, 100, 34, 0, Math.PI * 2);
      g.fill();
      break;
    case 25: // 빽빽한 침엽수
      for (let x = -10; x < LW; x += 18 + r() * 14) {
        const h = 90 + r() * 120;
        tri(x, LH, 30 + r() * 10, h);
      }
      break;
    case 26: // 핏빛 달과 궁전 탑
      g.fillStyle = 'rgba(255,64,112,0.35)';
      g.beginPath();
      g.arc(120, 70, 30, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = bg[1];
      for (let x = 0; x < LW; x += 70 + r() * 40) {
        const h = 90 + r() * 110;
        g.fillRect(x, LH - h, 24, h);
        g.beginPath();
        g.ellipse(x + 12, LH - h, 14, 18, 0, Math.PI, 0);
        g.fill();
        g.fillRect(x + 11, LH - h - 30, 2, 14);
      }
      break;
    case 31: // 바다 기둥 바위와 수평선
      g.fillStyle = shade(bg[1], 0.06);
      g.fillRect(0, LH - 70, LW, 70);
      g.fillStyle = bg[1];
      for (let x = 10; x < LW; x += 90 + r() * 70) {
        const h = 60 + r() * 110;
        g.fillRect(x, LH - h, 22 + r() * 14, h);
        tri(x - 4, LH - h, 34, 16);
      }
      break;
    case 32: // 돌이 된 거목
      for (let x = 0; x < LW; x += 70 + r() * 50) {
        const h = 120 + r() * 100;
        g.fillRect(x, LH - h, 16, h);
        g.fillRect(x - 14, LH - h + 10, 44, 6);
        g.fillRect(x - 20, LH - h + 4, 6, 12);
        g.fillRect(x + 28, LH - h, 6, 16);
      }
      break;
    case 33: // 바늘 같은 첨탑과 번개
      for (let x = 0; x < LW; x += 50 + r() * 40) {
        const h = 120 + r() * 120;
        tri(x, LH, 18, h);
      }
      g.strokeStyle = 'rgba(200,230,255,0.35)';
      g.lineWidth = 1;
      for (let i = 0; i < 4; i++) {
        let x = r() * LW;
        let y = 0;
        g.beginPath();
        g.moveTo(x, y);
        while (y < 150) {
          x += (r() - 0.5) * 20;
          y += 12 + r() * 10;
          g.lineTo(x, y);
        }
        g.stroke();
      }
      break;
    case 34: // 거울 판
      for (let x = 0; x < LW; x += 40 + r() * 30) {
        const h = 60 + r() * 140;
        const y = LH - h - r() * 40;
        g.fillStyle = bg[1];
        g.fillRect(x, y, 26, h);
        g.fillStyle = 'rgba(255,255,255,0.12)';
        g.fillRect(x + 4, y + 4, 3, h - 8);
      }
      break;
    case 35: // 부서진 기둥과 거대한 시계
      g.strokeStyle = shade(bg[1], 0.1);
      g.lineWidth = 3;
      g.beginPath();
      g.arc(360, 100, 60, 0, Math.PI * 2);
      g.stroke();
      g.beginPath();
      g.moveTo(360, 100);
      g.lineTo(360, 54);
      g.moveTo(360, 100);
      g.lineTo(396, 112);
      g.stroke();
      g.fillStyle = bg[1];
      for (let x = 0; x < LW; x += 60 + r() * 50) {
        const h = 40 + r() * 120;
        g.fillRect(x, LH - h, 18, h);
        g.fillRect(x - 3, LH - h, 24, 5);
      }
      break;
    case 41: // 떠 있는 부두와 돛대, 구름
    case 45: // 하늘 회랑: 떠 있는 아치와 구름
      g.fillStyle = 'rgba(255,255,255,0.1)';
      for (let i = 0; i < 12; i++) {
        g.beginPath();
        g.ellipse(r() * LW, 60 + r() * 170, 50 + r() * 60, 10 + r() * 12, 0, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = bg[1];
      for (let x = 10; x < LW; x += 120 + r() * 70) {
        const y = 90 + r() * 110;
        if (kind === 41) {
          g.fillRect(x, y, 70, 8);
          g.fillRect(x + 30, y - 70, 3, 70);
          g.beginPath();
          g.moveTo(x + 33, y - 66);
          g.lineTo(x + 58, y - 30);
          g.lineTo(x + 33, y - 24);
          g.fill();
          for (let k = 0; k < 4; k++) g.fillRect(x + 6 + k * 18, y + 8, 3, 18 + r() * 20);
        } else {
          g.fillRect(x, y, 10, LH - y);
          g.fillRect(x + 60, y, 10, LH - y);
          g.beginPath();
          g.arc(x + 35, y, 35, Math.PI, 0);
          g.lineWidth = 8;
          g.strokeStyle = bg[1];
          g.stroke();
        }
      }
      break;
    case 42: // 위로 거슬러 오르는 물줄기
      g.fillStyle = bg[1];
      for (let x = 0; x < LW; x += 60 + r() * 50) {
        const w = 14 + r() * 20;
        g.fillRect(x, 0, w, LH);
        g.fillStyle = 'rgba(200,250,255,0.12)';
        for (let y = 0; y < LH; y += 10 + r() * 16) g.fillRect(x + r() * w, y, 2, 6);
        g.fillStyle = bg[1];
      }
      break;
    case 43: // 거대한 고래 갈비뼈
      for (let i = 0; i < 9; i++) {
        const x = 40 + i * 70;
        g.strokeStyle = bg[1];
        g.lineWidth = 9;
        g.beginPath();
        g.arc(x + 60, LH + 20, 120 + (i % 3) * 10, Math.PI * 1.05, Math.PI * 1.45);
        g.stroke();
      }
      g.fillStyle = bg[1];
      g.fillRect(0, LH - 24, LW, 24);
      break;
    case 44: // 깃털 첨탑의 사원
      for (let x = 0; x < LW; x += 80 + r() * 40) {
        const h = 90 + r() * 110;
        g.fillRect(x, LH - h, 26, h);
        g.beginPath();
        g.moveTo(x - 6, LH - h);
        g.quadraticCurveTo(x + 13, LH - h - 60, x + 32, LH - h);
        g.fill();
      }
      g.fillStyle = 'rgba(255,240,208,0.15)';
      for (let i = 0; i < 20; i++) g.fillRect(r() * LW, r() * LH, 2, 5);
      break;
    case 46: // 하늘을 가르는 상처
    case 56: // 바깥의 문
      stars(60, kind === 46 ? 'rgba(224,192,255,A)' : 'rgba(160,255,224,A)');
      g.strokeStyle = kind === 46 ? 'rgba(224,192,255,0.5)' : 'rgba(160,255,224,0.45)';
      g.lineWidth = 3;
      g.beginPath();
      if (kind === 46) {
        g.moveTo(80, 10);
        for (let k = 1; k <= 8; k++) g.lineTo(80 + k * 60 + (r() - 0.5) * 30, 10 + k * 22);
      } else {
        g.rect(270, 40, 100, 170);
        g.moveTo(320, 40);
        g.lineTo(320, 210);
      }
      g.stroke();
      g.fillStyle = bg[1];
      for (let i = 0; i < 26; i++) g.fillRect(r() * LW, 120 + r() * 150, 3 + r() * 10, 2 + r() * 6);
      break;
    case 51: // 기울어진 등대와 수면
      g.fillStyle = 'rgba(255,232,160,0.08)';
      g.beginPath();
      g.moveTo(330, 70);
      g.lineTo(640, 30);
      g.lineTo(640, 120);
      g.fill();
      g.fillStyle = bg[1];
      g.fillRect(310, 70, 40, LH - 70);
      g.fillRect(304, 60, 52, 12);
      for (let x = 0; x < LW; x += 70 + r() * 60) {
        const h = 40 + r() * 70;
        g.fillRect(x, LH - h, 30, h);
      }
      g.fillStyle = 'rgba(160,220,255,0.06)';
      g.fillRect(0, 40, LW, 4);
      break;
    case 52: // 산호와 묘비
      for (let x = 0; x < LW; x += 40 + r() * 40) {
        const h = 50 + r() * 100;
        g.fillRect(x, LH - h, 6, h);
        for (let k = 0; k < 3; k++) g.fillRect(x + (k % 2 ? 6 : -8), LH - h + 10 + k * 20, 8, 4);
        if (r() < 0.5) {
          g.fillRect(x + 16, LH - 30, 14, 30);
          g.beginPath();
          g.arc(x + 23, LH - 30, 7, Math.PI, 0);
          g.fill();
        }
      }
      break;
    case 53: // 해구의 절벽
      for (let x = 0; x < LW; x += 30 + r() * 30) {
        const h = 160 + r() * 100;
        g.fillRect(x, LH - h, 26, h);
      }
      g.fillStyle = 'rgba(112,144,255,0.12)';
      for (let i = 0; i < 14; i++) g.fillRect(r() * LW, r() * LH, 2, 2);
      break;
    case 54: // 거꾸로 매달린 도시
      for (let x = 0; x < LW; x += 46 + r() * 30) {
        const h = 60 + r() * 120;
        g.fillRect(x, 0, 34, h);
        tri(x - 2, h, 38, -16);
        g.fillStyle = 'rgba(255,208,128,0.2)';
        for (let y = 10; y < h - 10; y += 16) g.fillRect(x + 8, y, 5, 6);
        g.fillStyle = bg[1];
        const h2 = 40 + r() * 60;
        g.fillRect(x + 6, LH - h2, 26, h2);
      }
      break;
    case 55: // 검은 오로라와 빙산
      for (let k = 0; k < 3; k++) {
        g.strokeStyle = `rgba(128,255,192,${0.12 + k * 0.05})`;
        g.lineWidth = 10 - k * 3;
        g.beginPath();
        for (let x = 0; x <= LW; x += 20) g.lineTo(x, 50 + k * 18 + Math.sin(x * 0.015 + k) * 24);
        g.stroke();
      }
      g.fillStyle = bg[1];
      for (let x = -20; x < LW; x += 90 + r() * 60) tri(x, LH, 70 + r() * 40, 50 + r() * 70);
      break;
    default: // 36 계약의 근원: 동심원과 빛줄기
      g.strokeStyle = 'rgba(255,240,192,0.18)';
      g.lineWidth = 1;
      for (let i = 1; i < 8; i++) {
        g.beginPath();
        g.arc(320, 120, i * 26, 0, Math.PI * 2);
        g.stroke();
      }
      g.fillStyle = 'rgba(255,240,192,0.06)';
      for (let i = 0; i < 6; i++) g.fillRect(40 + i * 100 + r() * 20, 0, 10, LH);
      g.fillStyle = bg[1];
      for (let x = 20; x < LW; x += 110 + r() * 60) g.fillRect(x, 60 + r() * 120, 12, 40 + r() * 50);
  }
}

/** 스토리 2~4 테마의 중간 배경 */
function storyMid(g: CanvasRenderingContext2D, kind: number, col: string, alpha: number, r: () => number): void {
  g.globalAlpha = alpha;
  g.fillStyle = col;
  for (let x = 0; x < LW; x += 90 + Math.floor(r() * 60)) {
    const h = 110 + r() * 80;
    switch (kind) {
      case 14:
      case 31:
      case 52: // 덩굴 기둥 / 산호 기둥
        g.fillRect(x, LH - h, 12, h);
        for (let y = LH - h; y < LH; y += 14) g.fillRect(x + (y % 28 ? -6 : 12), y, 6, 4);
        break;
      case 25:
      case 32: // 굵은 나무줄기
        g.fillRect(x, LH - h - 40, 18, h + 40);
        g.fillRect(x + 18, LH - h + 10, 22, 4);
        g.fillRect(x - 18, LH - h + 30, 18, 4);
        break;
      case 23:
      case 41:
      case 51: // 늘어진 쇠사슬 / 닻줄
        g.fillRect(x, 0, 10, LH);
        for (let y = 0; y < 80 + r() * 60; y += 6) g.fillRect(x + 40, y, 2, 4);
        break;
      case 15:
      case 35:
      case 54: // 톱니바퀴
        g.beginPath();
        g.arc(x + 30, LH - h + 30, 26, 0, Math.PI * 2);
        g.fill();
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          g.fillRect(x + 30 + Math.cos(a) * 28 - 3, LH - h + 30 + Math.sin(a) * 28 - 3, 6, 6);
        }
        break;
      case 34: // 기울어진 거울
        g.fillRect(x, LH - h, 30, h);
        g.globalAlpha = alpha * 0.4;
        g.fillStyle = '#ffffff';
        g.fillRect(x + 6, LH - h + 6, 2, h - 12);
        g.globalAlpha = alpha;
        g.fillStyle = col;
        break;
      default: // 아치 회랑
        g.fillRect(x, LH - h, 14, h);
        g.fillRect(x + 54, LH - h, 14, h);
        g.beginPath();
        g.arc(x + 34, LH - h + 10, 34, Math.PI, 0);
        g.lineWidth = 9;
        g.strokeStyle = col;
        g.stroke();
    }
  }
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
