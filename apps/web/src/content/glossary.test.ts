import { describe, expect, it } from "vitest";
import { GLOSSARY, glossaryEntry } from "./glossary";

// M2.5 spec §4: every term the spec lists, in plain language for people new to DevOps (decision Q4).
const SPEC_TERMS = [
  "Error budget",
  "5xx",
  "502",
  "p99",
  "Connection pool",
  "Idle in transaction",
  "Rollback",
  "Failover",
  "max_connections",
  "SEV2",
  "Ack",
  "On-call",
  "Secondary",
  "Mitigation versus fix",
  "Status page",
];

describe("glossary", () => {
  it("defines every term the spec lists", () => {
    expect(GLOSSARY.map((e) => e.term)).toEqual(SPEC_TERMS);
  });

  it("has unique ids and a short plain-language sentence or two for each term", () => {
    expect(new Set(GLOSSARY.map((e) => e.id)).size).toBe(GLOSSARY.length);
    for (const e of GLOSSARY) {
      expect(e.definition.length, e.term).toBeGreaterThan(40);
      expect(e.definition.length, e.term).toBeLessThan(260);
      expect(e.definition, e.term).toMatch(/^[A-Z0-9].*\.$/);
    }
  });

  it("looks an entry up by id", () => {
    expect(glossaryEntry("p99").term).toBe("p99");
    expect(glossaryEntry("error-budget").definition).toContain("fail");
  });
});
