import { ENGINE_VERSION } from "@pitwall/engine";
import { dailyFor, utcDate } from "@pitwall/scenarios";
import { Hono } from "hono";
import type { AppEnv, RouteContext } from "../http/context";
import { ApiError } from "../http/errors";

const DAY_MS = 86_400_000;

/** Today's UTC date by the server's clock. */
export const today = (ctx: RouteContext) => utcDate(ctx.now());

/**
 * A daily may be posted on its own date or the day after, for a shift started before midnight and
 * finished after it (M3 spec Y5). Its scenario and seed must be that day's.
 */
export function checkDaily(ctx: RouteContext, date: string, scenarioId: string, seed: number): void {
  const now = ctx.now();
  if (date !== utcDate(now) && date !== utcDate(now - DAY_MS)) {
    throw new ApiError(400, "not_the_daily", `Daily ${date} is closed; today is ${utcDate(now)}.`);
  }
  const daily = dailyFor(date);
  if (daily.scenarioId !== scenarioId || daily.seed !== seed) {
    throw new ApiError(400, "not_the_daily", `That run is not Daily #${daily.number}.`);
  }
}

/** `GET /api/daily`: today's incident (M3 spec Y4). */
export function dailyRoutes(ctx: RouteContext) {
  const r = new Hono<AppEnv>();
  r.get("/daily", (c) => {
    c.header("Cache-Control", "public, max-age=60");
    return c.json({ ...dailyFor(today(ctx)), engineVersion: ENGINE_VERSION });
  });
  return r;
}
