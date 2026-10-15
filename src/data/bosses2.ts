import type { BossDef } from './bosses';

/**
 * 스토리 2~4 보스 18체. 각 스토리의 6번째 보스가 최종 보스(3페이즈, 배율 3).
 * 패턴 이름은 src/game/boss.ts 참고. elem은 범용 패턴(별비·기둥 행진·방사탄 등)의 색·속성을 정한다.
 */
type Row = Omit<BossDef, 'chapter' | 'w' | 'h' | 'soulStones'> & { theme: number; big?: boolean };

const ROWS: Row[] = [
  // ───────── 스토리 2: 잿빛 성좌 ─────────
  {
    id: 'kardun', theme: 11, name: '잿빛 순례단장 카르둔', title: '재를 밟고 걷는 자', hp: 2300, atk: 15, big: true,
    phases: [0.5],
    patterns: [
      ['shovelSlam', 'charge', 'starfall', 'spikeWave', 'summon'],
      ['shovelSlam', 'charge', 'starfall', 'spikeWave', 'summon', 'leapSmash', 'shockRing'],
    ],
    col: '#ffb080', elem: { col: '#ffb080', vis: 'fire', drop: 'rock', proj: 'fireball', st: 'burn' },
  },
  {
    id: 'bellona', theme: 12, name: '울림의 사제 벨로나', title: '거꾸로 울리는 종의 목소리', hp: 3100, atk: 17,
    phases: [0.5],
    patterns: [
      ['shockRing', 'radialBurst', 'pillarMarch', 'homingOrbs', 'teleSlam'],
      ['shockRing', 'radialBurst', 'pillarMarch', 'homingOrbs', 'teleSlam', 'crossBeam', 'floorHalf'],
    ],
    col: '#ffe0a0', elem: { col: '#ffe0a0', vis: 'holy', drop: 'blade', proj: 'orb' },
  },
  {
    id: 'astril', theme: 13, name: '광맥의 여왕 아스트릴', title: '별빛을 캐내 왕관을 엮은 자', hp: 3900, atk: 19,
    phases: [0.5],
    patterns: [
      ['spikeWave', 'aimedFan', 'starfall', 'summon', 'radialBurst'],
      ['spikeWave', 'aimedFan', 'starfall', 'summon', 'radialBurst', 'crossBeam', 'pillarMarch'],
    ],
    col: '#a0a0ff', elem: { col: '#c0c0ff', vis: 'star', drop: 'shard', proj: 'shard' },
  },
  {
    id: 'elowin', theme: 14, name: '천공 정원사 엘로윈', title: '구름 위의 마지막 정원을 지키는 자', hp: 4600, atk: 21,
    phases: [0.5],
    patterns: [
      ['spikeWave', 'homingOrbs', 'dashSlash', 'gravityWell', 'summon'],
      ['spikeWave', 'homingOrbs', 'dashSlash', 'gravityWell', 'summon', 'starfall', 'floorHalf'],
    ],
    col: '#a0e080', elem: { col: '#a0e080', vis: 'poison', drop: 'blade', proj: 'soul', st: 'poison' },
  },
  {
    id: 'orbis', theme: 15, name: '천문관 오르비스', title: '성좌의 궤도를 다시 쓰는 자', hp: 5400, atk: 23,
    phases: [0.5],
    patterns: [
      ['radialBurst', 'crossBeam', 'laserSweep', 'homingOrbs', 'teleSlam'],
      ['radialBurst', 'crossBeam', 'laserSweep', 'homingOrbs', 'teleSlam', 'starfall', 'gravityWell'],
    ],
    col: '#ffe080', elem: { col: '#ffe080', vis: 'star', drop: 'fireball', proj: 'star' },
  },
  {
    id: 'nemesia', theme: 16, name: '꺼진 별 네메시아', title: '혼을 삼켜 다시 빛나려는 죽은 별', hp: 6800, atk: 26, mult: 3,
    phases: [0.66, 0.33],
    patterns: [
      ['swordCombo', 'radialBurst', 'starfall', 'crossBeam', 'gravityWell'],
      ['swordCombo', 'radialBurst', 'starfall', 'crossBeam', 'gravityWell', 'laserSweep', 'cloneDash'],
      ['swordCombo', 'radialBurst', 'starfall', 'crossBeam', 'gravityWell', 'laserSweep', 'cloneDash', 'meteor', 'floorHalf'],
    ],
    col: '#c0b0ff', elem: { col: '#c0b0ff', vis: 'void', drop: 'shard', proj: 'orb' },
  },
  // ───────── 스토리 3: 핏빛 왕관 ─────────
  {
    id: 'grak', theme: 21, name: '썩은 장군 그라크', title: '끝나지 않은 전쟁의 지휘관', hp: 2500, atk: 16, big: true,
    phases: [0.5],
    patterns: [
      ['swordCombo', 'charge', 'summon', 'starfall', 'shockRing'],
      ['swordCombo', 'charge', 'summon', 'starfall', 'shockRing', 'leapSmash', 'pillarMarch'],
    ],
    col: '#c08060', elem: { col: '#d0a080', vis: 'poison', drop: 'spear', proj: 'blade', st: 'poison' },
  },
  {
    id: 'seraphine', theme: 22, name: '포도원의 백작부인 세라핀', title: '피로 빚은 포도주의 주인', hp: 3300, atk: 18,
    phases: [0.5],
    patterns: [
      ['dashSlash', 'homingOrbs', 'aimedFan', 'cloneDash', 'teleSlam'],
      ['dashSlash', 'homingOrbs', 'aimedFan', 'cloneDash', 'teleSlam', 'floorHalf', 'radialBurst'],
    ],
    col: '#ff4070', elem: { col: '#ff4070', vis: 'blood', drop: 'blade', proj: 'orb' },
  },
  {
    id: 'morg', theme: 23, name: '간수장 모르그', title: '쇠사슬의 감옥을 쥔 손', hp: 4200, atk: 21, big: true,
    phases: [0.5],
    patterns: [
      ['leapSmash', 'spikeWave', 'pillarMarch', 'summon', 'charge'],
      ['leapSmash', 'spikeWave', 'pillarMarch', 'summon', 'charge', 'shockRing', 'gravityWell'],
    ],
    col: '#ffc070', elem: { col: '#ffc070', vis: 'fire', drop: 'rock', proj: 'blade', st: 'burn' },
  },
  {
    id: 'valerius', theme: 24, name: '타락한 추기경 발레리우스', title: '붉은 성가를 지휘하는 자', hp: 5000, atk: 23,
    phases: [0.5],
    patterns: [
      ['crossBeam', 'pillarMarch', 'homingOrbs', 'radialBurst', 'summon'],
      ['crossBeam', 'pillarMarch', 'homingOrbs', 'radialBurst', 'summon', 'laserSweep', 'starfall'],
    ],
    col: '#ff6060', elem: { col: '#ff6060', vis: 'blood', drop: 'blade', proj: 'soul' },
  },
  {
    id: 'fenrik', theme: 25, name: '늑대왕 펜릭', title: '달을 삼킨 짐승', hp: 5700, atk: 25,
    phases: [0.5],
    patterns: [
      ['dashSlash', 'leapSmash', 'charge', 'cloneDash', 'shockRing'],
      ['dashSlash', 'leapSmash', 'charge', 'cloneDash', 'shockRing', 'summon', 'spikeWave'],
    ],
    col: '#ffe040', elem: { col: '#e0e0b0', vis: 'blood', drop: 'blade', proj: 'blade' },
  },
  {
    id: 'carmilla', theme: 26, name: '핏빛 여제 카르밀라', title: '영원한 왕관을 원한 자', hp: 7200, atk: 28, mult: 3,
    phases: [0.66, 0.33],
    patterns: [
      ['dashSlash', 'aimedFan', 'homingOrbs', 'crossBeam', 'swordCombo'],
      ['dashSlash', 'aimedFan', 'homingOrbs', 'crossBeam', 'swordCombo', 'cloneDash', 'floorHalf'],
      ['dashSlash', 'aimedFan', 'homingOrbs', 'crossBeam', 'swordCombo', 'cloneDash', 'floorHalf', 'meteor', 'laserSweep', 'radialBurst'],
    ],
    col: '#ff4070', elem: { col: '#ff4070', vis: 'blood', drop: 'blade', proj: 'orb' },
  },
  // ───────── 스토리 4: 태초의 계약 ─────────
  {
    id: 'levia', theme: 31, name: '심해의 군주 레비아', title: '세계가 물이었을 때의 왕', hp: 2700, atk: 17, big: true,
    phases: [0.5],
    patterns: [
      ['shockRing', 'gravityWell', 'aimedFan', 'summon', 'pillarMarch'],
      ['shockRing', 'gravityWell', 'aimedFan', 'summon', 'pillarMarch', 'starfall', 'floorHalf'],
    ],
    col: '#80ffe0', elem: { col: '#80ffe0', vis: 'ice', drop: 'shard', proj: 'orb', st: 'chill' },
  },
  {
    id: 'yggdra', theme: 32, name: '고대수 이그드라', title: '돌이 되어서도 기억하는 나무', hp: 3600, atk: 19, big: true, still: true,
    phases: [0.5],
    patterns: [
      ['spikeWave', 'starfall', 'pillarMarch', 'summon', 'gravityWell'],
      ['spikeWave', 'starfall', 'pillarMarch', 'summon', 'gravityWell', 'radialBurst', 'shockRing'],
    ],
    col: '#e0e0a0', elem: { col: '#c0c080', vis: 'poison', drop: 'rock', proj: 'spore', st: 'poison' },
  },
  {
    id: 'taranis', theme: 33, name: '뇌신 타라니스', title: '하늘을 꿰매는 번개', hp: 4500, atk: 22, big: true,
    phases: [0.5],
    patterns: [
      ['crossBeam', 'pillarMarch', 'dashSlash', 'starfall', 'teleSlam'],
      ['crossBeam', 'pillarMarch', 'dashSlash', 'starfall', 'teleSlam', 'laserSweep', 'radialBurst'],
    ],
    col: '#c0e0ff', elem: { col: '#c0e0ff', vis: 'thunder', drop: 'spear', proj: 'bolt' },
  },
  {
    id: 'mirror', theme: 34, name: '거울의 계약자', title: '거울 속의 그대', hp: 5200, atk: 24,
    phases: [0.5],
    patterns: [
      ['cloneDash', 'dashSlash', 'swordCombo', 'aimedFan', 'teleSlam'],
      ['cloneDash', 'dashSlash', 'swordCombo', 'aimedFan', 'teleSlam', 'radialBurst', 'crossBeam'],
    ],
    col: '#d0d0ff', elem: { col: '#d0d0ff', vis: 'holy', drop: 'shard', proj: 'shard' },
  },
  {
    id: 'aeon', theme: 35, name: '영겁의 파수꾼 에온', title: '멈춘 시간을 지키는 자', hp: 6000, atk: 26, big: true,
    phases: [0.5],
    patterns: [
      ['homingOrbs', 'pillarMarch', 'laserSweep', 'radialBurst', 'teleSlam'],
      ['homingOrbs', 'pillarMarch', 'laserSweep', 'radialBurst', 'teleSlam', 'floorHalf', 'gravityWell'],
    ],
    col: '#ffe0a0', elem: { col: '#ffe0a0', vis: 'time', drop: 'blade', proj: 'orb' },
  },
  {
    id: 'arche', theme: 36, name: '최초의 계약자 아르케', title: '모든 계약의 처음이자 끝', hp: 7800, atk: 30, mult: 3,
    phases: [0.66, 0.33],
    patterns: [
      ['swordCombo', 'crossBeam', 'radialBurst', 'cloneDash', 'starfall'],
      ['swordCombo', 'crossBeam', 'radialBurst', 'cloneDash', 'starfall', 'laserSweep', 'gravityWell', 'meteor'],
      ['swordCombo', 'crossBeam', 'radialBurst', 'cloneDash', 'starfall', 'laserSweep', 'gravityWell', 'meteor', 'floorHalf', 'pactShadows', 'pillarMarch'],
    ],
    col: '#fff0c0', elem: { col: '#fff0c0', vis: 'holy', drop: 'blade', proj: 'soul' },
  },
];

export const STORY_BOSSES: BossDef[] = ROWS.map(({ theme, big, ...r }) => {
  const idx = theme % 10;
  const final = idx === 6;
  return {
    ...r,
    chapter: theme,
    w: big ? 40 : 30,
    h: big ? 56 : 46,
    soulStones: final ? 1500 : 400 + idx * 80,
  };
});
