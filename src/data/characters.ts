import type { CharDef } from '../game/types';
import { melee, multi, P, shot } from './actionKit';
import { CHARACTERS_EX } from './characters2';

/**
 * 영웅 26명 (★3 12 / ★4 9 / ★5 5) — 확장 12명은 characters2.ts. 히트박스 box = [x, y, w, h] — 캐릭터 중심 기준, 오른쪽을 볼 때.
 * 이동 move = [프레임, 앞방향 속도, 수직 속도?]. 모든 수치는 여기서 밸런싱.
 */
export const CHARACTERS: CharDef[] = [
  // ───────────────────────── ★3 ─────────────────────────
  {
    id: 'kael', name: '카엘', title: '떠돌이 검사', rarity: 3, type: 'power', crest: 'fury',
    lore: '이름 없는 전장을 떠돌던 검사. 모든 것을 잃은 뒤에도 검만은 놓지 않았다. 계약자에게 가장 먼저 응답한 영혼.',
    atk: 20, hp: 105, speed: 1.95, fx: '#e8f0ff',
    look: { skin: '#f0c8a0', hair: '#6a4a3a', hairStyle: 'short', body: '#4a6aa0', trim: '#c8b070', legs: '#3a3a52', boots: '#5a3a2a', cape: '#8a2a2a', eye: '#202020', weapon: 'sword', wcol: '#d8e0f0', wcol2: '#8a6a3a', build: 'normal', extra: 'scarf' },
    combo: [
      melee({ dur: 19, t: 6, m: 0.8, box: [-2, -16, 28, 26], w: 'windHigh', s: 'slashDown', fx: { arc: 'down', r: 20 }, hs: 3, lunge: 1.5 }),
      melee({ dur: 19, t: 6, m: 0.85, box: [-2, -16, 28, 26], w: 'windLow', s: 'slashUp', fx: { arc: 'up', r: 20 }, hs: 3, lunge: 1.5 }),
      melee({ dur: 21, t: 7, m: 0.9, box: [0, -8, 32, 12], w: 'thrustWind', s: 'thrust', fx: { arc: 'thrust', r: 26 }, hs: 3, lunge: 3 }),
      melee({ dur: 32, t: 12, m: 1.7, box: [-4, -22, 36, 34], w: 'slamWind', s: 'slam', fx: { arc: 'slam', r: 26 }, kb: 4.5, up: -3, hs: 7, shake: 3, fin: true, sfx: 'swing_heavy', lunge: 2 }),
    ],
    air: melee({ dur: 20, t: 5, m: 0.8, box: [-6, -18, 32, 32], w: 'windHigh', s: 'slashDown', fx: { arc: 'down', r: 20 }, air: true, grav: 0.3, hs: 3 }),
    dashAtk: melee({ dur: 22, t: 5, m: 1.1, box: [0, -8, 36, 14], w: 'thrustWind', s: 'thrust', fx: { arc: 'thrust', r: 30 }, lunge: 5, kb: 3, hs: 4 }),
    skills: [
      { name: '회오리 베기', desc: '몸을 회전시키며 주변을 세 번 벤다. 마지막 타격이 적을 띄운다.', cd: 6, act: multi({ dur: 30, times: [6, 13, 20], m: 0.65, lastM: 0.9, lastUp: -4, box: [-26, -20, 52, 32], pose: [[0, 'spin'], [10, 'slashUp'], [17, 'spin']], fx: { arc: 'spin', r: 26 }, sfx: 'swing_heavy', air: true, grav: 0.2, hs: 3 }) },
      { name: '섬광 찌르기', desc: '눈 깜짝할 사이에 전방으로 돌진하며 꿰뚫는다. 돌진 중 무적.', cd: 8, act: { dur: 26, pose: [[0, 'thrustWind'], [4, 'thrust']], move: [[3, 10], [13, 0]], inv: [0, 16], ev: [{ t: 3, k: 'sfx', s: 'dash' }, { t: 6, k: 'hit', box: [-30, -10, 46, 18], m: 1.0, kb: 1, hs: 2, fx: { arc: 'thrust', r: 34 } }, { t: 13, k: 'hit', box: [-50, -12, 60, 22], m: 1.4, kb: 4, hs: 6, shake: 3, fx: { arc: 'x', r: 22 } }] } },
    ],
    swap: { name: '교대: 결의의 일섬', desc: '등장과 동시에 전방을 크게 베어 적을 띄운다.', act: melee({ dur: 26, t: 8, m: 2.0, box: [-6, -22, 50, 36], w: 'windHigh', s: 'slashDown', fx: { arc: 'h', r: 32 }, lunge: 6, up: -3.5, kb: 3, hs: 8, shake: 4, inv: [0, 12], sfx: 'swing_heavy' }) },
    passive: { name: '투지', desc: '콤보 마지막 타격 적중 시 3초간 공격력 +15%', effects: [{ on: 'finisher', do: [{ k: 'buff', id: 'kael_p', stats: { atk: 0.15 }, dur: 3 }] }] },
    awaken: [
      { desc: '회오리 베기 피해 +30%', mods: [{ target: 'skill1', dmg: 0.3 }] },
      { desc: '공격력 +8%', effects: [{ stats: { atk: 0.08 } }] },
      { desc: '섬광 찌르기 쿨타임 -2초', mods: [{ target: 'skill2', cd: 2 }] },
      { desc: '콤보 마지막 타격이 충격파를 일으킴', effects: [{ on: 'finisher', do: [{ k: 'wave', m: 0.6 }] }] },
      { desc: '모든 기술 피해 +20%', mods: [{ target: 'all', dmg: 0.2 }] },
    ],
  },
  {
    id: 'rina', name: '리나', title: '숲의 사냥꾼', rarity: 3, type: 'ranged', crest: 'swift',
    lore: '망국의 숲을 지키던 사냥꾼. 화살 한 발로 두 마리의 늑대를 꿰뚫었다는 전설이 있다.',
    atk: 17, hp: 88, speed: 2.05, fx: '#b8f080',
    look: { skin: '#f0d0b0', hair: '#c88a3a', hairStyle: 'pony', body: '#3a7a3a', trim: '#a0c060', legs: '#5a4a2a', boots: '#3a2a1a', cape: '#2a5a2a', eye: '#2a6a2a', weapon: 'bow', wcol: '#a07040', wcol2: '#f0f0d0', build: 'slim' },
    combo: [
      shot({ dur: 15, t: 5, m: 0.7, p: P.arrow(), sfx: 'arrow' }),
      shot({ dur: 15, t: 5, m: 0.7, p: P.arrow(), sfx: 'arrow' }),
      shot({ dur: 24, t: 8, m: 0.6, p: P.arrow('#f0f0a0', { pierce: 1 }), n: 3, spread: 9, sfx: 'arrow', extra: [] }),
    ],
    air: shot({ dur: 16, t: 4, m: 0.7, p: P.arrow(), ang: 35, air: true, grav: 0.4, sfx: 'arrow' }),
    dashAtk: shot({ dur: 24, t: 8, m: 1.1, p: P.arrow('#ffffa0', { pierce: 3, spd: 9 }), move: [[0, -4, -3], [10, 0]], air: true, sfx: 'arrow', w: 'jump', s: 'shoot' }),
    skills: [
      { name: '관통 화살', desc: '힘껏 당긴 화살이 일직선상의 모든 적을 꿰뚫는다.', cd: 6, act: shot({ dur: 30, t: 16, m: 2.4, p: { spr: 'arrow', spd: 10, life: 60, w: 18, h: 6, col: '#ffff80', pierce: 99, kb: 4, hs: 5 }, sfx: 'arrow', w: 'shootWind', extra: [{ t: 4, k: 'sfx', s: 'skill' }, { t: 16, k: 'shake', v: 2 }] }) },
      { name: '덫 깔고 도약', desc: '발밑에 폭발 덫을 남기고 뒤로 크게 도약한다. 덫은 적이 닿으면 폭발해 출혈을 일으킨다.', cd: 9, act: { dur: 26, pose: [[0, 'crouch'], [4, 'jump']], move: [[3, -4.5, -4.2], [22, 0]], airOk: true, inv: [0, 14], ev: [{ t: 2, k: 'field', f: { vis: 'trap', w: 18, h: 8, life: 600, tick: 1, m: 2.2, oneShot: true, st: 'bleed' }, dx: 0, ground: true }, { t: 3, k: 'sfx', s: 'jump' }] } },
    ],
    swap: { name: '교대: 화살비', desc: '하늘로 화살을 쏘아 전방에 화살비를 내린다.', act: { dur: 24, pose: [[0, 'shootWind'], [6, 'castUp']], inv: [0, 10], ev: [{ t: 6, k: 'sfx', s: 'arrow' }, { t: 8, k: 'meteor', n: 8, m: 0.65, spread: 70, spr: 'arrow' }] } },
    passive: { name: '사냥 본능', desc: '치명타 확률 +10%. 치명타 시 2초간 공격 속도 +12%', effects: [{ stats: { crit: 0.1 } }, { on: 'crit', do: [{ k: 'buff', id: 'rina_p', stats: { aspd: 0.12 }, dur: 2 }] }] },
    awaken: [
      { desc: '관통 화살 피해 +35%', mods: [{ target: 'skill1', dmg: 0.35 }] },
      { desc: '화살비 화살 +4발', mods: [{ target: 'swap', count: 4 }] },
      { desc: '치명타 피해 +25%', effects: [{ stats: { critDmg: 0.25 } }] },
      { desc: '기본 공격 피해 +25%', mods: [{ target: 'combo', dmg: 0.25 }] },
      { desc: '관통 화살 쿨타임 -2초, 이동 속도 +10%', mods: [{ target: 'skill1', cd: 2 }], effects: [{ stats: { mspd: 0.1 } }] },
    ],
  },
  {
    id: 'bor', name: '보르', title: '맨손 수도승', rarity: 3, type: 'speed', crest: 'swift',
    lore: '무너진 산사의 마지막 수도승. 무기를 거부하고 단련된 주먹 하나로 망자의 군세와 맞섰다.',
    atk: 15, hp: 100, speed: 2.15, fx: '#ffd080',
    look: { skin: '#d8a070', hair: '#202020', hairStyle: 'bald', body: '#d08030', trim: '#f0e0a0', legs: '#a05a20', boots: '#5a3a1a', eye: '#101010', weapon: 'fists', wcol: '#e0d0b0', wcol2: '#8a5a3a', build: 'normal', extra: 'chains' },
    combo: [
      melee({ dur: 11, t: 3, m: 0.45, box: [0, -10, 20, 14], w: 'guard', s: 'thrust', fx: { arc: 'thrust', r: 12 }, hs: 2, lunge: 1.5, sfx: 'swing' }),
      melee({ dur: 11, t: 3, m: 0.45, box: [0, -10, 20, 14], w: 'thrustWind', s: 'thrust', fx: { arc: 'thrust', r: 12 }, hs: 2, lunge: 1.5 }),
      melee({ dur: 14, t: 4, m: 0.55, box: [0, -6, 22, 14], w: 'guard', s: 'kick', fx: { arc: 'h', r: 14 }, hs: 2, lunge: 2 }),
      melee({ dur: 16, t: 5, m: 0.6, box: [0, -20, 20, 24], w: 'crouch', s: 'uppercut', fx: { arc: 'up', r: 16 }, up: -4.5, hs: 3, lunge: 1 }),
      melee({ dur: 24, t: 8, m: 1.2, box: [-4, -14, 30, 22], w: 'spin', s: 'kick', fx: { arc: 'spin', r: 20 }, kb: 5.5, hs: 6, shake: 2, fin: true, lunge: 3 }),
    ],
    air: melee({ dur: 16, t: 4, m: 0.6, box: [0, -6, 22, 18], w: 'jump', s: 'kick', fx: { arc: 'down', r: 14 }, air: true, grav: 0.3, hs: 2 }),
    dashAtk: melee({ dur: 20, t: 5, m: 0.9, box: [0, -12, 26, 18], w: 'dash', s: 'kick', fx: { arc: 'thrust', r: 18 }, lunge: 5.5, up: -2, hs: 3 }),
    skills: [
      { name: '승천권', desc: '솟구치는 어퍼컷 연타로 적을 공중으로 띄운다.', cd: 5, act: multi({ dur: 26, times: [4, 9, 14], m: 0.6, lastM: 0.9, up: -5, box: [-4, -30, 26, 40], pose: [[0, 'crouch'], [3, 'uppercut']], fx: { arc: 'up', r: 18 }, move: [[3, 1.5, -5.5], [16, 0]], air: true, sfx: 'swing' }) },
      { name: '백열권', desc: '눈에 보이지 않는 속도로 주먹을 퍼붓고 마지막 일격으로 날려 보낸다.', cd: 8, act: multi({ dur: 40, times: [4, 7, 10, 13, 16, 19, 22, 25, 31], m: 0.3, lastM: 1.2, lastKb: 6, box: [0, -14, 28, 20], pose: [[0, 'thrust'], [5, 'guard'], [8, 'thrust'], [11, 'kick'], [14, 'thrust'], [17, 'guard'], [20, 'thrust'], [23, 'kick'], [28, 'thrust']], fx: { arc: 'thrust', r: 14 }, armor: true, hs: 1 }) },
    ],
    swap: { name: '교대: 비각', desc: '날아드는 비행 발차기로 적을 멀리 날려 보낸다.', act: melee({ dur: 24, t: 6, m: 1.8, box: [-4, -14, 34, 22], w: 'dash', s: 'kick', fx: { arc: 'thrust', r: 26 }, lunge: 8, kb: 7, hs: 7, shake: 3, inv: [0, 12] }) },
    passive: { name: '연타의 극의', desc: '콤보 15 이상일 때 공격 속도 +20%, 이동 속도 +10%', effects: [{ cond: 'comboHigh', stats: { aspd: 0.2, mspd: 0.1 } }] },
    awaken: [
      { desc: '승천권 피해 +30%', mods: [{ target: 'skill1', dmg: 0.3 }] },
      { desc: '공격 속도 +8%', effects: [{ stats: { aspd: 0.08 } }] },
      { desc: '백열권 쿨타임 -2초', mods: [{ target: 'skill2', cd: 2 }] },
      { desc: '교대 공격 피해 +50%', mods: [{ target: 'swap', dmg: 0.5 }] },
      { desc: '모든 기술 피해 +20%, 치명타 +5%', mods: [{ target: 'all', dmg: 0.2 }], effects: [{ stats: { crit: 0.05 } }] },
    ],
  },
  {
    id: 'selin', name: '셀린', title: '불꽃 연금술사', rarity: 3, type: 'magic', crest: 'flame',
    lore: '왕실 연금술 학회의 낙제생. 폭발하는 플라스크만큼은 누구보다 잘 만든다. 본인은 의도한 것이라 주장한다.',
    atk: 16, hp: 85, speed: 1.85, fx: '#ff9a40',
    look: { skin: '#f8d8c0', hair: '#e04020', hairStyle: 'bun', body: '#6a3a8a', trim: '#f0a040', legs: '#3a2a4a', boots: '#2a1a2a', eye: '#3a1a0a', weapon: 'flask', wcol: '#ff7a2a', wcol2: '#c0e0f0', build: 'slim' },
    combo: [
      shot({ dur: 18, t: 6, m: 0.7, p: { spr: 'flask', spd: 3.6, vy: -2.6, grav: 0.18, life: 80, w: 6, h: 6, col: '#ff7a2a', boom: { r: 18, m: 1, el: 'fire', st: 'burn' } }, w: 'throw', s: 'shoot', sfx: 'proj' }),
      shot({ dur: 18, t: 6, m: 0.7, p: { spr: 'flask', spd: 3.0, vy: -3.0, grav: 0.18, life: 80, w: 6, h: 6, col: '#ff9a2a', boom: { r: 18, m: 1, el: 'fire', st: 'burn' } }, w: 'throw', s: 'shoot', sfx: 'proj' }),
      shot({ dur: 26, t: 9, m: 0.6, n: 3, spread: 14, p: { spr: 'flask', spd: 3.4, vy: -2.8, grav: 0.18, life: 80, w: 6, h: 6, col: '#ffba2a', boom: { r: 20, m: 1, el: 'fire', st: 'burn' } }, w: 'throw', s: 'castUp', sfx: 'proj' }),
    ],
    air: shot({ dur: 16, t: 4, m: 0.7, ang: 50, air: true, grav: 0.4, p: { spr: 'flask', spd: 3.5, grav: 0.2, life: 60, w: 6, h: 6, col: '#ff7a2a', boom: { r: 18, m: 1, el: 'fire', st: 'burn' } }, w: 'throw', s: 'shoot' }),
    dashAtk: { dur: 18, pose: [[0, 'dash'], [6, 'throw']], move: [[0, 3], [10, 0]], ev: [{ t: 2, k: 'field', f: { vis: 'fire', w: 40, h: 14, life: 120, tick: 15, m: 0.25, el: 'fire', st: 'burn' }, dx: -10, ground: true }, { t: 2, k: 'sfx', s: 'burn' }] },
    skills: [
      { name: '연소의 장', desc: '전방 바닥에 오래 타오르는 화염 지대를 만든다.', cd: 7, act: { dur: 24, pose: [[0, 'castUp'], [8, 'cast']], ev: [{ t: 8, k: 'sfx', s: 'burn' }, { t: 8, k: 'field', f: { vis: 'fire', w: 80, h: 22, life: 200, tick: 14, m: 0.32, el: 'fire', st: 'burn' }, dx: 40, ground: true }] } },
      { name: '대폭발 플라스크', desc: '불안정한 대형 플라스크를 던져 넓은 범위를 폭파한다.', cd: 10, act: shot({ dur: 30, t: 12, m: 1, p: { spr: 'flask', spd: 3.4, vy: -3.6, grav: 0.18, life: 90, w: 10, h: 10, col: '#ff3a1a', boom: { r: 50, m: 2.8, el: 'fire', st: 'burn' } }, w: 'castUp', s: 'throw', extra: [{ t: 2, k: 'sfx', s: 'skill' }] }) },
    ],
    swap: { name: '교대: 화염 고리', desc: '등장하며 주변으로 불꽃 고리를 폭발시킨다.', act: { dur: 24, pose: [[0, 'castUp'], [8, 'cast']], inv: [0, 10], ev: [{ t: 6, k: 'sfx', s: 'explode' }, { t: 6, k: 'nova', r: 56, m: 1.6, el: 'fire', st: 'burn', up: -2 }, { t: 6, k: 'shake', v: 3 }] } },
    passive: { name: '연소 촉진', desc: '지속 피해 +30%, 화상 대상에게 주는 피해 +10%', effects: [{ stats: { dotDmg: 0.3, vsBurn: 0.1 } }] },
    awaken: [
      { desc: '연소의 장 크기 +40%', mods: [{ target: 'skill1', size: 0.4 }] },
      { desc: '대폭발 플라스크 피해 +35%', mods: [{ target: 'skill2', dmg: 0.35 }] },
      { desc: '화상 최대 중첩 +2', effects: [{ flags: { burnMax: 2 } }] },
      { desc: '기본 공격 플라스크 +1개', mods: [{ target: 'combo', count: 1 }] },
      { desc: '스킬 쿨타임 -20%', effects: [{ stats: { cdr: 0.2 } }] },
    ],
  },
  {
    id: 'nox', name: '녹스', title: '해골 강령술사', rarity: 3, type: 'magic', crest: 'soul',
    lore: '죽음을 연구하다 스스로 죽음이 된 마법사. 그가 부르는 해골들은 생전의 충성을 기억한다.',
    atk: 15, hp: 90, speed: 1.8, fx: '#b0ff90',
    look: { skin: '#e8e0c8', hair: '#3a2a4a', hairStyle: 'hood', body: '#2a2a3a', trim: '#7aff6a', legs: '#1a1a2a', boots: '#101018', cape: '#1a1a2a', eye: '#7aff6a', weapon: 'staff', wcol: '#e8e0c8', wcol2: '#5a4a3a', build: 'slim', glow: '#7aff6a' },
    combo: [
      melee({ dur: 18, t: 6, m: 0.6, box: [-2, -14, 26, 22], w: 'windHigh', s: 'slashDown', fx: { arc: 'down', r: 16, col: '#b0ff90' }, hs: 3 }),
      shot({ dur: 18, t: 6, m: 0.75, p: { spr: 'bone', spd: 5, life: 60, w: 10, h: 6, col: '#e8e0c8', pierce: 1, kb: 2 }, s: 'cast' }),
      { dur: 26, pose: [[0, 'castUp'], [8, 'cast']], cancel: 18, ev: [{ t: 8, k: 'sfx', s: 'crumble' }, { t: 10, k: 'hit', box: [16, -24, 34, 34], m: 1.3, up: -4, hs: 5, fin: true, fx: { arc: 'up', r: 18, col: '#e8e0c8', dx: 32 } }] },
    ],
    air: shot({ dur: 16, t: 4, m: 0.7, ang: 40, air: true, grav: 0.4, p: { spr: 'bone', spd: 5, life: 50, w: 10, h: 6, col: '#e8e0c8' }, s: 'cast' }),
    dashAtk: { dur: 18, pose: [[0, 'dash'], [4, 'cast']], move: [[0, 3], [8, 0]], ev: [{ t: 4, k: 'nova', r: 28, m: 0.8, el: 'shadow' }, { t: 4, k: 'sfx', s: 'crumble' }] },
    skills: [
      { name: '망자 소환', desc: '해골 전사 2기를 소환해 함께 싸운다 (최대 4기, 10초).', cd: 9, act: { dur: 26, pose: [[0, 'castUp']], ev: [{ t: 10, k: 'sfx', s: 'cast' }, { t: 10, k: 'summon', s: { kind: 'skeleton', life: 600, m: 0.55, max: 4 }, n: 2 }] } },
      { name: '영혼 폭발', desc: '주변에 영혼 폭발을 일으키고 추적하는 영혼탄 5발을 흩뿌린다.', cd: 8, act: { dur: 28, pose: [[0, 'castUp'], [10, 'cast']], ev: [{ t: 10, k: 'sfx', s: 'explode' }, { t: 10, k: 'nova', r: 50, m: 1.2, el: 'shadow' }, { t: 10, k: 'proj', p: { spr: 'soul', spd: 3.5, life: 100, w: 8, h: 8, home: 0.3, col: '#b0ff90', el: 'shadow' }, m: 0.6, n: 5, spread: 30, ang: -60 }] } },
    ],
    swap: { name: '교대: 망자의 손', desc: '땅에서 망자의 손이 솟아 적을 끌어당기며 피해를 준다.', act: { dur: 22, pose: [[0, 'castUp']], inv: [0, 10], ev: [{ t: 4, k: 'sfx', s: 'crumble' }, { t: 4, k: 'field', f: { vis: 'void', w: 90, h: 30, life: 80, tick: 10, m: 0.35, pull: 0.7, el: 'shadow' }, dx: 30, ground: true }, { t: 4, k: 'hit', box: [-10, -20, 80, 30], m: 1.2, up: -3, hs: 5 }] } },
    passive: { name: '망자의 군세', desc: '처치 시 20% 확률로 해골 전사 소환 (최대 4기)', effects: [{ on: 'kill', chance: 0.2, do: [{ k: 'summon', s: { kind: 'skeleton', life: 480, m: 0.5, max: 4 } }] }] },
    awaken: [
      { desc: '망자 소환 수 +1', mods: [{ target: 'skill1', count: 1 }] },
      { desc: '영혼 폭발 영혼탄 +3', mods: [{ target: 'skill2', count: 3 }] },
      { desc: '스킬 쿨타임 -15%', effects: [{ stats: { cdr: 0.15 } }] },
      { desc: '소환수 피해 +40%', mods: [{ target: 'skill1', dmg: 0.4 }] },
      { desc: '처치 시 체력 1% 회복, 모든 기술 피해 +20%', effects: [{ on: 'kill', do: [{ k: 'heal', v: 0.01 }] }], mods: [{ target: 'all', dmg: 0.2 }] },
    ],
  },
  {
    id: 'raika', name: '라이카', title: '번개 창술사', rarity: 3, type: 'ranged', crest: 'storm',
    lore: '폭풍의 산에서 벼락을 맞고도 살아남은 창병. 그날 이후 그녀의 창끝에는 늘 번개가 깃든다.',
    atk: 18, hp: 95, speed: 2.0, fx: '#80d8ff',
    look: { skin: '#f0d0b8', hair: '#f0f0ff', hairStyle: 'spiky', body: '#2a4a8a', trim: '#80d8ff', legs: '#2a2a4a', boots: '#1a1a3a', cape: '#4a6aaa', eye: '#40a0ff', weapon: 'spear', wcol: '#c0e8ff', wcol2: '#5a4a3a', build: 'slim' },
    combo: [
      melee({ dur: 17, t: 5, m: 0.7, box: [0, -8, 42, 12], w: 'thrustWind', s: 'thrust', fx: { arc: 'thrust', r: 38 }, hs: 3, lunge: 2 }),
      melee({ dur: 17, t: 5, m: 0.7, box: [0, -8, 42, 12], w: 'thrustWind', s: 'thrust', fx: { arc: 'thrust', r: 38 }, hs: 3, lunge: 2 }),
      melee({ dur: 20, t: 6, m: 0.8, box: [-6, -20, 40, 30], w: 'windLow', s: 'slashUp', fx: { arc: 'up', r: 26 }, up: -3, hs: 3 }),
      melee({ dur: 28, t: 10, m: 1.3, box: [0, -8, 48, 14], w: 'thrustWind', s: 'thrust', fx: { arc: 'thrust', r: 44, col: '#c0f0ff' }, kb: 4, hs: 6, fin: true, el: 'thunder', st: 'shock', lunge: 4, extra: [{ t: 10, k: 'sfx', s: 'thunder' }] }),
    ],
    air: { dur: 60, pose: [[0, 'thrust']], landEnd: true, airOk: true, ev: [{ t: 2, k: 'plunge', vy: 7, m: 1.2, r: 24, el: 'thunder', st: 'shock' }] },
    dashAtk: melee({ dur: 22, t: 5, m: 1.1, box: [0, -8, 50, 14], w: 'thrustWind', s: 'thrust', fx: { arc: 'thrust', r: 46 }, lunge: 6, kb: 3, hs: 4 }),
    skills: [
      { name: '뇌전 돌격', desc: '번개가 되어 전방을 관통한다. 지나간 자리에 전류가 흐른다.', cd: 7, act: { dur: 26, pose: [[0, 'thrustWind'], [3, 'thrust']], move: [[3, 11], [13, 0]], inv: [0, 16], ev: [{ t: 3, k: 'sfx', s: 'thunder' }, { t: 7, k: 'hit', box: [-40, -12, 56, 22], m: 1.6, el: 'thunder', st: 'shock', kb: 2, hs: 4, fx: { arc: 'thrust', r: 40, col: '#c0f0ff' } }, { t: 4, k: 'field', f: { vis: 'thunder', w: 110, h: 16, life: 90, tick: 15, m: 0.25, el: 'thunder', st: 'shock' }, dx: 50, ground: true }] } },
      { name: '낙뢰창', desc: '창을 던져 꽂힌 자리에 낙뢰를 떨어뜨린다.', cd: 9, act: shot({ dur: 26, t: 10, m: 1.2, p: { spr: 'spear', spd: 8, life: 50, w: 20, h: 4, col: '#c0e8ff', pierce: 99, kb: 3, boom: { r: 34, m: 2.2, el: 'thunder', st: 'shock' } }, w: 'windHigh', s: 'throw', sfx: 'swing_heavy' }) },
    ],
    swap: { name: '교대: 번개 강림', desc: '번개와 함께 내려와 주변 적에게 연쇄 번개를 퍼뜨린다.', act: { dur: 24, pose: [[0, 'castUp'], [6, 'slam']], inv: [0, 10], ev: [{ t: 6, k: 'sfx', s: 'thunder' }, { t: 6, k: 'nova', r: 44, m: 1.4, el: 'thunder', st: 'shock', up: -2 }, { t: 7, k: 'chain', n: 5, m: 0.9 }, { t: 6, k: 'shake', v: 3 }] } },
    passive: { name: '뇌전 체질', desc: '공격 시 10% 확률로 감전. 감전 대상에게 주는 피해 +10%', effects: [{ on: 'hit', chance: 0.1, do: [{ k: 'status', s: 'shock' }] }, { stats: { vsShock: 0.1 } }] },
    awaken: [
      { desc: '뇌전 돌격 피해 +30%', mods: [{ target: 'skill1', dmg: 0.3 }] },
      { desc: '감전 확률 강화: 공격 시 추가 10% 감전', effects: [{ on: 'hit', chance: 0.1, do: [{ k: 'status', s: 'shock' }] }] },
      { desc: '낙뢰창 쿨타임 -2초', mods: [{ target: 'skill2', cd: 2 }] },
      { desc: '콤보 마지막 타격에 연쇄 번개', effects: [{ on: 'finisher', do: [{ k: 'chain', n: 3, m: 0.6 }] }] },
      { desc: '모든 기술 피해 +20%', mods: [{ target: 'all', dmg: 0.2 }] },
    ],
  },
  // ───────────────────────── ★4 ─────────────────────────
  {
    id: 'balt', name: '발트하르', title: '몰락한 기사', rarity: 4, type: 'power', crest: 'fury',
    lore: '왕국 최강이라 불린 기사단장. 끝없는 왕의 배신에 쓰러졌으나, 그 원한은 대검보다 무겁다.',
    atk: 27, hp: 125, speed: 1.7, fx: '#ffb080',
    look: { skin: '#d8b090', hair: '#505060', hairStyle: 'helm', body: '#5a5a6a', trim: '#b08a3a', legs: '#3a3a4a', boots: '#2a2a32', cape: '#4a1a1a', eye: '#ff4a2a', weapon: 'greatsword', wcol: '#c0c4d0', wcol2: '#6a3a2a', build: 'big' },
    combo: [
      melee({ dur: 32, t: 13, m: 1.5, box: [-6, -24, 50, 36], w: 'windHigh', s: 'slashDown', fx: { arc: 'h', r: 34 }, hs: 6, kb: 3, armor: true, sfx: 'swing_heavy', lunge: 2, shake: 2 }),
      melee({ dur: 34, t: 14, m: 1.7, box: [0, -30, 46, 42], w: 'slamWind', s: 'slam', fx: { arc: 'slam', r: 32 }, hs: 7, up: -2, armor: true, sfx: 'swing_heavy', lunge: 2, shake: 3 }),
      melee({ dur: 44, t: 18, m: 2.7, box: [-30, -28, 80, 42], w: 'spin', s: 'slashDown', fx: { arc: 'spin', r: 40 }, hs: 10, kb: 6, up: -3, armor: true, fin: true, sfx: 'swing_heavy', shake: 5, lunge: 3 }),
    ],
    air: { dur: 70, pose: [[0, 'slamWind'], [6, 'slam']], landEnd: true, airOk: true, armor: true, ev: [{ t: 4, k: 'plunge', vy: 8, m: 1.8, r: 36 }] },
    dashAtk: melee({ dur: 26, t: 6, m: 1.3, box: [0, -16, 34, 26], w: 'dash', s: 'guard', fx: { arc: 'thrust', r: 20 }, lunge: 6, kb: 6, hs: 5, armor: true }),
    skills: [
      { name: '대지 가르기', desc: '대검으로 땅을 내리쳐 전방으로 뻗어나가는 충격파를 일으킨다.', cd: 7, act: { dur: 36, pose: [[0, 'slamWind'], [14, 'slam']], armor: true, ev: [{ t: 12, k: 'sfx', s: 'swing_heavy' }, { t: 14, k: 'hit', box: [0, -20, 40, 32], m: 1.4, up: -3, hs: 6, shake: 4, fx: { arc: 'slam', r: 30 } }, { t: 14, k: 'proj', p: { spr: 'wave', spd: 4.5, life: 50, w: 16, h: 22, col: '#ffb080', pierce: 99, kb: 3, up: -3, ground: true }, m: 1.6, dx: 20, dy: 0 }] } },
      { name: '처형', desc: '긴 준비 끝에 모든 것을 짓누르는 일격을 내리친다. 시전 중 경직 무시.', cd: 11, act: { dur: 52, pose: [[0, 'slamWind'], [26, 'slam']], armor: true, ev: [{ t: 4, k: 'sfx', s: 'skill' }, { t: 24, k: 'sfx', s: 'swing_heavy' }, { t: 26, k: 'hit', box: [-10, -40, 64, 52], m: 4.8, kb: 5, up: -5, hs: 14, shake: 8, fx: { arc: 'slam', r: 44, col: '#ffd0a0' } }, { t: 26, k: 'sfx', s: 'explode' }] } },
    ],
    swap: { name: '교대: 대검 낙하', desc: '공중에서 대검과 함께 떨어져 착지 지점을 분쇄한다.', act: { dur: 60, pose: [[0, 'slamWind'], [10, 'slam']], move: [[0, 2, -5]], landEnd: true, airOk: true, armor: true, inv: [0, 20], ev: [{ t: 10, k: 'plunge', vy: 9, m: 2.6, r: 46 }] } },
    passive: { name: '몰락의 분노', desc: '모든 공격이 경직되지 않는다. 체력 50% 이하일 때 공격력 +25%', effects: [{ cond: 'lowHp', stats: { atk: 0.25 } }] },
    awaken: [
      { desc: '대지 가르기 피해 +30%', mods: [{ target: 'skill1', dmg: 0.3 }] },
      { desc: '최대 체력 +30', effects: [{ stats: { maxHp: 30 } }] },
      { desc: '처형 쿨타임 -3초', mods: [{ target: 'skill2', cd: 3 }] },
      { desc: '공격 속도 +12%', effects: [{ stats: { aspd: 0.12 } }] },
      { desc: '모든 기술 피해 +25%', mods: [{ target: 'all', dmg: 0.25 }] },
    ],
  },
  {
    id: 'sien', name: '시엔', title: '그림자 암살자', rarity: 4, type: 'speed', crest: 'shadow',
    lore: '왕실 첩보단 "그림자 손"의 마지막 단원. 그녀가 지나간 자리에는 발소리조차 남지 않는다.',
    atk: 19, hp: 85, speed: 2.4, fx: '#c0a0ff',
    look: { skin: '#e8d0c8', hair: '#2a1a3a', hairStyle: 'veil', body: '#2a2040', trim: '#9a6bff', legs: '#1a1428', boots: '#100c18', cape: '#3a2a5a', eye: '#c0a0ff', weapon: 'daggers', wcol: '#d0d0e8', wcol2: '#4a3a5a', build: 'slim', extra: 'scarf' },
    combo: [
      melee({ dur: 11, t: 3, m: 0.42, box: [0, -12, 24, 18], w: 'guard', s: 'slashDown', fx: { arc: 'down', r: 14 }, hs: 2, lunge: 2 }),
      melee({ dur: 11, t: 3, m: 0.42, box: [0, -12, 24, 18], w: 'windLow', s: 'slashUp', fx: { arc: 'up', r: 14 }, hs: 2, lunge: 2 }),
      melee({ dur: 12, t: 4, m: 0.48, box: [0, -10, 26, 16], w: 'thrustWind', s: 'thrust', fx: { arc: 'thrust', r: 18 }, hs: 2, lunge: 2.5 }),
      melee({ dur: 13, t: 4, m: 0.5, box: [-10, -14, 38, 22], w: 'spin', s: 'slashDown', fx: { arc: 'spin', r: 18 }, hs: 2, lunge: 1 }),
      melee({ dur: 22, t: 7, m: 1.1, box: [-2, -16, 32, 26], w: 'windHigh', s: 'slashDown', fx: { arc: 'x', r: 20 }, hs: 5, kb: 4, fin: true, lunge: 4 }),
    ],
    air: melee({ dur: 15, t: 4, m: 0.55, box: [-14, -16, 36, 30], w: 'spin', s: 'spin', fx: { arc: 'spin', r: 16 }, air: true, grav: 0.25, hs: 2 }),
    dashAtk: melee({ dur: 20, t: 4, m: 0.95, box: [-30, -12, 50, 20], w: 'dash', s: 'thrust', fx: { arc: 'thrust', r: 34 }, lunge: 7, hs: 3, inv: [0, 8] }),
    skills: [
      { name: '그림자 순보', desc: '가장 가까운 적의 등 뒤로 순간이동해 급소를 벤다.', cd: 6, act: { dur: 24, pose: [[0, 'dash'], [6, 'slashDown']], inv: [0, 14], ev: [{ t: 2, k: 'sfx', s: 'dash' }, { t: 3, k: 'tp', dx: 30, toEnemy: true }, { t: 8, k: 'hit', box: [-6, -16, 34, 28], m: 2.2, kb: 3, hs: 7, el: 'shadow', fx: { arc: 'x', r: 22, col: '#c0a0ff' } }] } },
      { name: '단검 부채', desc: '부채꼴로 단검 다섯 자루를 던져 출혈을 일으킨다.', cd: 7, act: shot({ dur: 20, t: 6, m: 0.65, n: 5, spread: 10, p: { spr: 'dagger', spd: 7, life: 40, w: 8, h: 4, col: '#d0d0e8', st: 'bleed', kb: 1 }, w: 'windHigh', s: 'throw', sfx: 'swing' }) },
    ],
    swap: { name: '교대: 그림자 습격', desc: '그림자에서 튀어나와 전방의 적들을 관통하며 벤다.', act: { dur: 24, pose: [[0, 'dash'], [8, 'slashDown']], move: [[0, 10], [10, 0]], inv: [0, 14], ev: [{ t: 0, k: 'sfx', s: 'dash' }, { t: 6, k: 'hit', box: [-60, -14, 76, 24], m: 1.8, kb: 2, hs: 6, el: 'shadow', fx: { arc: 'x', r: 24, col: '#c0a0ff' } }] } },
    passive: { name: '그림자 걸음', desc: '대시 2회 충전. 대시 후 2초간 치명타 확률 +25%', effects: [{ flags: { dashCharges: 1 } }, { on: 'dash', do: [{ k: 'buff', id: 'sien_p', stats: { crit: 0.25 }, dur: 2 }] }] },
    awaken: [
      { desc: '그림자 순보 피해 +35%', mods: [{ target: 'skill1', dmg: 0.35 }] },
      { desc: '단검 부채 단검 +3', mods: [{ target: 'skill2', count: 3 }] },
      { desc: '치명타 피해 +30%', effects: [{ stats: { critDmg: 0.3 } }] },
      { desc: '그림자 순보 쿨타임 -2초', mods: [{ target: 'skill1', cd: 2 }] },
      { desc: '처치 시 그림자 분신 공격, 모든 기술 피해 +20%', effects: [{ on: 'kill', icd: 0.5, do: [{ k: 'echo', m: 1 }] }], mods: [{ target: 'all', dmg: 0.2 }] },
    ],
  },
  {
    id: 'morga', name: '모르가', title: '사슬낫 사신', rarity: 4, type: 'speed', crest: 'blood',
    lore: '망자의 강을 건너는 이들을 인도하던 사신. 계약으로 묶인 지금은 산 자들의 피를 수확한다.',
    atk: 21, hp: 95, speed: 2.05, fx: '#ff5070',
    look: { skin: '#c8c0c8', hair: '#101014', hairStyle: 'hood', body: '#18141c', trim: '#c02040', legs: '#100c14', boots: '#08060a', cape: '#200c14', eye: '#ff3050', weapon: 'scythe', wcol: '#d8d8e0', wcol2: '#3a2a2a', build: 'normal', extra: 'chains' },
    combo: [
      melee({ dur: 18, t: 6, m: 0.65, box: [-18, -18, 54, 28], w: 'windHigh', s: 'slashDown', fx: { arc: 'h', r: 28, col: '#ff8090' }, hs: 3, lunge: 1.5 }),
      melee({ dur: 18, t: 6, m: 0.65, box: [-18, -22, 54, 32], w: 'windLow', s: 'slashUp', fx: { arc: 'up', r: 28, col: '#ff8090' }, hs: 3, lunge: 1.5 }),
      melee({ dur: 20, t: 7, m: 0.75, box: [-24, -20, 60, 30], w: 'spin', s: 'slashDown', fx: { arc: 'spin', r: 28, col: '#ff8090' }, hs: 3, lunge: 2 }),
      multi({ dur: 30, times: [8, 15], m: 0.85, lastM: 1.0, lastKb: 5, box: [-28, -24, 64, 36], pose: [[0, 'spin'], [8, 'slashDown'], [12, 'spin'], [15, 'slashUp']], fx: { arc: 'spin', r: 32, col: '#ff5070' }, st: 'bleed', hs: 5, fin: true, sfx: 'swing_heavy' }),
    ],
    air: melee({ dur: 18, t: 5, m: 0.6, box: [-22, -22, 52, 40], w: 'spin', s: 'spin', fx: { arc: 'spin', r: 26, col: '#ff8090' }, air: true, grav: 0.25, hs: 2 }),
    dashAtk: melee({ dur: 22, t: 5, m: 0.95, box: [-10, -16, 50, 24], w: 'dash', s: 'slashDown', fx: { arc: 'h', r: 30, col: '#ff8090' }, lunge: 6, hs: 3, st: 'bleed' }),
    skills: [
      { name: '사슬 갈고리', desc: '사슬낫을 길게 던져 맞힌 적을 눈앞으로 끌어당긴다.', cd: 7, act: { dur: 28, pose: [[0, 'windHigh'], [6, 'throw']], ev: [{ t: 6, k: 'sfx', s: 'swing' }, { t: 9, k: 'hit', box: [0, -12, 100, 18], m: 1.1, kb: -7, up: -2, hs: 5, st: 'bleed', fx: { arc: 'thrust', r: 90, col: '#c0c0c8' } }] } },
      { name: '피의 수확', desc: '낫을 휘두르며 회전해 주변을 여섯 번 벤다. 회전 중 천천히 이동 가능.', cd: 10, act: multi({ dur: 44, times: [6, 12, 18, 24, 30, 36], m: 0.5, lastM: 0.9, lastKb: 5, box: [-34, -22, 68, 34], pose: [[0, 'spin'], [6, 'slashUp'], [12, 'spin'], [18, 'slashDown'], [24, 'spin'], [30, 'slashUp'], [36, 'spin']], fx: { arc: 'spin', r: 34, col: '#ff5070' }, st: 'bleed', move: [[0, 1.4]], armor: true, sfx: 'swing_heavy' }) },
    ],
    swap: { name: '교대: 회귀하는 낫', desc: '되돌아오는 낫을 던져 경로상의 적을 두 번 벤다.', act: shot({ dur: 22, t: 6, m: 1.3, inv: [0, 10], p: { spr: 'scythe', spd: 6, life: 70, w: 18, h: 18, col: '#d8d8e0', pierce: 99, ret: true, st: 'bleed', kb: 2, hs: 4 }, w: 'windHigh', s: 'throw', sfx: 'swing_heavy' }) },
    passive: { name: '수확자', desc: '공격 시 15% 확률로 출혈. 출혈 대상 처치 시 체력 3% 회복', effects: [{ on: 'hit', chance: 0.15, do: [{ k: 'status', s: 'bleed' }] }, { on: 'kill', need: 'bleed', do: [{ k: 'heal', v: 0.03 }] }] },
    awaken: [
      { desc: '피의 수확 피해 +30%', mods: [{ target: 'skill2', dmg: 0.3 }] },
      { desc: '출혈 대상에게 주는 피해 +20%', effects: [{ stats: { vsBleed: 0.2 } }] },
      { desc: '사슬 갈고리 쿨타임 -2초', mods: [{ target: 'skill1', cd: 2 }] },
      { desc: '흡혈 3%', effects: [{ stats: { lifesteal: 0.03 } }] },
      { desc: '출혈 5중첩 시 파열, 모든 기술 피해 +20%', effects: [{ flags: { bleedRupture: 2 } }], mods: [{ target: 'all', dmg: 0.2 }] },
    ],
  },
  {
    id: 'aurelia', name: '아우렐리아', title: '방패 성기사', rarity: 4, type: 'guard', crest: 'ward',
    lore: '성소를 끝까지 지킨 성기사. 그녀의 방패가 무너졌을 때, 왕국도 함께 무너졌다.',
    atk: 20, hp: 145, speed: 1.75, fx: '#fff0a0',
    look: { skin: '#f8e0c8', hair: '#f0d070', hairStyle: 'long', body: '#d8d8e8', trim: '#e0b040', legs: '#8a8aa0', boots: '#6a6a80', cape: '#2a4aa0', eye: '#3a6ad0', weapon: 'mace', wcol: '#e0e0f0', wcol2: '#c0a040', shield: '#e0b040', build: 'normal', extra: 'halo' },
    combo: [
      melee({ dur: 20, t: 7, m: 0.85, box: [-2, -16, 28, 26], w: 'windHigh', s: 'slashDown', fx: { arc: 'down', r: 18, col: '#fff0a0' }, hs: 4, lunge: 1.5, sfx: 'swing' }),
      melee({ dur: 20, t: 6, m: 0.8, box: [0, -14, 24, 24], w: 'guard', s: 'thrust', fx: { arc: 'thrust', r: 16, col: '#fff0a0' }, kb: 5, hs: 4, lunge: 3 }),
      melee({ dur: 30, t: 12, m: 1.5, box: [-10, -24, 44, 36], w: 'slamWind', s: 'slam', fx: { arc: 'slam', r: 26, col: '#fff0a0' }, up: -3, hs: 7, shake: 3, fin: true, el: 'holy', sfx: 'swing_heavy', extra: [{ t: 12, k: 'nova', r: 30, m: 0.5, el: 'holy' }] }),
    ],
    air: { dur: 60, pose: [[0, 'guard']], landEnd: true, airOk: true, ev: [{ t: 2, k: 'plunge', vy: 7, m: 1.3, r: 28, el: 'holy' }] },
    dashAtk: melee({ dur: 24, t: 5, m: 1.0, box: [0, -14, 26, 26], w: 'guard', s: 'guard', fx: { arc: 'thrust', r: 14, col: '#fff0a0' }, lunge: 6, kb: 6, hs: 5, armor: true }),
    skills: [
      { name: '심판의 반격', desc: '방패를 세워 공격을 받아낸다. 받아내면 피해를 무효화하고 신성한 반격을 가한다.', cd: 5, act: { dur: 40, pose: [[0, 'guard']], armor: true, ev: [{ t: 0, k: 'sfx', s: 'shield' }, { t: 0, k: 'counter', dur: 36, m: 3.2 }] } },
      { name: '성광', desc: '보호막(최대 체력 25%)을 두르고 주변에 성스러운 빛을 폭발시킨다.', cd: 10, act: { dur: 30, pose: [[0, 'castUp'], [10, 'guard']], ev: [{ t: 10, k: 'sfx', s: 'shield' }, { t: 10, k: 'shield', v: 0.25 }, { t: 10, k: 'nova', r: 70, m: 1.3, el: 'holy', up: -3 }, { t: 10, k: 'shake', v: 3 }] } },
    ],
    swap: { name: '교대: 수호의 강림', desc: '보호막을 두르고 내려찍어 주변 적을 띄운다.', act: { dur: 26, pose: [[0, 'slamWind'], [8, 'slam']], inv: [0, 12], ev: [{ t: 8, k: 'sfx', s: 'hit_guard' }, { t: 8, k: 'shield', v: 0.12 }, { t: 8, k: 'nova', r: 50, m: 1.5, el: 'holy', up: -4 }, { t: 8, k: 'shake', v: 4 }] } },
    passive: { name: '성역', desc: '방 입장 시 보호막(최대 체력 15%). 보호막이 있을 때 받는 피해 -15%', effects: [{ on: 'roomStart', do: [{ k: 'shield', v: 0.15 }] }, { cond: 'shielded', stats: { dmgTaken: -0.15 } }] },
    awaken: [
      { desc: '반격 피해 +40%', mods: [{ target: 'skill1', dmg: 0.4 }] },
      { desc: '최대 체력 +40', effects: [{ stats: { maxHp: 40 } }] },
      { desc: '성광 쿨타임 -2초', mods: [{ target: 'skill2', cd: 2 }] },
      { desc: '보호막이 있을 때 주는 피해 +20%', effects: [{ cond: 'shielded', stats: { allDmg: 0.2 } }] },
      { desc: '피격 시 신성 파동, 모든 기술 피해 +20%', effects: [{ flags: { hurtWave: 1.5 } }], mods: [{ target: 'all', dmg: 0.2 }] },
    ],
  },
  {
    id: 'eora', name: '에오라', title: '시간을 멈춘 마녀', rarity: 4, type: 'magic', crest: 'frost',
    lore: '왕국이 멸망하던 밤, 시계탑의 시간을 멈춰 혼자만 살아남은 마녀. 그 대가로 그녀의 시간은 영원히 겨울이다.',
    atk: 19, hp: 88, speed: 1.9, fx: '#a8e4ff',
    look: { skin: '#f0e8f0', hair: '#a0c8f0', hairStyle: 'witch', body: '#3a4a8a', trim: '#a8e4ff', legs: '#2a2a5a', boots: '#1a1a3a', cape: '#5a6ab0', eye: '#80e0ff', weapon: 'clock', wcol: '#e0d090', wcol2: '#6a5a8a', build: 'slim', glow: '#a8e4ff' },
    combo: [
      shot({ dur: 16, t: 5, m: 0.65, p: P.orb('#a8e4ff', { spr: 'shard', spd: 6, st: 'chill', el: 'frost' }), s: 'cast', sfx: 'proj' }),
      shot({ dur: 16, t: 5, m: 0.65, p: P.orb('#a8e4ff', { spr: 'shard', spd: 6, st: 'chill', el: 'frost' }), s: 'cast', sfx: 'proj' }),
      shot({ dur: 26, t: 8, m: 0.55, n: 3, spread: 12, p: P.orb('#d0f4ff', { spr: 'shard', spd: 6, st: 'chill', el: 'frost', pierce: 1 }), w: 'castUp', s: 'cast', sfx: 'freeze' }),
    ],
    air: shot({ dur: 16, t: 4, m: 0.65, ang: 45, air: true, grav: 0.35, p: P.orb('#a8e4ff', { spr: 'shard', spd: 6, st: 'chill', el: 'frost' }), s: 'cast' }),
    dashAtk: { dur: 18, pose: [[0, 'cast']], inv: [0, 8], ev: [{ t: 0, k: 'tp', dx: 46 }, { t: 1, k: 'sfx', s: 'freeze' }, { t: 1, k: 'nova', r: 30, m: 0.6, el: 'frost', st: 'chill' }] },
    skills: [
      { name: '시간 정지', desc: '2.5초간 주변 모든 적과 투사체의 시간을 멈춘다. 멈춘 동안 받은 피해는 그대로 쌓인다.', cd: 15, act: { dur: 30, pose: [[0, 'castUp']], ev: [{ t: 8, k: 'sfx', s: 'timestop' }, { t: 8, k: 'timestop', dur: 2.5 }] } },
      { name: '역행의 시계', desc: '전방에 느린 시간의 장을 펼쳐 적을 둔화시키고 냉기를 쌓는다.', cd: 9, act: { dur: 24, pose: [[0, 'castUp'], [8, 'cast']], ev: [{ t: 8, k: 'sfx', s: 'cast' }, { t: 8, k: 'field', f: { vis: 'time', w: 100, h: 60, life: 240, tick: 20, m: 0.25, el: 'frost', st: 'chill', slow: true }, dx: 50, dy: -20 }] } },
    ],
    swap: { name: '교대: 서리 시계탑', desc: '주변을 순식간에 얼려 냉기를 두 번 쌓는다.', act: { dur: 22, pose: [[0, 'castUp']], inv: [0, 10], ev: [{ t: 5, k: 'sfx', s: 'freeze' }, { t: 5, k: 'nova', r: 60, m: 1.3, el: 'frost', st: 'chill' }, { t: 7, k: 'nova', r: 60, m: 0, st: 'chill' }] } },
    passive: { name: '정지된 초침', desc: '공격 시 12% 확률로 냉기. 빙결 대상에게 주는 피해 +15%', effects: [{ on: 'hit', chance: 0.12, do: [{ k: 'status', s: 'chill' }] }, { stats: { vsFrozen: 0.15 } }] },
    awaken: [
      { desc: '역행의 시계 크기 +40%', mods: [{ target: 'skill2', size: 0.4 }] },
      { desc: '시간 정지 쿨타임 -3초', mods: [{ target: 'skill1', cd: 3 }] },
      { desc: '기본 공격 얼음 조각 +1', mods: [{ target: 'combo', count: 1 }] },
      { desc: '빙결 해제 시 얼음 폭발', effects: [{ flags: { freezeShatter: 1.8 } }] },
      { desc: '스킬 쿨타임 -15%, 모든 기술 피해 +20%', effects: [{ stats: { cdr: 0.15 } }], mods: [{ target: 'all', dmg: 0.2 }] },
    ],
  },
  // ───────────────────────── ★5 ─────────────────────────
  {
    id: 'seres', name: '세레스', title: '저주받은 왕녀', rarity: 5, type: 'guard', crest: 'shadow',
    lore: '끝없는 왕의 유일한 혈육. 아버지의 저주를 몸에 새긴 채, 그 저주로 아버지를 끝내기 위해 계약에 응했다.',
    atk: 27, hp: 120, speed: 2.15, fx: '#ff80d0',
    look: { skin: '#f8e8f0', hair: '#e8e8f8', hairStyle: 'crown', body: '#4a1a4a', trim: '#ff80d0', legs: '#2a0a2a', boots: '#1a081a', cape: '#8a1a5a', eye: '#ff4ab0', weapon: 'rapier', wcol: '#f0d0ff', wcol2: '#d0a040', build: 'slim', glow: '#ff80d0', extra: 'chains' },
    combo: [
      melee({ dur: 13, t: 4, m: 0.6, box: [0, -10, 34, 12], w: 'thrustWind', s: 'thrust', fx: { arc: 'thrust', r: 28, col: '#ffc0e8' }, hs: 3, lunge: 2 }),
      melee({ dur: 13, t: 4, m: 0.6, box: [0, -16, 30, 20], w: 'windLow', s: 'slashUp', fx: { arc: 'up', r: 18, col: '#ffc0e8' }, hs: 3, lunge: 2 }),
      melee({ dur: 14, t: 4, m: 0.7, box: [0, -10, 34, 12], w: 'thrustWind', s: 'thrust', fx: { arc: 'thrust', r: 28, col: '#ffc0e8' }, hs: 3, lunge: 2.5 }),
      multi({ dur: 30, times: [5, 9, 13, 18], m: 0.5, lastM: 1.2, lastKb: 5, box: [0, -12, 38, 16], pose: [[0, 'thrust'], [7, 'thrustWind'], [9, 'thrust'], [12, 'thrustWind'], [14, 'thrust']], fx: { arc: 'thrust', r: 30, col: '#ff80d0' }, el: 'shadow', fin: true, extra: [{ t: 18, k: 'proj', p: { spr: 'blade', spd: 6, life: 40, w: 12, h: 6, col: '#ff80d0', el: 'shadow', pierce: 2, st: 'bleed' }, m: 0.8 }] }),
    ],
    air: melee({ dur: 16, t: 4, m: 0.7, box: [0, -4, 30, 22], w: 'thrustWind', s: 'thrust', fx: { arc: 'thrust', r: 24, col: '#ffc0e8' }, air: true, grav: 0.3, hs: 3, extra: [{ t: 2, k: 'sfx', s: 'swing' }] }),
    dashAtk: melee({ dur: 20, t: 5, m: 1.3, box: [0, -10, 44, 14], w: 'thrustWind', s: 'thrust', fx: { arc: 'thrust', r: 40, col: '#ff80d0' }, lunge: 7, hs: 5, el: 'shadow' }),
    skills: [
      { name: '왕가의 패리', desc: '짧은 순간 모든 공격을 흘려낸다. 성공 시 피해 무효 + 저주의 일섬(공격력 420%).', cd: 4, act: { dur: 30, pose: [[0, 'guard']], ev: [{ t: 0, k: 'sfx', s: 'swing' }, { t: 0, k: 'counter', dur: 22, m: 4.2 }] } },
      { name: '저주 낙인', desc: '추적하는 저주의 칼날 여섯 자루와 저주의 장을 펼친다.', cd: 9, act: { dur: 28, pose: [[0, 'castUp'], [10, 'cast']], ev: [{ t: 10, k: 'sfx', s: 'cast' }, { t: 10, k: 'proj', p: { spr: 'blade', spd: 4, life: 100, w: 12, h: 6, col: '#ff80d0', home: 0.3, el: 'shadow', st: 'bleed' }, m: 0.75, n: 6, spread: 25, ang: -60 }, { t: 10, k: 'field', f: { vis: 'blood', w: 80, h: 20, life: 180, tick: 15, m: 0.3, st: 'bleed', el: 'shadow' }, dx: 30, ground: true }] } },
    ],
    swap: { name: '교대: 몰락한 왕관', desc: '가장 가까운 적에게 순간이동해 X자로 베고 저주를 폭발시킨다.', act: { dur: 28, pose: [[0, 'dash'], [6, 'slashDown'], [14, 'slashUp']], inv: [0, 18], ev: [{ t: 0, k: 'tp', dx: 20, toEnemy: true }, { t: 6, k: 'hit', box: [-10, -18, 40, 30], m: 1.6, hs: 6, el: 'shadow', fx: { arc: 'x', r: 26, col: '#ff80d0' } }, { t: 14, k: 'nova', r: 46, m: 1.8, el: 'shadow', st: 'bleed', up: -3 }, { t: 14, k: 'sfx', s: 'explode' }] } },
    passive: { name: '저주의 왕관', desc: '반격 성공 시 5초간 모든 피해 +30%. 피격 시 저주 파동(공격력 120%)', effects: [{ flags: { hurtWave: 1.2 } }, { on: 'parry', do: [{ k: 'buff', id: 'seres_p', stats: { allDmg: 0.3 }, dur: 5 }] }] },
    awaken: [
      { desc: '패리 반격 피해 +40%', mods: [{ target: 'skill1', dmg: 0.4 }] },
      { desc: '저주 낙인 칼날 +4', mods: [{ target: 'skill2', count: 4 }] },
      { desc: '치명타 확률 +12%', effects: [{ stats: { crit: 0.12 } }] },
      { desc: '교대 공격 피해 +60%', mods: [{ target: 'swap', dmg: 0.6 }] },
      { desc: '모든 기술 피해 +30%, 흡혈 3%', mods: [{ target: 'all', dmg: 0.3 }], effects: [{ stats: { lifesteal: 0.03 } }] },
    ],
  },
  {
    id: 'drakan', name: '드라칸', title: '혼돈의 용기사', rarity: 5, type: 'power', crest: 'flame',
    lore: '혼돈의 용과 피를 나눈 기사. 용의 날개와 불꽃을 얻었지만, 인간이었던 기억은 잃어가고 있다.',
    atk: 30, hp: 130, speed: 1.95, fx: '#ff6a2a',
    look: { skin: '#d0a080', hair: '#2a0a0a', hairStyle: 'horned', body: '#3a1010', trim: '#ff6a2a', legs: '#2a0a0a', boots: '#1a0505', cape: '#5a0a0a', eye: '#ffb02a', weapon: 'lance', wcol: '#ff9a4a', wcol2: '#3a1a1a', build: 'big', glow: '#ff6a2a', extra: 'wings' },
    combo: [
      melee({ dur: 20, t: 7, m: 1.0, box: [0, -10, 46, 16], w: 'thrustWind', s: 'thrust', fx: { arc: 'thrust', r: 40, col: '#ffb080' }, hs: 4, lunge: 3 }),
      melee({ dur: 22, t: 8, m: 1.1, box: [-14, -24, 54, 34], w: 'windHigh', s: 'slashDown', fx: { arc: 'h', r: 32, col: '#ffb080' }, hs: 4, lunge: 2 }),
      multi({ dur: 24, times: [6, 12], m: 0.75, box: [0, -10, 48, 16], pose: [[0, 'thrustWind'], [5, 'thrust'], [9, 'thrustWind'], [11, 'thrust']], fx: { arc: 'thrust', r: 42, col: '#ffb080' }, hs: 3, move: [[4, 2], [14, 0]] }),
      melee({ dur: 34, t: 12, m: 2.1, box: [-4, -24, 52, 36], w: 'slamWind', s: 'thrust', fx: { arc: 'x', r: 32, col: '#ff6a2a' }, kb: 6, up: -3, hs: 9, shake: 5, fin: true, el: 'fire', st: 'burn', sfx: 'swing_heavy', extra: [{ t: 12, k: 'proj', p: { spr: 'fireball', spd: 6, life: 50, w: 12, h: 10, col: '#ff6a2a', el: 'fire', st: 'burn', boom: { r: 26, m: 1, el: 'fire', st: 'burn' } }, m: 1.2 }] }),
    ],
    air: { dur: 70, pose: [[0, 'thrust']], landEnd: true, airOk: true, armor: true, ev: [{ t: 3, k: 'plunge', vy: 9, m: 2.0, r: 42, el: 'fire', st: 'burn' }] },
    dashAtk: melee({ dur: 24, t: 6, m: 1.5, box: [0, -10, 52, 16], w: 'thrustWind', s: 'thrust', fx: { arc: 'thrust', r: 48, col: '#ff6a2a' }, lunge: 8, kb: 5, hs: 6, el: 'fire', st: 'burn', armor: true }),
    skills: [
      { name: '용의 숨결', desc: '전방으로 화염을 내뿜어 연속 피해와 화상을 입힌다.', cd: 8, act: { dur: 48, pose: [[0, 'castUp'], [8, 'cast']], armor: true, ev: [{ t: 8, k: 'sfx', s: 'burn' }, ...[10, 14, 18, 22, 26, 30, 34, 38].map((t) => ({ t, k: 'proj' as const, p: { spr: 'fireball' as const, spd: 5, life: 26, w: 12, h: 12, col: '#ff6a2a', el: 'fire' as const, st: 'burn' as const, pierce: 99, kb: 0.5 }, m: 0.42, spread: 0, ang: (t % 8) - 4 })), { t: 20, k: 'sfx', s: 'burn' }, { t: 32, k: 'sfx', s: 'burn' }] } },
      { name: '혼돈 강하', desc: '하늘 높이 날아올라 혼돈의 불꽃과 함께 내리꽂힌다.', cd: 12, act: { dur: 90, pose: [[0, 'castUp'], [14, 'slam']], move: [[0, 1.5, -8]], landEnd: true, airOk: true, armor: true, inv: [0, 40], ev: [{ t: 0, k: 'sfx', s: 'skill' }, { t: 14, k: 'plunge', vy: 10, m: 4.2, r: 64, el: 'fire', st: 'burn' }] } },
    ],
    swap: { name: '교대: 용익 돌진', desc: '날개를 펼치고 화염과 함께 전방으로 돌진한다.', act: { dur: 26, pose: [[0, 'dash'], [4, 'thrust']], move: [[0, 9], [14, 0]], inv: [0, 16], armor: true, ev: [{ t: 0, k: 'sfx', s: 'dash' }, { t: 6, k: 'hit', box: [-50, -16, 70, 28], m: 2.4, kb: 5, up: -2, hs: 8, el: 'fire', st: 'burn', shake: 4, fx: { arc: 'thrust', r: 50, col: '#ff6a2a' } }, { t: 3, k: 'field', f: { vis: 'fire', w: 100, h: 16, life: 120, tick: 15, m: 0.3, el: 'fire', st: 'burn' }, dx: 40, ground: true }] } },
    passive: { name: '용의 피', desc: '공격력 +15%, 추가 점프 +1. 화상 대상에게 주는 피해 +15%', effects: [{ stats: { atk: 0.15, vsBurn: 0.15 }, flags: { extraJump: 1 } }] },
    awaken: [
      { desc: '용의 숨결 피해 +30%', mods: [{ target: 'skill1', dmg: 0.3 }] },
      { desc: '최대 체력 +40', effects: [{ stats: { maxHp: 40 } }] },
      { desc: '혼돈 강하 쿨타임 -3초', mods: [{ target: 'skill2', cd: 3 }] },
      { desc: '화상 대상 처치 시 폭발', effects: [{ flags: { burnSpread: 1.4 } }] },
      { desc: '모든 기술 피해 +30%', mods: [{ target: 'all', dmg: 0.3 }] },
    ],
  },
  {
    id: 'astera', name: '아스테라', title: '별을 떨어뜨리는 점성술사', rarity: 5, type: 'magic', crest: 'soul',
    lore: '천문탑의 마지막 점성술사. 왕국의 멸망을 예언했으나 아무도 믿지 않았다. 이제 그녀는 별을 직접 떨어뜨린다.',
    atk: 25, hp: 95, speed: 1.95, fx: '#ffe680',
    look: { skin: '#f8e8d8', hair: '#3a3a8a', hairStyle: 'long', body: '#1a1a4a', trim: '#ffe680', legs: '#14143a', boots: '#0a0a2a', cape: '#2a2a6a', eye: '#ffe680', weapon: 'orb', wcol: '#ffe680', wcol2: '#a0a0ff', build: 'slim', glow: '#ffe680', extra: 'halo' },
    combo: [
      shot({ dur: 15, t: 5, m: 0.75, p: P.star(), s: 'cast', sfx: 'cast' }),
      shot({ dur: 15, t: 5, m: 0.75, p: P.star(), s: 'cast', sfx: 'cast' }),
      shot({ dur: 26, t: 8, m: 0.65, n: 3, spread: 16, p: P.star('#fff0b0', { pierce: 1 }), w: 'castUp', s: 'cast', sfx: 'cast' }),
    ],
    air: shot({ dur: 16, t: 4, m: 0.75, ang: 40, air: true, grav: 0.35, p: P.star(), s: 'cast' }),
    dashAtk: { dur: 18, pose: [[0, 'dash'], [6, 'cast']], move: [[0, 4], [10, 0]], inv: [0, 8], ev: [{ t: 6, k: 'nova', r: 32, m: 0.9, el: 'holy' }, { t: 6, k: 'sfx', s: 'cast' }] },
    skills: [
      { name: '유성우', desc: '전방 넓은 범위에 유성 일곱 개를 떨어뜨린다.', cd: 9, act: { dur: 30, pose: [[0, 'castUp']], ev: [{ t: 8, k: 'sfx', s: 'cast' }, { t: 10, k: 'meteor', n: 7, m: 1.1, spread: 110, el: 'holy' }] } },
      { name: '수호 위성', desc: '주위를 공전하며 적을 쏘는 별 위성 3개를 소환한다 (8초).', cd: 12, act: { dur: 24, pose: [[0, 'castUp']], ev: [{ t: 8, k: 'sfx', s: 'gem' }, { t: 8, k: 'summon', s: { kind: 'star', life: 480, m: 0.5, max: 6 }, n: 3 }] } },
    ],
    swap: { name: '교대: 초신성', desc: '거대한 별을 떨어뜨려 넓은 범위를 폭파한다.', act: { dur: 26, pose: [[0, 'castUp']], inv: [0, 12], ev: [{ t: 4, k: 'sfx', s: 'cast' }, { t: 6, k: 'meteor', n: 1, m: 4.2, spread: 0, el: 'holy', big: true }] } },
    passive: { name: '별자리', desc: '스킬 피해 +25%. 6초마다 가장 가까운 적에게 별 낙하 (공격력 150%)', effects: [{ stats: { skillDmg: 0.25 } }, { on: 'interval', every: 6, do: [{ k: 'meteor', m: 1.5 }] }] },
    awaken: [
      { desc: '유성우 유성 +3', mods: [{ target: 'skill1', count: 3 }] },
      { desc: '수호 위성 +2', mods: [{ target: 'skill2', count: 2 }] },
      { desc: '스킬 쿨타임 -15%', effects: [{ stats: { cdr: 0.15 } }] },
      { desc: '초신성 피해 +50%', mods: [{ target: 'swap', dmg: 0.5 }] },
      { desc: '모든 기술 피해 +30%', mods: [{ target: 'all', dmg: 0.3 }] },
    ],
  },
];

CHARACTERS.push(...CHARACTERS_EX);

export const CHAR_MAP: Record<string, CharDef> = Object.fromEntries(CHARACTERS.map((c) => [c.id, c]));
export const STARTER_CHAR = 'kael';
export const STARTER_WEAPON = 'rusty_blade';

export const TYPE_LABEL: Record<string, string> = { power: '파워', speed: '스피드', ranged: '원거리', magic: '마법', guard: '방어' };
export const TYPE_COL: Record<string, string> = { power: '#ff8a5a', speed: '#6dffb0', ranged: '#ffe060', magic: '#a080ff', guard: '#80c0ff' };
export const TYPE_SFX: Record<string, string> = { power: 'hit_power', speed: 'hit_speed', ranged: 'hit_ranged', magic: 'hit_magic', guard: 'hit_guard' };
