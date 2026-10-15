/** 메타 진행 데이터: 영구 강화, 업적, 소모 아이템, 챕터, 이벤트, 저주 단계 */

export interface UpgradeDef {
  id: string;
  name: string;
  desc: string; // {v}: 현재 총 효과
  max: number;
  cost: number[]; // 단계별 영혼 결정 비용
  per: number;
  unit: string;
}

export const UPGRADES: UpgradeDef[] = [
  { id: 'hp', name: '강인한 육신', desc: '최대 체력 +{v}', max: 5, cost: [40, 80, 140, 220, 320], per: 12, unit: '' },
  { id: 'atk', name: '계약의 힘', desc: '공격력 +{v}%', max: 5, cost: [50, 100, 160, 240, 340], per: 4, unit: '%' },
  { id: 'gold', name: '도굴꾼의 감', desc: '시작 금화 +{v}', max: 5, cost: [30, 60, 100, 150, 220], per: 40, unit: '' },
  { id: 'revive', name: '두 번째 숨결', desc: '런마다 부활 {v}회 (체력 50%)', max: 1, cost: [400], per: 1, unit: '' },
  { id: 'stone', name: '영혼 수집가', desc: '영혼석 획득 +{v}%', max: 5, cost: [60, 120, 200, 300, 420], per: 10, unit: '%' },
  { id: 'crit', name: '날카로운 눈', desc: '치명타 확률 +{v}%', max: 5, cost: [40, 80, 130, 200, 280], per: 2, unit: '%' },
  { id: 'swap', name: '영혼 공명', desc: '교대 쿨타임 -{v}%', max: 4, cost: [50, 100, 170, 260], per: 6, unit: '%' },
  { id: 'potion', name: '비상 약낭', desc: '런 시작 시 회복 물약 {v}개', max: 1, cost: [150], per: 1, unit: '' },
  { id: 'relic', name: '유물 감정사', desc: '정예 유물 선택지 +{v}', max: 1, cost: [250], per: 1, unit: '' },
  { id: 'rest', name: '안식의 기도', desc: '휴식·방 클리어 회복량 +{v}%', max: 4, cost: [40, 80, 130, 190], per: 10, unit: '%' },
];

export interface ItemDef {
  id: string;
  name: string;
  desc: string;
  col: string;
  price: number;
}

export const ITEMS: ItemDef[] = [
  { id: 'potion', name: '회복 물약', desc: '체력 35% 회복', col: '#ff4a6a', price: 60 },
  { id: 'bomb', name: '화염 폭탄', desc: '전방에 큰 폭발 (공격력 500%)', col: '#ff8a2a', price: 55 },
  { id: 'frost', name: '서리 병', desc: '주변 모든 적을 빙결', col: '#a8e4ff', price: 55 },
  { id: 'lantern', name: '영혼 등불', desc: '모든 스킬·교대 쿨타임 초기화', col: '#9ef0ff', price: 50 },
  { id: 'ward', name: '수호 부적', desc: '최대 체력 35% 보호막', col: '#ffd76a', price: 50 },
];
export const ITEM_MAP: Record<string, ItemDef> = Object.fromEntries(ITEMS.map((i) => [i.id, i]));

import type { MusicTheme } from '../core/audio';

export type Particles = 'dust' | 'spore' | 'ember' | 'shadow' | 'rain' | 'snow' | 'void' | 'ash' | 'petal' | 'spark' | 'blood' | 'star' | 'bubble' | 'leaf';

export interface ChapterDef {
  n: number; // 테마 id (적·보스·배경이 이 값으로 묶임). 스토리 1: 1~7, 스토리 2: 11~16, 스토리 3: 21~26, 스토리 4: 31~36
  name: string;
  boss: string;
  bg: [string, string, string]; // 하늘/먼 배경/가까운 배경
  tile: [string, string, string]; // 타일 본색/밝은/어두운
  ambient: string; // 어둠 색
  dark: number; // 어둠 강도
  light: string; // 광원 색
  music: MusicTheme;
  particles: Particles;
  hazard?: 'lava' | 'void'; // 바닥 구덩이 가시를 대체
  slippery?: boolean; // 미끄러운 바닥
  desc: string; // 분기 문 위 설명
}

/** 테마별 챕터. 진행 순서는 스토리(src/data/stories.ts)의 route가 정한다. */
export const CHAPTERS: ChapterDef[] = [
  // ── 스토리 1: 망자의 계약 ──
  { n: 1, name: '무너진 묘소', boss: 'graven', bg: ['#14121c', '#221e2e', '#2e2838'], tile: ['#4a4458', '#6a6478', '#2a2636'], ambient: '#08060e', dark: 0.55, light: '#ffb060', music: 'ch1', particles: 'dust', desc: '해골과 망령' },
  { n: 2, name: '독버섯 지하수로', boss: 'mycora', bg: ['#0c1a14', '#14281e', '#1e3626'], tile: ['#3a5040', '#507060', '#20302a'], ambient: '#040a06', dark: 0.5, light: '#a0ff80', music: 'ch2', particles: 'spore', desc: '독과 슬라임' },
  { n: 5, name: '침몰한 항구', boss: 'morten', bg: ['#0a1622', '#12263a', '#1a3450'], tile: ['#3a4a58', '#5a7488', '#1e2a36'], ambient: '#02060c', dark: 0.5, light: '#80d0ff', music: 'ch5', particles: 'rain', desc: '익사자와 폭풍' },
  { n: 3, name: '불타는 왕실 대장간', boss: 'ignis', bg: ['#2a0c08', '#3a1a10', '#4a2414'], tile: ['#5a3a30', '#7a5040', '#2a1a14'], ambient: '#100402', dark: 0.38, light: '#ff8a3a', music: 'ch3', particles: 'ember', hazard: 'lava', desc: '불꽃과 골렘' },
  { n: 6, name: '얼어붙은 왕립 도서관', boss: 'libra', bg: ['#0e1626', '#1a2a40', '#28405a'], tile: ['#4a5a70', '#a8d0ec', '#24304a'], ambient: '#040814', dark: 0.45, light: '#a8e4ff', music: 'ch6', particles: 'snow', slippery: true, desc: '서리와 금서' },
  { n: 4, name: '끝없는 왕좌', boss: 'king', bg: ['#0e0a1a', '#1a1430', '#261e40'], tile: ['#3a3450', '#5a5078', '#1e1a2e'], ambient: '#040210', dark: 0.6, light: '#c0a0ff', music: 'ch4', particles: 'shadow', desc: '끝없는 왕' },
  { n: 7, name: '망각의 심연', boss: 'oblivion', bg: ['#04020a', '#0c0618', '#160c28'], tile: ['#2a2040', '#6a4aa0', '#120a20'], ambient: '#000000', dark: 0.62, light: '#ff80d0', music: 'ch7', particles: 'void', hazard: 'void', desc: '진엔딩 · 왕이 삼킨 혼들의 끝' },
  // ── 스토리 2: 잿빛 성좌 ──
  { n: 11, name: '잿더미 순례길', boss: 'kardun', bg: ['#1a1614', '#2a2420', '#3a322a'], tile: ['#5a5048', '#7a7068', '#2a2420'], ambient: '#0a0806', dark: 0.45, light: '#ffb080', music: 's11', particles: 'ash', desc: '재와 순례자' },
  { n: 12, name: '거꾸로 선 종탑', boss: 'bellona', bg: ['#141822', '#202838', '#2c364a'], tile: ['#4a4a5a', '#8a8090', '#24242e'], ambient: '#04060c', dark: 0.5, light: '#ffe0a0', music: 's12', particles: 'dust', desc: '종소리와 가고일' },
  { n: 13, name: '별의 광맥', boss: 'astril', bg: ['#0c0c1e', '#16163a', '#202050'], tile: ['#3a3a6a', '#8a8aff', '#1a1a34'], ambient: '#02020a', dark: 0.55, light: '#a0a0ff', music: 's13', particles: 'star', desc: '수정과 광부' },
  { n: 14, name: '구름 위 정원', boss: 'elowin', bg: ['#1a2a3a', '#2a4058', '#3a5878'], tile: ['#4a6a4a', '#8ac08a', '#2a3a2a'], ambient: '#06101a', dark: 0.3, light: '#e0ffe0', music: 's14', particles: 'petal', hazard: 'void', desc: '덩굴과 바람' },
  { n: 15, name: '성좌의 천문대', boss: 'orbis', bg: ['#0a0e1e', '#141c36', '#1e2a4e'], tile: ['#3a4060', '#c0a060', '#1e2236'], ambient: '#02040c', dark: 0.5, light: '#ffe080', music: 's15', particles: 'spark', desc: '혼천의와 점성술사' },
  { n: 16, name: '꺼진 별의 심장', boss: 'nemesia', bg: ['#06040a', '#120c1a', '#1e1428'], tile: ['#2e2838', '#8a7aa0', '#16121e'], ambient: '#000000', dark: 0.62, light: '#c0b0ff', music: 's16', particles: 'ash', hazard: 'void', desc: '꺼진 별' },
  // ── 스토리 3: 핏빛 왕관 ──
  { n: 21, name: '전쟁터의 진흙', boss: 'grak', bg: ['#1a1410', '#2a2018', '#3a2c20'], tile: ['#4a3a2a', '#6a5440', '#2a2014'], ambient: '#080402', dark: 0.45, light: '#ffa060', music: 's21', particles: 'rain', desc: '망자 병사와 까마귀' },
  { n: 22, name: '핏빛 포도원', boss: 'seraphine', bg: ['#1e0a14', '#2e1420', '#40202e'], tile: ['#4a2a34', '#7a4a5a', '#2a141c'], ambient: '#0a0206', dark: 0.45, light: '#ff8090', music: 's22', particles: 'petal', desc: '포도원과 흡혈귀' },
  { n: 23, name: '쇠사슬 감옥', boss: 'morg', bg: ['#121214', '#1e1e22', '#2a2a30'], tile: ['#3e3e44', '#6a6a72', '#202024'], ambient: '#040404', dark: 0.58, light: '#ffc070', music: 's23', particles: 'dust', desc: '간수와 고문 기계' },
  { n: 24, name: '붉은 대성당', boss: 'valerius', bg: ['#1a0608', '#2c0e12', '#40161c'], tile: ['#5a3a3a', '#c09080', '#2a1414'], ambient: '#0a0204', dark: 0.5, light: '#ff6060', music: 's24', particles: 'blood', desc: '타락한 성직자' },
  { n: 25, name: '달 없는 숲', boss: 'fenrik', bg: ['#060a08', '#0e1610', '#16241a'], tile: ['#2a3a2a', '#4a604a', '#141e14'], ambient: '#010402', dark: 0.66, light: '#c0ffc0', music: 's25', particles: 'leaf', desc: '늑대인간과 덫' },
  { n: 26, name: '핏빛 왕좌', boss: 'carmilla', bg: ['#14020a', '#240614', '#380a20'], tile: ['#3a1a24', '#a04060', '#1e0a12'], ambient: '#060002', dark: 0.55, light: '#ff4070', music: 's26', particles: 'blood', hazard: 'lava', desc: '핏빛 여제' },
  // ── 스토리 4: 태초의 계약 ──
  { n: 31, name: '태초의 해안', boss: 'levia', bg: ['#04121a', '#082230', '#0c3246'], tile: ['#2a4a50', '#5a9aa0', '#14262a'], ambient: '#00060a', dark: 0.45, light: '#80ffe0', music: 's31', particles: 'bubble', slippery: true, desc: '심해의 것들' },
  { n: 32, name: '화석의 숲', boss: 'yggdra', bg: ['#141810', '#20261a', '#2c3424'], tile: ['#5a5a4a', '#8a8a70', '#2a2a20'], ambient: '#040602', dark: 0.45, light: '#e0e0a0', music: 's32', particles: 'leaf', desc: '돌이 된 숲' },
  { n: 33, name: '폭풍의 첨탑', boss: 'taranis', bg: ['#0c1018', '#161e2e', '#202c44'], tile: ['#3a4458', '#80a0d0', '#1a2030'], ambient: '#02040a', dark: 0.5, light: '#c0e0ff', music: 's33', particles: 'rain', desc: '번개와 폭풍' },
  { n: 34, name: '거울의 미궁', boss: 'mirror', bg: ['#14141e', '#22223a', '#303056'], tile: ['#4a4a6a', '#d0d0ff', '#24243a'], ambient: '#04040c', dark: 0.4, light: '#ffffff', music: 's34', particles: 'spark', slippery: true, desc: '거울과 환영' },
  { n: 35, name: '시간의 폐허', boss: 'aeon', bg: ['#1a160c', '#2a2414', '#3a321c'], tile: ['#5a5030', '#c0b070', '#2a2414'], ambient: '#060402', dark: 0.45, light: '#ffe0a0', music: 's35', particles: 'dust', hazard: 'void', desc: '멈춘 시간' },
  { n: 36, name: '계약의 근원', boss: 'arche', bg: ['#08060e', '#120e1e', '#1c162e'], tile: ['#2e2840', '#e0d0ff', '#16121e'], ambient: '#000000', dark: 0.55, light: '#fff0c0', music: 's36', particles: 'star', hazard: 'void', desc: '최초의 계약자' },
];

export const chapterDef = (n: number): ChapterDef => CHAPTERS.find((c) => c.n === n) ?? CHAPTERS[0];

/** 테마가 속한 스토리 (1~4) */
export const storyOfTheme = (n: number): number => (n < 10 ? 1 : Math.floor(n / 10) + 1);

export interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  reward: number; // 영혼석
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first_run', name: '첫 계약', desc: '첫 런을 시작한다', reward: 160 },
  { id: 'clear1', name: '묘소의 정적', desc: '묘지기 그라벤을 쓰러뜨린다', reward: 320 },
  { id: 'clear2', name: '정화', desc: '부패의 어미 미코라를 쓰러뜨린다', reward: 400 },
  { id: 'clear3', name: '꺼진 용광로', desc: '용광로 거신 이그니스를 쓰러뜨린다', reward: 480 },
  { id: 'clear4', name: '끝의 끝', desc: '끝없는 왕을 쓰러뜨린다', reward: 1000 },
  { id: 'clear_morten', name: '닻을 내리다', desc: '익사한 제독 모르텐을 쓰러뜨린다', reward: 400 },
  { id: 'clear_libra', name: '해동', desc: '금서의 수호자 리브라를 쓰러뜨린다', reward: 560 },
  { id: 'clear_oblivion', name: '기억하는 자', desc: '망각을 쓰러뜨리고 진엔딩을 본다', reward: 1600 },
  { id: 'kills100', name: '백인참', desc: '누적 처치 100', reward: 160 },
  { id: 'kills1000', name: '망자의 군주', desc: '누적 처치 1000', reward: 480 },
  { id: 'combo50', name: '멈추지 않는 칼날', desc: '콤보 50 달성', reward: 160 },
  { id: 'combo150', name: '폭풍 연격', desc: '콤보 150 달성', reward: 320 },
  { id: 'swap50', name: '호흡의 일치', desc: '교대 공격 50회 적중', reward: 160 },
  { id: 'crest6', name: '완성된 문장', desc: '한 문장을 6단계까지 모은다', reward: 320 },
  { id: 'relic10', name: '수집가', desc: '한 런에서 유물 10개 보유', reward: 240 },
  { id: 'chars5', name: '다섯 개의 계약', desc: '영웅 5명 보유', reward: 160 },
  { id: 'chars14', name: '모든 혼의 주인', desc: '모든 영웅 보유', reward: 2400 },
  { id: 'star5', name: '별이 내린 날', desc: '★5를 처음 획득한다', reward: 160 },
  { id: 'awaken5', name: '완전한 각성', desc: '영웅 하나를 5각성시킨다', reward: 480 },
  { id: 'level20', name: '극의', desc: '영웅 하나를 20레벨로 육성한다', reward: 320 },
  { id: 'curse1', name: '저주를 넘어', desc: '저주 1단계 이상으로 최종 보스 처치', reward: 640 },
  { id: 'hidden', name: '벽 너머', desc: '숨겨진 보물을 발견한다', reward: 160 },
  { id: 'nodamage', name: '무결', desc: '보스를 피격 없이 처치한다', reward: 480 },
  { id: 'story2', name: '꺼진 별', desc: '스토리 2 「잿빛 성좌」를 완수한다', reward: 2000 },
  { id: 'story3', name: '부서진 왕관', desc: '스토리 3 「핏빛 왕관」을 완수한다', reward: 3000 },
  { id: 'story4', name: '마지막 계약', desc: '스토리 4 「태초의 계약」을 완수한다', reward: 4000 },
];

export interface EventChoice {
  label: string;
  result: string;
  fx: { gold?: number; hpPct?: number; maxHp?: number; relic?: boolean; stone?: number; crystal?: number; item?: string; atk?: number; tempChar?: boolean; weapon?: boolean; curseFight?: boolean; usePotion?: boolean; chance?: number; failResult?: string; failFx?: { hpPct?: number; gold?: number } };
  needGold?: number;
}
export interface EventDef {
  id: string;
  title: string;
  text: string;
  choices: EventChoice[];
}

export const EVENTS: EventDef[] = [
  {
    id: 'weeping_statue', title: '눈물 흘리는 석상', text: '이끼 낀 여신상이 붉은 눈물을 흘리고 있다. 발치의 그릇에는 오래된 금화가 쌓여 있다.',
    choices: [
      { label: '피를 바친다 (체력 -20%)', result: '여신상이 미소 짓는다. 손에 무언가 쥐어졌다.', fx: { hpPct: -0.2, relic: true } },
      { label: '금화를 챙긴다', result: '금화를 쓸어 담았다. 어딘가에서 한숨 소리가 들린다.', fx: { gold: 80 } },
      { label: '기도한다', result: '마음이 평온해진다. 체력이 회복되었다.', fx: { hpPct: 0.25 } },
    ],
  },
  {
    id: 'gambler', title: '해골 도박사', text: '"한 판 하겠나, 살아있는 자여?" 해골이 주사위를 굴리며 이를 딱딱거린다.',
    choices: [
      { label: '금화 60을 건다', needGold: 60, result: '이겼다! 해골이 투덜대며 금화를 넘긴다.', fx: { gold: 100, chance: 0.5, failResult: '졌다. 해골이 깔깔 웃는다.', failFx: { gold: -60 } } },
      { label: '영혼을 건다 (체력)', result: '이겼다! 해골이 아끼던 유물을 내놓는다.', fx: { relic: true, chance: 0.5, failResult: '졌다. 영혼 일부가 빠져나갔다.', failFx: { hpPct: -0.3 } } },
      { label: '거절한다', result: '"겁쟁이로군." 해골은 다시 주사위를 굴린다.', fx: {} },
    ],
  },
  {
    id: 'soul_well', title: '영혼의 우물', text: '푸른 빛이 일렁이는 우물. 수많은 영혼이 속삭인다.',
    choices: [
      { label: '손을 담근다', result: '영혼석이 손에 맺혔다.', fx: { stone: 60 } },
      { label: '깊이 들여다본다 (체력 -15%)', result: '우물 속에서 누군가 손을 내밀었다. 새로운 영웅이 합류한다!', fx: { hpPct: -0.15, tempChar: true } },
      { label: '물을 마신다', result: '차가운 물이 상처를 씻어낸다.', fx: { hpPct: 0.35 } },
    ],
  },
  {
    id: 'blacksmith_ghost', title: '대장장이의 유령', text: '반쯤 투명한 대장장이가 모루를 두드린다. "무기를 손봐 주지. 대가는 있지만."',
    choices: [
      { label: '금화 80을 낸다', needGold: 80, result: '무기가 날카로워졌다. 공격력 +10%', fx: { gold: -80, atk: 0.1 } },
      { label: '다른 무기를 달라', result: '유령이 낡은 상자에서 무기를 꺼낸다.', fx: { weapon: true } },
      { label: '그냥 지나간다', result: '쇠 두드리는 소리가 멀어진다.', fx: {} },
    ],
  },
  {
    id: 'cursed_chest', title: '저주받은 상자', text: '쇠사슬로 묶인 상자에서 검은 연기가 새어 나온다. 안에서 무언가 반짝인다.',
    choices: [
      { label: '연다', result: '유물을 얻었다! 하지만 상자 속 망령이 덮쳤다.', fx: { relic: true, curseFight: true } },
      { label: '부순다 (체력 -10%)', result: '상자가 산산조각 났다. 금화가 쏟아진다.', fx: { hpPct: -0.1, gold: 120 } },
      { label: '무시한다', result: '현명한 선택일지도 모른다.', fx: {} },
    ],
  },
  {
    id: 'pilgrim', title: '길 잃은 순례자', text: '지친 순례자가 쓰러져 있다. "물... 물 좀..."',
    choices: [
      { label: '회복 물약을 나눈다', result: '순례자가 감사하며 영혼 결정을 건넨다.', fx: { crystal: 40, usePotion: true } },
      { label: '금화를 준다 (30)', needGold: 30, result: '순례자가 축복을 내린다. 최대 체력 +15', fx: { gold: -30, maxHp: 15 } },
      { label: '지나친다', result: '뒤에서 희미한 기도가 들린다.', fx: {} },
    ],
  },
  {
    id: 'mirror', title: '비추지 않는 거울', text: '거울에 당신 대신 낯선 영웅이 비친다. 그가 손짓한다.',
    choices: [
      { label: '손을 맞댄다', result: '거울 속 영웅이 계약에 응했다!', fx: { tempChar: true } },
      { label: '거울을 깬다', result: '파편 속에서 유물을 찾았다. 손을 베었다.', fx: { relic: true, hpPct: -0.12 } },
      { label: '돌아선다', result: '거울 속 영웅이 쓸쓸히 웃는다.', fx: {} },
    ],
  },
  {
    id: 'shrine', title: '잊힌 사당', text: '먼지 쌓인 사당에 공물 그릇이 놓여 있다.',
    choices: [
      { label: '금화 50을 바친다', needGold: 50, result: '사당이 빛나며 유물을 내린다.', fx: { gold: -50, relic: true } },
      { label: '공물을 훔친다', result: '금화를 얻었다... 등 뒤가 서늘하다.', fx: { gold: 70, hpPct: -0.08 } },
      { label: '절을 올린다', result: '작은 영혼석 조각이 떨어졌다.', fx: { stone: 30 } },
    ],
  },
];

/** 저주 단계: 최종 보스 클리어 시 해금 */
export const CURSES = [
  { lv: 0, name: '저주 없음', desc: '기본 난이도', enemy: 0, reward: 0 },
  { lv: 1, name: '저주 I', desc: '적 체력·공격력 +20%, 보상 +25%', enemy: 0.2, reward: 0.25 },
  { lv: 2, name: '저주 II', desc: '적 +40%, 보상 +50%', enemy: 0.4, reward: 0.5 },
  { lv: 3, name: '저주 III', desc: '적 +65%, 정예 증가, 보상 +80%', enemy: 0.65, reward: 0.8 },
  { lv: 4, name: '저주 IV', desc: '적 +90%, 보상 +110%', enemy: 0.9, reward: 1.1 },
  { lv: 5, name: '저주 V', desc: '적 +120%, 회복량 감소, 보상 +150%', enemy: 1.2, reward: 1.5 },
];

export const ROOM_TYPES = {
  combat: { name: '전투', desc: '금화 보상', col: '#ffd040', icon: 'coin' },
  elite: { name: '정예', desc: '유물 보상', col: '#ff5050', icon: 'skull' },
  altar: { name: '영혼 제단', desc: '임시 영웅 획득', col: '#9ef0ff', icon: 'soul' },
  armory: { name: '무기고', desc: '무기 교체', col: '#c0c8d0', icon: 'sword' },
  shop: { name: '상점', desc: '유물·아이템 구매', col: '#80ff80', icon: 'bag' },
  rest: { name: '휴식', desc: '체력 회복', col: '#ff80a0', icon: 'heart' },
  event: { name: '이벤트', desc: '알 수 없는 만남', col: '#c080ff', icon: 'question' },
  treasure: { name: '보물방', desc: '유물과 금화', col: '#ffe080', icon: 'chest' },
  boss: { name: '보스', desc: '챕터의 주인', col: '#ff2040', icon: 'crown' },
  start: { name: '입구', desc: '', col: '#a0a0a0', icon: 'door' },
  tutorial: { name: '훈련', desc: '', col: '#a0a0a0', icon: 'door' },
} as const;
export type RoomType = keyof typeof ROOM_TYPES;
