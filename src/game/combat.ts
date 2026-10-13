import type { Stats, StatusId } from './types';

export interface DamageInput {
  base: number; // 공격자 기본 공격력
  mult: number; // 기술 배율
  stats: Stats; // 공격자 스탯 합계
  kind: 'normal' | 'skill' | 'swap' | 'finisher' | 'air' | 'dash' | 'dot' | 'proc';
  critRoll: number; // [0,1)
  varRoll: number; // [0,1) 피해 변동
  target: { def: number; statuses: Partial<Record<StatusId, number>>; boss: boolean; elite: boolean; vuln?: number };
  canCrit?: boolean;
  extraBonus?: number;
}

export interface DamageOut {
  dmg: number;
  crit: boolean;
}

const s = (st: Stats, k: keyof Stats): number => st[k] ?? 0;

/** 데미지 공식: 기본 × (1+공격%) × 배율 × (1+피해증가 합) × 치명 × (1-방어) × 감전취약 × 변동(±5%) */
export function computeDamage(i: DamageInput): DamageOut {
  const st = i.stats;
  const atk = i.base * Math.max(0.1, 1 + s(st, 'atk'));
  let bonus = s(st, 'allDmg') + (i.extraBonus ?? 0);
  if (i.kind === 'skill') bonus += s(st, 'skillDmg');
  if (i.kind === 'swap') bonus += s(st, 'swapDmg');
  if (i.kind === 'finisher') bonus += s(st, 'finDmg');
  if (i.kind === 'air') bonus += s(st, 'airDmg');
  if (i.kind === 'dash') bonus += s(st, 'dashDmg');
  if (i.kind === 'dot') bonus += s(st, 'dotDmg');
  const t = i.target;
  if (t.boss) bonus += s(st, 'bossDmg');
  if (t.elite) bonus += s(st, 'eliteDmg');
  if (t.statuses.burn) bonus += s(st, 'vsBurn');
  if (t.statuses.bleed) bonus += s(st, 'vsBleed');
  if (t.statuses.poison) bonus += s(st, 'vsPoison');
  if (t.statuses.shock) bonus += s(st, 'vsShock');
  if (t.statuses.freeze) bonus += s(st, 'vsFrozen');
  let dmg = atk * i.mult * Math.max(0.1, 1 + bonus);
  const canCrit = i.canCrit ?? i.kind !== 'dot';
  const critChance = Math.min(1, Math.max(0, 0.05 + s(st, 'crit')));
  const crit = canCrit && i.critRoll < critChance;
  if (crit) dmg *= 1.5 + s(st, 'critDmg');
  dmg *= 1 - Math.min(0.8, Math.max(0, t.def));
  if (t.statuses.shock) dmg *= 1.15;
  if (t.vuln) dmg *= 1 + t.vuln;
  dmg *= 0.95 + i.varRoll * 0.1;
  return { dmg: Math.max(1, Math.round(dmg)), crit };
}

/** 받는 피해 계산 (플레이어) */
export function computeTaken(raw: number, stats: Stats, curseLevel: number): number {
  const mult = Math.max(0.2, 1 + s(stats, 'dmgTaken')) * (1 + curseLevel * 0.12);
  return Math.max(1, Math.round(raw * mult));
}

/** 스탯 합산 */
export function addStats(into: Stats, add: Stats | undefined, mult = 1): Stats {
  if (!add) return into;
  for (const k of Object.keys(add) as (keyof Stats)[]) into[k] = (into[k] ?? 0) + (add[k] ?? 0) * mult;
  return into;
}

/** 캐릭터 레벨/각성에 따른 공격력 */
export function charAtk(baseAtk: number, level: number, weaponAtk: number): number {
  return Math.round(baseAtk * (1 + (level - 1) * 0.06) + weaponAtk);
}
export function charHp(baseHp: number, level: number): number {
  return Math.round(baseHp * (1 + (level - 1) * 0.04));
}
