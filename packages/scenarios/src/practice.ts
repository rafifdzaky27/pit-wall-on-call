import type { ScenarioDef, State } from "@pitwall/engine";
import type { Incident } from "./kit/incident";
import { INCIDENTS } from "./registry";

/** A stable 32-bit mix of the seed (murmur3's finaliser), so nearby seeds land far apart. */
function mix(seed: number, salt: number): number {
  let h = (seed ^ salt) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/**
 * The incident a practice shift plays (M4 PR B): an incident by the seed, then one of its variants,
 * so an incident with many variants is not favoured. Training is never picked.
 */
export function practiceFor(seed: number, catalogue: readonly Incident[] = INCIDENTS): ScenarioDef<State> {
  const incident = catalogue[mix(seed, 0x9e3779b9) % catalogue.length]!;
  return incident.variants[mix(seed, 0x7f4a7c15) % incident.variants.length]!.scenario;
}
