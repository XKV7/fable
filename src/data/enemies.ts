import type { FieldVis, ProjDef, StatusId } from '../game/types';

export type EnemyAI = 'boss' | 'melee' | 'archer' | 'flyer' | 'jumper' | 'charger' | 'turret' | 'shield' | 'teleporter' | 'caster' | 'bomber' | 'lancer' | 'golem' | 'dummy';

export interface EnemyDef {
  id: string;
  name: string;
  chapter: number; // 0 = 공용/훈련
  ai: EnemyAI;
  hp: number;
  atk: number;
  speed: number;
  w: number;
  h: number;
  def?: number;
  range: number; // 공격 개시 거리
  windup: number; // 예고 프레임
  cd: number; // 공격 후 대기 프레임
  proj?: ProjDef;
  flying?: boolean;
  kbRes: number; // 넉백 저항 0~1
  gold: number;
  col: string; // 대표 색 (파티클)
  eliteSkill: 'shockwave' | 'volley' | 'summon' | 'blink' | 'enrage' | 'nova';
  weight: number; // 출현 가중치
  elem?: { vis: FieldVis; st?: StatusId }; // 충격파/장판 속성 (기본: 화염/독)
}

/**
 * 난이도 조정 (전 적 공통). 원본 수치에 곱해진다.
 * hp·atk 2배, 공격 후 대기 20% 단축, 이동 12% 가속. 예고(windup)는 그대로 둬서 반응 시간은 유지.
 */
export const ENEMY_TUNE = { hp: 2, atk: 2, cd: 0.8, speed: 1.12 };

/** 일반 적 (챕터별 4종). 모든 공격은 windup 프레임 동안 예고 동작(번쩍임 + 느낌표)을 보인다. */
const RAW_ENEMIES: EnemyDef[] = [
  // ── 1장: 무너진 묘소 ──
  { id: 'skeleton', name: '해골 병사', chapter: 1, ai: 'melee', hp: 70, atk: 7, speed: 0.75, w: 12, h: 22, range: 26, windup: 32, cd: 60, kbRes: 0, gold: 4, col: '#e8e0c8', eliteSkill: 'shockwave', weight: 4 },
  { id: 'bone_archer', name: '해골 궁수', chapter: 1, ai: 'archer', hp: 50, atk: 6, speed: 0.6, w: 12, h: 22, range: 170, windup: 40, cd: 100, kbRes: 0, gold: 5, col: '#d8d0b0', eliteSkill: 'volley', weight: 3, proj: { spr: 'arrow', spd: 3.4, life: 120, w: 10, h: 4, col: '#d8d0b0' } },
  { id: 'wraith', name: '방황하는 망령', chapter: 1, ai: 'flyer', hp: 55, atk: 7, speed: 0.9, w: 14, h: 16, range: 90, windup: 34, cd: 90, flying: true, kbRes: 0.2, gold: 5, col: '#80e0ff', eliteSkill: 'blink', weight: 3 },
  { id: 'bone_shield', name: '뼈 방패병', chapter: 1, ai: 'shield', hp: 110, atk: 9, speed: 0.55, w: 14, h: 22, def: 0.1, range: 28, windup: 34, cd: 70, kbRes: 0.5, gold: 7, col: '#c8c0a0', eliteSkill: 'enrage', weight: 2 },
  // ── 2장: 독버섯 지하수로 ──
  { id: 'slime', name: '부패 슬라임', chapter: 2, ai: 'jumper', hp: 90, atk: 12, speed: 1.4, w: 16, h: 12, range: 110, windup: 26, cd: 70, kbRes: 0.1, gold: 6, col: '#8bdc3a', eliteSkill: 'summon', weight: 4 },
  { id: 'venom_bug', name: '독충', chapter: 2, ai: 'charger', hp: 80, atk: 13, speed: 0.7, w: 18, h: 10, range: 140, windup: 34, cd: 80, kbRes: 0.2, gold: 6, col: '#a0c040', eliteSkill: 'enrage', weight: 3 },
  { id: 'spore_cap', name: '포자 버섯', chapter: 2, ai: 'turret', hp: 85, atk: 11, speed: 0, w: 16, h: 18, range: 200, windup: 40, cd: 110, kbRes: 1, gold: 6, col: '#c060a0', eliteSkill: 'volley', weight: 3, proj: { spr: 'spore', spd: 2.6, vy: -3.2, grav: 0.1, life: 140, w: 8, h: 8, col: '#c0f060', st: 'poison' } },
  { id: 'moth', name: '독가루 나방', chapter: 2, ai: 'bomber', hp: 60, atk: 10, speed: 1.0, w: 16, h: 12, range: 30, windup: 30, cd: 90, flying: true, kbRes: 0.2, gold: 6, col: '#e0c060', eliteSkill: 'nova', weight: 2 },
  // ── 3장: 불타는 왕실 대장간 ──
  { id: 'fire_sprite', name: '불꽃 정령', chapter: 3, ai: 'caster', hp: 90, atk: 14, speed: 0.9, w: 14, h: 14, range: 160, windup: 36, cd: 100, flying: true, kbRes: 0.2, gold: 8, col: '#ff8a3a', eliteSkill: 'volley', weight: 3, proj: { spr: 'fireball', spd: 3, life: 120, w: 10, h: 10, col: '#ff7a2a', st: 'burn' } },
  { id: 'magma_golem', name: '용암 골렘', chapter: 3, ai: 'golem', hp: 260, atk: 20, speed: 0.45, w: 24, h: 28, def: 0.15, range: 40, windup: 46, cd: 90, kbRes: 0.85, gold: 14, col: '#ff5a1a', eliteSkill: 'shockwave', weight: 2 },
  { id: 'forge_hound', name: '용광로 사냥개', chapter: 3, ai: 'charger', hp: 120, atk: 16, speed: 1.0, w: 20, h: 12, range: 150, windup: 30, cd: 70, kbRes: 0.2, gold: 9, col: '#ff9a4a', eliteSkill: 'enrage', weight: 3 },
  { id: 'smith_skel', name: '대장장이 해골', chapter: 3, ai: 'melee', hp: 140, atk: 17, speed: 0.7, w: 14, h: 22, range: 30, windup: 32, cd: 64, kbRes: 0.3, gold: 9, col: '#d0a080', eliteSkill: 'shockwave', weight: 3 },
  // ── 4장: 끝없는 왕좌 ──
  { id: 'royal_guard', name: '왕실 근위 기사', chapter: 4, ai: 'shield', hp: 240, atk: 20, speed: 0.6, w: 16, h: 24, def: 0.2, range: 32, windup: 30, cd: 60, kbRes: 0.6, gold: 12, col: '#a0a0c0', eliteSkill: 'enrage', weight: 3 },
  { id: 'shade', name: '그림자', chapter: 4, ai: 'teleporter', hp: 150, atk: 18, speed: 1.0, w: 12, h: 22, range: 28, windup: 26, cd: 80, kbRes: 0.1, gold: 11, col: '#9a6bff', eliteSkill: 'blink', weight: 3 },
  { id: 'shadow_mage', name: '그림자 마도사', chapter: 4, ai: 'caster', hp: 140, atk: 17, speed: 0.6, w: 12, h: 22, range: 170, windup: 40, cd: 110, kbRes: 0.1, gold: 12, col: '#7a4aff', eliteSkill: 'summon', weight: 2, proj: { spr: 'orb', spd: 2.6, life: 160, w: 10, h: 10, col: '#a080ff', home: 0.04 } },
  { id: 'royal_lancer', name: '왕실 창병', chapter: 4, ai: 'lancer', hp: 180, atk: 21, speed: 0.75, w: 14, h: 24, def: 0.1, range: 70, windup: 32, cd: 70, kbRes: 0.4, gold: 12, col: '#c0a060', eliteSkill: 'shockwave', weight: 3 },
  // ── 침몰한 항구 (2장 분기) ──
  { id: 'drowned', name: '익사한 선원', chapter: 5, ai: 'melee', hp: 95, atk: 12, speed: 0.8, w: 12, h: 22, range: 28, windup: 28, cd: 60, kbRes: 0, gold: 6, col: '#70b0a0', eliteSkill: 'shockwave', weight: 4 },
  { id: 'harpooner', name: '작살잡이', chapter: 5, ai: 'archer', hp: 70, atk: 11, speed: 0.6, w: 12, h: 22, range: 180, windup: 38, cd: 100, kbRes: 0, gold: 6, col: '#c0d0d8', eliteSkill: 'volley', weight: 3, proj: { spr: 'spear', spd: 4, life: 110, w: 18, h: 4, col: '#c0d0d8' } },
  { id: 'gull', name: '망령 갈매기', chapter: 5, ai: 'flyer', hp: 60, atk: 10, speed: 1.1, w: 14, h: 12, range: 100, windup: 30, cd: 80, flying: true, kbRes: 0.2, gold: 6, col: '#d0e0f0', eliteSkill: 'blink', weight: 3 },
  { id: 'crab', name: '갑각 게 병사', chapter: 5, ai: 'shield', hp: 130, atk: 13, speed: 0.6, w: 18, h: 14, def: 0.15, range: 30, windup: 32, cd: 70, kbRes: 0.5, gold: 8, col: '#e06040', eliteSkill: 'enrage', weight: 2 },
  // ── 얼어붙은 왕립 도서관 (4장) ──
  { id: 'tome', name: '떠도는 마도서', chapter: 6, ai: 'caster', hp: 95, atk: 14, speed: 0.9, w: 14, h: 12, range: 170, windup: 34, cd: 100, flying: true, kbRes: 0.2, gold: 9, col: '#a8e4ff', eliteSkill: 'volley', weight: 3, proj: { spr: 'shard', spd: 3.4, life: 120, w: 10, h: 6, col: '#a8e4ff', st: 'chill' } },
  { id: 'frost_librarian', name: '서리 사서', chapter: 6, ai: 'golem', hp: 210, atk: 18, speed: 0.5, w: 16, h: 24, def: 0.1, range: 42, windup: 42, cd: 90, kbRes: 0.7, gold: 12, col: '#a8e4ff', eliteSkill: 'shockwave', weight: 2, elem: { vis: 'ice', st: 'chill' } },
  { id: 'mimic', name: '서가 미믹', chapter: 6, ai: 'charger', hp: 140, atk: 16, speed: 0.6, w: 20, h: 18, range: 150, windup: 30, cd: 70, kbRes: 0.4, gold: 11, col: '#8a5a3a', eliteSkill: 'enrage', weight: 3 },
  { id: 'ink_shade', name: '잉크 그림자', chapter: 6, ai: 'teleporter', hp: 130, atk: 16, speed: 0.9, w: 12, h: 22, range: 28, windup: 26, cd: 80, kbRes: 0.1, gold: 10, col: '#3a4a8a', eliteSkill: 'blink', weight: 3 },
  // ── 망각의 심연 (6장, 진엔딩) ──
  { id: 'void_eye', name: '망각의 눈', chapter: 7, ai: 'caster', hp: 120, atk: 17, speed: 0.8, w: 14, h: 14, range: 180, windup: 34, cd: 95, flying: true, kbRes: 0.2, gold: 13, col: '#ff80d0', eliteSkill: 'volley', weight: 3, proj: { spr: 'orb', spd: 2.8, life: 160, w: 10, h: 10, col: '#ff80d0', home: 0.04 } },
  { id: 'void_knight', name: '공허 기사', chapter: 7, ai: 'shield', hp: 230, atk: 20, speed: 0.65, w: 16, h: 24, def: 0.2, range: 32, windup: 28, cd: 60, kbRes: 0.6, gold: 14, col: '#9a6bff', eliteSkill: 'enrage', weight: 3 },
  { id: 'devourer', name: '기억 포식자', chapter: 7, ai: 'jumper', hp: 170, atk: 20, speed: 1.5, w: 18, h: 14, range: 120, windup: 24, cd: 65, kbRes: 0.2, gold: 13, col: '#c050c0', eliteSkill: 'summon', weight: 3, elem: { vis: 'void' } },
  { id: 'lost_soul', name: '잊힌 혼', chapter: 7, ai: 'bomber', hp: 90, atk: 16, speed: 1.1, w: 14, h: 14, range: 30, windup: 28, cd: 85, flying: true, kbRes: 0.2, gold: 12, col: '#e0c0ff', eliteSkill: 'nova', weight: 2, elem: { vis: 'void' } },
  // 훈련용
  { id: 'dummy', name: '훈련용 허수아비', chapter: 0, ai: 'dummy', hp: 999999, atk: 0, speed: 0, w: 14, h: 24, range: 0, windup: 0, cd: 0, kbRes: 1, gold: 0, col: '#c0a060', eliteSkill: 'enrage', weight: 0 },
];

export const ENEMIES: EnemyDef[] = RAW_ENEMIES.map((e) =>
  e.ai === 'dummy'
    ? e
    : { ...e, hp: Math.round(e.hp * ENEMY_TUNE.hp), atk: Math.round(e.atk * ENEMY_TUNE.atk), cd: Math.round(e.cd * ENEMY_TUNE.cd), speed: e.speed * ENEMY_TUNE.speed },
);

export const ENEMY_MAP: Record<string, EnemyDef> = Object.fromEntries(ENEMIES.map((e) => [e.id, e]));

/** 진행 단계(1~6장)별 체력/공격 배율 (보스·정예 제외 일반 적) */
export const CHAPTER_SCALE = [1, 1, 1.35, 1.75, 2.1, 2.45, 2.9];
export const ELITE_MULT = { hp: 3.2, atk: 1.4, size: 1.3 };
