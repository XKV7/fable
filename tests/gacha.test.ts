import { describe, expect, it } from 'vitest';
import { GACHA, RATE_TABLE } from '../src/data/gacha';
import { newPity, pullMany, pullOnce, rollRarity, type BannerPool } from '../src/game/gacha';
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

describe('희귀도 확률표 (★7 0.01% · ★6 0.1% · ★5 0.5% · ★4 19.39% · ★3 80%)', () => {
  it('수치와 합계', () => {
    expect(RATE_TABLE).toEqual([
      [7, 0.0001],
      [6, 0.001],
      [5, 0.005],
      [4, 0.1939],
      [3, expect.closeTo(0.8, 10)],
    ]);
    expect(RATE_TABLE.reduce((a, [, p]) => a + p, 0)).toBeCloseTo(1, 10);
  });
  it('난수 구간 → 희귀도', () => {
    const at = (r: number) => rollRarity(newPity(), () => r);
    expect(at(0.00005)).toBe(7);
    expect(at(0.0005)).toBe(6);
    expect(at(0.003)).toBe(5);
    expect(at(0.1)).toBe(4);
    expect(at(0.5)).toBe(3);
  });
  it('★6·★7 영웅이 있는 풀: 실제 비율과 천장 초기화', () => {
    const full: BannerPool = { kind: 'char', items: [...pool.items, { id: 'a6', rarity: 6 }, { id: 'a7', rarity: 7 }] };
    const rng = new Rng(9);
    const p = newPity();
    const n = { 6: 0, 7: 0 };
    const N = 1_000_000;
    for (let i = 0; i < N; i++) {
      const r = pullOnce(full, p, () => rng.next());
      if (r.rarity === 6 || r.rarity === 7) {
        n[r.rarity]++;
        expect(p.since5).toBe(0);
      }
    }
    expect(Math.abs(n[6] / N - 0.001) / 0.001).toBeLessThan(0.15);
    expect(Math.abs(n[7] / N - 0.0001) / 0.0001).toBeLessThan(0.35);
  });
  it('★6·★7 준비 중(풀에 없음)이면 ★5로 대체', () => {
    expect(pullOnce(pool, newPity(), () => 0.00005).rarity).toBe(5);
    expect(pullOnce(pool, newPity(), () => 0.0005).rarity).toBe(5);
  });
});

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
    if (r.rarity >= 5) {
      n5++;
      maxGap = Math.max(maxGap, gap);
      gap = 0;
    }
    if (r.rarity === 4) n4++;
  }
  it('★5 이상(준비 중인 ★6·★7은 ★5로) 0.61%, 천장 포함 실제 비율은 기대값과 일치', () => {
    expect(GACHA.rate5).toBe(0.005);
    const top = GACHA.rate5 + GACHA.rate6 + GACHA.rate7;
    // 100회 천장이 있을 때 ★5 1개당 기대 뽑기 수
    let survive = 1;
    let e = 0;
    for (let n = 1; n <= GACHA.hardPity; n++) {
      const p = n >= GACHA.hardPity ? 1 : top;
      e += n * survive * p;
      survive *= 1 - p;
    }
    expect(Math.abs(n5 / N - 1 / e) / (1 / e)).toBeLessThan(0.08);
  });
  it('★4 ≈ 19.39%', () => {
    expect(GACHA.rate4).toBe(0.1939);
    expect(Math.abs(n4 / N - GACHA.rate4)).toBeLessThan(0.006);
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
