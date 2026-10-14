import { describe, expect, it } from 'vitest';
import { GACHA, rate5At } from '../src/data/gacha';
import { newPity, pullMany, pullOnce, type BannerPool } from '../src/game/gacha';
import { Rng } from '../src/core/rng';

const pool: BannerPool = {
  kind: 'char',
  items: [
    { id: 'a3', rarity: 3 }, { id: 'b3', rarity: 3 }, { id: 'c3', rarity: 3 },
    { id: 'a4', rarity: 4 }, { id: 'b4', rarity: 4 },
    { id: 'a5', rarity: 5 }, { id: 'b5', rarity: 5 }, { id: 'c5', rarity: 5 },
  ],
};
const pickupPool: BannerPool = { ...pool, kind: 'pickup', pickup5: ['a5'], pickup4: ['a4'] };

/** 소프트 천장 확률 곡선에서 기대 ★5 비율(=1/기대 회차) 계산 */
function expectedRate5(): number {
  let survive = 1;
  let expect = 0;
  for (let n = 1; n <= GACHA.hardPity; n++) {
    const p = rate5At(n);
    expect += n * survive * p;
    survive *= 1 - p;
  }
  return 1 / expect;
}

describe('가챠 확률 곡선', () => {
  it('기본 확률과 천장', () => {
    expect(rate5At(1)).toBeCloseTo(GACHA.rate5);
    expect(rate5At(44)).toBeCloseTo(GACHA.rate5);
    expect(rate5At(45)).toBeGreaterThan(GACHA.rate5);
    expect(rate5At(60)).toBe(1);
    for (let n = 1; n < 60; n++) expect(rate5At(n + 1)).toBeGreaterThanOrEqual(rate5At(n));
  });
});

describe('10만 회 시뮬레이션', () => {
  const N = 100_000;
  const rng = new Rng(12345);
  const p = newPity();
  let gap = 0;
  let maxGap = 0;
  let base5 = 0;
  let baseN = 0;
  let base4 = 0;
  let base4N = 0;
  let total5 = 0;
  let since4 = 0;
  let max4Gap = 0;
  for (let i = 0; i < N; i++) {
    const n5 = p.since5 + 1;
    const n4 = p.since4 + 1;
    const r = pullOnce(pool, p, () => rng.next());
    gap++;
    since4++;
    if (n5 < GACHA.softPityStart) {
      baseN++;
      if (r.rarity === 5) base5++;
      if (n4 < GACHA.pity4) {
        base4N++;
        if (r.rarity === 4) base4++;
      }
    }
    if (r.rarity >= 4) {
      max4Gap = Math.max(max4Gap, since4);
      since4 = 0;
    }
    if (r.rarity === 5) {
      total5++;
      maxGap = Math.max(maxGap, gap);
      gap = 0;
    }
  }

  it('하드 천장: 60회 이내 ★5 확정', () => {
    expect(maxGap).toBeLessThanOrEqual(60);
  });
  it('소프트 천장 이전 ★5 확률 ≈ 0.7%', () => {
    expect(Math.abs(base5 / baseN - GACHA.rate5)).toBeLessThan(GACHA.rate5 * 0.12);
  });
  it('★4 확률 ≈ 16.3%', () => {
    expect(Math.abs(base4 / base4N - GACHA.rate4)).toBeLessThan(0.006);
  });
  it('10회마다 ★4 이상 1개 보장', () => {
    expect(max4Gap).toBeLessThanOrEqual(10);
  });
  it('전체 ★5 비율이 확률 곡선의 기대값과 일치', () => {
    const exp = expectedRate5();
    expect(Math.abs(total5 / N - exp) / exp).toBeLessThan(0.05);
  });
});

describe('픽업 배너', () => {
  it('픽업 실패 후 다음 ★5는 픽업 확정, 픽업 비율 ≈ 2/3', () => {
    const rng = new Rng(777);
    const p = newPity();
    let five = 0;
    let pick = 0;
    let lastWasMiss = false;
    for (let i = 0; i < 100_000; i++) {
      const r = pullOnce(pickupPool, p, () => rng.next());
      if (r.rarity === 5) {
        five++;
        if (r.pickup) pick++;
        if (lastWasMiss) expect(r.pickup).toBe(true);
        lastWasMiss = !r.pickup;
        if (r.pickup) expect(r.id).toBe('a5');
      }
    }
    expect(Math.abs(pick / five - 2 / 3)).toBeLessThan(0.03);
  });
  it('천장 카운트는 배너별로 독립', () => {
    const a = newPity();
    const b = newPity();
    const rng = new Rng(1);
    pullMany(pool, a, () => rng.next(), 10);
    expect(a.total).toBe(10);
    expect(b.total).toBe(0);
  });
});

describe('첫 무료 10연', () => {
  it('★4 이상 확정', () => {
    for (let s = 0; s < 500; s++) {
      const rng = new Rng(s);
      const res = pullMany(pool, newPity(), () => rng.next(), 10, true);
      expect(res.some((r) => r.rarity >= 4)).toBe(true);
    }
  });
  it('항상 ★3만 나오는 난수에서도 보장', () => {
    const p = newPity();
    p.since4 = 0;
    const res = pullMany(pool, p, () => 0.999, 10, true);
    expect(res.filter((r) => r.rarity >= 4).length).toBeGreaterThanOrEqual(1);
  });
});

describe('디버그 픽업 지정', () => {
  it('지정한 픽업이 픽업 배너 풀에 반영되고, 잘못된 값은 저장 보정에서 제거', async () => {
    const { newSave, sanitize } = await import('../src/game/save');
    const { bannerPool, currentPickup } = await import('../src/game/meta');
    const s = newSave();
    s.pickupOverride = { five: 'ignia', four: ['seira', 'freya'] };
    expect(currentPickup(s).five).toBe('ignia');
    const pool = bannerPool('pickup', s);
    expect(pool.pickup5).toEqual(['ignia']);
    expect(pool.pickup4).toEqual(['seira', 'freya']);
    expect(sanitize(JSON.parse(JSON.stringify(s))).pickupOverride).toEqual(s.pickupOverride);
    expect(sanitize({ ...s, pickupOverride: { five: 'kael', four: ['seira', 'freya'] } }).pickupOverride).toBeNull();
    expect(sanitize({ ...s, pickupOverride: { five: 'ignia', four: ['seira', 'seira'] } }).pickupOverride).toBeNull();
  });
});

describe('키 설정 이전', () => {
  it('v2 저장: 대시 Q → Shift, 다른 키는 유지 / 대시를 바꿨다면 유지 / 더 오래된 버전은 기본값', async () => {
    const { sanitize } = await import('../src/game/save');
    const { DEFAULT_BINDINGS, cloneBindings } = await import('../src/core/input');
    const v2 = cloneBindings(DEFAULT_BINDINGS);
    v2.dash.keys = ['KeyQ'];
    v2.attack.keys = ['KeyL'];
    const a = sanitize({ settings: { bindVer: 2, bindings: v2 } }).settings.bindings;
    expect(a.dash.keys).toEqual(['ShiftLeft', 'ShiftRight']);
    expect(a.attack.keys).toEqual(['KeyL']);
    v2.dash.keys = ['KeyV'];
    expect(sanitize({ settings: { bindVer: 2, bindings: v2 } }).settings.bindings.dash.keys).toEqual(['KeyV']);
    expect(sanitize({ settings: { bindVer: 1, bindings: v2 } }).settings.bindings.attack.keys).toEqual(DEFAULT_BINDINGS.attack.keys);
  });
});
