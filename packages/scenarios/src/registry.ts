import type { ScenarioDef, State } from "@pitwall/engine";
import type { DesktopContent } from "./desktop";
import type { Incident } from "./kit/incident";
import { cacheStampedeIncident } from "./incidents/cache-stampede";
import { diskFullIncident } from "./incidents/disk-full";
import { expiredCertIncident } from "./incidents/expired-cert";
import { paymentProviderBlinksIncident } from "./incidents/payment-provider-blinks";
import { poisonPillIncident } from "./incidents/poison-pill";
import { regexCpuIncident } from "./incidents/regex-cpu";
import { replicaLagIncident } from "./incidents/replica-lag";
import { retryStormIncident } from "./incidents/retry-storm";
import { slowLeakIncident } from "./slow-leak.incident";
import { cliFirstWord } from "./kit/cli";
import { training } from "./training";
import { trainingDesktop } from "./training.desktop";

/** Every incident a shift or a daily can be (M4 spec N1). Training is apart (N8). */
export const INCIDENTS: readonly Incident[] = [
  slowLeakIncident,
  diskFullIncident,
  expiredCertIncident,
  paymentProviderBlinksIncident,
  retryStormIncident,
  regexCpuIncident,
  cacheStampedeIncident,
  poisonPillIncident,
  replicaLagIncident,
];

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

/**
 * Every command word any incident's `cli` starts with, sorted (M6 spec H6, H8). It is the same set
 * whatever the shift, so Tab completion and "did you mean" never hint at this incident's commands.
 */
export const CLI_VOCABULARY: readonly string[] = [
  ...new Set(INCIDENTS.flatMap((i) => i.variants.flatMap((v) => v.scenario.actions.flatMap((a) => (a.cli ? [cliFirstWord(a.cli)] : []))))),
].sort();
