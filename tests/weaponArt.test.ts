import { describe, expect, it } from 'vitest';
import { WEAPONS } from '../src/data/weapons';
import { WEAPON_ART_IDS } from '../src/gfx/weaponArt';

describe('무기 그림', () => {
  it('무기 24종 모두 전용 그림이 있다', () => {
    expect(WEAPONS.length).toBe(24);
    for (const w of WEAPONS) expect(WEAPON_ART_IDS, w.id).toContain(w.id);
    expect(WEAPON_ART_IDS.length).toBe(WEAPONS.length);
  });
});
