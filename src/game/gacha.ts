import { FIXED_SHARE, GACHA, RATE_TABLE, type BannerKind } from '../data/gacha';
import type { Rarity } from './types';

/** 배너별 뽑기 기록. since5가 천장(100회) 카운트 */
export interface PityState {
  since5: number; // 마지막 ★5 이후 뽑은 횟수
  since4: number; // 마지막 ★4 이상 이후 뽑은 횟수
  guaranteed: boolean; // (구버전 저장 호환용, 사용하지 않음)
  total: number;
}

export const newPity = (): PityState => ({ since5: 0, since4: 0, guaranteed: false, total: 0 });

export interface PoolItem {
  id: string;
  rarity: Rarity;
}

export interface BannerPool {
  kind: BannerKind;
  items: PoolItem[];
  pickup5?: string[];
  pickup4?: string[];
}

export interface PullResult {
  id: string;
  rarity: Rarity;
  pickup: boolean;
  pityAt: number; // 몇 번째에 나왔는지 (★5일 때 의미)
}

/** 다음 1회의 희귀도를 결정. 100번째(천장)는 ★5 이상 확정. force4: 10연 ★4 이상 보장용. rand: [0,1) */
export function rollRarity(p: PityState, rand: () => number, force4 = false): Rarity {
  const r = rand();
  let rar: Rarity = 3;
  let acc = 0;
  for (const [k, rate] of RATE_TABLE) {
    acc += rate;
    if (r < acc) {
      rar = k;
      break;
    }
  }
  if (p.since5 + 1 >= GACHA.hardPity && rar < 5) rar = 5;
  else if (force4 && rar < 4) rar = 4;
  p.total++;
  if (rar >= 5) {
    p.since5 = 0;
    p.since4 = 0;
  } else {
    p.since5++;
    if (rar === 4) p.since4 = 0;
    else p.since4++;
  }
  return rar;
}

export function pullOnce(pool: BannerPool, p: PityState, rand: () => number, force4 = false): PullResult {
  const at = p.since5 + 1;
  let rarity = rollRarity(p, rand, force4);
  // 아직 그 등급의 영웅·무기가 없으면(★6·★7 준비 중) 있는 등급 중 가장 높은 아래 등급으로
  while (rarity > 3 && !pool.items.some((i) => i.rarity === rarity)) rarity = (rarity - 1) as Rarity;
  let candidates = pool.items.filter((i) => i.rarity === rarity);
  let pickup = false;
  if (pool.kind === 'pickup' && rarity === 5 && pool.pickup5?.length) {
    if (rand() < GACHA.pickupRate5) {
      candidates = candidates.filter((c) => pool.pickup5!.includes(c.id));
      pickup = true;
    } else {
      const others = candidates.filter((c) => !pool.pickup5!.includes(c.id));
      if (others.length) candidates = others;
      else pickup = true;
    }
  } else if (pool.kind === 'pickup' && rarity === 4 && pool.pickup4?.length) {
    if (rand() < GACHA.pickupRate4) {
      candidates = candidates.filter((c) => pool.pickup4!.includes(c.id));
      pickup = true;
    }
  }
  if (!candidates.length) candidates = pool.items.filter((i) => i.rarity === rarity);
  const it = pickShared(candidates, rand);
  return { id: it.id, rarity, pickup, pityAt: at };
}

/** 같은 등급 후보 중 하나: FIXED_SHARE가 있는 후보는 그 비율로, 나머지는 남은 비율을 똑같이 나눔 */
export function pickShared(cands: PoolItem[], rand: () => number): PoolItem {
  const fixed = cands.filter((c) => FIXED_SHARE[c.id] !== undefined);
  const rest = cands.filter((c) => FIXED_SHARE[c.id] === undefined);
  if (!fixed.length || !rest.length) return cands[Math.floor(rand() * cands.length)];
  let r = rand();
  for (const c of fixed) {
    if (r < FIXED_SHARE[c.id]) return c;
    r -= FIXED_SHARE[c.id];
  }
  return rest[Math.floor(rand() * rest.length)];
}

/** count회 뽑기. guarantee4: 10연 중 ★4 이상 보장 (마지막 장에서 강제) */
export function pullMany(pool: BannerPool, p: PityState, rand: () => number, count: number, guarantee4 = false): PullResult[] {
  const out: PullResult[] = [];
  for (let i = 0; i < count; i++) {
    const needForce = guarantee4 && i === count - 1 && !out.some((r) => r.rarity >= 4);
    out.push(pullOnce(pool, p, rand, needForce));
  }
  return out;
}
