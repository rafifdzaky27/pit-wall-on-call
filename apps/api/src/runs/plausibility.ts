import { TICKS_PER_SECOND, type RunResult, type ScenarioDef, type State } from "@pitwall/engine";

/** A fix this soon after the page is not humanly possible (spec §8, item 7). */
export const PLAUSIBLE_FIX_TICKS = 2 * TICKS_PER_SECOND;

/** Implausible runs are stored flagged and left off the board until someone reviews them. */
export function isImplausible(scenario: ScenarioDef<State>, result: RunResult): boolean {
  if (result.outcome !== "resolved") return false;
  const paged = result.timeline.find((e) => e.kind === "page")?.tick ?? 0;
  return result.timeline.some((e) => e.kind === "action_start" && scenario.rootCauseActionIds.includes(e.actionId) && e.tick - paged < PLAUSIBLE_FIX_TICKS);
}
