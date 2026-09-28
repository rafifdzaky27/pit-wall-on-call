import { ACK } from "@pitwall/engine";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { perfectRun, PERFECT_ACTIONS, PERFECT_EXPECTED } from "../fixtures";
import { freshIp, testApp, type TestApp } from "../testing";

let h: TestApp;

beforeAll(async () => {
  h = await testApp();
});
afterAll(async () => {
  await h.t.drop();
});

interface Posted {
  runId: string;
  mode: string;
  flagged: boolean;
  score: { outcome: string; budgetBurnedBp: number; mitigatedAtTick: number | null; endTick: number };
  board: { rank: number | null; total: number; best: boolean } | null;
}

const errorOf = async (res: Response) => ((await res.json()) as { error: { code: string; message: string } }).error;
const rowsFor = (playerId: string) => h.t.sql<{ budget_burned_bp: number; flagged: boolean }[]>`select budget_burned_bp, flagged from runs where player_id = ${playerId}`;

describe("POST /api/runs", () => {
  it("replays a valid run, stores the server's score, and returns it", async () => {
    const p = await h.register();
    const res = await h.call("POST", "/api/runs", { body: perfectRun(), token: p.token });
    expect(res.status).toBe(201);
    const body = (await res.json()) as Posted;
    expect(body.mode).toBe("practice");
    expect(body.flagged).toBe(false);
    expect(body.score).toEqual(PERFECT_EXPECTED);
    const rows = await rowsFor(p.playerId);
    expect(rows).toEqual([{ budget_burned_bp: PERFECT_EXPECTED.budgetBurnedBp, flagged: false }]);
  });

  it("scores a tampered log by what it did, since the client never sends a score", async () => {
    const p = await h.register();
    const tampered = [...PERFECT_ACTIONS.slice(0, 3), { tick: 60, actionId: "checkout.restart" }, { tick: 300, actionId: "checkout.rollback" }];
    const res = await h.call("POST", "/api/runs", { body: perfectRun({ actions: tampered, budgetBurnedBp: 1 }), token: p.token });
    expect(res.status).toBe(201);
    expect(((await res.json()) as Posted).score.budgetBurnedBp).toBeGreaterThan(PERFECT_EXPECTED.budgetBurnedBp);
  });

  it("answers an impossible log with 422 and its reason, and stores nothing", async () => {
    const p = await h.register();
    const res = await h.call("POST", "/api/runs", { body: perfectRun({ actions: [{ tick: 5, actionId: "checkout.rollback" }] }), token: p.token });
    expect(res.status).toBe(422);
    const error = await errorOf(res);
    expect(error.code).toBe("impossible_actions");
    expect(error.message).toContain("not_acknowledged");
    expect(await rowsFor(p.playerId)).toEqual([]);
  });

  it("returns the first result for a repeated runKey and stores one row", async () => {
    const p = await h.register();
    const body = perfectRun();
    const first = (await (await h.call("POST", "/api/runs", { body, token: p.token })).json()) as Posted;
    const again = await h.call("POST", "/api/runs", { body, token: p.token });
    expect(again.status).toBe(200);
    const second = (await again.json()) as Posted;
    expect(second.runId).toBe(first.runId);
    expect(second.score).toEqual(first.score);
    expect(await rowsFor(p.playerId)).toHaveLength(1);
  });

  it("replays a dry run without a token and stores nothing", async () => {
    const before = await h.t.sql<{ n: number }[]>`select count(*)::int as n from runs`;
    const res = await h.call("POST", "/api/runs", { body: perfectRun({ dryRun: true }), ip: freshIp() });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ score: PERFECT_EXPECTED });
    const after = await h.t.sql<{ n: number }[]>`select count(*)::int as n from runs`;
    expect(after[0]!.n).toBe(before[0]!.n);
  });

  it("answers 401 without a token", async () => {
    const res = await h.call("POST", "/api/runs", { body: perfectRun(), ip: freshIp() });
    expect(res.status).toBe(401);
  });

  it("answers 413 for a body over 64 KB", async () => {
    const p = await h.register();
    const res = await h.call("POST", "/api/runs", { body: perfectRun({ padding: "x".repeat(70 * 1024) }), token: p.token });
    expect(res.status).toBe(413);
    expect((await errorOf(res)).code).toBe("payload_too_large");
  });

  it("allows 20 runs a minute per token, then answers 429", async () => {
    const p = await h.register();
    for (let i = 0; i < 20; i++) expect((await h.call("POST", "/api/runs", { body: perfectRun(), token: p.token, ip: freshIp() })).status).toBe(201);
    const res = await h.call("POST", "/api/runs", { body: perfectRun(), token: p.token, ip: freshIp() });
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBeTruthy();
  });

  it("answers a stale engine version with 409 and counts it", async () => {
    const p = await h.register();
    const res = await h.call("POST", "/api/runs", { body: perfectRun({ engineVersion: "0.9.0" }), token: p.token });
    expect(res.status).toBe(409);
    expect((await errorOf(res)).code).toBe("stale_version");
    expect(await h.metrics.registry.getSingleMetricAsString("version_mismatch_total")).toMatch(/version_mismatch_total [1-9]/);
  });

  it("stores an implausibly fast fix as flagged, without a rank", async () => {
    const p = await h.register();
    const fast = [
      { tick: 0, actionId: ACK },
      { tick: 10, actionId: "checkout.rollback" },
    ];
    const res = await h.call("POST", "/api/runs", { body: perfectRun({ actions: fast }), token: p.token });
    expect(res.status).toBe(201);
    const body = (await res.json()) as Posted;
    expect(body.flagged).toBe(true);
    expect(body.board?.rank ?? null).toBeNull();
    expect((await rowsFor(p.playerId))[0]?.flagged).toBe(true);
  });
});
