import {
  TICKS_PER_SECOND,
  type ActionCategory,
  type ActionDef,
  type RejectReason,
  type ScenarioDef,
  type ServiceDef,
  type Snapshot,
  type State,
} from "@pitwall/engine";
import { HEALTH_LABEL } from "./ServiceMap";

const CATEGORY_LABEL: Record<ActionCategory, string> = {
  investigate: "Investigate",
  mitigate: "Mitigate",
  fix: "Fix",
  communicate: "Communicate",
};
const ORDER: ActionCategory[] = ["investigate", "mitigate", "fix", "communicate"];

interface Props {
  scenario: ScenarioDef<State>;
  service: ServiceDef<State>;
  snapshot: Snapshot;
  check: (actionId: string) => RejectReason | null;
  onAction: (actionId: string) => void;
}

export function ActionsPanel({ scenario, service, snapshot, check, onAction }: Props) {
  const local = scenario.actions.filter((a) => a.serviceId === service.id);
  const global = scenario.actions.filter((a) => a.serviceId === null);
  const busy = snapshot.busy;
  const busyDef = busy ? scenario.actions.find((a) => a.id === busy.actionId) : undefined;
  const health = snapshot.health[service.id] ?? "ok";

  const renderAction = (a: ActionDef<State>) => {
    const running = busy?.actionId === a.id;
    const progress = running && busy ? (snapshot.tick - busy.startTick) / (busy.endTick - busy.startTick) : 0;
    return (
      <li key={a.id}>
        <button
          type="button"
          className={`btn action${running ? " running" : ""}`}
          data-coach={`action:${a.id}`}
          disabled={check(a.id) !== null}
          onClick={() => onAction(a.id)}
        >
          <span>{a.label}</span>
          <span className="action-d mono">{a.durationS} s</span>
          {running && <span className="action-progress" style={{ width: `${Math.round(progress * 100)}%` }} />}
        </button>
      </li>
    );
  };

  return (
    <section className="panel actions" aria-labelledby="actions-h">
      <div className="ph">
        <h2 id="actions-h">{service.label}</h2>
        <span className={`tag ${health}`}>{HEALTH_LABEL[health]}</span>
      </div>
      <div className="pb">
        {busy && busyDef && (
          <p className="busy" role="status">
            Running: {busyDef.label} · {Math.ceil((busy.endTick - snapshot.tick) / TICKS_PER_SECOND)} s left
          </p>
        )}
        {local.length === 0 && <p className="empty">No actions for this service.</p>}
        {ORDER.map((category) => {
          const items = local.filter((a) => a.category === category);
          if (items.length === 0) return null;
          return (
            <div key={category} className="action-group">
              <h3 className="group-h">{CATEGORY_LABEL[category]}</h3>
              <ul>{items.map(renderAction)}</ul>
            </div>
          );
        })}
      </div>
      <div className="pf">
        <h3 className="group-h">Global</h3>
        <ul>{global.map(renderAction)}</ul>
      </div>
    </section>
  );
}
