import { defineScenario, type HotspotDef, type Rng, type ScenarioDef } from "@pitwall/engine";
import { duckAction } from "../../duck";

/** What loads the primary, and which page reads from the replica: what changes between the variants (M4 research D1). */
export interface Variant {
  /** "" for the first variant. */
  key: string;
  title: string;
  summary: string;
  symptom: { kind: string; surface: string };
  page: { severity: string; title: string; body: string };
  /** Service labels on the map. */
  labels: { edge: string; api: string; cache: string; primary: string; replica: string; batch: string };
  apiVersion: string;
  /** The gateway and API lines the customer symptom leaves. */
  edgeLine: (r: Rng) => string;
  apiLine: (r: Rng) => string;
  apiOk: (r: Rng) => string;
  /** What the batch service logs while it runs, and how the map describes it. */
  batchLine: (r: Rng) => string;
  batchDetail: string;
  /** The console commands (static). */
  findCommand: string;
  findReveal: (pid: number) => string;
  stopLabel: string;
  stopCommand: string;
  stopReveal: (pid: number) => string;
  /** The innocent recent deploy. */
  deployReveal: string;
  asks: { deployer: string; infra: string; support: string; secondary: string };
  hotspots: Record<string, HotspotDef>;
  lessons: { dnf: string; flush: string; failover: string; route: string; default: string };
  hints: string[];
}

type ReplicaLag = {
  /** Replica lag, in tenths of a second. */
  lag: number;
  /** Tenths of a second the lag gains per tick while the job runs. */
  growth: number;
  /** 1 while the long-running job holds the primary. */
  job: number;
  /** Ticks left in which the flushed cache hides the stale reads. */
  relief: number;
  /** Ticks left in which a failover has parked the job on the new primary. */
  quiet: number;
  /** 1 once the player has seen the long-running statement. */
  found: number;
  /** The session pid of the job. */
  pid: number;
  /** 1 once reads are routed to the primary. */
  routed: number;
  /** How far the primary is saturated by carrying the reads too, while routed. */
  sat: number;
  flushes: number;
  failovers: number;
  statusPosted: number;
  ducks: number;
};

const lagS = (s: ReplicaLag): number => Math.floor(s.lag / 10);
const errorRateBp = (s: ReplicaLag): number => {
  if (s.relief > 0) return 0;
  if (s.routed === 1) return Math.min(3000, Math.floor(s.sat / 2));
  const l = lagS(s);
  return l < 30 ? 0 : Math.min(3500, 200 + l * 8);
};
const jitter = (rng: Rng, spread: number) => (rng.next() - 0.5) * spread;

export function replicaLag(v: Variant): ScenarioDef<ReplicaLag> {
  const id = v.key ? `replica-lag:${v.key}` : "replica-lag";
  return defineScenario<ReplicaLag>({
    id,
    title: v.title,
    summary: v.summary,
    difficulty: "hard",
    timeLimitS: 540,
    parBp: 180,
    slo: { availability: 99.9, budgetRequests: 5000 },
    trafficPerTick: 2,

    services: [
      { id: "edge", label: v.labels.edge, x: 8, y: 50, detail: () => "nginx · 2 nodes" },
      { id: "api", label: v.labels.api, x: 34, y: 50, detail: () => `${v.apiVersion} · 3 pods` },
      { id: "cache", label: v.labels.cache, x: 34, y: 14, detail: () => "redis · 2 nodes" },
      { id: "primary", label: v.labels.primary, x: 66, y: 22, detail: (s) => (s.failovers ? "primary · promoted" : "primary · 16 vCPU") },
      { id: "replica", label: v.labels.replica, x: 66, y: 78, detail: (s) => `read replica · ${lagS(s)} s behind` },
      { id: "batch", label: v.labels.batch, x: 92, y: 22, detail: (s) => (s.job ? v.batchDetail : "idle") },
    ],
    edges: [
      { from: "edge", to: "api" },
      { from: "api", to: "cache" },
      { from: "api", to: "replica" },
      { from: "api", to: "primary" },
      { from: "primary", to: "replica" },
      { from: "batch", to: "primary" },
    ],

    setup: (rng) => ({
      lag: 400 + rng.int(150),
      growth: 3 + rng.int(3),
      job: 1,
      relief: 0,
      quiet: 0,
      found: 0,
      pid: 20_000 + rng.int(9000),
      routed: 0,
      sat: 0,
      flushes: 0,
      failovers: 0,
      statusPosted: 0,
      ducks: 0,
    }),
    dynamics: (s) => {
      const relief = Math.max(0, s.relief - 1);
      const sat = s.routed && s.job ? s.sat + 4 : s.sat;
      if (s.job === 0) return { ...s, relief, sat, lag: Math.max(0, s.lag - 60) };
      if (s.quiet > 0) return { ...s, relief, sat, quiet: s.quiet - 1, lag: Math.max(0, s.lag - 60) };
      return { ...s, relief, sat, lag: s.lag + s.growth };
    },
    errorRateBp,
    health: (s) => {
      const err = errorRateBp(s);
      const l = lagS(s);
      return {
        edge: err >= 1000 ? "crit" : err >= 100 ? "warn" : "ok",
        api: err >= 1000 ? "crit" : err >= 100 ? "warn" : "ok",
        cache: "ok",
        primary: s.routed && s.sat >= 200 ? "crit" : s.job ? "warn" : "ok",
        replica: l >= 60 ? "crit" : l >= 15 ? "warn" : "ok",
        batch: "ok",
      };
    },
    mitigated: (s) => s.job === 1 && s.flushes + s.failovers + s.routed > 0,
    resolvedWhen: (s) => s.job === 0 && lagS(s) < 10,

    metrics: [
      { id: "edge.rps", serviceId: "edge", label: "Requests", unit: "req/s", max: 40, value: (_s, n) => 20 + jitter(n, 3) },
      { id: "edge.err", serviceId: "edge", label: "5xx rate", unit: "%", max: 50, warn: 1, crit: 2, value: (s, n) => Math.max(0, errorRateBp(s) / 100 + (errorRateBp(s) ? jitter(n, 0.5) : 0)) },
      { id: "api.p99", serviceId: "api", label: "p99 latency", unit: "ms", max: 3000, warn: 800, crit: 1500, value: (s, n) => Math.max(0, 140 + Math.min(1200, errorRateBp(s) / 3) + (s.routed ? Math.min(1500, s.sat) : 0) + jitter(n, 30)) },
      { id: "cache.hit", serviceId: "cache", label: "Cache hit rate", unit: "%", max: 100, value: (s, n) => (s.relief > 0 ? 40 : 95) + jitter(n, 2) },
      { id: "primary.cpu", serviceId: "primary", label: "CPU", unit: "%", max: 100, warn: 70, crit: 90, value: (s, n) => (s.job ? 74 : 26) + (s.routed ? Math.min(20, Math.floor(s.sat / 30)) : 0) + jitter(n, 5) },
      { id: "primary.wal", serviceId: "primary", label: "WAL written", unit: "MB/s", max: 200, warn: 80, crit: 140, value: (s, n) => (s.job && s.quiet === 0 ? 110 : 12) + jitter(n, 6) },
      { id: "primary.oldest", serviceId: "primary", label: "Oldest open transaction", unit: "min", max: 240, warn: 30, crit: 120, value: (s) => (s.job ? 55 + Math.floor(s.lag / 100) : 0) },
      { id: "replica.lag", serviceId: "replica", label: "Replication lag", unit: "s", max: 700, warn: 10, crit: 30, value: (s, n) => Math.max(0, lagS(s) + jitter(n, 2)) },
      { id: "replica.cpu", serviceId: "replica", label: "CPU", unit: "%", max: 100, warn: 70, crit: 90, value: (_s, n) => 34 + jitter(n, 6) },
    ],

    logs: [
      { id: "edge.errors", serviceId: "edge", level: "ERROR", everyTicks: 7, when: (s) => errorRateBp(s) >= 100, text: (_s, r) => v.edgeLine(r) },
      { id: "edge.access", serviceId: "edge", level: "INFO", everyTicks: 12, text: (_s, r) => `GET /products/${1000 + r.int(9000)} 200 ${30 + r.int(40)}ms` },
      { id: "api.conflict", serviceId: "api", level: "WARN", everyTicks: 9, when: (s) => errorRateBp(s) >= 100, text: (_s, r) => v.apiLine(r) },
      { id: "api.ok", serviceId: "api", level: "INFO", everyTicks: 16, text: (_s, r) => v.apiOk(r) },
      { id: "cache.ok", serviceId: "cache", level: "INFO", everyTicks: 45, text: (_s, r) => `keyspace hits ${94 + r.int(3)}%, evictions 0, used memory ${1200 + r.int(300)} MB` },
      { id: "primary.checkpoint", serviceId: "primary", level: "WARN", everyTicks: 30, when: (s) => s.job === 1 && s.quiet === 0,
        text: (_s, r) => `checkpoints are occurring too frequently (${7 + r.int(4)} seconds apart); consider increasing max_wal_size` },
      { id: "primary.ok", serviceId: "primary", level: "INFO", everyTicks: 60, when: (s) => s.job === 0 || s.quiet > 0, text: (_s, r) => `checkpoint complete: wrote ${1000 + r.int(900)} buffers` },
      { id: "replica.lag", serviceId: "replica", level: "WARN", everyTicks: 10, when: (s) => lagS(s) >= 10,
        text: (s, r) => `replay is ${lagS(s) + r.int(3)} s behind the primary; still applying WAL received ${lagS(s) + r.int(3)} s ago` },
      { id: "replica.ok", serviceId: "replica", level: "INFO", everyTicks: 40, when: (s) => lagS(s) < 10, text: () => "streaming replication: caught up with the primary" },
      { id: "batch.run", serviceId: "batch", level: "INFO", everyTicks: 25, when: (s) => s.job === 1, text: (_s, r) => v.batchLine(r) },
    ],

    alerts: [
      { id: "customer_5xx", serviceId: "edge", severity: "crit", title: "CustomerErrorRate", description: "5xx above 1% at the gateway", when: (s) => errorRateBp(s) >= 100 },
      { id: "replica_lag", serviceId: "replica", severity: "warn", title: "ReplicaLagHigh", description: `${v.labels.replica} is more than 30 s behind`, when: (s) => lagS(s) >= 30 },
      { id: "primary_cpu", serviceId: "primary", severity: "warn", title: "PrimaryCpuHigh", description: `${v.labels.primary} CPU above 70%`, when: (s) => s.job === 1 && s.quiet === 0 },
    ],

    actions: [
      { id: "edge.error_log", tool: "logs", label: "Read gateway error log", serviceId: "edge", category: "investigate", durationS: 3, verdict: "useful",
        reveals: () => [`nginx: every 5xx in the last 5 min comes from ${v.labels.api}; the gateway itself is fine`] },
      { id: "api.conflicts", tool: "logs", label: "Find the failing requests", serviceId: "api", category: "investigate", durationS: 4, verdict: "useful",
        reveals: () => [`${v.labels.api}: failing requests read a record at an older version than the one just written; the read went to ${v.labels.replica}, the write to ${v.labels.primary}`] },
      { id: "replica.log", tool: "logs", label: "Read the replica log", serviceId: "replica", category: "investigate", durationS: 3, verdict: "useful",
        reveals: (s) => [`${v.labels.replica}: replay ${lagS(s)} s behind and growing; the replica is healthy and applying WAL as fast as it can, the primary is sending far more than usual`] },
      { id: "replica.lag", tool: "dashboards", label: "Check replication lag", serviceId: "replica", category: "investigate", durationS: 4, verdict: "useful",
        reveals: (s) => [`${v.labels.replica} is ${lagS(s)} s behind and the gap is widening; WAL volume on ${v.labels.primary} is about ten times normal`] },
      { id: "cache.stats", tool: "dashboards", label: "Check cache hit rate", serviceId: "cache", category: "investigate", durationS: 3, verdict: "wasted",
        reveals: () => [`${v.labels.cache}: hit rate 95%, no evictions, keys expire on schedule; nothing odd about the cache`] },
      { id: "api.deploys", tool: "deploys", label: "View recent deploys", serviceId: "api", category: "investigate", durationS: 3, verdict: "wasted",
        reveals: () => [v.deployReveal] },
      { id: "api.route_primary", tool: "deploys", label: "Route reads to the primary", serviceId: "api", category: "mitigate", durationS: 15, verdict: "wasted",
        available: (s) => s.routed === 0,
        effect: (s) => ({ ...s, routed: 1 }),
        reveals: () => [`config pushed: ${v.labels.api} reads now go to ${v.labels.primary}; stale reads gone, primary latency climbing`] },
      { id: "db.long_running", tool: "db", label: "List long-running statements", serviceId: "primary", category: "investigate", durationS: 4, verdict: "useful",
        command: v.findCommand,
        effect: (s) => ({ ...s, found: 1 }),
        reveals: (s) => [v.findReveal(s.pid)] },
      { id: "db.stop_job", tool: "db", label: v.stopLabel, serviceId: "primary", category: "fix", durationS: 15, verdict: "useful",
        command: v.stopCommand,
        available: (s) => s.found === 1 && s.job === 1,
        effect: (s) => ({ ...s, job: 0, quiet: 0 }),
        reveals: (s) => [v.stopReveal(s.pid)] },
      { id: "db.cache_flush", tool: "db", label: "Flush the cache", serviceId: "cache", category: "mitigate", durationS: 10, verdict: "wasted",
        command: "redis-cli -h cache-1 FLUSHALL",
        effect: (s) => ({ ...s, relief: 700, flushes: s.flushes + 1 }),
        reveals: () => ["cache flushed on both nodes; carts and pages are rebuilding"] },
      { id: "db.failover", tool: "db", label: "Fail over to the replica", serviceId: "replica", category: "mitigate", durationS: 25, verdict: "harmful", sideEffectBp: 4500,
        command: `patronictl failover --candidate ${v.labels.replica} --force`,
        effect: (s) => ({ ...s, lag: 0, quiet: 1500, failovers: s.failovers + 1 }),
        reveals: (s) => [`${v.labels.replica} promoted. It had not received the writes of the last ${Math.max(1, lagS(s) + 1)} s, so those are gone and the old primary is fenced; the long job restarts on the new primary`] },
      { id: "global.status_update", tool: "incident", label: "Post status update", serviceId: null, category: "communicate", durationS: 5, verdict: "useful",
        available: (s) => s.statusPosted === 0,
        effect: (s) => ({ ...s, statusPosted: 1 }),
        reveals: () => [`status page: "Investigating errors and out-of-date data for some customers"`] },
      duckAction<ReplicaLag>(v.hints),
      { id: "ask.deployer.changes", tool: "chat", label: "Ask the deployer what went out today", serviceId: null, category: "investigate", durationS: 30, verdict: "wasted", async: true,
        ask: { to: "deployer", topic: "changes", prompt: `did the ${v.labels.api} deploy touch how it reads?` },
        reveals: () => [`{deployer}: "${v.asks.deployer}"`] },
      { id: "ask.infra.stale", tool: "chat", label: "Ask infra about the stale data", serviceId: null, category: "investigate", durationS: 25, verdict: "wasted", async: true,
        ask: { to: "infra", topic: "stale", prompt: "customers see old data, what would you check?" },
        reveals: () => [`{infra}: "${v.asks.infra}"`] },
      { id: "ask.support.impact", tool: "chat", label: "Ask support what customers report", serviceId: null, category: "investigate", durationS: 20, verdict: "useful", async: true,
        ask: { to: "support", topic: "impact", prompt: "what exactly are customers seeing, and since when?" },
        reveals: () => [`{support}: "${v.asks.support}"`] },
      { id: "global.ask_secondary", tool: "incident", label: "Ask secondary on-call", serviceId: null, category: "communicate", durationS: 10, verdict: "useful", async: true,
        reveals: () => [`{secondary} (secondary): "${v.asks.secondary}"`] },
    ],
    rootCauseActionIds: ["db.stop_job"],
    hints: v.hints,
    maskNotes: {
      "db.cache_flush": "Flushing the cache hid the stale entries for a while. The replica was still far behind, so the next reads came back stale and the errors returned.",
      "api.route_primary": "Routing reads to the primary stopped the stale reads, but the primary was already busy with the long job and the extra reads pushed it toward saturation.",
      "db.failover": "Failing over to the replica made the lag go away, but it threw away the writes the replica had not received, and the long job simply started again on the new primary.",
    },

    coldOpen: { scene: "cafe", symptom: v.symptom, page: v.page, hotspots: v.hotspots },

    lessons: [
      { id: "dnf", when: (r) => r.outcome === "dnf", text: v.lessons.dnf },
      { id: "slow-ack", when: (r) => r.ackTick !== null && r.ackTick > 300,
        text: "Acknowledging took more than 30 seconds. A fast ack tells the team someone is on it and stops the page from escalating." },
      { id: "failover-trap", when: (r) => r.actions.some((a) => a.actionId === "db.failover"), text: v.lessons.failover },
      { id: "flush-trap", when: (r) => r.actions.some((a) => a.actionId === "db.cache_flush"), text: v.lessons.flush },
      { id: "route-trap", when: (r) => r.actions.some((a) => a.actionId === "api.route_primary"), text: v.lessons.route },
      { id: "default", when: () => true, text: v.lessons.default },
    ],
  });
}
