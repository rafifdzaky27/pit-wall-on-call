import type { Bus, Cue } from "./cues";

/** Café recordings (plan R1): CC0 and public domain, trimmed by scripts/ambience.mjs. */
export const AMBIENCE_URLS = { murmur: "/audio/cafe-murmur.mp3", rain: "/audio/rain-window.mp3" };
/** Loops overlap by this much, so the seam is never heard (plan R9). */
export const CROSSFADE_S = 1.5;
const MURMUR_GAIN = 1;
const RAIN_GAIN = 0.7;

/** Fetches and decodes a recording; any failure means silence, never an error (cold-open spec §7). */
export async function loadBuffer(ctx: BaseAudioContext, url: string, fetcher: typeof fetch = fetch): Promise<AudioBuffer | null> {
  try {
    const res = await fetcher(url);
    if (!res.ok) return null;
    return await ctx.decodeAudioData(await res.arrayBuffer());
  } catch {
    return null;
  }
}

interface AmbienceEngine {
  readonly context: AudioContext | null;
  input(bus: Bus): AudioNode | null;
  play(cue: Cue): void;
}

type Loader = (ctx: BaseAudioContext, url: string) => Promise<AudioBuffer | null>;

const between = (lo: number, hi: number) => lo + Math.random() * (hi - lo);

/** The café's room tone: a murmur loop, rain when it rains, and cups and steam now and then. */
export class Ambience {
  running = false;
  private readonly timers = new Set<number>();
  private readonly sources = new Set<AudioBufferSourceNode>();
  private readonly cache = new Map<string, Promise<AudioBuffer | null>>();
  private readonly engine: AmbienceEngine;
  private readonly load: Loader;

  constructor(engine: AmbienceEngine, load: Loader = (ctx, url) => loadBuffer(ctx, url)) {
    this.engine = engine;
    this.load = load;
  }

  async start({ rain }: { rain: boolean }): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.every("clink", 4, 11);
    this.every("hiss", 20, 40);
    const ctx = this.engine.context;
    if (!ctx) return;
    const loads = [this.buffer(ctx, AMBIENCE_URLS.murmur).then((b) => b && this.loop(ctx, b, MURMUR_GAIN))];
    if (rain) loads.push(this.buffer(ctx, AMBIENCE_URLS.rain).then((b) => b && this.loop(ctx, b, RAIN_GAIN)));
    await Promise.all(loads);
  }

  stop(): void {
    this.running = false;
    for (const id of this.timers) window.clearTimeout(id);
    this.timers.clear();
    for (const src of this.sources) {
      try {
        src.stop();
      } catch {
        // Already stopped.
      }
    }
    this.sources.clear();
  }

  private buffer(ctx: BaseAudioContext, url: string): Promise<AudioBuffer | null> {
    let pending = this.cache.get(url);
    if (!pending) {
      pending = this.load(ctx, url);
      this.cache.set(url, pending);
    }
    return pending;
  }

  private later(fn: () => void, ms: number): void {
    const id = window.setTimeout(() => {
      this.timers.delete(id);
      if (this.running) fn();
    }, Math.max(0, ms));
    this.timers.add(id);
  }

  /** Plays a synthesized café cue at random intervals. */
  private every(cue: Cue, lo: number, hi: number): void {
    this.later(() => {
      // While suspended (paused, hidden) the cue would pile up and play all at once on resume.
      if (this.engine.context?.state !== "suspended") this.engine.play(cue);
      this.every(cue, lo, hi);
    }, between(lo, hi) * 1000);
  }

  /** Each pass starts before the last one ends, and the two crossfade. */
  private loop(ctx: AudioContext, buffer: AudioBuffer, gain: number): void {
    if (!this.running) return;
    const dest = this.engine.input("ambience");
    if (!dest) return;
    const dur = buffer.duration;
    const pass = (at: number) => {
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, at);
      env.gain.linearRampToValueAtTime(gain, at + CROSSFADE_S);
      env.gain.setValueAtTime(gain, at + dur - CROSSFADE_S);
      env.gain.linearRampToValueAtTime(0, at + dur);
      src.connect(env).connect(dest);
      src.onended = () => this.sources.delete(src);
      this.sources.add(src);
      src.start(at);
      src.stop(at + dur);
      const next = at + dur - CROSSFADE_S;
      this.later(() => pass(next), (next - ctx.currentTime - 1) * 1000);
    };
    pass(ctx.currentTime + 0.05);
  }
}
