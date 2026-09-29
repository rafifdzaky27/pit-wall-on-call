import type { DeployCard } from "@pitwall/scenarios";
import { fillWorld } from "@pitwall/world";
import { ActionButton } from "../../../console/ActionButton";
import { useIncident } from "../../incident/IncidentProvider";
import { visibleFor } from "../chat/unread";
import { actionsIn, outputsOf } from "./toolActions";
import { ToolIdle } from "./ToolIdle";
import { useToolFocus } from "./useToolFocus";
import "./tools.css";

/** Deploys: each service's version, its deploy history, and rollback and restart (M2.5 plan B4). */
export function DeploysApp() {
  const incident = useIncident();
  const { scenario, snapshot, world } = incident;
  const [current, choose] = useToolFocus("deploys");
  if (incident.phase === "idle" || incident.phase === "prepage") return <ToolIdle name="Deploys" />;

  // The deploy history is what Deploy Bot posted, newest first.
  const cards = visibleFor(incident)
    .filter((m): m is typeof m & { card: DeployCard } => m.card !== undefined)
    .sort((a, b) => (a.minutesAgo ?? 0) - (b.minutesAgo ?? 0));
  const history = (label: string) => cards.filter((m) => m.card.service === label);
  const services = scenario.services.filter((s) => actionsIn(scenario, "deploys", s.id).length > 0 || history(s.label).length > 0);
  const shown = current ? services.filter((s) => s.id === current) : services;

  return (
    <div className="tool deploys-app">
      <div className="tool-bar">
        <div className="tool-levels" role="group" aria-label="Services">
          <button type="button" className="chip" aria-pressed={current === null} onClick={() => choose(null)}>
            All services
          </button>
          {services.map((s) => (
            <button key={s.id} type="button" className="chip" aria-pressed={current === s.id} onClick={() => choose(s.id)}>
              {s.label}
            </button>
          ))}
        </div>
      </div>
      <div className="tool-scroll">
        {shown.map((s) => {
          const actions = actionsIn(scenario, "deploys", s.id);
          const outputs = outputsOf(scenario, incident.timeline, incident.logs, new Set(actions.map((a) => a.id)));
          const past = history(s.label);
          return (
            <section key={s.id} className="tool-card" aria-label={s.label}>
              <header className="tool-card-head">
                <h3>{s.label}</h3>
                <span className="mono muted">{snapshot.details[s.id]}</span>
              </header>
              {past.length > 0 && (
                <ol className="tool-history" aria-label="Deploy history">
                  {past.map((m) => (
                    <li key={m.id}>
                      <span className="tool-version mono">{m.card.version}</span>
                      <span>{m.card.changes}</span>
                      <span className="muted">
                        {world.colleagues[m.card.by]} · {m.minutesAgo !== undefined ? `${m.minutesAgo} min ago` : "just now"} · <span className="mono">{m.card.sha}</span>
                      </span>
                    </li>
                  ))}
                </ol>
              )}
              {actions.length > 0 && (
                <ul className="tool-actions tool-row">
                  {actions.map((a) => (
                    <li key={a.id}>
                      <ActionButton action={a} snapshot={snapshot} check={incident.check} onAction={incident.dispatch} />
                    </li>
                  ))}
                </ul>
              )}
              {outputs.length > 0 && (
                <ul className="tool-findings mono" aria-label="Findings">
                  {outputs.flatMap((o) => o.lines.map((l) => <li key={l.seq}>{fillWorld(l.text, world)}</li>))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
