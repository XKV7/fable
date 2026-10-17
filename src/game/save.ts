import { cloneBindings, DEFAULT_BINDINGS, type Bindings } from '../core/input';
import { newPity, type PityState } from './gacha';
import type { BannerKind } from '../data/gacha';
import { CHAR_MAP, STARTER_CHAR, STARTER_WEAPON } from '../data/characters';
import { validSnap, type RunSnap } from './runsave';
import { STORIES } from '../data/stories';

export interface Settings {
  music: number;
  sfx: number;
  shake: number;
  dmgNumbers: boolean;
  bindings: Bindings;
  bindVer?: number;
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
  /** 선택한 스토리 / 해금된 최대 스토리 */
  story: number;
  storyMax: number;
  /** 스토리별 인트로를 봤는지 / 클리어했는지 */
  storySeen: Record<number, boolean>;
  storyClear: Record<number, boolean>;
  /** 사용한 쿠폰 코드 (대문자). 계정마다 한 번씩만 */
  usedCoupons: string[];
  /** 보스 러시 최고 기록 (처치한 보스 수) */
  bossRushBest: number;
  /** 진행 중인 런 (런 도중 나가도 이어하기). 없으면 null */
  run: RunSnap | null;
  loadout: { chars: [string, string]; weapon: string };
  pickupIndex: number;
  /** 디버그: 직접 지정한 픽업 (null이면 자동 로테이션) */
  pickupOverride: { five: string; four: [string, string] } | null;
  runsSinceRotation: number;
  tutorialDone: boolean;
  introSeen: boolean;
  firstClear: Record<string, boolean>;
  settings: Settings;
  newChars: string[]; // 도감 NEW 표시
}

export const SAVE_KEY = 'pact_save_v1';
/** 기본 키 배치가 바뀌면 올린다 — 이전 버전의 저장된 키 설정은 새 기본값으로 교체 */
export const BIND_VER = 5;

export function defaultSettings(): Settings {
  return { music: 0.6, sfx: 0.8, shake: 1, dmgNumbers: true, bindings: cloneBindings(DEFAULT_BINDINGS), bindVer: BIND_VER };
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
    story: 1,
    storyMax: 1,
    storySeen: {},
    storyClear: {},
    usedCoupons: [],
    bossRushBest: 0,
    run: null,
    loadout: { chars: [STARTER_CHAR, ''], weapon: STARTER_WEAPON },
    pickupIndex: 0,
    pickupOverride: null,
    runsSinceRotation: 0,
    tutorialDone: false,
    introSeen: false,
    firstClear: {},
    settings: defaultSettings(),
    newChars: [],
  };
}

function validOverride(o: unknown): SaveData['pickupOverride'] {
  const v = o as SaveData['pickupOverride'];
  if (!v || typeof v.five !== 'string' || !Array.isArray(v.four) || v.four.length !== 2) return null;
  if (CHAR_MAP[v.five]?.rarity !== 5 || v.four.some((id) => CHAR_MAP[id]?.rarity !== 4) || v.four[0] === v.four[1]) return null;
  return { five: v.five, four: [v.four[0], v.four[1]] };
}

/** 키 설정 이전: v2(WASD 배치)는 그대로 두고 대시만 Q → Shift (대시를 직접 바꾼 경우는 유지), 그보다 오래된 것은 새 기본값 */
function migrateBindings(ver: number | undefined, b: Bindings | undefined): Bindings {
  if (!b || (ver !== BIND_VER && ver !== 2 && ver !== 3 && ver !== 4)) return cloneBindings(DEFAULT_BINDINGS);
  const out = cloneBindings(b);
  if (ver === 2 && out.dash.keys.length === 1 && out.dash.keys[0] === 'KeyQ') out.dash.keys = [...DEFAULT_BINDINGS.dash.keys];
  // v4: 스킬 2 기본 키 R → Q. 예전 기본값(R)을 그대로 쓰던 사람만 옮긴다 (Q를 다른 데 쓰고 있으면 거기서 빼고)
  if ((ver ?? 0) < 4 && out.skill2.keys.length === 1 && out.skill2.keys[0] === 'KeyR') {
    for (const a of Object.keys(out) as (keyof Bindings)[]) out[a].keys = out[a].keys.filter((k) => k !== 'KeyQ');
    out.skill2.keys = ['KeyQ'];
  }
  // v5: 궁극기(X) 추가. 예전 저장은 cloneBindings가 기본값 X를 넣는데, X를 이미 다른 동작에 쓰고 있으면 V → 없으면 비워 둠
  if ((ver ?? 0) < 5) {
    const used = (k: string): boolean => (Object.keys(out) as (keyof Bindings)[]).some((a) => a !== 'ult' && out[a].keys.includes(k));
    out.ult.keys = !used('KeyX') ? ['KeyX'] : !used('KeyV') ? ['KeyV'] : [];
  }
  return out;
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
    settings: { ...base.settings, ...(r.settings ?? {}), bindVer: BIND_VER, bindings: migrateBindings(r.settings?.bindVer, r.settings?.bindings) },
    chars: { ...base.chars, ...(r.chars ?? {}) },
    weapons: { ...base.weapons, ...(r.weapons ?? {}) },
    loadout: r.loadout && Array.isArray(r.loadout.chars) ? { chars: [r.loadout.chars[0] ?? STARTER_CHAR, r.loadout.chars[1] ?? ''], weapon: r.loadout.weapon ?? STARTER_WEAPON } : base.loadout,
    newChars: Array.isArray(r.newChars) ? r.newChars : [],
    storySeen: { ...(r.storySeen ?? {}) },
    storyClear: { ...(r.storyClear ?? {}) },
    usedCoupons: Array.isArray(r.usedCoupons) ? r.usedCoupons.filter((c: unknown) => typeof c === 'string') : [],
    bossRushBest: typeof r.bossRushBest === 'number' ? r.bossRushBest : 0,
    run: validSnap(r.run),
    pickupOverride: validOverride(r.pickupOverride),
  };
  for (const k of ['stones', 'crystals', 'curse', 'curseMax', 'pickupIndex', 'runsSinceRotation', 'story', 'storyMax'] as const) {
    if (typeof out[k] !== 'number' || !Number.isFinite(out[k])) out[k] = base[k];
  }
  out.storyMax = Math.max(1, Math.min(STORIES.length, Math.floor(out.storyMax)));
  out.story = Math.max(1, Math.min(out.storyMax, Math.floor(out.story)));
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
