import { CHAR_MAP } from '../data/characters';
import { CREST_MAP } from '../data/crests';
import { ITEM_MAP, ROOM_TYPES } from '../data/meta';
import { TUTORIAL_SIGNS } from '../data/rooms';
import type { Input } from '../core/input';
import { charFrame } from '../gfx/sprites';
import { rgba, shade } from '../gfx/pixel';
import { text, measure } from '../gfx/renderer';
import type { Room } from '../game/room';
import type { RunState } from '../game/run';
import { STATUS_COL } from '../game/enemy';
import type { StatusId } from '../game/types';
import { bar, panel } from './widgets';
import { drawIcon, ITEM_ICON, STATUS_ICON } from './icons';

export function portrait(g: CanvasRenderingContext2D, id: string, x: number, y: number, size: number, dim = false): void {
  const f = charFrame(id, 'idle0');
  g.save();
  g.imageSmoothingEnabled = false;
  g.fillStyle = '#120c1c';
  g.fillRect(x, y, size, size);
  g.drawImage(f, 13, 13, 22, 22, x, y, size, size);
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
    // ── 초상화 + 체력 ──
    panel(g, 4, 4, 168, 52, { alpha: 0.85 });
    const act = run.party[run.active];
    portrait(g, act.id, 9, 9, 28);
    const other = p.other;
    if (other) {
      portrait(g, other.id, 25, 29, 16, p.swapCd > 0);
      cdOverlay(g, 25, 29, 16, p.swapCd / Math.max(0.01, p.swapMax));
      text(g, input.label('swap'), 33, 46, { size: 6, align: 'center', color: p.swapCd > 0 ? '#8a8098' : '#a0ffd0', bold: true });
      if (p.swapCd <= 0 && room.time % 40 < 20) {
        g.strokeStyle = '#a0ffd0';
        g.strokeRect(24.5, 28.5, 17, 17);
      }
    }
    const def = CHAR_MAP[act.id];
    text(g, `${def.name}`, 42, 8, { size: 7, color: def.fx, bold: true });
    text(g, `Lv.${act.lv}${act.aw ? ` · 각성${act.aw}` : ''}${act.temp ? ' · 임시' : ''}`, 42 + measure(g, def.name, 7, true) + 4, 9, { size: 6, color: '#a8a0c0' });
    bar(g, 42, 18, 124, 7, hpF, hpF < 0.3 ? '#ff3050' : '#e84060', '#2a1020', this.ghostHp);
    if (room.shield > 0) {
      g.fillStyle = 'rgba(255,215,106,0.85)';
      g.fillRect(42, 18, Math.min(1, room.shield / maxHp) * 124, 2);
    }
    text(g, `${Math.ceil(run.hp)} / ${maxHp}${room.shield > 0 ? ` (+${Math.ceil(room.shield)})` : ''}`, 104, 18.5, { size: 6, align: 'center', color: '#ffffff' });
    // 스킬
    const skills = def.skills;
    for (let i = 0; i < 2; i++) {
      const x = 42 + i * 26;
      const y = 29;
      g.fillStyle = shade(def.fx, -0.6);
      g.fillRect(x, y, 22, 22);
      drawIcon(g, ['star', 'bolt'][i], x + 4, y + 3, 14, def.fx);
      cdOverlay(g, x, y, 22, p.skillCd[i] / Math.max(0.01, p.skillMax[i]));
      g.strokeStyle = p.skillCd[i] <= 0 ? def.fx : '#3a3048';
      g.strokeRect(x + 0.5, y + 0.5, 21, 21);
      text(g, input.label(i === 0 ? 'skill1' : 'skill2'), x + 2, y + 14, { size: 6, color: '#ffffff', bold: true });
      if (p.skillCd[i] > 0) text(g, p.skillCd[i].toFixed(p.skillCd[i] < 3 ? 1 : 0), x + 11, y + 7, { size: 7, align: 'center', color: '#ffffff', bold: true });
      void skills;
    }
    // 대시 충전
    const dc = 1 + room.build.flag('dashCharges');
    for (let i = 0; i < dc; i++) {
      g.fillStyle = i < p.dashCharges ? '#a0ffd0' : '#3a3048';
      g.fillRect(96 + i * 6, 30, 4, 4);
    }
    text(g, '대시', 96, 36, { size: 5, color: '#8a8098' });
    // 버프
    let bx = 96;
    for (const b of room.build.activeBuffs().slice(0, 6)) {
      g.fillStyle = '#ffe080';
      g.fillRect(bx, 44, 8, 8 * Math.min(1, b.left / 5));
      g.strokeStyle = '#806020';
      g.strokeRect(bx + 0.5, 44.5, 8, 8);
      if (b.stacks > 1) text(g, String(b.stacks), bx + 4, 44, { size: 5, align: 'center', color: '#000' });
      bx += 10;
    }

    if (mode === 'run') {
      // ── 재화 ──
      panel(g, 4, 58, 80, 30, { alpha: 0.8 });
      drawIcon(g, 'coin', 8, 61, 9, '#ffd040');
      text(g, String(run.gold), 20, 62, { size: 7, color: '#ffe080' });
      drawIcon(g, 'gem', 44, 61, 9, '#6a9aff');
      text(g, String(run.stats.stones), 56, 62, { size: 7, color: '#9ec0ff' });
      drawIcon(g, 'shard', 8, 73, 9, '#40d0e0');
      text(g, String(run.stats.crystals), 20, 74, { size: 7, color: '#a0f0ff' });
      // ── 미니맵 ──
      this.minimap(g, run);
      // ── 문장 요약 ──
      const cs = room.build.crests.slice(0, 6);
      if (cs.length) {
        panel(g, 4, 92, 84, 8 + cs.length * 9, { alpha: 0.75 });
        cs.forEach((c, i) => {
          const cd = CREST_MAP[c.id];
          const y = 96 + i * 9;
          drawIcon(g, cd.icon, 8, y, 7, c.tier > 0 ? cd.col : '#6a6078');
          text(g, cd.name, 18, y, { size: 6, color: c.tier > 0 ? cd.col : '#8a8098' });
          for (let k = 0; k < 3; k++) {
            g.fillStyle = k < c.tier ? cd.col : '#2a2238';
            g.fillRect(48 + k * 6, y + 2, 4, 4);
          }
          text(g, `${c.count}`, 68, y, { size: 6, color: '#c8c0d8' });
        });
      }
      // ── 아이템 ──
      panel(g, 88, 58, 30, 30, { alpha: 0.85 });
      const it = run.items[0];
      if (it) {
        drawIcon(g, ITEM_ICON[it] ?? 'potion', 93, 64, 20, ITEM_MAP[it].col);
        if (run.items.length > 1) text(g, `+${run.items.length - 1}`, 116, 79, { size: 6, align: 'right', color: '#fff' });
      }
      text(g, input.label('item'), 91, 59, { size: 6, color: '#ffffff', bold: true });
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
      const bw = 182;
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

  minimap(g: CanvasRenderingContext2D, run: RunState): void {
    const L = run.layers.length;
    const w = L * 12 + 8;
    const x0 = 476 - w;
    panel(g, x0, 4, w, 46, { alpha: 0.8 });
    text(g, `제${run.chapter}장`, x0 + 4, 6, { size: 6, color: '#c0b0d8' });
    const pos = (id: number): [number, number] => {
      const n = run.nodes[id];
      const cnt = run.layers[n.layer].length;
      return [x0 + 8 + n.layer * 12, 28 + (n.idx - (cnt - 1) / 2) * 9];
    };
    g.lineWidth = 1;
    for (const n of run.nodes) {
      const [ax, ay] = pos(n.id);
      for (const m of n.next) {
        const [bx, by] = pos(m);
        const onPath = n.id === run.cur;
        g.strokeStyle = onPath ? 'rgba(255,240,180,0.8)' : 'rgba(120,100,150,0.5)';
        g.beginPath();
        g.moveTo(ax, ay);
        g.lineTo(bx, by);
        g.stroke();
      }
    }
    for (const n of run.nodes) {
      const [x, y] = pos(n.id);
      const col = ROOM_TYPES[n.type].col;
      const cur = n.id === run.cur;
      const r = cur ? 3 : 2;
      g.fillStyle = n.visited ? col : rgba(col, 0.45);
      g.fillRect(x - r, y - r, r * 2, r * 2);
      if (cur && Math.floor(Date.now() / 300) % 2) {
        g.strokeStyle = '#ffffff';
        g.strokeRect(x - r - 1.5, y - r - 1.5, r * 2 + 3, r * 2 + 3);
      }
    }
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
        const label = pr.nodeId === -1 ? { name: '다음 장으로', col: '#ffe080', icon: 'door' } : pr.nodeId === -2 ? { name: '계약 완수', col: '#ffe080', icon: 'crown' } : ROOM_TYPES[run.nodes[pr.nodeId]?.type ?? 'combat'];
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
