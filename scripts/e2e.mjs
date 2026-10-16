// E2E: 헤드리스 브라우저로 회원가입 → 타이틀 → 첫 가챠 10연 → 편성 → 런 시작 → 이동/공격/교대 → 디버그 치트로 보스방
// 콘솔 에러 0개를 확인하고 주요 장면 스크린샷을 screenshots/ 에 저장한다.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const PORT = 5299;
const URL = `http://localhost:${PORT}/`;
const OUT = 'screenshots';
mkdirSync(OUT, { recursive: true });

const server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { stdio: 'pipe', shell: process.platform === 'win32' });
await new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error('vite 시작 시간 초과')), 30000);
  server.stdout.on('data', (d) => {
    if (String(d).includes('Local')) {
      clearTimeout(t);
      res();
    }
  });
});

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
page.on('pageerror', (e) => errors.push(e.message));

const wait = (ms) => page.waitForTimeout(ms);
const press = async (k, ms = 120) => {
  await page.keyboard.press(k);
  await wait(ms);
};
const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png` });
const scene = () => page.evaluate(() => window.__app.scene.constructor.name);
/** 거점에서 시설 앞까지 걸어간다 */
async function walkTo(hub) {
  for (let i = 0; i < 80; i++) {
    const d = await page.evaluate((hub) => {
      const r = window.__app.scene.room;
      const p = r.props.find((x) => x.hub === hub);
      return p.x - r.player.cx;
    }, hub);
    if (Math.abs(d) < 10) return;
    const k = d > 0 ? 'KeyD' : 'KeyA';
    await page.keyboard.down(k);
    await wait(Math.min(400, Math.abs(d) * 6));
    await page.keyboard.up(k);
  }
  throw new Error(`${hub}에 도달하지 못함`);
}
const step = (msg) => console.log(`▶ ${msg}`);

try {
  await page.goto(URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await wait(2000);
  step(`회원가입 (${await scene()})`);
  await shot('00_signup');
  await page.click('.pact-auth .tabs button[data-m=signup]');
  await page.fill('.pact-auth input[name=id]', 'tester01');
  await page.fill('.pact-auth input[name=pw]', 'pass1234');
  await page.fill('.pact-auth input[name=pw2]', 'pass9999');
  await page.click('.pact-auth .go');
  await wait(300);
  if (!(await page.textContent('.pact-auth .err')).includes('확인')) throw new Error('비밀번호 확인 불일치 안내가 없음');
  await page.fill('.pact-auth input[name=pw2]', 'pass1234');
  await page.click('.pact-auth .go');
  await wait(2000);
  if ((await scene()) !== 'TitleScene') throw new Error(`가입 후 타이틀로 가지 않음: ${await scene()}`);
  if (await page.$('.pact-auth')) throw new Error('가입 후 로그인 창이 남아 있음');
  await page.locator('canvas').click();
  step('타이틀');
  await shot('01_title');
  await press('Enter', 800);
  step(`인트로 (${await scene()})`);
  await press('Enter', 300);
  await press('Enter', 1500);
  step(`거점 (${await scene()})`);
  await shot('02_hub');

  step('첫 가챠 무료 10연');
  await walkTo('gacha');
  await press('KeyF', 1200);
  await shot('03_gacha_menu');
  await press('Enter', 1700);
  await shot('04_gacha_beam');
  const phase = () => page.evaluate(() => window.__app.scene.phase);
  for (let i = 0; i < 20 && (await phase()) !== 'cards'; i++) await press('KeyJ', 300);
  await press('KeyJ', 400);
  await press('KeyJ', 400);
  await shot('05_gacha_cards');
  for (let i = 0; i < 60 && (await phase()) !== 'summary'; i++) {
    if ((await phase()) === 'reveal') await shot('05b_gacha_reveal');
    await press('KeyJ', 450);
  }
  await wait(400);
  await shot('06_gacha_summary');
  if ((await phase()) !== 'summary') throw new Error('가챠 결과 요약 화면에 도달하지 못함');
  const owned = await page.evaluate(() => Object.keys(window.__app.save.chars).length);
  if (owned < 2) throw new Error('첫 10연 후 보유 영웅이 2명 미만');
  await press('Enter', 500);
  await press('Escape', 1500);
  step(`편성 (${await scene()})`);
  await walkTo('portal');
  await press('KeyF', 1200);
  await shot('07_loadout');
  await press('Enter', 2500);
  step(`런 시작 (${await scene()})`);
  await shot('08_run_start');

  step('이동/공격/점프/대시/교대');
  await page.keyboard.down('KeyD');
  for (const k of ['KeyJ', 'KeyJ', 'KeyJ', 'KeyW', 'Space', 'ShiftLeft', 'KeyJ', 'KeyJ']) await press(k, 140);
  await page.keyboard.up('KeyD');
  await shot('09_run_combat');
  await press('KeyG', 200);
  await shot('10_run_swap');
  await press('KeyE', 300);
  await press('KeyR', 300);
  await page.keyboard.down('KeyD');
  await wait(1200);
  await page.keyboard.up('KeyD');
  await press('Tab', 400);
  await shot('11_build');
  await press('Tab', 300);

  step('디버그 치트로 보스방 이동');
  await press('Backquote', 200);
  if (await page.evaluate(() => window.__app.debug)) throw new Error('` 단독으로 디버그가 켜지면 안 됨');
  await press('Control+Shift+Backquote', 200);
  if (await page.evaluate(() => window.__app.debug)) throw new Error('Ctrl+Shift+` 만으로 디버그가 켜지면 안 됨');
  for (const k of ['Control', 'Shift', 'Backquote', 'Space']) { await page.keyboard.down(k); await wait(40); }
  await wait(100);
  for (const k of ['Space', 'Backquote', 'Shift', 'Control']) await page.keyboard.up(k);
  await wait(200);
  if (!(await page.evaluate(() => window.__app.debug))) throw new Error('Ctrl+Shift+`+Space 로 디버그가 켜져야 함');
  await press('Digit1', 200);
  await press('Digit4', 3000);
  await shot('12_boss_intro');
  await wait(2000);
  for (let i = 0; i < 10; i++) await press(i % 3 === 2 ? 'KeyE' : 'KeyJ', 150);
  await shot('13_boss_fight');
  const bossOk = await page.evaluate(() => !!window.__app.scene.room.boss);
  if (!bossOk) throw new Error('보스방에 보스가 없음');

  step('런 도중 새로고침 → 자동 로그인 → 런 이어하기');
  const before = await page.evaluate(() => { const r = window.__app.scene.run; return { ch: r.chapter, theme: r.theme, cur: r.cur, relics: r.relics.length }; });
  await page.reload();
  await wait(2500);
  if ((await scene()) !== 'TitleScene') throw new Error(`새로고침 후 자동 로그인 실패: ${await scene()}`);
  const items = await page.evaluate(() => window.__app.scene.menu.items.map((i) => i.label));
  if (items[0] !== '런 이어하기') throw new Error(`런 이어하기 메뉴 없음: ${items}`);
  await page.focus('canvas'); // 클릭하면 마우스 위치의 메뉴가 눌리므로 포커스만
  await press('Enter', 2500);
  await shot('14_resume');
  const after = await page.evaluate(() => { const s = window.__app.scene; const r = s.run; return { scene: s.constructor.name, ch: r?.chapter, theme: r?.theme, cur: r?.cur, relics: r?.relics.length, boss: !!s.room?.boss }; });
  if (after.scene !== 'RunScene' || after.cur !== before.cur || after.theme !== before.theme || after.relics !== before.relics || !after.boss) throw new Error(`이어하기 상태 불일치: ${JSON.stringify(before)} → ${JSON.stringify(after)}`);

  step('로그아웃 → 다른 계정 → 원래 계정 로그인');
  await page.evaluate(async () => {
    const { AuthScene } = await import('/src/scenes/auth.ts');
    window.__app.logout();
    window.__app.go(new AuthScene(), false);
  });
  await wait(500);
  await page.fill('.pact-auth input[name=id]', 'tester01');
  await page.fill('.pact-auth input[name=pw]', 'wrongpw1');
  await page.click('.pact-auth .go');
  await wait(800);
  if (!(await page.textContent('.pact-auth .err')).includes('틀렸다')) throw new Error('잘못된 비밀번호 안내가 없음');
  await page.fill('.pact-auth input[name=pw]', 'pass1234');
  await page.click('.pact-auth .go');
  await wait(2000);
  const owned2 = await page.evaluate(() => Object.keys(window.__app.save.chars).length);
  if (owned2 < 2 || !(await page.evaluate(() => !!window.__app.save.run))) throw new Error('다시 로그인했는데 기록이 없음');
} catch (e) {
  errors.push(`E2E 실패: ${e.message}`);
  await shot('99_failure');
}

await browser.close();
server.kill();
if (errors.length) {
  console.error(`콘솔 에러 ${errors.length}개:`);
  for (const e of errors) console.error('  ' + e);
  process.exit(1);
}
console.log(`✔ E2E 통과 — 콘솔 에러 0개, 스크린샷: ${OUT}/`);
process.exit(0);
