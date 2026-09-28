import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { freshIp, testApp, type TestApp } from "../testing";
import { hashToken } from "./token";

let h: TestApp;

beforeAll(async () => {
  h = await testApp();
});
afterAll(async () => {
  await h.t.drop();
});

const errorCode = async (res: Response) => ((await res.json()) as { error: { code: string } }).error.code;

describe("POST /api/players", () => {
  it("creates a player and returns a token that is stored only as a hash", async () => {
    const res = await h.call("POST", "/api/players", { body: { handle: " rafif " }, ip: freshIp() });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { playerId: string; handle: string; tag: string; token: string };
    expect(body.handle).toBe("rafif");
    expect(body.tag).toBe(body.playerId.slice(-4));
    expect(body.token).toMatch(/^pw_/);
    const [row] = await h.t.sql<{ token_hash: string }[]>`select token_hash from players where id = ${body.playerId}`;
    expect(row?.token_hash).toBe(hashToken(body.token));
    expect(row?.token_hash).not.toBe(body.token);
  });

  it("rejects a malformed handle as schema and a profane one as handle_rejected", async () => {
    const short = await h.call("POST", "/api/players", { body: { handle: "ab" }, ip: freshIp() });
    expect(short.status).toBe(400);
    expect(await errorCode(short)).toBe("schema");
    const rude = await h.call("POST", "/api/players", { body: { handle: "sh1thead" }, ip: freshIp() });
    expect(rude.status).toBe(400);
    expect(await errorCode(rude)).toBe("handle_rejected");
  });

  it("rejects a body that is not JSON", async () => {
    const res = await h.call("POST", "/api/players", { raw: "{nope", ip: freshIp() });
    expect(res.status).toBe(400);
    expect(await errorCode(res)).toBe("schema");
  });

  it("allows 10 players an hour from one IP, then answers 429 with Retry-After", async () => {
    const ip = freshIp();
    for (let i = 0; i < 10; i++) expect((await h.call("POST", "/api/players", { body: { handle: `p${i}xx` }, ip })).status).toBe(201);
    const res = await h.call("POST", "/api/players", { body: { handle: "one_more" }, ip });
    expect(res.status).toBe(429);
    expect(await errorCode(res)).toBe("rate_limited");
    expect(Number(res.headers.get("retry-after"))).toBeGreaterThan(3500);
  });
});

describe("/api/players/me", () => {
  it("returns the player for its token", async () => {
    const p = await h.register("reader");
    const res = await h.call("GET", "/api/players/me", { token: p.token });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ playerId: p.playerId, handle: "reader", tag: p.tag });
  });

  it("answers 401 for a missing, malformed or unknown token", async () => {
    for (const token of [undefined, "nope", `pw_${"A".repeat(43)}`]) {
      const res = await h.call("GET", "/api/players/me", { token });
      expect(res.status).toBe(401);
      expect(await errorCode(res)).toBe("unauthorized");
    }
  });

  it("renames the player, and refuses a rejected handle", async () => {
    const p = await h.register("before");
    const res = await h.call("PATCH", "/api/players/me", { body: { handle: "after" }, token: p.token });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ playerId: p.playerId, handle: "after", tag: p.tag });
    const rude = await h.call("PATCH", "/api/players/me", { body: { handle: "kontol" }, token: p.token });
    expect(rude.status).toBe(400);
    expect(await errorCode(rude)).toBe("handle_rejected");
  });
});
