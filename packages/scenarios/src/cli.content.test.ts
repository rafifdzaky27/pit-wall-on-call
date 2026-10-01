import { Run } from "@pitwall/engine";
import { describe, expect, it } from "vitest";
import { cliFirstWord, cliFor, cliIsBalanced, cliPlaceholders, normaliseCli } from "./kit/cli";
import { CLI_VOCABULARY, INCIDENTS } from "./registry";

/** Hard mode's content rules (M6 spec, "Fairness and content rules"). */
const variants = INCIDENTS.flatMap((i) => i.variants.map((v) => ({ incident: i.id, scenario: v.scenario, golden: v.golden })));

describe.each(variants)("hard-mode commands: $scenario.id", ({ scenario }) => {
  it("every action but a teammate question has a cli", () => {
    const missing = scenario.actions.filter((a) => !a.ask && !a.cli).map((a) => a.id);
    expect(missing).toEqual([]);
  });

  it("teammate questions have no cli (they stay in chat)", () => {
    expect(scenario.actions.filter((a) => a.ask && a.cli).map((a) => a.id)).toEqual([]);
  });

  it("each cli is unique, balanced, and starts with a vocabulary word", () => {
    const clis = scenario.actions.flatMap((a) => (a.cli ? [a.cli] : []));
    const normal = clis.map(normaliseCli);
    expect(new Set(normal).size).toBe(normal.length);
    for (const cli of clis) {
      expect(cliIsBalanced(cli), cli).toBe(true);
      expect(CLI_VOCABULARY, cli).toContain(cliFirstWord(cli));
    }
  });

  it("an action with a fixed command (such as SQL) carries each of its lines in its cli", () => {
    for (const a of scenario.actions) {
      if (!a.command || !a.cli || a.cliVars) continue;
      for (const line of a.command.split(/\r?\n/).filter((l) => l.trim() !== "")) {
        expect(normaliseCli(a.cli), a.id).toContain(normaliseCli(line).replace(/;$/, ""));
      }
    }
  });

  it("per-run placeholders are all filled from the run's state, and no cli keeps a <placeholder>", () => {
    for (const seed of [1, 2, 3]) {
      const state = new Run(scenario, seed).state();
      for (const a of scenario.actions) {
        if (!a.cli) continue;
        const names = cliPlaceholders(a.cli);
        if (names.length > 0) expect(a.cliVars, `${a.id} has {placeholders} but no cliVars`).toBeDefined();
        const resolved = cliFor(a, state)!;
        expect(cliPlaceholders(resolved), a.id).toEqual([]);
        expect(resolved, a.id).not.toMatch(/<[a-z][^>]*>/i);
      }
    }
  });
});
