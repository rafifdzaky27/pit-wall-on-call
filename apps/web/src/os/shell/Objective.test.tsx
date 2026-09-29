import { Run } from "@pitwall/engine";
import { INCIDENTS, SCENARIOS } from "@pitwall/scenarios";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Objective, objectiveText } from "./Objective";

const textOf = (html: string) => html.replace(/<[^>]+>/g, " ").toLowerCase();

describe("Objective", () => {
  it("renders the job for every scenario", () => {
    for (const scenario of SCENARIOS) {
      const html = renderToStaticMarkup(<Objective scenario={scenario} />);
      expect(html, scenario.id).toContain("Your job");
      expect(html, scenario.id).toContain("Customers get");
      expect(html, scenario.id).toContain("only hides the symptom");
    }
  });

  it("phrases the symptom for a checkout 502", () => {
    const slow = SCENARIOS.find((s) => s.coldOpen.symptom.kind === "http_502" && s.coldOpen.symptom.surface === "checkout")!;
    expect(objectiveText(slow).broken).toBe("Customers get 502 gateway errors at checkout.");
  });

  it("never says a variant's spoiler words", () => {
    for (const incident of INCIDENTS) {
      for (const v of incident.variants) {
        const text = textOf(renderToStaticMarkup(<Objective scenario={v.scenario} />)) + " " + objectiveText(v.scenario).broken.toLowerCase();
        for (const word of v.spoilers) expect(text, `${v.scenario.id}: ${word}`).not.toContain(word.toLowerCase());
      }
    }
  });

  it("reads the budget left to the same tenth as the top bar reads it burned", () => {
    const s = SCENARIOS[0]!;
    const snapshot = { ...new Run(s, 1).snapshot(), budgetBurnedBp: 10 };
    expect(renderToStaticMarkup(<Objective scenario={s} snapshot={snapshot} />)).toContain("99.9%</span> of the error budget left");
  });
});
