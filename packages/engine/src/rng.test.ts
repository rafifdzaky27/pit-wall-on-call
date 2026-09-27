import { describe, expect, it } from "vitest";
import { mulberry32, streamSeed } from "./rng";

const take = (seed: number, n: number) => {
  const rng = mulberry32(seed);
  return Array.from({ length: n }, () => rng.next());
};

describe("mulberry32", () => {
  it("repeats the same sequence for the same seed", () => {
    expect(take(42, 20)).toEqual(take(42, 20));
  });

  it("gives different sequences for different seeds", () => {
    expect(take(1, 5)).not.toEqual(take(2, 5));
  });

  it("keeps next() in [0, 1)", () => {
    for (const v of take(7, 5000)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("keeps int(n) in [0, n) and hits every value", () => {
    const rng = mulberry32(9);
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const v = rng.int(6);
      expect(Number.isInteger(v) && v >= 0 && v < 6).toBe(true);
      seen.add(v);
    }
    expect(seen.size).toBe(6);
  });

  it("rejects a non-positive or fractional bound", () => {
    const rng = mulberry32(1);
    expect(() => rng.int(0)).toThrow(RangeError);
    expect(() => rng.int(2.5)).toThrow(RangeError);
  });

  it("is pinned: changing the algorithm changes every stored score", () => {
    expect(take(1, 3)).toMatchInlineSnapshot(`
      [
        0.6270739405881613,
        0.002735721180215478,
        0.5274470399599522,
      ]
    `);
  });
});

describe("streamSeed", () => {
  it("is stable per (seed, stream) and differs across streams and seeds", () => {
    expect(streamSeed(5, "dynamics")).toBe(streamSeed(5, "dynamics"));
    expect(streamSeed(5, "dynamics")).not.toBe(streamSeed(5, "logs"));
    expect(streamSeed(5, "dynamics")).not.toBe(streamSeed(6, "dynamics"));
  });

  it("returns an unsigned 32-bit integer", () => {
    const v = streamSeed(123456789, "metrics");
    expect(Number.isInteger(v) && v >= 0 && v <= 0xffffffff).toBe(true);
  });
});
