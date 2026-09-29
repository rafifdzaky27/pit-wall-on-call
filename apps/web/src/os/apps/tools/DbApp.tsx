import { fillWorld } from "@pitwall/world";
import { useLayoutEffect, useRef } from "react";
import { ActionButton } from "../../../console/ActionButton";
import { useIncident } from "../../incident/IncidentProvider";
import { actionsIn, offered, outputsOf } from "./toolActions";
import { ToolIdle } from "./ToolIdle";
import "./tools.css";

/** DB console: the database actions as the commands they stand for, and their output (M2.5 plan B4). */
export function DbApp() {
  const incident = useIncident();
  const { scenario, snapshot, world } = incident;
  const logRef = useRef<HTMLDivElement>(null);
  const all = actionsIn(scenario, "db");
  const actions = offered(all, incident.offers);
  // Every command that ran stays in the session, even once its button is gone.
  const outputs = outputsOf(scenario, incident.timeline, incident.logs, new Set(all.map((a) => a.id)));
  const running = actions.find((a) => snapshot.busy?.actionId === a.id || snapshot.pending.some((p) => p.actionId === a.id));
  useLayoutEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [outputs.length, running?.id]);

  if (incident.phase === "idle" || incident.phase === "prepage") return <ToolIdle name="DB console" />;
  if (all.length === 0) {
    return (
      <div className="app-pad">
        <p className="muted">No database in this incident.</p>
      </div>
    );
  }
  const db = scenario.services.find((s) => s.id === all[0]!.serviceId);
  const command = (a: (typeof actions)[number]) => a.command ?? `-- ${a.label}`;

  return (
    <div className="tool db-app">
      <div className="tool-bar">
        <span className="mono">psql · {db?.label ?? "database"}</span>
        <span className="mono muted">{db ? snapshot.details[db.id] : ""}</span>
      </div>
      <div className="tool-body">
        <aside className="tool-side">
          <h3 className="group-h">Commands</h3>
          <ul className="tool-actions">
            {actions.map((a) => (
              <li key={a.id}>
                <ActionButton action={a} snapshot={snapshot} check={incident.check} onAction={incident.dispatch} className="db-cmd">
                  <span className="db-cmd-text">
                    <code className="mono">{command(a)}</code>
                    <span className="muted">{a.label}</span>
                  </span>
                </ActionButton>
              </li>
            ))}
          </ul>
        </aside>
        <div ref={logRef} className="db-term mono" role="log" aria-label="psql session">
          <p className="muted">psql (17.2) · type a command on the left</p>
          {outputs.map((o, i) => (
            <div key={i} className="db-entry">
              <p>
                <span className="db-prompt">pitwall=#</span> {command(o.action)}
              </p>
              {o.lines.map((l) => (
                <p key={l.seq} className="db-out">
                  {fillWorld(l.text, world)}
                </p>
              ))}
            </div>
          ))}
          {running && (
            <p>
              <span className="db-prompt">pitwall=#</span> {command(running)} <span className="muted">running…</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
