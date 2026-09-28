import { ActionRejected, replay, type RunResult } from "@pitwall/engine";
import { getScenario } from "@pitwall/scenarios";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { runs } from "../db/schema";
import { readJson } from "../http/body";
import { clientIp } from "../http/clientIp";
import { enforce, type AppEnv, type RouteContext } from "../http/context";
import { ApiError } from "../http/errors";
import { boardPosition } from "../leaderboard/query";
import { requirePlayer } from "../players/auth";
import { isImplausible } from "./plausibility";
import { parseRunBody, StaleVersion, type RunBody } from "./schema";

type Run = typeof runs.$inferSelect;

const scoreOf = (r: RunResult) => ({ outcome: r.outcome, budgetBurnedBp: r.budgetBurnedBp, mitigatedAtTick: r.mitigatedAtTick, endTick: r.endTick });
const storedScore = (row: Run) => ({ outcome: row.resolved ? "resolved" : "dnf", budgetBurnedBp: row.budgetBurnedBp, mitigatedAtTick: row.mitigatedAtTick, endTick: row.endTick });

const MAX_BODY = 64 * 1024;

/** `POST /api/runs`: the validation pipeline of M2 spec §3, in order. */
export function runsRoutes(ctx: RouteContext) {
  const r = new Hono<AppEnv>();

  const reject = (reason: string) => ctx.metrics.rejections.inc({ reason });

  const parse = (json: unknown): RunBody => {
    try {
      return parseRunBody(json);
    } catch (e) {
      if (e instanceof StaleVersion) ctx.metrics.versionMismatch.inc();
      if (e instanceof ApiError) reject(e.code);
      throw e;
    }
  };

  const view = async (row: Run, playerId: string) => ({
    runId: row.id,
    mode: row.mode,
    flagged: row.flagged,
    score: storedScore(row),
    board: await boardPosition(ctx.db, row.scenarioId, playerId, row.id),
  });

  r.post(
    "/runs",
    bodyLimit({
      maxSize: MAX_BODY,
      onError: () => {
        reject("payload_too_large");
        throw new ApiError(413, "payload_too_large", "A run is at most 64 KB.");
      },
    }),
    async (c) => {
      enforce(ctx, "runs-ip", clientIp(c), ctx.limits.runsPerIp);
      const body = parse(await readJson(c));

      const player = body.dryRun ? null : await requirePlayer(ctx, c);
      if (player) {
        enforce(ctx, "runs-token", player.id, ctx.limits.runsPerToken);
        const [existing] = await ctx.db
          .select()
          .from(runs)
          .where(and(eq(runs.playerId, player.id), eq(runs.clientRunId, body.runKey)))
          .limit(1);
        if (existing) return c.json(await view(existing, player.id), 200);
      }

      const scenario = getScenario(body.scenarioId)!;
      const stop = ctx.metrics.replaySeconds.startTimer();
      let result: RunResult;
      try {
        result = replay(scenario, body.seed, body.actions);
      } catch (e) {
        if (e instanceof ActionRejected) {
          reject("impossible_actions");
          throw new ApiError(422, "impossible_actions", `The replay refused ${e.actionId} at tick ${e.tick}: ${e.reason}.`);
        }
        // A reproducible bug report: paste these into a test (spec §11).
        ctx.logger.error(
          { reqId: c.get("requestId"), err: e, scenarioId: body.scenarioId, seed: body.seed, engineVersion: body.engineVersion, actions: body.actions },
          "replay failed",
        );
        throw e;
      } finally {
        stop();
      }

      if (!player) {
        ctx.metrics.runsSubmitted.inc({ mode: "dry_run", outcome: result.outcome });
        return c.json({ score: scoreOf(result) }, 200);
      }

      const values = {
        playerId: player.id,
        clientRunId: body.runKey,
        scenarioId: body.scenarioId,
        mode: body.mode,
        seed: body.seed,
        engineVersion: body.engineVersion,
        actions: body.actions,
        budgetBurnedBp: result.budgetBurnedBp,
        mitigatedAtTick: result.mitigatedAtTick,
        endTick: result.endTick,
        resolved: result.outcome === "resolved",
        flagged: isImplausible(scenario, result),
      };
      // A concurrent post of the same key loses the race quietly and returns the winner's row.
      const [inserted] = await ctx.db.insert(runs).values(values).onConflictDoNothing({ target: [runs.playerId, runs.clientRunId] }).returning();
      if (!inserted) {
        const [winner] = await ctx.db
          .select()
          .from(runs)
          .where(and(eq(runs.playerId, player.id), eq(runs.clientRunId, body.runKey)))
          .limit(1);
        return c.json(await view(winner!, player.id), 200);
      }
      ctx.metrics.runsSubmitted.inc({ mode: body.mode, outcome: result.outcome });
      return c.json(await view(inserted, player.id), 201);
    },
  );

  return r;
}
