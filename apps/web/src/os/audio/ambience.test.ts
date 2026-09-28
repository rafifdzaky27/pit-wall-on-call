import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Ambience, CROSSFADE_S, loadBuffer } from "./ambience";

class Param {
  calls: [string, number, number][] = [];
  value = 0;
  setValueAtTime(v: number, t: number) {
    this.calls.push(["set", v, t]);
    return this;
  }
  linearRampToValueAtTime(v: number, t: number) {
    this.calls.push(["linear", v, t]);
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
  buffer: { duration: number } | null = null;
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
  state = "running";
  currentTime = 10;
  sources: Src[] = [];
  createBufferSource() {
    const s = new Src();
    this.sources.push(s);
    return s;
  }
  createGain() {
    return Object.assign(new Node(), { gain: new Param() });
  }
  decodeAudioData = vi.fn(async () => ({ duration: 30 }) as unknown as AudioBuffer);
}

function setup(load: (ctx: BaseAudioContext, url: string) => Promise<AudioBuffer | null>) {
  const ctx = new Ctx();
  const play = vi.fn();
  const engine = { context: ctx as unknown as AudioContext, input: () => new Node() as unknown as AudioNode, play };
  return { ctx, play, ambience: new Ambience(engine, load) };
}

const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

describe("loadBuffer", () => {
  it("returns null instead of throwing when the file cannot be fetched or decoded", async () => {
    const ctx = new Ctx() as unknown as BaseAudioContext;
    expect(await loadBuffer(ctx, "/x.mp3", vi.fn(async () => Promise.reject(new Error("offline"))))).toBeNull();
    expect(await loadBuffer(ctx, "/x.mp3", vi.fn(async () => new Response("", { status: 404 })))).toBeNull();
    (ctx as unknown as Ctx).decodeAudioData.mockRejectedValueOnce(new Error("bad data"));
    expect(await loadBuffer(ctx, "/x.mp3", vi.fn(async () => new Response("abc")))).toBeNull();
    expect(await loadBuffer(ctx, "/x.mp3", vi.fn(async () => new Response("abc")))).not.toBeNull();
  });
});

describe("Ambience", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("keeps the café alive with synthesized clinks when the recordings fail", async () => {
    const { ambience, play, ctx } = setup(async () => null);
    await ambience.start({ rain: true });
    expect(ambience.running).toBe(true);
    expect(ctx.sources).toHaveLength(0);
    vi.advanceTimersByTime(12_000);
    expect(play).toHaveBeenCalledWith("clink");
  });

  it("loops a recording with a crossfade, and stops everything on stop()", async () => {
    const buffer = { duration: 30 } as AudioBuffer;
    const { ambience, play, ctx } = setup(async () => buffer);
    await ambience.start({ rain: false });
    await flush();
    expect(ctx.sources).toHaveLength(1);
    const first = ctx.sources[0]!;
    ctx.currentTime = first.started! + 29;
    vi.advanceTimersByTime(30_000);
    expect(ctx.sources.length).toBeGreaterThanOrEqual(2);
    expect(ctx.sources[1]!.started).toBeCloseTo(first.started! + 30 - CROSSFADE_S);
    ambience.stop();
    expect(ambience.running).toBe(false);
    expect(ctx.sources.every((s) => s.stopped !== null)).toBe(true);
    play.mockClear();
    vi.advanceTimersByTime(60_000);
    expect(play).not.toHaveBeenCalled();
  });

  it("adds rain only when it is raining", async () => {
    const urls: string[] = [];
    const { ambience } = setup(async (_ctx, url) => {
      urls.push(url);
      return { duration: 30 } as AudioBuffer;
    });
    await ambience.start({ rain: false });
    expect(urls.some((u) => u.includes("rain"))).toBe(false);
    ambience.stop();
    await ambience.start({ rain: true });
    await flush();
    expect(urls.some((u) => u.includes("rain"))).toBe(true);
  });
});
