import { describe, expect, it } from "vitest";
import { SOUNDS, Synth } from "./sound";

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
}
class FakeNode {
  connect<T>(n: T): T {
    return n;
  }
}
class FakeOsc extends FakeNode {
  type = "sine";
  frequency = new FakeParam();
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
class FakeGain extends FakeNode {
  gain = new FakeParam();
}
class FakeCtx {
  state = "suspended";
  currentTime = 5;
  destination = new FakeNode();
  oscs: FakeOsc[] = [];
  gains: FakeGain[] = [];
  createOscillator() {
    const o = new FakeOsc();
    this.oscs.push(o);
    return o;
  }
  createGain() {
    const g = new FakeGain();
    this.gains.push(g);
    return g;
  }
  resume() {
    this.state = "running";
    return Promise.resolve();
  }
}

function setup() {
  const ctx = new FakeCtx();
  let created = 0;
  const synth = new Synth(() => {
    created++;
    return ctx as unknown as AudioContext;
  });
  return { ctx, synth, created: () => created };
}

describe("Synth", () => {
  it("stays silent until a user gesture unlocks audio, and creates one context", () => {
    const { ctx, synth, created } = setup();
    synth.play("notify");
    expect(ctx.oscs).toHaveLength(0);
    synth.unlock();
    synth.unlock();
    expect(created()).toBe(1);
    expect(ctx.state).toBe("running");
  });

  it("plays the pager as three two-tone pulses scaled by the volume", () => {
    const { ctx, synth } = setup();
    synth.unlock();
    synth.volume = 0.5;
    synth.play("pager");
    expect(ctx.oscs.map((o) => o.frequency.value)).toEqual([880, 660, 880, 660, 880, 660]);
    expect(ctx.oscs.every((o) => o.type === "square" && o.started !== null && o.stopped !== null)).toBe(true);
    const peak = ctx.gains[0]!.gain.calls.find((c) => c[0] === "ramp")![1];
    expect(peak).toBeCloseTo(SOUNDS.pager.gain * 0.5);
  });

  it("is silent when muted or at volume 0", () => {
    const { ctx, synth } = setup();
    synth.unlock();
    synth.muted = true;
    synth.play("message");
    synth.muted = false;
    synth.volume = 0;
    synth.play("message");
    expect(ctx.oscs).toHaveLength(0);
  });

  it("stop() cuts every sound that is still playing", () => {
    const { ctx, synth } = setup();
    synth.unlock();
    synth.play("pager");
    synth.stop();
    expect(ctx.oscs.every((o) => o.stopped === ctx.currentTime)).toBe(true);
  });

  it("defines every sound with at least one tone", () => {
    for (const def of Object.values(SOUNDS)) expect(def.tones.length).toBeGreaterThan(0);
  });

  it("never throws when the browser has no Web Audio", () => {
    const synth = new Synth(() => null);
    synth.unlock();
    expect(() => synth.play("pager")).not.toThrow();
    expect(() => synth.stop()).not.toThrow();
  });
});
