import { app, type Scene } from '../app';
import { audio } from '../core/audio';
import { text } from '../gfx/renderer';
import { keyHint } from '../ui/widgets';

/** 스토리 인트로·엔딩: 한 줄씩 떠오르는 이야기 화면. 끝나면 next()로 이어진다. */
export class StoryTextScene implements Scene {
  t = 0;
  private done = false;
  constructor(
    private title: string,
    private sub: string,
    private lines: string[],
    private next: () => void,
    private accent = '#ffe0a0',
  ) {}
  enter(): void {
    audio.playMusic('title');
  }
  private get total(): number {
    return this.lines.length * 36 + 60;
  }
  update(): void {
    this.t++;
    if (this.t > 20 && (app.input.menu('ok') || app.input.menu('back'))) {
      if (this.t < this.total) this.t = this.total;
      else if (!this.done) {
        this.done = true;
        this.next();
      }
    }
  }
  world(g: CanvasRenderingContext2D): void {
    g.fillStyle = '#05030a';
    g.fillRect(0, 0, 480, 270);
    for (let i = 0; i < 60; i++) {
      const x = (i * 89) % 480;
      const y = (i * 37 + this.t * 0.2 * (1 + (i % 3))) % 270;
      g.fillStyle = i % 4 ? 'rgba(158,240,255,0.3)' : 'rgba(255,224,160,0.35)';
      g.fillRect(x, 270 - y, 1, 1);
    }
  }
  ui(g: CanvasRenderingContext2D): void {
    const a0 = Math.min(1, this.t / 30);
    text(g, this.title, 240, 14, { size: 14, align: 'center', color: this.accent, bold: true, alpha: a0 });
    text(g, this.sub, 240, 34, { size: 7, align: 'center', color: '#a8a0c0', alpha: a0 });
    this.lines.forEach((l, i) => {
      const a = Math.max(0, Math.min(1, (this.t - 40 - i * 36) / 30));
      text(g, l, 240, 56 + i * 17, { size: 8, align: 'center', color: '#d8d0e8', alpha: a });
    });
    keyHint(g, [[app.input.label('attack'), this.t < this.total ? '넘기기' : '계속']]);
  }
}
