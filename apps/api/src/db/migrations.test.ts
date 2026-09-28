import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb } from "./client";
import { migrateDb } from "./migrate";
import { testDatabase, type TestDatabase } from "./testing";

let t: TestDatabase;

beforeAll(async () => {
  t = await testDatabase({ migrate: false });
});
afterAll(async () => {
  await t.drop();
});

const player = (id: string) => t.sql`insert into players (id, token_hash, handle) values (${id}, ${`hash-${id}`}, 'p')`;
const run = (playerId: string, fields: { mode: string; dailyDate?: string; key: string }) =>
  t.sql`insert into runs (player_id, client_run_id, scenario_id, mode, daily_date, seed, engine_version, actions, budget_burned_bp, resolved)
        values (${playerId}, ${fields.key}, 'db-pool-exhaustion', ${fields.mode}, ${fields.dailyDate ?? null}, 1, '1.0.0', '[]'::jsonb, 100, true)`;

describe("migrations", () => {
  it("a fresh database has every migration pending, then none after migrating", async () => {
    const db = createDb(t.url);
    try {
      expect(await db.pendingMigrations()).toBeGreaterThan(0);
      await migrateDb(db.db);
      expect(await db.pendingMigrations()).toBe(0);
    } finally {
      await db.close();
    }
  });

  it("allows one ranked daily run per player and date", async () => {
    const id = "00000000-0000-4000-8000-000000000001";
    await player(id);
    await run(id, { mode: "daily_ranked", dailyDate: "2026-09-28", key: "10000000-0000-4000-8000-000000000001" });
    await run(id, { mode: "practice", dailyDate: "2026-09-28", key: "10000000-0000-4000-8000-000000000002" });
    await expect(run(id, { mode: "daily_ranked", dailyDate: "2026-09-28", key: "10000000-0000-4000-8000-000000000003" })).rejects.toThrow(/one_ranked_daily_per_player/);
  });

  it("stores a client run key once per player", async () => {
    const id = "00000000-0000-4000-8000-000000000002";
    await player(id);
    await run(id, { mode: "practice", key: "20000000-0000-4000-8000-000000000001" });
    await expect(run(id, { mode: "practice", key: "20000000-0000-4000-8000-000000000001" })).rejects.toThrow(/runs_player_client_run_key/);
  });

  it("rejects an unknown mode", async () => {
    const id = "00000000-0000-4000-8000-000000000003";
    await player(id);
    await expect(run(id, { mode: "ranked", key: "30000000-0000-4000-8000-000000000001" })).rejects.toThrow(/runs_mode_check/);
  });
});
