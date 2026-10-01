import { describe, expect, it } from "vitest";
import { cliFirstWord, cliIsBalanced, normaliseCli } from "./kit/cli";
import { CLI_VOCABULARY, INCIDENTS } from "./registry";

/**
 * Hard mode's content rules (M6 spec, "Fairness and content rules"). While M6 content is being
 * written an incident with no `cli` at all is skipped; the integration step removes that escape.
 */
const variants = INCIDENTS.flatMap((i) => i.variants.map((v) => ({ incident: i.id, scenario: v.scenario, golden: v.golden })));
const authored = (s: (typeof variants)[number]["scenario"]) => s.actions.some((a) => a.cli !== undefined);

describe.each(variants)("hard-mode commands: $scenario.id", ({ scenario }) => {
  it.skipIf(!authored(scenario))("every action but a teammate question has a cli", () => {
    const missing = scenario.actions.filter((a) => !a.ask && !a.cli).map((a) => a.id);
    expect(missing).toEqual([]);
  });

  it.skipIf(!authored(scenario))("teammate questions have no cli (they stay in chat)", () => {
    expect(scenario.actions.filter((a) => a.ask && a.cli).map((a) => a.id)).toEqual([]);
  });

  it.skipIf(!authored(scenario))("each cli is unique, balanced, and starts with a vocabulary word", () => {
    const clis = scenario.actions.flatMap((a) => (a.cli ? [a.cli] : []));
    const normal = clis.map(normaliseCli);
    expect(new Set(normal).size).toBe(normal.length);
    for (const cli of clis) {
      expect(cliIsBalanced(cli), cli).toBe(true);
      expect(CLI_VOCABULARY, cli).toContain(cliFirstWord(cli));
    }
  });

  it.skipIf(!authored(scenario))("an action with a command (such as SQL) carries that text in its cli", () => {
    for (const a of scenario.actions) {
      if (a.command && a.cli) expect(normaliseCli(a.cli), a.id).toContain(normaliseCli(a.command).replace(/;$/, ""));
    }
  });
});
