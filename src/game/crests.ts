import { CRESTS } from '../data/crests';
import type { CrestId, Effect } from './types';

export interface CrestState {
  id: CrestId;
  count: number;
  tier: number; // 0~3 (활성 단계 수)
  next: number | null; // 다음 단계까지 필요한 총 개수
}

/** 문장 태그 목록 → 문장별 개수/활성 단계 */
export function evalCrests(tags: CrestId[]): CrestState[] {
  const counts = new Map<CrestId, number>();
  for (const t of tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  const out: CrestState[] = [];
  for (const c of CRESTS) {
    const count = counts.get(c.id) ?? 0;
    if (!count) continue;
    let tier = 0;
    for (const t of c.tiers) if (count >= t.n) tier++;
    const next = tier < 3 ? c.tiers[tier].n : null;
    out.push({ id: c.id, count, tier, next });
  }
  out.sort((a, b) => b.tier - a.tier || b.count - a.count);
  return out;
}

/** 활성화된 문장 단계의 효과를 모두 모은다 */
export function crestEffects(states: CrestState[]): Effect[] {
  const out: Effect[] = [];
  for (const s of states) {
    const def = CRESTS.find((c) => c.id === s.id)!;
    for (let i = 0; i < s.tier; i++) out.push(...def.tiers[i].effects);
  }
  return out;
}
