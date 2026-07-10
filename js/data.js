'use strict';
// ============ 백귀행 (百鬼行) — 마스터 데이터 (요구명세서 v1.0 기반) ============

// 12.2 마스터 팔레트 (34색)
const PAL = {
  bg: { simyeon:'#0F0D14', darkPurple:'#1F1930', yaeum:'#2A2438', fogGray:'#3F3550',
        jukGray:'#6B5C6E', fogWhite:'#B6ACB6', bone:'#E8DED0', hi:'#F5EBD6',
        darkBrown:'#3B2A1F', dirtBrown:'#6B4A2E', dryWood:'#A17B4E', moss:'#4A6B47' },
  청룡: ['#1A3560','#2B4F8B','#4A7BC9'],
  백호: ['#8B8987','#D0CFCB','#FFFFFF'],
  주작: ['#6B1F2E','#A5304F','#E63946'],
  현무: ['#1A1613','#3F3550','#6E5F80'],
  황룡: ['#8B6B2A','#D4A574','#F5C56D'],
  seoul: { pink:'#FF206E', blue:'#41EAD4', amber:'#FFA630', concrete:'#5C5C5C' },
  sp: { rainbow:'#F5EBFF', shadow:'#4B0082', jinmyeong:'#FFF8DC' }
};

const TIERS = ['일반','레어','에픽','전설','신화'];
const TIER_COLOR = ['#B6ACB6','#4A7BC9','#A5304F','#F5C56D','#F5EBFF'];
const TIER_MULT = [1, 1.5, 2.0, 3.0, 3.0]; // 9.4 등급 업그레이드 배율

// ---- 16.1 플레이어 베이스 스탯 ----
const BASE = {
  hp:100, sp:100, speed:200, jump:380, jump2:320, grav:980,
  dashDist:150, dashTime:0.18, dashIFrame:0.20, dashCD:0.80,
  hitInvuln:0.50, swapCD:1.20, spRegen:8, spDrain:6,
  comboWindow:0.30, backAtk:1.2
};

// ---- 16.2 바리 무브셋 ----
const BARI_MOVES = {
  a1:{dmg:10, windup:0.08, active:0.10, recover:0.15, range:40},
  a2:{dmg:12, windup:0.08, active:0.10, recover:0.15, range:40},
  a3:{dmg:15, windup:0.12, active:0.20, recover:0.25, range:60},
  heavy:{dmg:25, charge:0.40, active:0.25, recover:0.30, range:80},
  talisman:{dmg:25, blast:25, windup:0.10, recover:0.30, spCost:15}
};

// ---- 5.2 / 16.3 신령 로스터 ----
const SPIRITS = {
  dokkaebi: { id:'dokkaebi', name:'도깨비 두목', jinmyeong:'쇠개비', role:'탱커·브루저',
    col:PAL.주작, hp:1.3, spd:0.85, atk:{dmg:25, range:50, rate:0.55},
    heavy:{dmg:50, wave:15, range:100}, special:{name:'광기', sp:30, desc:'5초간 공속 +30%'},
    pers:'우직·충성·식탐' },
  gumiho: { id:'gumiho', name:'구미호', jinmyeong:'휘영', role:'스피드·환영',
    col:['#6B1F2E','#A5304F','#FF7BAC'], hp:0.7, spd:1.3, atk:{dmg:[8,8,8,15], range:30, rate:0.22},
    heavy:{dmg:30, range:200}, special:{name:'분신', sp:25, desc:'분신 3개 10초'},
    pers:'신비·짖궂음·외로움' },
  imugi: { id:'imugi', name:'이무기', jinmyeong:'영천', role:'중거리·원소',
    col:PAL.청룡, hp:1.0, spd:0.95, atk:{dmg:18, range:9999, rate:0.5},
    heavy:{dmg:35, hits:3, range:250, stun:0.5}, special:{name:'용의 비', sp:35, desc:'낙뢰 5발 ×15'},
    pers:'분노·한' },
  jeoseung: { id:'jeoseung', name:'저승사자', jinmyeong:'묵야', role:'원거리·유틸',
    col:PAL.현무, hp:0.85, spd:0.95, atk:{dmg:22, range:80, rate:0.5},
    heavy:{dmg:40, range:120}, special:{name:'시간 정지', sp:50, desc:'2초간 시간 정지'},
    pers:'고요·의무' },
  bulgasari: { id:'bulgasari', name:'불가사리', jinmyeong:'철수', role:'디펜더·카운터',
    col:['#3B2A1F','#6B4A2E','#D4A574'], hp:1.5, spd:0.7, atk:{dmg:20, range:40, rate:0.6},
    heavy:{dmgMin:25, dmgMax:60, range:300}, special:{name:'철갑', sp:20, desc:'5초간 받는 피해 -50%'},
    pers:'단순·식탐' }
};
const SPIRIT_IDS = ['dokkaebi','gumiho','imugi','jeoseung','bulgasari'];
// 산신 — v1.1 예정 (5.2)

// ---- 8.1 보편 잡귀 ----
const ENEMIES = {
  gaekgwi:  { name:'객귀',    hp:30, dmg:8,  spd:120, range:30, detect:200, size:32, kind:'rush' },
  mongdal:  { name:'몽달귀',  hp:25, dmg:12, spd:60,  range:9999, detect:250, size:32, kind:'caster', castTime:1.5 },
  baekja:   { name:'백자',    hp:60, dmg:15, spd:50,  range:40, detect:180, size:48, kind:'shield', frontDR:0.3 },
  dalgyal:  { name:'달걀귀신',hp:8,  dmg:4,  spd:250, range:20, detect:150, size:24, kind:'swarm', swarm:3 }
};

// ---- 8.2 지방별 변형 ----
const REGION_VARIANTS = {
  gangwon:  { gaekgwi:{name:'산도깨비', tweak:'jump'},  mongdal:{name:'산공혼령', tweak:'rock'} },
  chungcheong:{ baekja:{name:'무사령', tweak:'combo'},  gaekgwi:{name:'군영귀', tweak:'spear'} },
  jeolla:   { mongdal:{name:'부정탄 영', tweak:'debuff'} },
  gyeongsang:{ gaekgwi:{name:'물귀신', tweak:'ambush'} },
  gyeonggi: { gaekgwi:{name:'어둠 정령', tweak:'teleport'} },
  seoul:    { gaekgwi:{name:'광장의 잡귀', tweak:'teleport'} }
};

// ---- 8.3 엘리트 변형 ----
const ELITES = {
  han:  { name:'한이 깊은', hpX:2, dmgX:1.3, sinryeok:10, col:'#4B0082' },
  fire: { name:'꼬리불을 두른', burn:true, boomDmg:30, col:'#E63946' }
};

// ---- 7.3 스테이지 & 8.4 보스 ----
const STAGES = [
  { id:'gangwon', name:'강원도', chambers:7, boss:'geosan', bossName:'거산령', bossHp:800,
    mini:'산속 우두머리 잡귀', mood:['#1F1930','#3F3550','#6E5F80'], ground:'#3F3550' },
  { id:'chungcheong', name:'충청도', chambers:7, boss:'musa', bossName:'백제 무사령', bossHp:950,
    mini:'군영귀 우두머리', mood:['#3B2A1F','#6B4A2E','#A17B4E'], ground:'#6B4A2E' },
  { id:'jeolla', name:'전라도', chambers:7, boss:'mubok', bossName:'무복귀', bossHp:1100,
    mini:'굿당의 사령', mood:['#2A2438','#6B5C6E','#A5304F'], ground:'#6B5C6E' },
  { id:'gyeongsang', name:'경상도', chambers:7, boss:'haegwi', bossName:'해귀', bossHp:1300,
    mini:'해변의 사령', mood:['#1A3560','#2B4F8B','#41EAD4'], ground:'#1A3560' },
  { id:'gyeonggi', name:'경기 외곽', chambers:7, boss:'pyedo', bossName:'폐도의 그림자', bossHp:1400,
    mini:'폐공장 그림자', mood:['#2A2438','#5C5C5C','#FF206E'], ground:'#5C5C5C' },
  { id:'seoul', name:'서울', chambers:5, boss:'shadow', bossName:'바리의 그림자', bossHp:1800,
    mini:'광장의 잡귀', mood:['#0F0D14','#4B0082','#E63946'], ground:'#2A2438' }
];

// 16.10 챔버 크기
const CHAMBER_SIZE = { normal:[800,480], boss:[1200,480], bossBig:[1500,600] };
const BIG_BOSSES = ['haegwi','shadow'];

// ---- 16.4 부적 35종 (오방신장 5계열 × 7) ----
// eff 값은 기본 등급 기준. 등급 업그레이드 시 TIER_MULT 배율 (9.4)
const TALISMANS = [
 // 청룡 (동 · 물바람 · 이동): 일반3 레어2 에픽1 전설1
 {id:'t_wind',    name:'바람의 가호',   el:'청룡', tier:0, desc:'이동속도 +10%', eff:{spd:0.10}},
 {id:'t_flash',   name:'순식간',        el:'청룡', tier:0, desc:'대시 쿨다운 -20%', eff:{dashcd:0.20}},
 {id:'t_step2',   name:'두 번째 발걸음',el:'청룡', tier:0, desc:'공중 대시 +1회', eff:{airdash:1}},
 {id:'t_dodge',   name:'회피의 보상',   el:'청룡', tier:1, desc:'대시 후 2초간 공격력 +20%', eff:{dashbuff:0.20}},
 {id:'t_airkick', name:'공기 박차기',   el:'청룡', tier:1, desc:'점프 횟수 +1', eff:{jumps:1}},
 {id:'t_ddash',   name:'이중 대시',     el:'청룡', tier:2, desc:'대시 충전 +1', eff:{dashcharge:1}},
 {id:'t_windgod', name:'바람의 신',     el:'청룡', tier:3, desc:'대시가 적에게 20 피해, 무적 +0.1초', eff:{dashdmg:20, iframe:0.10}},
 // 백호 (서 · 금속정밀 · 치명방어): 일반3 레어2 에픽1 전설1
 {id:'t_metal',   name:'금속의 갑',     el:'백호', tier:0, desc:'받는 피해 -8%', eff:{dr:0.08}},
 {id:'t_crit',    name:'치명타',        el:'백호', tier:0, desc:'치명타 확률 +10%', eff:{crit:0.10}},
 {id:'t_precise', name:'정확한 일격',   el:'백호', tier:0, desc:'콤보 3타 피해 +30%', eff:{combo3:0.30}},
 {id:'t_shield',  name:'방패의 일격',   el:'백호', tier:1, desc:'피격 무적 +0.2초', eff:{hitiframe:0.20}},
 {id:'t_tigerhit',name:'백호의 일격',   el:'백호', tier:1, desc:'치명타 배율 +50%', eff:{critdmg:0.50}},
 {id:'t_noback',  name:'불퇴의 가호',   el:'백호', tier:2, desc:'넉백 면역, 받는 피해 -5%', eff:{noknock:1, dr:0.05}},
 {id:'t_majesty', name:'백호의 위엄',   el:'백호', tier:3, desc:'치명타 확률 +25%', eff:{crit:0.25}},
 // 주작 (남 · 불격렬 · 공격화염): 일반3 레어2 에픽1 전설1
 {id:'t_fire',    name:'불의 가호',     el:'주작', tier:0, desc:'공격력 +10%', eff:{atk:0.10}},
 {id:'t_burn',    name:'화염 부착',     el:'주작', tier:0, desc:'공격 시 3초간 화상 (3/s)', eff:{burn:1}},
 {id:'t_chain',   name:'연쇄 폭발',     el:'주작', tier:0, desc:'처치 시 폭발 15 피해', eff:{kaboom:15}},
 {id:'t_rage',    name:'태우는 분노',   el:'주작', tier:1, desc:'HP 50% 이하 시 공격력 +25%', eff:{rage:0.25}},
 {id:'t_phoenix', name:'봉황의 깃털',   el:'주작', tier:1, desc:'죽음 시 1회 부활 (HP 30%)', eff:{revive:0.30}},
 {id:'t_avatar',  name:'불의 화신',     el:'주작', tier:2, desc:'화상 피해 2배', eff:{burnx:1}},
 {id:'t_jujak',   name:'주작의 강림',   el:'주작', tier:3, desc:'강공격 시 화염 폭발 +40', eff:{heavyblast:40}},
 // 현무 (북 · 흙인내 · HP회복): 일반3 레어3 전설1
 {id:'t_turtle',  name:'거북의 등',     el:'현무', tier:0, desc:'최대 HP +20', eff:{maxhp:20}},
 {id:'t_regen',   name:'재생의 비',     el:'현무', tier:0, desc:'챔버 클리어 시 HP +10', eff:{clearheal:10}},
 {id:'t_calm',    name:'부동심',        el:'현무', tier:0, desc:'한 번에 받는 피해 최대 25', eff:{dmgcap:25}},
 {id:'t_endure',  name:'인내',          el:'현무', tier:1, desc:'HP 30% 이하 시 받는 피해 -30%', eff:{lowdr:0.30}},
 {id:'t_leech',   name:'흡혈',          el:'현무', tier:1, desc:'처치 시 HP +2', eff:{killheal:2}},
 {id:'t_harmor',  name:'현무의 갑옷',   el:'현무', tier:1, desc:'최대 HP +40', eff:{maxhp:40}},
 {id:'t_eternal', name:'현무의 영생',   el:'현무', tier:3, desc:'초당 HP +1 재생', eff:{hpregen:1}},
 // 황룡 (중앙 · 균형 · 빙의SP): 일반2 레어3 에픽1 전설1
 {id:'t_grace',   name:'신령의 가호',   el:'황룡', tier:0, desc:'최대 SP +25', eff:{maxsp:25}},
 {id:'t_effi',    name:'신령의 효율',   el:'황룡', tier:0, desc:'빙의 SP 소모 -25%', eff:{spsave:0.25}},
 {id:'t_swap',    name:'빠른 스왑',     el:'황룡', tier:1, desc:'스왑 쿨다운 -50%', eff:{swapcd:0.50}},
 {id:'t_srage',   name:'신령의 분노',   el:'황룡', tier:1, desc:'빙의 중 공격력 +15%', eff:{spiritatk:0.15}},
 {id:'t_union',   name:'신과의 합일',   el:'황룡', tier:1, desc:'스왑 시 주변 폭발 25 피해', eff:{swapblast:25}},
 {id:'t_dposs',   name:'이중 빙의',     el:'황룡', tier:2, desc:'특수기 SP 소모 -30%', eff:{specsave:0.30}},
 {id:'t_hwang',   name:'황룡의 강림',   el:'황룡', tier:3, desc:'챔버당 5초간 빙의 SP 소모 없음', eff:{freeposs:5}}
];

// ---- 16.5 신물 15종 ----
const RELICS = [
 // 일반 7
 {id:'r_gourd',  name:'산신의 호리병',   tier:0, desc:'소비품 회복 효과 +50%', eff:{potion:0.5}},
 {id:'r_bundle', name:'부적 묶음',       tier:0, desc:'부적 투척 피해 +50%', eff:{throwdmg:0.5}},
 {id:'r_mirror', name:'만월의 거울',     tier:0, desc:'치명타 확률 +5%', eff:{crit:0.05}},
 {id:'r_incense',name:'신령의 향로',     tier:0, desc:'SP 회복 +2/s', eff:{spregen:2}},
 {id:'r_board',  name:'칠성판',          tier:0, desc:'상점 가격 -15%', eff:{discount:0.15}},
 {id:'r_dagger', name:'무당의 단검',     tier:0, desc:'백어택 배율 ×1.4', eff:{backx:0.2}},
 {id:'r_cloth',  name:'삼신의 옷자락',   tier:0, desc:'부활 시 HP +20%', eff:{revivehp:0.2}},
 // 레어 4 — 시그니처 (호감도 75 + 혼옥 100 해금)
 {id:'r_club',   name:'도깨비방망이 조각', tier:1, sig:'dokkaebi', desc:'도깨비 폼 공격력 +20%', eff:{sig_dokkaebi:0.2}},
 {id:'r_tail',   name:'구미호 꼬리털',     tier:1, sig:'gumiho', desc:'구미호 폼 공격력 +20%', eff:{sig_gumiho:0.2}},
 {id:'r_scale',  name:'이무기 비늘',       tier:1, sig:'imugi', desc:'이무기 폼 공격력 +20%', eff:{sig_imugi:0.2}},
 {id:'r_scythe', name:'저승사자 낫조각',   tier:1, sig:'jeoseung', desc:'저승사자 폼 공격력 +20%', eff:{sig_jeoseung:0.2}},
 // 에픽 3
 {id:'r_bshell', name:'불가사리 비늘',   tier:2, sig:'bulgasari', desc:'불가사리 폼 공격력 +25%, 받는 피해 -5%', eff:{sig_bulgasari:0.25, dr:0.05}},
 {id:'r_seal',   name:'부서진 옥새 조각', tier:2, desc:'무패 획득 +1, 모든 피해 +8%', eff:{mupae:1, atk:0.08}},
 {id:'r_name',   name:'잊혀진 진명',     tier:2, desc:'호감도 획득 +50%', eff:{affx:0.5}},
 // 전설 1
 {id:'r_core',   name:'옥새의 핵심',     tier:3, desc:'모든 능력치 +5%', eff:{all:0.05}}
];

// ---- 16.6 소비품 5종 ----
const CONSUMABLES = [
 {id:'c_water', name:'약수병',      tier:0, desc:'HP 50 회복', use:'heal50'},
 {id:'c_tea',   name:'호리병의 차', tier:0, desc:'SP 100 회복', use:'sp100'},
 {id:'c_paper', name:'부적 한 장',  tier:0, desc:'다음 부적 투척 SP 무료·피해 +50%', use:'freethrow'},
 {id:'c_spirit',name:'신령의 부적', tier:1, desc:'10초간 빙의 SP 소모 없음', use:'nospend'},
 {id:'c_moon',  name:'달의 가호',   tier:2, desc:'챔버의 잡귀 전멸 (보스 제외)', use:'wipe'}
];

// ---- 16.7 신화 1종 ----
const MYTHIC = {
  id:'m_fan', name:'바리데기의 진실된 부채', tier:4,
  desc:'차지 0.1초 · 피해 ×3 · 광역 ×2 · 화염/얼음/번개 무작위 부착 · SP 5',
  cond:'신령 6 호감도 75+ · 통합 엔딩 1회 · 무패 200'
};

// ---- 9.3 챔버 보상 드롭 확률 [일반,레어,에픽,전설] ----
const DROP_TABLE = {
  normal:[0.60,0.30,0.10,0],
  elite:[0.30,0.45,0.20,0.05],
  miniboss:[0,0.50,0.35,0.15],
  boss:[0,0,0.60,0.40]
};

// ---- 9.5 상점 ----
const SHOP_PRICE = {
  '부적':[[60,80],[100,140],[180,250]],
  '신물':[[80,120],[140,200],[240,320]],
  '소비품':[[30,60],[100,150],[200,300]]
};
const SHOP_TIER_ODDS = [0.60,0.30,0.10]; // 일반/희귀/에픽 — 전설은 보스 전용
const SHOP_EXTRA = [
  {id:'s_hp',  name:'치유 (HP +20)', price:60, use:'hp20'},
  {id:'s_sp',  name:'신기 (SP +20)', price:30, use:'sp20'},
  {id:'s_up',  name:'부적 등급업 (랜덤)', price:100, use:'upgrade'}
];

// ---- 9.6 사당 메타 업그레이드 ----
const SHRINE_UPGRADES = [
  {id:'hp',   name:'신체 강화',     cost:[10,20,40,80,150], desc:'최대 HP +10/레벨'},
  {id:'sp',   name:'신령의 그릇',   cost:[15,30,60,120,200], desc:'최대 SP +15/레벨'},
  {id:'spd',  name:'무당의 발걸음', cost:[20,50,100], desc:'이동속도 +5%/레벨'},
  {id:'tal',  name:'추가 부적',     cost:[30,80,200], desc:'시작 부적 +1/레벨'},
  {id:'bell', name:'부활의 종',     cost:[500], desc:'런당 1회 부활'}
];

// ---- 6.5 신의 시련 (5단계) ----
const HEAT = [
  '잡귀 HP +20%, 피해 +10%',
  '+ 보스 HP +30%',
  '+ SP 소모 ×1.5',
  '+ 부적 등급 -1',
  '+ 챔버 보상 -1'
];

// ============ 스토리 (story_bible 요약본) ============

// 4.1 오프닝 시네마틱
const OPENING = [
 {h:'신화 시대', t:'바리데기는 오구대왕의 일곱째 딸이었다.\n아들을 원한 왕은 그녀를 산에 버렸으나,\n부모가 죽을 병에 들자 홀로 저승길에 올라 약수를 구했다.\n인간의 보상을 거절한 그녀는 무당의 시조신이 되었다.'},
 {h:'봉인의 시대', t:'신이 되기 위해 바리는 인간이었을 적의\n외로움과 한(恨), 분노와 원망을 떼어내야 했다.\n떨어져 나온 어둠은 그림자로 응축되어\n옥새(玉璽)의 봉인 속 깊이 잠들었다.'},
 {h:'잊혀지는 시간', t:'세월이 흘렀다. 인간들은 신령을 잊고,\n굿 소리는 끊기고, 사당은 무너졌다.\n영적 결계는 서서히... 약해져 갔다.'},
 {h:'현대의 균열', t:'그림자가 힘을 모아 옥새를 균열냈다.\n봉인된 잡귀들이 전국에 풀려나는 밤 —\n산속 폐사당에서, 바리데기가 눈을 뜬다.'}
];

// 3.5 진실 공개 + 4.2 보스 마지막 대사
const STAGE_STORY = {
 gangwon:   { line:'"..산속 영혼들이여... 다시 잠들거라..."',
              truth:'"산 영혼들이여... 그분께서... 그분을 부르는 자가 있다..."' },
 chungcheong:{ line:'"우리는 잊혀진 자들... 그대 또한 잊혀질 것인가?"',
              truth:'"그대의 모습이 어디선가 본 듯하다... 더 어두운 어떤 곳에서..."' },
 jeolla:    { line:'"굿을 멈추지 마라..."',
              truth:'(죽음의 환영 — 바리의 얼굴을 한 검은 자가 옥새를 깨뜨린다)' },
 gyeongsang:{ line:'(침몰하며) 바리: "수도에서... 익숙한 부름..."',
              truth:'"수도에서 옛 그분이... 바리데기의 모습으로 부른다..."' },
 gyeonggi:  { line:'"...그대는 자신을 만날 준비가 되었는가?"',
              truth:'바리: "...내 마음 속이 흔들린다."' },
 seoul:     { line:'', truth:'할미: "그분은 너의 잘려나간 마음이다."' }
};

// 4.3 서울 진입 시네마틱
const SEOUL_CINEMA = [
 {h:'광화문', t:'텅 빈 광화문 광장. 네온이 깜빡이고,\n짙은 안개가 도로를 삼킨다.'},
 {h:'백귀행', t:'안개 속에서 백 귀(百鬼)의 행렬이 나아간다.\n그 선두에, 후드를 눌러쓴 형상이 서 있다.'},
 {h:'대면', t:'형상이 천천히 후드를 내린다.\n\n— 바리 자신의 얼굴이었다.'},
 {h:'', t:'"어서 와. 나의 반쪽."\n\n화면이 어둠에 잠긴다.'}
];

// 3.6 엔딩
const ENDINGS = {
 seal: { name:'봉인 엔딩', panels:[
   {h:'봉인', t:'그림자는 산산이 흩어지고,\n바리는 부서진 옥새를 다시 붙였다.'},
   {h:'', t:'잡귀들은 봉인으로 돌아갔다. 세상은 평온해졌다.\n그러나 옥새의 균열 자국처럼,\n바리의 마음에도 메꿔지지 않은 자리가 남았다.'},
   {h:'', t:'"언젠가... 다시 만나겠지. 나의 반쪽."\n\n— 백귀행(百鬼行), 봉인 엔딩 —'}]},
 union: { name:'통합 엔딩 (진엔딩)', panels:[
   {h:'다가가기', t:'바리는 무기를 내려놓고 그림자에게 걸어갔다.\n신령들이 그 곁을 지켰다. 할미의 방울 소리가 울렸다.'},
   {h:'합일', t:'"외로웠지. 미안해. 이제 함께 가자."\n그림자는 떨었다 — 그리고 바리의 품에서\n천천히 빛으로 녹아들었다.'},
   {h:'완전한 바리', t:'외로움도, 한도, 분노도 모두 그녀의 것.\n비로소 완전해진 바리데기가 새벽의 서울을 걷는다.\n\n— 백귀행(百鬼行), 통합 엔딩 —'}]},
 fall: { name:'굴복 엔딩', panels:[
   {h:'굴복', t:'세 번째 어둠이 바리를 삼켰다.'},
   {h:'', t:'광화문의 안개가 전국으로 번진다.\n백귀행의 선두에는 이제 두 개의 같은 얼굴이 있다.\n\n— 백귀행(百鬼行), 굴복 엔딩 —'}]}
};

// 5.3 할미 + 신령 호감도 대사 (25/50/75/100)
const DIALOGUE = {
 halmi: { name:'할미 (마지막 인간 무당)', col:'#E8DED0', lines:[
   '왔는가. 늙은이가 줄 것은 말뿐이게야.',
   '신령들과 마음을 나누게. 그들이 자네의 힘일 텐가.',
   '수도가 가까워질수록... 자네 얼굴이 어두워지는게야.',
   '잘 듣게. 그분은 너의 잘려나간 마음이다. 벨 텐가, 안을 텐가.']},
 dokkaebi: { lines:['...밥은 먹었나? 난 씨름이나 하고 싶군.',
   '네 곁에서 싸우는 건 나쁘지 않아. 밥만 준다면.',
   '내 방망이 조각을 맡기지. 부수고 싶은 게 있으면 말해.',
   '내 진명은 쇠개비다. 너에게만 알려주는 거다.']},
 gumiho: { lines:['어머, 인간 냄새... 아니, 신 냄새인가?',
   '심심했는데 잘됐다. 놀아줘, 바리.',
   '꼬리털 하나 줄게. 특별한 거야. ...외로웠거든, 사실.',
   '휘영. 내 진짜 이름이야. 잊지 마. 절대로.']},
 imugi: { lines:['...용이 되지 못한 한(恨)을 아는가.',
   '네 싸움에는 결이 있다. 물결 같은.',
   '내 비늘이다. 언젠가 하늘에 오를 때까지, 함께 가지.',
   '영천이라 부르거라. 천 년 만에 이름을 말했다.']},
 jeoseung: { lines:['...명부에 없는 자로군.',
   '죽음을 진지하게 다루는 자는 오랜만이다.',
   '낫의 조각을 맡긴다. 의무를 다하라.',
   '묵야. 그것이 나의 진명. 그대의 길에 어둠이 없기를.']},
 bulgasari: { lines:['철... 철 줘...',
   '너 좋아. 철 다음으로 좋아.',
   '비늘 줄게. 단단한 거야. 철만큼은 아니지만.',
   '철수... 내 이름. 네가 지어준 거로 할래.']}
};

// 4.5 미니 이벤트
const MINI_EVENTS = [
 {id:'shrine', name:'잊혀진 사당', desc:'기도한다 (HP +20, 낮은 확률로 무패 +1)'},
 {id:'soul',   name:'떠도는 영혼', desc:'옥 40으로 부적을 거래한다'},
 {id:'echo',   name:'그림자의 메아리', desc:'어둠의 목소리를 듣는다 (스토리)'}
];
const ECHO_LINES = [
 '"...왜 나만 버려졌지?"',
 '"너는 신이 되고, 나는 어둠이 되었다."',
 '"기억해 내. 우리가 하나였던 때를."'
];

// ---- 조작 안내 ----
const CONTROLS = [
 '이동 ← → / A D    점프 SPACE (2단)   대시 SHIFT',
 '공격 J (3타 콤보)   강공격 K (차지)    부적 투척 L',
 '빙의 스왑 Q / E    소비품 1 2 3      상호작용 ↑ 또는 F',
 '일시정지 ESC'
];
