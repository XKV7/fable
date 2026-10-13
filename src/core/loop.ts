export const STEP = 1 / 60;

/** 고정 타임스텝(60Hz) 루프. update는 항상 1/60초 단위, render는 매 프레임. */
export class Loop {
  private acc = 0;
  private last = 0;
  private running = false;
  fps = 60;
  private fpsAcc = 0;
  private fpsFrames = 0;

  constructor(
    private update: () => void,
    private render: () => void,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const frame = (now: number): void => {
      if (!this.running) return;
      let dt = (now - this.last) / 1000;
      this.last = now;
      if (dt > 0.25) dt = 0.25;
      this.acc += dt;
      this.fpsAcc += dt;
      this.fpsFrames++;
      if (this.fpsAcc >= 0.5) {
        this.fps = Math.round(this.fpsFrames / this.fpsAcc);
        this.fpsAcc = 0;
        this.fpsFrames = 0;
      }
      let steps = 0;
      while (this.acc >= STEP && steps < 6) {
        this.update();
        this.acc -= STEP;
        steps++;
      }
      if (steps >= 6) this.acc = 0;
      this.render();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }
}
