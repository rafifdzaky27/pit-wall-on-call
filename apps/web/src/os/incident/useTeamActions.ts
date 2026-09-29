import type { Person } from "@pitwall/scenarios";
import { PAGE_ACTION, STATUS_ACTION } from "../apps/chat/commands";
import { useOs } from "../shell/OsContext";
import { useIncident } from "./IncidentProvider";
import { refusalText } from "./refusal";

/**
 * The actions that are also something you say: a status update, a page, a question. Chat and the
 * Incident app share them, so either posts the same message and runs the same engine action. Each
 * returns why it could not run, or null.
 */
export function useTeamActions() {
  const incident = useIncident();
  const { postChat } = useOs();
  const why = (actionId: string) => refusalText(incident.check(actionId));

  const postStatus = (text: string): string | null => {
    const no = why(STATUS_ACTION);
    if (no) return no;
    postChat("incidents", "you", `Status update: ${text}`);
    incident.dispatch(STATUS_ACTION);
    return null;
  };

  const pageSecondary = (): string | null => {
    const no = why(PAGE_ACTION);
    if (no) return no;
    postChat("dm:secondary", "you", "can you jump in? paging you on this one");
    incident.dispatch(PAGE_ACTION);
    return null;
  };

  /** A teammate question: your message goes to their DM, then they answer. */
  const ask = (actionId: string): string | null => {
    const def = incident.scenario.actions.find((a) => a.id === actionId);
    if (!def?.ask) return "That's not a question.";
    const no = why(actionId);
    if (no) return no;
    postChat(`dm:${def.ask.to as Person}`, "you", def.ask.prompt);
    incident.dispatch(actionId);
    return null;
  };

  return { postStatus, pageSecondary, ask, why };
}
