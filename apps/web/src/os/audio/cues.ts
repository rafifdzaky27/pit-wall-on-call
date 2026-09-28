/** The engine's four mix buses (cold-open spec §7). Ambience and music pass through the café filter. */
export type Bus = "ambience" | "music" | "sfx" | "ui";

export type Cue =
  | "pager"
  | "ack"
  | "message"
  | "notify"
  | "resolved"
  | "dnf"
  | "vibrate"
  | "escalation"
  | "pulse"
  | "tick"
  | "actionStart"
  | "actionDone"
  | "alertFired"
  | "alertCleared"
  | "clink"
  | "hiss";

export interface Tone {
  /** Frequency in Hz; ignored for noise cues. */
  f: number;
  /** Start, in seconds from the call. */
  at: number;
  dur: number;
}

export interface SoundDef {
  bus: Bus;
  wave: OscillatorType;
  /** Peak gain before the bus and master levels. */
  gain: number;
  tones: Tone[];
  /** Seconds to reach the peak; short by default so cues click in. */
  attack?: number;
  filter?: { type: BiquadFilterType; f: number };
  /** Filtered white noise instead of an oscillator. */
  noise?: boolean;
}

const pulse = (at: number): Tone[] => [
  { f: 880, at, dur: 0.12 },
  { f: 660, at: at + 0.14, dur: 0.12 },
];

/** Every cue is synthesized; only the café ambience uses recordings (cold-open spec C4, C9). */
export const SOUNDS: Record<Cue, SoundDef> = {
  pager: { bus: "sfx", wave: "square", gain: 0.12, tones: [...pulse(0), ...pulse(0.32), ...pulse(0.64)] },
  ack: { bus: "ui", wave: "sine", gain: 0.2, tones: [{ f: 523.25, at: 0, dur: 0.08 }, { f: 783.99, at: 0.08, dur: 0.12 }] },
  message: { bus: "ui", wave: "sine", gain: 0.18, tones: [{ f: 987.77, at: 0, dur: 0.09 }, { f: 1318.51, at: 0.1, dur: 0.16 }] },
  notify: { bus: "ui", wave: "sine", gain: 0.14, tones: [{ f: 739.99, at: 0, dur: 0.22 }] },
  resolved: {
    bus: "ui",
    wave: "triangle",
    gain: 0.22,
    tones: [
      { f: 523.25, at: 0, dur: 0.16 },
      { f: 659.25, at: 0.13, dur: 0.16 },
      { f: 783.99, at: 0.26, dur: 0.36 },
    ],
  },
  dnf: { bus: "ui", wave: "triangle", gain: 0.22, tones: [{ f: 392, at: 0, dur: 0.24 }, { f: 261.63, at: 0.24, dur: 0.46 }] },
  // A phone buzzing on a wooden table: a low square wave with its edges filtered off (plan R1).
  vibrate: { bus: "sfx", wave: "square", gain: 0.35, filter: { type: "lowpass", f: 380 }, tones: [{ f: 165, at: 0, dur: 0.32 }, { f: 165, at: 0.44, dur: 0.32 }] },
  escalation: { bus: "sfx", wave: "square", gain: 0.14, tones: [0, 1, 2, 3, 4, 5].map((i) => ({ f: i % 2 ? 740 : 988, at: i * 0.12, dur: 0.1 })) },
  pulse: { bus: "ui", wave: "sine", gain: 0.3, tones: [{ f: 110, at: 0, dur: 0.35 }] },
  tick: { bus: "ui", wave: "sine", gain: 0.06, tones: [{ f: 1760, at: 0, dur: 0.03 }] },
  actionStart: { bus: "ui", wave: "sine", gain: 0.08, tones: [{ f: 660, at: 0, dur: 0.06 }] },
  actionDone: { bus: "ui", wave: "sine", gain: 0.1, tones: [{ f: 880, at: 0, dur: 0.07 }, { f: 1174.66, at: 0.08, dur: 0.07 }] },
  alertFired: { bus: "ui", wave: "triangle", gain: 0.14, tones: [{ f: 440, at: 0, dur: 0.12 }, { f: 349.23, at: 0.13, dur: 0.12 }] },
  alertCleared: { bus: "ui", wave: "triangle", gain: 0.12, tones: [{ f: 349.23, at: 0, dur: 0.12 }, { f: 523.25, at: 0.13, dur: 0.14 }] },
  clink: { bus: "ambience", wave: "sine", gain: 0.05, tones: [{ f: 2350, at: 0, dur: 0.18 }, { f: 3170, at: 0, dur: 0.14 }, { f: 4730, at: 0, dur: 0.1 }] },
  hiss: { bus: "ambience", wave: "sine", gain: 0.05, noise: true, attack: 0.3, filter: { type: "bandpass", f: 3000 }, tones: [{ f: 0, at: 0, dur: 1.4 }] },
};

/** The pager repeats until it is acknowledged, as real pagers do. */
export const PAGER_EVERY_MS = 2500;
