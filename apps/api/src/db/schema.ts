import { sql } from "drizzle-orm";
import { bigint, boolean, check, date, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export type Difficulty = "normal" | "hard";

/** Anonymous players (spec §9). Only the token's SHA-256 is stored. */
export const players = pgTable("players", {
  id: uuid("id").primaryKey().defaultRandom(),
  tokenHash: text("token_hash").notNull().unique(),
  handle: text("handle").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Every accepted run, scored by the server's replay (spec §9, M2 spec §4). */
export const runs = pgTable(
  "runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id),
    /** The client's key for this finished shift; a repeated post returns the stored run (M2 spec L6). */
    clientRunId: uuid("client_run_id").notNull(),
    scenarioId: text("scenario_id").notNull(),
    mode: text("mode").notNull(),
    dailyDate: date("daily_date"),
    /** Normal or hard (M6 spec H10). Old rows and old clients are normal. */
    difficulty: text("difficulty").$type<Difficulty>().notNull().default("normal"),
    seed: bigint("seed", { mode: "number" }).notNull(),
    engineVersion: text("engine_version").notNull(),
    actions: jsonb("actions").notNull(),
    budgetBurnedBp: integer("budget_burned_bp").notNull(),
    mitigatedAtTick: integer("mitigated_at_tick"),
    endTick: integer("end_tick").notNull(),
    resolved: boolean("resolved").notNull(),
    flagged: boolean("flagged").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("runs_mode_check", sql`${t.mode} in ('daily_ranked', 'practice')`),
    uniqueIndex("runs_player_client_run_key").on(t.playerId, t.clientRunId),
    check("runs_difficulty_check", sql`${t.difficulty} in ('normal', 'hard')`),
    uniqueIndex("one_ranked_daily_per_player").on(t.playerId, t.dailyDate, t.difficulty).where(sql`${t.mode} = 'daily_ranked'`),
    index("leaderboard_idx")
      .on(t.dailyDate, t.difficulty, t.resolved.desc(), t.budgetBurnedBp, t.mitigatedAtTick)
      .where(sql`${t.mode} = 'daily_ranked' and ${t.flagged} = false`),
    index("practice_board_idx")
      .on(t.scenarioId, t.difficulty, t.playerId, t.resolved.desc(), t.budgetBurnedBp, t.mitigatedAtTick, t.createdAt)
      .where(sql`${t.mode} = 'practice' and ${t.flagged} = false`),
  ],
);
