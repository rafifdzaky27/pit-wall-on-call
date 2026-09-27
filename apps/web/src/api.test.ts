import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchApiVersion } from "./api";

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch(response: Response) {
  vi.stubGlobal("fetch", vi.fn(async () => response));
}

describe("fetchApiVersion", () => {
  it("returns the version from a healthy API", async () => {
    stubFetch(Response.json({ version: "abc1234" }));
    await expect(fetchApiVersion()).resolves.toBe("abc1234");
  });

  it("rejects on a non-2xx status such as a Caddy 502", async () => {
    stubFetch(new Response("bad gateway", { status: 502 }));
    await expect(fetchApiVersion()).rejects.toThrow("HTTP 502");
  });

  it("rejects when /api is misrouted to the SPA and returns HTML", async () => {
    stubFetch(new Response("<!doctype html><html></html>", { status: 200 }));
    await expect(fetchApiVersion()).rejects.toThrow();
  });

  it("rejects when the JSON has no version", async () => {
    stubFetch(Response.json({ status: "ok" }));
    await expect(fetchApiVersion()).rejects.toThrow("unexpected response");
  });
});
