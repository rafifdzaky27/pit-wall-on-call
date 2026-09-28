import { mulberry32, streamSeed } from "@pitwall/engine";
import type { Bus } from "./cues";
import { audio } from "./engine";

/**
 * A lo-fi radio generated in the browser (cold-open spec C8): seeded seventh-chord progressions,
 * a swung drum kit and vinyl crackle. It uses its own RNG and never touches the engine's.
 */
export interface LofiPattern {
  bpm: number;
  /** Root MIDI note of the key. */
  key: number;
  /** Four chords of four MIDI notes, one per bar. */
  chords: number[][];
  kick: boolean[];
  snare: boolean[];
  hat: boolean[];
  /** Delay of the off-beat 16ths, as a fraction of a 16th. */
  swing: number;
}

const PROGRESSIONS = [
  [2, 5, 1, 6],
  [1, 6, 2, 5],
  [4, 7, 1, 1],
  [1, 4, 3, 6],
  [6, 4, 1, 5],
];
const KEYS = [57, 58, 60, 62, 63];
const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const STEPS = 16;
/** Bars before the radio moves to the next progression on its own. */
const BARS_PER_PATTERN = 8;
const LOOKAHEAD_S = 0.12;
const SCHEDULE_MS = 25;

const semitone = (idx: number) => 12 * Math.floor(idx / 7) + MAJOR[idx % 7]!;

/** Root, third, fifth and seventh of a scale degree (1–7), voiced an octave under the key. */
function seventh(key: number, degree: number): number[] {
  const root = degree - 1;
  return [0, 2, 4, 6].map((i) => key - 12 + semitone(root + i));
}

export function lofiPattern(seed: number, index: number): LofiPattern {
  const rng = mulberry32(streamSeed(seed, `lofi:${index}`));
  const key = KEYS[rng.int(KEYS.length)]!;
  const progression = PROGRESSIONS[rng.int(PROGRESSIONS.length)]!;
  const bpm = 70 + rng.int(16);
  const swing = 0.1 + rng.int(9) / 100;
  const kick = Array.from({ length: STEPS }, (_, i) => i === 0 || i === 7 || i === 10);
  kick[14] = rng.int(2) === 1;
  const snare = Array.from({ length: STEPS }, (_, i) => i === 4 || i === 12);
  const hat = Array.from({ length: STEPS }, (_, i) => i % 2 === 0 || rng.int(10) < 3);
  return { bpm, key, chords: progression.map((d) => seventh(key, d)), kick, snare, hat, swing };
}

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

interface RadioEngine {
  readonly context: AudioContext | null;
  input(bus: Bus): AudioNode | null;
}

export class LofiRadio {
  pattern: LofiPattern;
  private index = 0;
  private timer: number | undefined;
  private ctx: AudioContext | null = null;
  private out: GainNode | null = null;
  private keys: BiquadFilterNode | null = null;
  private crackle: AudioBufferSourceNode | null = null;
  private wobble: OscillatorNode | null = null;
  private wobbleDepth: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private step = 0;
  private bar = 0;
  private nextTime = 0;
  private readonly engine: RadioEngine;
  private readonly seed: number;

  constructor(engine: RadioEngine, seed = crypto.getRandomValues(new Uint32Array(1))[0]!) {
    this.engine = engine;
    this.seed = seed;
    this.pattern = lofiPattern(seed, 0);
  }

  get playing(): boolean {
    return this.timer !== undefined;
  }

  start(): void {
    if (this.playing) return;
    const ctx = this.engine.context;
    const dest = this.engine.input("music");
    if (!ctx || !dest) return;
    this.ctx = ctx;
    this.out = ctx.createGain();
    this.out.gain.value = 0.9;
    this.out.connect(dest);
    // The keys sit behind a warm low-pass, as if played through an old speaker.
    this.keys = ctx.createBiquadFilter();
    this.keys.type = "lowpass";
    this.keys.frequency.value = 1400;
    this.keys.connect(this.out);
    this.startCrackle(ctx);
    // Tape wobble: a slow LFO bends the keys ±6 cents.
    this.wobble = ctx.createOscillator();
    this.wobble.frequency.value = 0.3;
    this.wobbleDepth = ctx.createGain();
    this.wobbleDepth.gain.value = 6;
    this.wobble.connect(this.wobbleDepth);
    this.wobble.start();
    this.step = 0;
    this.bar = 0;
    this.nextTime = ctx.currentTime + 0.05;
    this.timer = window.setInterval(() => this.schedule(), SCHEDULE_MS);
    this.schedule();
  }

  stop(): void {
    window.clearInterval(this.timer);
    this.timer = undefined;
    for (const node of [this.crackle, this.wobble]) {
      try {
        node?.stop();
      } catch {
        // Already stopped.
      }
    }
    this.crackle = null;
    this.wobble = null;
    this.wobbleDepth = null;
    this.out?.disconnect();
    this.out = null;
    this.keys = null;
  }

  next(): void {
    this.index++;
    this.pattern = lofiPattern(this.seed, this.index);
    this.bar = 0;
  }

  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx || !this.out) return;
    while (this.nextTime < ctx.currentTime + LOOKAHEAD_S) {
      this.playStep(this.step, this.nextTime);
      this.nextTime += 60 / this.pattern.bpm / 4;
      this.step++;
      if (this.step === STEPS) {
        this.step = 0;
        this.bar++;
        if (this.bar % BARS_PER_PATTERN === 0) this.next();
      }
    }
  }

  private playStep(i: number, t: number): void {
    const p = this.pattern;
    const sixteenth = 60 / p.bpm / 4;
    const at = t + (i % 2 ? p.swing * sixteenth : 0);
    if (p.kick[i]) this.kick(at);
    if (p.snare[i]) this.noiseHit(at, "bandpass", 1800, 0.12, 0.25);
    if (p.hat[i]) this.noiseHit(at, "highpass", 7000, 0.04, 0.08);
    const chord = p.chords[this.bar % p.chords.length]!;
    if (i === 0) this.chord(chord, t, sixteenth * STEPS);
    if (i === 0 || i === 8) this.tone(hz(chord[0]! - 12), "sine", t, sixteenth * 7, 0.22, this.out!);
  }

  private kick(t: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.18);
    env.gain.setValueAtTime(0.5, t);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    osc.connect(env).connect(this.out!);
    osc.start(t);
    osc.stop(t + 0.22);
  }

  private noiseHit(t: number, type: BiquadFilterType, f: number, dur: number, gain: number): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = f;
    const env = ctx.createGain();
    env.gain.setValueAtTime(gain, t);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(env).connect(this.out!);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  private chord(notes: number[], t: number, dur: number): void {
    for (const n of notes) {
      this.tone(hz(n), "sine", t, dur, 0.05, this.keys!);
      // A second voice a few cents sharp gives the Rhodes-like shimmer.
      this.tone(hz(n), "triangle", t, dur, 0.03, this.keys!, 7);
    }
  }

  private tone(f: number, wave: OscillatorType, t: number, dur: number, gain: number, dest: AudioNode, detune = 0): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = wave;
    osc.frequency.value = f;
    osc.detune.value = detune;
    if (dest === this.keys) this.wobbleDepth?.connect(osc.detune);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(gain, t + 0.08);
    env.gain.setTargetAtTime(0.0001, t + dur - 0.1, 0.08);
    osc.connect(env).connect(dest);
    osc.start(t);
    osc.stop(t + dur + 0.3);
  }

  private startCrackle(ctx: AudioContext): void {
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    // Sparse clicks over a faint hiss: the sound of a record between songs.
    for (let i = 0; i < len; i++) data[i] = (Math.random() < 0.0008 ? Math.random() * 1.6 - 0.8 : 0) + (Math.random() * 2 - 1) * 0.02;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const env = ctx.createGain();
    env.gain.value = 0.03;
    src.connect(env).connect(this.out!);
    src.start();
    this.crackle = src;
  }

  private noise(ctx: AudioContext): AudioBuffer {
    if (!this.noiseBuffer) {
      const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      this.noiseBuffer = buf;
    }
    return this.noiseBuffer;
  }
}

export const radio = new LofiRadio(audio);
