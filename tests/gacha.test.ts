import { describe, expect, it } from 'vitest';
import { GACHA } from '../src/data/gacha';
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

describe('10만 회 시뮬레이션 (천장 100회)', () => {
  const N = 100_000;
  const rng = new Rng(12345);
  const p = newPity();
  let n5 = 0;
  let n4 = 0;
  let maxGap = 0;
  let gap = 0;
  for (let i = 0; i < N; i++) {
    const r = pullOnce(pool, p, () => rng.next());
    gap++;
    if (r.rarity === 5) {
      n5++;
      maxGap = Math.max(maxGap, gap);
      gap = 0;
    }
    if (r.rarity === 4) n4++;
  }
  it('★5 기본 확률 0.5%, 천장 포함 실제 비율은 기대값과 일치', () => {
    expect(GACHA.rate5).toBe(0.005);
    // 100회 천장이 있을 때 ★5 1개당 기대 뽑기 수
    let survive = 1;
    let e = 0;
    for (let n = 1; n <= GACHA.hardPity; n++) {
      const p = n >= GACHA.hardPity ? 1 : GACHA.rate5;
      e += n * survive * p;
      survive *= 1 - p;
    }
    expect(Math.abs(n5 / N - 1 / e) / (1 / e)).toBeLessThan(0.08);
  });
  it('★4 ≈ 9.5%', () => {
    expect(GACHA.rate4).toBe(0.095);
    expect(Math.abs(n4 / N - GACHA.rate4)).toBeLessThan(0.005);
  });
  it('천장: ★5 간격은 100회를 넘지 않고, 천장까지 가는 경우가 존재', () => {
    expect(GACHA.hardPity).toBe(100);
    expect(maxGap).toBeLessThanOrEqual(100);
    expect(maxGap).toBe(100);
  });
  it('항상 ★3만 나오는 난수에서도 100번째는 ★5', () => {
    const p = newPity();
    const res = pullMany(pool, p, () => 0.999, 100);
    expect(res.slice(0, 99).some((r) => r.rarity === 5)).toBe(false);
    expect(res[99].rarity).toBe(5);
    expect(p.since5).toBe(0);
  });
});

describe('픽업 배너', () => {
  it('★5 픽업 비율 ≈ 50% (픽업 확정은 없음)', () => {
    const rng = new Rng(777);
    const p = newPity();
    let five = 0;
    let pick = 0;
    let missAfterMiss = 0;
    let lastWasMiss = false;
    for (let i = 0; i < 400_000; i++) {
      const r = pullOnce(pickupPool, p, () => rng.next());
      if (r.rarity === 5) {
        five++;
        if (r.pickup) pick++;
        if (lastWasMiss && !r.pickup) missAfterMiss++;
        lastWasMiss = !r.pickup;
        if (r.pickup) expect(r.id).toBe('a5');
      }
    }
    expect(Math.abs(pick / five - 0.5)).toBeLessThan(0.04);
    expect(missAfterMiss).toBeGreaterThan(0);
  });
  it('뽑기 기록은 배너별로 독립', () => {
    const a = newPity();
    const b = newPity();
    const rng = new Rng(1);
    pullMany(pool, a, () => rng.next(), 10);
    expect(a.total).toBe(10);
    expect(b.total).toBe(0);
  });
});

describe('10연 ★4 이상 확정 (유료·무료)', () => {
  it('유료 10연도 항상 ★4 이상 1개 이상', async () => {
    const { newSave } = await import('../src/game/save');
    const { performPull } = await import('../src/game/meta');
    const s = newSave();
    s.stones = 1600 * 300;
    for (let i = 0; i < 300; i++) {
      const res = performPull(s, 'char', 10, false, () => 0.999)!;
      expect(res.some((r) => r.rarity >= 4)).toBe(true);
    }
  });
  it('1회 계약은 보장 없음', async () => {
    const { newSave } = await import('../src/game/save');
    const { performPull } = await import('../src/game/meta');
    const s = newSave();
    s.stones = 160;
    expect(performPull(s, 'char', 1, false, () => 0.999)![0].rarity).toBe(3);
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
