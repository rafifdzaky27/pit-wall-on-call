import { sql } from "drizzle-orm";
import type { Db } from "../db/client";
import { tagOf } from "../players/token";

export interface BoardPosition {
  rank: number | null;
  total: number;
  best: boolean;
}

export interface BoardEntry {
  rank: number;
  handle: string;
  tag: string;
  budgetBurnedBp: number;
  mitigatedAtTick: number | null;
  outcome: "resolved" | "dnf";
  runId: string;
  you: boolean;
}

interface Row extends Record<string, unknown> {
  id: string;
  player_id: string;
  handle: string;
  budget_burned_bp: number;
  mitigated_at_tick: number | null;
  resolved: boolean;
  rank: number;
  total: number;
}

/**
 * Each player's best run of a scenario, ranked (M2 spec §4); a ranked daily counts too (M3): resolved first, then lower burn, then the
 * earlier mitigation (DNF has none), then the earlier run. `row_number` gives distinct places (plan P3).
 */
const ranked = (scenarioId: string) => sql`
  with best as (
    select distinct on (r.player_id) r.id, r.player_id, r.budget_burned_bp, r.mitigated_at_tick, r.resolved, r.created_at
    from runs r
    where r.mode in ('practice', 'daily_ranked') and r.flagged = false and r.scenario_id = ${scenarioId}
    order by r.player_id, r.resolved desc, r.budget_burned_bp, r.mitigated_at_tick nulls last, r.created_at, r.id
  )
  select best.*,
         row_number() over (order by resolved desc, budget_burned_bp, mitigated_at_tick nulls last, created_at, id)::int as rank,
         count(*) over ()::int as total
  from best`;

function entry(row: Row, playerId: string | null): BoardEntry {
  return {
    rank: row.rank,
    handle: row.handle,
    tag: tagOf(row.player_id),
    budgetBurnedBp: row.budget_burned_bp,
    mitigatedAtTick: row.mitigated_at_tick,
    outcome: row.resolved ? "resolved" : "dnf",
    runId: row.id,
    you: row.player_id === playerId,
  };
}

/** The top `limit` entries, the ranked total, and the caller's own entry when a player is given. */
export async function practiceBoard(db: Db, scenarioId: string, { limit = 50, playerId = null }: { limit?: number; playerId?: string | null } = {}) {
  const rows = await db.execute<Row>(sql`
    select ranked.*, p.handle
    from (${ranked(scenarioId)}) ranked
    join players p on p.id = ranked.player_id
    where ranked.rank <= ${limit} or ranked.player_id = ${playerId}::uuid
    order by ranked.rank`);
  const list = [...rows];
  const mine = list.find((r) => r.player_id === playerId);
  return {
    total: list[0]?.total ?? 0,
    entries: list.filter((r) => r.rank <= limit).map((r) => entry(r, playerId)),
    you: mine ? entry(mine, playerId) : null,
  };
}

/** Where the player stands after posting `runId`; a flagged run has no rank until reviewed. */
export async function boardPosition(db: Db, scenarioId: string, playerId: string, runId: string): Promise<BoardPosition> {
  const rows = await db.execute<Row>(sql`
    select ranked.*, '' as handle
    from (${ranked(scenarioId)}) ranked
    where ranked.player_id = ${playerId}::uuid`);
  const totals = await db.execute<{ total: number }>(sql`
    select count(distinct player_id)::int as total from runs
    where mode in ('practice', 'daily_ranked') and flagged = false and scenario_id = ${scenarioId}`);
  const [flagged] = await db.execute<{ flagged: boolean }>(sql`select flagged from runs where id = ${runId}::uuid`);
  const total = [...totals][0]?.total ?? 0;
  const mine = [...rows][0];
  if (!mine || flagged?.flagged) return { rank: null, total, best: false };
  return { rank: mine.rank, total, best: mine.id === runId };
}

/**
 * The day's board (M3 spec Y7): each player's one ranked daily, in the practice board's order. The
 * unique index guarantees one ranked run per player and date.
 */
const rankedDaily = (date: string) => sql`
  select r.id, r.player_id, r.budget_burned_bp, r.mitigated_at_tick, r.resolved, r.created_at,
         row_number() over (order by r.resolved desc, r.budget_burned_bp, r.mitigated_at_tick nulls last, r.created_at, r.id)::int as rank,
         count(*) over ()::int as total
  from runs r
  where r.mode = 'daily_ranked' and r.flagged = false and r.daily_date = ${date}::date`;

export async function dailyBoard(db: Db, date: string, { limit = 50, playerId = null }: { limit?: number; playerId?: string | null } = {}) {
  const rows = await db.execute<Row>(sql`
    select ranked.*, p.handle
    from (${rankedDaily(date)}) ranked
    join players p on p.id = ranked.player_id
    where ranked.rank <= ${limit} or ranked.player_id = ${playerId}::uuid
    order by ranked.rank`);
  const list = [...rows];
  const mine = list.find((r) => r.player_id === playerId);
  return {
    total: list[0]?.total ?? 0,
    entries: list.filter((r) => r.rank <= limit).map((r) => entry(r, playerId)),
    you: mine ? entry(mine, playerId) : null,
  };
}

/** Where a ranked daily stands on its day's board; a flagged one has no rank until reviewed. */
export async function dailyPosition(db: Db, date: string, runId: string): Promise<BoardPosition> {
  const rows = await db.execute<Row>(sql`select ranked.* from (${rankedDaily(date)}) ranked where ranked.id = ${runId}::uuid`);
  const [count] = await db.execute<{ total: number }>(sql`
    select count(*)::int as total from runs where mode = 'daily_ranked' and flagged = false and daily_date = ${date}::date`);
  const mine = [...rows][0];
  return { rank: mine?.rank ?? null, total: count?.total ?? 0, best: !!mine };
}
