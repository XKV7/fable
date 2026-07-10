'use strict';
// ============ 엔티티: 바리 · 신령 폼 · 잡귀 · 보스 · 투사체 ============

let projectiles = [];

// ---------- 플레이어 ----------
function makePlayer(){
  const p = {
    x:100, y:0, w:20, h:36, vx:0, vy:0, face:1, onGround:false,
    form:'bari', slots:[null,null], hp:0, sp:0,
    jumpsUsed:0, dashT:0, dashCD:0, dashCharges:1, airDashUsed:0, dashBuffT:0,
    iframe:0, swapCDT:0, knockT:0,
    atk:null, combo:0, comboT:0, chargeT:-1, atkCD:0,
    buffs:{gwangi:0, cheolgap:0, nospend:0, freethrow:false, bunshinT:0, freepossT:0},
    talismans:[], relics:[], consumables:[], jade:0,
    usedRevive:false, usedBell:false, spiritDmg:{},
    hitFlash:0
  };
  return p;
}

function tierOf(t){ return TIER_MULT[t.tier] / TIER_MULT[TALISMANS.find(x=>x.id===t.id).tier]; }
function eff(key){
  const p = G.player; let v = 0;
  for(const t of p.talismans){
    const def = TALISMANS.find(x=>x.id===t.id);
    if(def.eff[key]) v += def.eff[key] * (TIER_MULT[t.tier]/TIER_MULT[def.tier]);
  }
  for(const rid of p.relics){
    const def = RELICS.find(x=>x.id===rid);
    if(def && def.eff[key]) v += def.eff[key];
  }
  return v;
}
function hasEff(key){ return eff(key) > 0; }

function maxHP(){
  const f = curForm();
  return Math.round((BASE.hp + G.save.upgrades.hp*10 + eff('maxhp')) * (f.hp||1) * (1+eff('all')));
}
function maxSP(){ return Math.round((BASE.sp + G.save.upgrades.sp*15 + eff('maxsp')) * (1+eff('all'))); }
function moveSpeed(){
  const f = curForm();
  return BASE.speed * (1 + eff('spd') + G.save.upgrades.spd*0.05 + eff('all')) * (f.spd||1);
}
function curForm(){ return G.player.form==='bari' ? {id:'bari',hp:1,spd:1} : SPIRITS[G.player.form]; }
function atkMult(){
  const p = G.player;
  let m = 1 + eff('atk') + eff('all');
  if(p.hp < maxHP()*0.5) m += eff('rage');
  if(p.form!=='bari'){
    m += eff('spiritatk') + eff('sig_'+p.form);
    if(G.save.affinity[p.form]>=100) m += 0.20; // 진명 보너스
  }
  if(p.dashBuffT>0) m += eff('dashbuff');
  if(p.buffs.gwangi>0) m += 0; // 광기는 공속
  return m;
}
function critChance(){ return 0.05 + eff('crit'); }
function critMult(){ return 1.5 + eff('critdmg'); }

// ---------- 물리 ----------
function physics(ent, dt){
  const ch = G.chamber;
  ent.vy += BASE.grav*dt;
  if(ent.vy>700) ent.vy=700;
  ent.x += ent.vx*dt; ent.y += ent.vy*dt;
  ent.onGround = false;
  // 바닥
  const floor = ch.h - 32;
  if(ent.y+ent.h >= floor){ ent.y = floor-ent.h; ent.vy = 0; ent.onGround = true; }
  // 플랫폼 (일방향)
  if(ent.vy>=0 && !ent.dropThrough){
    for(const pl of ch.plats){
      if(ent.x+ent.w>pl.x && ent.x<pl.x+pl.w){
        const prevB = ent.y+ent.h - ent.vy*dt;
        if(prevB <= pl.y+6 && ent.y+ent.h >= pl.y && ent.y+ent.h <= pl.y+18){
          ent.y = pl.y-ent.h; ent.vy = 0; ent.onGround = true;
        }
      }
    }
  }
  ent.x = clamp(ent.x, 4, ch.w-ent.w-4);
  if(ent.y > ch.h+100){ ent.y = -40; } // 안전망
}

// ---------- 플레이어 업데이트 ----------
function updatePlayer(dt){
  const p = G.player;
  // 타이머
  p.iframe-=dt; p.swapCDT-=dt; p.dashCD-=dt; p.comboT-=dt; p.atkCD-=dt;
  p.dashBuffT-=dt; p.knockT-=dt; p.hitFlash-=dt;
  for(const k of ['gwangi','cheolgap','nospend','bunshinT','freepossT']) if(p.buffs[k]>0) p.buffs[k]-=dt;
  if(hasEff('hpregen')) p.hp = Math.min(maxHP(), p.hp + eff('hpregen')*dt);

  // SP (6.2)
  const heatSP = G.run.heat>=3 ? 1.5 : 1;
  if(p.form==='bari'){
    p.sp = Math.min(maxSP(), p.sp + (BASE.spRegen + eff('spregen'))*dt);
  } else {
    const free = p.buffs.nospend>0 || p.buffs.freepossT>0;
    if(!free) p.sp -= BASE.spDrain * heatSP * (1-clamp(eff('spsave'),0,0.8)) * dt;
    if(p.sp<=0){ p.sp=0; setForm('bari'); spawnDmgText(p.x+10,p.y-10,'SP 고갈!','#4A7BC9'); }
  }

  const speed = moveSpeed();
  const dashing = p.dashT>0;

  // 대시 (16.1)
  if(dashing){
    p.dashT-=dt;
    p.vx = p.face * (BASE.dashDist/BASE.dashTime);
    p.vy = 0;
    if(eff('dashdmg')>0){
      for(const e of G.chamber.enemies){
        if(!e.dead && !e.dashHit && rectHit(p,e)){ e.dashHit=true; damageEnemy(e, eff('dashdmg')*atkMult(), {}); }
      }
      if(G.boss && !G.boss.dead && !G.boss.dashHit && rectHit(p,G.boss)){ G.boss.dashHit=true; damageBoss(eff('dashdmg')*atkMult(),{}); }
    }
    if(p.dashT<=0){ p.dashBuffT = hasEff('dashbuff')?2:0; }
  } else if(p.knockT>0){
    // 넉백 중
  } else {
    let mv = 0;
    if(Input.left()) mv=-1;
    if(Input.right()) mv=1;
    if(p.atk && p.onGround) mv*=0.15;
    p.vx = mv*speed;
    if(mv!==0 && !p.atk) p.face = mv;
  }

  // 점프
  const maxJumps = 2 + eff('jumps');
  if((Input.hit('Space')||Input.hit('KeyW')||Input.touch.jump) && !dashing){
    Input.touch.jump=false;
    if(p.onGround){ p.vy = -BASE.jump; p.jumpsUsed=1; Audio2.sfx('jump'); }
    else if(p.jumpsUsed < maxJumps){ p.vy = -BASE.jump2; p.jumpsUsed++; Audio2.sfx('jump'); spawnParticles(p.x+10,p.y+34,'#B6ACB6',4,60,0.3); }
  }
  if(p.onGround) { p.jumpsUsed = p.jumpsUsed>0&&p.vy<0?p.jumpsUsed:0; p.airDashUsed=0; }
  // 하향 점프
  p.dropThrough = Input.down('ArrowDown')||Input.down('KeyS');

  // 대시 입력
  if((Input.hit('ShiftLeft')||Input.hit('ShiftRight')||Input.touch.dash) && p.dashCD<=0 && !dashing){
    Input.touch.dash=false;
    const airOK = p.onGround || p.airDashUsed < 1+eff('airdash');
    if(airOK){
      if(!p.onGround) p.airDashUsed++;
      p.dashT = BASE.dashTime;
      p.iframe = Math.max(p.iframe, BASE.dashIFrame + eff('iframe'));
      p.dashCD = BASE.dashCD*(1-clamp(eff('dashcd'),0,0.7)) / (1+eff('dashcharge')*0.5);
      for(const e of G.chamber.enemies) e.dashHit=false;
      if(G.boss) G.boss.dashHit=false;
      Audio2.sfx('dash');
      spawnParticles(p.x+10,p.y+20,'#4A7BC9',6,80,0.3);
    }
  }

  // 스왑 (Q/E)
  if(Input.hit('KeyQ')||Input.touch.q){ Input.touch.q=false; trySwap(0); }
  if(Input.hit('KeyE')||Input.touch.e){ Input.touch.e=false; trySwap(1); }

  // 공격
  updateAttack(dt);

  // 소비품
  if(Input.hit('Digit1')) useConsumable(0);
  if(Input.hit('Digit2')) useConsumable(1);
  if(Input.hit('Digit3')) useConsumable(2);

  physics(p, dt);

  // 분신 (구미호)
  if(p.buffs.bunshinT>0){
    p.bunshinA = (p.bunshinA||0) + dt*4;
    for(let i=0;i<3;i++){
      const a = p.bunshinA + i*Math.PI*2/3;
      const bx = p.x+10+Math.cos(a)*36, by = p.y+16+Math.sin(a)*24;
      for(const e of G.chamber.enemies){
        if(!e.dead && Math.abs(e.x+e.w/2-bx)<20 && Math.abs(e.y+e.h/2-by)<20){
          if(!e.bunshinCD || e.bunshinCD<=0){ e.bunshinCD=0.5; damageEnemy(e, 8*atkMult(), {}); }
        }
      }
    }
  }
  for(const e of G.chamber.enemies) if(e.bunshinCD>0) e.bunshinCD-=dt;
}

function trySwap(slot){
  const p = G.player;
  if(p.swapCDT>0) return;
  const target = p.slots[slot];
  if(p.form!=='bari' && (target===p.form || !target)){ doSwap('bari'); return; }
  if(!target){ spawnDmgText(p.x+10,p.y-14,'빈 슬롯','#6B5C6E'); return; }
  if(target===p.form) { doSwap('bari'); return; }
  if(p.sp < 5){ spawnDmgText(p.x+10,p.y-14,'SP 부족','#4A7BC9'); return; }
  doSwap(target);
}
function doSwap(formId){
  const p = G.player;
  const ratio = p.hp/maxHP();
  p.form = formId;
  p.hp = Math.min(maxHP(), Math.max(1, Math.round(maxHP()*ratio)));
  p.swapCDT = BASE.swapCD*(1-clamp(eff('swapcd'),0,0.8));
  p.iframe = Math.max(p.iframe, 0.2);
  p.atk = null; p.combo = 0; p.chargeT = -1;
  Audio2.sfx('swap');
  const col = formId==='bari' ? '#F5EBD6' : SPIRITS[formId].col[2];
  spawnParticles(p.x+10, p.y+18, col, 14, 140, 0.5);
  if(eff('swapblast')>0){
    areaDamage(p.x+10, p.y+18, 70, eff('swapblast')*atkMult(), col);
  }
}
function setForm(f){ doSwap(f); }

// ---------- 공격 ----------
function formAttacks(){
  const p = G.player, f = p.form;
  if(f==='bari') return {combo:[BARI_MOVES.a1,BARI_MOVES.a2,BARI_MOVES.a3], rate:1};
  const s = SPIRITS[f];
  if(f==='gumiho') return {combo:s.atk.dmg.map((d,i)=>({dmg:d,windup:0.05,active:0.08,recover:0.09,range:i===3?45:30})), rate:1};
  return {combo:[{dmg:s.atk.dmg,windup:s.atk.rate*0.35,active:0.12,recover:s.atk.rate*0.35,range:Math.min(s.atk.range,70)}], rate:1};
}

function updateAttack(dt){
  const p = G.player;
  const spdBuff = p.buffs.gwangi>0 ? 1.3 : 1;

  // 진행 중인 공격
  if(p.atk){
    p.atk.t += dt*spdBuff;
    const m = p.atk.move;
    if(p.atk.phase==='windup' && p.atk.t>=m.windup){ p.atk.phase='active'; p.atk.t=0; p.atk.hit={}; doAttackEffect(m); }
    else if(p.atk.phase==='active'){
      attackHitCheck(m);
      if(p.atk.t>=m.active){ p.atk.phase='recover'; p.atk.t=0; }
    }
    else if(p.atk.phase==='recover' && p.atk.t>=m.recover){
      p.atk=null; p.comboT = BASE.comboWindow;
    }
    return;
  }

  const atkKey = Input.hit('KeyJ')||Input.hit('KeyX')||Input.touch.atk;
  const heavyDown = Input.down('KeyK')||Input.down('KeyC')||Input.touch.heavyHold;
  const specKey = Input.hit('KeyL')||Input.hit('KeyV')||Input.touch.spec;
  if(Input.touch.atk) Input.touch.atk=false;
  if(Input.touch.spec) Input.touch.spec=false;

  // 강공격 차지 (6.1: 0.4s)
  const mythicFan = p.form==='bari' && G.run.mythic;
  const chargeNeed = mythicFan ? 0.1 : BARI_MOVES.heavy.charge;
  if(p.chargeT>=0){
    if(heavyDown){ p.chargeT += dt; }
    else {
      if(p.chargeT >= chargeNeed) doHeavy(p.chargeT);
      p.chargeT = -1;
    }
    return;
  }
  if(heavyDown && p.atkCD<=0){ p.chargeT = 0; return; }

  // 특수
  if(specKey && p.atkCD<=0){ doSpecial(); return; }

  // 기본 콤보
  if(atkKey && p.atkCD<=0){
    const atks = formAttacks();
    if(p.comboT<=0) p.combo = 0;
    const idx = p.combo % atks.combo.length;
    const mv = Object.assign({}, atks.combo[idx]);
    if(idx===atks.combo.length-1 && hasEff('combo3')) mv.dmg = Math.round(mv.dmg*(1+eff('combo3')));
    mv.comboIdx = idx;
    p.combo++;
    p.atk = {move:mv, phase:'windup', t:0};
  }
}

function attackBox(m){
  const p = G.player;
  const r = m.range;
  return {x: p.face>0 ? p.x+p.w : p.x-r, y:p.y-6, w:r, h:p.h+12};
}
function doAttackEffect(m){
  const p = G.player;
  // 이무기: 기본 공격은 투사체 (물결파)
  if(p.form==='imugi' && !m.isHeavy){
    Audio2.sfx('cast');
    spawnProj({x:p.x+p.w/2, y:p.y+14, vx:p.face*380, vy:0, r:8, dmg:m.dmg*atkMult(),
      owner:'player', col:'#4A7BC9', ttl:1.6, wave:true});
    m.projectile = true;
    return;
  }
  Audio2.sfx(m.isHeavy?'heavy':'hit');
}
function attackHitCheck(m){
  if(m.projectile) return;
  const p = G.player;
  const box = attackBox(m);
  const hits = [];
  for(const e of G.chamber.enemies) if(!e.dead && !p.atk.hit[e.uid] && rectHit(box,e)) hits.push(e);
  for(const e of hits){
    p.atk.hit[e.uid]=true;
    damageEnemy(e, m.dmg*atkMult(), {heavy:m.isHeavy, knock:p.face*(m.isHeavy?220:90), stun:m.stun});
  }
  if(G.boss && !G.boss.dead && !p.atk.hit['boss'] && rectHit(box,G.boss)){
    p.atk.hit['boss']=true;
    damageBoss(m.dmg*atkMult(), {heavy:m.isHeavy});
  }
}

function doHeavy(chargedT){
  const p = G.player, f = p.form;
  p.atkCD = 0.2;
  if(f==='bari'){
    const mythic = G.run.mythic;
    const m = Object.assign({}, BARI_MOVES.heavy);
    m.isHeavy = true;
    if(mythic){
      if(p.sp<5){ spawnDmgText(p.x,p.y-10,'SP 부족','#4A7BC9'); return; }
      p.sp-=5; m.dmg = 75; m.range = 160;
      const elCol = pick(['#E63946','#4A7BC9','#F5C56D']);
      p.atk = {move:m, phase:'windup', t:0};
      spawnParticles(p.x+10,p.y+10,elCol,16,180,0.5);
    } else {
      m.dmg = 25;
      if(eff('heavyblast')>0) m.blast = eff('heavyblast');
      p.atk = {move:m, phase:'windup', t:0};
    }
    addShake(8,0.2); hitstop(0.06);
    if(m.blast) setTimeout(()=>{ areaDamage(p.x+10+p.face*50, p.y+18, 60, m.blast*atkMult(), '#E63946'); }, 120);
  }
  else if(f==='dokkaebi'){
    const s = SPIRITS.dokkaebi;
    p.atk = {move:{dmg:s.heavy.dmg, windup:0.3, active:0.15, recover:0.35, range:70, isHeavy:true}, phase:'windup', t:0};
    setTimeout(()=>{ if(G.state!=='run')return;
      spawnProj({x:p.x+p.w/2, y:p.y+p.h-10, vx:p.face*300, vy:0, r:12, dmg:s.heavy.wave*atkMult(), owner:'player', col:'#E63946', ttl:0.5, ground:true});
    }, 300);
    addShake(8,0.2);
  }
  else if(f==='gumiho'){
    // 환영 대시: 관통 이동
    const s = SPIRITS.gumiho;
    p.iframe = Math.max(p.iframe,0.3);
    const box = {x:Math.min(p.x, p.x+p.face*s.heavy.range), y:p.y-4, w:s.heavy.range+p.w, h:p.h+8};
    for(const e of G.chamber.enemies) if(!e.dead && rectHit(box,e)) damageEnemy(e, s.heavy.dmg*atkMult(), {});
    if(G.boss && !G.boss.dead && rectHit(box,G.boss)) damageBoss(s.heavy.dmg*atkMult(),{});
    p.x = clamp(p.x + p.face*s.heavy.range, 4, G.chamber.w-p.w-4);
    spawnParticles(p.x+10,p.y+18,'#FF7BAC',12,150,0.4);
    Audio2.sfx('dash'); p.atkCD=0.5;
  }
  else if(f==='imugi'){
    const s = SPIRITS.imugi;
    const tx = clamp(p.x+p.face*s.heavy.range, 20, G.chamber.w-20);
    let hits=0;
    const iv = setInterval(()=>{
      if(G.state!=='run'||hits>=s.heavy.hits){ clearInterval(iv); return; }
      hits++;
      areaDamage(tx, G.chamber.h-60, 50, s.heavy.dmg*atkMult(), '#4A7BC9', s.heavy.stun);
      addShake(4,0.1);
    }, 160);
    p.atkCD=0.9; Audio2.sfx('heavy');
  }
  else if(f==='jeoseung'){
    const s = SPIRITS.jeoseung;
    spawnProj({x:p.x+p.w/2, y:p.y+14, vx:p.face*500, vy:0, r:10, dmg:s.heavy.dmg*atkMult(),
      owner:'player', col:'#6E5F80', ttl:0.35, pierce:true});
    p.atkCD=0.6; Audio2.sfx('heavy');
  }
  else if(f==='bulgasari'){
    const s = SPIRITS.bulgasari;
    const cr = clamp(chargedT/1.2, 0, 1);
    const dmg = lerp(s.heavy.dmgMin, s.heavy.dmgMax, cr);
    const range = lerp(100, s.heavy.range, cr);
    p.iframe = Math.max(p.iframe, 0.2);
    const box = {x:Math.min(p.x, p.x+p.face*range), y:p.y-4, w:range+p.w, h:p.h+8};
    for(const e of G.chamber.enemies) if(!e.dead && rectHit(box,e)) damageEnemy(e, dmg*atkMult(), {knock:p.face*260});
    if(G.boss && !G.boss.dead && rectHit(box,G.boss)) damageBoss(dmg*atkMult(),{});
    p.x = clamp(p.x + p.face*range, 4, G.chamber.w-p.w-4);
    addShake(8,0.2); Audio2.sfx('heavy'); p.atkCD=0.7;
  }
}

function doSpecial(){
  const p = G.player, f = p.form;
  const specSave = 1-clamp(eff('specsave'),0,0.7);
  if(f==='bari'){
    // 부적 투척 (16.2)
    let cost = BARI_MOVES.talisman.spCost*specSave;
    if(p.buffs.freethrow){ cost=0; }
    if(p.sp<cost){ spawnDmgText(p.x,p.y-10,'SP 부족','#4A7BC9'); return; }
    p.sp-=cost;
    const dmgX = (1+eff('throwdmg')) * (p.buffs.freethrow?1.5:1);
    p.buffs.freethrow = false;
    spawnProj({x:p.x+p.w/2, y:p.y+10, vx:p.face*450, vy:-60, r:7, dmg:BARI_MOVES.talisman.dmg*atkMult()*dmgX,
      owner:'player', col:'#F5C56D', ttl:2, grav:200, blast:BARI_MOVES.talisman.blast*atkMult()*dmgX});
    Audio2.sfx('throw'); p.atkCD=0.3;
    return;
  }
  const s = SPIRITS[f];
  const cost = s.special.sp*specSave;
  if(p.sp<cost){ spawnDmgText(p.x,p.y-10,'SP 부족','#4A7BC9'); return; }
  p.sp-=cost;
  Audio2.sfx('cast');
  if(f==='dokkaebi'){ p.buffs.gwangi=5; spawnDmgText(p.x+10,p.y-14,'광기!','#E63946',true); }
  else if(f==='gumiho'){ p.buffs.bunshinT=10; spawnDmgText(p.x+10,p.y-14,'분신!','#FF7BAC',true); }
  else if(f==='imugi'){
    for(let i=0;i<5;i++){
      setTimeout(()=>{ if(G.state!=='run')return;
        const tx = clamp(p.x + p.face*(60+i*70) + rand(-20,20), 20, G.chamber.w-20);
        spawnProj({x:tx, y:cam.y-10, vx:0, vy:520, r:8, dmg:15*atkMult(), owner:'player', col:'#4A7BC9', ttl:2.5});
      }, i*130);
    }
    spawnDmgText(p.x+10,p.y-14,'용의 비!','#4A7BC9',true);
  }
  else if(f==='jeoseung'){
    G.timeStop = 2; Audio2.sfx('stun');
    spawnDmgText(p.x+10,p.y-14,'시간 정지','#F5EBFF',true);
  }
  else if(f==='bulgasari'){ p.buffs.cheolgap=5; spawnDmgText(p.x+10,p.y-14,'철갑!','#D4A574',true); }
  p.atkCD=0.4;
}

function useConsumable(i){
  const p = G.player;
  const cid = p.consumables[i];
  if(!cid) return;
  const c = CONSUMABLES.find(x=>x.id===cid);
  const potX = 1+eff('potion');
  let ok = true;
  switch(c.use){
    case 'heal50': p.hp = Math.min(maxHP(), p.hp+50*potX); spawnDmgText(p.x+10,p.y-14,'+'+Math.round(50*potX),'#7BC97B',true); break;
    case 'sp100': p.sp = Math.min(maxSP(), p.sp+100*potX); break;
    case 'freethrow': p.buffs.freethrow = true; break;
    case 'nospend': p.buffs.nospend = 10; break;
    case 'wipe':
      for(const e of G.chamber.enemies) if(!e.dead && !e.miniboss) killEnemy(e,true);
      addShake(10,0.3); break;
    default: ok=false;
  }
  if(ok){ p.consumables.splice(i,1); Audio2.sfx('pickup'); }
}

// ---------- 광역 피해 ----------
function areaDamage(x,y,r,dmg,col,stun){
  spawnParticles(x,y,col||'#E63946',12,160,0.5);
  for(const e of G.chamber.enemies){
    if(!e.dead && Math.hypot(e.x+e.w/2-x, e.y+e.h/2-y) < r+e.w/2){
      damageEnemy(e, dmg, {stun});
    }
  }
  if(G.boss && !G.boss.dead && Math.hypot(G.boss.x+G.boss.w/2-x, G.boss.y+G.boss.h/2-y) < r+G.boss.w/2){
    damageBoss(dmg, {});
  }
}

// ---------- 잡귀 ----------
let enemyUid = 0;
function spawnEnemy(kind, x, y, opt){
  opt = opt||{};
  const base = ENEMIES[kind];
  const st = STAGES[G.run.stageIdx];
  const variants = REGION_VARIANTS[st.id]||{};
  const vr = variants[kind];
  const heat = G.run.heat;
  let hp = base.hp * (heat>=1?1.2:1), dmg = base.dmg * (heat>=1?1.1:1);
  // 스테이지 진행 스케일링
  const sc = 1 + G.run.stageIdx*0.35;
  hp*=sc; dmg*=(1+G.run.stageIdx*0.18);
  const e = {
    uid:enemyUid++, kind, name:(vr?vr.name:base.name), tweak:vr?vr.tweak:null,
    hp, maxhp:hp, dmg, spd:base.spd, range:base.range, detect:base.detect,
    x, y, w:base.size===48?30:base.size===24?16:20, h:base.size===48?42:base.size===24?16:28,
    vx:0, vy:0, face:-1, state:'idle', t:rand(0,1), castT:0, touchCD:0,
    burn:0, stun:0, dead:false, elite:opt.elite||null, miniboss:opt.miniboss||false,
    frontDR: base.frontDR||0, buried: false, size:base.size, flip:0
  };
  if(e.tweak==='ambush'){ e.buried = true; }
  if(e.elite){
    const el = ELITES[e.elite];
    if(el.hpX){ e.hp*=el.hpX; e.maxhp*=el.hpX; }
    if(el.dmgX) e.dmg*=el.dmgX;
  }
  if(e.miniboss){
    e.hp*=6; e.maxhp*=6; e.dmg*=1.4; e.w*=1.6; e.h*=1.6; e.name = st.mini;
  }
  G.chamber.enemies.push(e);
  return e;
}

function updateEnemy(e, dt){
  if(e.dead) return;
  if(G.timeStop>0) return;
  const p = G.player;
  e.t += dt; e.touchCD -= dt; e.flip += dt;
  if(e.stun>0){ e.stun-=dt; e.vx=0; physics(e,dt); return; }
  if(e.burn>0){
    e.burn-=dt;
    e.burnTick=(e.burnTick||0)-dt;
    if(e.burnTick<=0){ e.burnTick=0.5; damageEnemy(e, 1.5*(1+eff('burnx')), {noBurn:true, silent:true}); }
  }
  const pc = {x:p.x+p.w/2, y:p.y+p.h/2};
  const ec = {x:e.x+e.w/2, y:e.y+e.h/2};
  const dx = pc.x-ec.x, dxa = Math.abs(dx), dy = Math.abs(pc.y-ec.y);
  const inDetect = dxa < e.detect && dy < 160;

  if(e.buried){
    if(dxa<70){ e.buried=false; e.vy=-300; e.state='chase'; spawnParticles(ec.x,e.y+e.h,'#2B4F8B',10,120,0.4); }
    else return;
  }

  switch(e.kind){
    case 'gaekgwi': { // 돌격형
      if(e.state==='idle'){ if(inDetect) e.state='chase'; e.vx = Math.sin(e.t)*10; }
      else if(e.state==='chase'){
        e.face = dx>0?1:-1;
        e.vx = e.face*e.spd;
        if(e.tweak==='jump' && e.onGround && chance(0.02)) e.vy=-320;
        if(e.tweak==='teleport'){ e.tpT=(e.tpT||3)-dt; if(e.tpT<=0){ e.tpT=3; e.x=clamp(pc.x-e.face*80,10,G.chamber.w-30); spawnParticles(ec.x,ec.y,'#FF206E',8,100,0.4);} }
        const atkRange = e.tweak==='spear'?55:e.range;
        if(dxa < atkRange+10 && dy<40){ e.state='windup'; e.t=0; e.vx=0; }
      }
      else if(e.state==='windup'){ e.vx=0; if(e.t>0.35){ e.state='lunge'; e.t=0; e.vx=e.face*e.spd*2.2; } }
      else if(e.state==='lunge'){
        if(e.t>0.25){ e.state='chase'; }
        if(e.touchCD<=0 && rectHit(e,p)){ e.touchCD=0.8; damagePlayer(e.dmg, e); }
      }
      break;
    }
    case 'mongdal': { // 원거리 캐스터
      if(inDetect || e.castT>0){
        e.face = dx>0?1:-1;
        if(dxa<120) e.vx = -e.face*e.spd; else if(dxa>220) e.vx = e.face*e.spd; else e.vx=0;
        e.castT += dt;
        const ct = ENEMIES.mongdal.castTime; // 1.5s
        if(e.castT>=ct){
          e.castT = 0;
          const ang = Math.atan2(pc.y-ec.y, pc.x-ec.x);
          if(e.tweak==='rock'){
            spawnProj({x:ec.x,y:ec.y,vx:dx>0?180:-180,vy:-260,r:8,dmg:e.dmg,owner:'enemy',col:'#A17B4E',ttl:3,grav:500});
          } else {
            spawnProj({x:ec.x,y:ec.y,vx:Math.cos(ang)*230,vy:Math.sin(ang)*230,r:6,dmg:e.dmg,owner:'enemy',
              col:e.tweak==='debuff'?'#A5304F':'#6E5F80',ttl:3,slow:e.tweak==='debuff'});
          }
          Audio2.sfx('cast');
        }
      } else e.vx = 0;
      break;
    }
    case 'baekja': { // 방패형
      if(inDetect){
        e.face = dx>0?1:-1;
        e.vx = e.face*e.spd;
        if(dxa < e.range+10 && dy<50){
          if(e.state!=='windup'){ e.state='windup'; e.t=0; }
        }
        if(e.state==='windup'){
          e.vx = 0;
          const combo = e.tweak==='combo';
          if(e.t> (combo?0.5:0.7)){
            e.state='chase'; e.t=0;
            const hits = combo?4:1;
            for(let i=0;i<hits;i++) setTimeout(()=>{
              if(G.state!=='run'||e.dead) return;
              const box = {x:e.face>0?e.x+e.w:e.x-45, y:e.y, w:45, h:e.h};
              if(rectHit(box,G.player)) damagePlayer(e.dmg*(combo?0.5:1), e);
              addShake(2,0.05);
            }, i*180);
          }
        }
      } else e.vx = 0;
      break;
    }
    case 'dalgyal': { // 스웜
      if(inDetect){
        e.face = dx>0?1:-1;
        e.vx = e.face*e.spd*(0.6+0.4*Math.sin(e.t*7));
        if(e.onGround && chance(0.05)) e.vy = -250;
        if(e.touchCD<=0 && rectHit(e,p)){ e.touchCD=0.7; damagePlayer(e.dmg, e); }
      } else e.vx = Math.sin(e.t*2)*30;
      break;
    }
  }
  physics(e, dt);
}

function damageEnemy(e, raw, opts){
  opts = opts||{};
  if(e.dead) return;
  let dmg = raw;
  let isCrit = false;
  if(!opts.silent){
    if(chance(critChance())){ isCrit=true; dmg*=critMult(); }
    // 백어택 (16.1): 적이 등을 보일 때 — 바라보는 방향의 반대편에서 공격
    const p = G.player;
    if((e.face>0 && p.x+p.w/2 < e.x+e.w/2) || (e.face<0 && p.x+p.w/2 > e.x+e.w/2)){
      dmg *= BASE.backAtk + eff('backx');
    }
    // 백자 정면 방패 (8.1)
    if(e.frontDR>0){
      const facingPlayer = (e.face>0) === (G.player.x+G.player.w/2 > e.x+e.w/2);
      if(facingPlayer) dmg *= e.frontDR;
    }
  }
  dmg = Math.max(1, Math.round(dmg));
  e.hp -= dmg;
  if(!opts.silent){
    if(hasEff('burn') && !opts.noBurn) e.burn = 3;
    if(opts.stun) e.stun = Math.max(e.stun||0, opts.stun);
    if(opts.knock && !e.miniboss){ e.vx = opts.knock; e.vy = -60; }
    e.hitFlash = 0.1;
    spawnDmgText(e.x+e.w/2, e.y-4, dmg, isCrit?'#E63946':'#F5EBD6', isCrit);
    spawnParticles(e.x+e.w/2, e.y+e.h/2, isCrit?'#E63946':'#F5EBD6', isCrit?8:4, 100, 0.3);
    Audio2.sfx(isCrit?'crit':'hit');
    hitstop(opts.heavy?0.10:0.05); // 16.8
    addShake(opts.heavy?5:3, 0.1);
    // 호감도: 빙의 중 전투 기여
    if(G.player.form!=='bari'){
      G.run.spiritUse[G.player.form] = (G.run.spiritUse[G.player.form]||0)+dmg;
    }
  }
  if(e.hp<=0) killEnemy(e);
}

function killEnemy(e, silent){
  if(e.dead) return;
  e.dead = true;
  G.run.kills++;
  if(e.elite) G.run.eliteKills++;
  if(e.miniboss) G.run.miniKills++;
  spawnParticles(e.x+e.w/2, e.y+e.h/2, '#6E5F80', 14, 150, 0.6);
  // 9.1 옥 1~3, 신력 +1
  const jade = randi(1,3);
  G.player.jade += jade; G.run.sinryeok += 1;
  spawnDmgText(e.x+e.w/2, e.y-16, '+'+jade+'옥', '#7BC97B');
  if(e.elite==='han'){ G.run.sinryeok += ELITES.han.sinryeok; spawnDmgText(e.x+e.w/2,e.y-30,'+10 신력','#F5C56D'); }
  if(e.elite==='fire' && !silent){
    areaDamage(e.x+e.w/2, e.y+e.h/2, 50, ELITES.fire.boomDmg*0, '#E63946'); // 시각 효과
    // 플레이어에 폭발 피해
    if(Math.hypot(G.player.x+10-e.x-e.w/2, G.player.y+18-e.y-e.h/2)<55) damagePlayer(ELITES.fire.boomDmg, e);
  }
  if(!silent){
    if(eff('kaboom')>0) areaDamage(e.x+e.w/2, e.y+e.h/2, 55, eff('kaboom')*atkMult(), '#E63946');
    if(eff('killheal')>0) G.player.hp = Math.min(maxHP(), G.player.hp+eff('killheal'));
  }
}

// ---------- 플레이어 피격 ----------
function damagePlayer(raw, src){
  const p = G.player;
  if(p.iframe>0 || p.dashT>0) return;
  if(G.state!=='run') return;
  let dmg = raw;
  let dr = clamp(eff('dr') + (p.hp<maxHP()*0.3 ? eff('lowdr') : 0), 0, 0.75);
  if(p.buffs.cheolgap>0) dr = clamp(dr+0.5, 0, 0.85);
  dmg *= (1-dr);
  if(eff('dmgcap')>0) dmg = Math.min(dmg, eff('dmgcap'));
  dmg = Math.max(1, Math.round(dmg));
  p.hp -= dmg;
  p.iframe = BASE.hitInvuln + eff('hitiframe');
  p.hitFlash = 0.4;
  if(!hasEff('noknock') && src){ p.knockT=0.15; p.vx = (p.x<src.x?-1:1)*180; p.vy=-120; }
  spawnDmgText(p.x+p.w/2, p.y-8, '-'+dmg, '#FF4444', true);
  Audio2.sfx('hurt');
  addShake(3, 0.10);
  if(p.hp<=0) onPlayerDeath();
}

function onPlayerDeath(){
  const p = G.player;
  // 부활 수단: 봉황의 깃털 → 부활의 종
  if(hasEff('revive') && !p.usedRevive){
    p.usedRevive = true;
    p.hp = Math.round(maxHP()*(eff('revive')+eff('revivehp')));
    p.iframe = 2; Audio2.sfx('swap');
    spawnDmgText(p.x+10, p.y-20, '봉황의 깃털!', '#E63946', true);
    return;
  }
  if(G.save.upgrades.bell>0 && !p.usedBell){
    p.usedBell = true;
    p.hp = Math.round(maxHP()*(0.5+eff('revivehp')));
    p.iframe = 2; Audio2.sfx('swap');
    spawnDmgText(p.x+10, p.y-20, '부활의 종!', '#F5C56D', true);
    return;
  }
  p.hp = 0;
  Audio2.sfx('death');
  runDeath();
}

// ---------- 투사체 ----------
function spawnProj(o){
  o.ttl = o.ttl||2; o.r = o.r||6;
  projectiles.push(o);
}
function updateProjectiles(dt){
  const p = G.player, ch = G.chamber;
  for(const pr of projectiles){
    if(pr.owner==='enemy' && G.timeStop>0) continue;
    pr.ttl -= dt;
    if(pr.grav) pr.vy += pr.grav*dt;
    pr.x += pr.vx*dt; pr.y += pr.vy*dt;
    if(pr.wave) pr.y += Math.sin(pr.ttl*18)*1.2;
    if(pr.x<-20||pr.x>ch.w+20||pr.y>ch.h+40) pr.ttl=0;
    if(pr.ground && pr.y+pr.r < ch.h-32) pr.y = ch.h-32-pr.r;
    if(pr.owner==='player'){
      for(const e of ch.enemies){
        if(!e.dead && !pr.dead && Math.abs(e.x+e.w/2-pr.x)<e.w/2+pr.r && Math.abs(e.y+e.h/2-pr.y)<e.h/2+pr.r){
          damageEnemy(e, pr.dmg, {});
          if(pr.blast) areaDamage(pr.x, pr.y, 50, pr.blast, '#F5C56D');
          if(!pr.pierce){ pr.ttl=0; break; }
        }
      }
      if(G.boss && !G.boss.dead && pr.ttl>0 && Math.abs(G.boss.x+G.boss.w/2-pr.x)<G.boss.w/2+pr.r && Math.abs(G.boss.y+G.boss.h/2-pr.y)<G.boss.h/2+pr.r){
        damageBoss(pr.dmg, {});
        if(pr.blast) areaDamage(pr.x, pr.y, 50, pr.blast, '#F5C56D');
        if(!pr.pierce) pr.ttl=0;
      }
    } else {
      if(Math.abs(p.x+p.w/2-pr.x)<p.w/2+pr.r && Math.abs(p.y+p.h/2-pr.y)<p.h/2+pr.r){
        damagePlayer(pr.dmg, pr);
        if(pr.slow){ p.slowT = 2; }
        pr.ttl=0;
      }
    }
  }
  projectiles = projectiles.filter(pr=>pr.ttl>0);
}

// ---------- 보스 ----------
function makeBoss(){
  const st = STAGES[G.run.stageIdx];
  const heat = G.run.heat;
  let hp = st.bossHp * (heat>=2?1.3:1);
  const big = ['geosan','shadow'].includes(st.boss);
  const b = {
    id:st.boss, name:st.bossName, hp, maxhp:hp,
    w:big?90:64, h:big?100:72,
    x:G.chamber.w-200, y:0, vx:0, vy:0, face:-1,
    phase:1, act:{name:'intro', t:0}, cd:1.5, dead:false, stun:0,
    hitFlash:0, dying:false, choiceOffered:false
  };
  b.y = G.chamber.h-32-b.h;
  Audio2.sfx('boss');
  return b;
}

function bossPhaseCount(id){ return id==='shadow'?3:2; }
function bossPhase(b){
  const n = bossPhaseCount(b.id);
  const r = b.hp/b.maxhp;
  if(n===2) return r>0.5?1:2;
  return r>0.66?1 : r>0.33?2 : 3;
}

function damageBoss(raw, opts){
  const b = G.boss;
  if(!b || b.dead || b.iframe>0) return;
  let dmg = raw;
  let isCrit = false;
  if(chance(critChance())){ isCrit=true; dmg*=critMult(); }
  dmg = Math.max(1, Math.round(dmg));
  b.hp -= dmg;
  b.hitFlash = 0.1;
  spawnDmgText(b.x+b.w/2+rand(-15,15), b.y+20, dmg, isCrit?'#E63946':'#F5EBD6', isCrit);
  Audio2.sfx(isCrit?'crit':'hit2');
  hitstop(0.05); addShake(3,0.1);
  if(G.player.form!=='bari') G.run.spiritUse[G.player.form]=(G.run.spiritUse[G.player.form]||0)+dmg;
  const np = bossPhase(b);
  if(np !== b.phase){
    b.phase = np; b.act = {name:'phaseShift', t:0}; b.cd = 1.2;
    Audio2.sfx('phase'); addShake(12,0.25);
    spawnDmgText(b.x+b.w/2, b.y-10, '페이즈 '+np, '#E63946', true);
  }
  // 최종보스: HP 5% 이하 선택지 (16.9)
  if(b.id==='shadow' && b.hp<=b.maxhp*0.05 && !b.choiceOffered){
    b.choiceOffered = true;
    b.hp = Math.max(b.hp, 1);
    G.overlay = {type:'finalChoice', sel:0};
    return;
  }
  if(b.hp<=0){
    if(b.id==='shadow' && !G.run.finalResolved){ b.hp=1; return; }
    killBoss();
  }
}

function killBoss(){
  const b = G.boss;
  if(b.dead) return;
  b.dead = true;
  addShake(14,0.4); Audio2.sfx('boss');
  spawnParticles(b.x+b.w/2, b.y+b.h/2, '#F5EBD6', 30, 220, 1);
  spawnParticles(b.x+b.w/2, b.y+b.h/2, '#4B0082', 20, 180, 1);
  onBossDefeated();
}

// 보스 패턴 실행
function updateBoss(dt){
  const b = G.boss;
  if(!b || b.dead) return;
  if(G.timeStop>0) return;
  const p = G.player;
  b.hitFlash -= dt;
  const pc = {x:p.x+p.w/2, y:p.y+p.h/2};
  const bc = {x:b.x+b.w/2, y:b.y+b.h/2};
  const dx = pc.x-bc.x;
  b.act.t += dt;

  // 중력
  b.vy += BASE.grav*dt;
  b.y += b.vy*dt; b.x += b.vx*dt;
  const floor = G.chamber.h-32;
  if(b.y+b.h>=floor){ b.y=floor-b.h; b.vy=0; b.onGround=true; }
  b.x = clamp(b.x, 10, G.chamber.w-b.w-10);

  // 접촉 피해
  if(rectHit(b,p) && (b.touchCD||0)<=0){ b.touchCD=1; damagePlayer(15+G.run.stageIdx*4, b); }
  b.touchCD = (b.touchCD||0)-dt;

  if(b.act.name==='intro'){ if(b.act.t>1.2){ b.act={name:'idle',t:0}; } return; }
  if(b.act.name==='phaseShift'){ b.vx=0; if(b.act.t>1.0){ b.act={name:'idle',t:0}; } return; }
  if(b.act.name==='vulnerable'){ b.vx=0; if(b.act.t>1.5){ b.act={name:'idle',t:0}; b.cd=0.8; } return; }

  if(b.act.name==='idle'){
    b.face = dx>0?1:-1;
    // 천천히 접근
    if(Math.abs(dx)>180) b.vx = b.face*60; else b.vx = 0;
    b.cd -= dt;
    if(b.cd<=0){
      pickBossMove(b, dx);
    }
    return;
  }
  runBossMove(b, dt, pc, bc, dx);
}

function pickBossMove(b, dx){
  const P = b.phase;
  let moves;
  switch(b.id){
    case 'geosan': // 16.9 거산령
      moves = P===1 ? ['rockThrow','quake','pause'] : ['smash','jumpSlam','rockRain'];
      break;
    case 'musa':
      moves = P===1 ? ['swordDash','spear','summon'] : ['swordDash','bladeStorm','spear'];
      break;
    case 'mubok':
      moves = P===1 ? ['curseZone','spiritOrbs','spin'] : ['curseZone','curseRain','spin'];
      break;
    case 'haegwi':
      moves = P===1 ? ['waveL','tentacle','floodJump'] : ['waveBarrage','tentacle','whirlpool'];
      break;
    case 'pyedo':
      moves = P===1 ? ['tpStrike','darkBolts','cloneDash'] : ['tpStrike','neonLasers','darkBolts'];
      break;
    case 'shadow': // 16.9 바리의 그림자 3페이즈
      moves = P===1 ? ['summonGwi','darkTalismans','hanWave']
            : P===2 ? ['mirrorDokkaebi','mirrorGumiho','fanSpread']
            : ['hanExplosion','mirrorAll','jinmyeongCall'];
      break;
  }
  b.act = {name:pick(moves), t:0, step:0};
}

function bossShoot(b, tx, ty, spd, dmg, col, opt){
  const bc = {x:b.x+b.w/2, y:b.y+b.h/3};
  const a = Math.atan2(ty-bc.y, tx-bc.x);
  spawnProj(Object.assign({x:bc.x, y:bc.y, vx:Math.cos(a)*spd, vy:Math.sin(a)*spd,
    r:8, dmg, owner:'enemy', col:col||'#A5304F', ttl:4}, opt||{}));
}

function runBossMove(b, dt, pc, bc, dx){
  const a = b.act, D = G.run.stageIdx;
  const done = ()=>{ b.act={name:'idle',t:0}; b.cd = rand(1.0, 1.8) - b.phase*0.15; };
  switch(a.name){
    // === 거산령 ===
    case 'rockThrow': // 돌 던지기 25×3
      b.vx=0;
      if(a.t>0.5 && a.step<3 && a.t > 0.5+a.step*0.35){
        bossShoot(b, pc.x, pc.y-30, 260, 25, '#A17B4E', {grav:300, r:10}); a.step++;
        Audio2.sfx('throw');
      }
      if(a.step>=3 && a.t>2) done();
      break;
    case 'quake': // 지진 35 광역
      b.vx=0;
      if(a.t>0.8 && !a.hitDone){
        a.hitDone=true; addShake(10,0.3); Audio2.sfx('heavy');
        if(G.player.onGround) damagePlayer(35, b);
        spawnParticles(bc.x, G.chamber.h-32, '#A17B4E', 20, 200, 0.6);
      }
      if(a.t>1.4) done();
      break;
    case 'pause': // 잠시 멈춤 (1.5s 무방비)
      b.act={name:'vulnerable',t:0};
      spawnDmgText(b.x+b.w/2, b.y-8, '빈틈!', '#F5C56D', true);
      break;
    case 'smash': // 직접 강타 50
      b.face = dx>0?1:-1; b.vx = b.face*180;
      if(Math.abs(dx)<150 && !a.hitDone && a.t>0.3){
        a.hitDone = true; b.vx=0;
        const box={x:b.face>0?b.x+b.w:b.x-150, y:b.y, w:150, h:b.h+10};
        setTimeout(()=>{ if(G.state==='run'&&!b.dead&&rectHit(box,G.player)) damagePlayer(50,b); addShake(8,0.2); },250);
      }
      if(a.t>1.2) done();
      break;
    case 'jumpSlam': // 점프 슬램 60 + 충격파
      if(a.step===0){ b.vy=-450; b.vx=dx>0?200:-200; a.step=1; }
      else if(a.step===1 && b.onGround && a.t>0.3){
        a.step=2; addShake(12,0.25); Audio2.sfx('heavy');
        if(Math.abs(pc.x-bc.x)<130 && G.player.onGround) damagePlayer(60,b);
        spawnProj({x:bc.x-20,y:G.chamber.h-44,vx:-280,vy:0,r:10,dmg:25,owner:'enemy',col:'#6E5F80',ttl:2,ground:true});
        spawnProj({x:bc.x+20,y:G.chamber.h-44,vx:280,vy:0,r:10,dmg:25,owner:'enemy',col:'#6E5F80',ttl:2,ground:true});
      }
      if(a.step===2 && a.t>1) done();
      break;
    case 'rockRain': // 돌 비 20×5
      b.vx=0;
      if(a.step<5 && a.t>0.4+a.step*0.25){
        spawnProj({x:rand(40,G.chamber.w-40), y:cam.y-10, vx:0, vy:380, r:9, dmg:20, owner:'enemy', col:'#A17B4E', ttl:3});
        a.step++;
      }
      if(a.step>=5 && a.t>2.2) done();
      break;
    // === 백제 무사령 ===
    case 'swordDash':
      if(a.step===0 && a.t>0.4){ a.step=1; b.vx=(dx>0?1:-1)*420; b.face=dx>0?1:-1; }
      if(a.step===1){
        if((b.dashCheck||0)<=0 && rectHit(b,G.player)){ b.dashCheck=1; damagePlayer(28+D*3,b); }
        b.dashCheck=(b.dashCheck||0)-dt;
        if(a.t>1.0){ b.vx=0; done(); }
      }
      break;
    case 'spear':
      b.vx=0; b.face=dx>0?1:-1;
      if(a.t>0.6 && !a.hitDone){
        a.hitDone=true;
        bossShoot(b, pc.x, pc.y, 480, 22+D*3, '#D0CFCB', {r:6});
        Audio2.sfx('throw');
      }
      if(a.t>1.1) done();
      break;
    case 'summon':
      b.vx=0;
      if(a.t>0.7 && !a.hitDone){
        a.hitDone=true;
        if(G.chamber.enemies.filter(e=>!e.dead).length<3){
          spawnEnemy('gaekgwi', clamp(bc.x-80,20,G.chamber.w-40), b.y, {});
          spawnEnemy('gaekgwi', clamp(bc.x+80,20,G.chamber.w-40), b.y, {});
        }
        spawnParticles(bc.x, bc.y, '#6B4A2E', 16, 160, 0.6);
      }
      if(a.t>1.4) done();
      break;
    case 'bladeStorm':
      b.vx=0;
      if(a.step<6 && a.t>0.3+a.step*0.18){
        const ang = -Math.PI/2 + (a.step-2.5)*0.35;
        spawnProj({x:bc.x, y:bc.y-20, vx:Math.cos(ang)*300, vy:Math.sin(ang)*300, r:6, dmg:18+D*2, owner:'enemy', col:'#D0CFCB', ttl:3, grav:240});
        a.step++;
      }
      if(a.step>=6 && a.t>2) done();
      break;
    // === 무복귀 ===
    case 'curseZone':
      b.vx=0;
      if(a.t>0.6 && !a.hitDone){
        a.hitDone = true;
        G.chamber.zones.push({x:pc.x-50, y:G.chamber.h-92, w:100, h:60, t:3, dmg:8, col:'#A5304F'});
      }
      if(a.t>1.2) done();
      break;
    case 'spiritOrbs':
      b.vx=0;
      if(a.step<4 && a.t>0.4+a.step*0.3){
        bossShoot(b, pc.x, pc.y, 200, 16+D*2, '#A5304F', {r:7}); a.step++; Audio2.sfx('cast');
      }
      if(a.step>=4 && a.t>2.2) done();
      break;
    case 'spin':
      b.face = dx>0?1:-1; b.vx = b.face*230;
      if((b.dashCheck||0)<=0 && rectHit(b,G.player)){ b.dashCheck=0.8; damagePlayer(20+D*3,b); }
      b.dashCheck=(b.dashCheck||0)-dt;
      if(a.t>1.4){ b.vx=0; done(); }
      break;
    case 'curseRain':
      b.vx=0;
      if(a.step<7 && a.t>0.3+a.step*0.22){
        spawnProj({x:rand(30,G.chamber.w-30), y:cam.y-10, vx:0, vy:300, r:7, dmg:15, owner:'enemy', col:'#A5304F', ttl:3.5, slow:true});
        a.step++;
      }
      if(a.step>=7 && a.t>2.4) done();
      break;
    // === 해귀 ===
    case 'waveL':
      b.vx=0;
      if(a.t>0.5 && !a.hitDone){
        a.hitDone=true;
        spawnProj({x:bc.x, y:G.chamber.h-48, vx:dx>0?260:-260, vy:0, r:14, dmg:24+D*2, owner:'enemy', col:'#41EAD4', ttl:4, ground:true});
        Audio2.sfx('cast');
      }
      if(a.t>1.1) done();
      break;
    case 'tentacle':
      b.vx=0;
      if(a.t>0.7 && !a.hitDone){
        a.hitDone=true;
        const tx = pc.x;
        G.chamber.zones.push({x:tx-25, y:G.chamber.h-172, w:50, h:140, t:0.5, dmg:30, col:'#2B4F8B', once:true, warn:0.5});
        addShake(5,0.15);
      }
      if(a.t>1.5) done();
      break;
    case 'floodJump':
      if(a.step===0){ b.vy=-480; b.vx=(dx>0?1:-1)*240; a.step=1; }
      else if(a.step===1 && b.onGround && a.t>0.4){
        a.step=2; addShake(10,0.3);
        for(const sgn of [-1,1]) spawnProj({x:bc.x, y:G.chamber.h-48, vx:sgn*300, vy:0, r:12, dmg:22, owner:'enemy', col:'#41EAD4', ttl:3, ground:true});
      }
      if(a.step===2 && a.t>1.2) done();
      break;
    case 'waveBarrage':
      b.vx=0;
      if(a.step<4 && a.t>0.4+a.step*0.4){
        spawnProj({x:a.step%2?20:G.chamber.w-20, y:G.chamber.h-48, vx:a.step%2?280:-280, vy:0, r:13, dmg:20, owner:'enemy', col:'#41EAD4', ttl:5, ground:true});
        a.step++;
      }
      if(a.step>=4 && a.t>3) done();
      break;
    case 'whirlpool':
      // 끌어당김
      G.player.vx += (bc.x>pc.x?1:-1)*220*dt*8;
      spawnParticles(bc.x+rand(-60,60), bc.y+rand(-40,40), '#41EAD4', 1, 60, 0.4);
      if(a.t>2.2){ done(); }
      break;
    // === 폐도의 그림자 ===
    case 'tpStrike':
      if(a.step===0 && a.t>0.4){
        a.step=1;
        b.x = clamp(pc.x - (dx>0?-70:70), 10, G.chamber.w-b.w-10);
        spawnParticles(b.x+b.w/2, b.y+b.h/2, '#FF206E', 12, 140, 0.5);
      }
      if(a.step===1 && a.t>0.75 && !a.hitDone){
        a.hitDone=true;
        const box = {x:b.x-40, y:b.y, w:b.w+80, h:b.h};
        if(rectHit(box, G.player)) damagePlayer(30+D*2, b);
        addShake(6,0.15);
      }
      if(a.t>1.3) done();
      break;
    case 'darkBolts':
      b.vx=0;
      if(a.step<5 && a.t>0.3+a.step*0.25){
        bossShoot(b, pc.x, pc.y, 260, 16, '#4B0082', {r:7}); a.step++;
      }
      if(a.step>=5 && a.t>2.2) done();
      break;
    case 'cloneDash':
      if(a.step===0 && a.t>0.5){
        a.step=1;
        for(const sgn of [-1,1]) spawnProj({x:sgn>0?10:G.chamber.w-10, y:G.chamber.h-70, vx:sgn*350, vy:0, r:14, dmg:22, owner:'enemy', col:'#5C5C5C', ttl:3});
      }
      if(a.t>1.6) done();
      break;
    case 'neonLasers':
      b.vx=0;
      if(a.step<3 && a.t>0.5+a.step*0.6){
        const lx = a.step===0? pc.x : rand(60, G.chamber.w-60);
        G.chamber.zones.push({x:lx-12, y:0, w:24, h:G.chamber.h, t:0.4, dmg:28, col:'#FF206E', once:true, warn:0.6});
        a.step++;
      }
      if(a.step>=3 && a.t>2.8) done();
      break;
    // === 바리의 그림자 (16.9) ===
    case 'summonGwi':
      b.vx=0;
      if(a.t>0.6 && !a.hitDone){
        a.hitDone=true;
        const alive = G.chamber.enemies.filter(e=>!e.dead).length;
        if(alive<3){ spawnEnemy('gaekgwi', clamp(bc.x-100,20,G.chamber.w-40), 100, {}); spawnEnemy('mongdal', clamp(bc.x+100,20,G.chamber.w-40), 100, {}); }
        spawnParticles(bc.x, bc.y, '#4B0082', 20, 180, 0.7);
      }
      if(a.t>1.3) done();
      break;
    case 'darkTalismans': // 어둠 부적 25×5 자동 추적
      b.vx=0;
      if(a.step<5 && a.t>0.4+a.step*0.28){
        const ang = -Math.PI/2 + (a.step-2)*0.4;
        spawnProj({x:bc.x, y:bc.y-30, vx:Math.cos(ang)*160, vy:Math.sin(ang)*160, r:7, dmg:25, owner:'enemy', col:'#4B0082', ttl:3.5, homing:130});
        a.step++; Audio2.sfx('cast');
      }
      if(a.step>=5 && a.t>2.4) done();
      break;
    case 'hanWave': // 한의 파장 40 광역
      b.vx=0;
      if(a.t>1.0 && !a.hitDone){
        a.hitDone=true; addShake(10,0.3); Audio2.sfx('phase');
        if(dist({x:pc.x,y:pc.y},{x:bc.x,y:bc.y})<230) damagePlayer(40, b);
        spawnParticles(bc.x,bc.y,'#4B0082',26,240,0.8);
      }
      if(a.t>1.7) done();
      break;
    case 'mirrorDokkaebi': // 도깨비 미러 50 강타
      b.face=dx>0?1:-1; b.vx=b.face*260;
      if(Math.abs(dx)<110 && !a.hitDone && a.t>0.3){
        a.hitDone=true; b.vx=0;
        setTimeout(()=>{ if(G.state==='run'&&!b.dead && Math.abs(G.player.x+10-(b.x+b.w/2))<120) damagePlayer(50,b); addShake(9,0.2); }, 300);
      }
      if(a.t>1.3){ b.vx=0; done(); }
      break;
    case 'mirrorGumiho': // 구미호 미러 30×4
      if(a.step<4 && a.t>0.3+a.step*0.35){
        a.step++;
        b.x = clamp(pc.x + (a.step%2?-90:90), 10, G.chamber.w-b.w-10);
        spawnParticles(b.x+b.w/2,b.y+b.h/2,'#FF7BAC',10,130,0.4);
        const box={x:b.x-30,y:b.y,w:b.w+60,h:b.h};
        setTimeout(()=>{ if(G.state==='run'&&!b.dead&&rectHit(box,G.player)) damagePlayer(30,b); }, 200);
      }
      if(a.step>=4 && a.t>2.2) done();
      break;
    case 'fanSpread': // 부채 전개 60
      b.vx=0;
      if(a.t>0.8 && !a.hitDone){
        a.hitDone=true;
        for(let i=0;i<7;i++){
          const ang = Math.PI*(i/6);
          spawnProj({x:bc.x, y:bc.y, vx:Math.cos(ang)*(dx>0?1:-1)*240, vy:-Math.sin(ang)*240, r:8, dmg:20, owner:'enemy', col:'#E63946', ttl:3});
        }
        Audio2.sfx('heavy');
      }
      if(a.t>1.6) done();
      break;
    case 'hanExplosion': // 한의 폭발 80 화면 전체
      b.vx=0;
      if(a.t>0.5 && a.t<1.8) { if(Math.floor(a.t*10)%2===0) spawnParticles(rand(0,G.chamber.w), rand(100,G.chamber.h-40), '#4B0082', 1, 50, 0.4); }
      if(a.t>1.8 && !a.hitDone){
        a.hitDone=true; addShake(16,0.5); Audio2.sfx('boss');
        // 회피 방법: 대시 무적 또는 공중 높이
        if(G.player.iframe<=0 && G.player.dashT<=0) damagePlayer(80, b);
      }
      if(a.t>2.6) done();
      break;
    case 'mirrorAll': // 분신 6 (각 신령)
      b.vx=0;
      if(a.step<6 && a.t>0.3+a.step*0.3){
        const ang = Math.PI*2*a.step/6;
        spawnProj({x:bc.x+Math.cos(ang)*60, y:bc.y+Math.sin(ang)*40, vx:Math.cos(ang)*200, vy:Math.sin(ang)*200-60,
          r:10, dmg:22, owner:'enemy', col:pick(['#E63946','#FF7BAC','#4A7BC9','#6E5F80','#D4A574']), ttl:3, homing:70});
        a.step++;
      }
      if(a.step>=6 && a.t>2.5) done();
      break;
    case 'jinmyeongCall': // 진명 부름 50 (강제 빙의 해제)
      b.vx=0;
      if(a.t>0.9 && !a.hitDone){
        a.hitDone=true;
        if(G.player.form!=='bari'){
          setForm('bari');
          damagePlayer(50, b);
          spawnDmgText(G.player.x+10, G.player.y-24, '강제 빙의 해제!', '#4B0082', true);
        } else {
          damagePlayer(25, b);
        }
        addShake(8,0.2);
      }
      if(a.t>1.6) done();
      break;
    default: done();
  }
  // 유도 투사체
  for(const pr of projectiles){
    if(pr.homing && pr.owner==='enemy'){
      const a2 = Math.atan2(pc.y-pr.y, pc.x-pr.x);
      const cur = Math.atan2(pr.vy, pr.vx);
      const spd = Math.hypot(pr.vx, pr.vy);
      let diff = a2-cur;
      while(diff>Math.PI) diff-=Math.PI*2; while(diff<-Math.PI) diff+=Math.PI*2;
      const na = cur + clamp(diff, -pr.homing*dt*0.02, pr.homing*dt*0.02);
      pr.vx = Math.cos(na)*spd; pr.vy = Math.sin(na)*spd;
    }
  }
}

// ---------- 장판 (zones) ----------
function updateZones(dt){
  const ch = G.chamber, p = G.player;
  for(const z of ch.zones){
    if(z.warn!==undefined && z.warn>0){ z.warn-=dt; continue; }
    z.t -= dt;
    z.tick = (z.tick||0)-dt;
    if(rectHit(z,p)){
      if(z.once){ if(!z.hitDone){ z.hitDone=true; damagePlayer(z.dmg, z); } }
      else if(z.tick<=0){ z.tick=0.5; damagePlayer(z.dmg, z); }
    }
  }
  ch.zones = ch.zones.filter(z=>z.t>0);
}

// ============ 그리기 ============
function drawFigure(o, x, y, w, h, cols, face, opts){
  opts = opts||{};
  const dark=cols[0], mid=cols[1], light=cols[2];
  const bob = opts.bob||0;
  y += bob;
  // 몸 (도포/저고리)
  ctx.fillStyle = mid;
  ctx.fillRect(x+w*0.15, y+h*0.35, w*0.7, h*0.65);
  ctx.fillStyle = dark;
  ctx.fillRect(x+w*0.15, y+h*0.7, w*0.7, h*0.3);
  // 머리
  ctx.fillStyle = opts.headCol||'#1A1613';
  ctx.fillRect(x+w*0.25, y, w*0.5, h*0.38);
  // 얼굴
  ctx.fillStyle = opts.faceCol||'#E8DED0';
  const fx = face>0 ? x+w*0.38 : x+w*0.25;
  ctx.fillRect(fx, y+h*0.08, w*0.37, h*0.22);
  // 눈
  ctx.fillStyle = opts.eyeCol||'#1A1613';
  const ex = face>0 ? x+w*0.58 : x+w*0.3;
  ctx.fillRect(ex, y+h*0.14, 3, 3);
  // 포인트 (댕기/장식)
  if(opts.accent){
    ctx.fillStyle = opts.accent;
    ctx.fillRect(x+w*0.2, y+h*0.33, w*0.6, 3);
  }
  if(opts.glow){
    ctx.globalAlpha = 0.25+0.1*Math.sin(Date.now()/200);
    ctx.fillStyle = opts.glow;
    ctx.fillRect(x-3, y-3, w+6, h+6);
    ctx.globalAlpha = 1;
  }
}

function drawPlayer(o){
  const p = G.player;
  if(p.hitFlash>0 && Math.floor(p.hitFlash*20)%2===0) return; // 점멸
  const x = p.x-o.x-4, y = p.y-o.y-6;
  const bob = p.onGround? Math.sin(Date.now()/180)*1.2 : 0;
  if(p.iframe>0 && p.dashT<=0) ctx.globalAlpha = 0.55;
  if(p.form==='bari'){
    drawFigure(o, x, y, 28, 42, ['#1A3560','#A5304F','#E63946'], p.face,
      {bob, accent:'#E63946', headCol:'#1A1613', glow:G.run&&G.run.mythic?'#FFF8DC':null});
    // 부채
    ctx.fillStyle = '#E63946';
    ctx.fillRect(p.face>0? x+24: x-2, y+22, 6, 4);
  } else {
    const s = SPIRITS[p.form];
    drawFigure(o, x, y-2, 28, 44, s.col, p.face,
      {bob, accent:s.col[2], headCol:s.col[0], faceCol:s.col[1], eyeCol:'#F5EBD6',
       glow: G.save.affinity[p.form]>=100 ? PAL.sp.jinmyeong : null});
  }
  ctx.globalAlpha = 1;
  // 공격 이펙트
  if(p.atk && p.atk.phase==='active' && !p.atk.move.projectile){
    const box = attackBox(p.atk.move);
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = p.atk.move.isHeavy ? '#F5C56D' : '#F5EBD6';
    ctx.beginPath();
    const cx2 = p.face>0? box.x : box.x+box.w;
    ctx.moveTo(cx2, box.y+box.h/2);
    ctx.arc(cx2, box.y+box.h/2, box.w, p.face>0?-1.1:Math.PI-1.1, p.face>0?1.1:Math.PI+1.1);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  // 차지 표시
  if(p.chargeT>=0){
    const need = (G.run.mythic&&p.form==='bari')?0.1:0.4;
    const r = clamp(p.chargeT/need,0,1);
    bar(x, y-8, 28, 4, r, r>=1?'#F5C56D':'#B6ACB6');
  }
  // 분신
  if(p.buffs.bunshinT>0){
    for(let i=0;i<3;i++){
      const a2 = (p.bunshinA||0) + i*Math.PI*2/3;
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#FF7BAC';
      ctx.fillRect(p.x+10+Math.cos(a2)*36-o.x-5, p.y+16+Math.sin(a2)*24-o.y-8, 10, 16);
      ctx.globalAlpha = 1;
    }
  }
  if(p.buffs.cheolgap>0){
    ctx.globalAlpha=0.3; ctx.strokeStyle='#D4A574'; ctx.lineWidth=3;
    ctx.strokeRect(x-3,y-3,34,48); ctx.globalAlpha=1;
  }
}

function drawEnemy(o, e){
  if(e.dead || e.buried) return;
  const x = e.x-o.x-2, y = e.y-o.y-2;
  const flash = e.hitFlash>0;
  e.hitFlash = (e.hitFlash||0)-1/60;
  let cols;
  const st = STAGES[G.run.stageIdx];
  switch(e.kind){
    case 'gaekgwi': cols=['#2A2438','#6B5C6E','#B6ACB6']; break;
    case 'mongdal': cols=['#1F1930','#3F3550','#6E5F80']; break;
    case 'baekja': cols=['#3F3550','#B6ACB6','#E8DED0']; break;
    default: cols=['#E8DED0','#F5EBD6','#FFFFFF'];
  }
  if(e.elite==='han') cols = ['#1A1613','#4B0082','#8B5FBF'];
  if(e.elite==='fire') cols = ['#6B1F2E','#A5304F','#E63946'];
  const w = e.w+4, h = e.h+4;
  if(flash){ ctx.fillStyle='#FFFFFF'; ctx.fillRect(x-1,y-1,w+2,h+2); }
  if(e.kind==='dalgyal'){
    // 달걀귀신: 얼굴 없는 흰 타원
    ctx.fillStyle = flash?'#FFF':cols[1];
    ctx.beginPath(); ctx.ellipse(x+w/2, y+h/2, w/2, h/2+2, 0, 0, Math.PI*2); ctx.fill();
  } else {
    drawFigure(o, x+o.x-o.x, y, w, h, cols, e.face, {
      faceCol: e.kind==='dalgyal'?cols[1]:'#0F0D14',
      eyeCol: e.elite?'#E63946':'#A5304F',
      headCol: cols[0],
      glow: e.miniboss ? '#A5304F' : (e.elite==='han'?'#4B0082': e.elite==='fire'?'#E63946':null)
    });
  }
  // 캐스팅 게이지
  if(e.kind==='mongdal' && e.castT>0.4){
    bar(x, y-6, w, 3, e.castT/1.5, '#A5304F');
  }
  // HP 바
  if(e.hp<e.maxhp){
    bar(x, y-3, w, 2, e.hp/e.maxhp, e.miniboss?'#E63946':'#7BC97B');
  }
  if(e.burn>0){ ctx.fillStyle='#E63946'; ctx.fillRect(x+rand(0,w-3), y+rand(0,h-3), 3,3); }
  if(e.miniboss){ text(e.name, x+w/2, y-10, '#E63946', 10, 'center', true); }
}

function drawBoss(o){
  const b = G.boss;
  if(!b) return;
  const x = b.x-o.x, y = b.y-o.y;
  let cols, glow;
  switch(b.id){
    case 'geosan': cols=['#1F1930','#3F3550','#6E5F80']; glow='#6E5F80'; break;
    case 'musa': cols=['#3B2A1F','#6B4A2E','#A17B4E']; glow='#A17B4E'; break;
    case 'mubok': cols=['#2A2438','#6B5C6E','#A5304F']; glow='#A5304F'; break;
    case 'haegwi': cols=['#1A3560','#2B4F8B','#41EAD4']; glow='#41EAD4'; break;
    case 'pyedo': cols=['#1A1613','#5C5C5C','#FF206E']; glow='#FF206E'; break;
    case 'shadow': cols=['#0F0D14','#1F1930','#4B0082']; glow='#4B0082'; break;
  }
  if(b.hitFlash>0){ ctx.fillStyle='#FFF'; ctx.fillRect(x-2,y-2,b.w+4,b.h+4); }
  drawFigure(o, x, y, b.w, b.h, cols, b.face, {
    glow, eyeCol:'#E63946',
    faceCol: b.id==='shadow' ? '#E8DED0' : cols[0],
    headCol: cols[0],
    accent: glow
  });
  if(b.id==='shadow'){
    // 바리와 같은 얼굴 — 붉은 눈
    ctx.fillStyle='#E63946';
    const ex = b.face>0 ? x+b.w*0.56 : x+b.w*0.32;
    ctx.fillRect(ex, y+b.h*0.13, 5, 5);
  }
  if(b.act && b.act.name==='vulnerable'){
    text('빈틈!', x+b.w/2, y-14, '#F5C56D', 13, 'center', true);
  }
}

function drawProjectiles(o){
  for(const pr of projectiles){
    ctx.fillStyle = pr.col||'#F5EBD6';
    ctx.beginPath(); ctx.arc(pr.x-o.x, pr.y-o.y, pr.r, 0, Math.PI*2); ctx.fill();
    ctx.globalAlpha = 0.35;
    ctx.beginPath(); ctx.arc(pr.x-o.x-pr.vx*0.02, pr.y-o.y-pr.vy*0.02, pr.r*0.7, 0, Math.PI*2); ctx.fill();
    ctx.globalAlpha = 1;
  }
}
function drawZones(o){
  for(const z of G.chamber.zones){
    if(z.warn!==undefined && z.warn>0){
      ctx.globalAlpha = 0.25+0.15*Math.sin(Date.now()/60);
      ctx.fillStyle = z.col;
      ctx.fillRect(z.x-o.x, z.y-o.y, z.w, z.h);
      ctx.globalAlpha = 1;
    } else {
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = z.col;
      ctx.fillRect(z.x-o.x, z.y-o.y, z.w, z.h);
      ctx.globalAlpha = 1;
    }
  }
}
