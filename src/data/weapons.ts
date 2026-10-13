import type { WeaponDef } from '../game/types';

/**
 * 무기 24종. 효과 수치는 재련 단계마다 scale 비율만큼 증가 (desc의 {v}는 1단계 기준 수치에 재련 배율을 곱한 값).
 * 재련 배율 = 1 + scale × (재련-1)
 */
export const WEAPONS: WeaponDef[] = [
  // ★3
  { id: 'rusty_blade', name: '녹슨 장검', rarity: 3, atk: 4, icon: 'sword', col: '#b8a890', scale: 0.25, desc: '공격력 +{v}%', effects: [{ stats: { atk: 0.1 } }] },
  { id: 'hunter_knife', name: '사냥꾼의 단도', rarity: 3, atk: 3, icon: 'dagger', col: '#c0c8d0', scale: 0.25, desc: '치명타 확률 +{v}%', effects: [{ stats: { crit: 0.08 } }] },
  { id: 'ember_club', name: '불씨 곤봉', rarity: 3, crest: ['flame'], atk: 4, icon: 'hammer', col: '#e07a3a', scale: 0.25, desc: '공격 시 {v}% 확률로 화상', effects: [{ on: 'hit', chance: 0.12, do: [{ k: 'status', s: 'burn' }] }] },
  { id: 'thorn_whip', name: '가시 채찍', rarity: 3, crest: ['blood'], atk: 3, icon: 'whip', col: '#a03040', scale: 0.25, desc: '공격 시 {v}% 확률로 출혈', effects: [{ on: 'hit', chance: 0.15, do: [{ k: 'status', s: 'bleed' }] }] },
  { id: 'viper_fang', name: '독니 단검', rarity: 3, crest: ['venom'], atk: 3, icon: 'dagger', col: '#70c040', scale: 0.25, desc: '공격 시 {v}% 확률로 독', effects: [{ on: 'hit', chance: 0.2, do: [{ k: 'status', s: 'poison' }] }] },
  { id: 'gale_gloves', name: '바람깃 장갑', rarity: 3, crest: ['swift'], atk: 2, icon: 'glove', col: '#70e0a0', scale: 0.25, desc: '이동 속도 +{v}%, 공격 속도 +8%', effects: [{ stats: { mspd: 0.12, aspd: 0.08 } }] },
  { id: 'grave_shovel', name: '묘지기의 삽', rarity: 3, crest: ['soul'], atk: 4, icon: 'shovel', col: '#8a8a7a', scale: 0.25, desc: '처치 시 체력 {v}% 회복', effects: [{ on: 'kill', do: [{ k: 'heal', v: 0.02 }] }] },
  { id: 'tower_sword', name: '철판 방패검', rarity: 3, crest: ['ward'], atk: 3, icon: 'shield', col: '#a0a8b8', scale: 0.25, desc: '받는 피해 -{v}%, 방 입장 시 보호막 8%', effects: [{ stats: { dmgTaken: -0.1 } }, { on: 'roomStart', do: [{ k: 'shield', v: 0.08 }] }] },
  { id: 'frost_awl', name: '서리 송곳', rarity: 3, crest: ['frost'], atk: 3, icon: 'spear', col: '#a0e0ff', scale: 0.25, desc: '공격 시 {v}% 확률로 냉기', effects: [{ on: 'hit', chance: 0.14, do: [{ k: 'status', s: 'chill' }] }] },
  // ★4
  { id: 'quake_blade', name: '진동 대검', rarity: 4, crest: ['fury'], atk: 7, icon: 'sword', col: '#d0a060', scale: 0.2, desc: '콤보 마지막 타격 시 충격파 (공격력 {v}%)', effects: [{ on: 'finisher', do: [{ k: 'wave', m: 0.9 }] }] },
  { id: 'blood_thirst', name: '피의 갈증', rarity: 4, crest: ['blood'], atk: 6, icon: 'axe', col: '#d02040', scale: 0.2, desc: '처치 시 체력 {v}% 회복, 공격력 +8%', effects: [{ on: 'kill', do: [{ k: 'heal', v: 0.04 }] }, { stats: { atk: 0.08 } }] },
  { id: 'thunder_pike', name: '뇌명창', rarity: 4, crest: ['storm'], atk: 6, icon: 'spear', col: '#80d0ff', scale: 0.2, desc: '공격 시 {v}% 확률로 연쇄 번개', effects: [{ on: 'hit', chance: 0.14, icd: 0.25, do: [{ k: 'chain', n: 3, m: 0.6 }] }] },
  { id: 'shadow_fang', name: '그림자 송곳니', rarity: 4, crest: ['shadow'], atk: 6, icon: 'dagger', col: '#9a6bff', scale: 0.2, desc: '대시 후 3초간 공격력 +{v}%', effects: [{ on: 'dash', do: [{ k: 'buff', id: 'sfang', stats: { atk: 0.35 }, dur: 3 }] }] },
  { id: 'relay_token', name: '교대자의 증표', rarity: 4, crest: ['swift'], atk: 5, icon: 'orb', col: '#6dffb0', scale: 0.2, desc: '교대 공격 피해 +{v}%, 교대 쿨타임 -15%', effects: [{ stats: { swapDmg: 1, swapCdr: 0.15 } }] },
  { id: 'berserker_axe', name: '광전사의 도끼', rarity: 4, crest: ['fury'], atk: 8, icon: 'axe', col: '#ff5030', scale: 0.2, desc: '체력 50% 이하일 때 공격력 +{v}%, 공격 속도 +10%', effects: [{ cond: 'lowHp', stats: { atk: 0.4 } }, { stats: { aspd: 0.1 } }] },
  { id: 'soul_reaper', name: '영혼 수확자', rarity: 4, crest: ['soul'], atk: 6, icon: 'scythe', col: '#9ef0ff', scale: 0.2, desc: '처치 시 스킬 쿨타임 {v}초 감소', effects: [{ on: 'kill', do: [{ k: 'cdr', v: 0.6 }] }] },
  { id: 'pyre_staff', name: '화장터 지팡이', rarity: 4, crest: ['flame', 'soul'], atk: 6, icon: 'staff', col: '#ff8a3a', scale: 0.2, desc: '스킬 피해 +{v}%, 스킬 적중 시 화상', effects: [{ stats: { skillDmg: 0.25 } }, { on: 'skillHit', do: [{ k: 'status', s: 'burn' }] }] },
  { id: 'rime_saber', name: '상고대 군도', rarity: 4, crest: ['frost'], atk: 6, icon: 'sword', col: '#a8e4ff', scale: 0.2, desc: '빙결 대상 피해 +{v}%, 치명타 시 냉기 2중첩', effects: [{ stats: { vsFrozen: 0.4 } }, { on: 'crit', do: [{ k: 'status', s: 'chill', n: 2 }] }] },
  // ★5
  { id: 'eternis', name: '망자의 왕검 「에테르니스」', rarity: 5, crest: ['soul', 'shadow'], atk: 12, icon: 'sword', col: '#c8a8ff', scale: 0.15, desc: '처치 시 적의 영혼이 칼날 3개로 변해 추적 공격 (공격력 {v}%). 공격력 +15%', effects: [{ on: 'kill', do: [{ k: 'proj', p: { spr: 'blade', spd: 5, life: 80, w: 10, h: 6, home: 0.35, col: '#c8a8ff', el: 'shadow', pierce: 1 }, m: 0.9, n: 3 }] }, { stats: { atk: 0.15 } }] },
  { id: 'storm_heart', name: '폭풍의 심장', rarity: 5, crest: ['storm'], atk: 11, icon: 'orb', col: '#7fd8ff', scale: 0.15, desc: '공격 시 25% 확률로 연쇄 번개 (공격력 {v}%), 감전 대상 피해 +30%', effects: [{ on: 'hit', chance: 0.25, icd: 0.15, do: [{ k: 'chain', n: 4, m: 0.7 }] }, { stats: { vsShock: 0.3 } }] },
  { id: 'volcania', name: '화산검 「볼카니아」', rarity: 5, crest: ['flame', 'fury'], atk: 12, icon: 'sword', col: '#ff6a2a', scale: 0.15, desc: '모든 공격이 화상을 부여. 화상 대상 처치 시 폭발 (공격력 {v}%)', effects: [{ on: 'hit', do: [{ k: 'status', s: 'burn' }] }, { flags: { burnSpread: 1.5 } }] },
  { id: 'chrono_glass', name: '시간의 모래시계', rarity: 5, crest: ['swift', 'soul'], atk: 10, icon: 'hourglass', col: '#ffe8a0', scale: 0.15, desc: '교대 시 2초간 적의 시간이 느려진다. 교대 쿨타임 -{v}%', effects: [{ on: 'swap', do: [{ k: 'slowTime', dur: 2 }] }, { stats: { swapCdr: 0.4, swapDmg: 0.3 } }] },
  { id: 'blood_sovereign', name: '피의 군주', rarity: 5, crest: ['blood'], atk: 12, icon: 'axe', col: '#ff2050', scale: 0.15, desc: '치명타 피해 +{v}%. 치명타 시 출혈 3중첩, 출혈 5중첩 시 파열', effects: [{ stats: { critDmg: 0.5, crit: 0.08 } }, { on: 'crit', do: [{ k: 'status', s: 'bleed', n: 3 }] }, { flags: { bleedRupture: 2.5 } }] },
  { id: 'chaos_star', name: '혼돈의 별', rarity: 5, crest: ['soul', 'storm'], atk: 11, icon: 'orb', col: '#ffd0ff', scale: 0.15, desc: '4초마다 가장 가까운 적에게 운석 낙하 (공격력 {v}%). 스킬 피해 +30%', effects: [{ on: 'interval', every: 4, do: [{ k: 'meteor', m: 3 }] }, { stats: { skillDmg: 0.3 } }] },
];

export const WEAPON_MAP: Record<string, WeaponDef> = Object.fromEntries(WEAPONS.map((w) => [w.id, w]));

/** desc의 {v}에 들어갈 대표 수치: 첫 번째 효과의 대표값 × 재련 배율 */
export function weaponDesc(w: WeaponDef, refine: number): string {
  const mult = 1 + w.scale * (refine - 1);
  const first = w.effects[0];
  let base = 0;
  if (first.stats) base = Object.values(first.stats)[0] ?? 0;
  else if (first.chance) base = first.chance;
  else if (first.do?.length) {
    const d = first.do[0];
    if ('m' in d) base = d.m;
    else if ('v' in d) base = d.v;
    else if ('dur' in d) base = 0;
  }
  if (w.id === 'chrono_glass') base = 0.4;
  const isSec = w.id === 'soul_reaper';
  const shown = isSec ? (base * mult).toFixed(1) : String(Math.round(base * mult * 100));
  return w.desc.replace('{v}', shown);
}
