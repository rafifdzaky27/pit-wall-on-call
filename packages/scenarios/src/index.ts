import type { ScenarioDef, State } from "@pitwall/engine";
import { slowLeak } from "./slow-leak";
import { training } from "./training";

export { slowLeak, training };

export const SCENARIOS: readonly ScenarioDef<State>[] = [slowLeak, training];

export function getScenario(id: string): ScenarioDef<State> | undefined {
  return SCENARIOS.find((s) => s.id === id);
}
export * from "./desktop";
export { DUCK, DUCK_DONE, duckAction } from "./duck";
