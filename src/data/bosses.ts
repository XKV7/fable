export interface BossDef {
  id: string;
  name: string;
  title: string;
  chapter: number;
  hp: number;
  atk: number;
  w: number;
  h: number;
  phases: number[]; // 페이즈 전환 체력 비율 (내림차순)
  patterns: string[][]; // 페이즈별 사용 패턴
  col: string;
  soulStones: number; // 첫 처치 보상
}

/** 보스 7체. 패턴 구현은 src/game/boss.ts, 이름·체력·페이즈 구성은 여기서 조정. */
export const BOSSES: BossDef[] = [
  {
    id: 'graven', name: '묘지기 그라벤', title: '무너진 묘소의 주인', chapter: 1, hp: 2200, atk: 14, w: 40, h: 56,
    phases: [0.5],
    patterns: [
      ['shovelSlam', 'charge', 'boneRain', 'lanternFire', 'summonSkel'],
      ['shovelSlam', 'charge', 'boneRain', 'lanternFire', 'summonSkel', 'leapSmash', 'ghostFlames'],
    ],
    col: '#e8e0c8', soulStones: 300,
  },
  {
    id: 'mycora', name: '부패의 어미 미코라', title: '지하수로를 삼킨 균사', chapter: 2, hp: 3200, atk: 18, w: 56, h: 52,
    phases: [0.55],
    patterns: [
      ['sporeCloud', 'bodySlam', 'spitVolley', 'rootSpikes', 'birthSlimes'],
      ['sporeCloud', 'bodySlam', 'spitVolley', 'rootSpikes', 'birthSlimes', 'toxicFlood', 'bounceChain'],
    ],
    col: '#8bdc3a', soulStones: 400,
  },
  {
    id: 'ignis', name: '용광로 거신 이그니스', title: '왕실 대장간의 심장', chapter: 3, hp: 4600, atk: 23, w: 56, h: 64,
    phases: [0.55],
    patterns: [
      ['hammerQuake', 'flameBreath', 'lavaPillars', 'boulderRoll', 'moltenRain'],
      ['hammerQuake', 'flameBreath', 'lavaPillars', 'boulderRoll', 'moltenRain', 'coreLaser', 'doubleQuake'],
    ],
    col: '#ff6a2a', soulStones: 500,
  },
  {
    id: 'king', name: '끝없는 왕', title: '멸망한 왕국의 영원한 군주', chapter: 4, hp: 6500, atk: 26, w: 30, h: 46,
    phases: [0.66, 0.33],
    patterns: [
      ['swordCombo', 'shadowBlades', 'crownBeam', 'teleSlam', 'summonGuards'],
      ['swordCombo', 'shadowBlades', 'crownBeam', 'teleSlam', 'swordRain', 'darkWave'],
      ['swordCombo', 'shadowBlades', 'crownBeam', 'teleSlam', 'swordRain', 'darkWave', 'pactShadows'],
    ],
    col: '#9a6bff', soulStones: 800,
  },
  {
    id: 'morten', name: '익사한 제독 모르텐', title: '가라앉은 함대의 지휘관', chapter: 5, hp: 3300, atk: 18, w: 40, h: 56,
    phases: [0.5],
    patterns: [
      ['shovelSlam', 'harpoonVolley', 'tidalWave', 'summonCrew', 'cannonBarrage'],
      ['shovelSlam', 'harpoonVolley', 'tidalWave', 'summonCrew', 'cannonBarrage', 'whirlpool', 'leapSmash'],
    ],
    col: '#70c0e0', soulStones: 400,
  },
  {
    id: 'libra', name: '금서의 수호자 리브라', title: '얼어붙은 지식의 마지막 사서', chapter: 6, hp: 5400, atk: 24, w: 30, h: 46,
    phases: [0.5],
    patterns: [
      ['iceSpears', 'pageStorm', 'frostNova', 'shelfCollapse', 'summonTomes'],
      ['iceSpears', 'pageStorm', 'frostNova', 'shelfCollapse', 'summonTomes', 'blizzard', 'teleSlam'],
    ],
    col: '#a8e4ff', soulStones: 600,
  },
  {
    id: 'oblivion', name: '망각', title: '왕이 버린 그림자, 모든 혼을 삼킨 것', chapter: 7, hp: 9000, atk: 30, w: 30, h: 46,
    phases: [0.66, 0.33],
    patterns: [
      ['swordCombo', 'voidPillars', 'shadowBlades', 'teleSlam', 'voidBeam'],
      ['swordCombo', 'voidPillars', 'shadowBlades', 'teleSlam', 'voidBeam', 'darkWave', 'swordRain'],
      ['swordCombo', 'voidPillars', 'shadowBlades', 'teleSlam', 'voidBeam', 'darkWave', 'swordRain', 'pactShadows'],
    ],
    col: '#ff80d0', soulStones: 1200,
  },
];

export const BOSS_MAP: Record<string, BossDef> = Object.fromEntries(BOSSES.map((b) => [b.id, b]));
