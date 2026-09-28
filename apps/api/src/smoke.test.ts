import { describe, expect, it } from "vitest";
import { PERFECT_EXPECTED } from "./fixtures";
import { runSmoke } from "./smoke";

const answering = (status: number, body: unknown): typeof fetch =>
  (async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })) as typeof fetch;

describe("runSmoke", () => {
  it("passes when the dry-run replay scores the fixture as expected", async () => {
    let sent: { url: string; body: Record<string, unknown> } | null = null;
    const fetchImpl = (async (url: string, init: RequestInit) => {
      sent = { url, body: JSON.parse(String(init.body)) };
      return new Response(JSON.stringify({ score: PERFECT_EXPECTED }), { status: 200 });
    }) as typeof fetch;
    await expect(runSmoke("http://web:80", fetchImpl)).resolves.toBeUndefined();
    expect(sent!.url).toBe("http://web:80/api/runs");
    expect(sent!.body.dryRun).toBe(true);
  });

  it("fails when the score differs", async () => {
    await expect(runSmoke("http://web:80", answering(200, { score: { ...PERFECT_EXPECTED, budgetBurnedBp: 999 } }))).rejects.toThrow(
      `smoke replay scored 999 bp, expected ${PERFECT_EXPECTED.budgetBurnedBp} bp`,
    );
  });

  it("fails on an HTTP error", async () => {
    await expect(runSmoke("http://web:80", answering(500, { error: { code: "internal" } }))).rejects.toThrow("smoke replay got HTTP 500");
  });
});
