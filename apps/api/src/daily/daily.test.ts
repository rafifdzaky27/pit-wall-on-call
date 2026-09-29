import { ENGINE_VERSION } from "@pitwall/engine";
import { dailyFor } from "@pitwall/scenarios";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { perfectRun } from "../fixtures";
import { freshIp, testApp, type TestApp } from "../testing";

// Frozen at 2026-10-05 10:00 UTC: today is Daily #7, yesterday 2026-10-04.
const NOW = Date.UTC(2026, 9, 5, 10);
const TODAY = "2026-10-05";
let h: TestApp;

beforeAll(async () => {
  h = await testApp({ now: () => NOW });
});
afterAll(async () => {
  await h.t.drop();
});
beforeEach(async () => {
  await h.t.sql`truncate runs, players`;
});

const dailyRun = (date = TODAY, overrides: Record<string, unknown> = {}) => {
  const d = dailyFor(date);
  return perfectRun({ scenarioId: d.scenarioId, seed: d.seed, mode: "daily", dailyDate: date, ...overrides });
};
const post = (token: string, body: unknown) => h.call("POST", "/api/runs", { token, body, ip: freshIp() });

describe("GET /api/daily (M3 spec Y4)", () => {
  it("is today's incident by the server's UTC clock, cacheable for a minute", async () => {
    const res = await h.call("GET", "/api/daily");
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("public, max-age=60");
    expect(await res.json()).toEqual({ ...dailyFor(TODAY), engineVersion: ENGINE_VERSION });
  });
});

describe("posting a daily (M3 spec Y5, Y6)", () => {
  it("ranks the first attempt, and stores the second as practice", async () => {
    const p = await h.register("first");
    const first = await post(p.token, dailyRun());
    expect(first.status).toBe(201);
    expect(await first.json()).toMatchObject({ mode: "daily_ranked", ranked: true, board: { rank: 1, total: 1 } });
    const second = await post(p.token, dailyRun());
    expect(second.status).toBe(201);
    expect(await second.json()).toMatchObject({ mode: "practice", ranked: false });
    const rows = await h.t.sql<{ mode: string; daily_date: string }[]>`select mode, daily_date::text from runs order by created_at`;
    expect(rows.map((r) => [r.mode, r.daily_date])).toEqual([
      ["daily_ranked", TODAY],
      ["practice", TODAY],
    ]);
  });

  it("two first attempts at once: exactly one ranks (Review Focus 2)", async () => {
    const p = await h.register("twotabs");
    const results = await Promise.all([post(p.token, dailyRun()), post(p.token, dailyRun())]);
    const bodies = (await Promise.all(results.map((r) => r.json()))) as { ranked: boolean }[];
    expect(bodies.map((b) => b.ranked).sort()).toEqual([false, true]);
  });

  it("accepts yesterday's daily (a shift across midnight), and nothing older (Review Focus 1)", async () => {
    const p = await h.register("midnight");
    const y = await post(p.token, dailyRun("2026-10-04"));
    expect(y.status).toBe(201);
    expect(await y.json()).toMatchObject({ ranked: true });
    const old = await post(p.token, dailyRun("2026-10-03"));
    expect(old.status).toBe(400);
    expect(await old.json()).toMatchObject({ error: { code: "not_the_daily" } });
    const future = await post(p.token, dailyRun("2026-10-06"));
    expect(future.status).toBe(400);
  });

  it("refuses a daily whose seed or scenario is not that day's", async () => {
    const p = await h.register("cheater");
    const res = await post(p.token, dailyRun(TODAY, { seed: dailyFor(TODAY).seed + 1 }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: { code: "not_the_daily" } });
    const noDate = await post(p.token, perfectRun({ mode: "daily" }));
    expect(noDate.status).toBe(400);
  });

  it("a practice post is unchanged", async () => {
    const p = await h.register("practiser");
    const res = await post(p.token, perfectRun());
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ mode: "practice", ranked: false });
  });
});

describe("GET /api/leaderboard?date= (M3 spec Y7)", () => {
  it("ranks the day's ranked runs: resolved first, then lower burn; a flagged run is off the board", async () => {
    const a = await h.register("alpha");
    const b = await h.register("bravo");
    const c = await h.register("charlie");
    await post(a.token, dailyRun());
    // Bravo does nothing useful: a DNF.
    await post(b.token, dailyRun(TODAY, { actions: [{ tick: 20, actionId: "ack" }] }));
    // Charlie's is flagged (a fix faster than a person could make it).
    await post(c.token, dailyRun(TODAY, { actions: [{ tick: 0, actionId: "ack" }, { tick: 0, actionId: "checkout.rollback" }] }));
    // Alpha's second attempt is practice and not on the daily board.
    await post(a.token, dailyRun());

    const res = await h.call("GET", `/api/leaderboard?date=${TODAY}`, { token: b.token });
    expect(res.status).toBe(200);
    const board = (await res.json()) as { board: string; date: string; number: number; total: number; entries: { handle: string; rank: number; outcome: string }[]; you: { handle: string; rank: number } | null };
    expect(board).toMatchObject({ board: "daily", date: TODAY, number: dailyFor(TODAY).number, total: 2 });
    expect(board.entries.map((e) => [e.rank, e.handle, e.outcome])).toEqual([
      [1, "alpha", "resolved"],
      [2, "bravo", "dnf"],
    ]);
    expect(board.you).toMatchObject({ handle: "bravo", rank: 2 });
  });

  it("refuses a date that is not one", async () => {
    const res = await h.call("GET", "/api/leaderboard?date=2026-02-30");
    expect(res.status).toBe(400);
  });

  it("the practice board counts ranked dailies too, as each player's best", async () => {
    const a = await h.register("dailyonly");
    await post(a.token, dailyRun());
    const res = await h.call("GET", `/api/leaderboard?scenario=${dailyFor(TODAY).scenarioId}`);
    expect(((await res.json()) as { total: number }).total).toBe(1);
  });
});

