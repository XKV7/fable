import type { CrestDef, CrestId } from '../game/types';

/** 문장 10종. 같은 문장 2/4/6개에서 세트 효과. */
export const CRESTS: CrestDef[] = [
  {
    id: 'flame', name: '화염', col: '#ff7a2a', icon: 'flame',
    tiers: [
      { n: 2, desc: '공격 시 15% 확률로 화상', effects: [{ on: 'hit', chance: 0.15, do: [{ k: 'status', s: 'burn' }] }] },
      { n: 4, desc: '화상 대상 처치 시 폭발 (공격력 120%)', effects: [{ flags: { burnSpread: 1.2 } }] },
      { n: 6, desc: '화상 피해 +100%, 화상 최대 중첩 +3', effects: [{ stats: { dotDmg: 1.0 }, flags: { burnMax: 3 } }] },
    ],
  },
  {
    id: 'blood', name: '출혈', col: '#d8203a', icon: 'drop',
    tiers: [
      { n: 2, desc: '치명타 시 출혈 2중첩', effects: [{ on: 'crit', do: [{ k: 'status', s: 'bleed', n: 2 }] }] },
      { n: 4, desc: '출혈 대상에게 주는 피해 +25%', effects: [{ stats: { vsBleed: 0.25 } }] },
      { n: 6, desc: '출혈 5중첩 시 파열 (공격력 300%) · 흡혈 3%', effects: [{ flags: { bleedRupture: 3 }, stats: { lifesteal: 0.03 } }] },
    ],
  },
  {
    id: 'storm', name: '번개', col: '#7fd8ff', icon: 'bolt',
    tiers: [
      { n: 2, desc: '공격 시 10% 확률로 연쇄 번개 (3대상)', effects: [{ on: 'hit', chance: 0.1, icd: 0.3, do: [{ k: 'chain', n: 3, m: 0.5 }] }] },
      { n: 4, desc: '감전 대상에게 주는 피해 +30%, 감전이 주변으로 번짐', effects: [{ stats: { vsShock: 0.3 }, flags: { shockSpread: 1 } }] },
      { n: 6, desc: '콤보 마지막 타격 시 낙뢰 (공격력 250%)', effects: [{ on: 'finisher', do: [{ k: 'strike', m: 2.5, el: 'thunder' }] }] },
    ],
  },
  {
    id: 'shadow', name: '그림자', col: '#9a6bff', icon: 'eye',
    tiers: [
      { n: 2, desc: '대시 후 2초간 치명타 확률 +20%', effects: [{ on: 'dash', do: [{ k: 'buff', id: 'shadow2', stats: { crit: 0.2 }, dur: 2 }] }] },
      { n: 4, desc: '대시로 통과한 적에게 공격력 80% 피해', effects: [{ flags: { dashThrough: 0.8 } }] },
      { n: 6, desc: '처치 시 그림자 분신이 주변 적을 벤다 (공격력 150%)', effects: [{ on: 'kill', icd: 0.4, do: [{ k: 'echo', m: 1.5 }] }] },
    ],
  },
  {
    id: 'ward', name: '수호', col: '#ffd76a', icon: 'shield',
    tiers: [
      { n: 2, desc: '방 입장 시 최대 체력 12% 보호막', effects: [{ on: 'roomStart', do: [{ k: 'shield', v: 0.12 }] }] },
      { n: 4, desc: '보호막이 있을 때 주는 피해 +20%, 받는 피해 -10%', effects: [{ cond: 'shielded', stats: { allDmg: 0.2 } }, { stats: { dmgTaken: -0.1 } }] },
      { n: 6, desc: '피격 시 반격 파동 (공격력 200%) · 8초마다 보호막 6%', effects: [{ flags: { hurtWave: 2 } }, { on: 'interval', every: 8, do: [{ k: 'shield', v: 0.06 }] }] },
    ],
  },
  {
    id: 'fury', name: '광폭', col: '#ff4b2a', icon: 'fang',
    tiers: [
      { n: 2, desc: '공격력 +10%', effects: [{ stats: { atk: 0.1 } }] },
      { n: 4, desc: '체력 50% 이하일 때 공격력 +30%, 공격 속도 +15%', effects: [{ cond: 'lowHp', stats: { atk: 0.3, aspd: 0.15 } }] },
      { n: 6, desc: '처치 시 공격 속도 +6% (최대 5중첩, 5초)', effects: [{ on: 'kill', do: [{ k: 'buff', id: 'fury6', stats: { aspd: 0.06, atk: 0.04 }, dur: 5, max: 5 }] }] },
    ],
  },
  {
    id: 'swift', name: '신속', col: '#6dffb0', icon: 'wing',
    tiers: [
      { n: 2, desc: '이동 속도 +10%, 대시 쿨타임 -20%', effects: [{ stats: { mspd: 0.1, dashCdr: 0.2 } }] },
      { n: 4, desc: '교대 쿨타임 -30%', effects: [{ stats: { swapCdr: 0.3 } }] },
      { n: 6, desc: '교대 공격 피해 +100%, 교대 시 0.8초 무적', effects: [{ stats: { swapDmg: 1 }, flags: { swapInvuln: 0.8 } }] },
    ],
  },
  {
    id: 'soul', name: '영혼', col: '#9ef0ff', icon: 'soul',
    tiers: [
      { n: 2, desc: '스킬 쿨타임 -15%', effects: [{ stats: { cdr: 0.15 } }] },
      { n: 4, desc: '스킬 사용 시 영혼탄 3발 발사 (공격력 60%)', effects: [{ on: 'skill', do: [{ k: 'proj', p: { spr: 'soul', spd: 4, life: 90, w: 8, h: 8, home: 0.25, col: '#9ef0ff', el: 'holy' }, m: 0.6, n: 3 }] }] },
      { n: 6, desc: '처치 시 스킬 쿨타임 1초 감소, 스킬 피해 +25%', effects: [{ on: 'kill', do: [{ k: 'cdr', v: 1 }] }, { stats: { skillDmg: 0.25 } }] },
    ],
  },
  {
    id: 'venom', name: '맹독', col: '#8bdc3a', icon: 'skull',
    tiers: [
      { n: 2, desc: '공격 시 20% 확률로 독', effects: [{ on: 'hit', chance: 0.2, do: [{ k: 'status', s: 'poison' }] }] },
      { n: 4, desc: '독 최대 중첩 +5, 독 피해 +50%', effects: [{ flags: { poisonMax: 5 }, stats: { dotDmg: 0.5 } }] },
      { n: 6, desc: '독 대상 처치 시 독구름 생성', effects: [{ flags: { poisonCloud: 1 } }] },
    ],
  },
  {
    id: 'frost', name: '서리', col: '#a8e4ff', icon: 'snow',
    tiers: [
      { n: 2, desc: '공격 시 12% 확률로 냉기 (5중첩 시 빙결)', effects: [{ on: 'hit', chance: 0.12, do: [{ k: 'status', s: 'chill' }] }] },
      { n: 4, desc: '빙결 대상에게 주는 피해 +35%', effects: [{ stats: { vsFrozen: 0.35 } }] },
      { n: 6, desc: '빙결 해제 시 얼음 폭발 (공격력 250%)', effects: [{ flags: { freezeShatter: 2.5 } }] },
    ],
  },
];

export const CREST_MAP: Record<CrestId, CrestDef> = Object.fromEntries(CRESTS.map((c) => [c.id, c])) as Record<CrestId, CrestDef>;
