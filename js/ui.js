'use strict';
// ============ UI: HUD · 사당(허브) · 메뉴 · 오버레이 · 시네마틱 ============

// ---------- 배경 & 월드 ----------
function drawWorld(o){
  const ch = G.chamber, st = STAGES[G.run.stageIdx];
  // 하늘 그라데이션
  const g = ctx.createLinearGradient(0,0,0,VH);
  g.addColorStop(0, st.mood[0]); g.addColorStop(1, '#0F0D14');
  ctx.fillStyle = g; ctx.fillRect(0,0,VW,VH);
  // 원경 실루엣 (패럴랙스)
  ctx.fillStyle = st.mood[1]; ctx.globalAlpha = 0.35;
  for(let i=0;i<6;i++){
    const mx = ((i*230 - o.x*0.3)%(VW+300))-150;
    if(st.id==='seoul'||st.id==='gyeonggi'){
      ctx.fillRect(mx, VH-260-((i*53)%90), 90, 300);
    } else {
      ctx.beginPath();
      ctx.moveTo(mx-90, VH); ctx.lineTo(mx, VH-190-((i*37)%70)); ctx.lineTo(mx+90, VH);
      ctx.fill();
    }
  }
  // 네온 (모던 서울)
  if(st.id==='seoul'||st.id==='gyeonggi'){
    ctx.globalAlpha = 0.5;
    for(let i=0;i<5;i++){
      const mx = ((i*260 - o.x*0.3)%(VW+300))-120;
      ctx.fillStyle = [PAL.seoul.pink,PAL.seoul.blue,PAL.seoul.amber][i%3];
      ctx.fillRect(mx+20, VH-230-((i*53)%90), 6, 40);
    }
  }
  ctx.globalAlpha = 1;
  // 안개
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = '#B6ACB6';
  for(let i=0;i<3;i++){
    const mx = ((Date.now()/80+i*400 - o.x*0.5)%(VW+400))-200;
    ctx.beginPath(); ctx.ellipse(mx, VH-100-i*60, 160, 30, 0, 0, Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // 바닥 타일 (16px 그리드)
  const floorY = ch.h-32-o.y;
  ctx.fillStyle = st.ground;
  ctx.fillRect(-o.x, floorY, ch.w, 32);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  for(let tx=0; tx<ch.w; tx+=16) if((tx/16)%2===0) ctx.fillRect(tx-o.x, floorY, 16, 4);
  ctx.fillStyle = st.mood[2]; ctx.globalAlpha=0.6;
  ctx.fillRect(-o.x, floorY, ch.w, 2); ctx.globalAlpha=1;
  // 플랫폼
  for(const pl of ch.plats){
    ctx.fillStyle = st.ground;
    ctx.fillRect(pl.x-o.x, pl.y-o.y, pl.w, pl.h);
    ctx.fillStyle = st.mood[2]; ctx.globalAlpha=0.6;
    ctx.fillRect(pl.x-o.x, pl.y-o.y, pl.w, 2); ctx.globalAlpha=1;
  }
  // 챔버 경계
  ctx.fillStyle = 'rgba(15,13,20,0.8)';
  ctx.fillRect(-o.x-20, -o.y-100, 20, ch.h+200);
  ctx.fillRect(ch.w-o.x, -o.y-100, 20, ch.h+200);
}

function drawInteractables(o){
  const ch = G.chamber;
  const p = G.player;
  // 문
  for(const d of ch.doors){
    const x=d.x-o.x, y=d.y-o.y;
    ctx.fillStyle = '#1F1930'; ctx.fillRect(x,y,d.w,d.h);
    ctx.strokeStyle = '#F5C56D'; ctx.lineWidth=2; ctx.strokeRect(x+1,y+1,d.w-2,d.h-2);
    ctx.fillStyle = PAL.sp.rainbow; ctx.globalAlpha=0.25+0.1*Math.sin(Date.now()/300);
    ctx.fillRect(x+6,y+8,d.w-12,d.h-14); ctx.globalAlpha=1;
    text(d.reward, x+d.w/2, y-8, '#F5C56D', 11, 'center', true);
    if(rectHit(d,p)) text('↑ 입장', x+d.w/2, y+d.h+14, '#F5EBD6', 11, 'center');
  }
  // 상자
  if(ch.chest && !ch.chest.opened){
    const c=ch.chest, x=c.x-o.x, y=c.y-o.y;
    ctx.fillStyle='#6B4A2E'; ctx.fillRect(x,y,c.w,c.h);
    ctx.fillStyle=TIER_COLOR[c.tier]; ctx.fillRect(x+2,y+2,c.w-4,6);
    ctx.strokeStyle='#A17B4E'; ctx.strokeRect(x+0.5,y+0.5,c.w-1,c.h-1);
    text(c.rewardType, x+c.w/2, y-6, TIER_COLOR[c.tier], 10, 'center');
    if(rectHit(c,p)) text('↑ 열기', x+c.w/2, y+c.h+13, '#F5EBD6', 11, 'center');
  }
  // 보상 제단
  if(ch.pedestals){
    for(const pd of ch.pedestals){
      const x=pd.x-o.x, y=pd.y-o.y;
      ctx.fillStyle='#3F3550'; ctx.fillRect(x,y+30,pd.w,22);
      ctx.fillStyle=pd.col; ctx.globalAlpha=0.7+0.3*Math.sin(Date.now()/250);
      ctx.fillRect(x+pd.w/2-8, y+6, 16, 20); ctx.globalAlpha=1;
      text(pd.label, x+pd.w/2, y-4, pd.col, 10, 'center');
      if(rectHit(pd,p)) text('↑ 선택', x+pd.w/2, y+pd.h+13, '#F5EBD6', 11, 'center');
    }
  }
  // 상점 NPC (떠도는 영혼)
  if(ch.npc){
    const n=ch.npc, x=n.x-o.x, y=n.y-o.y;
    drawFigure(o, x, y, n.w, n.h, ['#1F1930','#3F3550','#B6ACB6'], p.x<n.x?-1:1, {glow:'#B6ACB6', faceCol:'#0F0D14', eyeCol:'#41EAD4'});
    text('떠도는 영혼', x+n.w/2, y-8, '#B6ACB6', 10, 'center');
    if(rectHit(n,p)) text('↑ 거래', x+n.w/2, y+n.h+13, '#F5EBD6', 11, 'center');
  }
  // 이벤트
  if(ch.event && !ch.event.used){
    const ev=ch.event, x=ev.x-o.x, y=ev.y-o.y;
    ctx.fillStyle = ev.id==='shrine'?'#A17B4E': ev.id==='soul'?'#6E5F80':'#4B0082';
    ctx.fillRect(x,y+10,ev.w,ev.h-10);
    ctx.fillStyle = PAL.sp.rainbow; ctx.globalAlpha=0.5+0.3*Math.sin(Date.now()/200);
    ctx.fillRect(x+ev.w/2-4, y, 8, 12); ctx.globalAlpha=1;
    text(ev.name, x+ev.w/2, y-6, '#F5EBD6', 10, 'center');
    if(rectHit(ev,p)) text('↑ '+ev.desc, x+ev.w/2, y+ev.h+13, '#F5EBD6', 10, 'center');
  }
}

// ---------- HUD (10.1) ----------
function drawHUD(){
  const p = G.player, r = G.run;
  // HP / SP
  panel(12, 12, 240, 58, 0.6);
  text('HP', 22, 32, '#E63946', 12, 'left', true);
  bar(48, 20, 180, 14, p.hp/maxHP(), p.hp<maxHP()*0.3?'#E63946':'#A5304F');
  text(Math.ceil(p.hp)+'/'+maxHP(), 138, 31, '#F5EBD6', 10, 'center');
  text('SP', 22, 56, '#4A7BC9', 12, 'left', true);
  bar(48, 44, 180, 14, p.sp/maxSP(), '#2B4F8B');
  text(Math.floor(p.sp)+'/'+maxSP(), 138, 55, '#F5EBD6', 10, 'center');

  // 우측: 부적 수 · 옥 · 스테이지
  const st = STAGES[r.stageIdx];
  text('⚡ 부적 ×'+p.talismans.length+'  ◆ 신물 ×'+p.relics.length, VW-16, 28, '#F5C56D', 12, 'right');
  text('옥 '+p.jade+'   신력 +'+r.sinryeok+'   혼옥 +'+r.honok, VW-16, 48, '#7BC97B', 12, 'right');
  const chLabel = G.chamber.type==='boss' ? '보스' : (r.chamberIdx+1)+'/'+r.plan.length;
  text(st.name+' — '+chLabel + (r.heat>0?'  시련'+r.heat:''), VW-16, 68, '#B6ACB6', 12, 'right');

  // 소비품
  if(p.consumables.length){
    let cs = p.consumables.map((c,i)=>'['+(i+1)+'] '+CONSUMABLES.find(x=>x.id===c).name).join('  ');
    text(cs, VW-16, 88, '#B6ACB6', 11, 'right');
  }

  // 하단: 신령 슬롯 (Q/E)
  for(let i=0;i<2;i++){
    const sx = 16+i*150, sy = VH-58;
    const sid = p.slots[i];
    const active = sid && p.form===sid;
    panel(sx, sy, 138, 44, active?0.85:0.55);
    if(active){ ctx.strokeStyle='#F5C56D'; ctx.lineWidth=2; ctx.strokeRect(sx+0.5,sy+0.5,137,43); }
    text(i===0?'[Q]':'[E]', sx+10, sy+27, '#F5C56D', 13, 'left', true);
    if(sid){
      const s = SPIRITS[sid];
      ctx.fillStyle = s.col[1]; ctx.fillRect(sx+40, sy+10, 22, 24);
      ctx.fillStyle = s.col[2]; ctx.fillRect(sx+40, sy+10, 22, 6);
      text(s.name, sx+68, sy+22, '#E8DED0', 11);
      text(s.special.name+' [L]', sx+68, sy+36, '#6E5F80', 10);
      if(G.save.affinity[sid]>=100) text('진명', sx+40, sy+40, PAL.sp.jinmyeong, 8);
    } else {
      text('빈 슬롯', sx+45, sy+28, '#3F3550', 11);
    }
  }
  // 현재 폼
  const formName = p.form==='bari'?'바리데기':SPIRITS[p.form].name;
  text('빙의: '+formName, 320, VH-30, p.form==='bari'?'#E8DED0':'#F5C56D', 12, 'left', true);
  // 버프 표시
  let bx = 320, by = VH-52;
  const bs = p.buffs;
  const bl = [];
  if(bs.gwangi>0) bl.push('광기 '+bs.gwangi.toFixed(0));
  if(bs.cheolgap>0) bl.push('철갑 '+bs.cheolgap.toFixed(0));
  if(bs.bunshinT>0) bl.push('분신 '+bs.bunshinT.toFixed(0));
  if(bs.nospend>0||bs.freepossT>0) bl.push('SP프리');
  if(G.timeStop>0) bl.push('시간정지');
  if(bl.length) text(bl.join(' · '), bx, by, '#F5C56D', 11);

  // 보스 HP 바
  if(G.boss && !G.boss.dead){
    const b = G.boss;
    bar(VW/2-260, VH-84, 520, 14, b.hp/b.maxhp, '#A5304F', '#1A1613');
    text(b.name+'  — 페이즈 '+b.phase+'/'+bossPhaseCount(b.id), VW/2, VH-90, '#E8DED0', 13, 'center', true);
  }
}

// ---------- 오버레이 ----------
function drawOverlay(){
  const ov = G.overlay;
  if(!ov) return;
  if(ov.type==='shop'){
    panel(120, 40, 720, 460);
    text('떠도는 영혼의 상점', 480, 74, '#F5C56D', 20, 'center', true);
    text('보유 옥: '+G.player.jade, 480, 98, '#7BC97B', 14, 'center');
    const stock = G.chamber.shopStock;
    ov.sel = clamp(ov.sel, 0, stock.length-1);
    stock.forEach((s,i)=>{
      const col = i%3, row = Math.floor(i/3);
      const x = 150+col*230, y = 120+row*88;
      const seld = ov.sel===i;
      panel(x, y, 214, 78, seld?0.95:0.6);
      if(seld){ ctx.strokeStyle='#F5C56D'; ctx.strokeRect(x+0.5,y+0.5,213,77); }
      if(s.sold){ text('판매 완료', x+107, y+45, '#3F3550', 13, 'center'); return; }
      const tc = s.item.tier!==undefined?TIER_COLOR[clamp(s.item.tier,0,4)]:'#E8DED0';
      text(s.item.name, x+12, y+24, tc, 13, 'left', true);
      const desc = s.item.desc||'';
      text(desc.length>18?desc.slice(0,18)+'…':desc, x+12, y+44, '#B6ACB6', 10);
      text(s.price+' 옥', x+12, y+64, G.player.jade>=s.price?'#7BC97B':'#E63946', 12, 'left', true);
      text(s.cat, x+200, y+64, '#6B5C6E', 10, 'right');
    });
    text('← → ↑ ↓ 이동 · J/Enter 구매 · ESC 나가기', 480, 486, '#6B5C6E', 12, 'center');
    // 입력
    if(Input.hit('ArrowRight')) { ov.sel=(ov.sel+1)%stock.length; Audio2.sfx('ui'); }
    if(Input.hit('ArrowLeft')) { ov.sel=(ov.sel+stock.length-1)%stock.length; Audio2.sfx('ui'); }
    if(Input.hit('ArrowDown')) { ov.sel=Math.min(stock.length-1, ov.sel+3); Audio2.sfx('ui'); }
    if(Input.hit('ArrowUp')) { ov.sel=Math.max(0, ov.sel-3); Audio2.sfx('ui'); }
    if(Input.hit('KeyJ')||Input.hit('Enter')) buyShopItem(stock[ov.sel]);
    if(Input.hit('Escape')||Input.hit('KeyF')) G.overlay=null;
    return;
  }
  if(ov.type==='stageClear'){
    ov.t = (ov.t||0)+1/60;
    panel(140, 120, 680, 300);
    const st = STAGES[G.run.stageIdx];
    text(st.name+' 해방', 480, 170, '#F5C56D', 24, 'center', true);
    text(st.bossName+' 격파', 480, 200, '#E8DED0', 14, 'center');
    if(ov.line) textLines(ov.line, 480, 240, '#B6ACB6', 13, 'center');
    if(ov.truth) textLines(ov.truth, 480, 300, PAL.sp.shadow==='#4B0082'?'#8B5FBF':'#8B5FBF', 13, 'center');
    text('신력·혼옥·무패 획득!  보스 부적 (에픽+) 획득', 480, 360, '#7BC97B', 12, 'center');
    if(ov.t>1.2){
      text('J / Enter — 다음 지방으로', 480, 396, '#F5EBD6', 13, 'center', true);
      if(Input.hit('KeyJ')||Input.hit('Enter')||Input.hit('Space')){ G.overlay=null; nextStage(); }
    }
    return;
  }
  if(ov.type==='story'){
    panel(200, 180, 560, 160);
    textLines(ov.text, 480, 235, '#B6ACB6', 15, 'center');
    text(ov.sub||'', 480, 300, '#6B5C6E', 12, 'center');
    text('J — 닫기', 480, 324, '#F5EBD6', 11, 'center');
    if(Input.hit('KeyJ')||Input.hit('Enter')||Input.hit('Escape')) G.overlay=null;
    return;
  }
  if(ov.type==='finalChoice'){
    panel(180, 140, 600, 260);
    text('그림자가 무릎을 꿇었다.', 480, 190, '#E8DED0', 16, 'center', true);
    textLines('"...끝내. 아니면..."', 480, 220, '#8B5FBF', 14, 'center');
    const opts = ['공격한다 (봉인)', '다가간다 (…)'];
    opts.forEach((o,i)=>{
      const sel = ov.sel===i;
      panel(280+i*220, 280, 190, 60, sel?0.95:0.5);
      if(sel){ ctx.strokeStyle='#F5C56D'; ctx.strokeRect(280.5+i*220,280.5,189,59); }
      text(o, 375+i*220, 315, sel?'#F5EBD6':'#6B5C6E', 14, 'center', sel);
    });
    text('← → 선택 · J 결정', 480, 378, '#6B5C6E', 12, 'center');
    if(Input.hit('ArrowLeft')||Input.hit('ArrowRight')){ ov.sel=1-ov.sel; Audio2.sfx('ui'); }
    if(Input.hit('KeyJ')||Input.hit('Enter')) resolveFinalChoice(ov.sel===1);
    return;
  }
  if(ov.type==='pause'){
    panel(280, 100, 400, 360);
    text('일시 정지', 480, 140, '#F5EBD6', 20, 'center', true);
    // 보유 부적 리스트
    let y = 170;
    text('— 부적 —', 480, y, '#F5C56D', 12, 'center'); y+=18;
    const p = G.player;
    if(!p.talismans.length){ text('(없음)', 480, y, '#3F3550', 11, 'center'); y+=16; }
    for(const t of p.talismans.slice(0,8)){
      const def = TALISMANS.find(x=>x.id===t.id);
      text('['+TIERS[t.tier]+'] '+def.name+' — '+def.desc, 480, y, TIER_COLOR[t.tier], 11, 'center'); y+=16;
    }
    if(p.talismans.length>8){ text('…외 '+(p.talismans.length-8)+'개', 480, y, '#6B5C6E', 10, 'center'); y+=16; }
    y+=6;
    text('— 신물 —', 480, y, '#F5C56D', 12, 'center'); y+=18;
    if(!p.relics.length){ text('(없음)', 480, y, '#3F3550', 11, 'center'); y+=16; }
    for(const rid of p.relics.slice(0,5)){
      const def = RELICS.find(x=>x.id===rid);
      text(def.name+' — '+def.desc, 480, y, TIER_COLOR[def.tier], 11, 'center'); y+=16;
    }
    text('ESC — 계속 · M — 런 포기', 480, 442, '#6B5C6E', 12, 'center');
    if(Input.hit('Escape')||Input.hit('KeyP')) G.overlay=null;
    if(Input.hit('KeyM')){ G.overlay=null; runDeath(); }
    return;
  }
}

// ---------- 시네마틱 ----------
function startCinema(panels, onEnd){
  Audio2.stopBgm();
  G.cinema = {panels, i:0, t:0, onEnd};
  G.state = 'cinema';
  Input.clear();
}
function drawCinema(dt){
  const c = G.cinema;
  c.t += dt;
  ctx.fillStyle = '#0F0D14'; ctx.fillRect(0,0,VW,VH);
  const p = c.panels[c.i];
  // 장식: 흔들리는 등불 같은 빛
  ctx.globalAlpha = 0.08+0.03*Math.sin(c.t*2);
  ctx.fillStyle = '#4B0082';
  ctx.beginPath(); ctx.arc(VW/2, 160, 130, 0, Math.PI*2); ctx.fill();
  ctx.globalAlpha = 1;
  if(p.h) text(p.h, VW/2, 150, '#F5C56D', 26, 'center', true);
  const alpha = clamp(c.t*1.5, 0, 1);
  ctx.globalAlpha = alpha;
  textLines(p.t, VW/2, 230, '#E8DED0', 16, 'center', 30);
  ctx.globalAlpha = 1;
  text((c.i+1)+' / '+c.panels.length+'   —   J / Enter 다음, ESC 전체 넘기기', VW/2, VH-40, '#3F3550', 12, 'center');
  if(Input.hit('KeyJ')||Input.hit('Enter')||Input.hit('Space')){
    c.i++; c.t=0;
    if(c.i>=c.panels.length){ const f=c.onEnd; G.cinema=null; f&&f(); }
  }
  if(Input.hit('Escape')){ const f=c.onEnd; G.cinema=null; f&&f(); }
}

// ---------- 타이틀 ----------
function drawTitle(dt){
  ctx.fillStyle='#0F0D14'; ctx.fillRect(0,0,VW,VH);
  // 백귀행 행렬 실루엣
  for(let i=0;i<12;i++){
    const mx = (Date.now()/30 + i*90)%(VW+100)-50;
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = i%4===0?'#4B0082':'#3F3550';
    ctx.fillRect(mx, 400-((i*13)%30), 24, 60+((i*7)%20));
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#2A2438'; ctx.fillRect(0, 460, VW, 80);
  text('백 귀 행', VW/2, 190, '#E8DED0', 64, 'center', true);
  text('百 鬼 行', VW/2, 230, '#8B5FBF', 22, 'center');
  text('잊혀진 자들의 행진', VW/2, 262, '#6B5C6E', 14, 'center');
  const bl = 0.5+0.5*Math.sin(Date.now()/400);
  ctx.globalAlpha = bl;
  text('J 또는 ENTER — 시작', VW/2, 340, '#F5C56D', 16, 'center', true);
  ctx.globalAlpha = 1;
  CONTROLS.forEach((l,i)=>text(l, VW/2, 390+i*20, '#6B5C6E', 11, 'center'));
  text('v1.0 — 요구명세서 기반 빌드', VW/2, VH-16, '#3F3550', 10, 'center');
  if(Input.hit('KeyJ')||Input.hit('Enter')||Input.hit('Space')){
    Audio2.unlock();
    if(!G.save.seenOpening){
      G.save.seenOpening = true; storeSave();
      startCinema(OPENING, ()=>{ G.state='hub'; G.hubSel=0; });
    } else { G.state='hub'; G.hubSel=0; }
  }
}

// ---------- 사당 허브 (10.3) ----------
const HUB_MENU = ['새 굿판 시작','사당 정비','신령들과 대화','무패 보기','설정'];
function drawHub(dt){
  const s = G.save;
  ctx.fillStyle='#0F0D14'; ctx.fillRect(0,0,VW,VH);
  // 사당 배경
  ctx.fillStyle='#1F1930'; ctx.fillRect(0, 400, VW, 140);
  ctx.fillStyle='#3B2A1F'; ctx.fillRect(VW/2-120, 240, 240, 160);
  ctx.fillStyle='#6B1F2E'; ctx.fillRect(VW/2-140, 210, 280, 34);
  ctx.fillStyle='#A17B4E'; ctx.fillRect(VW/2-130, 244, 12, 156); ctx.fillRect(VW/2+118, 244, 12, 156);
  ctx.globalAlpha=0.4+0.2*Math.sin(Date.now()/500);
  ctx.fillStyle='#F5C56D';
  ctx.fillRect(VW/2-30, 300, 8, 12); ctx.fillRect(VW/2+22, 300, 8, 12);
  ctx.globalAlpha=1;
  text('사 당', VW/2, 232, '#E8DED0', 15, 'center', true);

  text('백귀행 — 사당', 40, 50, '#E8DED0', 24, 'left', true);
  text('신력 '+s.신력+'   혼옥 '+s.혼옥+'   무패 '+s.무패, 40, 80, '#7BC97B', 14);
  text('진행: '+(s.bestStage>=6?'전국 해방':s.bestStage>0?STAGES[s.bestStage-1].name+' 해방':'미출정')+'   클리어 '+s.clears+'회   런 '+s.runs+'회', 40, 102, '#6B5C6E', 12);

  HUB_MENU.forEach((m,i)=>{
    const sel = G.hubSel===i;
    const y = 150+i*54;
    panel(40, y, 260, 44, sel?0.9:0.4);
    if(sel){ ctx.strokeStyle='#F5C56D'; ctx.strokeRect(40.5,y+0.5,259,43); }
    text(m, 60, y+28, sel?'#F5EBD6':'#8a8096', 15, 'left', sel);
  });
  text('↑↓ 이동 · J 선택', 40, 440, '#3F3550', 12);
  // 엔딩 달성
  let ey = 470;
  const eStr = ['봉인','통합','굴복'].filter((e,i)=>s.endings[['seal','union','fall'][i]]);
  if(eStr.length) text('달성 엔딩: '+eStr.join(' · '), 40, ey, '#8B5FBF', 12);
  if(s.mythicOwned) text('신화: '+MYTHIC.name+' 각성', 40, ey+20, PAL.sp.jinmyeong, 12);

  if(Input.hit('ArrowDown')){ G.hubSel=(G.hubSel+1)%HUB_MENU.length; Audio2.sfx('ui'); }
  if(Input.hit('ArrowUp')){ G.hubSel=(G.hubSel+HUB_MENU.length-1)%HUB_MENU.length; Audio2.sfx('ui'); }
  if(Input.hit('KeyJ')||Input.hit('Enter')){
    Audio2.sfx('ui');
    switch(G.hubSel){
      case 0: G.state='heat'; G.heatSel=0; break;
      case 1: G.state='upgrade'; G.upSel=0; break;
      case 2: G.state='talk'; G.talkSel=0; break;
      case 3: G.state='archive'; break;
      case 4: G.state='settings'; G.setSel=0; break;
    }
  }
}

// ---------- 신의 시련 선택 ----------
function drawHeat(dt){
  const s = G.save;
  ctx.fillStyle='#0F0D14'; ctx.fillRect(0,0,VW,VH);
  text('새 굿판 — 신의 시련', VW/2, 70, '#E8DED0', 22, 'center', true);
  const maxHeat = Math.min(5, s.heatUnlocked||0);
  const n = maxHeat+1;
  for(let i=0;i<=5;i++){
    const y = 120+i*62;
    const locked = i>maxHeat;
    const sel = G.heatSel===i;
    panel(230, y, 500, 52, sel?0.9:0.4);
    if(sel && !locked){ ctx.strokeStyle='#F5C56D'; ctx.strokeRect(230.5,y+0.5,499,51); }
    const label = i===0 ? '시련 없음 (기본)' : '시련 '+i+' — '+HEAT[i-1];
    text(locked?'잠김 (봉인/통합 엔딩으로 해금)':label, 250, y+31, locked?'#3F3550':sel?'#F5EBD6':'#8a8096', 13, 'left', sel&&!locked);
  }
  text('↑↓ 선택 · J 출정 · ESC 뒤로', VW/2, VH-30, '#6B5C6E', 12, 'center');
  if(Input.hit('ArrowDown')){ G.heatSel=Math.min(maxHeat,G.heatSel+1); Audio2.sfx('ui'); }
  if(Input.hit('ArrowUp')){ G.heatSel=Math.max(0,G.heatSel-1); Audio2.sfx('ui'); }
  if(Input.hit('Escape')) G.state='hub';
  if(Input.hit('KeyJ')||Input.hit('Enter')){
    newRun(G.heatSel);
    G.state='run';
  }
}

// ---------- 사당 정비 (9.6) ----------
function drawUpgrade(dt){
  const s = G.save;
  ctx.fillStyle='#0F0D14'; ctx.fillRect(0,0,VW,VH);
  text('사당 정비 — 영구 강화', VW/2, 60, '#E8DED0', 22, 'center', true);
  text('신력: '+s.신력, VW/2, 90, '#7BC97B', 15, 'center');
  SHRINE_UPGRADES.forEach((u,i)=>{
    const lv = s.upgrades[u.id]||0;
    const max = u.cost.length;
    const cost = lv<max ? u.cost[lv] : null;
    const sel = G.upSel===i;
    const y = 120+i*66;
    panel(180, y, 600, 56, sel?0.9:0.4);
    if(sel){ ctx.strokeStyle='#F5C56D'; ctx.strokeRect(180.5,y+0.5,599,55); }
    text(u.name+'  Lv.'+lv+'/'+max, 200, y+24, sel?'#F5EBD6':'#8a8096', 14, 'left', sel);
    text(u.desc, 200, y+44, '#6B5C6E', 11);
    if(cost!==null) text(cost+' 신력', 760, y+34, s.신력>=cost?'#7BC97B':'#E63946', 14, 'right', true);
    else text('완성', 760, y+34, '#F5C56D', 14, 'right', true);
  });
  // 혼옥 해금 (9.7)
  const y2 = 120+SHRINE_UPGRADES.length*66;
  const sigList = SPIRIT_IDS.filter(id=>!s.sigUnlocked[id] && s.affinity[id]>=75);
  const sel2 = G.upSel===SHRINE_UPGRADES.length;
  panel(180, y2, 600, 56, sel2?0.9:0.4);
  if(sel2){ ctx.strokeStyle='#F5C56D'; ctx.strokeRect(180.5,y2+0.5,599,55); }
  if(sigList.length){
    text('시그니처 신물 해금: '+SPIRITS[sigList[0]].name+' (호감도 75 달성)', 200, y2+24, sel2?'#F5EBD6':'#8a8096', 13, 'left', sel2);
    text('해당 신령의 시그니처 신물이 드롭 풀에 추가됩니다', 200, y2+44, '#6B5C6E', 11);
    text('100 혼옥', 760, y2+34, s.혼옥>=100?'#7BC97B':'#E63946', 14, 'right', true);
  } else {
    text('시그니처 신물 해금 — 호감도 75 신령 필요 (혼옥 100)', 200, y2+34, '#3F3550', 12);
  }
  text('↑↓ 선택 · J 구매 · ESC 뒤로', VW/2, VH-24, '#6B5C6E', 12, 'center');
  const total = SHRINE_UPGRADES.length+1;
  if(Input.hit('ArrowDown')){ G.upSel=(G.upSel+1)%total; Audio2.sfx('ui'); }
  if(Input.hit('ArrowUp')){ G.upSel=(G.upSel+total-1)%total; Audio2.sfx('ui'); }
  if(Input.hit('Escape')) G.state='hub';
  if(Input.hit('KeyJ')||Input.hit('Enter')){
    if(G.upSel<SHRINE_UPGRADES.length){
      const u = SHRINE_UPGRADES[G.upSel];
      const lv = s.upgrades[u.id]||0;
      if(lv<u.cost.length && s.신력>=u.cost[lv]){
        s.신력-=u.cost[lv]; s.upgrades[u.id]=lv+1; storeSave(); Audio2.sfx('buy');
      } else Audio2.sfx('ui');
    } else if(sigList.length && s.혼옥>=100){
      s.혼옥-=100; s.sigUnlocked[sigList[0]]=true; storeSave(); Audio2.sfx('buy');
    }
  }
}

// ---------- 신령들과 대화 (호감도) ----------
function drawTalk(dt){
  const s = G.save;
  ctx.fillStyle='#0F0D14'; ctx.fillRect(0,0,VW,VH);
  text('신령들과 대화', VW/2, 56, '#E8DED0', 22, 'center', true);
  text('대화권: '+ (s.talkTokens||0) +' (보스 격파 시 획득 · 대화로 호감도 +5)', VW/2, 84, '#6B5C6E', 12, 'center');
  const chars = SPIRIT_IDS.concat(['halmi']);
  chars.forEach((id,i)=>{
    const sel = G.talkSel===i;
    const y = 110+i*62;
    const aff = s.affinity[id]||0;
    const name = id==='halmi'?DIALOGUE.halmi.name:SPIRITS[id].name+' ('+SPIRITS[id].role+')';
    panel(130, y, 700, 52, sel?0.9:0.4);
    if(sel){ ctx.strokeStyle='#F5C56D'; ctx.strokeRect(130.5,y+0.5,699,51); }
    const col = id==='halmi'?'#E8DED0':SPIRITS[id].col[2];
    text(name, 150, y+22, col, 13, 'left', sel);
    bar(150, y+32, 200, 8, aff/100, '#A5304F');
    text('호감도 '+aff+'/100', 360, y+40, '#B6ACB6', 11);
    const tierIdx = aff>=100?3:aff>=75?2:aff>=50?1:0;
    if(id!=='halmi'){
      const marks = [];
      if(aff>=75) marks.push('시그니처');
      if(aff>=100) marks.push('진명: '+SPIRITS[id].jinmyeong+' (+20%)');
      if(marks.length) text(marks.join(' · '), 810, y+22, PAL.sp.jinmyeong, 11, 'right');
    }
    if(sel){
      const line = DIALOGUE[id].lines[tierIdx];
      text('"'+line+'"', 480, y+46, '#B6ACB6', 11, 'center');
    }
  });
  text('↑↓ 선택 · J 대화 (+5) · ESC 뒤로', VW/2, VH-20, '#6B5C6E', 12, 'center');
  if(Input.hit('ArrowDown')){ G.talkSel=(G.talkSel+1)%chars.length; Audio2.sfx('ui'); }
  if(Input.hit('ArrowUp')){ G.talkSel=(G.talkSel+chars.length-1)%chars.length; Audio2.sfx('ui'); }
  if(Input.hit('Escape')) G.state='hub';
  if(Input.hit('KeyJ')||Input.hit('Enter')){
    if((s.talkTokens||0)>0){
      s.talkTokens--; addAffinity(chars[G.talkSel], 5); Audio2.sfx('pickup');
    } else Audio2.sfx('ui');
  }
}

// ---------- 무패 보기 (아카이브) ----------
function drawArchive(dt){
  const s = G.save;
  ctx.fillStyle='#0F0D14'; ctx.fillRect(0,0,VW,VH);
  text('무패 (巫牌) — 기록 보관소', VW/2, 56, '#E8DED0', 22, 'center', true);
  text('무패 '+s.무패+' 개', VW/2, 84, '#F5EBFF', 14, 'center');
  text('— 밝혀진 진실 —', VW/2, 130, '#8B5FBF', 14, 'center', true);
  if(!s.storyLog.length){
    text('아직 밝혀진 것이 없다. 보스를 물리치고 진실을 모아라.', VW/2, 170, '#3F3550', 12, 'center');
  }
  s.storyLog.slice(0,9).forEach((l,i)=>{
    textLines(l.length>60?l.slice(0,60)+'…':l, VW/2, 165+i*30, '#B6ACB6', 12, 'center');
  });
  text('— 엔딩 —', VW/2, 452, '#8B5FBF', 13, 'center', true);
  const names = {seal:'봉인', union:'통합 (진엔딩)', fall:'굴복'};
  text(Object.keys(names).map(k=>names[k]+': '+(s.endings[k]?'달성':'미달성')).join('   ·   '), VW/2, 478, '#6B5C6E', 12, 'center');
  text('ESC — 뒤로', VW/2, VH-16, '#3F3550', 11, 'center');
  if(Input.hit('Escape')||Input.hit('KeyJ')) G.state='hub';
}

// ---------- 설정 ----------
function drawSettings(dt){
  const s = G.save;
  ctx.fillStyle='#0F0D14'; ctx.fillRect(0,0,VW,VH);
  text('설정', VW/2, 80, '#E8DED0', 22, 'center', true);
  const opts = [
    '음량: '+Math.round(Audio2.vol*100)+'%  (← →)',
    '소리: '+(Audio2.muted?'끔':'켬'),
    '저장 데이터 초기화'
  ];
  opts.forEach((o,i)=>{
    const sel = G.setSel===i;
    panel(300, 140+i*70, 360, 54, sel?0.9:0.4);
    if(sel){ ctx.strokeStyle='#F5C56D'; ctx.strokeRect(300.5,140.5+i*70,359,53); }
    text(o, 480, 173+i*70, sel?'#F5EBD6':'#8a8096', 14, 'center', sel);
  });
  text('↑↓ 이동 · J 선택 · ESC 뒤로', VW/2, VH-30, '#6B5C6E', 12, 'center');
  if(Input.hit('ArrowDown')){ G.setSel=(G.setSel+1)%3; Audio2.sfx('ui'); }
  if(Input.hit('ArrowUp')){ G.setSel=(G.setSel+2)%3; Audio2.sfx('ui'); }
  if(G.setSel===0){
    if(Input.hit('ArrowLeft')){ Audio2.vol=clamp(Audio2.vol-0.1,0,1); s.settings.vol=Audio2.vol; storeSave(); Audio2.sfx('ui'); }
    if(Input.hit('ArrowRight')){ Audio2.vol=clamp(Audio2.vol+0.1,0,1); s.settings.vol=Audio2.vol; storeSave(); Audio2.sfx('ui'); }
  }
  if(Input.hit('KeyJ')||Input.hit('Enter')){
    if(G.setSel===1){ Audio2.muted=!Audio2.muted; }
    if(G.setSel===2){
      if(G.confirmReset){ localStorage.removeItem(SAVE_KEY); G.save=loadSave(); G.confirmReset=false; G.state='title'; }
      else { G.confirmReset=true; }
    }
  }
  if(G.confirmReset && G.setSel===2) text('정말로? 한 번 더 누르면 초기화됩니다.', VW/2, 400, '#E63946', 13, 'center', true);
  if(Input.hit('Escape')){ G.confirmReset=false; G.state='hub'; }
}

// ---------- 결산 (10.4) ----------
function drawResults(dt){
  const r = G.save.lastResult;
  ctx.fillStyle='#0F0D14'; ctx.fillRect(0,0,VW,VH);
  if(!r){ G.state='hub'; return; }
  text(r.win?'굿판의 끝 — '+(r.endingName||'승리'):'바리, 쓰러지다', VW/2, 70, r.win?'#F5C56D':'#A5304F', 26, 'center', true);
  const mm = Math.floor(r.time/60), ss = r.time%60;
  const rows = [
    ['도달', r.stage+' — '+(r.win?'완주':r.chamber+'번째 챔버')],
    ['런 시간', mm+'분 '+ss+'초'],
    ['처치', '잡귀 '+r.kills+' · 엘리트 '+r.elites+' · 미니보스 '+r.minis+' · 보스 '+r.bosses],
    ['주 빙의', r.mainSpirit?SPIRITS[r.mainSpirit].name:'바리 (자기 폼)'],
    ['획득 화폐', '신력 +'+r.sinryeok+' · 혼옥 +'+r.honok+' · 무패 +'+r.mupae],
    ['획득 아이템', r.items.length? r.items.slice(0,6).join(', ')+(r.items.length>6?' 외':'') : '없음']
  ];
  rows.forEach((row,i)=>{
    const y = 140+i*44;
    text(row[0], 260, y, '#6B5C6E', 13, 'right');
    text(row[1], 290, y, '#E8DED0', 13, 'left');
  });
  if(r.storyNew && r.storyNew.length){
    text('스토리 해금!', VW/2, 420, '#8B5FBF', 14, 'center', true);
    textLines(r.storyNew[0], VW/2, 444, '#B6ACB6', 12, 'center');
  }
  text('J / ENTER — 사당으로', VW/2, VH-40, '#F5EBD6', 14, 'center', true);
  if(Input.hit('KeyJ')||Input.hit('Enter')||Input.hit('Space')){ G.state='hub'; G.hubSel=0; }
}
