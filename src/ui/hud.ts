import { CHAR_MAP } from '../data/characters';
import { CREST_MAP } from '../data/crests';
import { chapterDef, ITEM_MAP, ROOM_TYPES } from '../data/meta';
import { TUTORIAL_SIGNS } from '../data/rooms';
import type { Input } from '../core/input';
import { charArt } from '../gfx/sprites';
import { shade } from '../gfx/pixel';
import { Tile, TS } from '../game/world';
import { text, measure } from '../gfx/renderer';
import type { Room } from '../game/room';
import type { RunState } from '../game/run';
import { STATUS_COL } from '../game/enemy';
import type { StatusId } from '../game/types';
import { bar, panel } from './widgets';
import { drawIcon, ITEM_ICON, STATUS_ICON } from './icons';

export function portrait(g: CanvasRenderingContext2D, id: string, x: number, y: number, size: number, dim = false): void {
  const f = charArt(id, 'idle0');
  g.save();
  g.imageSmoothingEnabled = false;
  g.fillStyle = '#120c1c';
  g.fillRect(x, y, size, size);
  // 1:1 픽셀로 잘라 그린다 (정수 배율 유지)
  const cy = size >= 24 ? 27 : 24;
  const k = f.width / 48; // 고해상도(★7) 스프라이트는 원본 좌표가 2배
  g.drawImage(f, (24 - size / 2) * k, (cy - size / 2) * k, size * k, size * k, x, y, size, size);
  if (dim) {
    g.fillStyle = 'rgba(0,0,0,0.5)';
    g.fillRect(x, y, size, size);
  }
  g.strokeStyle = CHAR_MAP[id]?.fx ?? '#ffffff';
  g.lineWidth = 1;
  g.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);
  g.restore();
}

function cdOverlay(g: CanvasRenderingContext2D, x: number, y: number, s: number, frac: number): void {
  if (frac <= 0) return;
  g.save();
  g.fillStyle = 'rgba(0,0,0,0.62)';
  g.beginPath();
  g.moveTo(x + s / 2, y + s / 2);
  g.arc(x + s / 2, y + s / 2, s, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac);
  g.closePath();
  g.save();
  g.clip();
  g.fillRect(x, y, s, s);
  g.restore();
  g.restore();
}

export class Hud {
  ghostHp = 1;
  bossGhost = 1;
  comboShow = 0;
  lastCombo = 0;

  render(g: CanvasRenderingContext2D, room: Room, run: RunState, input: Input, mode: 'run' | 'hub'): void {
    const p = room.player;
    const maxHp = room.maxHp();
    const hpF = Math.max(0, run.hp / maxHp);
    this.ghostHp += (hpF - this.ghostHp) * 0.06;
    if (this.ghostHp < hpF) this.ghostHp = hpF;
    // ── 초상화 + 체력 + 스킬 + (런) 골드·아이템: 한 칸으로 작게 ──
    const PW = mode === 'run' ? 150 : 128;
    panel(g, 3, 3, PW, 38, { alpha: 0.85 });
    const act = run.party[run.active];
    portrait(g, act.id, 6, 6, 22);
    const other = p.other;
    if (other) {
      portrait(g, other.id, 18, 26, 12, p.swapCd > 0);
      cdOverlay(g, 18, 26, 12, p.swapCd / Math.max(0.01, p.swapMax));
      text(g, input.label('swap'), 9, 30, { size: 5, align: 'center', color: p.swapCd > 0 ? '#8a8098' : '#a0ffd0', bold: true });
      if (p.swapCd <= 0 && room.time % 40 < 20) {
        g.strokeStyle = '#a0ffd0';
        g.strokeRect(17.5, 25.5, 13, 13);
      }
    }
    const def = CHAR_MAP[act.id];
    text(g, `${def.name}`, 32, 5, { size: 6, color: def.fx, bold: true });
    const lvStr = `Lv.${act.lv}${act.aw ? `·각${act.aw}` : ''}${act.temp ? '·임시' : ''}`;
    const lx = 32 + measure(g, def.name, 6, true) + 3;
    text(g, lvStr, lx, 6, { size: 5, color: '#a8a0c0' });
    if (mode === 'run') {
      // 골드는 레벨 오른쪽에
      const gx = lx + measure(g, lvStr, 5) + 4;
      drawIcon(g, 'coin', gx, 5, 6, '#ffd040');
      text(g, String(run.gold), gx + 7, 6, { size: 5, color: '#ffe080' });
    }
    bar(g, 32, 13, PW - 32, 5, hpF, hpF < 0.3 ? '#ff3050' : '#e84060', '#2a1020', this.ghostHp);
    if (room.shield > 0) {
      g.fillStyle = 'rgba(255,215,106,0.85)';
      g.fillRect(32, 13, Math.min(1, room.shield / maxHp) * (PW - 32), 2);
    }
    text(g, `${Math.ceil(run.hp)}/${maxHp}${room.shield > 0 ? ` +${Math.ceil(room.shield)}` : ''}`, 32 + (PW - 32) / 2, 12.5, { size: 5, align: 'center', color: '#ffffff' });
    // 스킬
    for (let i = 0; i < 2; i++) {
      const x = 32 + i * 18;
      const y = 21;
      g.fillStyle = shade(def.fx, -0.6);
      g.fillRect(x, y, 16, 16);
      drawIcon(g, ['star', 'bolt'][i], x + 3, y + 3, 10, def.fx);
      cdOverlay(g, x, y, 16, p.skillCd[i] / Math.max(0.01, p.skillMax[i]));
      g.strokeStyle = p.skillCd[i] <= 0 ? def.fx : '#3a3048';
      g.strokeRect(x + 0.5, y + 0.5, 15, 15);
      text(g, input.label(i === 0 ? 'skill1' : 'skill2'), x + 1, y + 10, { size: 5, color: '#ffffff', bold: true });
      if (p.skillCd[i] > 0) text(g, p.skillCd[i].toFixed(p.skillCd[i] < 3 ? 1 : 0), x + 8, y + 4, { size: 6, align: 'center', color: '#ffffff', bold: true });
    }
    // 궁극기 (★6·★7 중 궁극기가 있는 영웅만) — 소모품 칸 왼쪽
    if (def.ult) {
      const x = PW - 34;
      const y = 21;
      const ready = p.ultCd <= 0;
      g.fillStyle = ready ? shade(def.fx, -0.35) : shade(def.fx, -0.65);
      g.fillRect(x, y, 16, 16);
      drawIcon(g, 'star', x + 3, y + 3, 10, ready ? '#ffffff' : def.fx);
      cdOverlay(g, x, y, 16, p.ultCd / Math.max(0.01, p.ultMax));
      g.strokeStyle = ready ? (Math.floor(Date.now() / 250) % 2 ? '#ffffff' : def.fx) : '#3a3048';
      g.strokeRect(x + 0.5, y + 0.5, 15, 15);
      text(g, input.label('ult'), x + 1, y + 10, { size: 5, color: '#ffffff', bold: true });
      if (!ready) text(g, p.ultCd.toFixed(0), x + 8, y + 4, { size: 6, align: 'center', color: '#ffffff', bold: true });
    }
    // 대시 충전
    const dc = 1 + room.build.flag('dashCharges');
    for (let i = 0; i < dc; i++) {
      g.fillStyle = i < p.dashCharges ? '#a0ffd0' : '#3a3048';
      g.fillRect(70 + i * 5, 22, 3, 3);
    }
    // 버프
    let bx = 70;
    for (const b of room.build.activeBuffs().slice(0, 5)) {
      g.fillStyle = '#ffe080';
      g.fillRect(bx, 29, 6, 6 * Math.min(1, b.left / 5));
      g.strokeStyle = '#806020';
      g.strokeRect(bx + 0.5, 29.5, 6, 6);
      if (b.stacks > 1) text(g, String(b.stacks), bx + 3, 29, { size: 4, align: 'center', color: '#000' });
      bx += 8;
    }

    if (mode === 'run') {
      // ── 소모품 (칸 안 오른쪽) ──
      const ix = PW - 16;
      g.fillStyle = 'rgba(20,14,30,0.9)';
      g.fillRect(ix, 21, 16, 16);
      g.strokeStyle = '#4a3a6a';
      g.strokeRect(ix + 0.5, 21.5, 15, 15);
      const it = run.items[0];
      if (it) {
        drawIcon(g, ITEM_ICON[it] ?? 'potion', ix + 2, 23, 12, ITEM_MAP[it].col);
        if (run.items.length > 1) text(g, `+${run.items.length - 1}`, ix + 15, 31, { size: 5, align: 'right', color: '#fff' });
      }
      text(g, input.label('item'), ix + 1, 21, { size: 4, color: '#ffffff', bold: true });
      // ── 현재 방 지도 (오른쪽 위) ──
      this.minimap(g, run, room);
      // ── 문장 세트: 활성화된 것 전부, 작게 ──
      const cs = room.build.crests;
      if (cs.length) {
        const rowH = 7;
        panel(g, 3, 43, 70, 4 + cs.length * rowH, { alpha: 0.72 });
        cs.forEach((c, i) => {
          const cd = CREST_MAP[c.id];
          const y = 45 + i * rowH;
          drawIcon(g, cd.icon, 6, y, 5, c.tier > 0 ? cd.col : '#6a6078');
          text(g, cd.name, 13, y - 0.5, { size: 5, color: c.tier > 0 ? cd.col : '#8a8098' });
          for (let k = 0; k < 3; k++) {
            g.fillStyle = k < c.tier ? cd.col : '#2a2238';
            g.fillRect(44 + k * 5, y + 1, 3, 3);
          }
          text(g, `${c.count}`, 66, y - 0.5, { size: 5, color: '#c8c0d8' });
        });
      }
    }
    // ── 콤보 ──
    if (room.combo > 1) {
      if (room.combo !== this.lastCombo) this.comboShow = 10;
      this.lastCombo = room.combo;
      if (this.comboShow > 0) this.comboShow--;
      const s = 14 + this.comboShow * 0.6;
      const a = Math.min(1, room.comboT / 40);
      text(g, `${room.combo}`, 470, 100, { size: s, align: 'right', color: room.combo >= 50 ? '#ffcc40' : room.combo >= 20 ? '#ff9a6a' : '#ffffff', bold: true, alpha: a });
      text(g, 'HIT', 470, 102 + s, { size: 7, align: 'right', color: '#c0b0d0', alpha: a });
    }
    // ── 보스 체력 ──
    const boss = room.boss;
    if (boss && !boss.dead && boss.intro < 70) {
      const f = boss.hp / boss.maxHp;
      this.bossGhost += (f - this.bossGhost) * 0.04;
      if (this.bossGhost < f) this.bossGhost = f;
      const bx = 180;
      const bw = 164;
      g.fillStyle = 'rgba(10,4,12,0.75)';
      g.fillRect(bx - 4, 3, bw + 8, 26);
      text(g, `${boss.bd.name}`, bx + bw / 2, 4, { size: 8, align: 'center', color: '#ffd0e0', bold: true });
      bar(g, bx, 16, bw, 5, f, '#d02050', '#200810', this.bossGhost);
      for (const ph of boss.bd.phases) {
        g.fillStyle = '#ffffff';
        g.fillRect(bx + bw * ph, 15, 1, 7);
      }
      text(g, boss.bd.title, bx + bw / 2, 22, { size: 5, align: 'center', color: '#a090b0' });
    }
  }

  private mapCache: { room: Room | null; c: HTMLCanvasElement | null; t: number } = { room: null, c: null, t: 0 };

  /** 오른쪽 위: 지금 있는 방의 지도 (지형·위험 지형·문·상자) + 적 위치(빨간 점)·플레이어 */
  minimap(g: CanvasRenderingContext2D, run: RunState, room: Room): void {
    const W = room.world;
    const k = Math.max(1, Math.min(2.2, Math.min(118 / W.w, 54 / W.h)));
    const mw = Math.round(W.w * k);
    const mh = Math.round(W.h * k);
    const x0 = 477 - mw - 6;
    const y0 = 12;
    panel(g, x0 - 3, 3, mw + 6, mh + 13, { alpha: 0.82 });
    const nodeIdx = run.nodes[run.cur]?.layer ?? 0;
    text(g, run.bossRush ? `보스 러시 ${run.chapter}/${run.rushList.length}` : `${run.story > 1 ? `스토리${run.story} · ` : ''}제${run.chapter}장 · 방 ${nodeIdx + 1}/${run.layers.length}`, x0, 4, { size: 5, color: run.bossRush ? '#ff9090' : '#c0b0d8', maxW: mw + 2 });
    // 지형은 잠깐씩만 다시 그린다 (부서지는 블록·무너지는 발판 반영)
    const mc = this.mapCache;
    if (mc.room !== room || !mc.c || room.time - mc.t > 30 || room.time < mc.t) {
      const c = mc.c && mc.c.width === W.w && mc.c.height === W.h ? mc.c : document.createElement('canvas');
      c.width = W.w;
      c.height = W.h;
      const m = c.getContext('2d')!;
      m.clearRect(0, 0, W.w, W.h);
      for (let ty = 0; ty < W.h; ty++)
        for (let tx = 0; tx < W.w; tx++) {
          const v = W.get(tx, ty);
          const col = v === Tile.Solid ? '#5a5070' : v === Tile.Break ? '#7a6a58' : v === Tile.Crumble ? (W.solid(tx, ty) ? '#8a7050' : '') : v === Tile.OneWay ? '#9a90b8' : v === Tile.Spike ? '#e04050' : v === Tile.Lava ? '#ff7a1a' : '';
          if (!col) continue;
          m.fillStyle = col;
          m.fillRect(tx, ty, 1, 1);
        }
      mc.room = room;
      mc.c = c;
      mc.t = room.time;
    }
    g.save();
    g.imageSmoothingEnabled = false;
    g.fillStyle = 'rgba(8,6,14,0.7)';
    g.fillRect(x0, y0, mw, mh);
    g.drawImage(mc.c!, x0, y0, mw, mh);
    const s = k / TS;
    const dot = (wx: number, wy: number, col: string, r: number): void => {
      g.fillStyle = col;
      g.fillRect(Math.round(x0 + wx * s - r / 2), Math.round(y0 + wy * s - r / 2), r, r);
    };
    for (const pr of room.props) {
      if (pr.kind === 'door') dot(pr.x, pr.y - 16, pr.open ? '#80ffa0' : '#6a8070', 3);
      else if (pr.kind === 'chest' && !pr.used && !pr.hidden) dot(pr.x, pr.y - 6, '#ffd040', 2);
    }
    for (const e of room.enemies) if (!e.dead && e.def.ai !== 'dummy') dot(e.cx, e.cy, e.elite ? '#ff70c0' : '#ff3040', 2);
    if (room.boss && !room.boss.dead) dot(room.boss.cx, room.boss.cy, '#ff2020', 4);
    // 플레이어 (깜빡임)
    dot(room.player.cx, room.player.cy, Math.floor(room.time / 15) % 2 ? '#ffffff' : '#80e0ff', 3);
    g.restore();
  }

  /** 월드 좌표 기반 UI: 적 체력바·상태이상·상호작용 안내·문 아이콘·표지판 */
  worldUi(g: CanvasRenderingContext2D, room: Room, run: RunState, input: Input): void {
    const cx = Math.round(room.cam.x);
    const cy = Math.round(room.cam.y);
    for (const e of room.enemies) {
      if (e.dead || e.state === 'spawn') continue;
      const x = Math.round(e.cx - cx);
      const y = Math.round(e.b.y - cy - 7);
      if (e.def.ai === 'dummy') {
        const now = room.time;
        e.dpsWindow = e.dpsWindow.filter((d) => now - d.t < 180);
        const dps = e.dpsWindow.reduce((a, d) => a + d.d, 0) / 3;
        text(g, `DPS ${Math.round(dps)}`, x, y - 10, { size: 7, align: 'center', color: '#ffe080', bold: true });
        text(g, `누적 ${e.dmgTaken}`, x, y - 2, { size: 6, align: 'center', color: '#c0b0d0' });
        continue;
      }
      if (e.hp < e.maxHp || e.elite) {
        const w = e.elite ? 30 : 20;
        bar(g, x - w / 2, y, w, 2, e.hp / e.maxHp, e.elite ? '#ff6090' : '#ff4a4a');
        if (e.elite) text(g, e.name, x, y - 8, { size: 6, align: 'center', color: '#ff90b0' });
      }
      const sts = Object.keys(e.status).filter((s) => s !== 'slow') as StatusId[];
      sts.forEach((s, i) => {
        const ix = x - (sts.length * 7) / 2 + i * 7;
        drawIcon(g, STATUS_ICON[s], ix, y + 3, 6, STATUS_COL[s]);
        const st = e.stacks[s] ?? 0;
        if (st > 1) text(g, String(st), ix + 6, y + 4, { size: 4, color: '#ffffff' });
      });
    }
    // 문 위 아이콘
    for (const pr of room.props) {
      const x = Math.round(pr.x - cx);
      const y = Math.round(pr.y - cy);
      if (pr.kind === 'door' && pr.nodeId !== undefined) {
        const label = pr.nodeId === -1 ? { name: chapterDef(pr.nextCh ?? 1).name, col: pr.nextCh === 7 ? '#ff80d0' : '#ffe080', icon: pr.nextCh === 7 ? 'eye' : 'door' } : pr.nodeId === -2 ? { name: '계약 완수', col: '#ffe080', icon: 'crown' } : ROOM_TYPES[run.nodes[pr.nodeId]?.type ?? 'combat'];
        const a = pr.open ? 1 : 0.4;
        g.save();
        g.globalAlpha = a;
        g.fillStyle = 'rgba(10,6,20,0.8)';
        g.fillRect(x - 9, y - 54, 18, 18);
        g.strokeStyle = label.col;
        g.strokeRect(x - 8.5, y - 53.5, 17, 17);
        drawIcon(g, pr.open ? label.icon : 'lock', x - 6, y - 51, 12, pr.open ? label.col : '#8a8098');
        g.restore();
        text(g, label.name, x, y - 64, { size: 6, align: 'center', color: label.col, alpha: a });
        if (pr.nodeId === -1 && pr.nextCh) text(g, chapterDef(pr.nextCh).desc, x, y - 73, { size: 5, align: 'center', color: '#a8a0c0', alpha: a });
      }
    }
    // 상호작용 안내
    const pr = room.prompt;
    if (pr && pr.kind !== 'sign') {
      const label: Record<string, string> = {
        door: '들어가기', chest: '열기', shop: '상점', altar: '영혼 제단', armory: '무기고', rest: '휴식', event: '살펴보기',
      };
      const hubL: Record<string, string> = { ach: '업적 비석', codex: '도감', gacha: '계약의 제단 (가챠)', portal: '출정 (편성)', loadout: '편성', growth: '영웅 육성', upgrade: '영구 강화', dummy: '' };
      const s = pr.kind === 'hub' ? hubL[pr.hub ?? ''] : label[pr.kind];
      if (s && !(pr.kind !== 'hub' && pr.used && pr.kind !== 'door')) {
        const x = Math.round(pr.x - cx);
        const y = Math.round(pr.y - cy - (pr.kind === 'door' ? 72 : pr.kind === 'hub' ? 74 : 48));
        const str = `[${input.label('interact')}] ${s}`;
        const w = measure(g, str, 7) + 10;
        g.fillStyle = 'rgba(10,6,20,0.85)';
        g.fillRect(x - w / 2, y - 2, w, 12);
        g.strokeStyle = '#a080ff';
        g.strokeRect(x - w / 2 + 0.5, y - 1.5, w - 1, 11);
        text(g, str, x, y, { size: 7, align: 'center', color: '#ffffff' });
      }
    }
    // 표지판
    let nearSign: (typeof room.props)[number] | null = null;
    for (const s of room.props) {
      if (s.kind !== 'sign') continue;
      const d = Math.abs(s.x - room.player.cx);
      if (d < 70 && (!nearSign || d < Math.abs(nearSign.x - room.player.cx))) nearSign = s;
    }
    for (const s of nearSign ? [nearSign] : []) {
      const raw = TUTORIAL_SIGNS[Number(s.text)] ?? '';
      const msg = raw.replace(/\{(\w+)\}/g, (_, k: string) => input.label(k as never));
      const x = Math.round(s.x - cx);
      const y = Math.round(s.y - cy - 46);
      const w = Math.min(260, measure(g, msg, 7) + 14);
      g.fillStyle = 'rgba(10,6,20,0.9)';
      g.fillRect(Math.max(4, Math.min(476 - w, x - w / 2)), y, w, 14);
      g.strokeStyle = '#e0c080';
      g.strokeRect(Math.max(4, Math.min(476 - w, x - w / 2)) + 0.5, y + 0.5, w - 1, 13);
      text(g, msg, Math.max(4 + w / 2, Math.min(476 - w / 2, x)), y + 3, { size: 7, align: 'center', color: '#ffe8c0' });
    }
    // 월드 텍스트
    for (const t of room.texts) {
      text(g, t.text, Math.round(t.x - cx), Math.round(t.y - cy - t.t * 0.3), { size: 8, align: 'center', color: t.col, bold: true, alpha: Math.min(1, (70 - t.t) / 20) });
    }
    room.fx.renderTexts(g, cx, cy);
    // 보스 외침 / 페이즈
    if (room.shout.t > 0) {
      const a = Math.min(1, room.shout.t / 20);
      g.fillStyle = `rgba(0,0,0,${0.55 * a})`;
      g.fillRect(0, 70, 480, 18);
      text(g, room.shout.text, 240, 74, { size: 9, align: 'center', color: room.shout.col, bold: true, alpha: a });
    }
    if (room.bossBanner > 0) {
      const t = room.bossBanner;
      const a = Math.min(1, t / 20, (120 - t) / 15);
      g.fillStyle = `rgba(40,0,10,${0.6 * a})`;
      g.fillRect(0, 110, 480, 34);
      text(g, room.bossBannerText, 240, 116, { size: 16, align: 'center', color: '#ff6080', bold: true, alpha: a });
    }
    void panel;
  }
}
