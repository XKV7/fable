import { GACHA, rate5At, type BannerKind } from '../data/gacha';
import type { Rarity } from './types';

export interface PityState {
  since5: number; // 마지막 ★5 이후 뽑은 횟수
  since4: number; // 마지막 ★4 이상 이후 뽑은 횟수
  guaranteed: boolean; // 픽업 배너: 다음 ★5 픽업 확정
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

/** 다음 1회의 희귀도를 결정 (천장 상태 갱신 포함). rand: [0,1) */
export function rollRarity(p: PityState, rand: () => number, force4 = false): Rarity {
  const n5 = p.since5 + 1;
  const n4 = p.since4 + 1;
  const r = rand();
  const r5 = rate5At(n5);
  let rar: Rarity;
  if (r < r5) rar = 5;
  else if (n4 >= GACHA.pity4 || force4) rar = 4;
  else if (r < r5 + GACHA.rate4) rar = 4;
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
    if (p.guaranteed || rand() < GACHA.pickupRate5) {
      candidates = candidates.filter((c) => pool.pickup5!.includes(c.id));
      pickup = true;
      p.guaranteed = false;
    } else {
      const others = candidates.filter((c) => !pool.pickup5!.includes(c.id));
      if (others.length) candidates = others;
      else pickup = true;
      p.guaranteed = !pickup;
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

/** count회 뽑기. guarantee4: 10연 중 ★4 이상 보장(첫 무료 10연 등) */
export function pullMany(pool: BannerPool, p: PityState, rand: () => number, count: number, guarantee4 = false): PullResult[] {
  const out: PullResult[] = [];
  for (let i = 0; i < count; i++) {
    const needForce = guarantee4 && i === count - 1 && !out.some((r) => r.rarity >= 4);
    out.push(pullOnce(pool, p, rand, needForce));
  }
  return out;
}
