import { describe, expect, it } from 'vitest';
import { ICON_ART_KEYS } from '../src/gfx/iconArt';
import { ICON_KEYS } from '../src/ui/icons';
import { RELICS } from '../src/data/relics';
import { CRESTS } from '../src/data/crests';

describe('아이콘 그림', () => {
  it('비트맵 아이콘 키마다 고해상도 그림이 있다', () => {
    for (const k of ICON_KEYS) expect(ICON_ART_KEYS, k).toContain(k);
  });
  it('유물·문장 아이콘 키는 모두 그림이 있다', () => {
    for (const r of RELICS) expect(ICON_ART_KEYS, r.id).toContain(r.icon);
    for (const c of CRESTS) expect(ICON_ART_KEYS, c.id).toContain(c.icon);
  });
});
