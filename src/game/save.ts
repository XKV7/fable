import { cloneBindings, DEFAULT_BINDINGS, type Bindings } from '../core/input';
import { newPity, type PityState } from './gacha';
import type { BannerKind } from '../data/gacha';
import { STARTER_CHAR, STARTER_WEAPON } from '../data/characters';

export interface Settings {
  music: number;
  sfx: number;
  shake: number;
  dmgNumbers: boolean;
  bindings: Bindings;
}

export interface SaveData {
  v: 1;
  stones: number;
  crystals: number;
  chars: Record<string, { lv: number; aw: number; count: number }>;
  weapons: Record<string, { rf: number; count: number }>;
  pity: Record<BannerKind, PityState>;
  freePullUsed: boolean;
  upgrades: Record<string, number>;
  ach: Record<string, 'done' | 'claimed'>;
  stats: {
    runs: number;
    kills: number;
    clears: number;
    bestChapter: number;
    swapHits: number;
    maxCombo: number;
    pulls: number;
    deaths: number;
    bossKills: Record<string, number>;
    playTime: number;
  };
  curse: number;
  curseMax: number;
  loadout: { chars: [string, string]; weapon: string };
  pickupIndex: number;
  runsSinceRotation: number;
  tutorialDone: boolean;
  introSeen: boolean;
  firstClear: Record<string, boolean>;
  settings: Settings;
  newChars: string[]; // 도감 NEW 표시
}

export const SAVE_KEY = 'pact_save_v1';

export function defaultSettings(): Settings {
  return { music: 0.6, sfx: 0.8, shake: 1, dmgNumbers: true, bindings: cloneBindings(DEFAULT_BINDINGS) };
}

export function newSave(): SaveData {
  return {
    v: 1,
    stones: 0,
    crystals: 0,
    chars: { [STARTER_CHAR]: { lv: 1, aw: 0, count: 1 } },
    weapons: { [STARTER_WEAPON]: { rf: 1, count: 1 } },
    pity: { char: newPity(), weapon: newPity(), pickup: newPity() },
    freePullUsed: false,
    upgrades: {},
    ach: {},
    stats: { runs: 0, kills: 0, clears: 0, bestChapter: 0, swapHits: 0, maxCombo: 0, pulls: 0, deaths: 0, bossKills: {}, playTime: 0 },
    curse: 0,
    curseMax: 0,
    loadout: { chars: [STARTER_CHAR, ''], weapon: STARTER_WEAPON },
    pickupIndex: 0,
    runsSinceRotation: 0,
    tutorialDone: false,
    introSeen: false,
    firstClear: {},
    settings: defaultSettings(),
    newChars: [],
  };
}

/** 누락 필드 보정 (구버전/손상 데이터 대비) */
export function sanitize(raw: unknown): SaveData {
  const base = newSave();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<SaveData>;
  const out: SaveData = {
    ...base,
    ...r,
    v: 1,
    pity: { ...base.pity, ...(r.pity ?? {}) },
    stats: { ...base.stats, ...(r.stats ?? {}), bossKills: { ...(r.stats?.bossKills ?? {}) } },
    settings: { ...base.settings, ...(r.settings ?? {}), bindings: cloneBindings((r.settings?.bindings ?? DEFAULT_BINDINGS) as Bindings) },
    chars: { ...base.chars, ...(r.chars ?? {}) },
    weapons: { ...base.weapons, ...(r.weapons ?? {}) },
    loadout: r.loadout && Array.isArray(r.loadout.chars) ? { chars: [r.loadout.chars[0] ?? STARTER_CHAR, r.loadout.chars[1] ?? ''], weapon: r.loadout.weapon ?? STARTER_WEAPON } : base.loadout,
    newChars: Array.isArray(r.newChars) ? r.newChars : [],
  };
  for (const k of ['stones', 'crystals', 'curse', 'curseMax', 'pickupIndex', 'runsSinceRotation'] as const) {
    if (typeof out[k] !== 'number' || !Number.isFinite(out[k])) out[k] = base[k];
  }
  return out;
}

export function loadSave(): SaveData | null {
  try {
    const s = localStorage.getItem(SAVE_KEY);
    if (!s) return null;
    return sanitize(JSON.parse(s));
  } catch {
    return null;
  }
}

export function writeSave(d: SaveData): boolean {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(d));
    return true;
  } catch {
    return false;
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* 저장소 접근 불가 시 무시 */
  }
}

export function levelCost(lv: number): number {
  return 20 + lv * 15;
}
export const MAX_LEVEL = 20;
export const MAX_AWAKEN = 5;
export const MAX_REFINE = 5;
