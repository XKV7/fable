// 개발용: 키 시퀀스를 입력하며 스크린샷을 찍는 탐색 스크립트
import { chromium } from 'playwright';
const [url, outDir, ...steps] = process.argv.slice(2);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 960, height: 540 } });
const errors = [];
p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') { errors.push(m.text()); console.log(m.type(), m.text()); } });
p.on('pageerror', (e) => { errors.push(e.message); console.log('PAGEERR', e.message, e.stack); });
await p.goto(url);
await p.waitForTimeout(1500);
await p.locator('canvas').click();
let n = 0;
for (const s of steps) {
  if (s.startsWith('wait:')) await p.waitForTimeout(+s.slice(5));
  else if (s.startsWith('shot:')) { await p.screenshot({ path: `${outDir}/${s.slice(5)}.png` }); n++; }
  else if (s.startsWith('hold:')) { const [k, ms] = s.slice(5).split('@'); await p.keyboard.down(k); await p.waitForTimeout(+ms); await p.keyboard.up(k); }
  else if (s.startsWith('eval:')) { console.log('EVAL', await p.evaluate(s.slice(5))); }
  else { await p.keyboard.press(s); await p.waitForTimeout(120); }
}
console.log('errors:', errors.length);
await b.close();
