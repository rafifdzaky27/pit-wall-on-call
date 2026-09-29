import type { ActionRecord, ScenarioDef, State } from "@pitwall/engine";
import type { DesktopContent } from "../desktop";

/** Where an incident comes from, as real on-call engineers meet it (M4 research, families A–K). */
export type Family = "deploys" | "capacity" | "dependencies" | "data" | "network" | "caching" | "queues" | "time" | "abuse" | "human" | "observability";

/** How each kind of player plays a variant, for the fairness harness (M4 spec N6). */
export interface Golden {
  /** Finds the cause and fixes it, quickly. */
  perfect: ActionRecord[];
  /** Hides the symptom first (a restart, a failover), and fixes it only later. */
  masking: ActionRecord[];
  /** Chases the loud red herring before the fix. */
  herring: ActionRecord[];
}

export interface IncidentVariant<S extends State = State> {
  /** "" for the first variant, whose scenario id is the incident's; otherwise a short slug. */
  key: string;
  scenario: ScenarioDef<S>;
  desktop: DesktopContent;
  golden: Golden;
  /**
   * Words that name this variant's cause ("slot", "certificate", "dead-letter"), lower case. The tools list
   * every action the player can take now, so a fix whose label or command says one of these must stay
   * unavailable until the player has found its target (PR 30 review I3).
   */
  spoilers: readonly string[];
}

/** One incident: a family of variants that share a cause chain but change its nouns and numbers (M4 spec N1). */
export interface Incident {
  id: string;
  title: string;
  family: Family;
  difficulty: 1 | 2 | 3 | 4 | 5;
  /**
   * The first date (YYYY-MM-DD, UTC) this incident can be a daily. Set it to a day after the deploy
   * that ships it: then adding an incident never changes a daily already picked (M4 PR A review 1).
   */
  from: string;
  variants: readonly IncidentVariant[];
}

export function defineIncident<S extends State>(incident: Omit<Incident, "variants"> & { variants: readonly IncidentVariant<S>[] }): Incident {
  const [first, ...rest] = incident.variants;
  if (!first) throw new Error(`${incident.id}: an incident needs at least one variant`);
  if (first.scenario.id !== incident.id) throw new Error(`${incident.id}: its first variant must have the incident's id, not ${first.scenario.id}`);
  for (const v of rest) {
    if (!v.key || v.scenario.id !== `${incident.id}:${v.key}`) throw new Error(`${incident.id}: variant ${v.key} must have id ${incident.id}:${v.key}, not ${v.scenario.id}`);
  }
  return incident as unknown as Incident;
}
