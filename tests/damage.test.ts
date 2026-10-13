import { describe, expect, it } from 'vitest';
import { computeDamage, computeTaken, addStats, charAtk } from '../src/game/combat';

const tgt = { def: 0, statuses: {}, boss: false, elite: false };

describe('데미지 계산', () => {
  it('기본 공식', () => {
    const r = computeDamage({ base: 100, mult: 1, stats: {}, kind: 'normal', critRoll: 0.99, varRoll: 0.5, target: tgt });
    expect(r.dmg).toBe(100);
    expect(r.crit).toBe(false);
  });
  it('공격력%와 배율', () => {
    const r = computeDamage({ base: 100, mult: 2, stats: { atk: 0.5 }, kind: 'normal', critRoll: 0.99, varRoll: 0.5, target: tgt });
    expect(r.dmg).toBe(300);
  });
  it('치명타: 기본 5% + 1.5배', () => {
    const r = computeDamage({ base: 100, mult: 1, stats: {}, kind: 'normal', critRoll: 0.01, varRoll: 0.5, target: tgt });
    expect(r.crit).toBe(true);
    expect(r.dmg).toBe(150);
    const r2 = computeDamage({ base: 100, mult: 1, stats: { critDmg: 0.5 }, kind: 'normal', critRoll: 0.01, varRoll: 0.5, target: tgt });
    expect(r2.dmg).toBe(200);
  });
  it('지속 피해는 치명타 불가', () => {
    const r = computeDamage({ base: 100, mult: 1, stats: { crit: 1 }, kind: 'dot', critRoll: 0, varRoll: 0.5, target: tgt });
    expect(r.crit).toBe(false);
  });
  it('종류별 피해 증가 (교대 2배)', () => {
    const r = computeDamage({ base: 100, mult: 1, stats: { swapDmg: 1 }, kind: 'swap', critRoll: 0.99, varRoll: 0.5, target: tgt });
    expect(r.dmg).toBe(200);
    const n = computeDamage({ base: 100, mult: 1, stats: { swapDmg: 1 }, kind: 'normal', critRoll: 0.99, varRoll: 0.5, target: tgt });
    expect(n.dmg).toBe(100);
  });
  it('상태이상 대상 추가 피해와 감전 취약', () => {
    const r = computeDamage({ base: 100, mult: 1, stats: { vsBurn: 0.5 }, kind: 'normal', critRoll: 0.99, varRoll: 0.5, target: { ...tgt, statuses: { burn: 1 } } });
    expect(r.dmg).toBe(150);
    const s = computeDamage({ base: 100, mult: 1, stats: {}, kind: 'normal', critRoll: 0.99, varRoll: 0.5, target: { ...tgt, statuses: { shock: 1 } } });
    expect(s.dmg).toBe(115);
  });
  it('방어력과 변동폭', () => {
    const r = computeDamage({ base: 100, mult: 1, stats: {}, kind: 'normal', critRoll: 0.99, varRoll: 0.5, target: { ...tgt, def: 0.3 } });
    expect(r.dmg).toBe(70);
    const lo = computeDamage({ base: 100, mult: 1, stats: {}, kind: 'normal', critRoll: 0.99, varRoll: 0, target: tgt });
    const hi = computeDamage({ base: 100, mult: 1, stats: {}, kind: 'normal', critRoll: 0.99, varRoll: 0.9999, target: tgt });
    expect(lo.dmg).toBe(95);
    expect(hi.dmg).toBe(105);
  });
  it('받는 피해: 감소와 저주', () => {
    expect(computeTaken(100, { dmgTaken: -0.2 }, 0)).toBe(80);
    expect(computeTaken(100, {}, 5)).toBe(160);
    expect(computeTaken(100, { dmgTaken: -5 }, 0)).toBe(20);
  });
  it('스탯 합산과 레벨 성장', () => {
    const s = addStats({ atk: 0.1 }, { atk: 0.2, crit: 0.1 });
    expect(s.atk).toBeCloseTo(0.3);
    expect(s.crit).toBeCloseTo(0.1);
    expect(charAtk(20, 1, 0)).toBe(20);
    expect(charAtk(20, 20, 5)).toBe(Math.round(20 * (1 + 19 * 0.06) + 5));
  });
});
