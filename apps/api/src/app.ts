import { Hono } from "hono";
import pino, { type Logger } from "pino";
import type { Db } from "./db/client";
import type { AppEnv, RouteContext } from "./http/context";
import { ApiError, errorBody } from "./http/errors";
import { createMetrics, type Metrics } from "./http/metrics";
import { createRateLimiter, DEFAULT_LIMITS, type Limits, type RateLimiter } from "./http/rateLimit";
import { dailyRoutes } from "./daily/routes";
import { leaderboardRoutes } from "./leaderboard/routes";
import { playersRoutes } from "./players/routes";
import { runsRoutes } from "./runs/routes";

export interface AppDeps {
  version: string;
  pingDb: () => Promise<void>;
  /** Bundled migrations not yet applied. Defaults to none, for apps without a database. */
  pendingMigrations?: () => Promise<number>;
  readinessTimeoutMs?: number;
  /** The game routes (players, runs, leaderboard) are mounted only with a database. */
  db?: Db;
  logger?: Logger;
  metrics?: Metrics;
  limiter?: RateLimiter;
  limits?: Partial<Limits>;
  now?: () => number;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export function createApp(deps: AppDeps) {
  const { version, pingDb, pendingMigrations = async () => 0, readinessTimeoutMs = 2000 } = deps;
  const logger = deps.logger ?? pino({ level: "silent" });
  const metrics = deps.metrics ?? createMetrics();
  const app = new Hono<AppEnv>();

  // Every response carries a fresh request ID; an incoming one is never trusted.
  app.use(async (c, next) => {
    const requestId = crypto.randomUUID();
    c.set("requestId", requestId);
    const started = performance.now();
    await next();
    c.header("X-Request-Id", requestId);
    const ms = performance.now() - started;
    const route = c.req.routePath === "/*" ? "unmatched" : c.req.routePath;
    metrics.httpSeconds.observe({ method: c.req.method, route, status: String(c.res.status) }, ms / 1000);
    logger.info({ reqId: requestId, method: c.req.method, path: c.req.path, status: c.res.status, ms: Math.round(ms) }, "request");
  });

  app.onError((err, c) => {
    const requestId = c.get("requestId");
    if (err instanceof ApiError) {
      return c.json(errorBody(err.code, err.message, requestId), err.status, err.headers);
    }
    logger.error({ reqId: requestId, err }, "unhandled error");
    return c.json(errorBody("internal", "Something went wrong on our side.", requestId), 500);
  });

  app.notFound((c) => c.json(errorBody("not_found", "No such route.", c.get("requestId")), 404));

  // Ops endpoints: reachable inside the compose network only (Caddy proxies /api/* alone).
  app.get("/healthz", (c) => c.json({ status: "ok" }));

  app.get("/readyz", async (c) => {
    try {
      await withTimeout(pingDb(), readinessTimeoutMs);
    } catch {
      return c.json({ status: "not_ready", reason: "database_unreachable" }, 503);
    }
    // A new image on an old schema is not ready: deploy.sh migrates before it starts (M2 spec L8).
    try {
      if ((await withTimeout(pendingMigrations(), readinessTimeoutMs)) > 0) {
        return c.json({ status: "not_ready", reason: "migrations_pending" }, 503);
      }
    } catch {
      return c.json({ status: "not_ready", reason: "database_unreachable" }, 503);
    }
    return c.json({ status: "ready" });
  });

  app.get("/metrics", async (c) => c.text(await metrics.registry.metrics(), 200, { "Content-Type": metrics.registry.contentType }));

  app.get("/api/version", (c) => c.json({ version }));

  if (deps.db) {
    const ctx: RouteContext = {
      db: deps.db,
      logger,
      metrics,
      limiter: deps.limiter ?? createRateLimiter(),
      limits: { ...DEFAULT_LIMITS, ...deps.limits },
      now: deps.now ?? Date.now,
    };
    app.route("/api", playersRoutes(ctx));
    app.route("/api", runsRoutes(ctx));
    app.route("/api", leaderboardRoutes(ctx));
    app.route("/api", dailyRoutes(ctx));
  }

  return app;
}
