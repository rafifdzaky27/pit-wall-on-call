import { describe, expect, it } from "vitest";
import type { Incident } from "./kit/incident";
import { practiceFor } from "./practice";

describe("a practice shift's incident (M4 PR B)", () => {
  const fake = (id: string, keys: string[]): Incident =>
    ({ id, title: id, family: "deploys", difficulty: 3, from: "2026-10-01", variants: keys.map((key) => ({ key, scenario: { id: key ? `${id}:${key}` : id } })) }) as unknown as Incident;
  const catalogue = [fake("a", ["", "x", "y"]), fake("b", [""]), fake("c", ["", "z"])];

  it("is chosen by the seed, the same every time", () => {
    for (let seed = 1; seed < 50; seed++) expect(practiceFor(seed, catalogue).id).toBe(practiceFor(seed, catalogue).id);
  });

  it("reaches every incident and every variant over a few hundred shifts, incidents first so each is as likely", () => {
    const seen = new Map<string, number>();
    for (let seed = 1; seed <= 600; seed++) {
      const id = practiceFor(seed, catalogue).id;
      seen.set(id, (seen.get(id) ?? 0) + 1);
    }
    expect([...seen.keys()].sort()).toEqual(["a", "a:x", "a:y", "b", "c", "c:z"]);
    // b has one variant and a has three, but each incident is picked about a third of the time.
    expect(seen.get("b")!).toBeGreaterThan(150);
  });
});
