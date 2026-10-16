import type { EnemyAI, EnemyDef } from './enemies';
import type { ProjDef } from '../game/types';

/**
 * 스토리 2~4의 일반 적 (테마당 4종, 총 72종).
 * AI 유형별 기본 수치(1단계 기준)에 테마 순서 보정을 곱한다. 이후 진행 단계 배율·스토리 배율·ENEMY_TUNE이 추가로 곱해진다.
 * 외형: 인간형은 ENEMY_LOOKS, 그 외는 src/gfx/creatures.ts의 생물 그리기(CREATURES)를 쓴다.
 */
type Base = Omit<EnemyDef, 'id' | 'name' | 'chapter' | 'col' | 'eliteSkill' | 'weight'> & { eliteSkill: EnemyDef['eliteSkill'] };

const BASE: Record<string, Base> = {
  melee: { ai: 'melee', hp: 80, atk: 8, speed: 0.8, w: 12, h: 22, range: 26, windup: 30, cd: 60, kbRes: 0, gold: 5, eliteSkill: 'shockwave' },
  archer: { ai: 'archer', hp: 58, atk: 7, speed: 0.6, w: 12, h: 22, range: 175, windup: 38, cd: 100, kbRes: 0, gold: 5, eliteSkill: 'volley' },
  flyer: { ai: 'flyer', hp: 62, atk: 8, speed: 1, w: 14, h: 14, range: 95, windup: 32, cd: 85, flying: true, kbRes: 0.2, gold: 5, eliteSkill: 'blink' },
  shield: { ai: 'shield', hp: 125, atk: 10, speed: 0.55, w: 14, h: 22, def: 0.12, range: 28, windup: 32, cd: 70, kbRes: 0.5, gold: 7, eliteSkill: 'enrage' },
  jumper: { ai: 'jumper', hp: 95, atk: 12, speed: 1.4, w: 16, h: 12, range: 115, windup: 26, cd: 70, kbRes: 0.1, gold: 6, eliteSkill: 'summon' },
  charger: { ai: 'charger', hp: 95, atk: 12, speed: 0.8, w: 18, h: 12, range: 145, windup: 32, cd: 75, kbRes: 0.2, gold: 6, eliteSkill: 'enrage' },
  turret: { ai: 'turret', hp: 90, atk: 11, speed: 0, w: 16, h: 18, range: 200, windup: 40, cd: 105, kbRes: 1, gold: 6, eliteSkill: 'volley' },
  bomber: { ai: 'bomber', hp: 66, atk: 11, speed: 1.05, w: 16, h: 12, range: 30, windup: 28, cd: 85, flying: true, kbRes: 0.2, gold: 6, eliteSkill: 'nova' },
  caster: { ai: 'caster', hp: 92, atk: 12, speed: 0.85, w: 14, h: 14, range: 165, windup: 36, cd: 100, flying: true, kbRes: 0.2, gold: 7, eliteSkill: 'volley' },
  gcaster: { ai: 'caster', hp: 100, atk: 12, speed: 0.6, w: 12, h: 22, range: 170, windup: 38, cd: 105, kbRes: 0.1, gold: 8, eliteSkill: 'summon' },
  golem: { ai: 'golem', hp: 240, atk: 18, speed: 0.45, w: 24, h: 28, def: 0.15, range: 40, windup: 44, cd: 90, kbRes: 0.85, gold: 12, eliteSkill: 'shockwave' },
  teleporter: { ai: 'teleporter', hp: 120, atk: 14, speed: 1, w: 12, h: 22, range: 28, windup: 26, cd: 80, kbRes: 0.1, gold: 9, eliteSkill: 'blink' },
  lancer: { ai: 'lancer', hp: 140, atk: 15, speed: 0.75, w: 14, h: 24, def: 0.1, range: 70, windup: 32, cd: 70, kbRes: 0.4, gold: 9, eliteSkill: 'shockwave' },
};

const P = {
  arrow: (col: string): ProjDef => ({ spr: 'arrow', spd: 3.6, life: 120, w: 10, h: 4, col }),
  spear: (col: string): ProjDef => ({ spr: 'spear', spd: 4, life: 110, w: 18, h: 4, col }),
  orb: (col: string, home = 0): ProjDef => ({ spr: 'orb', spd: 2.7, life: 160, w: 10, h: 10, col, home: home || undefined }),
  fire: (col: string): ProjDef => ({ spr: 'fireball', spd: 3, life: 120, w: 10, h: 10, col, st: 'burn' }),
  shard: (col: string, st?: 'chill'): ProjDef => ({ spr: 'shard', spd: 3.4, life: 120, w: 10, h: 6, col, st }),
  star: (col: string): ProjDef => ({ spr: 'star', spd: 3.2, life: 130, w: 9, h: 9, col }),
  bolt: (col: string): ProjDef => ({ spr: 'bolt', spd: 4.2, life: 100, w: 12, h: 6, col }),
  blade: (col: string): ProjDef => ({ spr: 'blade', spd: 3.6, life: 110, w: 10, h: 6, col }),
  soul: (col: string): ProjDef => ({ spr: 'soul', spd: 2.2, life: 180, w: 8, h: 8, col, home: 0.035 }),
  lob: (col: string, st?: 'poison' | 'burn'): ProjDef => ({ spr: 'spore', spd: 2.6, vy: -3.2, grav: 0.1, life: 140, w: 8, h: 8, col, st }),
};

type Row = [id: string, name: string, theme: number, base: keyof typeof BASE, col: string, extra?: Partial<EnemyDef> & { mul?: number }];

const ROWS: Row[] = [
  // ── 스토리 2: 잿빛 성좌 ──
  ['ash_pilgrim', '재의 순례자', 11, 'melee', '#b0a090', { weight: 4 }],
  ['ember_bat', '잿불 박쥐', 11, 'flyer', '#ff8a4a', { w: 14, h: 10 }],
  ['fossil_scorpion', '화석 전갈', 11, 'charger', '#c0a070', { def: 0.1 }],
  ['cult_acolyte', '성좌단 신도', 11, 'gcaster', '#c0b0ff', { proj: P.orb('#c0b0ff', 0.03) }],

  ['bell_ringer', '종지기', 12, 'golem', '#c0a060', { w: 18, h: 24, mul: 0.8 }],
  ['bronze_gargoyle', '청동 가고일', 12, 'bomber', '#b08a50', { def: 0.15 }],
  ['toll_wraith', '울림 망령', 12, 'teleporter', '#e0d0a0'],
  ['tower_knight', '종탑 기사', 12, 'shield', '#8a8aa0', { weight: 3 }],

  ['crystal_golem', '수정 골렘', 13, 'golem', '#8a8aff', { elem: { vis: 'star' } }],
  ['lost_miner', '광부 망령', 13, 'melee', '#a0a0c0', { weight: 4 }],
  ['crystal_spider', '수정 거미', 13, 'jumper', '#b0a0ff', { w: 18 }],
  ['star_wisp', '별빛 위습', 13, 'caster', '#e0e0ff', { proj: P.star('#e0e0ff') }],

  ['thorn_sprite', '가시덩굴 정령', 14, 'turret', '#6ab03a', { proj: P.lob('#a0e060', 'poison') }],
  ['sky_jelly', '하늘 해파리', 14, 'bomber', '#a0e0ff', { elem: { vis: 'thunder' } }],
  ['garden_doll', '정원사 인형', 14, 'lancer', '#e0c0a0'],
  ['feather_hunter', '깃털 사냥꾼', 14, 'archer', '#80c0a0', { proj: P.arrow('#e0f0e0') }],

  ['armillary', '혼천의', 15, 'caster', '#ffe080', { w: 16, h: 16, proj: P.orb('#ffe080', 0.04) }],
  ['astrologer', '별 점술사', 15, 'teleporter', '#a0c0ff'],
  ['clock_knight', '시계태엽 기사', 15, 'shield', '#c0a060', { def: 0.18 }],
  ['meteor_sprite', '유성 정령', 15, 'flyer', '#ff9a4a', { elem: { vis: 'fire', st: 'burn' } }],

  ['star_knight', '성좌 기사', 16, 'lancer', '#c0b0ff', { weight: 3 }],
  ['hole_eye', '블랙홀 눈', 16, 'caster', '#9a6bff', { proj: P.orb('#9a6bff', 0.05) }],
  ['star_eater', '별 포식 벌레', 16, 'jumper', '#6a5a8a', { elem: { vis: 'void' } }],
  ['ash_angel', '잿빛 천사', 16, 'teleporter', '#d0c8e0'],

  // ── 스토리 3: 핏빛 왕관 ──
  ['war_dead', '망자 병사', 21, 'melee', '#8a7a6a', { weight: 4 }],
  ['carrion_crow', '썩은 까마귀', 21, 'flyer', '#4a4a5a'],
  ['mud_golem', '진흙 골렘', 21, 'golem', '#6a5440', { elem: { vis: 'poison', st: 'poison' } }],
  ['siege_archer', '공성 궁수', 21, 'archer', '#a08a6a', { proj: P.arrow('#d0c0a0') }],

  ['vine_vampire', '포도원 흡혈귀', 22, 'teleporter', '#c04060'],
  ['blood_bat', '흡혈 박쥐', 22, 'flyer', '#c03040', { w: 14, h: 10 }],
  ['wine_slime', '포도주 슬라임', 22, 'jumper', '#8a2a5a', { elem: { vis: 'blood' } }],
  ['grape_maiden', '포도원 시녀', 22, 'gcaster', '#e080a0', { proj: P.lob('#c04080') }],

  ['jailer', '간수', 23, 'shield', '#6a6a72', { def: 0.2, weight: 3 }],
  ['chain_hound', '사슬 사냥개', 23, 'charger', '#5a5a62', { w: 20 }],
  ['torture_engine', '고문 기계', 23, 'turret', '#8a6a4a', { proj: P.blade('#c0c0c8') }],
  ['shackled', '족쇄 죄수', 23, 'melee', '#9a8a7a', { speed: 0.6, mul: 1.2 }],

  ['fallen_priest', '타락한 사제', 24, 'gcaster', '#ff6060', { proj: P.soul('#ff6060') }],
  ['blood_choir', '핏빛 성가대', 24, 'turret', '#e04050', { proj: P.orb('#ff4060') }],
  ['red_gargoyle', '붉은 가고일', 24, 'bomber', '#a03030', { def: 0.15 }],
  ['templar', '성당 기사', 24, 'lancer', '#c0a0a0'],

  ['werewolf', '늑대인간', 25, 'charger', '#6a6a5a', { w: 20, h: 16, mul: 1.3 }],
  ['trapper', '덫사냥꾼', 25, 'archer', '#7a8a5a', { proj: P.spear('#c0c0a0') }],
  ['moon_moth', '그믐 나방', 25, 'bomber', '#a0c0a0', { elem: { vis: 'poison', st: 'poison' } }],
  ['dark_dryad', '어둠 드라이어드', 25, 'teleporter', '#80c080'],

  ['crimson_guard', '핏빛 근위병', 26, 'shield', '#a02040', { def: 0.2 }],
  ['blood_mage', '혈마도사', 26, 'gcaster', '#ff3060', { proj: P.orb('#ff3060', 0.04) }],
  ['blood_hound', '혈견', 26, 'charger', '#8a1a2a', { w: 20 }],
  ['bat_swarm', '박쥐 떼', 26, 'flyer', '#6a1a2a', { w: 18, h: 14, mul: 1.2 }],

  // ── 스토리 4: 태초의 계약 ──
  ['deep_angler', '심해 아귀', 31, 'charger', '#2a6a7a', { w: 20, h: 14 }],
  ['first_crab', '태초의 게', 31, 'shield', '#d06a4a', { w: 18, h: 14, def: 0.18 }],
  ['tide_priest', '조수 사제', 31, 'gcaster', '#80ffe0', { proj: P.orb('#80ffe0', 0.03) }],
  ['sea_jelly', '심해 해파리', 31, 'bomber', '#80a0ff', { elem: { vis: 'thunder' } }],

  ['stone_treant', '석화 나무정령', 32, 'golem', '#8a8a70'],
  ['fossil_raptor', '화석 랩터', 32, 'charger', '#a09a7a'],
  ['moss_spirit', '이끼 정령', 32, 'flyer', '#9ad070'],
  ['petrified_ranger', '석화된 순찰자', 32, 'archer', '#9a9a8a', { proj: P.arrow('#d0d0b0') }],

  ['storm_harpy', '폭풍 하피', 33, 'flyer', '#80a0d0', { speed: 1.2 }],
  ['thunder_knight', '뇌전 기사', 33, 'lancer', '#c0e0ff', { elem: { vis: 'thunder' } }],
  ['spark_wisp', '번개 위습', 33, 'caster', '#e0f0ff', { proj: P.bolt('#e0f0ff') }],
  ['cloud_golem', '구름 골렘', 33, 'golem', '#c0d0e0', { elem: { vis: 'thunder' } }],

  ['mirror_double', '거울 분신', 34, 'teleporter', '#d0d0ff', { weight: 4 }],
  ['glass_shard', '유리 파편', 34, 'flyer', '#e0e8ff', { w: 12, h: 12 }],
  ['reflection_mage', '반사 마도사', 34, 'gcaster', '#ffffff', { proj: P.shard('#ffffff') }],
  ['prism_turret', '프리즘', 34, 'turret', '#c0a0ff', { proj: P.star('#ffe0ff') }],

  ['time_eater', '시간 포식자', 35, 'jumper', '#c0b070', { w: 18, elem: { vis: 'time' } }],
  ['clock_soldier', '태엽 병사', 35, 'melee', '#c0a060', { weight: 4, def: 0.1 }],
  ['hourglass_golem', '모래시계 골렘', 35, 'golem', '#e0c080', { elem: { vis: 'time' } }],
  ['echo', '메아리 잔상', 35, 'teleporter', '#ffe0a0'],

  ['pact_sentinel', '계약의 파수꾼', 36, 'shield', '#e0d0ff', { def: 0.22 }],
  ['first_soul', '최초의 혼', 36, 'bomber', '#fff0c0', { elem: { vis: 'holy' } }],
  ['origin_eye', '근원의 눈', 36, 'caster', '#fff0c0', { proj: P.soul('#fff0c0') }],
  ['arche_shade', '아르케의 그림자', 36, 'lancer', '#a090c0'],

  // ── 스토리 5: 찢어진 하늘 ──
  ['sky_pirate', '하늘 해적', 41, 'melee', '#a08a6a', { weight: 4 }],
  ['harpoon_gunner', '작살 포수', 41, 'archer', '#8aa0b0', { proj: P.spear('#d0e0f0') }],
  ['storm_gull', '폭풍 갈매기', 41, 'flyer', '#d0e0f0', { elem: { vis: 'thunder' } }],
  ['anchor_golem', '닻 골렘', 41, 'golem', '#6a7a8a', { elem: { vis: 'thunder' } }],

  ['mist_maiden', '물안개 시녀', 42, 'gcaster', '#a0f0ff', { proj: P.shard('#d0f8ff', 'chill') }],
  ['falls_crab', '폭포 게', 42, 'shield', '#4a8aa0', { w: 18, h: 14, def: 0.18 }],
  ['rain_jelly', '빗방울 해파리', 42, 'bomber', '#80d0ff', { elem: { vis: 'ice', st: 'chill' } }],
  ['torrent_monk', '급류 수도승', 42, 'teleporter', '#60a0c0'],

  ['whalebone_warrior', '고래뼈 전사', 43, 'lancer', '#d0d0c0', { weight: 4 }],
  ['barnacle_blob', '따개비 덩어리', 43, 'jumper', '#7a8a7a', { def: 0.1 }],
  ['storm_eel', '폭풍 장어', 43, 'charger', '#4a6a9a', { w: 20, elem: { vis: 'thunder' } }],
  ['marrow_wisp', '골수 위습', 43, 'caster', '#e0f0ff', { proj: P.bolt('#e0f0ff') }],

  ['feather_monk', '깃털 수도사', 44, 'melee', '#e0d0b0', { weight: 4, speed: 1 }],
  ['plume_archer', '깃털 궁수', 44, 'archer', '#c0a080', { proj: P.arrow('#fff0d0') }],
  ['temple_owl', '사원 올빼미', 44, 'flyer', '#a08a6a'],
  ['quill_turret', '깃펜 포탑', 44, 'turret', '#fff0d0', { proj: P.blade('#fff0d0') }],

  ['storm_paladin', '폭풍 성기사', 45, 'shield', '#c0d0e0', { def: 0.2, weight: 3 }],
  ['thunder_roc', '천둥 새', 45, 'bomber', '#8aa0d0', { elem: { vis: 'thunder', st: 'shock' } }],
  ['cloud_wyrm', '구름 비룡', 45, 'charger', '#c0d0f0', { w: 20, h: 16 }],
  ['gale_sorcerer', '돌풍 마법사', 45, 'gcaster', '#c0e0ff', { proj: P.bolt('#c0e0ff') }],

  ['rift_stalker', '균열 추적자', 46, 'teleporter', '#c0a0ff', { weight: 4 }],
  ['void_shard', '공허 파편', 46, 'flyer', '#e0c0ff', { w: 12, h: 12, elem: { vis: 'void' } }],
  ['torn_angel', '찢긴 천사', 46, 'lancer', '#d0c0e0'],
  ['rift_eye', '균열의 눈', 46, 'caster', '#a080ff', { proj: P.orb('#c0a0ff', 0.045) }],

  // ── 스토리 6: 바깥의 바다 ──
  ['lamp_drowned', '등불 익사자', 51, 'melee', '#6a8a8a', { weight: 4 }],
  ['lamp_jelly', '등불 해파리', 51, 'bomber', '#ffe8a0', { elem: { vis: 'holy' } }],
  ['tide_hound', '조류 사냥개', 51, 'charger', '#3a6a7a', { w: 20 }],
  ['lens_turret', '등대 렌즈', 51, 'turret', '#ffe8a0', { proj: P.bolt('#fff0c0') }],

  ['coral_bride', '산호 신부', 52, 'gcaster', '#ff90b0', { proj: P.lob('#ff90b0', 'poison') }],
  ['coral_golem', '산호 골렘', 52, 'golem', '#d06a7a', { elem: { vis: 'poison', st: 'poison' } }],
  ['grave_crab', '묘지 게', 52, 'shield', '#a0a0a0', { w: 18, h: 14, def: 0.2 }],
  ['bone_fish', '뼈 물고기', 52, 'flyer', '#e0e0d0'],

  ['trench_diver', '해구 잠수부', 53, 'lancer', '#5a6a8a', { weight: 4, def: 0.12 }],
  ['angler_eye', '해구의 눈', 53, 'caster', '#7090ff', { proj: P.orb('#7090ff', 0.04) }],
  ['abyss_worm', '심연 벌레', 53, 'jumper', '#3a3a6a', { w: 18, elem: { vis: 'void' } }],
  ['silent_monk', '침묵 수도사', 53, 'teleporter', '#4a5a7a'],

  ['inverted_citizen', '거꾸로 선 시민', 54, 'melee', '#c0a080', { weight: 4 }],
  ['city_watch', '뒤집힌 경비병', 54, 'shield', '#8a7a5a', { def: 0.2 }],
  ['gear_spider', '태엽 거미', 54, 'jumper', '#c0a060', { w: 18, elem: { vis: 'time' } }],
  ['lantern_moth', '가로등 나방', 54, 'bomber', '#ffd080', { elem: { vis: 'fire', st: 'burn' } }],

  ['aurora_wisp', '오로라 위습', 55, 'caster', '#80ffc0', { proj: P.star('#c0ffe0') }],
  ['night_raptor', '밤 랩터', 55, 'charger', '#2a3a4a', { w: 20, h: 16, mul: 1.1 }],
  ['polar_hunter', '극야 사냥꾼', 55, 'archer', '#a0c0d0', { proj: P.shard('#e0ffff', 'chill') }],
  ['frost_gargoyle', '서리 가고일', 55, 'flyer', '#80a0b0', { def: 0.15, elem: { vis: 'ice', st: 'chill' } }],

  ['outer_knight', '바깥의 기사', 56, 'shield', '#4a6a6a', { def: 0.22, weight: 3 }],
  ['herald_eye', '전령의 눈', 56, 'caster', '#a0ffe0', { proj: P.soul('#a0ffe0') }],
  ['unmade', '지워진 것', 56, 'teleporter', '#d0fff0'],
  ['outer_swarm', '바깥의 떼', 56, 'flyer', '#3a5a5a', { w: 18, h: 14, mul: 1.2 }],
];

export const STORY_ENEMIES: EnemyDef[] = ROWS.map(([id, name, theme, base, col, extra = {}]) => {
  const b = BASE[base];
  const idx = theme % 10; // 스토리 안에서 몇 번째 테마인지 (1~6)
  const f = (1 + (idx - 1) * 0.12) * (extra.mul ?? 1);
  const { mul: _m, ...rest } = extra;
  const def: EnemyDef = {
    id,
    name,
    chapter: theme,
    col,
    weight: 3,
    ...b,
    hp: Math.round(b.hp * f),
    atk: Math.round(b.atk * f),
    ...rest,
  };
  if (!def.proj && (def.ai === 'archer' || def.ai === 'caster' || def.ai === 'turret')) def.proj = def.ai === 'archer' ? P.arrow(col) : def.ai === 'turret' ? P.lob(col) : P.orb(col);
  return def;
});

/** 스토리 적 AI 확인용 (테스트) */
export const STORY_ENEMY_AIS: EnemyAI[] = [...new Set(STORY_ENEMIES.map((e) => e.ai))];
