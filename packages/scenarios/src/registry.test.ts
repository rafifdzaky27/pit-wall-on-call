import { describe, expect, it } from "vitest";
import { desktopFor, getScenario, INCIDENTS, SCENARIOS } from "./index";

describe("the incident registry (M4 spec N1)", () => {
  it("lists every variant of every incident, plus training, with unique ids", () => {
    const ids = SCENARIOS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const inc of INCIDENTS) for (const v of inc.variants) expect(ids).toContain(v.scenario.id);
    expect(ids).toContain("training-config-push");
  });

  it("names variants <incident> for the first and <incident>:<key> for the rest", () => {
    for (const inc of INCIDENTS) {
      expect(inc.variants[0]!.scenario.id).toBe(inc.id);
      for (const v of inc.variants.slice(1)) expect(v.scenario.id).toBe(`${inc.id}:${v.key}`);
    }
  });

  it("finds every scenario and its desktop by id", () => {
    for (const s of SCENARIOS) {
      expect(getScenario(s.id)).toBe(s);
      expect(desktopFor(s.id).chat.length).toBeGreaterThan(0);
    }
  });

  it("gives every incident a family and a difficulty from 1 to 5", () => {
    for (const inc of INCIDENTS) {
      expect(inc.family).toBeTruthy();
      expect(inc.difficulty).toBeGreaterThanOrEqual(1);
      expect(inc.difficulty).toBeLessThanOrEqual(5);
    }
  });
});
