import { describe, expect, it } from "vitest";
import { createApp } from "./app";

const dbUp = async () => {};
const dbDown = async () => {
  throw new Error("connection refused");
};
const dbHangs = () => new Promise<void>(() => {});

describe("GET /healthz", () => {
  it("returns ok even when the database is down", async () => {
    const app = createApp({ version: "abc123", pingDb: dbDown });
    const res = await app.request("/healthz");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });
});

describe("GET /api/healthz", () => {
  it("is public, returns ok, and never touches the database", async () => {
    let pings = 0;
    const app = createApp({
      version: "abc123",
      pingDb: async () => {
        pings += 1;
        throw new Error("connection refused");
      },
    });
    const res = await app.request("/api/healthz");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
    expect(pings).toBe(0);
  });
});

describe("GET /readyz", () => {
  it("returns ready when the database answers", async () => {
    const app = createApp({ version: "abc123", pingDb: dbUp });
    const res = await app.request("/readyz");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ready" });
  });

  it("returns 503 when the database errors", async () => {
    const app = createApp({ version: "abc123", pingDb: dbDown });
    const res = await app.request("/readyz");
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ status: "not_ready", reason: "database_unreachable" });
  });

  it("returns 503 migrations_pending while migrations are pending", async () => {
    const app = createApp({ version: "abc123", pingDb: dbUp, pendingMigrations: async () => 1 });
    const res = await app.request("/readyz");
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ status: "not_ready", reason: "migrations_pending" });
  });

  it("returns 503 within the timeout when the database hangs", async () => {
    const app = createApp({ version: "abc123", pingDb: dbHangs, readinessTimeoutMs: 50 });
    const started = Date.now();
    const res = await app.request("/readyz");
    expect(res.status).toBe(503);
    expect(Date.now() - started).toBeLessThan(1000);
  });
});

describe("GET /api/version", () => {
  it("returns the deployed version", async () => {
    const app = createApp({ version: "abc123", pingDb: dbUp });
    const res = await app.request("/api/version");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ version: "abc123" });
  });
});
