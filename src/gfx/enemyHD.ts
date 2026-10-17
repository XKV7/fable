import type { Look, PoseName } from '../game/types';
import { ENEMY_MAP } from '../data/enemies';
import { AI_ANIM, ENEMY_LOOKS, HUMANOID_ANIM } from './sprites';
import { drawHeroHD } from './hdHero';

/**
 * 적·보스용 고해상도(2배 정밀) 프레임. 영웅(hdHero.ts)과 같은 96×96 칸, 발 y=88.
 * 인간형 적은 Look으로 drawHeroHD를 그려 캐시하고, 비인간형은 등록된 2배 그리기가 있으면 그것을, 없으면 null(기존 48칸 경로).
 */
const cache = new Map<string, HTMLCanvasElement>();

const RUN: PoseName[] = ['run0', 'run1', 'run2', 'run3', 'run4', 'run5'];

/** enemyFrame(sprites.ts)과 같은 규칙으로 인간형 적의 포즈를 고른다: anim = idle|move|wind|atk|hurt|block */
export function enemyPose(id: string, anim: string, f: number): PoseName {
  if (anim === 'idle') return f % 2 ? 'idle1' : 'idle0';
  if (anim === 'move') return RUN[f % 6];
  const m = HUMANOID_ANIM[id] ?? AI_ANIM[ENEMY_MAP[id]?.ai ?? ''] ?? HUMANOID_ANIM.default;
  return m[anim] ?? HUMANOID_ANIM.default[anim] ?? 'idle0';
}

/** Look 하나의 2배 정밀 프레임 (키별 캐시) */
export function lookFrameHD(key: string, look: Look, pose: PoseName): HTMLCanvasElement {
  const k = `${key}|${pose}`;
  let c = cache.get(k);
  if (!c) {
    c = drawHeroHD(look, pose);
    cache.set(k, c);
  }
  return c;
}

/**
 * 비인간형 적(크리처) 2배 그리기 자리. 96×96 칸(발 y=88)을 돌려주는 함수를 id별로 등록하면
 * enemyFrameHD가 그것을 쓴다(캐시는 이쪽에서 anim·프레임별로). 등록이 없으면 기존 48칸 경로.
 * ff: enemyFrame과 같은 규칙으로 줄인 프레임 번호 (대기·이동은 0~3, 나머지는 0)
 */
export type CreatureHD = (anim: string, ff: number) => HTMLCanvasElement | null;
const CREATURE_HD: Record<string, CreatureHD> = {};
export function registerCreatureHD(id: string, fn: CreatureHD): void {
  CREATURE_HD[id] = fn;
}

/** 적 고해상도 프레임: 96×96, 그릴 수 없으면 null → 호출한 쪽이 enemyFrame(48칸)으로 그린다 */
export function enemyFrameHD(id: string, anim: string, f: number): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const look = ENEMY_LOOKS[id];
  if (look) return lookFrameHD(`e:${id}`, look, enemyPose(id, anim, f));
  const fn = CREATURE_HD[id];
  if (!fn) return null;
  const ff = anim === 'idle' || anim === 'move' ? f % 4 : 0;
  const k = `c:${id}|${anim}|${ff}`;
  let c = cache.get(k);
  if (!c) {
    const r = fn(anim, ff);
    if (!r) return null;
    c = r;
    cache.set(k, c);
  }
  return c;
}

/** 보스(Look 있는 인간형) 고해상도 프레임: 96×96 그림을 월드 96×96 칸에 그려 기존 48칸×2배보다 2배 정밀 */
export function bossFrameHD(id: string, pose: PoseName): HTMLCanvasElement | null {
  const look = ENEMY_LOOKS[id];
  if (!look || typeof document === 'undefined') return null;
  return lookFrameHD(`b:${id}`, look, pose);
}
