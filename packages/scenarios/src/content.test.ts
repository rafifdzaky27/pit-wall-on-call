import { Run } from "@pitwall/engine";
import { describe, expect, it } from "vitest";
import { getScenario, SCENARIOS } from "./index";

/** Hotspot areas each scene draws (cold-open spec §6). M1.5 replaces this with the scenes package. */
const SCENE_AREAS: Record<string, string[]> = { cafe: ["laptop", "phone", "table", "wall"] };

describe.each(SCENARIOS.map((s) => [s.id, s] as const))("%s content", (_id, scenario) => {
  it("passes engine validation", () => {
    expect(() => new Run(scenario, 1)).not.toThrow();
  });

  it("has 1–3 clues and 1–2 herrings (cold-open spec §5)", () => {
    const kinds = Object.values(scenario.coldOpen.hotspots).map((h) => h.kind);
    const clues = kinds.filter((k) => k === "clue").length;
    const herrings = kinds.filter((k) => k === "herring").length;
    expect(clues).toBeGreaterThanOrEqual(1);
    expect(clues).toBeLessThanOrEqual(3);
    expect(herrings).toBeGreaterThanOrEqual(1);
    expect(herrings).toBeLessThanOrEqual(2);
  });

  it("places every hotspot in an area its scene draws", () => {
    const areas = SCENE_AREAS[scenario.coldOpen.scene];
    expect(areas).toBeDefined();
    for (const id of Object.keys(scenario.coldOpen.hotspots)) {
      expect(areas).toContain(id.split(".")[0]);
    }
  });

  it("ends its lessons with a catch-all", () => {
    expect(scenario.lessons.at(-1)!.when({} as never)).toBe(true);
  });

  it("is registered by id", () => {
    expect(getScenario(scenario.id)).toBe(scenario);
  });
});
