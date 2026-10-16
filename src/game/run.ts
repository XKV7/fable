import { Rng } from '../core/rng';
import type { RoomType } from '../data/meta';
import { CURSES } from '../data/meta';
import { RELICS } from '../data/relics';
import { CHARACTERS } from '../data/characters';
import { WEAPONS } from '../data/weapons';
import type { SaveData } from './save';
import { storyDef, type StoryDef } from '../data/stories';

export interface MapNode {
  id: number;
  layer: number;
  idx: number;
  type: RoomType;
  next: number[];
  visited: boolean;
}

export interface PartyMember {
  id: string;
  lv: number;
  aw: number;
  temp: boolean;
}

export interface RunStats {
  kills: number;
  dmg: number;
  stones: number;
  crystals: number;
  rooms: number;
  frames: number;
  maxCombo: number;
  swapHits: number;
  bosses: string[];
  cause: string;
  hidden: number;
  bossNoHit: boolean;
}

const MID_WEIGHTS: [RoomType, number][] = [
  ['combat', 40],
  ['elite', 13],
  ['altar', 8],
  ['armory', 8],
  ['shop', 7],
  ['rest', 6],
  ['event', 11],
  ['treasure', 6],
];

/** 챕터 맵: 층(layer)마다 2~3개 노드, 각 노드는 다음 층 2~3개와 연결 */
export function generateChapter(rng: Rng, chapter: number, tutorial: boolean): { nodes: MapNode[]; layers: number[][] } {
  const L = rng.int(7, 10);
  const nodes: MapNode[] = [];
  const layers: number[][] = [];
  let id = 0;
  for (let l = 0; l < L; l++) {
    const layer: number[] = [];
    let count: number;
    if (l === 0 || l === L - 1) count = 1;
    else count = rng.int(2, 3);
    for (let i = 0; i < count; i++) {
      let type: RoomType;
      if (l === 0) type = tutorial ? 'tutorial' : 'start';
      else if (l === L - 1) type = 'boss';
      else if (l === L - 2) type = i === 0 ? 'rest' : i === 1 ? 'shop' : 'treasure';
      else {
        const used = layer.map((n) => nodes[n].type);
        type = rng.weighted(
          MID_WEIGHTS.filter(([t]) => !(t === 'elite' && l < 2) && !(used.includes(t) && t !== 'combat')),
          ([, w]) => w,
        )[0];
      }
      nodes.push({ id, layer: l, idx: i, type, next: [], visited: false });
      layer.push(id++);
    }
    layers.push(layer);
  }
  // 정예 최소 1회 보장
  if (!nodes.some((n) => n.type === 'elite')) {
    const cands = nodes.filter((n) => n.layer >= 2 && n.layer < L - 2);
    if (cands.length) rng.pick(cands).type = 'elite';
  }
  // 연결
  for (let l = 0; l < L - 1; l++) {
    const cur = layers[l];
    const nxt = layers[l + 1];
    for (const a of cur) {
      const shuffled = rng.shuffle([...nxt]);
      const k = Math.min(nxt.length, rng.int(2, 3));
      nodes[a].next = shuffled.slice(0, k);
    }
    for (const b of nxt) {
      if (!cur.some((a) => nodes[a].next.includes(b))) nodes[rng.pick(cur)].next.push(b);
    }
    for (const a of cur) nodes[a].next.sort((x, y) => nodes[x].idx - nodes[y].idx);
  }
  return { nodes, layers };
}

export class RunState {
  rng: Rng;
  story = 1; // 스토리 (1~4)
  chapter = 1; // 진행 단계 (1~6)
  theme = 1; // 현재 챕터 테마 (ChapterDef.n)
  kingDown = false; // 스토리 최종 보스 처치 (이후 진엔딩 단계에서 쓰러져도 클리어로 인정)
  trueEnd = false;
  nodes: MapNode[] = [];
  layers: number[][] = [];
  cur = 0;
  party: PartyMember[];
  active = 0;
  weapon: { id: string; rf: number };
  relics: string[] = [];
  gold: number;
  items: string[] = [];
  hp = 1;
  shield = 0;
  bonusAtk = 0;
  bonusMaxHp = 0;
  revives: number;
  curse: number;
  stats: RunStats = { kills: 0, dmg: 0, stones: 0, crystals: 0, rooms: 0, frames: 0, maxCombo: 0, swapHits: 0, bosses: [], cause: '', hidden: 0, bossNoHit: true };
  tutorial: boolean;
  finished = false;
  victory = false;
  initialized = false;

  constructor(save: SaveData, seed?: number) {
    this.rng = new Rng(seed);
    const [a, b] = save.loadout.chars;
    const mk = (id: string): PartyMember => ({ id, lv: save.chars[id]?.lv ?? 1, aw: save.chars[id]?.aw ?? 0, temp: false });
    this.party = [mk(a), mk(b || a)];
    const w = save.loadout.weapon;
    this.weapon = { id: w, rf: save.weapons[w]?.rf ?? 1 };
    this.gold = (save.upgrades.gold ?? 0) * 40;
    this.revives = save.upgrades.revive ?? 0;
    if (save.upgrades.potion) this.items.push('potion');
    this.curse = save.curse;
    this.tutorial = !save.tutorialDone;
    this.story = Math.max(1, Math.min(save.storyMax, save.story));
    this.newChapter(1, this.storyDef.route[0][0]);
  }

  get storyDef(): StoryDef {
    return storyDef(this.story);
  }

  /** 스토리별 적·보스 체력·공격력 배율 */
  get power(): { hp: number; atk: number } {
    return this.storyDef.power;
  }

  /** 다음 단계에서 고를 수 있는 테마 */
  nextThemes(): number[] {
    return this.storyDef.route[this.chapter] ?? [];
  }

  newChapter(stage: number, theme: number): void {
    this.chapter = stage;
    this.theme = theme;
    const m = generateChapter(this.rng, stage, stage === 1 && this.tutorial && this.story === 1);
    this.nodes = m.nodes;
    this.layers = m.layers;
    this.cur = 0;
    this.nodes[0].visited = true;
  }

  get node(): MapNode {
    return this.nodes[this.cur];
  }

  get curseEnemy(): number {
    return CURSES[this.curse]?.enemy ?? 0;
  }

  get curseReward(): number {
    return CURSES[this.curse]?.reward ?? 0;
  }

  /** 아직 보유하지 않은 유물 중 무작위 n개 (희귀도 가중) */
  rollRelics(n: number, minRarity = 1): string[] {
    const pool = RELICS.filter((r) => !this.relics.includes(r.id) && r.rarity >= minRarity);
    const out: string[] = [];
    const avail = [...pool];
    for (let i = 0; i < n && avail.length; i++) {
      const r = this.rng.weighted(avail, (x) => (x.rarity === 1 ? 6 : x.rarity === 2 ? 3 : 1 + this.chapter * 0.4));
      out.push(r.id);
      avail.splice(avail.indexOf(r), 1);
    }
    return out;
  }

  rollChar(): string {
    const inParty = this.party.map((p) => p.id);
    const pool = CHARACTERS.filter((c) => !inParty.includes(c.id));
    // 희귀도가 높을수록 드물게 (★6·★7은 ★5보다 훨씬 드묾)
    return this.rng.weighted(pool, (c) => ({ 3: 6, 4: 3, 5: 1, 6: 0.3, 7: 0.1 })[c.rarity] ?? 1).id;
  }

  rollWeapons(n: number): string[] {
    const pool = WEAPONS.filter((w) => w.id !== this.weapon.id);
    const out: string[] = [];
    const avail = [...pool];
    for (let i = 0; i < n && avail.length; i++) {
      const w = this.rng.weighted(avail, (x) => (x.rarity === 3 ? 6 : x.rarity === 4 ? 3 : 0.8 + this.chapter * 0.3));
      out.push(w.id);
      avail.splice(avail.indexOf(w), 1);
    }
    return out;
  }
}
