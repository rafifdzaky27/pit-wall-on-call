import { dailyNumber, getScenario, isDailyDate } from "@pitwall/scenarios";
import { Hono } from "hono";
import { clientIp } from "../http/clientIp";
import { enforce, type AppEnv, type RouteContext } from "../http/context";
import { ApiError } from "../http/errors";
import { playerFromToken } from "../players/auth";
import { dailyBoard, practiceBoard } from "./query";

/** `GET /api/leaderboard?scenario=<id>`: the practice board (M2 spec L1); `?date=YYYY-MM-DD`: that day's daily board (M3 spec Y7). `&difficulty=normal|hard` picks the board (M6 spec H10); the default is normal. */
export function leaderboardRoutes(ctx: RouteContext) {
  const r = new Hono<AppEnv>();

  r.get("/leaderboard", async (c) => {
    enforce(ctx, "board", clientIp(c), ctx.limits.boardPerIp);
    const difficulty = c.req.query("difficulty") ?? "normal";
    if (difficulty !== "normal" && difficulty !== "hard") throw new ApiError(400, "schema", `Unknown difficulty ${difficulty}.`);
    const date = c.req.query("date");
    if (date !== undefined) {
      if (!isDailyDate(date)) throw new ApiError(400, "schema", `Not a date: ${date}.`);
      const player = await playerFromToken(ctx.db, c.req.header("authorization"));
      const board = await dailyBoard(ctx.db, date, difficulty, { playerId: player?.id ?? null });
      return c.json({ board: "daily", date, difficulty, number: dailyNumber(date), ...board });
    }
    const scenarioId = c.req.query("scenario") ?? "";
    if (!getScenario(scenarioId)) throw new ApiError(400, "schema", `Unknown scenario ${scenarioId}.`);
    // An unknown token reads the board anonymously rather than failing.
    const player = await playerFromToken(ctx.db, c.req.header("authorization"));
    const board = await practiceBoard(ctx.db, scenarioId, difficulty, { playerId: player?.id ?? null });
    return c.json({ board: "practice", scenarioId, difficulty, ...board });
  });

  return r;
}
