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

describe("GET /readyz", () => {
  it("GAME DAY DRILL: returns 503 even when the database answers", async () => {
    const app = createApp({ version: "abc123", pingDb: dbUp });
    const res = await app.request("/readyz");
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ status: "not_ready", reason: "game_day_drill" });
  });

  it("returns 503 when the database errors", async () => {
    const app = createApp({ version: "abc123", pingDb: dbDown });
    const res = await app.request("/readyz");
    expect(res.status).toBe(503);
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
