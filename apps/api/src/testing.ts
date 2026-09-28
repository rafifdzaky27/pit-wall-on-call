import { createApp, type AppDeps } from "./app";
import { createMetrics } from "./http/metrics";
import { testDatabase, type TestDatabase } from "./db/testing";

export interface TestApp {
  app: ReturnType<typeof createApp>;
  t: TestDatabase;
  metrics: ReturnType<typeof createMetrics>;
  /** A JSON request; `ip` sets CF-Connecting-IP so tests do not share rate-limit windows. */
  call: (method: string, path: string, opts?: { body?: unknown; raw?: string; token?: string; ip?: string }) => Promise<Response>;
  register: (handle?: string, ip?: string) => Promise<{ playerId: string; handle: string; tag: string; token: string }>;
}

let ips = 0;
/** A fresh client IP per call site, so rate limits do not leak between tests in one file. */
export const freshIp = () => `10.0.${Math.floor(++ips / 250)}.${ips % 250}`;

/** An app over a throw-away database. Call `t.drop()` in afterAll. */
export async function testApp(overrides: Partial<AppDeps> = {}): Promise<TestApp> {
  const t = await testDatabase();
  const metrics = createMetrics();
  const app = createApp({ version: "test", pingDb: async () => {}, db: t.db, metrics, ...overrides });
  const call: TestApp["call"] = (method, path, opts = {}) => {
    const headers: Record<string, string> = { "cf-connecting-ip": opts.ip ?? "10.255.0.1" };
    if (opts.body !== undefined || opts.raw !== undefined) headers["content-type"] = "application/json";
    if (opts.token) headers.authorization = `Bearer ${opts.token}`;
    return Promise.resolve(app.request(path, { method, headers, body: opts.raw ?? (opts.body === undefined ? undefined : JSON.stringify(opts.body)) }));
  };
  const register: TestApp["register"] = async (handle = "tester", ip = freshIp()) => {
    const res = await call("POST", "/api/players", { body: { handle }, ip });
    if (res.status !== 201) throw new Error(`register failed: ${res.status} ${await res.text()}`);
    return (await res.json()) as { playerId: string; handle: string; tag: string; token: string };
  };
  return { app, t, metrics, call, register };
}
