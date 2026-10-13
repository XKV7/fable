import { app, type Scene } from '../app';
import { ACTIONS, ACTION_LABELS, keyName, padName } from '../core/input';
import { text } from '../gfx/renderer';
import { keyHint, panel } from '../ui/widgets';

const EXTRA: [string, string][] = [
  ['콤보', '기본 공격을 연타 (캐릭터마다 3~5타). 마지막 타격은 강력한 피니시'],
  ['대시 캔슬', '공격 도중 언제든 대시로 끊을 수 있다. 대시 중에는 무적'],
  ['대시 공격', '대시 중/직후에 공격 키'],
  ['공중', '2단 점프 + 공중 대시 1회. 공중 공격 가능'],
  ['발판', '아래 + 점프로 일방향 발판 아래로'],
  ['교대', '대기 영웅이 교대 공격과 함께 등장 (적중 시 슬로모션)'],
];

export class ControlsScene implements Scene {
  constructor(public back: Scene) {}
  update(): void {
    if (app.input.menu('back') || app.input.menu('ok')) app.go(this.back, false);
  }
  world(g: CanvasRenderingContext2D): void {
    this.back.world(g);
  }
  ui(g: CanvasRenderingContext2D): void {
    g.fillStyle = 'rgba(4,2,10,0.85)';
    g.fillRect(0, 0, 480, 270);
    text(g, '조작법', 240, 10, { size: 14, align: 'center', color: '#e0d0ff', bold: true });
    panel(g, 16, 32, 210, 220);
    text(g, '행동', 26, 38, { size: 7, color: '#8a8098' });
    text(g, '키보드', 140, 38, { size: 7, color: '#8a8098' });
    text(g, '패드', 196, 38, { size: 7, color: '#8a8098' });
    ACTIONS.forEach((a, i) => {
      const b = app.input.bindings[a];
      const y = 52 + i * 14;
      text(g, ACTION_LABELS[a], 26, y, { size: 7, color: '#f0e8d8' });
      text(g, b.keys.map(keyName).join(' / '), 140, y, { size: 7, color: '#ffe080' });
      text(g, b.pad.map(padName).join('/'), 196, y, { size: 7, color: '#a0d0ff' });
    });
    panel(g, 234, 32, 230, 220);
    text(g, '전투 요령', 244, 38, { size: 8, color: '#e0d0ff', bold: true });
    EXTRA.forEach(([k, v], i) => {
      text(g, k, 244, 56 + i * 30, { size: 7, color: '#ffe080', bold: true });
      text(g, v, 244, 67 + i * 30, { size: 6, color: '#c8c0d8', maxW: 214 });
    });
    text(g, '` (백틱): 디버그 오버레이 (FPS·히트박스·치트)', 244, 240, { size: 6, color: '#80ffa0' });
    keyHint(g, [['Esc', '돌아가기']], 258);
  }
}
