export type Hit = { ok: true } | { ok: false; retryAfterS: number };

export interface RateLimiter {
  hit(bucket: string, key: string, max: number, windowMs: number): Hit;
}

export interface Limit {
  max: number;
  windowMs: number;
}

/** M2 spec §3 rate limits. Tests override them per app. */
export interface Limits {
  runsPerToken: Limit;
  runsPerIp: Limit;
  playersPerIp: Limit;
  renamePerToken: Limit;
  boardPerIp: Limit;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

export const DEFAULT_LIMITS: Limits = {
  runsPerToken: { max: 20, windowMs: MINUTE },
  runsPerIp: { max: 60, windowMs: MINUTE },
  playersPerIp: { max: 10, windowMs: HOUR },
  renamePerToken: { max: 10, windowMs: HOUR },
  boardPerIp: { max: 120, windowMs: MINUTE },
};

const SWEEP_AT = 10_000;

/** Fixed windows in memory, per API process: enough for one homelab box (spec §8, item 6). */
export function createRateLimiter(now: () => number = Date.now): RateLimiter {
  const windows = new Map<string, { resetAt: number; count: number }>();
  return {
    hit(bucket, key, max, windowMs) {
      const t = now();
      if (windows.size > SWEEP_AT) {
        for (const [k, w] of windows) if (w.resetAt <= t) windows.delete(k);
      }
      const id = `${bucket} ${key}`;
      const w = windows.get(id);
      if (!w || w.resetAt <= t) {
        windows.set(id, { resetAt: t + windowMs, count: 1 });
        return { ok: true };
      }
      if (w.count >= max) return { ok: false, retryAfterS: Math.ceil((w.resetAt - t) / 1000) };
      w.count++;
      return { ok: true };
    },
  };
}
