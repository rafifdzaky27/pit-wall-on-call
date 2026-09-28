import type { ScenarioDef, State } from "@pitwall/engine";

export type Surface = "chat" | "phone" | "cafe";

/** Surfaces the M1.5 desktop can show. The café arrives in M1.6. */
export const M15_SURFACES: readonly Surface[] = ["chat", "phone"];
/** From M1.6 the café shows the next table and the wall too (cold-open spec §12). */
export const M16_SURFACES: readonly Surface[] = ["chat", "phone", "cafe"];

export function surfaceOf(hotspotId: string): Surface | null {
  if (hotspotId.startsWith("laptop.slack.")) return "chat";
  if (hotspotId.startsWith("phone.")) return "phone";
  if (hotspotId.startsWith("table.") || hotspotId.startsWith("wall.")) return "cafe";
  return null;
}

export function reachableHotspots(scenario: ScenarioDef<State>, surfaces: readonly Surface[]): string[] {
  return Object.keys(scenario.coldOpen.hotspots).filter((id) => {
    const surface = surfaceOf(id);
    return surface !== null && surfaces.includes(surface);
  });
}

export function reachableClueCount(scenario: ScenarioDef<State>, surfaces: readonly Surface[]): number {
  return reachableHotspots(scenario, surfaces).filter((id) => scenario.coldOpen.hotspots[id]!.kind === "clue").length;
}
