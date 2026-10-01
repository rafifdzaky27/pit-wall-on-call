import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testDatabase, type TestDatabase } from "./db/testing";

const SQL_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "sql");
const DB_POOL = "db-pool-exhaustion";
const DISK = "disk-full";

let t: TestDatabase;

beforeAll(async () => {
  t = await testDatabase();
  const ids: Record<string, string> = {};
  for (const handle of ["A", "B", "C", "D", "E"]) {
    const [row] = await t.sql<{ id: string }[]>`insert into players (token_hash, handle) values (${`hash-${handle}`}, ${handle}) returning id`;
    ids[handle] = row!.id;
  }
  // [player, UTC time, scenario, resolved, flagged]. Boundaries are on purpose:
  // C's first run is 1s before midnight UTC, B's second day starts at exactly 00:00:00Z.
  const runs: [string, string, string, boolean, boolean][] = [
    ["A", "2026-09-28T10:00:00Z", DB_POOL, true, false],
    ["A", "2026-09-28T11:00:00Z", DB_POOL, false, false],
    ["A", "2026-09-29T09:00:00Z", DISK, true, false],
    ["A", "2026-10-05T09:00:00Z", DB_POOL, true, false],
    ["B", "2026-09-28T12:00:00Z", DB_POOL, true, false],
    ["B", "2026-09-29T00:00:00Z", DISK, false, false],
    ["C", "2026-09-28T23:59:59Z", DISK, false, false],
    ["C", "2026-09-30T00:00:00Z", DISK, false, false],
    ["D", "2026-09-29T15:00:00Z", DISK, true, false],
    ["D", "2026-09-30T15:00:00Z", DB_POOL, false, false],
    ["E", "2026-09-28T13:00:00Z", DB_POOL, true, true],
  ];
  for (const [who, at, scenario, resolved, flagged] of runs) {
    await t.sql`
      insert into runs (player_id, client_run_id, scenario_id, mode, seed, engine_version, actions, budget_burned_bp, mitigated_at_tick, end_tick, resolved, flagged, created_at)
      values (${ids[who]!}, ${crypto.randomUUID()}, ${scenario}, 'practice', 1, '1.0.0', '[]'::jsonb, 100, ${resolved ? 300 : null}, 4800, ${resolved}, ${flagged}, ${at})`;
  }
});
afterAll(async () => {
  await t.drop();
});

/** Runs one file from apps/api/sql and returns rows with every value as a string (dates as YYYY-MM-DD). */
async function run(file: string): Promise<Record<string, string>[]> {
  const rows = await t.sql.unsafe(readFileSync(join(SQL_DIR, file), "utf8"));
  return rows.map((row) =>
    Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v instanceof Date ? v.toISOString().slice(0, 10) : String(v)])),
  );
}

describe("retention SQL", () => {
  it("d1-d7-retention.sql counts cohorts by first unflagged play (UTC) and returns on day +1 and +7", async () => {
    expect(await run("d1-d7-retention.sql")).toEqual([
      { cohort_day: "2026-09-28", players: "3", d1_players: "2", d1_pct: "66.7", d7_players: "1", d7_pct: "33.3" },
      { cohort_day: "2026-09-29", players: "1", d1_players: "1", d1_pct: "100.0", d7_players: "0", d7_pct: "0.0" },
    ]);
  });

  it("finish-rate-by-incident.sql splits finished and DNF per incident and ignores flagged runs", async () => {
    expect(await run("finish-rate-by-incident.sql")).toEqual([
      { scenario_id: DB_POOL, runs: "5", finished: "3", dnf: "2", finish_pct: "60.0", dnf_pct: "40.0" },
      { scenario_id: DISK, runs: "5", finished: "2", dnf: "3", finish_pct: "40.0", dnf_pct: "60.0" },
    ]);
  });

  it("finish-rate-by-incident-and-difficulty.sql splits each incident into normal and hard", async () => {
    const [a] = await t.sql<{ id: string }[]>`select id from players where handle = 'A'`;
    const hard = (resolved: boolean, flagged = false) =>
      t.sql`
        insert into runs (player_id, client_run_id, scenario_id, mode, difficulty, seed, engine_version, actions, budget_burned_bp, mitigated_at_tick, end_tick, resolved, flagged, created_at)
        values (${a!.id}, ${crypto.randomUUID()}, ${DISK}, 'practice', 'hard', 1, '1.0.0', '[]'::jsonb, 100, ${resolved ? 300 : null}, 4800, ${resolved}, ${flagged}, '2026-10-20T10:00:00Z')`;
    await hard(true);
    await hard(false);
    await hard(true, true);
    try {
      expect(await run("finish-rate-by-incident-and-difficulty.sql")).toEqual([
        { scenario_id: DB_POOL, difficulty: "normal", runs: "5", finished: "3", dnf: "2", finish_pct: "60.0", dnf_pct: "40.0" },
        { scenario_id: DISK, difficulty: "hard", runs: "2", finished: "1", dnf: "1", finish_pct: "50.0", dnf_pct: "50.0" },
        { scenario_id: DISK, difficulty: "normal", runs: "5", finished: "2", dnf: "3", finish_pct: "40.0", dnf_pct: "60.0" },
      ]);
    } finally {
      await t.sql`delete from runs where difficulty = 'hard'`;
    }
  });

  it("daily-players.sql counts distinct players, runs and first-time players per UTC day", async () => {
    expect(await run("daily-players.sql")).toEqual([
      { day: "2026-09-28", players: "3", runs: "4", new_players: "3" },
      { day: "2026-09-29", players: "3", runs: "3", new_players: "1" },
      { day: "2026-09-30", players: "2", runs: "2", new_players: "0" },
      { day: "2026-10-05", players: "1", runs: "1", new_players: "0" },
    ]);
  });

  it("every file in apps/api/sql is covered above and is a read-only query", () => {
    const files = readdirSync(SQL_DIR).filter((f) => f.endsWith(".sql"));
    expect(files.sort()).toEqual(["d1-d7-retention.sql", "daily-players.sql", "finish-rate-by-incident-and-difficulty.sql", "finish-rate-by-incident.sql"]);
    for (const f of files) {
      const code = readFileSync(join(SQL_DIR, f), "utf8")
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n");
      expect(code, f).not.toMatch(/\b(insert|update|delete|drop|alter|truncate|create|grant)\b/i);
    }
  });
});
