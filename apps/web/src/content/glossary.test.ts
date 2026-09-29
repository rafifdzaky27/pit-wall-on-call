import { INCIDENTS } from "@pitwall/scenarios";
import { describe, expect, it } from "vitest";
import { GLOSSARY, glossaryEntry, type GlossaryId } from "./glossary";

describe("glossary", () => {
  it("has exactly one entry per id, each with a definition", () => {
    const ids = GLOSSARY.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const e of GLOSSARY) {
      expect(glossaryEntry(e.id as GlossaryId)).toBe(e);
      expect(e.definition.length).toBeGreaterThan(20);
    }
  });

  it("never contains a spoiler word of any incident variant", () => {
    const hits: string[] = [];
    for (const inc of INCIDENTS)
      for (const v of inc.variants)
        for (const w of v.spoilers)
          for (const e of GLOSSARY) if (e.definition.toLowerCase().includes(w.toLowerCase())) hits.push(`${e.id} ~ "${w}"`);
    expect([...new Set(hits)]).toEqual([]);
  });

  it("never shows a variant a tooltip on its own metrics that says its cause (PR 31 review I2)", async () => {
    const { metricTerm } = await import("./metricTerms");
    const hits: string[] = [];
    for (const inc of INCIDENTS)
      for (const v of inc.variants)
        for (const m of v.scenario.metrics) {
          const found = metricTerm(m.label);
          if (!found) continue;
          const e = glossaryEntry(found.id);
          const text = `${e.term} ${e.definition}`.toLowerCase();
          for (const w of v.spoilers) if (text.includes(w.toLowerCase())) hits.push(`${v.scenario.id}: "${m.label}" → ${e.id} ~ "${w}"`);
        }
    expect(hits).toEqual([]);
  });

  it("never says in a certificate's definition that it runs out (the expired-cert cause)", () => {
    expect(glossaryEntry("tls-certificate").definition).not.toMatch(/end date|expire/i);
  });
});
