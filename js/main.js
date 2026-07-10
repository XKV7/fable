'use strict';
// ============ 메인 루프 & 상태 머신 ============

const G = {
  state:'title',
  save:null, run:null, player:null, chamber:null, boss:null,
  overlay:null, cinema:null, timeStop:0,
  hubSel:0, heatSel:0, upSel:0, talkSel:0, setSel:0, confirmReset:false
};

G.save = loadSave();
Audio2.vol = G.save.settings.vol!==undefined ? G.save.settings.vol : 0.5;

// ---------- 런 업데이트 ----------
function updateRun(dt){
  if(G.overlay){
    drawRunFrame(0); // 배경은 정지 화면
    drawOverlay();
    return;
  }
  if(hitstopT>0){ hitstopT-=dt; drawRunFrame(0); return; }
  if(G.timeStop>0) G.timeStop-=dt;

  updatePlayer(dt);
  for(const e of G.chamber.enemies) updateEnemy(e, dt);
  updateBoss(dt);
  updateProjectiles(dt);
  updateZones(dt);
  updateFx(dt);
  updateCamera(dt);
  checkClear(dt);
  interact();

  if(Input.hit('Escape')||Input.hit('KeyP')){ G.overlay={type:'pause'}; }

  drawRunFrame(dt);
}

function interact(){
  const p = G.player, ch = G.chamber;
  const use = Input.hit('ArrowUp')||Input.hit('KeyF');
  if(!use) return;
  // 문
  for(const d of ch.doors){
    if(rectHit(d,p)){ enterDoor(d); return; }
  }
  // 상자
  if(ch.chest && !ch.chest.opened && rectHit(ch.chest,p)){ openChest(ch.chest); return; }
  // 보상 제단
  if(ch.pedestals){
    for(const pd of ch.pedestals){
      if(rectHit(pd,p)){
        applyReward(pd);
        ch.pedestals = null;
        spawnDoors();
        return;
      }
    }
  }
  // 상점
  if(ch.npc && rectHit(ch.npc,p)){ G.overlay = {type:'shop', sel:0}; return; }
  // 이벤트
  if(ch.event && !ch.event.used && rectHit(ch.event,p)){ useEvent(ch.event); return; }
}

function drawRunFrame(dt){
  const o = camOff();
  drawWorld(o);
  drawZones(o);
  drawInteractables(o);
  for(const e of G.chamber.enemies) drawEnemy(o, e);
  if(G.boss && !G.boss.dead) drawBoss(o);
  drawPlayer(o);
  drawProjectiles(o);
  drawFx(o);
  // 시간 정지 연출
  if(G.timeStop>0){
    ctx.fillStyle='rgba(245,235,255,0.08)'; ctx.fillRect(0,0,VW,VH);
  }
  drawHUD();
  drawTouchUI();
}

// ---------- 터치 UI (10.2 모바일) ----------
let touchOn = false;
function drawTouchUI(){
  if(!touchOn) return;
  ctx.globalAlpha = 0.35;
  const btns = touchButtons();
  for(const b of btns){
    ctx.fillStyle = '#3F3550';
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI*2); ctx.fill();
    ctx.globalAlpha = 0.8;
    text(b.label, b.x, b.y+5, '#E8DED0', 13, 'center', true);
    ctx.globalAlpha = 0.35;
  }
  ctx.globalAlpha = 1;
}
function touchButtons(){
  return [
    {id:'left', x:70, y:VH-90, r:36, label:'←'},
    {id:'right', x:160, y:VH-90, r:36, label:'→'},
    {id:'jump', x:VW-70, y:VH-140, r:32, label:'점프'},
    {id:'atk', x:VW-150, y:VH-80, r:34, label:'공격'},
    {id:'heavy', x:VW-235, y:VH-120, r:28, label:'강'},
    {id:'dash', x:VW-70, y:VH-60, r:28, label:'대시'},
    {id:'spec', x:VW-235, y:VH-55, r:26, label:'특수'},
    {id:'q', x:VW-320, y:VH-100, r:24, label:'Q'},
    {id:'e', x:VW-320, y:VH-45, r:24, label:'E'}
  ];
}
function canvasPos(t){
  const r = cvs.getBoundingClientRect();
  return {x:(t.clientX-r.left)*VW/r.width, y:(t.clientY-r.top)*VH/r.height};
}
cvs.addEventListener('touchstart', e=>{
  e.preventDefault(); touchOn = true; Audio2.unlock();
  handleTouches(e);
  // 메뉴 상태에서는 탭 = J
  if(G.state!=='run'){ Input.pressed['KeyJ']=true; }
}, {passive:false});
cvs.addEventListener('touchmove', e=>{ e.preventDefault(); handleTouches(e); }, {passive:false});
cvs.addEventListener('touchend', e=>{ e.preventDefault(); handleTouches(e); }, {passive:false});
function handleTouches(e){
  const T = Input.touch;
  T.left=false; T.right=false; T.heavyHold=false;
  for(const t of e.touches){
    const pos = canvasPos(t);
    for(const b of touchButtons()){
      if(Math.hypot(pos.x-b.x, pos.y-b.y)<b.r+12){
        if(b.id==='left') T.left=true;
        else if(b.id==='right') T.right=true;
        else if(b.id==='heavy') T.heavyHold=true;
        else if(!T['_'+b.id]){ T[b.id]=true; }
        T['_'+b.id]=true;
      }
    }
  }
  // 뗀 버튼 초기화
  for(const b of touchButtons()){
    let held = false;
    for(const t of e.touches){
      const pos = canvasPos(t);
      if(Math.hypot(pos.x-b.x, pos.y-b.y)<b.r+12) held=true;
    }
    if(!held) T['_'+b.id]=false;
  }
}

// ---------- 메인 루프 ----------
let lastT = performance.now();
function frame(now){
  requestAnimationFrame(frame);
  let dt = (now-lastT)/1000;
  lastT = now;
  if(dt>0.1) dt = 0.1;

  try{
    switch(G.state){
      case 'title': drawTitle(dt); break;
      case 'cinema': drawCinema(dt); break;
      case 'hub': drawHub(dt); break;
      case 'heat': drawHeat(dt); break;
      case 'upgrade': drawUpgrade(dt); break;
      case 'talk': drawTalk(dt); break;
      case 'archive': drawArchive(dt); break;
      case 'settings': drawSettings(dt); break;
      case 'run': updateRun(dt); break;
      case 'results': drawResults(dt); break;
    }
  }catch(err){
    ctx.fillStyle='#0F0D14'; ctx.fillRect(0,0,VW,VH);
    text('오류: '+err.message, 20, 40, '#E63946', 13);
    text(String(err.stack).split('\n')[1]||'', 20, 62, '#6B5C6E', 11);
    console.error(err);
  }
  Input.clear();
}
requestAnimationFrame(frame);

// 반응형 스케일
function resize(){
  const scale = Math.min(window.innerWidth/VW, window.innerHeight/VH);
  cvs.style.width = Math.floor(VW*scale)+'px';
  cvs.style.height = Math.floor(VH*scale)+'px';
}
window.addEventListener('resize', resize);
resize();
