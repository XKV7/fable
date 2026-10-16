import { GACHA, type BannerKind } from '../data/gacha';
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

/** 다음 1회의 희귀도를 결정. 100번째(천장)는 ★5 확정. force4: 10연 ★4 이상 보장용. rand: [0,1) */
export function rollRarity(p: PityState, rand: () => number, force4 = false): Rarity {
  const r = rand();
  let rar: Rarity;
  if (p.since5 + 1 >= GACHA.hardPity || r < GACHA.rate5) rar = 5;
  else if (force4 || r < GACHA.rate5 + GACHA.rate4) rar = 4;
  else rar = 3;
  p.total++;
  if (rar === 5) {
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
  const rarity = rollRarity(p, rand, force4);
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
  const it = candidates[Math.floor(rand() * candidates.length)];
  return { id: it.id, rarity, pickup, pityAt: at };
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
