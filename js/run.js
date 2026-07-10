'use strict';
// ============ 런 진행: 챔버 · 문 분기 · 보상 · 상점 · 이벤트 · 결산 ============

// ---------- 런 시작 ----------
function newRun(heat){
  const s = G.save;
  s.runs++; storeSave();
  G.run = {
    heat: heat||0,
    stageIdx:0, chamberIdx:0,
    kills:0, eliteKills:0, miniKills:0, bossKills:0,
    sinryeok:0, honok:0, mupae:0,
    itemsGained:[], spiritUse:{},
    startTime:Date.now(),
    plan:null, doorReward:'부적',
    mythic:false, finalResolved:false, storyNew:[]
  };
  // 신화 무기 (16.7): 신령 전원 호감도 75+ · 통합 엔딩 · 무패 200
  const affOK = SPIRIT_IDS.every(id=>s.affinity[id]>=75);
  if(affOK && s.endings.union && s.무패>=200){ G.run.mythic = true; s.mythicOwned = true; }

  const p = makePlayer();
  G.player = p;
  p.hp = maxHP(); p.sp = maxSP();
  // 사당: 추가 부적 (시작 부적)
  for(let i=0;i<s.upgrades.tal;i++) grantTalisman(randomTalisman(0), true);
  p.jade = 0;

  buildStagePlan();
  G.boss = null;
  projectiles = []; particles = []; dmgTexts = [];
  startChamber();
}

// 7.2 챔버 타입 분포: 전투4 / 엘리트(미니보스)1 / 보상1 / 상점1 + 보스
function buildStagePlan(){
  const st = STAGES[G.run.stageIdx];
  let types;
  if(st.id==='seoul'){
    types = ['combat','combat','elite','combat','shop'];
  } else {
    types = ['combat','combat','reward','elite','combat','shop','combat'];
    // 첫 스테이지 첫 챔버는 전투 고정, 나머지 섞기
    const rest = types.slice(1);
    for(let i=rest.length-1;i>0;i--){ const j=randi(0,i); [rest[i],rest[j]]=[rest[j],rest[i]]; }
    types = [types[0]].concat(rest);
  }
  G.run.plan = types;
}

// ---------- 챔버 생성 ----------
function startChamber(){
  const r = G.run, st = STAGES[r.stageIdx];
  const isBoss = r.chamberIdx >= r.plan.length;
  let size;
  if(isBoss) size = BIG_BOSSES.includes(st.boss) ? CHAMBER_SIZE.bossBig : CHAMBER_SIZE.boss;
  else size = CHAMBER_SIZE.normal;

  const type = isBoss ? 'boss' : r.plan[r.chamberIdx];
  const ch = {
    w:size[0], h:size[1], type, plats:[], enemies:[], doors:[], zones:[],
    cleared:false, rewardGiven:false, event:null, npc:null, chest:null, pedestals:null
  };
  G.chamber = ch;
  const p = G.player;
  p.x = 60; p.y = ch.h-32-p.h-2; p.vx=0; p.vy=0; p.face=1;
  cam.x = 0; cam.y = 0;
  projectiles = [];
  // 황룡의 강림: 챔버당 무료 빙의
  if(eff('freeposs')>0) p.buffs.freepossT = eff('freeposs');

  // 플랫폼 배치
  const n = isBoss? 2 : randi(2,4);
  for(let i=0;i<n;i++){
    const pw = randi(6,12)*16;
    ch.plats.push({ x: 80+i*(ch.w-160)/n + rand(0,60), y: ch.h-32-randi(5,10)*16, w: pw, h: 8 });
  }

  if(type==='boss'){
    G.boss = makeBoss();
    G.overlay = null;
    Audio2.bgm(5); // 보스: 긴박한 템포
    return;
  }
  G.boss = null;
  Audio2.bgm(r.stageIdx);

  // 적 배치
  const kinds = Object.keys(ENEMIES);
  if(type==='combat'){
    const cnt = randi(3,5); // 잡귀 3~5
    for(let i=0;i<cnt;i++){
      let kind = pick(kinds);
      const ex = rand(ch.w*0.35, ch.w-60);
      if(kind==='dalgyal'){ // 3스웜
        for(let sIdx=0;sIdx<ENEMIES.dalgyal.swarm;sIdx++) spawnEnemy('dalgyal', ex+sIdx*22, 100, {});
      } else {
        // 8.3 엘리트 5%씩
        let elite = null;
        if(chance(0.05)) elite='han'; else if(chance(0.05)) elite='fire';
        spawnEnemy(kind, ex, 100, {elite});
      }
    }
    // 4.6 일상 이벤트 10%
    if(chance(0.10)) ch.event = makeEvent();
  }
  else if(type==='elite'){
    // 미니보스 + 일반 2 (7.2/7.3)
    spawnEnemy(pick(['gaekgwi','baekja']), ch.w-140, 60, {miniboss:true});
    spawnEnemy(pick(kinds.filter(k=>k!=='dalgyal')), ch.w*0.5, 80, {elite:pick(['han','fire'])});
    spawnEnemy(pick(kinds.filter(k=>k!=='dalgyal')), ch.w*0.65, 80, {});
  }
  else if(type==='reward'){
    ch.cleared = true;
    ch.pedestals = makeRewardChoices(3, 'normal');
  }
  else if(type==='shop'){
    ch.cleared = true;
    ch.npc = {x:ch.w/2-20, y:ch.h-32-44, w:40, h:44, kind:'shop'};
    ch.shopStock = makeShopStock();
    spawnDoors();
  }
  if(ch.cleared && type==='reward'){ /* 문은 보상 선택 후 */ }
}

function makeEvent(){
  const st = G.run.stageIdx;
  let pool = MINI_EVENTS.slice(0,2);
  if(st>=3) pool = MINI_EVENTS.slice(); // 그림자의 메아리는 후반
  const ev = Object.assign({}, pick(pool));
  ev.x = rand(G.chamber.w*0.3, G.chamber.w*0.7);
  ev.y = G.chamber.h-32-40; ev.w = 32; ev.h = 40; ev.used = false;
  return ev;
}

// ---------- 보상 ----------
function rollTier(table){
  let tiers = DROP_TABLE[table];
  let r = Math.random(), acc = 0;
  let tier = 0;
  for(let i=0;i<4;i++){ acc+=tiers[i]; if(r<acc){ tier=i; break; } }
  if(G.run.heat>=4) tier = Math.max(0, tier-1); // 시련 4: 부적 등급 -1
  return tier;
}
function randomTalisman(minTier){
  const pool = TALISMANS.filter(t=>t.tier>=(minTier||0));
  return pick(pool.length?pool:TALISMANS);
}
function randomRelic(minTier){
  const owned = G.player.relics;
  let pool = RELICS.filter(r=>!owned.includes(r.id) && r.tier>=(minTier||0));
  // 시그니처는 해금 필요 (9.7)
  pool = pool.filter(r=>!r.sig || G.save.sigUnlocked[r.sig]);
  if(!pool.length) pool = RELICS.filter(r=>!owned.includes(r.id) && (!r.sig||G.save.sigUnlocked[r.sig]));
  return pool.length ? pick(pool) : null;
}

function grantTalisman(def, silent){
  const p = G.player;
  const existing = p.talismans.find(t=>t.id===def.id);
  if(existing){
    if(existing.tier<3){ existing.tier++; if(!silent) spawnDmgText(p.x+10,p.y-24,def.name+' 등급 업!',TIER_COLOR[existing.tier],true); }
    else if(!silent) spawnDmgText(p.x+10,p.y-24,'옥 +50','#7BC97B'), p.jade+=50;
  } else {
    p.talismans.push({id:def.id, tier:def.tier});
    if(!silent) spawnDmgText(p.x+10,p.y-24,'부적: '+def.name,TIER_COLOR[def.tier],true);
  }
  G.run.itemsGained.push(def.name);
  if(!silent) Audio2.sfx('pickup');
}
function grantRelic(def){
  if(!def) return;
  G.player.relics.push(def.id);
  G.run.itemsGained.push(def.name);
  spawnDmgText(G.player.x+10,G.player.y-24,'신물: '+def.name,TIER_COLOR[def.tier],true);
  Audio2.sfx('pickup');
}
function grantConsumable(def){
  if(G.player.consumables.length>=3){ G.player.jade+=20; spawnDmgText(G.player.x+10,G.player.y-24,'가방 가득 (+20옥)','#7BC97B'); return; }
  G.player.consumables.push(def.id);
  G.run.itemsGained.push(def.name);
  spawnDmgText(G.player.x+10,G.player.y-24,def.name,TIER_COLOR[def.tier],true);
  Audio2.sfx('pickup');
}
function grantSpirit(){
  const p = G.player;
  const have = p.slots.filter(Boolean);
  const pool = SPIRIT_IDS.filter(id=>!have.includes(id));
  if(!pool.length) return false;
  const id = pick(pool);
  if(!p.slots[0]) p.slots[0]=id; else if(!p.slots[1]) p.slots[1]=id;
  else return false;
  spawnDmgText(p.x+10,p.y-30,'신령 획득: '+SPIRITS[id].name+'!','#F5C56D',true);
  Audio2.sfx('swap');
  G.run.itemsGained.push(SPIRITS[id].name);
  return true;
}

// 보상 선택지 (보상 챔버 / 문 보상)
function makeRewardChoices(n, table){
  const choices = [];
  const p = G.player;
  const canSpirit = p.slots.some(s=>!s);
  for(let i=0;i<n;i++){
    const tier = rollTier(table);
    let kind;
    const r = Math.random();
    if(canSpirit && i===0 && (G.run.chamberIdx<=1 || chance(0.35))) kind='spirit';
    else if(r<0.5) kind='talisman';
    else if(r<0.7) kind='relic';
    else if(r<0.85) kind='consumable';
    else kind='jade';
    let item=null, label='', col='#E8DED0';
    if(kind==='spirit'){ label='신령 빙의'; col='#F5C56D'; }
    else if(kind==='talisman'){ item=randomTalisman(Math.min(tier,3)); if(item.tier<tier)item=Object.assign({},item,{tier:Math.min(tier,3)}); label='부적: '+item.name; col=TIER_COLOR[item.tier]; }
    else if(kind==='relic'){ item=randomRelic(0); if(!item){kind='jade';} else {label='신물: '+item.name; col=TIER_COLOR[item.tier];} }
    else if(kind==='consumable'){ item=pick(CONSUMABLES); label=item.name; col=TIER_COLOR[item.tier]; }
    if(kind==='jade'){ item={jade:randi(40,90)}; label='옥 +'+item.jade; col='#7BC97B'; }
    choices.push({kind, item, label, col, x:G.chamber.w/2+(i-(n-1)/2)*140-30, y:G.chamber.h-32-52, w:60, h:52});
  }
  return choices;
}
function applyReward(c){
  if(c.kind==='spirit'){ if(!grantSpirit()){ G.player.jade+=60; } }
  else if(c.kind==='talisman') grantTalisman(TALISMANS.find(t=>t.id===c.item.id) === c.item ? c.item : c.item);
  else if(c.kind==='relic') grantRelic(c.item);
  else if(c.kind==='consumable') grantConsumable(c.item);
  else if(c.kind==='jade'){ G.player.jade += c.item.jade; Audio2.sfx('coin'); }
}

// ---------- 챔버 클리어 & 문 ----------
function checkClear(dt){
  const ch = G.chamber;
  if(ch.cleared || ch.type==='boss') return;
  if(ch.enemies.every(e=>e.dead)){
    ch.cleared = true;
    Audio2.sfx('clear');
    // 9.1: 챔버 옥 5~10, 신력 +5 / 현무 재생의 비
    const jade = randi(5,10);
    G.player.jade += jade;
    G.run.sinryeok += 5;
    if(eff('clearheal')>0) G.player.hp = Math.min(maxHP(), G.player.hp+eff('clearheal'));
    spawnDmgText(G.player.x+10, G.player.y-20, '챔버 클리어! +'+jade+'옥', '#F5C56D', true);
    // 문 보상 (이전 문 선택)
    dropChest();
    spawnDoors();
  }
}
function dropChest(){
  const ch = G.chamber;
  const table = ch.type==='elite' ? 'miniboss' : (ch.enemiesHadElite?'elite':'normal');
  const tier = rollTier(table);
  ch.chest = { x:ch.w/2-16, y:ch.h-32-30, w:32, h:30, opened:false, tier,
    rewardType: G.run.doorReward||'부적' };
}
function openChest(chest){
  chest.opened = true;
  const tier = chest.tier;
  switch(chest.rewardType){
    case '부적': { let t = randomTalisman(0); t = Object.assign({},t,{tier:Math.max(t.tier,Math.min(tier,3))}); grantTalisman(t); break; }
    case '신물': { const r2 = randomRelic(0); if(r2) grantRelic(r2); else { G.player.jade+=80; Audio2.sfx('coin'); } break; }
    case '옥': G.player.jade += 50+tier*40; spawnDmgText(G.player.x+10,G.player.y-20,'+'+(50+tier*40)+'옥','#7BC97B',true); Audio2.sfx('coin'); break;
    case 'HP': G.player.hp = Math.min(maxHP(), G.player.hp+30); spawnDmgText(G.player.x+10,G.player.y-20,'HP +30','#7BC97B',true); break;
    case '신력': G.run.sinryeok += 15+tier*10; spawnDmgText(G.player.x+10,G.player.y-20,'신력 +'+(15+tier*10),'#F5C56D',true); break;
    case '신령': if(!grantSpirit()){ G.player.jade+=60; Audio2.sfx('coin'); } break;
  }
}

// 6.3 챔버 분기: 2~3 문 + 보상 미리보기
function spawnDoors(){
  const ch = G.chamber, r = G.run;
  const isLast = r.chamberIdx >= r.plan.length-1;
  const n = isLast ? 1 : randi(2,3);
  ch.doors = [];
  const rewards = ['부적','신물','옥','HP','신력'];
  if(G.player.slots.some(s=>!s)) rewards.push('신령');
  for(let i=0;i<n;i++){
    ch.doors.push({
      x: ch.w-60-i*90, y: ch.h-32-64, w:44, h:64,
      reward: isLast ? '보스' : pick(rewards)
    });
  }
}
function enterDoor(d){
  G.run.doorReward = d.reward==='보스' ? '부적' : d.reward;
  G.run.chamberIdx++;
  startChamber();
}

// ---------- 상점 (9.5) ----------
function makeShopStock(){
  const stock = [];
  const disc = 1-eff('discount');
  for(let i=0;i<6;i++){
    let r = Math.random(), tier = r<SHOP_TIER_ODDS[0]?0 : r<SHOP_TIER_ODDS[0]+SHOP_TIER_ODDS[1]?1:2;
    const kindR = Math.random();
    let item, cat;
    if(kindR<0.5){ cat='부적'; let t=randomTalisman(0); item=Object.assign({},t,{tier:Math.max(t.tier,tier)}); if(item.tier>2)item.tier=2; }
    else if(kindR<0.75){ cat='신물'; item=randomRelic(0); if(!item){ cat='소비품'; item=pick(CONSUMABLES);} }
    else { cat='소비품'; item=pick(CONSUMABLES); }
    const pr = SHOP_PRICE[cat][clamp(item.tier,0,2)];
    stock.push({cat, item, price:Math.round(randi(pr[0],pr[1])*disc), sold:false});
  }
  for(const ex of SHOP_EXTRA) stock.push({cat:'기타', item:ex, price:Math.round(ex.price*disc), sold:false});
  return stock;
}
function buyShopItem(s){
  const p = G.player;
  if(s.sold || p.jade<s.price){ Audio2.sfx('ui'); return; }
  p.jade -= s.price; s.sold = true;
  Audio2.sfx('buy');
  if(s.cat==='부적') grantTalisman(s.item);
  else if(s.cat==='신물') grantRelic(s.item);
  else if(s.cat==='소비품') grantConsumable(s.item);
  else {
    switch(s.item.use){
      case 'hp20': p.hp=Math.min(maxHP(),p.hp+20); break;
      case 'sp20': p.sp=Math.min(maxSP(),p.sp+20); break;
      case 'upgrade': {
        const ts = p.talismans.filter(t=>t.tier<3);
        if(ts.length){ const t=pick(ts); t.tier++; spawnDmgText(p.x+10,p.y-24,TALISMANS.find(x=>x.id===t.id).name+' 등급 업!',TIER_COLOR[t.tier],true); }
        else p.jade+=100;
        break;
      }
    }
  }
}

// ---------- 이벤트 상호작용 ----------
function useEvent(ev){
  const p = G.player;
  ev.used = true;
  switch(ev.id){
    case 'shrine':
      p.hp = Math.min(maxHP(), p.hp+20);
      spawnDmgText(p.x+10,p.y-20,'HP +20','#7BC97B',true);
      if(chance(0.3+eff('mupae')*0.2)){ G.run.mupae++; spawnDmgText(p.x+10,p.y-36,'무패 +1','#F5EBFF',true); }
      Audio2.sfx('pickup');
      break;
    case 'soul':
      if(p.jade>=40){ p.jade-=40; grantTalisman(randomTalisman(0)); }
      else spawnDmgText(p.x+10,p.y-20,'옥 부족','#6B5C6E');
      break;
    case 'echo':
      G.overlay = {type:'story', text:pick(ECHO_LINES), sub:'— 그림자의 메아리'};
      G.run.mupae++;
      break;
  }
}

// ---------- 보스 처치 & 스테이지 전환 ----------
function onBossDefeated(){
  const r = G.run, s = G.save, st = STAGES[r.stageIdx];
  r.bossKills++;
  // 8.4 보상: 신력 50~200, 혼옥 2~5, 부적 (에픽+)
  r.sinryeok += randi(50,200);
  r.honok += randi(2,5);
  r.mupae += 1 + eff('mupae');
  const firstClear = r.stageIdx+1 > s.bestStage;
  if(firstClear){ s.bestStage = r.stageIdx+1; r.honok += 5; }
  s.talkTokens = (s.talkTokens||0)+1;
  // 보스전 빙의 호감도
  if(G.player.form!=='bari') addAffinity(G.player.form, 5);
  // 스토리
  const story = STAGE_STORY[st.id];
  if(story.truth && !s.storyLog.includes(story.truth)){ s.storyLog.push(story.truth); r.storyNew.push(story.truth); r.mupae++; }
  storeSave();

  if(st.id==='seoul'){
    // 엔딩 (봉인: 공격으로 처치)
    finishRun('seal');
    return;
  }
  // 스테이지 클리어 연출 → 다음 스테이지
  G.overlay = { type:'stageClear', line:story.line, truth:story.truth, boss:st.bossName, t:0,
    tier: rollTier('boss') };
}
function nextStage(){
  const r = G.run;
  // 보스 부적 보상 (에픽+)
  let t = randomTalisman(0);
  t = Object.assign({},t,{tier:Math.max(t.tier,2)});
  grantTalisman(t);
  r.stageIdx++;
  r.chamberIdx = 0;
  buildStagePlan();
  // 서울 진입 시네마틱 (4.3)
  if(STAGES[r.stageIdx].id==='seoul'){
    startCinema(SEOUL_CINEMA.concat([{h:'', t:'할미: "잘 듣게. '+STAGE_STORY.seoul.truth.replace('할미: ','').replace(/"/g,'')+'"'}]), ()=>{
      addAffinity('halmi', 10);
      startChamber(); G.state='run';
    });
  } else {
    startChamber();
  }
}

// ---------- 호감도 (6.5) ----------
function addAffinity(id, amt){
  const s = G.save;
  amt = Math.round(amt*(1+eff('affx')));
  const before = s.affinity[id]||0;
  s.affinity[id] = clamp(before+amt, 0, 100);
  const th = [25,50,75,100];
  for(const t of th){
    if(before<t && s.affinity[id]>=t){
      if(id!=='halmi' && t===100) spawnDmgText(G.player?G.player.x:480, G.player?G.player.y-40:200, SPIRITS[id].name+' 진명 해방!', PAL.sp.jinmyeong, true);
    }
  }
  storeSave();
}

// ---------- 런 종료 ----------
function finishRun(endingKey){
  const r = G.run, s = G.save;
  // 최종 보스 혼옥 (9.3: 신화 조각 → 혼옥 대량)
  r.honok += 5; r.mupae += 2;
  s.clears++;
  if(endingKey) {
    s.endings[endingKey] = true;
    if(endingKey!=='fall') s.heatUnlocked = Math.min(5, (s.heatUnlocked||0)+1);
  }
  applyRunCurrency();
  const panels = ENDINGS[endingKey].panels;
  startCinema(panels, ()=>{ showResults(true, ENDINGS[endingKey].name); });
}
function runDeath(){
  const r = G.run, s = G.save;
  // 3.6 굴복: 그림자에게 3회 패배
  if(G.boss && G.boss.id==='shadow'){
    s.shadowDeaths = (s.shadowDeaths||0)+1;
    if(s.shadowDeaths>=3 && !s.endings.fall){
      applyRunCurrency();
      startCinema(ENDINGS.fall.panels, ()=>{ s.endings.fall=true; storeSave(); showResults(false, ENDINGS.fall.name); });
      return;
    }
  }
  // 전라도 스토리: 사망 후 환영 (3.5)
  if(STAGES[r.stageIdx].id==='jeolla' && !s.storyLog.includes(STAGE_STORY.jeolla.truth)){
    s.storyLog.push(STAGE_STORY.jeolla.truth);
    r.storyNew.push(STAGE_STORY.jeolla.truth);
    applyRunCurrency();
    startCinema([{h:'환영', t:'죽음의 어둠 속 —\n바리의 얼굴을 한 검은 자가\n옥새를 깨뜨리는 모습이 스쳐 지나간다.\n\n(1초의 환영)'}], ()=>showResults(false));
    return;
  }
  applyRunCurrency();
  showResults(false);
}
function applyRunCurrency(){
  const r = G.run, s = G.save;
  s.신력 += r.sinryeok; s.혼옥 += r.honok; s.무패 += r.mupae;
  // 사용 신령 호감도
  for(const id of Object.keys(r.spiritUse)){
    addAffinity(id, clamp(Math.round(r.spiritUse[id]/150), 1, 8));
  }
  storeSave();
}
function showResults(win, endingName){
  const r = G.run;
  const timeSec = Math.round((Date.now()-r.startTime)/1000);
  G.save.lastResult = {
    win, endingName: endingName||null,
    stage: STAGES[r.stageIdx].name, chamber: r.chamberIdx+1,
    time: timeSec, kills:r.kills, elites:r.eliteKills, minis:r.miniKills, bosses:r.bossKills,
    sinryeok:r.sinryeok, honok:r.honok, mupae:r.mupae,
    items:r.itemsGained.slice(0,10),
    mainSpirit: Object.keys(r.spiritUse).sort((a,b)=>r.spiritUse[b]-r.spiritUse[a])[0]||null,
    storyNew: r.storyNew
  };
  storeSave();
  Audio2.stopBgm();
  G.state = 'results';
  Input.clear();
}

// 최종 선택 (16.9: 공격 / 다가가기)
function resolveFinalChoice(approach){
  const b = G.boss, s = G.save;
  G.overlay = null;
  if(!approach){
    // 공격 → 봉인 엔딩 경로
    G.run.finalResolved = true;
    b.hp = Math.max(b.hp, 1);
    spawnDmgText(b.x+b.w/2, b.y-20, '...그래, 이것이 네 대답이구나.', '#B6ACB6', true);
    return;
  }
  // 다가가기
  const affOK = SPIRIT_IDS.every(id=>s.affinity[id]>=100);
  const halmiOK = s.affinity.halmi>=100 || s.무패>=100;
  if(affOK && halmiOK){
    G.run.finalResolved = true;
    b.dead = true;
    finishRun('union');
  } else {
    // 조건 미달: 그림자가 거부
    startCinema([{h:'거부', t:'그림자가 울부짖으며 손을 뿌리쳤다.\n\n"아직... 너는 나를 안을 그릇이 아니야!"\n\n(통합 조건: 신령 5 호감도 100 · 무패 100)'}], ()=>{
      G.state='run';
      damagePlayer(30, b);
      G.run.finalResolved = true; // 이후 공격으로 처치 가능
    });
  }
}
