import { describe, expect, it } from "vitest";
import { SOUNDS } from "./cues";
import { AudioEngine } from "./engine";

class FakeParam {
  value = 0;
  calls: [string, number, number][] = [];
  setValueAtTime(v: number, t: number) {
    this.calls.push(["set", v, t]);
    return this;
  }
  exponentialRampToValueAtTime(v: number, t: number) {
    this.calls.push(["ramp", v, t]);
    return this;
  }
  linearRampToValueAtTime(v: number, t: number) {
    this.calls.push(["linear", v, t]);
    return this;
  }
  setTargetAtTime(v: number, t: number) {
    this.calls.push(["target", v, t]);
    this.value = v;
    return this;
  }
  cancelScheduledValues() {
    return this;
  }
}
class FakeNode {
  out: unknown[] = [];
  connect<T>(n: T): T {
    this.out.push(n);
    return n;
  }
  disconnect() {}
}
class FakeOsc extends FakeNode {
  type = "sine";
  frequency = new FakeParam();
  detune = new FakeParam();
  started: number | null = null;
  stopped: number | null = null;
  onended: (() => void) | null = null;
  start(t: number) {
    this.started = t;
  }
  stop(t: number) {
    this.stopped = t;
  }
}
class FakeSource extends FakeOsc {
  buffer: unknown = null;
  loop = false;
}
class FakeGain extends FakeNode {
  gain = new FakeParam();
}
class FakeFilter extends FakeNode {
  type = "lowpass";
  frequency = new FakeParam();
  Q = new FakeParam();
}
class FakeCtx {
  state = "suspended";
  currentTime = 5;
  sampleRate = 8000;
  destination = new FakeNode();
  oscs: FakeOsc[] = [];
  sources: FakeSource[] = [];
  gains: FakeGain[] = [];
  filters: FakeFilter[] = [];
  suspended = 0;
  createOscillator() {
    const o = new FakeOsc();
    this.oscs.push(o);
    return o;
  }
  createBufferSource() {
    const s = new FakeSource();
    this.sources.push(s);
    return s;
  }
  createBuffer(_ch: number, length: number) {
    const data = new Float32Array(length);
    return { duration: length / this.sampleRate, getChannelData: () => data };
  }
  createGain() {
    const g = new FakeGain();
    g.gain.value = 1;
    this.gains.push(g);
    return g;
  }
  createBiquadFilter() {
    const f = new FakeFilter();
    this.filters.push(f);
    return f;
  }
  resume() {
    this.state = "running";
    return Promise.resolve();
  }
  suspend() {
    this.suspended++;
    this.state = "suspended";
    return Promise.resolve();
  }
}

function setup() {
  const ctx = new FakeCtx();
  let created = 0;
  const engine = new AudioEngine(() => {
    created++;
    return ctx as unknown as AudioContext;
  });
  return { ctx, engine, created: () => created };
}

/** Follows the first connection from a node until it reaches one of the engine's buses. */
function busOf(engine: AudioEngine, from: FakeNode): string | null {
  const buses = (["ambience", "music", "sfx", "ui"] as const).map((b) => [b, engine.input(b)] as const);
  let node: unknown = from;
  for (let i = 0; i < 6 && node; i++) {
    const hit = buses.find(([, n]) => n === node);
    if (hit) return hit[0];
    node = (node as FakeNode).out?.[0];
  }
  return null;
}

const levels = { master: 0.5, ambience: 0.6, music: 0.4, alerts: 1, muted: false };

describe("AudioEngine", () => {
  it("stays silent until a user gesture unlocks audio, and creates one context", () => {
    const { ctx, engine, created } = setup();
    engine.play("notify");
    expect(ctx.oscs).toHaveLength(0);
    engine.unlock();
    engine.unlock();
    expect(created()).toBe(1);
    expect(ctx.state).toBe("running");
  });

  it("routes each cue to its bus: the pager to alerts, a cup clink to the café", () => {
    const { ctx, engine } = setup();
    engine.unlock();
    engine.play("pager");
    expect(ctx.oscs.map((o) => o.frequency.value)).toEqual([880, 660, 880, 660, 880, 660]);
    expect(busOf(engine, ctx.oscs[0]!)).toBe("sfx");
    engine.play("clink");
    expect(busOf(engine, ctx.oscs.at(-1)!)).toBe("ambience");
    engine.play("hiss");
    expect(busOf(engine, ctx.sources.at(-1)!)).toBe("ambience");
  });

  it("scales a cue's peak by its gain option", () => {
    const { ctx, engine } = setup();
    engine.unlock();
    engine.play("pager", { gain: 2 });
    const peak = ctx.gains.at(-6)!.gain.calls.find((c) => c[0] === "ramp")![1];
    expect(peak).toBeCloseTo(SOUNDS.pager.gain * 2);
  });

  it("maps levels onto the master and the four buses", () => {
    const { engine } = setup();
    engine.setLevels(levels);
    engine.unlock();
    const g = (bus: "ambience" | "music" | "sfx" | "ui") => (engine.input(bus) as unknown as FakeGain).gain.value;
    expect([g("ambience"), g("music"), g("sfx"), g("ui")]).toEqual([0.6, 0.4, 1, 1]);
    expect(engine.masterGain()).toBe(0.5);
    engine.setLevels({ ...levels, muted: true });
    expect(engine.masterGain()).toBe(0);
  });

  it("ducks the music while the pager rings", () => {
    const { engine } = setup();
    engine.unlock();
    engine.setLevels(levels);
    engine.setDucked(true);
    expect((engine.input("music") as unknown as FakeGain).gain.value).toBeCloseTo(0.1);
    engine.setDucked(false);
    expect((engine.input("music") as unknown as FakeGain).gain.value).toBeCloseTo(0.4);
  });

  it("muffles the café through a low-pass filter while the camera is on the laptop", () => {
    const { ctx, engine } = setup();
    engine.unlock();
    engine.setMuffled(true);
    const cafe = ctx.filters[0]!;
    expect(cafe.frequency.calls.at(-1)?.slice(0, 2)).toEqual(["target", 700]);
    engine.setMuffled(false);
    expect(cafe.frequency.calls.at(-1)?.slice(0, 2)).toEqual(["target", 18_000]);
  });

  it("plays nothing while muted", () => {
    const { ctx, engine } = setup();
    engine.unlock();
    engine.setLevels({ ...levels, muted: true });
    engine.play("message");
    expect(ctx.oscs).toHaveLength(0);
  });

  it("stop(bus) cuts only that bus's cues", () => {
    const { ctx, engine } = setup();
    engine.unlock();
    engine.play("pager");
    engine.play("tick");
    engine.stop("sfx");
    const [pager, tick] = [ctx.oscs.slice(0, 6), ctx.oscs.at(-1)!];
    expect(pager.every((o) => o.stopped === ctx.currentTime)).toBe(true);
    expect(tick.stopped).not.toBe(ctx.currentTime);
  });

  it("suspends and resumes the whole context", () => {
    const { ctx, engine } = setup();
    engine.unlock();
    engine.suspend();
    expect(ctx.suspended).toBe(1);
    engine.resume();
    expect(ctx.state).toBe("running");
  });

  it("defines every cue with a bus and at least one tone", () => {
    for (const def of Object.values(SOUNDS)) {
      expect(def.tones.length).toBeGreaterThan(0);
      expect(["ambience", "music", "sfx", "ui"]).toContain(def.bus);
    }
  });

  it("never throws when the browser has no Web Audio", () => {
    const engine = new AudioEngine(() => null);
    engine.unlock();
    expect(() => engine.play("pager")).not.toThrow();
    expect(() => engine.stop()).not.toThrow();
    expect(() => engine.suspend()).not.toThrow();
    expect(engine.input("music")).toBeNull();
  });
});
