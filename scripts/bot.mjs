// 개발용 밸런스 봇: 단순 AI로 실제 런(무적 없음)을 진행하며 방별 체력 변화를 기록한다.
import { chromium } from 'playwright';
const url = process.argv[2] ?? 'http://localhost:5199/';
const chars = (process.argv[3] ?? 'kael,rina').split(',');
const lv = +(process.argv[4] ?? 1);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 960, height: 540 } });
p.on('pageerror', (e) => console.log('PAGEERR', e.message, e.stack?.split('\n').slice(0, 3).join(' | ')));
await p.goto(url);
await p.waitForTimeout(1500);
await p.evaluate(async ([chars, lv]) => {
  const { RunScene } = await import('/src/scenes/run.ts');
  const { RunState } = await import('/src/game/run.ts');
  const app = window.__app;
  for (const c of chars) app.save.chars[c] = { lv, aw: 0, count: 1 };
  app.save.loadout.chars = chars;
  app.save.tutorialDone = true;
  const run = new RunState(app.save);
  const s = new RunScene(run);
  window.__log = [];
  const ai = (room) => {
    const P = room.player;
    const inp = { left: false, right: false, up: false, down: false, jumpP: false, jumpH: false, atkP: false, dashP: false, s1P: false, s2P: false, swapP: false, interactP: false, itemP: false };
    const st = (window.__ai ??= { jc: 0, sw: 300, stuck: 0, lastX: 0 });
    if (st.jc > 0) st.jc--;
    const e = room.nearestEnemy(P.cx, P.cy, 900);
    let tx = null;
    if (e) tx = e.cx;
    else if (room.cleared) {
      const pk = room.pickups.find((q) => q.kind === 'relicOrb');
      if (pk) tx = pk.cx;
      else {
        const doors = room.props.filter((d) => d.kind === 'door' && d.open);
        const d = doors[0];
        if (d) {
          tx = d.x;
          if (Math.abs(d.x - P.cx) < 12) inp.interactP = room.time % 10 === 0;
        }
      }
    }
    if (tx !== null) {
      const dx = tx - P.cx;
      const ranged = P.def.type === 'ranged' || P.def.type === 'magic';
      const want = e ? (ranged ? 70 : 18) : 4;
      if (Math.abs(dx) > want) { inp.right = dx > 0; inp.left = dx < 0; }
      if (e && Math.sign(dx) !== P.facing) { inp.right = dx > 0; inp.left = dx < 0; }
      // 낭떠러지/벽
      const ahead = P.cx + Math.sign(dx) * 14;
      const below = room.world.solidPx(ahead, P.b.y + P.b.h + 4) || room.world.get(Math.floor(ahead / 16), Math.floor((P.b.y + P.b.h + 4) / 16)) === 2;
      if ((P.b.hitWall || (!below && P.b.onGround) || (e && e.cy < P.cy - 30)) && st.jc <= 0) { inp.jumpP = true; st.jc = 20; }
      if (!P.b.onGround && P.b.vy > 0 && st.jc < 10 && st.jc > 0) inp.jumpP = true;
      inp.jumpH = true;
      if (e && Math.abs(dx) < want + 24 && Math.abs(e.cy - P.cy) < 40) {
        inp.atkP = room.time % 3 === 0;
        if (P.skillCd[0] <= 0 && Math.random() < 0.05) inp.s1P = true;
        if (P.skillCd[1] <= 0 && Math.random() < 0.04) inp.s2P = true;
        if (e.state === 'wind' && e.st < 10 && Math.random() < 0.3) inp.dashP = true;
      }
      if (--st.sw <= 0 && P.canSwap() && e) { inp.swapP = true; st.sw = 400; }
    }
    if (room.run.hp < room.maxHp() * 0.3 && room.run.items.length) inp.itemP = true;
    return inp;
  };
  const patch = (room) => {
    const ru = room.update.bind(room);
    room.update = () => { room.input = ai(room); ru(); };
  };
  const proto = Object.getPrototypeOf(s);
  const en = proto.enterNode;
  proto.enterNode = function (...a) {
    if (this.room) window.__log.push({ ch: this.run.chapter, type: this.run.node.type, hp: Math.round(this.run.hp), max: this.room.maxHp(), t: Math.round(this.room.time / 60) });
    en.apply(this, a);
    patch(this.room);
  };
  const upd = proto.update;
  proto.update = function () {
    if (this.overlay) {
      const o = this.overlay;
      if (o.options && o.onPick) { o.onPick(o.options[0]); }
      this.overlay = null;
      if (this.queued) { const q = this.queued; this.queued = null; q(); }
      return;
    }
    upd.call(this);
  };
  app.go(s, false);
}, [chars, lv]);
const t0 = Date.now();
let last = '';
while (Date.now() - t0 < 600000) {
  await p.waitForTimeout(3000);
  const st = await p.evaluate(() => {
    const s = window.__app.scene;
    if (!s.run) return { done: true, log: window.__log };
    return { ch: s.run.chapter, node: s.run.node.type, layer: s.run.node.layer, hp: Math.round(s.run.hp), en: s.room.allEnemies().filter((e) => !e.dead).length, t: Math.round(s.room.time / 60) };
  });
  if (st.done) { console.log('END', JSON.stringify(st.log)); break; }
  const k = `${st.ch}-${st.layer}-${st.node}`;
  if (k !== last) { console.log(k, 'hp', st.hp); last = k; }
  else if (st.t > 90) { console.log('STUCK', JSON.stringify(st)); }
}
const res = await p.evaluate(() => { const s = window.__app.scene; return s.run ? null : { cause: s.run?.stats?.cause }; });
console.log('result', JSON.stringify(res));
await b.close();
