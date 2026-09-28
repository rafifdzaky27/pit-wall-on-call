import type { MetricDef, State } from "@pitwall/engine";
import type { GlossaryId } from "../content/glossary";
import { formatMetric } from "../game/format";
import { Term } from "../os/Term";

/** Metric labels whose first word is a glossary term (M2.5 spec §4). */
const TERMS: Record<string, GlossaryId> = { "5xx": "5xx", p99: "p99", Pool: "connection-pool" };

function Label({ text }: { text: string }) {
  const [first, ...rest] = text.split(" ");
  const id = TERMS[first!];
  if (!id) return text;
  return (
    <>
      <Term id={id}>{first}</Term> {rest.join(" ")}
    </>
  );
}

const WIDTH = 120;
const HEIGHT = 40;
const WINDOW = 120;

function Sparkline({ values, max, warn, crit }: { values: number[]; max: number; warn?: number; crit?: number }) {
  const y = (v: number) => HEIGHT - (Math.max(0, Math.min(max, v)) / max) * HEIGHT;
  const step = WIDTH / (WINDOW - 1);
  const points = values.map((v, i) => `${WIDTH - (values.length - 1 - i) * step},${y(v)}`).join(" ");
  return (
    <svg className="spark" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" aria-hidden="true">
      {warn !== undefined && <line className="thr warn" x1={0} x2={WIDTH} y1={y(warn)} y2={y(warn)} vectorEffect="non-scaling-stroke" />}
      {crit !== undefined && <line className="thr crit" x1={0} x2={WIDTH} y1={y(crit)} y2={y(crit)} vectorEffect="non-scaling-stroke" />}
      {values.length > 1 && <polyline className="line" points={points} vectorEffect="non-scaling-stroke" />}
    </svg>
  );
}

export function MetricPanel({ metric, value, history }: { metric: MetricDef<State>; value: number; history: number[] }) {
  const level =
    metric.crit !== undefined && value >= metric.crit ? "crit" : metric.warn !== undefined && value >= metric.warn ? "warn" : "ok";
  return (
    <section className="panel metric" aria-label={`${metric.label} metric`}>
      <div className="ph">
        <h3>
          <Label text={metric.label} />
        </h3>
        {level !== "ok" && <span className={`tag ${level}`}>{level === "crit" ? "Crit" : "Warn"}</span>}
      </div>
      <div className="pb">
        <div className={`metric-value mono ${level}`}>
          {formatMetric(value)}
          <small>{metric.unit}</small>
        </div>
        <Sparkline values={history} max={metric.max} warn={metric.warn} crit={metric.crit} />
        <p className="hint">Last 2 minutes</p>
      </div>
    </section>
  );
}
