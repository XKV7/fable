import { CHARACTERS, CHAR_MAP } from '../data/characters';
import { GACHA, type BannerKind } from '../data/gacha';
import { ACHIEVEMENTS, CURSES } from '../data/meta';
import { WEAPONS, WEAPON_MAP } from '../data/weapons';
import { BOSSES } from '../data/bosses';
import { STORIES } from '../data/stories';
import { pullMany, type BannerPool } from './gacha';
import type { RunState } from './run';
import { MAX_AWAKEN, MAX_REFINE, type SaveData } from './save';
import type { Rarity } from './types';

/** 픽업 로테이션 (런 3회마다 다음으로) */
export const PICKUPS: { five: string; four: [string, string] }[] = [
  { five: 'seres', four: ['sien', 'aurelia'] },
  { five: 'drakan', four: ['balt', 'morga'] },
  { five: 'astera', four: ['eora', 'sien'] },
  { five: 'marionne', four: ['seira', 'bram'] },
  { five: 'ignia', four: ['jolly', 'freya'] },
];

export function currentPickup(save: SaveData): { five: string; four: [string, string] } {
  return save.pickupOverride ?? PICKUPS[save.pickupIndex % PICKUPS.length];
}

export function bannerPool(kind: BannerKind, save: SaveData): BannerPool {
  if (kind === 'weapon') return { kind, items: WEAPONS.map((w) => ({ id: w.id, rarity: w.rarity })) };
  const items = CHARACTERS.map((c) => ({ id: c.id, rarity: c.rarity }));
  if (kind === 'pickup') {
    const p = currentPickup(save);
    return { kind, items, pickup5: [p.five], pickup4: [...p.four] };
  }
  return { kind, items };
}

export interface PullOutcome {
  id: string;
  rarity: Rarity;
  type: 'char' | 'weapon';
  isNew: boolean;
  note: string; // "NEW" / "각성 +1" / "재련 +1" / "영혼 결정 +N"
  pickup: boolean;
}

export function pullCost(count: number): number {
  return count === 10 ? GACHA.costTen : GACHA.costSingle * count;
}

/** 실제 뽑기 수행 + 보유 목록 반영. 영혼석 차감은 호출 측에서 검증 후 여기서 처리 */
export function performPull(save: SaveData, kind: BannerKind, count: number, free: boolean, rand: () => number = Math.random): PullOutcome[] | null {
  const cost = free ? 0 : pullCost(count);
  if (save.stones < cost) return null;
  save.stones -= cost;
  if (free) save.freePullUsed = true;
  // 10연은 유료·무료 모두 ★4 이상 확정
  const results = pullMany(bannerPool(kind, save), save.pity[kind], rand, count, free || count >= 10);
  save.stats.pulls += count;
  const out: PullOutcome[] = [];
  for (const r of results) {
    if (kind === 'weapon') {
      const w = WEAPON_MAP[r.id];
      const cur = save.weapons[r.id];
      if (!cur) {
        save.weapons[r.id] = { rf: 1, count: 1 };
        out.push({ id: r.id, rarity: w.rarity, type: 'weapon', isNew: true, note: 'NEW', pickup: r.pickup });
      } else {
        cur.count++;
        if (cur.rf < MAX_REFINE) {
          cur.rf++;
          out.push({ id: r.id, rarity: w.rarity, type: 'weapon', isNew: false, note: `재련 ${cur.rf}단계`, pickup: r.pickup });
        } else {
          const c = r.rarity >= 5 ? 300 * (r.rarity - 4) : r.rarity === 4 ? 80 : 20;
          save.crystals += c;
          out.push({ id: r.id, rarity: w.rarity, type: 'weapon', isNew: false, note: `영혼 결정 +${c}`, pickup: r.pickup });
        }
      }
    } else {
      const c = CHAR_MAP[r.id];
      const cur = save.chars[r.id];
      if (!cur) {
        save.chars[r.id] = { lv: 1, aw: 0, count: 1 };
        if (!save.newChars.includes(r.id)) save.newChars.push(r.id);
        out.push({ id: r.id, rarity: c.rarity, type: 'char', isNew: true, note: 'NEW', pickup: r.pickup });
      } else {
        cur.count++;
        if (cur.aw < MAX_AWAKEN) {
          cur.aw++;
          out.push({ id: r.id, rarity: c.rarity, type: 'char', isNew: false, note: `각성 ${cur.aw}단계`, pickup: r.pickup });
        } else {
          const cr = r.rarity >= 5 ? 400 * (r.rarity - 4) : r.rarity === 4 ? 150 : 50;
          save.crystals += cr;
          out.push({ id: r.id, rarity: c.rarity, type: 'char', isNew: false, note: `영혼 결정 +${cr}`, pickup: r.pickup });
        }
      }
    }
  }
  if (out.some((o) => o.rarity >= 5)) markAch(save, 'star5');
  return out;
}

/** 업적 달성 처리. 새로 달성하면 true */
export function markAch(save: SaveData, id: string): boolean {
  if (save.ach[id]) return false;
  if (!ACHIEVEMENTS.some((a) => a.id === id)) return false;
  save.ach[id] = 'done';
  return true;
}

/** 상태 기반 업적 일괄 점검. 새로 달성한 업적 id 목록 */
export function checkAchievements(save: SaveData): string[] {
  const got: string[] = [];
  const m = (id: string, cond: boolean): void => {
    if (cond && markAch(save, id)) got.push(id);
  };
  const owned = Object.keys(save.chars).filter((k) => CHAR_MAP[k]);
  m('chars5', owned.length >= 5);
  m('chars14', owned.length >= CHARACTERS.length);
  m('star5', owned.some((k) => CHAR_MAP[k].rarity >= 5) || Object.keys(save.weapons).some((k) => (WEAPON_MAP[k]?.rarity ?? 0) >= 5));
  m('awaken5', owned.some((k) => save.chars[k].aw >= 5));
  m('level20', owned.some((k) => save.chars[k].lv >= 20));
  m('kills100', save.stats.kills >= 100);
  m('kills1000', save.stats.kills >= 1000);
  m('combo50', save.stats.maxCombo >= 50);
  m('combo150', save.stats.maxCombo >= 150);
  m('swap50', save.stats.swapHits >= 50);
  m('first_run', save.stats.runs >= 1);
  const clearAch: Record<string, string> = { graven: 'clear1', mycora: 'clear2', ignis: 'clear3', king: 'clear4', morten: 'clear_morten', libra: 'clear_libra', oblivion: 'clear_oblivion' };
  for (const b of BOSSES) if (clearAch[b.id]) m(clearAch[b.id], (save.stats.bossKills[b.id] ?? 0) > 0);
  m('story2', !!save.storyClear[2]);
  m('story3', !!save.storyClear[3]);
  m('story4', !!save.storyClear[4]);
  return got;
}

export interface RunSummary {
  stones: number;
  crystals: number;
  bonusStones: number; // 첫 처치 보상
  /** 출정 보상: 기본 150(패배해도) + 클리어한 챕터마다 1600 */
  runStones: number;
  chaptersCleared: number;
  chapter: number;
  victory: boolean;
  newAch: string[];
  curseUnlocked: boolean;
  rotated: boolean;
  /** 이번 런으로 스토리를 처음 완수 / 다음 스토리 해금 */
  storyFirstClear: boolean;
  storyUnlocked: number;
}

/** 출정 보상 (영혼석) */
export const RUN_REWARD = { base: 150, perChapter: 1600, perRushBoss: 400 };

/** 런 종료 정산 */
export function finishRun(save: SaveData, run: RunState): RunSummary {
  const st = run.stats;
  const stoneMul = (1 + (save.upgrades.stone ?? 0) * 0.1) * (1 + (CURSES[run.curse]?.reward ?? 0));
  let bonus = 0;
  for (const bid of st.bosses) {
    save.stats.bossKills[bid] = (save.stats.bossKills[bid] ?? 0) + 1;
    if (!save.firstClear[bid]) {
      save.firstClear[bid] = true;
      bonus += BOSSES.find((b) => b.id === bid)?.soulStones ?? 0;
    }
  }
  const stones = Math.round(st.stones * stoneMul);
  const crystals = Math.round(st.crystals * (1 + (CURSES[run.curse]?.reward ?? 0) * 0.5));
  // 출정 보상: 패배해도 150, 그 런에서 클리어한 챕터(보스 처치)마다 1600
  const chaptersCleared = st.bosses.length;
  const runStones = RUN_REWARD.base + (run.bossRush ? RUN_REWARD.perRushBoss : RUN_REWARD.perChapter) * chaptersCleared;
  if (run.bossRush) save.bossRushBest = Math.max(save.bossRushBest ?? 0, chaptersCleared);
  save.stones += stones + bonus + runStones;
  save.crystals += crystals;
  save.stats.runs++;
  save.stats.kills += st.kills;
  save.stats.swapHits += st.swapHits;
  save.stats.maxCombo = Math.max(save.stats.maxCombo, st.maxCombo);
  save.stats.bestChapter = Math.max(save.stats.bestChapter, run.chapter);
  save.stats.playTime += st.frames / 60;
  if (!run.victory) save.stats.deaths++;
  save.tutorialDone = true;
  let curseUnlocked = false;
  let storyFirstClear = false;
  let storyUnlocked = 0;
  if (run.victory && !run.bossRush) {
    storyFirstClear = !save.storyClear[run.story];
    save.storyClear[run.story] = true;
    if (run.story >= save.storyMax && save.storyMax < STORIES.length) {
      save.storyMax = run.story + 1;
      storyUnlocked = save.storyMax;
    }
    save.stats.clears++;
    if (save.curseMax < 5 && run.curse >= save.curseMax) {
      save.curseMax = Math.min(5, run.curse + 1);
      curseUnlocked = true;
    }
    if (run.curse >= 1) markAch(save, 'curse1');
  }
  if (st.hidden > 0) markAch(save, 'hidden');
  save.runsSinceRotation++;
  let rotated = false;
  if (save.runsSinceRotation >= GACHA.rotationRuns) {
    save.runsSinceRotation = 0;
    save.pickupIndex = (save.pickupIndex + 1) % PICKUPS.length;
    rotated = true;
  }
  const newAch = checkAchievements(save);
  return { stones, crystals, bonusStones: bonus, runStones, chaptersCleared, chapter: run.chapter, victory: run.victory, newAch, curseUnlocked, rotated, storyFirstClear, storyUnlocked };
}
