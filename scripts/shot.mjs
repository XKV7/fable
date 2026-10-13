import { chromium } from 'playwright';
const [url, out, w, h] = process.argv.slice(2);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: +w || 1280, height: +h || 800 } });
p.on('console', m => { if (m.type()==='error') console.log('ERR', m.text()); });
p.on('pageerror', e => console.log('PAGEERR', e.message));
await p.goto(url); await p.waitForTimeout(2500);
await p.locator('canvas').first().screenshot({ path: out });
await b.close();
