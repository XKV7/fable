// 개발용 소크 테스트: 모든 영웅 조합으로 런 전체를 자동 진행하며 런타임 오류를 수집한다.
import { chromium } from 'playwright';
const url = process.argv[2] ?? 'http://localhost:5199/';
const runs = +(process.argv[3] ?? 3);
const shotDir = process.argv[4] || '';
const start = +(process.argv[5] ?? 0);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 960, height: 540 } });
const errors = [];
p.on('console', (m) => { if (m.type() === 'error') { errors.push(m.text()); console.log('ERR', m.text()); } });
p.on('pageerror', (e) => { errors.push(e.message); console.log('PAGEERR', e.message, e.stack?.split('\n').slice(0, 4).join(' | ')); });
await p.goto(url);
await p.waitForTimeout(1500);
await p.locator('canvas').click();
const keys = ['KeyJ', 'KeyJ', 'KeyJ', 'KeyE', 'KeyR', 'KeyG', 'KeyW', 'KeyQ', 'KeyJ', 'KeyK'];
for (let r = start; r < start + runs; r++) {
  await p.evaluate(async (r) => {
    const { RunScene } = await import('/src/scenes/run.ts');
    const { RunState } = await import('/src/game/run.ts');
    const { CHARACTERS } = await import('/src/data/characters.ts');
    const { WEAPONS } = await import('/src/data/weapons.ts');
    const app = window.__app;
    const ids = CHARACTERS.map((c) => c.id);
    for (const id of ids) app.save.chars[id] = { lv: 12, aw: (r % 6), count: 1 };
    for (const w of WEAPONS) app.save.weapons[w.id] = { rf: 1 + (r % 5), count: 1 };
    app.save.loadout.chars = [ids[(r * 2) % ids.length], ids[(r * 2 + 1) % ids.length]];
    app.save.loadout.weapon = WEAPONS[(r * 5) % WEAPONS.length].id;
    const run = new RunState(app.save);
    for (let i = 0; i < 8; i++) run.relics.push(...run.rollRelics(1));
    run.items.push('bomb', 'frost', 'lantern');
    app.go(new RunScene(run), false);
    app.scene.room.god = true;
  }, r);
  let guard = 0;
  let last = '';
  let stuck = 0;
  while (guard++ < 400) {
    const st = await Promise.race([p.evaluate(() => {
      const s = window.__app.scene;
      if (!s.run || !s.room) return { done: true };
      return { done: s.run.finished, ch: s.run.chapter, node: s.run.node.type, layer: s.run.node.layer, cleared: s.room.cleared, overlay: !!s.overlay, trans: s.trans };
    }), new Promise((res) => setTimeout(() => res({ hung: true }), 8000))]);
    if (st.hung) { console.log('HUNG at guard', guard, last); process.exit(2); }
    const k = `${st.ch}-${st.layer}-${st.node}`;
    if (k !== last) { console.log('  ', k, 'g', guard); last = k; stuck = 0; }
    else if (++stuck % 12 === 0) console.log('    STUCK', await p.evaluate(() => JSON.stringify(window.__app.scene.room.allEnemies().filter((e) => !e.dead).map((e) => [e.def.id, e.state, Math.round(e.hp), Math.round(e.b.x), Math.round(e.b.y)]).concat([['waves', window.__app.scene.room.waves.length]]))));
    if (st.done) break;
    if (st.overlay) {
      await p.keyboard.press(['Enter', 'Enter', 'ArrowDown', 'ArrowRight', 'Escape'][Math.floor(Math.random() * 5)]);
      await p.waitForTimeout(150);
      continue;
    }
    if (st.trans) { await p.waitForTimeout(200); continue; }
    // 전투 입력
    for (let i = 0; i < 14; i++) {
      await p.keyboard.down(i % 4 < 2 ? 'KeyD' : 'KeyA');
      await p.keyboard.press(keys[(i + guard) % keys.length]);
      await p.waitForTimeout(40);
      await p.keyboard.up(i % 4 < 2 ? 'KeyD' : 'KeyA');
    }
    // 정리 + 상호작용 + 다음 방
    await p.evaluate(async () => {
      const s = window.__app.scene;
      const room = s.room;
      if (!room) return;
      room.god = true;
      for (const e of room.allEnemies()) if (!e.dead && e.def.ai !== 'dummy' && e.state !== 'spawn') { e.hp = 1; room.damageEnemy(e, { m: 99, kind: 'proc', kb: 0, up: 0, hs: 0, dir: 0, proc: true }); }
      room.waves = room.waves.length > 1 ? room.waves.slice(1) : room.waves;
    });
    await p.waitForTimeout(400);
    const next = await p.evaluate(() => {
      const s = window.__app.scene;
      const room = s.room;
      if (!room) return 'ended';
      if (!room.cleared) return 'fight';
      for (const pk of room.pickups) room.collect(pk);
      for (const pr of room.props) {
        if (pr.kind !== 'door' && pr.kind !== 'sign' && !pr.used && !pr.hidden && !pr._soaked) { pr._soaked = true; room.hooks.onInteract(pr); return 'interact:' + pr.kind; }
      }
      if (s.overlay) return 'overlay';
      const doors = room.props.filter((d) => d.kind === 'door' && d.open);
      if (!doors.length) return 'nodoor';
      const d = doors[Math.floor(Math.random() * doors.length)];
      room.hooks.onInteract(d);
      return 'door:' + d.nodeId;
    });
    if (guard % 20 === 0) console.log('    next', next, JSON.stringify(st));
    if (shotDir && next.startsWith('interact')) await p.screenshot({ path: `${shotDir}/soak_${r}_${guard}.png` });
    await p.waitForTimeout(next.startsWith('door') ? 900 : 200);
  }
  console.log(`run ${r} done (guard ${guard})`);
  await p.waitForTimeout(800);
  await p.keyboard.press('Enter');
  await p.waitForTimeout(1500);
}
console.log('errors:', errors.length);
await b.close();
process.exit(errors.length ? 1 : 0);
