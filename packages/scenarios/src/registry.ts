import type { ScenarioDef, State } from "@pitwall/engine";
import type { DesktopContent } from "./desktop";
import type { Incident } from "./kit/incident";
import { paymentProviderBlinksIncident } from "./incidents/payment-provider-blinks";
import { retryStormIncident } from "./incidents/retry-storm";
import { slowLeakIncident } from "./slow-leak.incident";
import { training } from "./training";
import { trainingDesktop } from "./training.desktop";

/** Every incident a shift or a daily can be (M4 spec N1). Training is apart (N8). */
export const INCIDENTS: readonly Incident[] = [slowLeakIncident, paymentProviderBlinksIncident, retryStormIncident];

export const SCENARIOS: readonly ScenarioDef<State>[] = [...INCIDENTS.flatMap((i) => i.variants.map((v) => v.scenario)), training];

const DESKTOP = new Map<string, DesktopContent>([...INCIDENTS.flatMap((i) => i.variants.map((v) => [v.scenario.id, v.desktop] as const)), [training.id, trainingDesktop]]);

export function getScenario(id: string): ScenarioDef<State> | undefined {
  return SCENARIOS.find((s) => s.id === id);
}

export function desktopFor(scenarioId: string): DesktopContent {
  const content = DESKTOP.get(scenarioId);
  if (!content) throw new Error(`no desktop content for scenario ${scenarioId}`);
  return content;
}
