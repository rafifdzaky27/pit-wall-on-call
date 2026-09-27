import { Hono } from "hono";

export interface AppDeps {
  version: string;
  pingDb: () => Promise<void>;
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

export function createApp({ version, pingDb, readinessTimeoutMs = 2000 }: AppDeps) {
  const app = new Hono();

  // Ops endpoints: reachable inside the compose network only (Caddy proxies /api/* alone).
  app.get("/healthz", (c) => c.json({ status: "ok" }));

  app.get("/readyz", async (c) => {
    try {
      await withTimeout(pingDb(), readinessTimeoutMs);
      return c.json({ status: "ready" });
    } catch {
      return c.json({ status: "not_ready", reason: "database_unreachable" }, 503);
    }
  });

  app.get("/api/version", (c) => c.json({ version }));

  return app;
}
