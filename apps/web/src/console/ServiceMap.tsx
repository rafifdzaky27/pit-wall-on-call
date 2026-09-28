import type { Health, ScenarioDef, State } from "@pitwall/engine";

export const HEALTH_LABEL: Record<Health, string> = { ok: "Healthy", warn: "Degraded", crit: "Critical" };

interface Props {
  scenario: ScenarioDef<State>;
  health: Record<string, Health>;
  details: Record<string, string>;
  selected: string;
  onSelect: (serviceId: string) => void;
}

/**
 * Service positions are percentages of an inset box, half a node in from every side, so each
 * node stays whole at any panel size and each edge ends at a node's centre (polish spec S23).
 */
export function ServiceMap({ scenario, health, details, selected, onSelect }: Props) {
  const byId = new Map(scenario.services.map((s) => [s.id, s]));
  return (
    <section className="panel map-panel" aria-labelledby="map-h">
      <div className="ph">
        <h2 id="map-h">Service map</h2>
        <span className="hint">Select a service or press 1–{scenario.services.length}</span>
      </div>
      <div className="map">
        <svg className="map-edges" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {scenario.edges.map((e) => {
            const a = byId.get(e.from)!;
            const b = byId.get(e.to)!;
            const hot = health[e.to] === "crit";
            return <line key={`${e.from}-${e.to}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={hot ? "edge hot" : "edge"} vectorEffect="non-scaling-stroke" />;
          })}
        </svg>
        <div className="map-nodes">
          {scenario.services.map((svc, i) => {
            const h = health[svc.id] ?? "ok";
            const isSelected = svc.id === selected;
            return (
              <button
                key={svc.id}
                type="button"
                className={`node ${h}${isSelected ? " selected" : ""}`}
                style={{ left: `${svc.x}%`, top: `${svc.y}%` }}
                aria-pressed={isSelected}
                onClick={() => onSelect(svc.id)}
              >
                <span className="node-top">
                  <span className="node-name">{svc.label}</span>
                  <span className={`node-health ${h}`}>{HEALTH_LABEL[h]}</span>
                </span>
                <span className="node-detail mono">{details[svc.id]}</span>
                <kbd className="node-key" aria-hidden="true">
                  {i + 1}
                </kbd>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
