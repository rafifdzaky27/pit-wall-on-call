import { ActionRejected, Run } from "./run";
import type { ActionRecord, RunResult, ScenarioDef, State } from "./types";

/**
 * Re-runs an action log from scratch. The server trusts only this (spec §4): an action the
 * live client could not have taken at its tick throws ActionRejected (HTTP 422 in M2).
 * Ticks must be non-decreasing integers; several actions may share a tick.
 */
export function replay<S extends State>(scenario: ScenarioDef<S>, seed: number, actions: readonly ActionRecord[]): RunResult {
  const run = new Run(scenario, seed);
  let i = 0;
  while (run.outcome === "running") {
    for (let next = actions[i]; next && next.tick <= run.tick; next = actions[i]) {
      if (next.tick !== run.tick) throw new ActionRejected(next.actionId, next.tick, "out_of_order");
      run.dispatch(next.actionId);
      i++;
    }
    run.step();
  }
  const leftover = actions[i];
  if (leftover) throw new ActionRejected(leftover.actionId, leftover.tick, "finished");
  return run.result();
}
