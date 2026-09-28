import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { perfectRun } from "../fixtures";
import { hashToken, newToken } from "../players/token";
import { freshIp, testApp, type TestApp } from "../testing";

const SCENARIO = "db-pool-exhaustion";
let h: TestApp;

beforeAll(async () => {
  h = await testApp();
});
afterAll(async () => {
  await h.t.drop();
});
beforeEach(async () => {
  await h.t.sql`truncate runs, players`;
});

interface Entry {
  rank: number;
  handle: string;
  tag: string;
  budgetBurnedBp: number;
  mitigatedAtTick: number | null;
  outcome: string;
  runId: string;
  you: boolean;
}
interface Board {
  board: string;
  scenarioId: string;
  total: number;
  entries: Entry[];
  you: Entry | null;
}

let seq = 0;
async function player(handle: string): Promise<{ id: string; token: string }> {
  const token = newToken();
  const [row] = await h.t.sql<{ id: string }[]>`insert into players (token_hash, handle) values (${hashToken(token)}, ${handle}) returning id`;
  return { id: row!.id, token };
}

interface RunFields {
  bp: number;
  mitigated?: number | null;
  resolved?: boolean;
  flagged?: boolean;
  mode?: string;
  scenario?: string;
  /** Seconds after 2026-09-28T00:00Z. */
  at?: number;
}
async function insertRun(playerId: string, f: RunFields): Promise<string> {
  const resolved = f.resolved ?? true;
  const createdAt = new Date(Date.UTC(2026, 8, 28) + (f.at ?? ++seq) * 1000).toISOString();
  const [row] = await h.t.sql<{ id: string }[]>`
    insert into runs (player_id, client_run_id, scenario_id, mode, daily_date, seed, engine_version, actions, budget_burned_bp, mitigated_at_tick, end_tick, resolved, flagged, created_at)
    values (${playerId}, ${crypto.randomUUID()}, ${f.scenario ?? SCENARIO}, ${f.mode ?? "practice"}, ${f.mode === "daily_ranked" ? "2026-09-28" : null}, 1, '1.0.0', '[]'::jsonb,
            ${f.bp}, ${resolved ? (f.mitigated ?? 300) : null}, 4800, ${resolved}, ${f.flagged ?? false}, ${createdAt})
    returning id`;
  return row!.id;
}

async function board(token?: string): Promise<Board> {
  const res = await h.call("GET", `/api/leaderboard?scenario=${SCENARIO}`, { token, ip: freshIp() });
  expect(res.status).toBe(200);
  return (await res.json()) as Board;
}
const handles = (b: Board) => b.entries.map((e) => e.handle);

describe("GET /api/leaderboard", () => {
  it("ranks resolved runs above DNF, then lower burn, then earlier mitigation, then the earlier run", async () => {
    await insertRun((await player("dnf_low")).id, { bp: 10, resolved: false });
    await insertRun((await player("burn_300")).id, { bp: 300 });
    await insertRun((await player("burn_200_late")).id, { bp: 200, mitigated: 500 });
    await insertRun((await player("burn_200_early")).id, { bp: 200, mitigated: 400, at: 900 });
    await insertRun((await player("burn_200_early_2nd")).id, { bp: 200, mitigated: 400, at: 950 });
    const b = await board();
    expect(handles(b)).toEqual(["burn_200_early", "burn_200_early_2nd", "burn_200_late", "burn_300", "dnf_low"]);
    expect(b.entries.map((e) => e.rank)).toEqual([1, 2, 3, 4, 5]);
    expect(b.entries[4]).toMatchObject({ outcome: "dnf", mitigatedAtTick: null });
    expect(b.total).toBe(5);
    expect(b.you).toBeNull();
  });

  it("shows each player once, with their best run, even after a worse one", async () => {
    const p = await player("steady");
    const best = await insertRun(p.id, { bp: 150 });
    await insertRun(p.id, { bp: 900 });
    await insertRun((await player("other")).id, { bp: 400 });
    const b = await board();
    expect(handles(b)).toEqual(["steady", "other"]);
    expect(b.entries[0]!.runId).toBe(best);
  });

  it("leaves out flagged runs, daily runs and other scenarios", async () => {
    await insertRun((await player("flagged")).id, { bp: 1, flagged: true });
    await insertRun((await player("daily")).id, { bp: 1, mode: "daily_ranked" });
    await insertRun((await player("elsewhere")).id, { bp: 1, scenario: "disk-full" });
    await insertRun((await player("counted")).id, { bp: 500 });
    const b = await board();
    expect(handles(b)).toEqual(["counted"]);
    expect(b.total).toBe(1);
  });

  it("returns the top 50, plus the caller's own row when they are further down", async () => {
    let me = { id: "", token: "" };
    for (let i = 1; i <= 55; i++) {
      const p = await player(`p${String(i).padStart(2, "0")}`);
      if (i === 53) me = p;
      await insertRun(p.id, { bp: i * 10 });
    }
    const b = await board(me.token);
    expect(b.entries).toHaveLength(50);
    expect(b.total).toBe(55);
    expect(b.you).toMatchObject({ rank: 53, handle: "p53", you: true });
    expect(b.entries.every((e) => !e.you)).toBe(true);
  });

  it("marks the caller's row inside the top 50, and ignores an unknown token", async () => {
    const me = await player("me");
    await insertRun(me.id, { bp: 100 });
    expect((await board(me.token)).entries[0]).toMatchObject({ handle: "me", you: true, tag: me.id.slice(-4) });
    expect((await board(newToken())).you).toBeNull();
  });

  it("answers an unknown scenario with 400 schema", async () => {
    const res = await h.call("GET", "/api/leaderboard?scenario=nope", { ip: freshIp() });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/runs and the board", () => {
  it("returns the player's rank and whether the run is their new best", async () => {
    await insertRun((await player("ahead")).id, { bp: 100 });
    const res = await h.register("poster");
    const first = await h.call("POST", "/api/runs", { body: perfectRun(), token: res.token });
    expect(((await first.json()) as { board: unknown }).board).toEqual({ rank: 2, total: 2, best: true });
    const worse = perfectRun({ actions: [{ tick: 0, actionId: "ack" }] });
    const second = await h.call("POST", "/api/runs", { body: worse, token: res.token });
    expect(((await second.json()) as { board: unknown }).board).toEqual({ rank: 2, total: 2, best: false });
  });
});
