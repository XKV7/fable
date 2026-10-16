import { RunState } from './run';
import type { SaveData } from './save';

/**
 * 진행 중인 런 저장 (이어하기). 방에 들어갈 때·방을 정화했을 때·보상을 받았을 때 저장한다.
 * 이어하면 저장된 방을 같은 지형·같은 적 배치로 다시 만든다(입장 시점의 난수 상태로 재생성).
 * 정화한 방은 정화된 채로, 열어 본 상자·제단 등은 사용한 채로 복원한다.
 */
export interface RunSnap {
  v: 1;
  data: Record<string, unknown>; // RunState의 직렬화 가능한 필드 (rng 제외)
  rngEntry: number; // 현재 방에 들어가기 직전 난수 상태 (방 재생성용)
  rngNow: number; // 저장 시점 난수 상태
  template: string; // 방에 들어가기 직전 RunScene.lastTemplate
  room: { cleared: boolean; bossDown: boolean; used: boolean[] };
  savedAt: number;
}

export function snapRun(run: RunState, o: { rngEntry: number; template: string; cleared: boolean; bossDown: boolean; used: boolean[] }): RunSnap {
  const data = JSON.parse(JSON.stringify(run, (k, v) => (k === 'rng' ? undefined : v))) as Record<string, unknown>;
  return { v: 1, data, rngEntry: o.rngEntry, rngNow: run.rng.state, template: o.template, room: { cleared: o.cleared, bossDown: o.bossDown, used: o.used }, savedAt: Date.now() };
}

/** 저장된 런으로 RunState 복원 (rng는 방 재생성을 위해 입장 시점 상태로 맞춰 둔다) */
export function restoreRun(save: SaveData, snap: RunSnap): RunState {
  const run = new RunState(save);
  Object.assign(run, structuredCloneSafe(snap.data));
  run.rng.state = snap.rngEntry;
  return run;
}

function structuredCloneSafe<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

export function validSnap(v: unknown): RunSnap | null {
  const s = v as RunSnap | null;
  if (!s || s.v !== 1 || typeof s.data !== 'object' || !s.data || typeof s.rngEntry !== 'number' || !s.room) return null;
  const d = s.data as { nodes?: unknown; party?: unknown; cur?: unknown };
  if (!Array.isArray(d.nodes) || !Array.isArray(d.party) || typeof d.cur !== 'number') return null;
  return s;
}
