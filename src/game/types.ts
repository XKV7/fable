/** 게임 전체에서 공유하는 데이터 정의 타입. 실제 수치는 src/data/* 에 있다. */

export type CharType = 'power' | 'speed' | 'ranged' | 'magic' | 'guard';
/** 희귀도. ★6·★7은 등급만 있고 아직 해당 영웅·무기가 없다 (나오면 ★5로 대체) */
export type Rarity = 3 | 4 | 5 | 6 | 7;
export type Element = 'phys' | 'fire' | 'thunder' | 'poison' | 'frost' | 'shadow' | 'holy' | 'blood';
export type StatusId = 'burn' | 'bleed' | 'poison' | 'shock' | 'chill' | 'freeze' | 'slow';
export type CrestId = 'flame' | 'blood' | 'storm' | 'shadow' | 'ward' | 'fury' | 'swift' | 'soul' | 'venom' | 'frost';

export type StatKey =
  | 'atk' // 공격력 % 증가
  | 'maxHp' // 최대 체력 (고정)
  | 'hpPct' // 최대 체력 %
  | 'crit' // 치명타 확률
  | 'critDmg' // 치명타 피해 추가 배율
  | 'aspd' // 공격 속도 %
  | 'mspd' // 이동 속도 %
  | 'cdr' // 스킬 쿨타임 감소 %
  | 'swapCdr' // 교대 쿨타임 감소 %
  | 'dashCdr' // 대시 쿨타임 감소 %
  | 'dmgTaken' // 받는 피해 % (음수=감소)
  | 'skillDmg'
  | 'swapDmg'
  | 'finDmg' // 콤보 마지막 타 피해
  | 'airDmg'
  | 'dashDmg'
  | 'dotDmg' // 상태이상 지속 피해
  | 'statusChance'
  | 'gold' // 금화 획득 %
  | 'bossDmg'
  | 'eliteDmg'
  | 'vsBurn'
  | 'vsBleed'
  | 'vsPoison'
  | 'vsShock'
  | 'vsFrozen'
  | 'lifesteal' // 피해량 대비 회복 비율
  | 'allDmg';

export type Stats = Partial<Record<StatKey, number>>;

export type Trigger =
  | 'hit'
  | 'crit'
  | 'finisher'
  | 'kill'
  | 'dash'
  | 'swap'
  | 'swapHit'
  | 'skill'
  | 'skillHit'
  | 'hurt'
  | 'roomStart'
  | 'roomClear'
  | 'interval'
  | 'airHit'
  | 'statusApplied'
  | 'parry';

export type CondKey = 'lowHp' | 'fullHp' | 'shielded' | 'airborne' | 'afterDash' | 'afterSwap' | 'comboHigh';

export type EffectDo =
  | { k: 'status'; s: StatusId; n?: number }
  | { k: 'explode'; r: number; m: number; el?: Element; st?: StatusId }
  | { k: 'chain'; n: number; m: number }
  | { k: 'heal'; v: number }
  | { k: 'shield'; v: number }
  | { k: 'proj'; p: ProjDef; m: number; n?: number }
  | { k: 'buff'; id: string; stats: Stats; dur: number; max?: number }
  | { k: 'cdr'; v: number }
  | { k: 'swapCd'; v: number }
  | { k: 'echo'; m: number }
  | { k: 'wave'; m: number }
  | { k: 'gold'; v: number }
  | { k: 'strike'; m: number; el?: Element }
  | { k: 'nova'; r: number; m: number; el?: Element; st?: StatusId }
  | { k: 'slowTime'; dur: number }
  | { k: 'meteor'; m: number }
  | { k: 'summon'; s: SummonDef };

export type FlagKey =
  | 'extraJump'
  | 'airDash'
  | 'dashThrough' // 대시로 통과한 적에게 피해(배율)
  | 'revive'
  | 'swapInvuln' // 교대 시 무적(초)
  | 'burnMax'
  | 'poisonMax'
  | 'bleedRupture' // 출혈 5중첩 시 파열(배율)
  | 'freezeShatter' // 빙결 해제 시 폭발(배율)
  | 'burnSpread' // 화상 대상 처치 시 폭발(배율)
  | 'poisonCloud' // 독 대상 처치 시 독구름
  | 'hurtWave' // 피격 시 반격 파동(배율)
  | 'shieldDmg' // 보호막 있을 때 피해 증가
  | 'dashCharges'
  | 'potionPower'
  | 'shockSpread';

export type Flags = Partial<Record<FlagKey, number>>;

export interface Effect {
  stats?: Stats;
  cond?: CondKey;
  flags?: Flags;
  on?: Trigger;
  chance?: number;
  every?: number; // interval 트리거 주기(초)
  icd?: number; // 내부 쿨타임(초)
  need?: StatusId; // 대상이 이 상태일 때만
  do?: EffectDo[];
}

// ---------------- 액션 DSL ----------------
export type PoseName =
  | 'idle0' | 'idle1' | 'run0' | 'run1' | 'run2' | 'run3' | 'run4' | 'run5'
  | 'jump' | 'fall' | 'dash' | 'hurt' | 'crouch'
  | 'windHigh' | 'slashDown' | 'windLow' | 'slashUp' | 'thrustWind' | 'thrust'
  | 'spin' | 'slamWind' | 'slam' | 'cast' | 'castUp' | 'shootWind' | 'shoot'
  | 'kick' | 'uppercut' | 'guard' | 'throw' | 'dead';

export type SlashArc = 'h' | 'down' | 'up' | 'thrust' | 'spin' | 'slam' | 'x' | 'circle';

export interface SlashFx {
  arc: SlashArc;
  r: number;
  col?: string;
  dx?: number;
  dy?: number;
}

export type ProjSprite = 'arrow' | 'orb' | 'fireball' | 'bolt' | 'dagger' | 'star' | 'bone' | 'scythe' | 'flask' | 'spear' | 'wave' | 'soul' | 'shard' | 'blade' | 'spore' | 'rock';

export interface ProjDef {
  spr: ProjSprite;
  spd: number;
  life: number;
  w: number;
  h: number;
  col?: string;
  grav?: number;
  vy?: number;
  pierce?: number;
  home?: number;
  el?: Element;
  st?: StatusId;
  stn?: number;
  kb?: number;
  up?: number;
  boom?: { r: number; m: number; el?: Element; st?: StatusId; field?: FieldDef };
  ret?: boolean; // 부메랑
  hs?: number;
  ground?: boolean; // 지면을 따라 이동
  landY?: number; // 낙하체(유성·창비): 벽·발판을 무시하고 이 높이에 닿으면 착탄
}

export type FieldVis = 'fire' | 'poison' | 'ice' | 'thunder' | 'void' | 'holy' | 'time' | 'blood' | 'trap' | 'star';

export interface FieldDef {
  vis: FieldVis;
  w: number;
  h: number;
  life: number;
  tick: number;
  m: number;
  el?: Element;
  st?: StatusId;
  pull?: number;
  slow?: boolean;
  follow?: boolean;
  oneShot?: boolean; // 트랩: 적이 닿으면 폭발
}

export type SummonKind = 'skeleton' | 'wisp' | 'clone' | 'star' | 'puppet' | 'turret';

export interface SummonDef {
  kind: SummonKind;
  life: number;
  m: number;
  max?: number;
}

export type ActEvent =
  | { t: number; k: 'hit'; box: [number, number, number, number]; m: number; kb?: number; up?: number; hs?: number; el?: Element; st?: StatusId; stn?: number; shake?: number; fx?: SlashFx; g?: number; fin?: boolean }
  | { t: number; k: 'proj'; p: ProjDef; m: number; n?: number; spread?: number; dx?: number; dy?: number; aim?: boolean; ang?: number }
  | { t: number; k: 'field'; f: FieldDef; m?: number; dx?: number; dy?: number; ground?: boolean }
  | { t: number; k: 'summon'; s: SummonDef; n?: number }
  | { t: number; k: 'buff'; id: string; stats: Stats; dur: number }
  | { t: number; k: 'shield'; v: number }
  | { t: number; k: 'timestop'; dur: number }
  | { t: number; k: 'counter'; dur: number; m: number }
  | { t: number; k: 'tp'; dx: number; toEnemy?: boolean }
  | { t: number; k: 'meteor'; n: number; m: number; spread: number; el?: Element; st?: StatusId; big?: boolean; spr?: ProjSprite }
  | { t: number; k: 'fx'; fx: SlashFx }
  | { t: number; k: 'sfx'; s: string }
  | { t: number; k: 'heal'; v: number }
  | { t: number; k: 'shake'; v: number }
  | { t: number; k: 'plunge'; vy: number; m: number; r: number; el?: Element; st?: StatusId }
  | { t: number; k: 'nova'; r: number; m: number; el?: Element; st?: StatusId; up?: number; pull?: boolean }
  | { t: number; k: 'chain'; n: number; m: number };

export interface ActionDef {
  dur: number;
  pose: [number, PoseName][];
  cancel?: number;
  move?: [number, number, number?][];
  grav?: number;
  inv?: [number, number];
  armor?: boolean;
  ev: ActEvent[];
  landEnd?: boolean;
  airOk?: boolean;
}

export interface ActionMods {
  target: 'skill1' | 'skill2' | 'swap' | 'combo' | 'all';
  dmg?: number; // 피해 배율 가산 (0.3 = +30%)
  count?: number; // 투사체/메테오/소환 수 추가
  cd?: number; // 쿨타임 감소(초)
  size?: number; // 범위 배율 가산
}

export interface SkillDef {
  name: string;
  desc: string;
  cd: number;
  act: ActionDef;
}

export interface Look {
  skin: string;
  hair: string;
  hairStyle: 'short' | 'long' | 'spiky' | 'bald' | 'pony' | 'hood' | 'helm' | 'crown' | 'horned' | 'witch' | 'skull' | 'veil' | 'bun';
  body: string;
  trim: string;
  legs: string;
  boots: string;
  cape?: string;
  eye: string;
  weapon: 'sword' | 'greatsword' | 'daggers' | 'bow' | 'scythe' | 'flask' | 'mace' | 'staff' | 'fists' | 'spear' | 'clock' | 'rapier' | 'lance' | 'orb' | 'shovel' | 'hammer' | 'axe' | 'cannon' | 'lute' | 'claws' | 'strings' | 'talisman' | 'none';
  wcol: string;
  wcol2: string;
  shield?: string;
  build: 'normal' | 'big' | 'slim';
  glow?: string;
  extra?: 'wings' | 'halo' | 'tail' | 'scarf' | 'chains';
}

export interface AwakenDef {
  desc: string;
  effects?: Effect[];
  mods?: ActionMods[];
}

export interface CharDef {
  id: string;
  name: string;
  title: string;
  rarity: Rarity;
  type: CharType;
  crest?: CrestId;
  lore: string;
  atk: number;
  hp: number;
  speed: number;
  look: Look;
  fx: string; // 이펙트 색
  combo: ActionDef[];
  air: ActionDef;
  dashAtk: ActionDef;
  skills: [SkillDef, SkillDef];
  swap: { name: string; desc: string; act: ActionDef };
  passive: { name: string; desc: string; effects: Effect[] };
  awaken: [AwakenDef, AwakenDef, AwakenDef, AwakenDef, AwakenDef];
}

export interface WeaponDef {
  id: string;
  name: string;
  rarity: Rarity;
  crest?: CrestId[];
  atk: number; // 기본 공격력 가산
  desc: string; // {v}는 재련 수치로 치환
  effects: Effect[];
  scale: number; // 재련 1단계당 효과 증가율
  icon: 'sword' | 'dagger' | 'axe' | 'spear' | 'staff' | 'bow' | 'hammer' | 'shield' | 'orb' | 'glove' | 'shovel' | 'whip' | 'hourglass' | 'scythe';
  col: string;
}

export interface RelicDef {
  id: string;
  name: string;
  crest: CrestId[];
  rarity: 1 | 2 | 3;
  desc: string;
  effects: Effect[];
  icon: string; // 아이콘 모양 키
  col: string;
}

export interface CrestTier {
  n: number;
  desc: string;
  effects: Effect[];
}

export interface CrestDef {
  id: CrestId;
  name: string;
  col: string;
  icon: string;
  tiers: [CrestTier, CrestTier, CrestTier];
}
