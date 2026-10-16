import { CHAR_MAP, TYPE_COL, TYPE_LABEL } from '../data/characters';
import { CREST_MAP } from '../data/crests';
import { RELIC_MAP } from '../data/relics';
import { WEAPON_MAP, weaponDesc } from '../data/weapons';
import { text, wrap } from '../gfx/renderer';
import { charArt } from '../gfx/sprites';
import { rgba } from '../gfx/pixel';
import { drawIcon } from './icons';
import { RARITY_BG, RARITY_COL, RELIC_RARITY_COL, RELIC_RARITY_NAME } from './theme';
import { stars } from './widgets';
import type { CrestId } from '../game/types';

export function crestTags(g: CanvasRenderingContext2D, tags: CrestId[], x: number, y: number): void {
  let cx = x;
  for (const t of tags) {
    const c = CREST_MAP[t];
    g.fillStyle = rgba(c.col, 0.2);
    g.fillRect(cx, y, 30, 10);
    drawIcon(g, c.icon, cx + 1, y + 1, 8, c.col);
    text(g, c.name, cx + 11, y + 1.5, { size: 6, color: c.col });
    cx += 32;
  }
}

export function relicCard(g: CanvasRenderingContext2D, id: string, x: number, y: number, w: number, h: number, sel: boolean, extra?: string): void {
  const r = RELIC_MAP[id];
  const col = RELIC_RARITY_COL[r.rarity];
  g.fillStyle = sel ? 'rgba(40,28,64,0.97)' : 'rgba(18,12,30,0.95)';
  g.fillRect(x, y, w, h);
  g.strokeStyle = sel ? col : '#3a2e52';
  g.lineWidth = sel ? 2 : 1;
  g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  g.lineWidth = 1;
  g.fillStyle = rgba(r.col, 0.15);
  g.fillRect(x + w / 2 - 20, y + 8, 40, 40);
  drawIcon(g, r.icon, x + w / 2 - 15, y + 13, 30, r.col);
  text(g, r.name, x + w / 2, y + 54, { size: 8, align: 'center', color: '#ffffff', bold: true, maxW: w - 6 });
  text(g, RELIC_RARITY_NAME[r.rarity], x + w / 2, y + 65, { size: 6, align: 'center', color: col });
  crestTags(g, r.crest, x + w / 2 - r.crest.length * 16, y + 75);
  const lines = wrap(g, r.desc, w - 12, 7);
  lines.forEach((l, i) => text(g, l, x + 6, y + 90 + i * 10, { size: 7, color: '#d8d0e8' }));
  if (extra) text(g, extra, x + w / 2, y + h - 12, { size: 7, align: 'center', color: '#ffe080', bold: true });
}

export function weaponCard(g: CanvasRenderingContext2D, id: string, rf: number, x: number, y: number, w: number, h: number, sel: boolean, extra?: string): void {
  const wd = WEAPON_MAP[id];
  const col = RARITY_COL[wd.rarity];
  g.fillStyle = sel ? 'rgba(40,28,64,0.97)' : 'rgba(18,12,30,0.95)';
  g.fillRect(x, y, w, h);
  g.strokeStyle = sel ? col : '#3a2e52';
  g.lineWidth = sel ? 2 : 1;
  g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  g.lineWidth = 1;
  const [b0, b1] = RARITY_BG[wd.rarity];
  const gr = g.createLinearGradient(0, y + 6, 0, y + 50);
  gr.addColorStop(0, b0);
  gr.addColorStop(1, b1);
  g.fillStyle = gr;
  g.fillRect(x + w / 2 - 22, y + 6, 44, 44);
  drawIcon(g, wd.icon, x + w / 2 - 16, y + 12, 32, wd.col);
  stars(g, x + w / 2, y + 54, wd.rarity, 6, 'center');
  text(g, wd.name, x + w / 2, y + 63, { size: 7, align: 'center', color: '#ffffff', bold: true, maxW: w - 6 });
  text(g, `공격력 +${wd.atk} · 재련 ${rf}`, x + w / 2, y + 74, { size: 6, align: 'center', color: '#a8a0c0' });
  if (wd.crest) crestTags(g, wd.crest, x + w / 2 - wd.crest.length * 16, y + 84);
  const lines = wrap(g, weaponDesc(wd, rf), w - 12, 7);
  lines.forEach((l, i) => text(g, l, x + 6, y + 98 + i * 10, { size: 7, color: '#d8d0e8' }));
  if (extra) text(g, extra, x + w / 2, y + h - 12, { size: 7, align: 'center', color: '#ffe080', bold: true });
}

export function charCard(g: CanvasRenderingContext2D, id: string, x: number, y: number, w: number, h: number, sel: boolean, sub?: string, pose: Parameters<typeof charArt>[1] = 'idle0'): void {
  const c = CHAR_MAP[id];
  const col = RARITY_COL[c.rarity];
  const [b0, b1] = RARITY_BG[c.rarity];
  const gr = g.createLinearGradient(0, y, 0, y + h);
  gr.addColorStop(0, b0);
  gr.addColorStop(1, b1);
  g.fillStyle = gr;
  g.fillRect(x, y, w, h);
  g.strokeStyle = sel ? '#ffffff' : col;
  g.lineWidth = sel ? 2 : 1;
  g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  g.lineWidth = 1;
  const f = charArt(id, pose);
  const sc = Math.max(1, Math.floor(Math.min(w / 30, (h - 30) / 30)));
  g.imageSmoothingEnabled = false;
  g.drawImage(f, x + w / 2 - 24 * sc, y + h - 30 - 46 * sc, 48 * sc, 48 * sc);
  stars(g, x + w / 2, y + h - 28, c.rarity, 6, 'center');
  text(g, c.name, x + w / 2, y + h - 20, { size: 8, align: 'center', color: '#ffffff', bold: true });
  text(g, sub ?? `${TYPE_LABEL[c.type]}`, x + w / 2, y + h - 10, { size: 6, align: 'center', color: sub ? '#ffe080' : TYPE_COL[c.type] });
}
