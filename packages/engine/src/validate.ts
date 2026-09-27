import { ACK, INSPECT_PREFIX } from "./constants";
import type { ScenarioDef, State } from "./types";

export class ScenarioError extends Error {
  name = "ScenarioError";
}

/** Catches authoring mistakes before a scenario can produce a confusing run. */
export function validateScenario<S extends State>(sc: ScenarioDef<S>): void {
  const problems: string[] = [];
  const services = new Set<string>();
  for (const svc of sc.services) {
    if (services.has(svc.id)) problems.push(`duplicate service ${svc.id}`);
    services.add(svc.id);
  }
  const needService = (where: string, id: string | null) => {
    if (id !== null && !services.has(id)) problems.push(`${where} references unknown service ${id}`);
  };
  for (const e of sc.edges) {
    needService("edge", e.from);
    needService("edge", e.to);
  }
  for (const m of sc.metrics) needService(`metric ${m.id}`, m.serviceId);
  for (const a of sc.alerts) needService(`alert ${a.id}`, a.serviceId);
  for (const l of sc.logs) {
    needService(`log ${l.id}`, l.serviceId);
    if (!Number.isInteger(l.everyTicks) || l.everyTicks < 1) problems.push(`log ${l.id} everyTicks must be a positive integer`);
  }
  const actions = new Set<string>();
  for (const a of sc.actions) {
    if (actions.has(a.id)) problems.push(`duplicate action ${a.id}`);
    if (a.id === ACK || a.id.startsWith(INSPECT_PREFIX)) problems.push(`action id ${a.id} is reserved`);
    actions.add(a.id);
    needService(`action ${a.id}`, a.serviceId);
    if (!Number.isInteger(a.durationS) || a.durationS <= 0) problems.push(`action ${a.id} durationS must be a positive whole number`);
  }
  for (const id of sc.rootCauseActionIds) {
    if (!actions.has(id)) problems.push(`rootCauseActionIds has unknown action ${id}`);
  }
  if (sc.lessons.length === 0) problems.push("scenario needs at least one lesson");
  if (problems.length > 0) throw new ScenarioError(`${sc.id}: ${problems.join("; ")}`);
}
