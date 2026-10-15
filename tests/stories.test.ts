import { describe, expect, it } from 'vitest';
import { STORIES } from '../src/data/stories';
import { CHAPTERS, chapterDef } from '../src/data/meta';
import { BOSS_MAP } from '../src/data/bosses';
import { ENEMIES } from '../src/data/enemies';
import { STORY_LOOKS } from '../src/gfx/looks2';
import { CREATURES } from '../src/gfx/creatures';

describe('스토리 구성', () => {
  it('스토리 4개, 각 6단계', () => {
    expect(STORIES.map((s) => s.id)).toEqual([1, 2, 3, 4]);
    for (const s of STORIES) {
      expect(s.route.length).toBe(6);
      expect(s.cards.length).toBe(6);
      expect(s.intro.length).toBeGreaterThan(3);
      expect(s.ending.length).toBeGreaterThan(3);
    }
  });
  it('모든 경로 테마에 챕터·보스·적 4종 이상이 있다', () => {
    for (const s of STORIES) {
      for (const stage of s.route) {
        for (const n of stage) {
          const ch = CHAPTERS.find((c) => c.n === n);
          expect(ch, `테마 ${n}`).toBeTruthy();
          expect(BOSS_MAP[ch!.boss], `보스 ${ch!.boss}`).toBeTruthy();
          const pool = ENEMIES.filter((e) => e.chapter === n);
          expect(pool.length, `테마 ${n} 적`).toBeGreaterThanOrEqual(4);
          expect(pool.some((e) => !e.flying), `테마 ${n} 지상 적`).toBe(true);
        }
      }
    }
  });
  it('스토리 2~4의 테마·보스·적이 모두 새것이고 겹치지 않는다', () => {
    const later = STORIES.slice(1).flatMap((s) => s.route.flat());
    expect(new Set(later).size).toBe(18);
    const bosses = later.map((n) => chapterDef(n).boss);
    expect(new Set(bosses).size).toBe(18);
    for (const b of bosses) expect(['graven', 'mycora', 'ignis', 'king', 'morten', 'libra', 'oblivion']).not.toContain(b);
    const enemies = ENEMIES.filter((e) => later.includes(e.chapter));
    expect(enemies.length).toBe(72);
  });
  it('스토리 적은 모두 외형(인간형 또는 생물)이 하나씩 있다', () => {
    for (const e of ENEMIES.filter((x) => x.chapter >= 11)) {
      const has = Number(!!STORY_LOOKS[e.id]) + Number(!!CREATURES[e.id]);
      expect(has, e.id).toBe(1);
    }
  });
  it('최종 보스는 3페이즈, 배율 3', () => {
    for (const s of STORIES.slice(1)) {
      const b = BOSS_MAP[chapterDef(s.route[5][0]).boss];
      expect(b.phases.length).toBe(2);
      expect(b.patterns.length).toBe(3);
      expect(b.mult).toBe(3);
      expect(STORY_LOOKS[b.id]).toBeTruthy();
    }
  });
  it('후속 스토리일수록 강하다', () => {
    for (let i = 1; i < STORIES.length; i++) {
      expect(STORIES[i].power.hp).toBeGreaterThan(STORIES[i - 1].power.hp);
      expect(STORIES[i].power.atk).toBeGreaterThan(STORIES[i - 1].power.atk);
    }
  });
});

describe('난이도 배율', () => {
  it('일반 적 체력·공격력 1.5배', async () => {
    const { ENEMY_MAP } = await import('../src/data/enemies');
    expect(ENEMY_MAP.skeleton.hp).toBe(105);
    expect(ENEMY_MAP.skeleton.atk).toBe(11);
    expect(ENEMY_MAP.dummy.hp).toBe(999999);
  });
  it('일반 보스 1.5배, 끝없는 왕 3배, 망각 4배', async () => {
    const { bossHp, bossAtk } = await import('../src/data/bosses');
    expect(bossHp(BOSS_MAP.graven)).toBe(3300);
    expect(bossAtk(BOSS_MAP.graven)).toBe(21);
    expect(bossHp(BOSS_MAP.king)).toBe(6500 * 3);
    expect(bossAtk(BOSS_MAP.king)).toBe(26 * 3);
    expect(bossHp(BOSS_MAP.oblivion)).toBe(9000 * 4);
    expect(bossAtk(BOSS_MAP.oblivion)).toBe(30 * 4);
  });
  it('왕·망각은 즉사기를 가진다', () => {
    expect(BOSS_MAP.king.patterns.flat()).toContain('royalExecution');
    expect(BOSS_MAP.oblivion.patterns.flat()).toContain('oblivionErase');
    expect(BOSS_MAP.king.patterns[0]).not.toContain('royalExecution');
  });
});

describe('저장: 스토리 해금', () => {
  it('누락·잘못된 값 보정', async () => {
    const { sanitize } = await import('../src/game/save');
    const a = sanitize({});
    expect(a.story).toBe(1);
    expect(a.storyMax).toBe(1);
    const b = sanitize({ story: 9, storyMax: 7 });
    expect(b.storyMax).toBe(4);
    expect(b.story).toBe(4);
    expect(sanitize({ story: 3, storyMax: 2 }).story).toBe(2);
  });
});
