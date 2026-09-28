import type { Context } from "hono";
import type { Logger } from "pino";
import type { Db } from "../db/client";
import { ApiError } from "./errors";
import type { Metrics } from "./metrics";
import type { Limit, Limits, RateLimiter } from "./rateLimit";

export type AppEnv = { Variables: { requestId: string } };

/** What route modules need; built once by createApp. */
export interface RouteContext {
  db: Db;
  logger: Logger;
  metrics: Metrics;
  limiter: RateLimiter;
  limits: Limits;
}

/** Throws 429 with Retry-After when `key` is over `limit` in `bucket`. */
export function enforce(ctx: RouteContext, bucket: string, key: string, limit: Limit): void {
  const hit = ctx.limiter.hit(bucket, key, limit.max, limit.windowMs);
  if (hit.ok) return;
  ctx.metrics.rejections.inc({ reason: "rate_limited" });
  throw new ApiError(429, "rate_limited", "Too many requests. Try again later.", { "Retry-After": String(hit.retryAfterS) });
}

export type AppContext = Context<AppEnv>;
