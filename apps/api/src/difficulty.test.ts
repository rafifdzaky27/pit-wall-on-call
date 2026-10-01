import { dailyFor } from "@pitwall/scenarios";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { perfectActionsFor, perfectRun } from "./fixtures";
import { freshIp, testApp, type TestApp } from "./testing";

// M6 spec H10: runs and boards are per difficulty. Frozen at 2026-10-05 10:00 UTC (Daily #7).
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

const dailyRun = (overrides: Record<string, unknown> = {}) => {
  const d = dailyFor(TODAY);
  return perfectRun({ scenarioId: d.scenarioId, seed: d.seed, mode: "daily", dailyDate: TODAY, actions: perfectActionsFor(d.scenarioId), ...overrides });
};
const post = (token: string, body: unknown) => h.call("POST", "/api/runs", { token, body, ip: freshIp() });

interface Posted {
  mode: string;
  ranked: boolean;
  difficulty: string;
  board: { rank: number | null; total: number; best: boolean };
}
interface Board {
  difficulty: string;
  total: number;
  entries: { handle: string }[];
}
const dailyBoard = async (difficulty?: string): Promise<Board> => {
  const q = difficulty === undefined ? "" : `&difficulty=${difficulty}`;
  const res = await h.call("GET", `/api/leaderboard?date=${TODAY}${q}`, { ip: freshIp() });
  expect(res.status).toBe(200);
  return (await res.json()) as Board;
};
const practiceBoard = async (difficulty?: string): Promise<Board> => {
  const q = difficulty === undefined ? "" : `&difficulty=${difficulty}`;
  const res = await h.call("GET", `/api/leaderboard?scenario=${dailyFor(TODAY).scenarioId}${q}`, { ip: freshIp() });
  expect(res.status).toBe(200);
  return (await res.json()) as Board;
};

describe("POST /api/runs difficulty", () => {
  it("a body without difficulty (an old client) is stored as normal", async () => {
    const p = await h.register("oldclient");
    const res = await post(p.token, perfectRun());
    expect(res.status).toBe(201);
    expect(((await res.json()) as Posted).difficulty).toBe("normal");
    const rows = await h.t.sql<{ difficulty: string }[]>`select difficulty from runs`;
    expect(rows).toEqual([{ difficulty: "normal" }]);
  });

  it("stores a hard run as hard and answers with it", async () => {
    const p = await h.register("hardplayer");
    const res = await post(p.token, perfectRun({ difficulty: "hard" }));
    expect(res.status).toBe(201);
    expect(((await res.json()) as Posted).difficulty).toBe("hard");
    expect(await h.t.sql`select difficulty from runs`).toEqual([{ difficulty: "hard" }]);
  });

  it("refuses an unknown difficulty", async () => {
    const p = await h.register("odd");
    const res = await post(p.token, perfectRun({ difficulty: "nightmare" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: { code: "schema" } });
  });

  it("a player ranks one daily per difficulty: a normal and a hard are both ranked, a repeat of either is practice", async () => {
    const p = await h.register("both");
    const normal = (await (await post(p.token, dailyRun())).json()) as Posted;
    const hard = (await (await post(p.token, dailyRun({ difficulty: "hard" }))).json()) as Posted;
    expect(normal).toMatchObject({ ranked: true, difficulty: "normal", board: { rank: 1, total: 1 } });
    expect(hard).toMatchObject({ ranked: true, difficulty: "hard", board: { rank: 1, total: 1 } });
    const again = (await (await post(p.token, dailyRun({ difficulty: "hard" }))).json()) as Posted;
    expect(again).toMatchObject({ ranked: false, mode: "practice", difficulty: "hard" });
  });

  it("a dry run accepts difficulty", async () => {
    const res = await h.call("POST", "/api/runs", { body: perfectRun({ dryRun: true, difficulty: "hard" }), ip: freshIp() });
    expect(res.status).toBe(200);
  });
});

describe("the migration is backward compatible (the previous image keeps working)", () => {
  it("an insert that names no difficulty, as the old image does, lands as normal and still conflicts on one ranked daily", async () => {
    const p = await h.register("oldimage");
    const insert = () => h.t.sql`
      insert into runs (player_id, client_run_id, scenario_id, mode, daily_date, seed, engine_version, actions, budget_burned_bp, end_tick, resolved)
      values (${p.playerId}, ${crypto.randomUUID()}, 'x', 'daily_ranked', ${TODAY}, 1, '1.0.0', '[]'::jsonb, 100, 4800, false)
      on conflict do nothing returning difficulty`;
    expect(await insert()).toEqual([{ difficulty: "normal" }]);
    expect(await insert()).toEqual([]);
  });
});

describe("boards do not mix difficulties", () => {
  it("the daily board defaults to normal and filters by difficulty", async () => {
    const n = await h.register("normie");
    const x = await h.register("hardie");
    await post(n.token, dailyRun());
    await post(x.token, dailyRun({ difficulty: "hard" }));
    const normal = await dailyBoard();
    expect(normal).toMatchObject({ difficulty: "normal", total: 1 });
    expect(normal.entries.map((e) => e.handle)).toEqual(["normie"]);
    const hard = await dailyBoard("hard");
    expect(hard).toMatchObject({ difficulty: "hard", total: 1 });
    expect(hard.entries.map((e) => e.handle)).toEqual(["hardie"]);
  });

  it("the practice board defaults to normal and filters by difficulty, counting hard dailies on the hard board", async () => {
    const n = await h.register("normie");
    const x = await h.register("hardie");
    const y = await h.register("hardpractice");
    await post(n.token, perfectRun({ scenarioId: dailyFor(TODAY).scenarioId, seed: 1, actions: perfectActionsFor(dailyFor(TODAY).scenarioId) }));
    await post(x.token, dailyRun({ difficulty: "hard" }));
    await post(y.token, perfectRun({ scenarioId: dailyFor(TODAY).scenarioId, seed: 1, actions: perfectActionsFor(dailyFor(TODAY).scenarioId), difficulty: "hard" }));
    const normal = await practiceBoard();
    expect(normal).toMatchObject({ difficulty: "normal", total: 1 });
    expect(normal.entries.map((e) => e.handle)).toEqual(["normie"]);
    const hard = await practiceBoard("hard");
    expect(hard.total).toBe(2);
    expect(hard.entries.map((e) => e.handle).sort()).toEqual(["hardie", "hardpractice"]);
  });

  it("a hard run's answer places it on the hard board only", async () => {
    const n = await h.register("normie");
    const x = await h.register("hardie");
    await post(n.token, dailyRun());
    const hard = (await (await post(x.token, dailyRun({ difficulty: "hard" }))).json()) as Posted;
    expect(hard.board).toEqual({ rank: 1, total: 1, best: true });
  });

  it("refuses an unknown difficulty on both boards", async () => {
    expect((await h.call("GET", `/api/leaderboard?date=${TODAY}&difficulty=easy`, { ip: freshIp() })).status).toBe(400);
    expect((await h.call("GET", `/api/leaderboard?scenario=${dailyFor(TODAY).scenarioId}&difficulty=easy`, { ip: freshIp() })).status).toBe(400);
  });
});
