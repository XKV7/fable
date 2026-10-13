import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 960, height: 540 } });
p.on('pageerror', (e) => console.log('PAGEERR', e.message, e.stack));
await p.goto('http://localhost:5199/');
await p.waitForTimeout(1500);
for (let ev = 0; ev < 8; ev++) for (let ch = 0; ch < 3; ch++) {
  const r = await Promise.race([
    p.evaluate(async ([ev, ch]) => {
      const { RunScene } = await import('/src/scenes/run.ts');
      const { RunState } = await import('/src/game/run.ts');
      const { EventOverlay } = await import('/src/scenes/overlays.ts');
      const { EVENTS } = await import('/src/data/meta.ts');
      const app = window.__app;
      app.save.chars.rina = { lv: 1, aw: 0, count: 1 };
      app.save.loadout.chars = ['kael', 'rina'];
      const run = new RunState(app.save);
      run.gold = 999;
      run.items.push('potion');
      const s = new RunScene(run);
      app.go(s, false);
      const o = new EventOverlay(run, s.room, () => (s.queued = () => {}), () => {}, () => {}, () => (s.queued = () => s['ambush']()));
      o.ev = EVENTS[ev];
      o.menu.items = o.ev.choices.map((c) => ({ label: c.label }));
      o.menu.sel = ch;
      s.overlay = o;
      return 'ok';
    }, [ev, ch]),
    new Promise((res) => setTimeout(() => res('TIMEOUT-setup'), 5000)),
  ]);
  await p.keyboard.press('Enter');
  await p.waitForTimeout(150);
  await p.keyboard.press('Enter');
  await p.waitForTimeout(300);
  const alive = await Promise.race([p.evaluate(() => window.__app.frame), new Promise((res) => setTimeout(() => res('HUNG'), 3000))]);
  console.log(ev, ch, r, alive);
  if (alive === 'HUNG') process.exit(1);
}
await b.close();
