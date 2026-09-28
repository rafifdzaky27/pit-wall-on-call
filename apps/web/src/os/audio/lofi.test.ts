import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LofiRadio, lofiPattern } from "./lofi";

class Param {
  value = 0;
  setValueAtTime() {
    return this;
  }
  linearRampToValueAtTime() {
    return this;
  }
  exponentialRampToValueAtTime() {
    return this;
  }
  setTargetAtTime() {
    return this;
  }
}
class Node {
  connect<T>(n: T): T {
    return n;
  }
  disconnect() {}
}
class Src extends Node {
  type = "sine";
  frequency = new Param();
  detune = new Param();
  buffer: unknown = null;
  loop = false;
  started: number | null = null;
  stopped: number | null = null;
  start(t = 0) {
    this.started = t;
  }
  stop(t = 0) {
    this.stopped = t;
  }
}
class Ctx {
  currentTime = 5;
  sampleRate = 8000;
  destination = new Node();
  oscs: Src[] = [];
  sources: Src[] = [];
  createOscillator() {
    const o = new Src();
    this.oscs.push(o);
    return o;
  }
  createBufferSource() {
    const s = new Src();
    this.sources.push(s);
    return s;
  }
  createBuffer(_c: number, length: number) {
    const data = new Float32Array(length);
    return { getChannelData: () => data };
  }
  createGain() {
    return Object.assign(new Node(), { gain: new Param() });
  }
  createBiquadFilter() {
    return Object.assign(new Node(), { type: "lowpass", frequency: new Param(), Q: new Param() });
  }
}

function setup() {
  const ctx = new Ctx();
  const engine = { context: ctx as unknown as AudioContext, input: () => new Node() as unknown as AudioNode };
  return { ctx, radio: new LofiRadio(engine, 7) };
}

describe("lofiPattern", () => {
  it("is deterministic per seed and index", () => {
    expect(lofiPattern(7, 0)).toEqual(lofiPattern(7, 0));
    expect(lofiPattern(7, 0)).not.toEqual(lofiPattern(7, 1));
  });

  it("stays in the lo-fi range: 70–85 BPM, four seventh chords, a 16-step kit", () => {
    for (let i = 0; i < 40; i++) {
      const p = lofiPattern(3, i);
      expect(p.bpm).toBeGreaterThanOrEqual(70);
      expect(p.bpm).toBeLessThanOrEqual(85);
      expect(p.chords).toHaveLength(4);
      for (const chord of p.chords) {
        expect(chord).toHaveLength(4);
        for (const n of chord) expect(n >= 45 && n <= 84).toBe(true);
      }
      for (const lane of [p.kick, p.snare, p.hat]) expect(lane).toHaveLength(16);
      expect(p.kick[0]).toBe(true);
      expect(p.snare[4] && p.snare[12]).toBe(true);
      expect(p.swing >= 0.1 && p.swing <= 0.18).toBe(true);
    }
  });
});

describe("LofiRadio", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("schedules notes ahead once started, and stops cleanly", () => {
    const { ctx, radio } = setup();
    expect(radio.playing).toBe(false);
    radio.start();
    expect(radio.playing).toBe(true);
    vi.advanceTimersByTime(200);
    expect(ctx.oscs.length).toBeGreaterThan(0);
    radio.stop();
    expect(radio.playing).toBe(false);
    const count = ctx.oscs.length;
    ctx.currentTime += 5;
    vi.advanceTimersByTime(1000);
    expect(ctx.oscs.length).toBe(count);
  });

  it("next() moves to a new progression at once", () => {
    const { radio } = setup();
    const first = radio.pattern;
    radio.next();
    expect(radio.pattern).not.toEqual(first);
  });

  it("does nothing before audio is unlocked", () => {
    const radio = new LofiRadio({ context: null, input: () => null }, 1);
    radio.start();
    expect(radio.playing).toBe(false);
  });
});
