import type { ActionDef, State } from "@pitwall/engine";

export const DUCK = "duck";
export const DUCK_DONE = "The duck has nothing more to add.";

/**
 * Rubber-duck debugging as the hint system (M2.5 spec §9): 30 s of incident time for the next
 * question on the scenario's list, in order. It asks; it never names the fix.
 */
export function duckAction<S extends State & { ducks: number }>(hints: readonly string[]): ActionDef<S> {
  return {
    id: DUCK,
    label: "Explain it to the duck",
    serviceId: null,
    category: "investigate",
    durationS: 30,
    verdict: "useful",
    effect: (s) => ({ ...s, ducks: s.ducks + 1 }),
    reveals: (s) => [`rubber duck: "${hints[s.ducks] ?? DUCK_DONE}"`],
  };
}
