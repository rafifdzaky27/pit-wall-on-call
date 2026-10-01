import { ACK, INSPECT_PREFIX, Run, type ScenarioDef, type State } from "@pitwall/engine";
import { describe, expect, it } from "vitest";
import { cliFor } from "./kit/cli";
import { canonicalCli, CLI_HELP, matchCli } from "./kit/match";
import { INCIDENTS } from "./registry";

/**
 * Hard mode is winnable by reading the game (M6 review C1): a fix or mitigation is matched on its
 * command word and its `cliKeys`, and every key must be something the player can learn on this shift
 * (the desktop, the map, metrics, alerts, logs, what the checks reveal) or from `help`. A check
 * (investigate) is listed by `runbook`, so it is matched on its whole command.
 */
const variants = INCIDENTS.flatMap((i) => i.variants.map((v) => ({ id: v.scenario.id, v })));
const SEEDS = [1, 2, 3];

/** Everything the player can read on this shift, lowercased: never an action's own cli, command or label. */
function knowledge(scenario: ScenarioDef<State>, desktop: unknown, seed: number): string {
  const parts: string[] = [JSON.stringify(desktop), CLI_HELP.join("\n")];
  parts.push(JSON.stringify({ ...scenario, actions: [] }));
  const run = new Run(scenario, seed);
  run.step();
  run.dispatch(ACK);
  const checks = scenario.actions.filter((a) => a.category === "investigate" && a.reveals);
  for (let t = 0; t < 900 && run.outcome === "running"; t++) {
    if (t % 150 === 0) for (const a of checks) parts.push(...a.reveals!(run.state()));
    run.step();
  }
  parts.push(...run.logs.map((l) => l.text));
  return parts.join("\n").toLowerCase();
}

const WORD = "a-z0-9_./-";
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** A key is learnable when it appears in what the player can read, as a whole word. */
const appears = (text: string, key: string) => new RegExp(`(^|[^${WORD}])${escape(key)}($|[^${WORD}])`).test(text);

describe.each(variants)("hard mode is learnable: $id", ({ v }) => {
  const { scenario } = v;
  const services = scenario.services.map((s) => ({ id: s.id, label: s.label }));

  it("every fix and mitigation has keys (a check is matched whole)", () => {
    const missing = scenario.actions.filter((a) => a.cli && a.category !== "investigate" && !(a.cliKeys && a.cliKeys.length > 0)).map((a) => a.id);
    expect(missing).toEqual([]);
  });

  it.each(SEEDS)("every key can be learned in the game or from help (seed %i)", (seed) => {
    const text = knowledge(scenario, v.desktop, seed);
    const state = new Run(scenario, seed).state();
    const unknown: string[] = [];
    for (const a of scenario.actions) {
      for (const key of a.cliKeys ?? []) {
        const filled = (cliFor({ cli: key, cliVars: a.cliVars }, state) ?? key).toLowerCase();
        // A service named after deployment/ or app= is on the map (either name works: canonicalCli).
        const service = filled.match(/^(?:deployment\/|app=)(.+)$/)?.[1];
        const ok = service ? services.some((s) => `deployment/${s.id.toLowerCase()}` === canonicalCli(`deployment/${service}`, services)) : appears(text, filled);
        if (!ok) unknown.push(`${a.id}: "${filled}"`);
      }
    }
    expect(unknown).toEqual([]);
  });

  it.each(SEEDS)("each action's own command means that action and no other (seed %i)", (seed) => {
    const state = new Run(scenario, seed).state();
    for (const a of scenario.actions) {
      if (!a.cli) continue;
      const typed = cliFor(a, state)!;
      expect(matchCli(scenario.actions, typed, state, services)?.id, `${a.id}: ${typed}`).toBe(a.id);
    }
  });

  it("every golden action can be typed", () => {
    for (const player of ["perfect", "masking", "herring"] as const) {
      for (const r of v.golden[player]) {
        if (r.actionId === ACK || r.actionId.startsWith(INSPECT_PREFIX)) continue;
        const a = scenario.actions.find((x) => x.id === r.actionId);
        expect(a?.cli ?? (a?.ask ? "ask" : undefined), `${player}: ${r.actionId}`).toBeTruthy();
      }
    }
  });
});
