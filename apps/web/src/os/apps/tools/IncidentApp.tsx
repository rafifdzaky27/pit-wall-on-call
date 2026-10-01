import type { ScenarioDef, State, TimelineEntry } from "@pitwall/engine";
import { useState, type FormEvent } from "react";
import { ActionButton } from "../../../console/ActionButton";
import { checklist } from "../../../game/checklist";
import { formatClock } from "../../../game/format";
import { useIncident } from "../../incident/IncidentProvider";
import { useTeamActions } from "../../incident/useTeamActions";
import { useOs } from "../../shell/OsContext";
import { Objective } from "../../shell/Objective";
import { statusLabel } from "../../shell/StatusChip";
import { PAGE_ACTION, STATUS_ACTION } from "../chat/commands";
import { HardNote } from "./HardNote";
import { actionsIn, offered } from "./toolActions";
import "./tools.css";

/** A timeline entry in words, or null for the ones nobody needs to read (a glance at the café). */
function describe(e: TimelineEntry, scenario: ScenarioDef<State>): string | null {
  const label = (id: string) => scenario.actions.find((a) => a.id === id)?.label ?? id;
  const alert = (id: string) => scenario.alerts.find((a) => a.id === id)?.title ?? id;
  switch (e.kind) {
    case "page":
      return `Paged: ${scenario.coldOpen.page.title}`;
    case "ack":
      return "Acknowledged";
    case "escalated":
      return "Escalated: nobody acknowledged in time";
    case "resolved":
      return "Resolved";
    case "dnf":
      return "Shift ended before a fix";
    case "action_start":
      return `Started: ${label(e.actionId)}`;
    case "action_done":
      return `Done: ${label(e.actionId)}`;
    case "alert_fired":
      return `Alert: ${alert(e.alertId)}`;
    case "alert_cleared":
      return `Cleared: ${alert(e.alertId)}`;
    case "inspect":
      return null;
  }
}

/** Incident: status, checklist, timeline, the status page and paging (M2.5 plan B4). */
export function IncidentApp() {
  const incident = useIncident();
  const { seenApps } = useOs();
  const team = useTeamActions();
  const { scenario, snapshot } = incident;
  const [text, setText] = useState("");
  const [note, setNote] = useState<string | null>(null);

  if (incident.phase === "idle" || incident.phase === "prepage") {
    return (
      <div className="app-pad">
        <span className="tag ok">No open incident</span>
        <p className="muted">When the pager goes off, the incident opens here: its status, a checklist, the timeline and the status page.</p>
      </div>
    );
  }

  const page = scenario.coldOpen.page;
  const { text: status, tone } = statusLabel(incident.phase, snapshot);
  const items = checklist(scenario, incident.timeline, snapshot, { browserOpened: seenApps.has("browser"), postmortemOpened: seenApps.has("postmortem") });
  const others = offered(actionsIn(scenario, "incident"), incident.offers).filter((a) => a.id !== STATUS_ACTION && a.id !== PAGE_ACTION);
  const entries = incident.timeline.flatMap((e) => {
    const line = describe(e, scenario);
    return line ? [{ tick: e.tick, line }] : [];
  });
  const hard = incident.difficulty === "hard";
  const statusDone = incident.timeline.some((e) => e.kind === "action_start" && e.actionId === STATUS_ACTION);

  const post = (e: FormEvent) => {
    e.preventDefault();
    setNote(team.postStatus(text.trim() || "We are investigating elevated errors."));
  };

  return (
    <div className="tool incident-app">
      <header className="inc-head">
        <span className="tag crit">{page.severity}</span>
        <h2>{page.title}</h2>
        <span className={tone ? `tag ${tone}` : "tag"}>{status}</span>
        <span className="spacer" />
        <span className="mono muted">{formatClock(snapshot.tick)}</span>
      </header>
      <div className="inc-grid">
        <div className="inc-objective">
          <Objective scenario={scenario} snapshot={snapshot} />
        </div>
        <section className="tool-card" aria-labelledby="inc-status-h">
          <h3 id="inc-status-h">Status page</h3>
          {hard ? (
            <HardNote />
          ) : (
            <>
              <form className="inc-compose" onSubmit={post}>
                <textarea
                  aria-label="Status page message"
                  placeholder="What customers see, in plain words: what is broken and that you are on it."
                  rows={3}
                  value={text}
                  disabled={statusDone}
                  onChange={(e) => setText(e.target.value)}
                />
                <button type="submit" className="btn primary" data-coach={`action:${STATUS_ACTION}`} disabled={incident.check(STATUS_ACTION) !== null}>
                  Post status update
                </button>
              </form>
              <h3>Team</h3>
              <ul className="tool-actions">
                <li>
                  <button type="button" className="btn" data-coach={`action:${PAGE_ACTION}`} disabled={incident.check(PAGE_ACTION) !== null} onClick={() => setNote(team.pageSecondary())}>
                    Page secondary on-call
                  </button>
                </li>
                {others.map((a) => (
                  <li key={a.id}>
                    <ActionButton action={a} snapshot={snapshot} check={incident.check} onAction={incident.dispatch} />
                  </li>
                ))}
              </ul>
              {note && (
                <p className="muted" role="status">
                  {note}
                </p>
              )}
            </>
          )}
        </section>
        <section className="tool-card" aria-labelledby="inc-check-h">
          <h3 id="inc-check-h">Checklist</h3>
          <ol className="inc-list" aria-label="Incident checklist">
            {items.map((item) => (
              <li key={item.id} className="inc-item">
                <span>
                  <b>{item.label}</b>
                  <span className="muted">{item.hint}</span>
                </span>
                <span className={item.done ? "tag ok" : "tag"}>{item.done ? "Done" : "To do"}</span>
              </li>
            ))}
          </ol>
        </section>
        <section className="tool-card" aria-labelledby="inc-time-h">
          <h3 id="inc-time-h">Timeline</h3>
          <ol className="inc-timeline" aria-label="Timeline">
            {entries.map((e, i) => (
              <li key={i}>
                <time className="mono muted">{formatClock(e.tick)}</time> {e.line}
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
