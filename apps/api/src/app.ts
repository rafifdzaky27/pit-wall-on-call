import { Hono } from "hono";

export interface AppDeps {
  version: string;
  pingDb: () => Promise<void>;
  /** Bundled migrations not yet applied. Defaults to none, for apps without a database. */
  pendingMigrations?: () => Promise<number>;
  readinessTimeoutMs?: number;
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

export function createApp({ version, pingDb, pendingMigrations = async () => 0, readinessTimeoutMs = 2000 }: AppDeps) {
  const app = new Hono();

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

  app.get("/api/version", (c) => c.json({ version }));

  return app;
}
