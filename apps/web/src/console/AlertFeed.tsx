import type { AlertState, ScenarioDef, State } from "@pitwall/engine";
import { formatClock } from "../game/format";
import { Term } from "../os/Term";

export function AlertFeed({ scenario, alerts }: { scenario: ScenarioDef<State>; alerts: AlertState[] }) {
  const rules = new Map(scenario.alerts.map((a) => [a.id, a]));
  const firing = alerts.filter((a) => a.clearedAtTick === null).sort((a, b) => b.firedAtTick - a.firedAtTick);
  const cleared = alerts.filter((a) => a.clearedAtTick !== null).sort((a, b) => b.clearedAtTick! - a.clearedAtTick!);
  return (
    <section className="panel" aria-labelledby="alerts-h">
      <div className="ph">
        <h2 id="alerts-h">Alerts</h2>
        {firing.length > 0 && <span className="tag crit">{firing.length} firing</span>}
      </div>
      <div className="pb" aria-live="polite">
        {firing.length === 0 && <p className="empty">No alerts firing.</p>}
        <ul className="alert-list">
          {[...firing, ...cleared].map((a) => {
            const rule = rules.get(a.alertId)!;
            const resolved = a.clearedAtTick !== null;
            return (
              <li key={`${a.alertId}-${a.firedAtTick}`} className={resolved ? "alert resolved" : "alert"}>
                <div className="alert-h">
                  <span className={`tag ${resolved ? "ok" : rule.severity}`}>{resolved ? "Resolved" : <Term id="alert-level">{rule.severity === "crit" ? "Crit" : "Warn"}</Term>}</span>
                  <b>{rule.title}</b>
                </div>
                <time className="mono">{formatClock(resolved ? a.clearedAtTick! : a.firedAtTick)}</time>
                <span className="alert-d">{rule.description}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
