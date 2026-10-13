import { describe, expect, it } from 'vitest';
import { evalCrests, crestEffects } from '../src/game/crests';
import { CRESTS } from '../src/data/crests';
import { RELICS } from '../src/data/relics';

describe('문장 세트 판정', () => {
  it('개수에 따른 단계', () => {
    const s = evalCrests(['flame', 'flame', 'storm', 'flame', 'flame', 'storm', 'shadow']);
    const flame = s.find((x) => x.id === 'flame')!;
    const storm = s.find((x) => x.id === 'storm')!;
    const shadow = s.find((x) => x.id === 'shadow')!;
    expect(flame.count).toBe(4);
    expect(flame.tier).toBe(2);
    expect(flame.next).toBe(6);
    expect(storm.tier).toBe(1);
    expect(shadow.tier).toBe(0);
    expect(shadow.next).toBe(2);
  });
  it('6개 이상은 최대 단계', () => {
    const s = evalCrests(Array(8).fill('ward'));
    expect(s[0].tier).toBe(3);
    expect(s[0].next).toBeNull();
  });
  it('활성 단계 효과만 수집', () => {
    const s = evalCrests(['fury', 'fury']);
    const eff = crestEffects(s);
    expect(eff).toEqual(CRESTS.find((c) => c.id === 'fury')!.tiers[0].effects);
    expect(crestEffects(evalCrests(['fury']))).toEqual([]);
  });
  it('문장 8종 이상, 유물 40종 이상, 모든 유물이 1~2개 문장', () => {
    expect(CRESTS.length).toBeGreaterThanOrEqual(8);
    expect(RELICS.length).toBeGreaterThanOrEqual(40);
    for (const r of RELICS) {
      expect(r.crest.length).toBeGreaterThanOrEqual(1);
      expect(r.crest.length).toBeLessThanOrEqual(2);
    }
    expect(new Set(RELICS.map((r) => r.id)).size).toBe(RELICS.length);
  });
});
