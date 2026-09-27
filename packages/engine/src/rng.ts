export interface Rng {
  /** Float in [0, 1). */
  next(): number;
  /** Integer in [0, maxExclusive). */
  int(maxExclusive: number): number;
}

/** mulberry32: small, fast, and identical in every JS engine (32-bit integer math only). */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  const nextU32 = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  };
  return {
    next: () => nextU32() / 4294967296,
    int: (maxExclusive) => {
      if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
        throw new RangeError(`int() needs a positive integer bound, got ${maxExclusive}`);
      }
      return nextU32() % maxExclusive;
    },
  };
}

/**
 * Seed for a named stream (FNV-1a over the seed bytes and the name). Separate streams mean
 * adding a log line or a metric never shifts the dynamics, so it never changes a score.
 */
export function streamSeed(seed: number, stream: string): number {
  let h = 0x811c9dc5;
  const s = seed >>> 0;
  for (let shift = 0; shift < 32; shift += 8) {
    h ^= (s >>> shift) & 0xff;
    h = Math.imul(h, 0x01000193);
  }
  for (let i = 0; i < stream.length; i++) {
    h ^= stream.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
