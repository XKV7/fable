import type { BossDef } from './bosses';

/**
 * 스토리 5~6 보스 12체. 모두 여러 패턴을 한꺼번에 쓴다(multi: 페이즈별 최소 동시 패턴 수).
 * 5번째 보스(칼라이스·녹티스)는 날아다니고, 6번째 보스(세베르·이스카)는 광역 패턴이 많고 한 번 분열한다(split).
 * 5·6번째 보스는 즉사기를 하나씩 가진다 (eclipseDive / worldSever, src/game/boss.ts).
 */
type Row = Omit<BossDef, 'chapter' | 'w' | 'h' | 'soulStones'> & { theme: number; big?: boolean };

const ROWS: Row[] = [
  // ───────── 스토리 5: 찢어진 하늘 ─────────
  {
    id: 'branik', theme: 41, name: '닻을 끊은 선장 브라니크', title: '하늘 항구의 마지막 선장', hp: 2900, atk: 18, big: true,
    phases: [0.5], multi: [3, 4],
    patterns: [
      ['shovelSlam', 'charge', 'leapSmash', 'starfall', 'galeWaves', 'homingOrbs'],
      ['shovelSlam', 'charge', 'leapSmash', 'starfall', 'galeWaves', 'homingOrbs', 'pillarMarch', 'spikeWave', 'summon'],
    ],
    col: '#a0d0f0', elem: { col: '#a0d0f0', vis: 'thunder', drop: 'spear', proj: 'bolt' },
  },
  {
    id: 'lyanne', theme: 42, name: '물안개 무녀 리안', title: '거꾸로 흐르는 물의 무녀', hp: 3800, atk: 20,
    phases: [0.5], multi: [3, 4],
    patterns: [
      ['aimedFan', 'dashSlash', 'teleSlam', 'bladeHalo', 'gravityWell', 'skyCurtain'],
      ['aimedFan', 'dashSlash', 'teleSlam', 'bladeHalo', 'gravityWell', 'skyCurtain', 'laserSweep', 'radialBurst', 'floorHalf'],
    ],
    col: '#a0f0ff', elem: { col: '#a0f0ff', vis: 'ice', drop: 'shard', proj: 'shard', st: 'chill' },
  },
  {
    id: 'osric', theme: 43, name: '뼈고래 사제 오스릭', title: '폭풍 고래의 뼈를 지키는 자', hp: 4700, atk: 23, big: true,
    phases: [0.5], multi: [3, 4],
    patterns: [
      ['shockRing', 'leapSmash', 'spikeWave', 'pillarMarch', 'homingOrbs', 'floorSweep'],
      ['shockRing', 'leapSmash', 'spikeWave', 'pillarMarch', 'homingOrbs', 'floorSweep', 'meteor', 'crossBeam', 'summon'],
    ],
    col: '#c0e0e0', elem: { col: '#c0e0e0', vis: 'thunder', drop: 'bone', proj: 'bolt', st: 'shock' },
  },
  {
    id: 'penna', theme: 44, name: '깃털 대주교 펜나', title: '날개 잃은 자들의 사제', hp: 5500, atk: 25,
    phases: [0.5], multi: [3, 4],
    patterns: [
      ['radialBurst', 'aimedFan', 'teleSlam', 'bladeHalo', 'crossBeam', 'skyCurtain'],
      ['radialBurst', 'aimedFan', 'teleSlam', 'bladeHalo', 'crossBeam', 'skyCurtain', 'beamGrid', 'laserSweep', 'cloneDash'],
    ],
    col: '#fff0d0', elem: { col: '#fff0d0', vis: 'holy', drop: 'blade', proj: 'blade' },
  },
  {
    id: 'kalais', theme: 45, name: '폭풍의 사도 칼라이스', title: '하늘을 나는 마지막 사도', hp: 6300, atk: 27, flying: true,
    phases: [0.5], multi: [3, 4],
    patterns: [
      ['diveBomb', 'swoop', 'aimedFan', 'homingOrbs', 'galeWaves', 'laserSweep', 'starfall', 'eclipseDive'],
      ['diveBomb', 'swoop', 'aimedFan', 'homingOrbs', 'galeWaves', 'laserSweep', 'starfall', 'radialBurst', 'skyCurtain', 'crossBeam', 'eclipseDive'],
    ],
    col: '#c0e0ff', elem: { col: '#c0e0ff', vis: 'thunder', drop: 'spear', proj: 'bolt', st: 'shock' },
  },
  {
    id: 'sever', theme: 46, name: '하늘을 찢는 자 세베르', title: '세계에 상처를 낸 칼날', hp: 8400, atk: 32, mult: 3,
    phases: [0.66, 0.33], multi: [3, 4, 5], split: 1,
    patterns: [
      ['swordCombo', 'dashSlash', 'spikeWave', 'floorSweep', 'checkerFloor', 'starfall', 'laserSweep'],
      ['swordCombo', 'dashSlash', 'spikeWave', 'floorSweep', 'checkerFloor', 'starfall', 'laserSweep', 'beamGrid', 'skyCurtain', 'floorHalf', 'worldSever'],
      ['swordCombo', 'dashSlash', 'spikeWave', 'floorSweep', 'checkerFloor', 'starfall', 'laserSweep', 'beamGrid', 'skyCurtain', 'floorHalf', 'meteor', 'crossBeam', 'cloneDash', 'worldSever'],
    ],
    col: '#e0c0ff', elem: { col: '#e0c0ff', vis: 'void', drop: 'shard', proj: 'crescent' },
  },
  // ───────── 스토리 6: 바깥의 바다 ─────────
  {
    id: 'halvard', theme: 51, name: '잠긴 등대지기 할바르드', title: '꺼진 등불을 지키는 자', hp: 3100, atk: 19, big: true,
    phases: [0.5], multi: [3, 4],
    patterns: [
      ['shovelSlam', 'charge', 'shockRing', 'crossBeam', 'homingOrbs', 'laserSweep'],
      ['shovelSlam', 'charge', 'shockRing', 'crossBeam', 'homingOrbs', 'laserSweep', 'beamGrid', 'starfall', 'summon'],
    ],
    col: '#ffe8a0', elem: { col: '#ffe8a0', vis: 'holy', drop: 'rock', proj: 'orb' },
  },
  {
    id: 'coralie', theme: 52, name: '산호 묘지의 신부 코랄리', title: '산호로 굳은 신부', hp: 4000, atk: 21,
    phases: [0.5], multi: [3, 4],
    patterns: [
      ['dashSlash', 'aimedFan', 'spikeWave', 'gravityWell', 'bladeHalo', 'checkerFloor'],
      ['dashSlash', 'aimedFan', 'spikeWave', 'gravityWell', 'bladeHalo', 'checkerFloor', 'cloneDash', 'floorHalf', 'skyCurtain'],
    ],
    col: '#ff90b0', elem: { col: '#ff90b0', vis: 'poison', drop: 'shard', proj: 'spore', st: 'poison' },
  },
  {
    id: 'nekton', theme: 53, name: '해구의 군주 넥톤', title: '빛이 닿지 않는 바닥의 왕', hp: 4900, atk: 24, big: true,
    phases: [0.5], multi: [3, 4],
    patterns: [
      ['leapSmash', 'charge', 'shockRing', 'gravityWell', 'floorSweep', 'pillarMarch'],
      ['leapSmash', 'charge', 'shockRing', 'gravityWell', 'floorSweep', 'pillarMarch', 'meteor', 'galeWaves', 'summon'],
    ],
    col: '#6080ff', elem: { col: '#7090ff', vis: 'void', drop: 'rock', proj: 'orb' },
  },
  {
    id: 'vesper', theme: 54, name: '거꾸로 선 도시의 시장 베스퍼', title: '뒤집힌 시간을 다스리는 자', hp: 5800, atk: 26,
    phases: [0.5], multi: [3, 4],
    patterns: [
      ['teleSlam', 'swordCombo', 'aimedFan', 'floorHalf', 'homingOrbs', 'beamGrid'],
      ['teleSlam', 'swordCombo', 'aimedFan', 'floorHalf', 'homingOrbs', 'beamGrid', 'cloneDash', 'laserSweep', 'skyCurtain'],
    ],
    col: '#ffd080', elem: { col: '#ffd080', vis: 'time', drop: 'blade', proj: 'star' },
  },
  {
    id: 'noctis', theme: 55, name: '검은 오로라 녹티스', title: '심연 위를 나는 밤의 날개', hp: 6600, atk: 28, flying: true,
    phases: [0.5], multi: [3, 4],
    patterns: [
      ['diveBomb', 'swoop', 'radialBurst', 'bladeHalo', 'skyCurtain', 'crossBeam', 'galeWaves', 'eclipseDive'],
      ['diveBomb', 'swoop', 'radialBurst', 'bladeHalo', 'skyCurtain', 'crossBeam', 'galeWaves', 'aimedFan', 'meteor', 'laserSweep', 'eclipseDive'],
    ],
    col: '#80ffc0', elem: { col: '#80ffc0', vis: 'ice', drop: 'shard', proj: 'star', st: 'chill' },
  },
  {
    id: 'iska', theme: 56, name: '바깥의 전령 이스카', title: '세계의 바깥에서 온 목소리', hp: 9000, atk: 34, mult: 3,
    phases: [0.66, 0.33], multi: [3, 4, 5], split: 1,
    patterns: [
      ['swordCombo', 'dashSlash', 'shockRing', 'checkerFloor', 'floorSweep', 'skyCurtain', 'beamGrid'],
      ['swordCombo', 'dashSlash', 'shockRing', 'checkerFloor', 'floorSweep', 'skyCurtain', 'beamGrid', 'laserSweep', 'floorHalf', 'meteor', 'worldSever'],
      ['swordCombo', 'dashSlash', 'shockRing', 'checkerFloor', 'floorSweep', 'skyCurtain', 'beamGrid', 'laserSweep', 'floorHalf', 'meteor', 'starfall', 'crossBeam', 'pactShadows', 'gravityWell', 'worldSever'],
    ],
    col: '#a0ffe0', elem: { col: '#a0ffe0', vis: 'void', drop: 'shard', proj: 'soul' },
  },
];

export const STORY_BOSSES_56: BossDef[] = ROWS.map(({ theme, big, ...r }) => {
  const idx = theme % 10;
  const final = idx === 6;
  return {
    ...r,
    chapter: theme,
    w: big ? 40 : 30,
    h: big ? 56 : 46,
    soulStones: final ? 1800 : 480 + idx * 90,
  };
});
