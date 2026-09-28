import pino from "pino";
import { describe, expect, it } from "vitest";
import { createApp } from "../app";

const dbUp = async () => {};

function captured() {
  const lines: Record<string, unknown>[] = [];
  const logger = pino({ level: "info" }, { write: (line: string) => lines.push(JSON.parse(line)) });
  return { logger, lines };
}

describe("HTTP plumbing", () => {
  it("answers an unknown route with a JSON 404 carrying the request ID", async () => {
    const app = createApp({ version: "v", pingDb: dbUp });
    const res = await app.request("/api/nope");
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string; requestId: string } };
    expect(body.error.code).toBe("not_found");
    expect(body.error.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.headers.get("x-request-id")).toBe(body.error.requestId);
  });

  it("turns a thrown error into a 500 with the request ID, and logs it with that ID", async () => {
    const { logger, lines } = captured();
    const app = createApp({ version: "v", pingDb: dbUp, logger });
    app.get("/api/boom", () => {
      throw new Error("kaboom");
    });
    const res = await app.request("/api/boom");
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: { code: string; message: string; requestId: string } };
    expect(body.error.code).toBe("internal");
    expect(body.error.message).not.toContain("kaboom");
    const logged = lines.find((l) => l.msg === "unhandled error");
    expect(logged?.reqId).toBe(body.error.requestId);
    expect((logged?.err as { message: string }).message).toBe("kaboom");
  });

  it("logs one line per request with its status and duration", async () => {
    const { logger, lines } = captured();
    const app = createApp({ version: "v", pingDb: dbUp, logger });
    await app.request("/api/version");
    const line = lines.find((l) => l.msg === "request");
    expect(line).toMatchObject({ method: "GET", path: "/api/version", status: 200 });
    expect(typeof line?.ms).toBe("number");
    expect(typeof line?.reqId).toBe("string");
  });

  it("exposes Prometheus metrics, including HTTP latency by route", async () => {
    const app = createApp({ version: "v", pingDb: dbUp });
    await app.request("/api/version");
    const res = await app.request("/metrics");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/plain");
    const text = await res.text();
    expect(text).toContain('http_request_duration_seconds_bucket{le="0.005",method="GET",route="/api/version",status="200"}');
    expect(text).toContain("runs_submitted_total");
  });
});
