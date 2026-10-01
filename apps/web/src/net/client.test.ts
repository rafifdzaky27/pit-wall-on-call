import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, fetchDailyBoard, fetchLeaderboard, NetworkError, postRun, registerPlayer } from "./client";

afterEach(() => {
  vi.unstubAllGlobals();
});

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

describe("API client", () => {
  it("registers a player with a JSON POST", async () => {
    const fetch = vi.fn(async () => json(201, { playerId: "p", handle: "rafif", tag: "abcd", token: "pw_x" }));
    vi.stubGlobal("fetch", fetch);
    await expect(registerPlayer("rafif")).resolves.toEqual({ playerId: "p", handle: "rafif", tag: "abcd", token: "pw_x" });
    expect(fetch).toHaveBeenCalledWith("/api/players", expect.objectContaining({ method: "POST", body: JSON.stringify({ handle: "rafif" }) }));
  });

  it("sends the bearer token", async () => {
    const fetch = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(async () => json(200, { board: "practice", scenarioId: "s", total: 0, entries: [], you: null }));
    vi.stubGlobal("fetch", fetch);
    await fetchLeaderboard("db-pool-exhaustion", "pw_token");
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe("/api/leaderboard?scenario=db-pool-exhaustion");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer pw_token");
  });

  it("asks for the hard boards with difficulty=hard and leaves the default URL alone for normal (M6 H10)", async () => {
    const fetch = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(async () => json(200, { entries: [] }));
    vi.stubGlobal("fetch", fetch);
    await fetchLeaderboard("db-pool-exhaustion", undefined, "hard");
    await fetchDailyBoard("2026-10-05", undefined, "hard");
    await fetchLeaderboard("db-pool-exhaustion", undefined, "normal");
    await fetchDailyBoard("2026-10-05", undefined, "normal");
    expect(fetch.mock.calls.map((c) => c[0])).toEqual([
      "/api/leaderboard?scenario=db-pool-exhaustion&difficulty=hard",
      "/api/leaderboard?date=2026-10-05&difficulty=hard",
      "/api/leaderboard?scenario=db-pool-exhaustion",
      "/api/leaderboard?date=2026-10-05",
    ]);
  });

  it("turns an error body into an ApiError with its code, request ID and Retry-After", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json(429, { error: { code: "rate_limited", message: "slow down", requestId: "req-1" } }, { "retry-after": "42", "x-request-id": "req-1" })),
    );
    const error = await postRun("pw_x", {} as never).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 429, code: "rate_limited", requestId: "req-1", retryAfterS: 42 });
  });

  it("reports an HTML fallback page (a misrouted /api) as an ApiError, not a crash", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<!doctype html>", { status: 502 })));
    const error = await fetchLeaderboard("s").catch((e: unknown) => e);
    expect(error).toMatchObject({ status: 502, code: "bad_response", requestId: null });
  });

  it("reports a failed connection as a NetworkError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    await expect(fetchLeaderboard("s")).rejects.toBeInstanceOf(NetworkError);
  });
});
