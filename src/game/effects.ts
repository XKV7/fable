import { CHAR_MAP } from '../data/characters';
import { RELIC_MAP } from '../data/relics';
import { WEAPON_MAP } from '../data/weapons';
import { addStats } from './combat';
import { crestEffects, evalCrests, type CrestState } from './crests';
import type { RunState } from './run';
import type { SaveData } from './save';
import type { ActionMods, CondKey, CrestId, Effect, EffectDo, FlagKey, Flags, Stats, StatusId, Trigger } from './types';

export interface TriggerCtx {
  target?: { statuses: Partial<Record<StatusId, number>> };
  x?: number;
  y?: number;
  dmg?: number;
}

interface TriggerEntry {
  eff: Effect;
  last: number;
  timer: number;
}

interface Buff {
  stats: Stats;
  until: number;
  stacks: number;
  max: number;
}

/** 수치 스케일링 (무기 재련) */
function scaleStats(s: Stats | undefined, m: number): Stats | undefined {
  if (!s) return s;
  const o: Stats = {};
  for (const k of Object.keys(s) as (keyof Stats)[]) o[k] = (s[k] ?? 0) * m;
  return o;
}
function scaleDo(d: EffectDo, m: number): EffectDo {
  const c = { ...d } as EffectDo & { m?: number; v?: number; stats?: Stats };
  if ('m' in c && typeof c.m === 'number') c.m *= m;
  if ('v' in c && typeof c.v === 'number' && d.k !== 'gold') c.v *= m;
  if (d.k === 'buff') (c as { stats: Stats }).stats = scaleStats(d.stats, m)!;
  return c as EffectDo;
}
export function scaleEffect(e: Effect, m: number): Effect {
  if (m === 1) return e;
  return {
    ...e,
    stats: scaleStats(e.stats, m),
    chance: e.chance !== undefined ? Math.min(1, e.chance * m) : undefined,
    do: e.do?.map((d) => scaleDo(d, m)),
  };
}

/** 현재 빌드의 스탯·플래그·트리거를 관리하는 효과 엔진 */
export class Build {
  base: Stats = {};
  flags: Flags = {};
  conds: { cond: CondKey; stats: Stats }[] = [];
  triggers = new Map<Trigger, TriggerEntry[]>();
  buffs = new Map<string, Buff>();
  crests: CrestState[] = [];
  mods: ActionMods[] = [];
  time = 0;
  /** host가 효과 프리미티브를 실행 */
  exec: (d: EffectDo, ctx: TriggerCtx) => void = () => undefined;

  rebuild(run: RunState, save: SaveData): void {
    const effects: Effect[] = [];
    const tags: CrestId[] = [];
    // 무기
    const w = WEAPON_MAP[run.weapon.id];
    if (w) {
      const m = 1 + w.scale * (run.weapon.rf - 1);
      for (const e of w.effects) effects.push(scaleEffect(e, m));
      if (w.crest) tags.push(...w.crest);
    }
    // 유물
    for (const id of run.relics) {
      const r = RELIC_MAP[id];
      if (!r) continue;
      effects.push(...r.effects);
      tags.push(...r.crest);
    }
    // 캐릭터: 두 명의 문장 태그, 활성 캐릭터의 패시브와 각성
    for (const p of run.party) {
      const c = CHAR_MAP[p.id];
      if (c?.crest) tags.push(c.crest);
    }
    const act = run.party[run.active];
    const ac = CHAR_MAP[act.id];
    this.mods = [];
    if (ac) {
      effects.push(...ac.passive.effects);
      for (let i = 0; i < act.aw; i++) {
        const a = ac.awaken[i];
        if (a.effects) effects.push(...a.effects);
        if (a.mods) this.mods.push(...a.mods);
      }
    }
    // 문장 세트
    this.crests = evalCrests(tags);
    effects.push(...crestEffects(this.crests));
    // 메타 영구 강화
    const up = save.upgrades;
    const meta: Stats = {
      atk: (up.atk ?? 0) * 0.04 + run.bonusAtk,
      crit: (up.crit ?? 0) * 0.02,
      swapCdr: (up.swap ?? 0) * 0.06,
      maxHp: (up.hp ?? 0) * 12 + run.bonusMaxHp,
    };
    effects.push({ stats: meta });

    this.base = {};
    this.flags = {};
    this.conds = [];
    this.triggers.clear();
    for (const e of effects) {
      if (e.stats && !e.cond) addStats(this.base, e.stats);
      if (e.stats && e.cond) this.conds.push({ cond: e.cond, stats: e.stats });
      if (e.flags) for (const k of Object.keys(e.flags) as FlagKey[]) this.flags[k] = (this.flags[k] ?? 0) + (e.flags[k] ?? 0);
      if (e.on && e.do) {
        const list = this.triggers.get(e.on) ?? [];
        list.push({ eff: e, last: -999, timer: 0 });
        this.triggers.set(e.on, list);
      }
    }
  }

  flag(k: FlagKey): number {
    return this.flags[k] ?? 0;
  }

  /** 조건/버프 포함 현재 스탯 */
  stats(check: (c: CondKey) => boolean): Stats {
    const s: Stats = { ...this.base };
    for (const c of this.conds) if (check(c.cond)) addStats(s, c.stats);
    for (const b of this.buffs.values()) if (b.until > this.time) addStats(s, b.stats, b.stacks);
    return s;
  }

  addBuff(id: string, stats: Stats, dur: number, max = 1): void {
    const b = this.buffs.get(id);
    if (b && b.until > this.time) {
      b.stacks = Math.min(max, b.stacks + 1);
      b.until = this.time + dur;
      b.stats = stats;
    } else this.buffs.set(id, { stats, until: this.time + dur, stacks: 1, max });
  }

  activeBuffs(): { id: string; left: number; stacks: number }[] {
    const out: { id: string; left: number; stacks: number }[] = [];
    for (const [id, b] of this.buffs) if (b.until > this.time) out.push({ id, left: b.until - this.time, stacks: b.stacks });
    return out;
  }

  fire(tr: Trigger, ctx: TriggerCtx, rand: () => number): void {
    const list = this.triggers.get(tr);
    if (!list) return;
    for (const t of list) {
      const e = t.eff;
      if (e.icd && this.time - t.last < e.icd) continue;
      if (e.need && !(ctx.target && ctx.target.statuses[e.need])) continue;
      if (e.chance !== undefined && rand() >= e.chance) continue;
      t.last = this.time;
      for (const d of e.do!) this.exec(d, ctx);
    }
  }

  /** 초 단위 시간 진행 + 주기 트리거 */
  tick(dt: number, rand: () => number): void {
    this.time += dt;
    const list = this.triggers.get('interval');
    if (!list) return;
    for (const t of list) {
      t.timer += dt;
      if (t.timer >= (t.eff.every ?? 5)) {
        t.timer = 0;
        if (t.eff.chance === undefined || rand() < t.eff.chance) for (const d of t.eff.do!) this.exec(d, {});
      }
    }
  }

  modFor(target: 'skill1' | 'skill2' | 'swap' | 'combo' | 'ult'): { dmg: number; count: number; cd: number; size: number } {
    const o = { dmg: 0, count: 0, cd: 0, size: 0 };
    for (const m of this.mods) {
      if (m.target !== target && m.target !== 'all') continue;
      o.dmg += m.dmg ?? 0;
      o.count += m.count ?? 0;
      o.cd += m.cd ?? 0;
      o.size += m.size ?? 0;
    }
    return o;
  }
}
