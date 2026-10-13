import type { RelicDef } from '../game/types';

/** 유물 44종. rarity: 1 일반 / 2 희귀 / 3 전설 (상점 가격·출현 가중치) */
export const RELICS: RelicDef[] = [
  // ── 화염 ──
  { id: 'ember_heart', name: '잿불 심장', crest: ['flame'], rarity: 1, icon: 'heart', col: '#ff7a2a', desc: '공격 시 10% 확률로 화상. 공격력 +5%', effects: [{ stats: { atk: 0.05 } }, { on: 'hit', chance: 0.1, do: [{ k: 'status', s: 'burn' }] }] },
  { id: 'pyre_candle', name: '장례 촛대', crest: ['flame', 'soul'], rarity: 2, icon: 'candle', col: '#ffb04a', desc: '스킬 적중 시 화상. 스킬 피해 +10%', effects: [{ stats: { skillDmg: 0.1 } }, { on: 'skillHit', do: [{ k: 'status', s: 'burn' }] }] },
  { id: 'cinder_boots', name: '잿더미 장화', crest: ['flame', 'swift'], rarity: 1, icon: 'boot', col: '#e0562a', desc: '대시한 자리에 불길을 남긴다', effects: [{ on: 'dash', do: [{ k: 'nova', r: 22, m: 0.4, el: 'fire', st: 'burn' }] }] },
  { id: 'phoenix_feather', name: '불사조 깃털', crest: ['flame'], rarity: 3, icon: 'feather', col: '#ff9a3a', desc: '런 중 1회 부활 (체력 40%). 화상 대상 피해 +15%', effects: [{ flags: { revive: 1 }, stats: { vsBurn: 0.15 } }] },
  { id: 'magma_core', name: '용암 핵', crest: ['flame', 'fury'], rarity: 2, icon: 'orb', col: '#ff5a1a', desc: '콤보 마지막 타격이 폭발 (공격력 70%, 화상)', effects: [{ on: 'finisher', do: [{ k: 'explode', r: 26, m: 0.7, el: 'fire', st: 'burn' }] }] },
  // ── 출혈 ──
  { id: 'rusted_hook', name: '녹슨 갈고리', crest: ['blood'], rarity: 1, icon: 'claw', col: '#d8203a', desc: '공격 시 12% 확률로 출혈', effects: [{ on: 'hit', chance: 0.12, do: [{ k: 'status', s: 'bleed' }] }] },
  { id: 'vampire_tooth', name: '흡혈귀의 송곳니', crest: ['blood'], rarity: 2, icon: 'tooth', col: '#b0102a', desc: '피해량의 2%만큼 회복. 치명타 피해 +15%', effects: [{ stats: { lifesteal: 0.02, critDmg: 0.15 } }] },
  { id: 'crimson_chalice', name: '진홍 성배', crest: ['blood', 'soul'], rarity: 2, icon: 'chalice', col: '#e03050', desc: '처치 시 체력 2% 회복', effects: [{ on: 'kill', do: [{ k: 'heal', v: 0.02 }] }] },
  { id: 'butcher_cleaver', name: '도살자의 식칼', crest: ['blood', 'fury'], rarity: 1, icon: 'cleaver', col: '#c84040', desc: '출혈 대상에게 주는 피해 +15%. 공격력 +4%', effects: [{ stats: { vsBleed: 0.15, atk: 0.04 } }] },
  { id: 'thorn_crown', name: '가시 면류관', crest: ['blood', 'ward'], rarity: 3, icon: 'crown', col: '#a02040', desc: '피격 시 주변에 가시 폭발 (공격력 150%, 출혈 3중첩)', effects: [{ on: 'hurt', do: [{ k: 'nova', r: 50, m: 1.5, el: 'blood', st: 'bleed' }, { k: 'nova', r: 50, m: 0, st: 'bleed' }, { k: 'nova', r: 50, m: 0, st: 'bleed' }] }] },
  // ── 번개 ──
  { id: 'storm_rod', name: '피뢰침', crest: ['storm'], rarity: 1, icon: 'bolt', col: '#7fd8ff', desc: '공격 시 8% 확률로 감전', effects: [{ on: 'hit', chance: 0.08, do: [{ k: 'status', s: 'shock' }] }] },
  { id: 'thunder_drum', name: '천둥 북', crest: ['storm', 'fury'], rarity: 2, icon: 'drum', col: '#5ab8ff', desc: '콤보 마지막 타격 시 연쇄 번개 (4대상)', effects: [{ on: 'finisher', do: [{ k: 'chain', n: 4, m: 0.6 }] }] },
  { id: 'static_cloak', name: '정전기 망토', crest: ['storm', 'swift'], rarity: 1, icon: 'cloak', col: '#9fe4ff', desc: '대시 시 주변 적 감전', effects: [{ on: 'dash', do: [{ k: 'nova', r: 36, m: 0.3, el: 'thunder', st: 'shock' }] }] },
  { id: 'sky_eye', name: '하늘의 눈', crest: ['storm', 'soul'], rarity: 3, icon: 'eye', col: '#bff0ff', desc: '5초마다 가장 가까운 적에게 낙뢰 (공격력 200%)', effects: [{ on: 'interval', every: 5, do: [{ k: 'strike', m: 2, el: 'thunder' }] }] },
  // ── 그림자 ──
  { id: 'smoke_bomb', name: '연막탄 주머니', crest: ['shadow'], rarity: 1, icon: 'pouch', col: '#7a6aa0', desc: '대시 쿨타임 -15%. 대시 후 1.5초간 공격력 +15%', effects: [{ stats: { dashCdr: 0.15 } }, { on: 'dash', do: [{ k: 'buff', id: 'smoke', stats: { atk: 0.15 }, dur: 1.5 }] }] },
  { id: 'night_mask', name: '밤의 가면', crest: ['shadow'], rarity: 2, icon: 'mask', col: '#6a4aaa', desc: '치명타 확률 +10%', effects: [{ stats: { crit: 0.1 } }] },
  { id: 'twin_shadow', name: '쌍둥이 그림자', crest: ['shadow', 'swift'], rarity: 3, icon: 'twin', col: '#a080ff', desc: '교대 공격이 그림자로 한 번 더 반복된다 (공격력 120%)', effects: [{ on: 'swapHit', icd: 1, do: [{ k: 'echo', m: 1.2 }] }] },
  { id: 'assassin_mark', name: '암살자의 표식', crest: ['shadow', 'blood'], rarity: 2, icon: 'dagger', col: '#8a3aff', desc: '치명타 피해 +30%', effects: [{ stats: { critDmg: 0.3 } }] },
  { id: 'void_lantern', name: '공허의 등불', crest: ['shadow', 'soul'], rarity: 1, icon: 'lantern', col: '#7a5aff', desc: '처치 시 25% 확률로 그림자 칼날 발사', effects: [{ on: 'kill', chance: 0.25, do: [{ k: 'proj', p: { spr: 'blade', spd: 5, life: 60, w: 10, h: 6, home: 0.3, col: '#a080ff', el: 'shadow', pierce: 2 }, m: 1, n: 2 }] }] },
  // ── 수호 ──
  { id: 'oak_buckler', name: '떡갈나무 방패', crest: ['ward'], rarity: 1, icon: 'shield', col: '#c8a060', desc: '받는 피해 -8%', effects: [{ stats: { dmgTaken: -0.08 } }] },
  { id: 'saint_relic', name: '성인의 유골', crest: ['ward', 'soul'], rarity: 2, icon: 'bone', col: '#fff0c0', desc: '방 클리어 시 체력 5% 회복', effects: [{ on: 'roomClear', do: [{ k: 'heal', v: 0.05 }] }] },
  { id: 'iron_will', name: '강철 의지', crest: ['ward', 'fury'], rarity: 1, icon: 'fist', col: '#a0a0b0', desc: '최대 체력 +25', effects: [{ stats: { maxHp: 25 } }] },
  { id: 'aegis_shard', name: '아이기스 파편', crest: ['ward'], rarity: 3, icon: 'shard', col: '#ffe08a', desc: '12초마다 보호막(최대 체력 15%). 보호막 상태 피해 +15%', effects: [{ on: 'interval', every: 12, do: [{ k: 'shield', v: 0.15 }] }, { cond: 'shielded', stats: { allDmg: 0.15 } }] },
  { id: 'guardian_bell', name: '수호자의 종', crest: ['ward', 'storm'], rarity: 2, icon: 'bell', col: '#ffd76a', desc: '피격 시 주변 적 감전 + 넉백', effects: [{ on: 'hurt', do: [{ k: 'nova', r: 60, m: 0.5, el: 'thunder', st: 'shock' }] }] },
  // ── 광폭 ──
  { id: 'berserk_horn', name: '광전사의 뿔피리', crest: ['fury'], rarity: 1, icon: 'horn', col: '#ff6040', desc: '공격력 +8%', effects: [{ stats: { atk: 0.08 } }] },
  { id: 'blood_rage', name: '피의 분노', crest: ['fury', 'blood'], rarity: 2, icon: 'drop', col: '#ff2040', desc: '체력 50% 이하 시 공격 속도 +20%, 흡혈 2%', effects: [{ cond: 'lowHp', stats: { aspd: 0.2, lifesteal: 0.02 } }] },
  { id: 'war_paint', name: '전쟁 물감', crest: ['fury'], rarity: 1, icon: 'paint', col: '#ff5050', desc: '콤보 마지막 타격 피해 +25%', effects: [{ stats: { finDmg: 0.25 } }] },
  { id: 'titan_belt', name: '거인의 허리띠', crest: ['fury', 'ward'], rarity: 2, icon: 'belt', col: '#b07040', desc: '최대 체력 +15%, 공격력 +6%', effects: [{ stats: { hpPct: 0.15, atk: 0.06 } }] },
  { id: 'executioner', name: '처형인의 두건', crest: ['fury'], rarity: 3, icon: 'hood', col: '#802020', desc: '정예·보스에게 주는 피해 +25%', effects: [{ stats: { eliteDmg: 0.25, bossDmg: 0.25 } }] },
  // ── 신속 ──
  { id: 'wind_boots', name: '바람의 장화', crest: ['swift'], rarity: 1, icon: 'boot', col: '#6dffb0', desc: '이동 속도 +12%', effects: [{ stats: { mspd: 0.12 } }] },
  { id: 'feather_cape', name: '깃털 망토', crest: ['swift'], rarity: 2, icon: 'feather', col: '#a0ffd0', desc: '추가 점프 +1', effects: [{ flags: { extraJump: 1 } }] },
  { id: 'relay_baton', name: '계주봉', crest: ['swift', 'fury'], rarity: 2, icon: 'baton', col: '#40e090', desc: '교대 공격 피해 +40%, 교대 시 3초간 공격 속도 +20%', effects: [{ stats: { swapDmg: 0.4 } }, { on: 'swap', do: [{ k: 'buff', id: 'relay', stats: { aspd: 0.2 }, dur: 3 }] }] },
  { id: 'quicksilver', name: '수은 방울', crest: ['swift', 'frost'], rarity: 1, icon: 'potion', col: '#c0e0f0', desc: '공격 속도 +10%', effects: [{ stats: { aspd: 0.1 } }] },
  { id: 'hermes_coin', name: '전령의 동전', crest: ['swift'], rarity: 3, icon: 'coin', col: '#80ffc0', desc: '대시 2회 충전, 공중 대시 +1', effects: [{ flags: { dashCharges: 1, airDash: 1 } }] },
  // ── 영혼 ──
  { id: 'soul_jar', name: '영혼 항아리', crest: ['soul'], rarity: 1, icon: 'jar', col: '#9ef0ff', desc: '스킬 쿨타임 -10%', effects: [{ stats: { cdr: 0.1 } }] },
  { id: 'grimoire', name: '금단의 마도서', crest: ['soul', 'shadow'], rarity: 2, icon: 'book', col: '#6ad0ff', desc: '스킬 피해 +20%', effects: [{ stats: { skillDmg: 0.2 } }] },
  { id: 'spirit_chain', name: '영혼 사슬', crest: ['soul', 'swift'], rarity: 1, icon: 'chain', col: '#a0e0ff', desc: '교대 쿨타임 -20%', effects: [{ stats: { swapCdr: 0.2 } }] },
  { id: 'reaper_hourglass', name: '사신의 모래시계', crest: ['soul'], rarity: 3, icon: 'hourglass', col: '#c0f8ff', desc: '처치 시 교대 쿨타임 1초 감소, 스킬 쿨 0.5초 감소', effects: [{ on: 'kill', do: [{ k: 'swapCd', v: 1 }, { k: 'cdr', v: 0.5 }] }] },
  // ── 맹독 ──
  { id: 'toad_venom', name: '두꺼비 독샘', crest: ['venom'], rarity: 1, icon: 'flask', col: '#8bdc3a', desc: '공격 시 15% 확률로 독', effects: [{ on: 'hit', chance: 0.15, do: [{ k: 'status', s: 'poison' }] }] },
  { id: 'plague_mask', name: '역병 의사 가면', crest: ['venom', 'ward'], rarity: 2, icon: 'mask', col: '#6aa030', desc: '독 대상에게 주는 피해 +20%, 받는 피해 -5%', effects: [{ stats: { vsPoison: 0.2, dmgTaken: -0.05 } }] },
  { id: 'spore_sac', name: '포자 주머니', crest: ['venom', 'soul'], rarity: 1, icon: 'pouch', col: '#a0d050', desc: '스킬 사용 시 주변에 독 폭발', effects: [{ on: 'skill', do: [{ k: 'nova', r: 40, m: 0.4, el: 'poison', st: 'poison' }] }] },
  { id: 'hydra_fang', name: '히드라 독니', crest: ['venom', 'blood'], rarity: 3, icon: 'tooth', col: '#60c020', desc: '지속 피해 +40%. 독·출혈 최대 중첩 +3', effects: [{ stats: { dotDmg: 0.4 }, flags: { poisonMax: 3 } }] },
  // ── 서리 ──
  { id: 'frost_ring', name: '서리 반지', crest: ['frost'], rarity: 1, icon: 'ring', col: '#a8e4ff', desc: '공격 시 10% 확률로 냉기', effects: [{ on: 'hit', chance: 0.1, do: [{ k: 'status', s: 'chill' }] }] },
  { id: 'glacier_heart', name: '빙하의 심장', crest: ['frost', 'ward'], rarity: 2, icon: 'gem', col: '#80d0ff', desc: '피격 시 주변 적에게 냉기 2중첩', effects: [{ on: 'hurt', do: [{ k: 'nova', r: 55, m: 0.3, el: 'frost', st: 'chill' }, { k: 'nova', r: 55, m: 0, st: 'chill' }] }] },
  { id: 'winter_bell', name: '한겨울 방울', crest: ['frost', 'soul'], rarity: 2, icon: 'bell', col: '#c0f0ff', desc: '스킬 적중 시 냉기, 빙결 대상 피해 +15%', effects: [{ on: 'skillHit', do: [{ k: 'status', s: 'chill' }] }, { stats: { vsFrozen: 0.15 } }] },
  { id: 'eternal_ice', name: '영원의 얼음', crest: ['frost'], rarity: 3, icon: 'snow', col: '#e0f8ff', desc: '빙결된 적을 처치하면 얼음 파편 폭발 (공격력 150%)', effects: [{ on: 'kill', need: 'freeze', do: [{ k: 'explode', r: 50, m: 1.5, el: 'frost', st: 'chill' }] }] },
  // ── 복합/기타 ──
  { id: 'gambler_dice', name: '도박사의 주사위', crest: ['fury', 'shadow'], rarity: 2, icon: 'dice', col: '#f0f0f0', desc: '치명타 확률 +6%, 치명타 피해 +20%', effects: [{ stats: { crit: 0.06, critDmg: 0.2 } }] },
  { id: 'golden_idol', name: '황금 우상', crest: ['ward', 'swift'], rarity: 1, icon: 'idol', col: '#ffd040', desc: '금화 획득 +35%', effects: [{ stats: { gold: 0.35 } }] },
  { id: 'kings_seal', name: '왕의 인장', crest: ['soul', 'fury'], rarity: 3, icon: 'ring', col: '#ffe060', desc: '모든 피해 +12%', effects: [{ stats: { allDmg: 0.12 } }] },
];

export const RELIC_MAP: Record<string, RelicDef> = Object.fromEntries(RELICS.map((r) => [r.id, r]));
