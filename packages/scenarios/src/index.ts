import type { ScenarioDef, State } from "@pitwall/engine";
import { slowLeak } from "./slow-leak";

export { slowLeak };

export const SCENARIOS: readonly ScenarioDef<State>[] = [slowLeak];

export function getScenario(id: string): ScenarioDef<State> | undefined {
  return SCENARIOS.find((s) => s.id === id);
}
export * from "./desktop";
