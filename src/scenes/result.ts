import { app, type Scene } from '../app';
import { audio } from '../core/audio';
import { CHAR_MAP } from '../data/characters';
import { CREST_MAP } from '../data/crests';
import { ACHIEVEMENTS, chapterDef, ROOM_TYPES } from '../data/meta';
import { RELIC_MAP } from '../data/relics';
import { WEAPON_MAP } from '../data/weapons';
import { text } from '../gfx/renderer';
import { finishRun, type RunSummary } from '../game/meta';
import type { RunState } from '../game/run';
import { evalCrests } from '../game/crests';
import { drawIcon } from '../ui/icons';
import { portrait } from '../ui/hud';
import { keyHint, panel } from '../ui/widgets';
import { HubScene } from './hub';
import type { CrestId } from '../game/types';
import { fmtNum } from '../core/math';

export class ResultScene implements Scene {
  sum!: RunSummary;
  t = 0;
  done = false;
  constructor(public run: RunState) {}

  enter(): void {
    if (this.done) return;
    this.done = true;
    this.sum = finishRun(app.save, this.run);
    app.persist();
    audio.playMusic('title');
    audio.play(this.run.victory ? 'victory' : 'death');
  }

  update(): void {
    this.t++;
    if (this.t > 40 && (app.input.menu('ok') || app.input.menu('back'))) {
      app.achToast(this.sum.newAch);
      if (this.sum.curseUnlocked) app.toast(`저주 ${app.save.curseMax}단계 해금! 편성에서 선택할 수 있다`, '#ff80a0');
      if (this.sum.rotated) app.toast('픽업 배너가 교체되었다!', '#ffcc40');
      app.go(new HubScene());
    }
  }

  world(g: CanvasRenderingContext2D): void {
    const gr = g.createLinearGradient(0, 0, 0, 270);
    gr.addColorStop(0, this.run.victory ? '#2a2010' : '#1a0810');
    gr.addColorStop(1, '#05030a');
    g.fillStyle = gr;
    g.fillRect(0, 0, 480, 270);
    for (let i = 0; i < 40; i++) {
      const x = (i * 97 + this.t * (0.2 + (i % 3) * 0.1)) % 480;
      const y = 270 - ((i * 53 + this.t * 0.4 * (1 + (i % 4))) % 270);
      g.fillStyle = this.run.victory ? 'rgba(255,220,120,0.5)' : 'rgba(160,140,255,0.4)';
      g.fillRect(x, y, 1, 1);
    }
  }

  ui(g: CanvasRenderingContext2D): void {
    const run = this.run;
    const st = run.stats;
    const a = Math.min(1, this.t / 30);
    text(g, run.trueEnd ? '망각의 끝 — 진정한 계약 완수' : run.victory ? '계약 완수' : '쓰러졌다…', 240, 12, { size: 18, align: 'center', color: run.victory ? '#ffe080' : '#ff8090', bold: true, alpha: a });
    const ch = chapterDef(run.theme);
    const node = run.nodes[run.cur];
    text(g, `도달: 제${run.chapter}장 ${ch.name} — ${node ? ROOM_TYPES[node.type].name : ''} (${(node?.layer ?? 0) + 1}/${run.layers.length})`, 240, 38, { size: 8, align: 'center', color: '#d0c8e0' });
    if (!run.victory && st.cause) text(g, `사망 원인: ${st.cause}`, 240, 50, { size: 7, align: 'center', color: '#ff9090' });
    // 기록
    panel(g, 16, 64, 210, 112);
    const sec = Math.floor(st.frames / 60);
    const rows: [string, string][] = [
      ['처치 수', `${st.kills}`],
      ['정화한 방', `${st.rooms}`],
      ['총 피해량', fmtNum(st.dmg)],
      ['최대 콤보', `${st.maxCombo}`],
      ['교대 공격 적중', `${st.swapHits}`],
      ['쓰러뜨린 보스', `${st.bosses.length}`],
      ['플레이 시간', `${Math.floor(sec / 60)}분 ${sec % 60}초`],
    ];
    rows.forEach(([k, v], i) => {
      text(g, k, 26, 72 + i * 14, { size: 7, color: '#a8a0c0' });
      text(g, v, 214, 72 + i * 14, { size: 8, align: 'right', color: '#ffffff' });
    });
    // 보상
    panel(g, 234, 64, 230, 112, { border: '#ffcc40' });
    text(g, '획득 보상', 244, 70, { size: 9, color: '#ffe080', bold: true });
    drawIcon(g, 'gem', 246, 88, 14, '#6a9aff');
    text(g, `영혼석 +${this.sum.stones}${this.sum.bonusStones ? `  (첫 처치 +${this.sum.bonusStones})` : ''}`, 266, 90, { size: 8, color: '#9ec0ff' });
    drawIcon(g, 'shard', 246, 108, 14, '#40d0e0');
    text(g, `영혼 결정 +${this.sum.crystals}`, 266, 110, { size: 8, color: '#a0f0ff' });
    text(g, `보유: 영혼석 ${app.save.stones} · 영혼 결정 ${app.save.crystals}`, 244, 130, { size: 7, color: '#c8c0d8' });
    if (this.sum.newAch.length) text(g, `새 업적 ${this.sum.newAch.length}개: ${this.sum.newAch.map((id) => ACHIEVEMENTS.find((x) => x.id === id)?.name).join(', ')}`, 244, 144, { size: 6, color: '#ffe080', maxW: 214 });
    if (this.sum.curseUnlocked) text(g, `저주 ${app.save.curseMax}단계 해금!`, 244, 156, { size: 7, color: '#ff80a0', bold: true });
    if (app.save.stones >= 160) text(g, '▶ 계약의 제단에서 새 영웅을 부를 수 있다!', 244, 164, { size: 6, color: '#ffcc40' });
    // 최종 빌드
    panel(g, 16, 182, 448, 70);
    text(g, '최종 빌드', 26, 186, { size: 8, color: '#e0d0ff', bold: true });
    run.party.forEach((p, i) => {
      portrait(g, p.id, 26 + i * 34, 198, 28);
      text(g, CHAR_MAP[p.id].name, 40 + i * 34, 228, { size: 6, align: 'center', color: '#c8c0d8' });
    });
    const w = WEAPON_MAP[run.weapon.id];
    drawIcon(g, w.icon, 100, 200, 24, w.col);
    text(g, w.name, 112, 228, { size: 6, align: 'center', color: '#c8c0d8', maxW: 60 });
    const relics = run.relics.filter((r) => RELIC_MAP[r]);
    relics.slice(0, 16).forEach((id, i) => {
      const r = RELIC_MAP[id];
      drawIcon(g, r.icon, 150 + (i % 8) * 18, 196 + Math.floor(i / 8) * 18, 14, r.col);
    });
    const tags: CrestId[] = [...relics.flatMap((r) => RELIC_MAP[r].crest), ...(w.crest ?? []), ...run.party.map((p) => CHAR_MAP[p.id].crest).filter((c): c is CrestId => !!c)];
    evalCrests(tags)
      .filter((c) => c.tier > 0)
      .slice(0, 4)
      .forEach((c, i) => {
        const cd = CREST_MAP[c.id];
        drawIcon(g, cd.icon, 300 + i * 40, 204, 12, cd.col);
        text(g, `${cd.name}${c.tier}`, 314 + i * 40, 206, { size: 6, color: cd.col });
      });
    if (this.t > 40) keyHint(g, [[app.input.label('attack'), '성소로 돌아가기']]);
  }
}
