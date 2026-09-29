import { INCIDENTS } from "@pitwall/scenarios";
import { describe, expect, it } from "vitest";
import { hintFor } from "./hints";
import { MILESTONES } from "./milestones";

describe("the hint texts", () => {
  it("say nothing spoilery for any variant of any incident, with any service as the critical one", () => {
    for (const incident of INCIDENTS) {
      for (const variant of incident.variants) {
        const labels = [null, ...variant.scenario.services.map((s) => s.label)];
        for (const label of labels) {
          for (const m of MILESTONES) {
            const hint = hintFor(m, label, variant.spoilers);
            if (!hint) continue;
            const text = `${hint.title} ${hint.body} ${hint.cta}`.toLowerCase();
            for (const word of variant.spoilers) {
              expect(text.includes(word.toLowerCase()), `${variant.scenario.id}: "${word}" in "${text}"`).toBe(false);
            }
          }
        }
      }
    }
  });

  it("names the critical service now, from scenario data", () => {
    expect(hintFor("service", "shop-api")?.body).toContain("shop-api");
    expect(hintFor("service", null)?.body).toMatch(/Click the red service/);
    expect(hintFor("service", "larkspur", ["larkspur"])?.body).not.toContain("larkspur");
  });

  it("has a hint for every milestone but the ack", () => {
    expect(MILESTONES.filter((m) => hintFor(m, null) === null)).toEqual(["acked"]);
  });
});
