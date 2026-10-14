/** WebAudio 절차 합성 효과음 + 절차 생성 배경음악. 외부 사운드 파일 없음. */

type Wave = OscillatorType;

export type MusicTheme = 'title' | 'hub' | 'ch1' | 'ch2' | 'ch3' | 'ch4' | 'ch5' | 'ch6' | 'ch7' | 'boss' | 'finalboss' | 'gacha' | 'none';

interface ThemeDef {
  bpm: number;
  root: number; // MIDI
  scale: number[];
  prog: number[]; // 스케일 도수
  lead: Wave;
  bass: Wave;
  pad: Wave;
  drums: number; // 기본 드럼 강도
  swing?: number;
}

const MINOR = [0, 2, 3, 5, 7, 8, 10];
const PHRYG = [0, 1, 3, 5, 7, 8, 10];
const HARM = [0, 2, 3, 5, 7, 8, 11];
const DORIAN = [0, 2, 3, 5, 7, 9, 10];
const LOCRIAN = [0, 1, 3, 5, 6, 8, 10];

const THEMES: Record<Exclude<MusicTheme, 'none'>, ThemeDef> = {
  title: { bpm: 76, root: 45, scale: HARM, prog: [0, 5, 3, 4], lead: 'triangle', bass: 'sine', pad: 'sawtooth', drums: 0 },
  hub: { bpm: 84, root: 50, scale: DORIAN, prog: [0, 3, 5, 4], lead: 'triangle', bass: 'triangle', pad: 'sine', drums: 0.2 },
  gacha: { bpm: 96, root: 52, scale: DORIAN, prog: [0, 5, 3, 6], lead: 'sine', bass: 'triangle', pad: 'sine', drums: 0 },
  ch1: { bpm: 104, root: 45, scale: MINOR, prog: [0, 5, 6, 4], lead: 'square', bass: 'triangle', pad: 'sawtooth', drums: 0.5 },
  ch2: { bpm: 96, root: 43, scale: DORIAN, prog: [0, 2, 3, 6], lead: 'triangle', bass: 'square', pad: 'sine', drums: 0.5, swing: 0.12 },
  ch3: { bpm: 122, root: 40, scale: PHRYG, prog: [0, 1, 0, 6], lead: 'sawtooth', bass: 'sawtooth', pad: 'square', drums: 0.7 },
  ch4: { bpm: 112, root: 42, scale: HARM, prog: [0, 3, 4, 5], lead: 'square', bass: 'triangle', pad: 'sawtooth', drums: 0.6 },
  ch5: { bpm: 100, root: 41, scale: DORIAN, prog: [0, 4, 5, 3], lead: 'triangle', bass: 'sawtooth', pad: 'sine', drums: 0.55, swing: 0.08 },
  ch6: { bpm: 92, root: 47, scale: HARM, prog: [0, 5, 2, 4], lead: 'sine', bass: 'triangle', pad: 'triangle', drums: 0.4 },
  ch7: { bpm: 118, root: 37, scale: LOCRIAN, prog: [0, 6, 1, 4], lead: 'square', bass: 'sawtooth', pad: 'sine', drums: 0.65 },
  boss: { bpm: 140, root: 40, scale: PHRYG, prog: [0, 1, 5, 4], lead: 'sawtooth', bass: 'square', pad: 'sawtooth', drums: 1 },
  finalboss: { bpm: 150, root: 38, scale: LOCRIAN, prog: [0, 1, 4, 2], lead: 'square', bass: 'sawtooth', pad: 'sawtooth', drums: 1 },
};

const mtof = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);

export class Audio {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  private noiseBuf!: AudioBuffer;
  private comp!: DynamicsCompressorNode;
  musicVol = 0.6;
  sfxVol = 0.8;
  private theme: MusicTheme = 'none';
  private pendingTheme: MusicTheme = 'none';
  intensity = 0; // 0..1 전투 강도
  private step = 0;
  private nextTime = 0;
  timer: number | null = null;
  private lastPlay = new Map<string, number>();
  private melodySeed = 1;

  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
    } catch {
      this.ctx = null;
      return;
    }
    const c = this.ctx;
    this.comp = c.createDynamicsCompressor();
    this.comp.threshold.value = -14;
    this.comp.ratio.value = 4;
    this.master = c.createGain();
    this.master.gain.value = 0.8;
    this.sfxBus = c.createGain();
    this.musicBus = c.createGain();
    this.sfxBus.connect(this.comp);
    this.musicBus.connect(this.comp);
    this.comp.connect(this.master);
    this.master.connect(c.destination);
    const len = c.sampleRate;
    this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.applyVolumes();
    this.nextTime = c.currentTime + 0.1;
    this.timer = window.setInterval(() => this.schedule(), 25);
    if (this.pendingTheme !== 'none') this.playMusic(this.pendingTheme);
  }

  applyVolumes(): void {
    if (!this.ctx) return;
    this.sfxBus.gain.value = this.sfxVol;
    this.musicBus.gain.value = this.musicVol * 0.5;
  }

  // ---------------- 합성 프리미티브 ----------------
  private tone(freq: number, dur: number, type: Wave, vol: number, slideTo?: number, delay = 0, bus?: AudioNode, attack = 0.004): void {
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(20, freq), t);
    if (slideTo !== undefined) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(bus ?? this.sfxBus);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private noise(dur: number, vol: number, filterFreq: number, type: BiquadFilterType = 'lowpass', delay = 0, slideTo?: number, bus?: AudioNode, q = 1): void {
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime + delay;
    const s = c.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(filterFreq, t);
    if (slideTo) f.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f);
    f.connect(g);
    g.connect(bus ?? this.sfxBus);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.05);
  }

  /** 이름 있는 효과음. 같은 소리를 한 프레임에 여러 번 겹치지 않도록 제한 */
  play(name: string, pitch = 1): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const last = this.lastPlay.get(name) ?? -1;
    if (now - last < 0.03) return;
    this.lastPlay.set(name, now);
    const p = pitch * (0.96 + Math.random() * 0.08);
    switch (name) {
      case 'swing':
        this.noise(0.09, 0.18, 2400 * p, 'bandpass', 0, 900, undefined, 2);
        break;
      case 'swing_heavy':
        this.noise(0.2, 0.28, 900 * p, 'bandpass', 0, 250, undefined, 2);
        this.tone(110 * p, 0.18, 'sine', 0.1, 60);
        break;
      case 'hit_power':
        this.noise(0.18, 0.55, 1400, 'lowpass', 0, 200);
        this.tone(130 * p, 0.22, 'square', 0.25, 40);
        this.tone(70 * p, 0.3, 'sine', 0.45, 30);
        break;
      case 'hit_speed':
        this.noise(0.07, 0.35, 5000, 'highpass');
        this.tone(520 * p, 0.06, 'square', 0.12, 260);
        break;
      case 'hit_ranged':
        this.noise(0.08, 0.3, 3000, 'bandpass', 0, 1200, undefined, 3);
        this.tone(300 * p, 0.08, 'triangle', 0.15, 150);
        break;
      case 'hit_magic':
        this.tone(880 * p, 0.15, 'sine', 0.18, 440);
        this.tone(1320 * p, 0.12, 'triangle', 0.1, 660);
        this.noise(0.1, 0.2, 2000, 'bandpass');
        break;
      case 'hit_guard':
        this.tone(220 * p, 0.12, 'square', 0.2, 110);
        this.noise(0.12, 0.4, 1800, 'lowpass', 0, 300);
        this.tone(1760 * p, 0.08, 'sine', 0.06);
        break;
      case 'hit_crit':
        this.tone(1600 * p, 0.12, 'square', 0.12, 800);
        this.noise(0.15, 0.4, 6000, 'highpass');
        break;
      case 'clang':
        this.tone(1200 * p, 0.25, 'square', 0.12, 1100);
        this.tone(1800 * p, 0.2, 'sine', 0.1);
        this.noise(0.05, 0.3, 4000, 'highpass');
        break;
      case 'dash':
        this.noise(0.18, 0.25, 800, 'bandpass', 0, 3500, undefined, 1.5);
        break;
      case 'jump':
        this.tone(220 * p, 0.1, 'square', 0.07, 440);
        break;
      case 'djump':
        this.tone(330 * p, 0.12, 'triangle', 0.1, 660);
        this.noise(0.1, 0.12, 2000, 'bandpass', 0, 4000);
        break;
      case 'land':
        this.noise(0.08, 0.2, 500, 'lowpass');
        break;
      case 'hurt':
        this.tone(300 * p, 0.25, 'sawtooth', 0.25, 90);
        this.noise(0.2, 0.4, 1200, 'lowpass', 0, 200);
        break;
      case 'enemy_hurt':
        this.tone(200 * p, 0.08, 'square', 0.08, 120);
        break;
      case 'kill':
        this.noise(0.3, 0.3, 2500, 'lowpass', 0, 200);
        this.tone(180 * p, 0.3, 'triangle', 0.18, 50);
        break;
      case 'soul':
        this.tone(1200 * p, 0.12, 'sine', 0.06, 1800);
        break;
      case 'swap':
        this.tone(440 * p, 0.12, 'square', 0.12, 880);
        this.tone(660 * p, 0.18, 'triangle', 0.12, 1320, 0.05);
        this.noise(0.25, 0.25, 600, 'bandpass', 0, 5000, undefined, 2);
        break;
      case 'swap_hit':
        this.tone(140 * p, 0.5, 'sawtooth', 0.25, 40);
        this.noise(0.4, 0.5, 3000, 'lowpass', 0, 100);
        this.tone(1760 * p, 0.3, 'sine', 0.08, 880);
        break;
      case 'skill':
        this.tone(330 * p, 0.25, 'sawtooth', 0.1, 660);
        this.tone(495 * p, 0.25, 'triangle', 0.1, 990, 0.03);
        break;
      case 'cast':
        this.tone(660 * p, 0.3, 'sine', 0.12, 1320);
        this.tone(990 * p, 0.3, 'sine', 0.06, 1980, 0.05);
        break;
      case 'proj':
        this.tone(700 * p, 0.08, 'square', 0.06, 300);
        break;
      case 'arrow':
        this.noise(0.12, 0.25, 4000, 'bandpass', 0, 1500, undefined, 4);
        this.tone(900 * p, 0.05, 'triangle', 0.06, 500);
        break;
      case 'enemy_shot':
        this.tone(400 * p, 0.15, 'square', 0.06, 200);
        break;
      case 'explode':
        this.noise(0.6, 0.6, 1800, 'lowpass', 0, 80);
        this.tone(90 * p, 0.5, 'sine', 0.5, 30);
        break;
      case 'thunder':
        this.noise(0.4, 0.5, 6000, 'highpass', 0, 1500);
        this.tone(60 * p, 0.4, 'sawtooth', 0.2, 30);
        break;
      case 'freeze':
        this.tone(2000 * p, 0.3, 'sine', 0.08, 3000);
        this.noise(0.3, 0.2, 7000, 'highpass');
        break;
      case 'burn':
        this.noise(0.25, 0.2, 1200, 'bandpass', 0, 400);
        break;
      case 'poison':
        this.tone(200 * p, 0.2, 'sine', 0.08, 120);
        this.tone(260 * p, 0.2, 'sine', 0.05, 140, 0.05);
        break;
      case 'shield':
        this.tone(523 * p, 0.3, 'triangle', 0.12, 1046);
        this.tone(784 * p, 0.3, 'sine', 0.08);
        break;
      case 'parry':
        this.tone(1568 * p, 0.35, 'square', 0.12, 1500);
        this.tone(2093 * p, 0.4, 'sine', 0.1);
        this.noise(0.1, 0.4, 5000, 'highpass');
        break;
      case 'heal':
        [523, 659, 784].forEach((f, i) => this.tone(f * p, 0.25, 'sine', 0.1, undefined, i * 0.06));
        break;
      case 'timestop':
        this.tone(880, 1.2, 'sine', 0.15, 110);
        this.tone(1320, 1.2, 'triangle', 0.08, 165);
        break;
      case 'coin':
        this.tone(988 * p, 0.06, 'square', 0.07);
        this.tone(1319 * p, 0.12, 'square', 0.07, undefined, 0.05);
        break;
      case 'gem':
        [784, 1047, 1319, 1568].forEach((f, i) => this.tone(f * p, 0.18, 'triangle', 0.08, undefined, i * 0.04));
        break;
      case 'chest':
        this.noise(0.2, 0.3, 600, 'lowpass');
        [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.3, 'square', 0.07, undefined, 0.1 + i * 0.07));
        break;
      case 'relic':
        [392, 523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.4, 'triangle', 0.09, undefined, i * 0.06));
        break;
      case 'door':
        this.noise(0.5, 0.3, 300, 'lowpass', 0, 100);
        this.tone(80, 0.4, 'square', 0.08, 60);
        break;
      case 'select':
        this.tone(660, 0.04, 'square', 0.05);
        break;
      case 'confirm':
        this.tone(660, 0.06, 'square', 0.07);
        this.tone(990, 0.1, 'square', 0.07, undefined, 0.05);
        break;
      case 'back':
        this.tone(440, 0.08, 'square', 0.06, 330);
        break;
      case 'error':
        this.tone(150, 0.18, 'square', 0.1);
        this.tone(140, 0.18, 'square', 0.1, undefined, 0.1);
        break;
      case 'buy':
        this.tone(784, 0.06, 'square', 0.07);
        this.tone(1175, 0.15, 'square', 0.07, undefined, 0.06);
        this.noise(0.1, 0.1, 6000, 'highpass', 0.06);
        break;
      case 'levelup':
        [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.25, 'square', 0.07, undefined, i * 0.05));
        break;
      case 'gacha_throw':
        this.noise(0.5, 0.2, 400, 'bandpass', 0, 3000, undefined, 3);
        this.tone(200, 0.6, 'sine', 0.1, 800);
        break;
      case 'gacha_impact':
        this.noise(0.6, 0.5, 2000, 'lowpass', 0, 100);
        this.tone(60, 0.6, 'sine', 0.5, 30);
        break;
      case 'beam_3':
        this.tone(440, 1.0, 'sine', 0.12, 660);
        this.tone(660, 1.0, 'triangle', 0.06, 990);
        break;
      case 'beam_4':
        this.tone(440, 1.2, 'sawtooth', 0.08, 880);
        this.tone(554, 1.2, 'sine', 0.12, 1108);
        this.tone(659, 1.2, 'sine', 0.1, 1318);
        break;
      case 'beam_5':
        this.tone(220, 1.8, 'sawtooth', 0.1, 880);
        [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => this.tone(f, 1.2, 'sine', 0.08, undefined, 0.3 + i * 0.1));
        this.noise(1.5, 0.3, 500, 'bandpass', 0, 8000, undefined, 2);
        break;
      case 'flip':
        this.noise(0.1, 0.2, 3000, 'bandpass', 0, 6000, undefined, 3);
        this.tone(880, 0.06, 'triangle', 0.05);
        break;
      case 'reveal_3':
        this.tone(660, 0.2, 'triangle', 0.08);
        break;
      case 'reveal_4':
        [587, 740, 880].forEach((f, i) => this.tone(f, 0.35, 'triangle', 0.09, undefined, i * 0.06));
        break;
      case 'reveal_5':
        this.tone(55, 1.2, 'sawtooth', 0.3, 40);
        this.noise(1.0, 0.5, 1500, 'lowpass', 0, 80);
        [392, 523, 659, 784, 1047, 1319, 1568, 2093].forEach((f, i) => this.tone(f, 0.8, 'square', 0.05, undefined, 0.2 + i * 0.07));
        break;
      case 'boss_roar':
        this.tone(80, 1.2, 'sawtooth', 0.35, 40);
        this.tone(120, 1.2, 'square', 0.2, 50);
        this.noise(1.2, 0.4, 600, 'lowpass', 0, 100);
        break;
      case 'phase':
        this.tone(55, 1.5, 'sawtooth', 0.4, 110);
        this.noise(1.2, 0.5, 300, 'lowpass', 0, 4000);
        break;
      case 'warn':
        this.tone(880, 0.1, 'square', 0.07);
        this.tone(880, 0.1, 'square', 0.07, undefined, 0.15);
        break;
      case 'death':
        [392, 349, 311, 262, 196].forEach((f, i) => this.tone(f, 0.4, 'triangle', 0.12, undefined, i * 0.15));
        break;
      case 'victory':
        [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.35, 'square', 0.08, undefined, i * 0.11));
        break;
      case 'crumble':
        this.noise(0.4, 0.4, 800, 'lowpass', 0, 150);
        break;
      case 'spike':
        this.tone(1200, 0.08, 'square', 0.06, 600);
        break;
      case 'step':
        this.noise(0.03, 0.05, 900, 'lowpass');
        break;
      default:
        this.tone(440 * p, 0.1, 'square', 0.05);
    }
  }

  // ---------------- 음악 ----------------
  playMusic(theme: MusicTheme): void {
    this.pendingTheme = theme;
    if (!this.ctx) return;
    if (this.theme === theme) return;
    this.theme = theme;
    this.step = 0;
    this.melodySeed = Math.floor(Math.random() * 1000) + 1;
    this.nextTime = this.ctx.currentTime + 0.1;
  }

  private seeded(i: number): number {
    const x = Math.sin(i * 12.9898 + this.melodySeed * 78.233) * 43758.5453;
    return x - Math.floor(x);
  }

  private schedule(): void {
    const c = this.ctx;
    if (!c || this.theme === 'none') return;
    const th = THEMES[this.theme];
    const sixteenth = 60 / th.bpm / 4;
    while (this.nextTime < c.currentTime + 0.12) {
      this.playStep(th, this.step, this.nextTime, sixteenth);
      const swing = th.swing && this.step % 2 === 0 ? sixteenth * th.swing : th.swing ? -sixteenth * th.swing : 0;
      this.nextTime += sixteenth + swing;
      this.step++;
    }
  }

  private note(deg: number, oct: number, th: ThemeDef): number {
    const n = th.scale.length;
    const o = Math.floor(deg / n);
    const d = ((deg % n) + n) % n;
    return th.root + th.scale[d] + 12 * (oct + o);
  }

  private mtone(freq: number, t: number, dur: number, type: Wave, vol: number, attack = 0.01): void {
    const c = this.ctx!;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.musicBus);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private mnoise(t: number, dur: number, vol: number, freq: number, type: BiquadFilterType): void {
    const c = this.ctx!;
    const s = c.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f);
    f.connect(g);
    g.connect(this.musicBus);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.02);
  }

  private playStep(th: ThemeDef, step: number, t: number, s16: number): void {
    const bar = Math.floor(step / 16);
    const pos = step % 16;
    const chord = th.prog[bar % th.prog.length];
    const inten = this.theme === 'boss' || this.theme === 'finalboss' ? 1 : Math.min(1, th.drums + this.intensity * 0.6);
    // 패드: 마디 시작
    if (pos === 0) {
      for (const d of [0, 2, 4]) this.mtone(mtof(this.note(chord + d, 0, th)), t, s16 * 16, th.pad, 0.025, 0.4);
    }
    // 베이스
    const bassPattern = inten > 0.7 ? [0, 3, 6, 8, 10, 12, 14] : [0, 6, 8, 14];
    if (bassPattern.includes(pos)) this.mtone(mtof(this.note(chord, -1, th)), t, s16 * 2.2, th.bass, 0.12);
    // 아르페지오 (강도 상승 시)
    if (inten > 0.35 && pos % 2 === 0) {
      const arp = [0, 2, 4, 7][(pos / 2) % 4];
      this.mtone(mtof(this.note(chord + arp, 1, th)), t, s16 * 1.5, 'triangle', 0.03 + inten * 0.02);
    }
    // 멜로디: 시드 기반 절차 생성 (4마디 반복 + 변주)
    const phrase = bar % 4;
    const r = this.seeded(phrase * 16 + pos + (bar % 8 >= 4 ? 100 : 0));
    if ((pos % 4 === 0 && r < 0.75) || (pos % 2 === 0 && r < 0.25)) {
      const deg = chord + Math.floor(this.seeded(phrase * 31 + pos * 7) * 7) - 1;
      const dur = s16 * (pos % 4 === 0 ? 3 : 1.5);
      this.mtone(mtof(this.note(deg, 1, th)), t, dur, th.lead, 0.045);
      if (this.theme === 'title' || this.theme === 'gacha') this.mtone(mtof(this.note(deg, 2, th)), t + s16 * 0.5, dur, 'sine', 0.015);
    }
    // 드럼
    if (inten > 0.15) {
      if (pos === 0 || pos === 8 || (inten > 0.8 && (pos === 6 || pos === 10))) {
        this.mtone(120, t, 0.18, 'sine', 0.3 * inten + 0.05);
        this.mtone(60, t, 0.22, 'sine', 0.25 * inten);
      }
      if (pos === 4 || pos === 12) this.mnoise(t, 0.12, 0.12 * inten + 0.03, 1800, 'bandpass');
      if (inten > 0.45 && pos % 2 === 1) this.mnoise(t, 0.03, 0.05 * inten, 8000, 'highpass');
    }
  }
}

export const audio = new Audio();
