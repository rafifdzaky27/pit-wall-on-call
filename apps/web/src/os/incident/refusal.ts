import type { RejectReason } from "@pitwall/engine";

/** Why an action cannot run now, in plain words; null when it can (M2.5 spec §7). */
export function refusalText(reason: RejectReason | null): string | null {
  switch (reason) {
    case null:
      return null;
    case "not_acknowledged":
      return "Acknowledge the page first.";
    case "pending":
      return "Still waiting for their answer.";
    case "busy":
      return "Wait for the running action to finish.";
    case "unavailable":
      return "That's already done.";
    case "finished":
      return "The incident is over.";
    default:
      return "That can't be done right now.";
  }
}
