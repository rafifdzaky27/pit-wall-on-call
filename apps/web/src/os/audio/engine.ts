import { SOUNDS, type Bus, type Cue } from "./cues";

export type { Bus, Cue } from "./cues";

/** Every level is 0–1. */
export interface Levels {
  master: number;
  ambience: number;
  music: number;
  /** Both the sfx and ui buses. */
  alerts: number;
  muted: boolean;
}

const BUSES: readonly Bus[] = ["ambience", "music", "sfx", "ui"];
/** The café through a closed laptop lid: most of the room is gone, the murmur stays. */
const MUFFLED_HZ = 700;
const OPEN_HZ = 18_000;
const MUFFLED_GAIN = 0.6;
const DUCKED = 0.25;

type AudioCtor = new () => AudioContext;

function defaultContext(): AudioContext | null {
  const Ctor = (window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext) as AudioCtor | undefined;
  if (!Ctor) return null;
  try {
    return new Ctor();
  } catch {
    return null;
  }
}

interface Graph {
  master: GainNode;
  cafe: BiquadFilterNode;
  buses: Record<Bus, GainNode>;
}

interface Live {
  node: AudioScheduledSourceNode;
  bus: Bus;
}

/**
 * One Web Audio context with four buses (cold-open spec §7):
 * ambience and music run through the café filter, sfx and ui go straight to the master.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private graph: Graph | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private levels: Levels = { master: 0.7, ambience: 0.6, music: 0.5, alerts: 1, muted: false };
  private muffled = false;
  private ducked = false;
  private readonly live = new Set<Live>();
  private readonly create: () => AudioContext | null;

  constructor(create: () => AudioContext | null = defaultContext) {
    this.create = create;
  }

  get context(): AudioContext | null {
    return this.ctx;
  }

  /** Browsers allow audio only after a user gesture, so the context starts on the first one. */
  unlock(): void {
    if (!this.ctx) {
      this.ctx = this.create();
      if (this.ctx) this.graph = this.build(this.ctx);
    }
    if (this.ctx?.state === "suspended") this.ctx.resume().catch(() => undefined);
  }

  /** The node a source connects to for a bus, or null before audio is unlocked. */
  input(bus: Bus): AudioNode | null {
    return this.graph?.buses[bus] ?? null;
  }

  masterGain(): number {
    return this.graph?.master.gain.value ?? 0;
  }

  setLevels(levels: Levels): void {
    this.levels = levels;
    this.apply();
  }

  /** On the laptop, the café is heard through the room (plan R7: the radio too). */
  setMuffled(on: boolean): void {
    this.muffled = on;
    if (!this.ctx || !this.graph) return;
    this.graph.cafe.frequency.setTargetAtTime(on ? MUFFLED_HZ : OPEN_HZ, this.ctx.currentTime, 0.15);
    this.apply();
  }

  /** The radio drops while the pager rings. */
  setDucked(on: boolean): void {
    this.ducked = on;
    this.apply();
  }

  play(cue: Cue, { gain = 1 }: { gain?: number } = {}): void {
    const ctx = this.ctx;
    const graph = this.graph;
    const def = SOUNDS[cue];
    if (!ctx || !graph || ctx.state === "closed" || this.levels.muted || this.levels.master <= 0) return;
    const t0 = ctx.currentTime + 0.01;
    for (const tone of def.tones) {
      const start = t0 + tone.at;
      const end = start + tone.dur;
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, start);
      env.gain.exponentialRampToValueAtTime(def.gain * gain, start + Math.min(def.attack ?? 0.012, tone.dur / 2));
      env.gain.exponentialRampToValueAtTime(0.0001, end);
      let src: AudioScheduledSourceNode;
      if (def.noise) {
        const noise = ctx.createBufferSource();
        noise.buffer = this.noise(ctx);
        noise.loop = true;
        src = noise;
      } else {
        const osc = ctx.createOscillator();
        osc.type = def.wave;
        osc.frequency.value = tone.f;
        src = osc;
      }
      let head: AudioNode = src;
      if (def.filter) {
        const filter = ctx.createBiquadFilter();
        filter.type = def.filter.type;
        filter.frequency.value = def.filter.f;
        head.connect(filter);
        head = filter;
      }
      head.connect(env).connect(graph.buses[def.bus]);
      const entry = { node: src, bus: def.bus };
      src.onended = () => this.live.delete(entry);
      this.live.add(entry);
      src.start(start);
      src.stop(end + 0.02);
    }
  }

  /** Cuts cues still playing, on one bus or all: the pager stops at once on ack. */
  stop(bus?: Bus): void {
    const now = this.ctx?.currentTime ?? 0;
    for (const entry of [...this.live]) {
      if (bus && entry.bus !== bus) continue;
      try {
        entry.node.stop(now);
      } catch {
        // Already stopped.
      }
      this.live.delete(entry);
    }
  }

  /** Pause, lock and a hidden tab freeze every sound, ambience and radio included. */
  suspend(): void {
    if (this.ctx?.state === "running") this.ctx.suspend().catch(() => undefined);
  }

  resume(): void {
    if (this.ctx?.state === "suspended") this.ctx.resume().catch(() => undefined);
  }

  private build(ctx: AudioContext): Graph {
    const master = ctx.createGain();
    master.connect(ctx.destination);
    const cafe = ctx.createBiquadFilter();
    cafe.type = "lowpass";
    cafe.frequency.value = OPEN_HZ;
    cafe.Q.value = 0.7;
    cafe.connect(master);
    const buses = {} as Record<Bus, GainNode>;
    for (const bus of BUSES) {
      const g = ctx.createGain();
      g.connect(bus === "ambience" || bus === "music" ? cafe : master);
      buses[bus] = g;
    }
    const graph = { master, cafe, buses };
    this.graph = graph;
    this.apply();
    return graph;
  }

  private apply(): void {
    const g = this.graph;
    if (!g) return;
    const l = this.levels;
    g.master.gain.value = l.muted ? 0 : l.master;
    g.buses.ambience.gain.value = l.ambience * (this.muffled ? MUFFLED_GAIN : 1);
    g.buses.music.gain.value = l.music * (this.ducked ? DUCKED : 1);
    g.buses.sfx.gain.value = l.alerts;
    g.buses.ui.gain.value = l.alerts;
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

export const audio = new AudioEngine();
