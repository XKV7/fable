'use strict';
// ============ 엔진: 입력 · 오디오 · 저장 · 카메라 · 파티클 ============

const cvs = document.getElementById('game');
const ctx = cvs.getContext('2d');
const VW = 960, VH = 540;

// ---------- 유틸 ----------
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const rand = (a,b)=>a+Math.random()*(b-a);
const randi = (a,b)=>Math.floor(rand(a,b+1));
const chance = p=>Math.random()<p;
const pick = arr=>arr[Math.floor(Math.random()*arr.length)];
const lerp = (a,b,t)=>a+(b-a)*t;
const dist = (a,b)=>Math.hypot(a.x-b.x, a.y-b.y);
const rectHit = (a,b)=>a.x<b.x+b.w && a.x+a.w>b.x && a.y<b.y+b.h && a.y+a.h>b.y;

// ---------- 입력 ----------
const Input = {
  keys:{}, pressed:{},
  down(k){ return !!this.keys[k]; },
  hit(k){ if(this.pressed[k]){ this.pressed[k]=false; return true; } return false; },
  peek(k){ return !!this.pressed[k]; },
  clear(){ this.pressed={}; },
  left(){ return this.down('ArrowLeft')||this.down('KeyA')||this.touch.left; },
  right(){ return this.down('ArrowRight')||this.down('KeyD')||this.touch.right; },
  up(){ return this.down('ArrowUp')||this.down('KeyW'); },
  touch:{left:false,right:false,active:false}
};
window.addEventListener('keydown', e=>{
  if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault();
  if(!Input.keys[e.code]) Input.pressed[e.code]=true;
  Input.keys[e.code]=true;
  Audio2.unlock();
});
window.addEventListener('keyup', e=>{ Input.keys[e.code]=false; });
window.addEventListener('blur', ()=>{ Input.keys={}; });

// ---------- 오디오 (WebAudio 절차 생성 — 11장 방향 B: 하이브리드) ----------
const Audio2 = {
  ctx:null, vol:0.5, bgmVol:0.35, bgmTimer:null, bgmStep:0, bgmScale:null, muted:false,
  unlock(){
    if(!this.ctx){ try{ this.ctx = new (window.AudioContext||window.webkitAudioContext)(); }catch(e){} }
    if(this.ctx && this.ctx.state==='suspended') this.ctx.resume();
  },
  tone(f, dur, type, vol, slide){
    if(!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type||'square'; o.frequency.setValueAtTime(f, t);
    if(slide) o.frequency.exponentialRampToValueAtTime(Math.max(30,f+slide), t+dur);
    g.gain.setValueAtTime((vol||0.15)*this.vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t+dur);
    o.connect(g); g.connect(this.ctx.destination);
    o.start(t); o.stop(t+dur+0.02);
  },
  noise(dur, vol, low){
    if(!this.ctx || this.muted) return;
    const t = this.ctx.currentTime, n = this.ctx.sampleRate*dur;
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for(let i=0;i<n;i++) d[i] = (Math.random()*2-1)*(1-i/n);
    const s = this.ctx.createBufferSource(); s.buffer = buf;
    const g = this.ctx.createGain(); g.gain.value = (vol||0.12)*this.vol;
    if(low){ const f=this.ctx.createBiquadFilter(); f.type='lowpass'; f.frequency.value=400; s.connect(f); f.connect(g); }
    else s.connect(g);
    g.connect(this.ctx.destination); s.start(t);
  },
  // 11.2 사운드 트리거
  sfx(name){
    switch(name){
      case 'hit': this.tone(220,0.08,'square',0.12,-80); break;
      case 'hit2': this.tone(180,0.1,'square',0.14,-90); break;
      case 'heavy': this.tone(120,0.2,'sawtooth',0.2,-60); this.noise(0.12,0.1,true); break;
      case 'crit': this.tone(660,0.12,'square',0.15,-300); break;
      case 'dash': this.noise(0.1,0.08); break;
      case 'jump': this.tone(300,0.1,'triangle',0.1,150); break;
      case 'swap': this.tone(440,0.25,'sine',0.15,220); this.tone(330,0.25,'sine',0.1,110); break;
      case 'pickup': this.tone(523,0.08,'triangle',0.12); setTimeout(()=>this.tone(784,0.12,'triangle',0.12),70); break;
      case 'coin': this.tone(880,0.06,'square',0.08); break;
      case 'hurt': this.tone(150,0.2,'sawtooth',0.18,-70); break;
      case 'clear': [523,659,784].forEach((f,i)=>setTimeout(()=>this.tone(f,0.18,'triangle',0.12),i*90)); break;
      case 'boss': this.tone(80,0.7,'sawtooth',0.25,-30); this.noise(0.5,0.15,true); break;
      case 'phase': this.tone(100,0.5,'sawtooth',0.2,60); break;
      case 'ui': this.tone(600,0.05,'square',0.06); break;
      case 'buy': this.tone(700,0.07,'triangle',0.1); setTimeout(()=>this.tone(1050,0.1,'triangle',0.1),60); break;
      case 'death': [300,250,200,150].forEach((f,i)=>setTimeout(()=>this.tone(f,0.25,'sawtooth',0.15),i*140)); break;
      case 'throw': this.tone(500,0.1,'triangle',0.1,-200); break;
      case 'cast': this.tone(700,0.15,'sine',0.08,-300); break;
      case 'stun': this.tone(1200,0.2,'sine',0.1,-600); break;
    }
  },
  // 스테이지 BGM: 국악 5음계 (황종 평조) 아르페지오 + 드론
  bgm(stageIdx){
    this.stopBgm();
    if(stageIdx===undefined || stageIdx===null) return;
    const scales = [
      [220,262,294,330,392], [196,220,262,294,330], [220,247,294,330,370],
      [175,196,220,262,294], [165,196,220,247,294], [147,175,196,220,262]
    ];
    this.bgmScale = scales[clamp(stageIdx,0,5)];
    this.bgmStep = 0;
    const beat = stageIdx===5 ? 260 : 380;
    this.bgmTimer = setInterval(()=>{
      if(!this.ctx || this.muted) return;
      const sc = this.bgmScale, s = this.bgmStep++;
      if(s%8===0) this.tone(sc[0]/2, 0.9, 'sine', 0.05*this.bgmVol*2);
      if(s%2===0){
        const n = sc[[0,2,1,3,0,4,2,1][Math.floor(s/2)%8]];
        this.tone(n, 0.3, 'triangle', 0.06*this.bgmVol*2, 0);
      }
      if(s%16===8) this.noise(0.05,0.03);
    }, beat);
  },
  stopBgm(){ if(this.bgmTimer){ clearInterval(this.bgmTimer); this.bgmTimer=null; } }
};

// ---------- 저장 (13.4 user://save.json → localStorage) ----------
const SAVE_KEY = 'baekgwihaeng_save_v1';
function defaultSave(){
  return {
    신력:0, 혼옥:0, 무패:0,
    upgrades:{hp:0,sp:0,spd:0,tal:0,bell:0},
    affinity:{dokkaebi:0,gumiho:0,imugi:0,jeoseung:0,bulgasari:0,halmi:0},
    sigUnlocked:{},          // 시그니처 신물 해금 (혼옥 100)
    talkTokens:0,            // 신령 대화권 (스테이지 클리어당 +1)
    endings:{seal:false,union:false,fall:false},
    storyLog:[], mythicOwned:false,
    shadowDeaths:0, clears:0, runs:0, bestStage:0,
    heatUnlocked:0, lastResult:null, seenOpening:false,
    settings:{vol:0.5}
  };
}
function loadSave(){
  try{
    const raw = localStorage.getItem(SAVE_KEY);
    if(raw){ const s = JSON.parse(raw); return Object.assign(defaultSave(), s); }
  }catch(e){}
  return defaultSave();
}
function storeSave(){ try{ localStorage.setItem(SAVE_KEY, JSON.stringify(G.save)); }catch(e){} }

// ---------- 카메라 (16.8) ----------
const cam = { x:0, y:0, shakeI:0, shakeT:0, look:0 };
function addShake(i,d){ cam.shakeI=Math.max(cam.shakeI,i); cam.shakeT=Math.max(cam.shakeT,d); }
let hitstopT = 0;
function hitstop(t){ hitstopT = Math.max(hitstopT, t); }
function updateCamera(dt){
  const ch = G.chamber; if(!ch) return;
  const p = G.player;
  cam.look = lerp(cam.look, p.face*60, dt*4); // lookahead 60px
  let tx = p.x + p.w/2 + cam.look - VW/2;
  let ty = p.y + p.h/2 - VH/2 - 20;
  cam.x = lerp(cam.x, tx, 1-Math.pow(0.001,dt));
  cam.y = lerp(cam.y, ty, 1-Math.pow(0.001,dt));
  if(ch.w>=VW) cam.x = clamp(cam.x, 0, ch.w-VW);
  else cam.x = -(VW-ch.w)/2;
  if(ch.h<=VH) cam.y = -(VH-ch.h)/2; else cam.y = clamp(cam.y, 0, ch.h-VH);
  if(cam.shakeT>0) cam.shakeT-=dt;
}
function camOff(){
  let sx=0, sy=0;
  if(cam.shakeT>0){ sx=rand(-cam.shakeI,cam.shakeI); sy=rand(-cam.shakeI,cam.shakeI); }
  return {x:Math.round(cam.x+sx), y:Math.round(cam.y+sy)};
}

// ---------- 파티클 · 데미지 텍스트 ----------
let particles = [], dmgTexts = [];
function spawnParticles(x,y,col,n,spd,life){
  for(let i=0;i<(n||6);i++){
    const a = rand(0,Math.PI*2), s = rand(0.3,1)*(spd||120);
    particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-40,col,t:rand(0.5,1)*(life||0.4),g:300});
  }
}
function spawnDmgText(x,y,txt,col,big){
  dmgTexts.push({x:x+rand(-6,6),y,txt:String(txt),col:col||'#F5EBD6',t:0.7,big:!!big});
}
function updateFx(dt){
  for(const p of particles){ p.t-=dt; p.x+=p.vx*dt; p.y+=p.vy*dt; p.vy+=p.g*dt; }
  particles = particles.filter(p=>p.t>0);
  for(const d of dmgTexts){ d.t-=dt; d.y-=40*dt; }
  dmgTexts = dmgTexts.filter(d=>d.t>0);
}
function drawFx(o){
  for(const p of particles){
    ctx.globalAlpha = clamp(p.t*2,0,1);
    ctx.fillStyle = p.col;
    ctx.fillRect(p.x-o.x-2, p.y-o.y-2, 4, 4);
  }
  ctx.globalAlpha = 1;
  for(const d of dmgTexts){
    ctx.globalAlpha = clamp(d.t*2,0,1);
    ctx.font = (d.big?'bold 18px':'bold 13px')+' "Malgun Gothic",sans-serif';
    ctx.fillStyle = d.col; ctx.textAlign='center';
    ctx.fillText(d.txt, d.x-o.x, d.y-o.y);
  }
  ctx.globalAlpha = 1; ctx.textAlign='left';
}

// ---------- 텍스트 헬퍼 ----------
function fontPx(px,bold){ ctx.font = (bold?'bold ':'')+px+'px "Malgun Gothic","Apple SD Gothic Neo",sans-serif'; }
function text(t,x,y,col,px,align,bold){
  fontPx(px||14,bold); ctx.fillStyle = col||'#E8DED0';
  ctx.textAlign = align||'left'; ctx.fillText(t,x,y); ctx.textAlign='left';
}
function textLines(t,x,y,col,px,align,lh){
  const lines = String(t).split('\n');
  lines.forEach((l,i)=>text(l,x,y+i*(lh||(px||14)*1.5),col,px,align));
  return lines.length;
}
function panel(x,y,w,h,alpha){
  ctx.fillStyle = 'rgba(15,13,20,'+(alpha===undefined?0.88:alpha)+')';
  ctx.fillRect(x,y,w,h);
  ctx.strokeStyle = '#6B5C6E'; ctx.lineWidth=2; ctx.strokeRect(x+0.5,y+0.5,w-1,h-1);
  ctx.strokeStyle = '#3F3550'; ctx.lineWidth=1; ctx.strokeRect(x+3.5,y+3.5,w-7,h-7);
}
function bar(x,y,w,h,ratio,fg,bg){
  ctx.fillStyle = bg||'#1F1930'; ctx.fillRect(x,y,w,h);
  ctx.fillStyle = fg; ctx.fillRect(x,y,Math.max(0,w*clamp(ratio,0,1)),h);
  ctx.strokeStyle='#0F0D14'; ctx.lineWidth=1; ctx.strokeRect(x+0.5,y+0.5,w-1,h-1);
}
