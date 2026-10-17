import { CHAR_MAP } from '../data/characters';
import { WEAPON_MAP } from '../data/weapons';
import { audio } from '../core/audio';
import { charFrame, white, tinted } from '../gfx/sprites';
import { charFrameHD, hasLyingFrame, hdFx, hdQueue } from '../gfx/hd';
import { CAELUS_COMPASS } from '../data/characters2';
import { charAtk, charHp } from './combat';
import type { Room } from './room';
import type { ActEvent, ActionDef, CharDef, PoseName } from './types';
import { newBody, Tile, type Body } from './world';
import type { Rect } from '../core/math';
import { overlap } from '../core/math';

export interface PlayerInput {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  jumpP: boolean;
  jumpH: boolean;
  atkP: boolean;
  dashP: boolean;
  s1P: boolean;
  s2P: boolean;
  ultP?: boolean;
  swapP: boolean;
  interactP: boolean;
  itemP: boolean;
}

export const NO_INPUT: PlayerInput = { left: false, right: false, up: false, down: false, jumpP: false, jumpH: false, atkP: false, dashP: false, s1P: false, s2P: false, swapP: false, interactP: false, itemP: false };

export type ActKind = 'combo' | 'air' | 'dashAtk' | 'skill1' | 'skill2' | 'swap' | 'ult';

const GRAV = 0.3;
const MAX_FALL = 6.5;
const JUMP = -5.7;
const DJUMP = -5.1;

/** 플레이어: 이동/점프/대시/콤보/스킬/교대 상태 머신 + 액션 DSL 실행기 */
export class Player {
  b: Body;
  facing = 1;
  state: 'normal' | 'act' | 'dash' | 'hurt' | 'dead' = 'normal';
  act: ActionDef | null = null;
  actKind: ActKind = 'combo';
  actF = 0;
  fired = 0; // 처리한 이벤트 수 (이벤트는 t 오름차순 정렬)
  sortedEv: ActEvent[] = [];
  moveIdx = 0;
  comboIdx = 0;
  comboWin = 0;
  jumps = 1;
  coyote = 0;
  jumpBuf = 0;
  atkBuf = 0;
  airAtks = 0;
  dashT = 0;
  dashCharges = 1;
  dashRegen = 0;
  airDashes = 0;
  dashAtkWin = 0;
  skillCd: [number, number] = [0, 0];
  skillMax: [number, number] = [1, 1];
  /** 궁극기 쿨타임 (초) */
  ultCd = 0;
  ultMax = 1;
  swapCd = 0;
  swapMax = 7;
  /** 대기 중인 영웅의 스킬·궁극기 쿨타임 — 영웅마다 따로, 교대하면 서로 바뀐다 (대기 중에도 흐른다) */
  bench: { skillCd: [number, number]; skillMax: [number, number]; ultCd: number; ultMax: number } = { skillCd: [0, 0], skillMax: [1, 1], ultCd: 0, ultMax: 1 };
  inv = 0;
  /** 대시 무적: 대시(11프레임)와 끝난 뒤 조금 더 (깜빡임 없이) */
  dashInv = 0;
  hurtT = 0;
  flash = 0;
  animT = 0;
  plunge: { vy: number; m: number; r: number; el?: string; st?: string } | null = null;
  counterT = 0;
  counterM = 0;
  afterDash = 0;
  afterSwap = 0;
  deadT = 0;
  /** 고해상도 그림 애니메이션: 지금·앞 포즈와 지금 포즈가 이어진 틱 */
  private hdPose: PoseName = 'idle0';
  private hdPrev: PoseName | undefined;
  private hdSince = 0;
  landT = 0;
  wasGround = true;
  swapHitDone = false;
  dot = { burn: 0, poison: 0, chill: 0 };
  hitThisAct = false;
  armorNow = false;
  fallStart = 0;
  stepT = 0;

  constructor(
    public room: Room,
    x: number,
    y: number,
  ) {
    this.b = newBody(x - 5, y - 20, 10, 20);
  }

  get cx(): number {
    return this.b.x + this.b.w / 2;
  }
  get cy(): number {
    return this.b.y + this.b.h / 2;
  }
  get def(): CharDef {
    return CHAR_MAP[this.room.party[this.room.activeIdx].id];
  }
  get member(): { id: string; lv: number; aw: number } {
    return this.room.party[this.room.activeIdx];
  }
  get other(): { id: string; lv: number; aw: number } | null {
    const p = this.room.party;
    return p.length > 1 && p[1 - this.room.activeIdx].id !== p[this.room.activeIdx].id ? p[1 - this.room.activeIdx] : null;
  }

  /** 공격력 (캐릭터 레벨 + 무기 + 각성) */
  atk(): number {
    const m = this.member;
    const w = WEAPON_MAP[this.room.weapon.id];
    return charAtk(this.def.atk, m.lv, w ? w.atk * (1 + 0.15 * (this.room.weapon.rf - 1)) : 0) * (1 + m.aw * 0.03);
  }

  maxHpBase(): number {
    const ps = this.room.party.map((p) => charHp(CHAR_MAP[p.id].hp, p.lv));
    return Math.round(ps.reduce((a, b) => a + b, 0) / ps.length);
  }

  overlaps(r: Rect): boolean {
    return overlap(this.b, r);
  }

  invulnerable(): boolean {
    return this.inv > 0 || this.dashInv > 0 || this.state === 'dash' || this.state === 'dead' || (this.act !== null && this.act.inv !== undefined && this.actF >= this.act.inv[0] && this.actF < this.act.inv[1]);
  }

  // ───────── 업데이트 ─────────
  update(inp: PlayerInput): void {
    const r = this.room;
    const stats = r.stats;
    this.animT++;
    if (this.flash > 0) this.flash--;
    if (this.inv > 0) this.inv--;
    if (this.dashInv > 0) this.dashInv--;
    if (this.comboWin > 0) this.comboWin--;
    else this.comboIdx = 0;
    if (this.jumpBuf > 0) this.jumpBuf--;
    if (this.atkBuf > 0) this.atkBuf--;
    if (this.coyote > 0) this.coyote--;
    if (this.dashAtkWin > 0) this.dashAtkWin--;
    if (this.counterT > 0) this.counterT--;
    if (this.afterDash > 0) this.afterDash--;
    if (this.afterSwap > 0) this.afterSwap--;
    if (this.landT > 0) this.landT--;
    const dt = 1 / 60;
    const cdr = Math.min(0.6, stats.cdr ?? 0);
    if (this.ultCd > 0) this.ultCd = Math.max(0, this.ultCd - dt);
    for (let i = 0; i < 2; i++) if (this.skillCd[i] > 0) this.skillCd[i] = Math.max(0, this.skillCd[i] - dt * (1 + cdr * 0));
    if (this.swapCd > 0) this.swapCd = Math.max(0, this.swapCd - dt);
    const bn = this.bench;
    if (bn.ultCd > 0) bn.ultCd = Math.max(0, bn.ultCd - dt);
    for (let i = 0; i < 2; i++) if (bn.skillCd[i] > 0) bn.skillCd[i] = Math.max(0, bn.skillCd[i] - dt);
    const maxCharges = 1 + r.build.flag('dashCharges');
    if (this.dashCharges < maxCharges) {
      this.dashRegen -= dt;
      if (this.dashRegen <= 0) {
        this.dashCharges++;
        this.dashRegen = 0.55 * (1 - Math.min(0.6, stats.dashCdr ?? 0));
      }
    }
    // 지속 피해 (플레이어)
    if (this.dot.burn > 0) {
      this.dot.burn--;
      if (this.dot.burn % 40 === 0) r.selfDot(0.02, '#ff7a2a', '화상');
    }
    if (this.dot.chill > 0) {
      this.dot.chill--;
      if (this.dot.chill % 10 === 0) r.fx.parts.push({ x: this.cx + (Math.random() - 0.5) * 8, y: this.cy, vx: 0, vy: 0.3, life: 0, max: 20, col: '#d0f4ff', size: 1, grav: 0, kind: 'px', drag: 1 });
    }
    if (this.dot.poison > 0) {
      this.dot.poison--;
      if (this.dot.poison % 45 === 0) r.selfDot(0.015, '#8bdc3a', '독');
    }

    if (this.state === 'dead') {
      this.deadT++;
      this.b.vx *= 0.9;
      this.b.vy = Math.min(MAX_FALL, this.b.vy + GRAV);
      r.world.move(this.b);
      return;
    }

    if (inp.jumpP) this.jumpBuf = 7;
    if (inp.atkP) this.atkBuf = 10;
    const ground = this.b.onGround;
    if (ground) {
      this.jumps = 1 + r.build.flag('extraJump');
      this.coyote = 6;
      this.airAtks = 0;
      this.airDashes = 0;
    }

    // 교대
    if (inp.swapP && this.canSwap()) {
      this.doSwap();
    }
    // 스킬
    if (inp.s1P) this.tryAction('skill1');
    if (inp.s2P) this.tryAction('skill2');
    if (inp.ultP) this.tryAction('ult');
    // 대시 (캔슬 가능)
    if (inp.dashP && this.canDash()) this.startDash(inp);

    switch (this.state) {
      case 'normal':
        this.updateNormal(inp);
        break;
      case 'dash':
        this.updateDash();
        break;
      case 'act':
        this.updateAct(inp);
        break;
      case 'hurt':
        this.hurtT--;
        this.b.vx *= 0.88;
        this.b.vy = Math.min(MAX_FALL, this.b.vy + GRAV);
        if (this.hurtT <= 0) this.state = 'normal';
        break;
    }

    const wasG = this.wasGround;
    const prevVy = this.b.vy;
    r.world.move(this.b);
    this.wasGround = this.b.onGround;
    if (!wasG && this.b.onGround) {
      this.landT = 6;
      if (prevVy > 3) {
        r.fx.dust(this.cx, this.b.y + this.b.h, prevVy > 5 ? 8 : 4);
        audio.play('land');
      }
    }
    if (!this.b.onGround && wasG && this.b.vy >= 0) this.coyote = 6;
    // 위험 지형
    const hz = r.world.hazardAt(this.b);
    if (hz === Tile.Spike || hz === Tile.Lava) r.hazardHit(hz);
    // 낙사 방지
    if (this.b.y > r.world.pxH + 20) r.fellOut();
    // 발소리
    if (this.b.onGround && Math.abs(this.b.vx) > 1 && this.state === 'normal') {
      if (++this.stepT % 16 === 0) audio.play('step');
    }
  }

  private moveSpeed(): number {
    return this.def.speed * (1 + (this.room.stats.mspd ?? 0)) * (this.dot.chill > 0 ? 0.6 : 1);
  }

  private updateNormal(inp: PlayerInput): void {
    const r = this.room;
    const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    const spd = this.moveSpeed();
    if (dir) this.facing = dir;
    const accel = this.b.onGround ? (r.ch.slippery ? 0.13 : 0.55) : 0.4;
    const target = dir * spd;
    if (this.b.vx < target) this.b.vx = Math.min(target, this.b.vx + accel);
    else if (this.b.vx > target) this.b.vx = Math.max(target, this.b.vx - accel);
    // 점프 / 발판 내려가기
    if (this.jumpBuf > 0) {
      if (inp.down && this.b.onGround && r.world.onOneWay(this.b)) {
        this.b.dropTimer = 12;
        this.b.y += 2;
        this.jumpBuf = 0;
      } else if (this.b.onGround || this.coyote > 0) {
        this.b.vy = JUMP;
        this.coyote = 0;
        this.jumpBuf = 0;
        audio.play('jump');
        r.fx.dust(this.cx, this.b.y + this.b.h, 3);
      } else if (this.jumps > 0) {
        this.jumps--;
        this.b.vy = DJUMP;
        this.jumpBuf = 0;
        audio.play('djump');
        r.fx.ring(this.cx, this.b.y + this.b.h, '#ffffff', 10, 10);
      }
    }
    if (!inp.jumpH && this.b.vy < -2) this.b.vy *= 0.82;
    this.b.vy = Math.min(MAX_FALL, this.b.vy + GRAV);
    // 공격
    if (this.atkBuf > 0) {
      if (this.dashAtkWin > 0) this.tryAction('dashAtk');
      else if (!this.b.onGround) this.tryAction('air');
      else this.tryAction('combo');
    }
  }

  private canDash(): boolean {
    if (this.state === 'dead' || this.dashCharges <= 0 || this.state === 'dash') return false;
    if (this.plunge) return false;
    if (!this.b.onGround && this.airDashes >= 1 + this.room.build.flag('airDash')) return false;
    return true;
  }

  private startDash(inp: PlayerInput): void {
    const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    if (dir) this.facing = dir;
    this.endAct();
    this.state = 'dash';
    this.dashT = 11;
    this.dashInv = 30;
    this.dashCharges--;
    this.dashRegen = 0.55 * (1 - Math.min(0.6, this.room.stats.dashCdr ?? 0));
    if (!this.b.onGround) this.airDashes++;
    this.b.vy = 0;
    this.afterDash = 120;
    audio.play('dash');
    this.room.fx.dust(this.cx, this.b.y + this.b.h, 4);
    this.room.onDash();
  }

  private updateDash(): void {
    this.dashT--;
    this.b.vx = this.facing * 6.6;
    this.b.vy = 0;
    if (this.dashT % 2 === 0) this.room.fx.ghost(this.frame(), this.cx - 24, this.b.y + this.b.h - 44, this.facing < 0, this.def.fx, 14);
    if (this.atkBuf > 0) {
      this.dashAtkWin = 0;
      this.state = 'normal';
      this.b.vx = this.facing * 3;
      this.tryAction('dashAtk');
      return;
    }
    if (this.dashT <= 0) {
      this.state = 'normal';
      this.b.vx = this.facing * 2.5;
      this.dashAtkWin = 8;
    }
  }

  canSwap(): boolean {
    return this.swapCd <= 0 && this.other !== null && this.state !== 'dead';
  }

  /** 교대: 나가는 영웅의 쿨타임은 대기석으로, 들어오는 영웅의 쿨타임을 가져온다 */
  swapCooldowns(): void {
    const bn = this.bench;
    this.bench = { skillCd: this.skillCd, skillMax: this.skillMax, ultCd: this.ultCd, ultMax: this.ultMax };
    this.skillCd = bn.skillCd;
    this.skillMax = bn.skillMax;
    this.ultCd = bn.ultCd;
    this.ultMax = bn.ultMax;
  }

  doSwap(): void {
    const r = this.room;
    r.fx.ghost(this.frame(), this.cx - 24, this.b.y + this.b.h - 44, this.facing < 0, this.def.fx, 24);
    this.endAct();
    r.swapActive();
    this.swapCooldowns();
    this.swapMax = 7 * (1 - Math.min(0.7, r.stats.swapCdr ?? 0));
    this.swapCd = this.swapMax;
    this.afterSwap = 180;
    this.swapHitDone = false;
    const inv = r.build.flag('swapInvuln');
    if (inv) this.inv = Math.max(this.inv, Math.round(inv * 60));
    audio.play('swap');
    r.flash(this.def.fx, 0.35);
    r.fx.ring(this.cx, this.cy, this.def.fx, 30, 18);
    r.fx.burst(this.cx, this.cy, this.def.fx, 16, 3);
    this.startAction('swap', this.def.swap.act);
  }

  /** 행동 시작 가능 여부 + 시작 */
  tryAction(kind: ActKind): boolean {
    if (this.state === 'dead' || this.state === 'hurt' && !this.armorNow) return false;
    if (this.plunge) return false;
    const d = this.def;
    if (kind === 'skill1' || kind === 'skill2') {
      const i = kind === 'skill1' ? 0 : 1;
      if (this.skillCd[i] > 0) return false;
      if (this.state === 'act' && this.act && this.actKind !== 'combo' && this.actKind !== 'air' && this.actKind !== 'dashAtk' && this.actF < (this.act.cancel ?? this.act.dur)) return false;
      const sk = d.skills[i];
      const mod = this.room.build.modFor(kind);
      const cd = Math.max(1, (sk.cd - mod.cd) * (1 - Math.min(0.6, this.room.stats.cdr ?? 0)));
      this.skillCd[i] = cd;
      this.skillMax[i] = cd;
      if (this.state === 'dash') this.state = 'normal';
      this.endAct();
      this.startAction(kind, sk.act);
      audio.play('skill', 1 + i * 0.1);
      this.room.onSkill();
      return true;
    }
    if (kind === 'ult') {
      const u = d.ult;
      if (!u || this.ultCd > 0) return false;
      if (this.state === 'act' && this.act && this.actKind !== 'combo' && this.actKind !== 'air' && this.actKind !== 'dashAtk' && this.actF < (this.act.cancel ?? this.act.dur)) return false;
      const mod = this.room.build.modFor('ult');
      const cd = Math.max(1, (u.cd - mod.cd) * (1 - Math.min(0.6, this.room.stats.cdr ?? 0)));
      this.ultCd = cd;
      this.ultMax = cd;
      if (this.state === 'dash') this.state = 'normal';
      this.endAct();
      this.startAction('ult', u.act);
      audio.play('skill', 0.8);
      this.room.onSkill();
      return true;
    }
    if (this.state === 'act' && this.act) {
      // 콤보 연계: 캔슬 프레임 이후
      if (this.actF < (this.act.cancel ?? this.act.dur)) return false;
      if (this.actKind !== 'combo' && this.actKind !== 'air' && this.actKind !== 'dashAtk') return false;
    }
    if (this.state === 'dash') return false;
    let act: ActionDef;
    if (kind === 'combo') {
      // 콤보 중이거나, 끝난 직후 연계 시간(comboWin) 안이면 다음 타. 공격 속도가 빨라 동작이 먼저 끝나도 이어진다
      if ((this.actKind === 'combo' && this.state === 'act') || this.comboWin > 0) this.comboIdx = (this.comboIdx + 1) % d.combo.length;
      else this.comboIdx = 0;
      act = d.combo[this.comboIdx];
    } else if (kind === 'air') {
      if (this.airAtks >= 3) return false;
      this.airAtks += d.air.landEnd ? 3 : 1;
      act = d.air;
    } else act = d.dashAtk;
    this.atkBuf = 0;
    this.endAct();
    this.startAction(kind, act);
    return true;
  }

  private startAction(kind: ActKind, act: ActionDef): void {
    this.state = 'act';
    this.act = act;
    this.actKind = kind;
    this.actF = 0;
    this.fired = 0;
    this.moveIdx = 0;
    this.sortedEv = [...act.ev].sort((a, b) => a.t - b.t);
    this.hitThisAct = false;
    this.armorNow = !!act.armor || this.def.id === 'balt';
    this.atkBuf = 0;
    this.applyMoves();
    this.fireEvents();
  }

  private endAct(): void {
    if (this.state === 'act' && this.actKind === 'combo') this.comboWin = 28;
    this.act = null;
    this.plunge = null;
    this.armorNow = false;
    if (this.state === 'act') this.state = 'normal';
  }

  private applyMoves(): void {
    const act = this.act;
    if (!act || !act.move) return;
    while (this.moveIdx < act.move.length && act.move[this.moveIdx][0] <= this.actF) {
      const [, vx, vy] = act.move[this.moveIdx];
      this.b.vx = vx * this.facing;
      if (vy !== undefined) this.b.vy = vy;
      this.moveIdx++;
    }
  }

  private fireEvents(): void {
    while (this.act && this.fired < this.sortedEv.length && this.sortedEv[this.fired].t <= this.actF) {
      const ev = this.sortedEv[this.fired++];
      this.room.runEvent(ev, this.actKind);
    }
  }

  private updateAct(inp: PlayerInput): void {
    const act = this.act!;
    const fast = this.actKind === 'combo' || this.actKind === 'air' || this.actKind === 'dashAtk';
    const spd = fast ? Math.min(2, 1 + (this.room.stats.aspd ?? 0)) : 1;
    this.actF += spd;
    this.applyMoves();
    this.fireEvents();
    // 공중 공격 중 약간의 좌우 조작
    const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    if (!this.b.onGround && (this.actKind === 'air' || this.actKind === 'skill1' || this.actKind === 'skill2') && dir && !act.move) this.b.vx += dir * 0.15;
    if (this.plunge) {
      this.b.vy = this.plunge.vy;
      this.b.vx *= 0.9;
      if (this.b.onGround) {
        const p = this.plunge;
        this.plunge = null;
        this.room.plungeImpact(p.m, p.r, p.el, p.st);
        this.act = null;
        this.state = 'normal';
        this.landT = 8;
        return;
      }
    } else {
      const grav = act.grav ?? 1;
      this.b.vy = Math.min(MAX_FALL, this.b.vy + GRAV * grav);
      if (this.b.onGround && !act.move) this.b.vx *= this.room.ch.slippery ? 0.95 : 0.75;
    }
    if (act.landEnd && this.b.onGround && this.actF > 6 && !this.plunge) {
      this.endAct();
      return;
    }
    // 추적 화살이 날아다니는 동안은 동작을 붙잡아 둔다 (그 자리에 멈춤)
    if (act.holdYaka && this.room.yaka) {
      // 안전장치: 화살 수명 + 2초가 넘도록 묶여 있으면 화살을 거두고 풀어 준다
      if (this.room.yaka.t > this.room.yaka.ev.life + 120) this.room.yaka = null;
      else {
        this.b.vx = 0;
        if (this.actF >= act.dur) this.actF = act.dur - 1;
        return;
      }
    }
    if (this.actF >= act.dur) {
      if (!act.landEnd || this.b.onGround) this.endAct();
      else if (this.actF > act.dur + 60) this.endAct();
    }
    // 콤보 선입력 즉시 연계
    if (this.state === 'act' && this.atkBuf > 0 && this.act && this.actF >= (this.act.cancel ?? this.act.dur)) {
      if (this.actKind === 'combo' && this.b.onGround) this.tryAction('combo');
      else if (!this.b.onGround && (this.actKind === 'air' || this.actKind === 'combo')) this.tryAction('air');
    }
  }

  startPlunge(vy: number, m: number, r: number, el?: string, st?: string): void {
    this.plunge = { vy, m, r, el, st };
    this.b.vy = vy;
  }

  /** 피격 */
  hurt(dir: number, kb: number): void {
    this.inv = 50;
    this.flash = 10;
    if (this.armorNow && this.state === 'act') return;
    this.endAct();
    this.state = 'hurt';
    this.hurtT = 16;
    this.b.vx = dir * kb;
    this.b.vy = -2.5;
  }

  die(): void {
    this.endAct();
    this.state = 'dead';
    this.deadT = 0;
    this.b.vy = -3;
    this.b.vx = -this.facing * 1.5;
  }

  pose(): PoseName {
    switch (this.state) {
      case 'dead':
      case 'hurt':
        return 'hurt';
      case 'dash':
        return 'dash';
      case 'act': {
        const act = this.act!;
        let p: PoseName = act.pose[0][1];
        for (const [f, n] of act.pose) if (this.actF >= f) p = n;
        return p;
      }
      default:
        if (!this.b.onGround) return this.b.vy < 0 ? 'jump' : 'fall';
        if (this.landT > 0) return 'crouch';
        if (Math.abs(this.b.vx) > 0.4) return (['run0', 'run1', 'run2', 'run3', 'run4', 'run5'] as PoseName[])[Math.floor(this.animT / 5) % 6];
        return Math.floor(this.animT / 30) % 2 ? 'idle1' : 'idle0';
    }
  }

  frame(): HTMLCanvasElement {
    return charFrame(this.def.id, this.pose());
  }

  render(g: CanvasRenderingContext2D, cx: number, cy: number, time: number): void {
    const img = this.frame();
    // ★7 고해상도 스프라이트: 월드 대신 확대된 화면 층에 그린다
    const lying = this.state === 'dead' && this.deadT > 14;
    // 쓰러지는 그림이 있는 영웅은 쓰러진 순간부터 그림 순서대로 (회전 없음)
    const lieHD = this.state === 'dead' && hasLyingFrame(this.def.id);
    const pose = lieHD ? 'dead' : this.pose();
    if (pose !== this.hdPose) {
      this.hdPrev = this.hdPose;
      this.hdPose = pose;
      this.hdSince = 0;
    }
    const hd = this.room.demoNoHD
      ? null
      : charFrameHD(this.def.id, pose, { t: this.animT, since: lieHD ? this.deadT : this.hdSince++, prev: this.hdPrev }, true);
    const x = Math.round(this.cx - 24 - cx);
    const y = Math.round(this.b.y + this.b.h - 44 - cy);
    // 카일루스 「천구 나침반」: 강화 중엔 발밑에 별의 나침반 마법진이 바닥에 누워 돈다 (캐릭터 뒤)
    const cb = this.room.build.buffs.get(CAELUS_COMPASS);
    const left = cb ? cb.until - this.room.build.time : 0;
    if (left > 0 && this.state !== 'dead') {
      const pop = Math.min(1, (8 - left) * 4 + 0.4);
      hdFx('circle', x + 24, y + 44, 66 * pop, { ang: time * 0.05, squash: 0.3, alpha: Math.min(1, left * 2) * 0.95 });
    }
    g.save();
    if (this.inv > 0 && this.state !== 'dead' && (time >> 2) % 2 === 0) g.globalAlpha = 0.45;
    const draw = (im: HTMLCanvasElement, hdIm?: HTMLCanvasElement | null): void => {
      if (hdIm) {
        hdQueue.push({ img: hdIm, x, y, flip: this.facing < 0, alpha: g.globalAlpha, rot: lying && !lieHD ? { ox: 24, oy: 44, a: ((this.facing > 0 ? -1 : 1) * Math.PI) / 2 } : undefined });
        return;
      }
      if (this.state === 'dead' && this.deadT > 14) {
        g.save();
        g.translate(x + 24, y + 44);
        g.rotate((this.facing > 0 ? -1 : 1) * Math.PI / 2);
        if (this.facing < 0) g.scale(-1, 1);
        g.drawImage(im, -24, -44 + 6);
        g.restore();
        return;
      }
      if (this.facing < 0) {
        g.save();
        g.translate(x + 24, 0);
        g.scale(-1, 1);
        g.drawImage(im, -24, y);
        g.restore();
      } else g.drawImage(im, x, y);
    };
    if (this.counterT > 0) {
      g.save();
      g.globalAlpha = 0.5 + 0.3 * Math.sin(time * 0.6);
      draw(tinted(img, '#fff0a0'), hd && tinted(hd, '#fff0a0'));
      g.restore();
    }
    if (this.room.shield > 0) {
      g.save();
      g.globalAlpha = 0.25 + 0.1 * Math.sin(time * 0.2);
      g.strokeStyle = '#ffd76a';
      g.lineWidth = 1;
      g.beginPath();
      g.ellipse(this.cx - cx, this.cy - cy - 2, 12, 16, 0, 0, Math.PI * 2);
      g.stroke();
      g.restore();
    }
    draw(img, hd);
    if (this.flash > 0) draw(white(img), hd && white(hd));
    g.restore();
  }
}
