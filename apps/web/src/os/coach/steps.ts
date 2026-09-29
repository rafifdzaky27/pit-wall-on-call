import type { TimelineEntry } from "@pitwall/engine";
import type { IncidentApi } from "../incident/IncidentProvider";

export interface CoachStep {
  id: string;
  text: string;
  /** What Show me outlines: the first visible match wins. */
  target: string;
  done(incident: IncidentApi): boolean;
}

const started = (timeline: readonly TimelineEntry[], actionId: string) => timeline.some((e) => e.kind === "action_start" && e.actionId === actionId);
const finished = (timeline: readonly TimelineEntry[], actionId: string) => timeline.some((e) => e.kind === "action_done" && e.actionId === actionId);

/**
 * The training shift's coach (M2.5 spec §5): each step names what to do and where, and is done by
 * what the player actually did in the run, never by clicking "next".
 */
export const TRAINING_STEPS: readonly CoachStep[] = [
  {
    id: "wait",
    text: "Nothing is broken yet. Look around the café, or skip to the page.",
    target: '[data-coach="skip"]',
    done: (i) => i.phase !== "prepage",
  },
  {
    id: "ack",
    text: "The pager is ringing. Acknowledge it: press A, or use Acknowledge.",
    target: '[data-coach="ack"]',
    done: (i) => i.snapshot.acked,
  },
  {
    id: "logs",
    text: "Select shop-api on the service map (it is red), then read its logs.",
    target: '[data-coach="action:api.logs"], [data-coach="node:api"]',
    done: (i) => finished(i.timeline, "api.logs"),
  },
  {
    id: "config",
    text: "Redis is fast, but the api gives up after 5 ms. Something changed: check the config history.",
    target: '[data-coach="action:api.config"]',
    done: (i) => finished(i.timeline, "api.config"),
  },
  {
    id: "status",
    text: "Before you fix it, post a status update so customers know you're on it.",
    target: '[data-coach="action:global.status_update"]',
    done: (i) => finished(i.timeline, "global.status_update"),
  },
  {
    id: "rollback",
    text: "Now roll the config back to v11.",
    target: '[data-coach="action:api.config_rollback"]',
    done: (i) => started(i.timeline, "api.config_rollback"),
  },
  {
    id: "hold",
    text: "Watch the fix hold for 10 seconds. The status in the top bar counts it down.",
    target: '[aria-label^="Incident status"]',
    done: (i) => i.phase === "ended",
  },
  {
    id: "report",
    text: "That's the whole loop. Read your shift report.",
    target: '[aria-label="Shift report"]',
    done: () => false,
  },
];

/** Once the run is over, only the report is left, whatever was skipped (M2.5 review I3). */
export function currentStep(incident: IncidentApi): CoachStep | null {
  if (incident.phase === "ended") return TRAINING_STEPS.at(-1)!;
  return TRAINING_STEPS.find((s) => !s.done(incident)) ?? null;
}
