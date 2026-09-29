import type { MetricDef, State } from "@pitwall/engine";
import type { GlossaryId } from "../content/glossary";
import { formatMetric } from "../game/format";
import { Term } from "../os/Term";

/** The part of a metric label that is a glossary term (M2.5 spec §4, M4.5 N2). First match wins. */
const TERMS: readonly [RegExp, GlossaryId][] = [
  [/^5xx/i, "5xx"],
  [/^p99/i, "p99"],
  [/^Pool/, "connection-pool"],
  [/^Consumer lag/i, "consumer-lag"],
  [/^Replication lag/i, "replica-lag"],
  [/^Cache hit (rate|ratio)/i, "cache-hit-ratio"],
  [/^Hit (rate|ratio)/i, "cache-hit-ratio"],
  [/^WAL/, "wal"],
  [/^(Data|WAL) volume/i, "disk-volume"],
  [/^TLS/, "tls-certificate"],
];

function Label({ text }: { text: string }) {
  for (const [re, id] of TERMS) {
    const m = re.exec(text);
    if (m)
      return (
        <>
          <Term id={id}>{m[0]}</Term>
          {text.slice(m[0].length)}
        </>
      );
  }
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
