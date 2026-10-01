import { ACK, INSPECT_PREFIX, type ActionRecord } from "@pitwall/engine";
import { describe, expect, it } from "vitest";
import { normaliseCli } from "./kit/cli";
import { INCIDENTS } from "./registry";

/**
 * M6 workstream A2: for every variant of regex-cpu, cache-stampede, poison-pill and replica-lag, each
 * action a golden player takes (acknowledging and inspecting the cold open are not commands) is typed as its
 * `cli`, and that text matches exactly one action in the scenario: the same one.
 */
const MINE = ["regex-cpu", "cache-stampede", "poison-pill", "replica-lag"];
const variants = INCIDENTS.filter((i) => MINE.includes(i.id)).flatMap((i) => i.variants.map((v) => ({ id: v.scenario.id, scenario: v.scenario, golden: v.golden })));

describe.each(variants)("golden commands: $id", ({ scenario, golden }) => {
  const ids = [...new Set(Object.values(golden).flatMap((g) => (g as ActionRecord[]).map((a) => a.actionId)))].filter((id) => id !== ACK && !id.startsWith(INSPECT_PREFIX));

  it.each(ids)("%s is typed as a cli that matches only itself", (actionId) => {
    const action = scenario.actions.find((a) => a.id === actionId);
    expect(action, actionId).toBeDefined();
    expect(action?.cli, actionId).toBeTruthy();
    const typed = normaliseCli(action?.cli ?? "");
    const matches = scenario.actions.filter((a) => a.cli && normaliseCli(a.cli) === typed).map((a) => a.id);
    expect(matches).toEqual([actionId]);
  });
});
