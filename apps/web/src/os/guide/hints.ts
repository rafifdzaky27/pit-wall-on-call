import type { Milestone } from "./milestones";

export interface Hint {
  title: string;
  body: string;
  /** Where the primary action goes. */
  open: "monitoring" | "logs" | "deploys";
  cta: string;
}

/**
 * The hint for the next place to look. Generic text plus the label of the service that is critical
 * now, never the cause, the fix or a spoiler word (M4.5 spec N3, M4 spec N4). Teammates' chat keeps
 * its own voice: the guide only says to read it and weigh it.
 */
export function hintFor(next: Milestone, label: string | null, spoilers: readonly string[] = []): Hint | null {
  // A service can be named after the cause; then the map itself says which one is red.
  const criticalLabel = label !== null && !spoilers.some((w) => label.toLowerCase().includes(w.toLowerCase())) ? label : null;
  switch (next) {
    case "monitoring":
      return {
        title: "Where to look",
        body: "Monitoring has the map of every service. Open it and look for the red one: that is where customers' errors come from.",
        open: "monitoring",
        cta: "Open Monitoring",
      };
    case "service":
      return {
        title: "Where to look",
        body: criticalLabel
          ? `The red service on the map, ${criticalLabel}, is where customers' errors come from. Click it to see its metrics and what you can do there.`
          : "Click the red service on the map to see its metrics and what you can do there.",
        open: "monitoring",
        cta: "Open Monitoring",
      };
    case "evidence":
      return { title: "Where to look", body: "Logs show what the failing service says about itself. Open Logs, or run a check from the Actions panel.", open: "logs", cta: "Open Logs" };
    case "changes":
      return { title: "Where to look", body: "Something changed? Deploys and #deploys show what shipped today. Teammates post there; weigh what they say.", open: "deploys", cta: "Open Deploys" };
    case "fix":
      return {
        title: "Where to look",
        body: "When the evidence points somewhere, act on it from the Actions panel of the selected service. Ease the customers' pain first, then fix what caused it.",
        open: "monitoring",
        cta: "Open Monitoring",
      };
    case "acked":
      return null;
  }
}
