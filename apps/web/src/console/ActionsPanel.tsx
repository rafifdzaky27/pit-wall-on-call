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
import { actionsIn, TOOL_LABEL, type ToolAppId } from "../os/apps/tools/toolActions";
import { ActionButton } from "./ActionButton";
import { HEALTH_LABEL } from "./ServiceMap";

const CATEGORY_LABEL: Record<ActionCategory, string> = {
  investigate: "Investigate",
  mitigate: "Mitigate",
  fix: "Fix",
  communicate: "Communicate",
};
const ORDER: ActionCategory[] = ["investigate", "mitigate", "fix", "communicate"];

/** Where Open in links go: a tool pre-filtered to a service, or the incident itself. */
export type OpenIn = (app: ToolAppId | "incident", serviceId: string | null) => void;

interface Props {
  scenario: ScenarioDef<State>;
  service: ServiceDef<State>;
  snapshot: Snapshot;
  check: (actionId: string) => RejectReason | null;
  onAction: (actionId: string) => void;
  onOpen?: OpenIn;
}

export function ActionsPanel({ scenario, service, snapshot, check, onAction, onOpen }: Props) {
  // Monitoring holds the dashboard checks; every other action lives in its tool (M2.5 plan B4).
  const local = actionsIn(scenario, "dashboards", service.id);
  const busy = snapshot.busy;
  const busyDef = busy ? scenario.actions.find((a) => a.id === busy.actionId) : undefined;
  const health = snapshot.health[service.id] ?? "ok";
  const tools = (["logs", "deploys", "db"] as const).filter((t) => t === "logs" || actionsIn(scenario, t, service.id).length > 0);

  const renderAction = (a: ActionDef<State>) => (
    <li key={a.id}>
      <ActionButton action={a} snapshot={snapshot} check={check} onAction={onAction} />
    </li>
  );

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
        {local.length === 0 && <p className="empty">No dashboard checks for this service.</p>}
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
      {onOpen && (
        <nav className="pf open-in" aria-label="Open in">
          <h3 className="group-h">Open in</h3>
          <ul>
            {tools.map((t) => (
              <li key={t}>
                <button type="button" className="btn" onClick={() => onOpen(t, service.id)}>
                  {TOOL_LABEL[t]}
                </button>
              </li>
            ))}
            <li>
              <button type="button" className="btn" onClick={() => onOpen("incident", null)}>
                Incident
              </button>
            </li>
          </ul>
        </nav>
      )}
    </section>
  );
}
