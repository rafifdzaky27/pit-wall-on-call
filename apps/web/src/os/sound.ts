export type SoundName = "pager" | "ack" | "message" | "notify" | "resolved" | "dnf";

interface Tone {
  /** Frequency in Hz. */
  f: number;
  /** Start, in seconds from the call. */
  at: number;
  dur: number;
}

interface SoundDef {
  wave: OscillatorType;
  /** Peak gain at volume 100. */
  gain: number;
  tones: Tone[];
}

const pulse = (at: number): Tone[] => [
  { f: 880, at, dur: 0.12 },
  { f: 660, at: at + 0.14, dur: 0.12 },
];

/** Every sound is synthesized: there are no audio files to load or license (polish spec S18). */
export const SOUNDS: Record<SoundName, SoundDef> = {
  pager: { wave: "square", gain: 0.12, tones: [...pulse(0), ...pulse(0.32), ...pulse(0.64)] },
  ack: { wave: "sine", gain: 0.2, tones: [{ f: 523.25, at: 0, dur: 0.08 }, { f: 783.99, at: 0.08, dur: 0.12 }] },
  message: { wave: "sine", gain: 0.18, tones: [{ f: 987.77, at: 0, dur: 0.09 }, { f: 1318.51, at: 0.1, dur: 0.16 }] },
  notify: { wave: "sine", gain: 0.14, tones: [{ f: 739.99, at: 0, dur: 0.22 }] },
  resolved: {
    wave: "triangle",
    gain: 0.22,
    tones: [
      { f: 523.25, at: 0, dur: 0.16 },
      { f: 659.25, at: 0.13, dur: 0.16 },
      { f: 783.99, at: 0.26, dur: 0.36 },
    ],
  },
  dnf: { wave: "triangle", gain: 0.22, tones: [{ f: 392, at: 0, dur: 0.24 }, { f: 261.63, at: 0.24, dur: 0.46 }] },
};

/** The pager repeats until it is acknowledged, as real pagers do. */
export const PAGER_EVERY_MS = 2500;

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

export class Synth {
  volume = 0.7;
  muted = false;
  private ctx: AudioContext | null = null;
  private readonly live = new Set<OscillatorNode>();
  private readonly create: () => AudioContext | null;

  constructor(create: () => AudioContext | null = defaultContext) {
    this.create = create;
  }

  /** Browsers allow audio only after a user gesture, so the context starts on the first one. */
  unlock(): void {
    if (!this.ctx) this.ctx = this.create();
    if (this.ctx?.state === "suspended") this.ctx.resume().catch(() => undefined);
  }

  play(name: SoundName): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state === "closed" || this.muted || this.volume <= 0) return;
    const def = SOUNDS[name];
    const t0 = ctx.currentTime + 0.01;
    for (const tone of def.tones) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = t0 + tone.at;
      const end = start + tone.dur;
      osc.type = def.wave;
      osc.frequency.value = tone.f;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(def.gain * this.volume, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);
      osc.connect(gain).connect(ctx.destination);
      osc.onended = () => this.live.delete(osc);
      this.live.add(osc);
      osc.start(start);
      osc.stop(end + 0.02);
    }
  }

  /** Cuts every sound still playing: the pager stops at once on ack (polish spec §7). */
  stop(): void {
    const now = this.ctx?.currentTime ?? 0;
    for (const osc of this.live) {
      try {
        osc.stop(now);
      } catch {
        // Already stopped.
      }
    }
    this.live.clear();
  }
}

export const synth = new Synth();
