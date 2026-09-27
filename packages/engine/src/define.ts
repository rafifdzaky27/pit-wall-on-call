import type { ScenarioDef, State } from "./types";

/** Identity helper: gives scenario authors type checking and inference for their state. */
export function defineScenario<S extends State>(def: ScenarioDef<S>): ScenarioDef<S> {
  return def;
}
