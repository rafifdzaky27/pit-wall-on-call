import { describe, expect, it } from "vitest";
import { createRateLimiter } from "./rateLimit";

describe("createRateLimiter", () => {
  it("allows max hits per window, then refuses with the seconds left, then allows again", () => {
    let now = 1_000_000;
    const limiter = createRateLimiter(() => now);
    for (let i = 0; i < 3; i++) expect(limiter.hit("runs", "k", 3, 60_000)).toEqual({ ok: true });
    now += 10_500;
    expect(limiter.hit("runs", "k", 3, 60_000)).toEqual({ ok: false, retryAfterS: 50 });
    now += 49_500;
    expect(limiter.hit("runs", "k", 3, 60_000)).toEqual({ ok: true });
  });

  it("counts buckets and keys separately", () => {
    const limiter = createRateLimiter(() => 0);
    expect(limiter.hit("a", "k", 1, 1000)).toEqual({ ok: true });
    expect(limiter.hit("b", "k", 1, 1000)).toEqual({ ok: true });
    expect(limiter.hit("a", "other", 1, 1000)).toEqual({ ok: true });
    expect(limiter.hit("a", "k", 1, 1000).ok).toBe(false);
  });
});
