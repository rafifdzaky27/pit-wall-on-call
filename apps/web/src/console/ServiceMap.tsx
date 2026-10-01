import type { Health, ScenarioDef, State } from "@pitwall/engine";
import { Term } from "../os/Term";

export const HEALTH_LABEL: Record<Health, string> = { ok: "Healthy", warn: "Degraded", crit: "Critical" };

/** What each health level means for customers (M4.5 N2). Nodes say Healthy or Degraded; the legend pairs them with OK and Warn. */
const LEGEND: readonly { level: Health; name: string; meaning: string }[] = [
  { level: "ok", name: "OK", meaning: "healthy" },
  { level: "warn", name: "Warn", meaning: "degraded, watch it" },
  { level: "crit", name: "Critical", meaning: "customers feel it" },
];

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
      {/* One header row holds the legend and the count, so the map keeps its height on short screens (layout.spec). */}
      <div className="ph map-ph">
        <h2 id="map-h">Service map</h2>
        <ul className="map-legend" aria-label="Legend">
          {LEGEND.map((l) => (
            <li key={l.level}>
              <span className={`legend-dot ${l.level}`} aria-hidden="true" />
              {/* The one place Warn and Critical are explained, so the Crit and Warn tags add no tab stops of their own (M5 C5). */}
              <b className={`node-health ${l.level}`}>{l.level === "warn" ? <Term id="alert-level">{l.name}</Term> : l.name}</b>
              <span className="muted">{l.meaning}</span>
            </li>
          ))}
        </ul>
        <span className="hint">
          {scenario.services.length} services · click one or press 1–{scenario.services.length}
        </span>
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
                aria-label={`${svc.label}, ${HEALTH_LABEL[h]}. ${details[svc.id]}. Show its metrics and checks`}
                data-coach={`node:${svc.id}`}
                onClick={() => onSelect(svc.id)}
              >
                <span className="node-name">{svc.label}</span>
                <span className="node-sub" title={details[svc.id]}>
                  <span className={`node-health ${h}`}>{HEALTH_LABEL[h]}</span>
                  <span className="node-detail mono">{details[svc.id]}</span>
                </span>
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
