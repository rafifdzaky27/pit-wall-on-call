import type { ScenarioDef, Snapshot, State, TimelineEntry } from "@pitwall/engine";

export type ChecklistItemId = "ack" | "impact" | "hypothesis" | "mitigate" | "verify" | "communicate" | "close";

export interface ChecklistItem {
  id: ChecklistItemId;
  label: string;
  /** What the step means, never which action does it (M2.5 spec §4). */
  hint: string;
  done: boolean;
}

/** What the OS saw, which the timeline does not record. */
export interface ChecklistExtra {
  /** The player brought the Browser forward during the incident. */
  browserOpened: boolean;
  /** The postmortem was opened after the run. */
  postmortemOpened: boolean;
}

/** The action that posts to the public status page. */
export const STATUS_UPDATE = "global.status_update";

/**
 * The incident checklist, ticked from the timeline and the state (M2.5 spec §4). Modelled on
 * real incident response: acknowledge, size the impact, reason before acting, stop the bleeding,
 * verify, communicate, close. Pure, so a replay ticks the same items as the live run.
 */
export function checklist(scenario: ScenarioDef<State>, timeline: readonly TimelineEntry[], snapshot: Pick<Snapshot, "status">, extra: ChecklistExtra): ChecklistItem[] {
  const actions = new Map(scenario.actions.map((a) => [a.id, a]));
  const completed = timeline.flatMap((e) => (e.kind === "action_done" ? [actions.get(e.actionId)] : [])).filter((a) => a !== undefined);
  // The edge is where customers come in: a service nothing else calls.
  const edges = new Set(scenario.services.filter((s) => !scenario.edges.some((e) => e.to === s.id)).map((s) => s.id));
  const investigated = new Set(completed.filter((a) => a.category === "investigate" && a.serviceId !== null).map((a) => a.serviceId!));

  const items: [ChecklistItemId, string, string, boolean][] = [
    ["ack", "Acknowledge the page", "Take the page, so the pager stops and the team knows you are on it.", timeline.some((e) => e.kind === "ack")],
    ["impact", "Check the impact", "See what customers see: the site itself, or the errors at the front door.", extra.browserOpened || [...investigated].some((id) => edges.has(id))],
    ["hypothesis", "Form a hypothesis", "Investigate at least two services before you change anything.", investigated.size >= 2],
    ["mitigate", "Stop the bleeding", "Mitigate or fix, so fewer requests fail.", completed.some((a) => a.category === "mitigate" || a.category === "fix")],
    ["verify", "Verify", "The fix holds for 10 s, with no alerts.", snapshot.status === "holding" || snapshot.status === "resolved"],
    ["communicate", "Communicate", "Post a status update, so customers know you are on it.", completed.some((a) => a.id === STATUS_UPDATE)],
    ["close", "Close", "Read the postmortem: what happened, and what to do next time.", extra.postmortemOpened],
  ];
  return items.map(([id, label, hint, done]) => ({ id, label, hint, done }));
}
