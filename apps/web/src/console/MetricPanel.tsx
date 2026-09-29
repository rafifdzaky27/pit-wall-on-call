import type { MetricDef, State } from "@pitwall/engine";
import { metricTerm } from "../content/metricTerms";
import { formatMetric } from "../game/format";
import { Term } from "../os/Term";

function Label({ text }: { text: string }) {
  const found = metricTerm(text);
  if (found)
    return (
      <>
        <Term id={found.id}>{found.match}</Term>
        {text.slice(found.match.length)}
      </>
    );
  return text;
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
        {level !== "ok" && <span className={`tag ${level}`}><Term id="alert-level">{level === "crit" ? "Crit" : "Warn"}</Term></span>}
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
