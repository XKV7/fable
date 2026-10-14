// 개발용: 모든 영웅 해금 후 UI 화면과 신규 영웅 기술 스크린샷
import { chromium } from 'playwright';
const [url, out] = process.argv.slice(2);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 960, height: 540 } });
const errors = [];
p.on('console', (m) => { if (m.type() === 'error') { errors.push(m.text()); console.log('ERR', m.text()); } });
p.on('pageerror', (e) => { errors.push(e.message); console.log('PAGEERR', e.message, e.stack); });
await p.goto(url);
await p.waitForTimeout(1500);
await p.locator('canvas').click();
await p.evaluate(async () => {
  const { CHARACTERS } = await import('/src/data/characters.ts');
  const app = window.__app;
  for (const c of CHARACTERS) app.save.chars[c.id] = app.save.chars[c.id] ?? { lv: 1, aw: 0, count: 1 };
  app.save.tutorialDone = true;
});
const go = async (mod, cls, extra = '') => {
  await p.evaluate(`(async () => { const m = await import('${mod}'); const s = new m.${cls}(window.__app.scene); window.__app.go(s, false); ${extra} })()`);
  await p.waitForTimeout(500);
};
await go('/src/scenes/codex.ts', 'CodexScene', 's.sel = 20;');
await p.screenshot({ path: `${out}/codex.png` });
await go('/src/scenes/growth.ts', 'GrowthScene', 's.sel = 20;');
await p.screenshot({ path: `${out}/growth.png` });
await go('/src/scenes/loadout.ts', 'LoadoutScene', "s.picking = 'char'; s.pick = 17;");
await p.screenshot({ path: `${out}/loadout.png` });
await go('/src/scenes/gacha.ts', 'GachaScene', 's.banner = 1;');
await p.screenshot({ path: `${out}/gacha1.png` });
await go('/src/scenes/gacha.ts', 'GachaScene', 's.banner = 0;');
await p.screenshot({ path: `${out}/gacha0.png` });
const pairs = [['marionne', 'ignia'], ['seira', 'bram'], ['jolly', 'freya'], ['hawin', 'dor'], ['lyra', 'kai'], ['bern', 'bolt']];
for (const [a, c] of pairs) {
  await p.evaluate(async ([a, c]) => {
    const { RunState } = await import('/src/game/run.ts');
    const { RunScene } = await import('/src/scenes/run.ts');
    const app = window.__app;
    app.save.loadout.chars = [a, c];
    app.go(new RunScene(new RunState(app.save)), false);
  }, [a, c]);
  await p.waitForTimeout(2500);
  for (let k = 0; k < 2; k++) {
    // 콤보
    for (let i = 0; i < 5; i++) { await p.keyboard.press('KeyJ'); await p.waitForTimeout(140); }
    await p.keyboard.press('KeyE'); await p.waitForTimeout(260);
    await p.screenshot({ path: `${out}/run_${k ? c : a}_s1.png` });
    await p.waitForTimeout(500);
    await p.keyboard.press('KeyR'); await p.waitForTimeout(300);
    await p.screenshot({ path: `${out}/run_${k ? c : a}_s2.png` });
    await p.waitForTimeout(600);
    await p.keyboard.press('KeyG'); await p.waitForTimeout(200);
    await p.screenshot({ path: `${out}/run_${k ? c : a}_swap.png` });
    await p.waitForTimeout(700);
  }
}
console.log('errors:', errors.length);
await b.close();
