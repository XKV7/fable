import { app, type Scene } from '../app';
import { audio } from '../core/audio';
import { text } from '../gfx/renderer';
import { keyHint } from '../ui/widgets';
import { HubScene } from './hub';

const LINES = [
  '한때 빛나던 왕국 아스펠은 하룻밤 사이에 무너졌다.',
  '왕은 죽음을 거부했고, 스스로 「끝없는 왕」이 되어',
  '왕국의 모든 혼을 지하 묘소에 가두었다.',
  '',
  '그대는 계약자.',
  '영혼석으로 쓰러진 영웅들의 혼을 불러내 계약하고,',
  '그들의 몸을 빌려 싸울 수 있는 유일한 자.',
  '',
  '계약의 성소에서 영웅을 부르고, 묘소의 가장 깊은 곳으로 내려가라.',
  '끝없는 왕에게 끝을 선사하라.',
];

export class IntroScene implements Scene {
  t = 0;
  enter(): void {
    audio.playMusic('title');
  }
  update(): void {
    this.t++;
    if (this.t > 20 && (app.input.menu('ok') || app.input.menu('back'))) {
      if (this.t < LINES.length * 40 + 40) this.t = LINES.length * 40 + 40;
      else this.finish();
    }
  }
  private finish(): void {
    app.save.introSeen = true;
    app.persist();
    app.go(new HubScene());
  }
  world(g: CanvasRenderingContext2D): void {
    g.fillStyle = '#05030a';
    g.fillRect(0, 0, 480, 270);
    for (let i = 0; i < 50; i++) {
      const x = (i * 89) % 480;
      const y = (i * 37 + this.t * 0.2 * (1 + (i % 3))) % 270;
      g.fillStyle = 'rgba(158,240,255,0.35)';
      g.fillRect(x, 270 - y, 1, 1);
    }
  }
  ui(g: CanvasRenderingContext2D): void {
    LINES.forEach((l, i) => {
      const a = Math.max(0, Math.min(1, (this.t - i * 40) / 30));
      text(g, l, 240, 40 + i * 18, { size: 9, align: 'center', color: i >= 4 && i <= 6 ? '#ffe0a0' : '#d8d0e8', alpha: a });
    });
    keyHint(g, [[app.input.label('attack'), this.t < LINES.length * 40 + 40 ? '넘기기' : '성소로']]);
  }
}
