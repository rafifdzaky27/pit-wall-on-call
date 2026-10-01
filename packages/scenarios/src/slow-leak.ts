import { defineScenario, type Rng } from "@pitwall/engine";
import { duckAction } from "./duck";

/** checkout-api pool, in milli-connections so the leak stays integer (spec §5, rule 3). */
const POOL_MAX = 100_000;
const OTHER_DB_CLIENTS = 8;

type SlowLeak = {
  pool: number;
  leak: number;
  rolledBack: number;
  restarts: number;
  failovers: number;
  dbMaxConns: number;
  statusPosted: number;
  ducks: number;
};

const inUse = (s: SlowLeak) => Math.floor(s.pool / 1000);
const dbConns = (s: SlowLeak) => inUse(s) + OTHER_DB_CLIENTS;
const errorRateBp = (s: SlowLeak): number =>
  s.pool <= 88_000 ? 0 : s.pool >= POOL_MAX ? 4000 : Math.floor((s.pool - 88_000) / 3);
const p99Ms = (s: SlowLeak): number =>
  s.pool <= 85_000 ? 140 : Math.min(5000, 140 + Math.floor(((s.pool - 85_000) * 4860) / 15_000));
const jitter = (rng: Rng, spread: number) => (rng.next() - 0.5) * spread;
const hex4 = (rng: Rng) => rng.int(0x10000).toString(16).padStart(4, "0");

/** The duck's questions, in order (M2.5 spec §9). They point at the reasoning, never at the fix. */
const SLOW_LEAK_HINTS = [
  "What changed recently, and when did the errors start?",
  "Is the loudest service the cause, or a victim of something it depends on?",
  "If the errors stopped, did the cause go away, or did something just reset?",
];

export const slowLeak = defineScenario<SlowLeak>({
  id: "db-pool-exhaustion",
  title: "The Slow Leak",
  summary: "Checkout is failing and the database is shouting. Is it really the database?",
  difficulty: "normal",
  timeLimitS: 480,
  parBp: 450,
  slo: { availability: 99.9, budgetRequests: 5000 },
  trafficPerTick: 2,

  services: [
    { id: "edge", label: "edge-gateway", x: 12, y: 50, detail: () => "nginx · 2 nodes" },
    { id: "checkout", label: "checkout-api", x: 44, y: 50, detail: (s) => (s.rolledBack ? "v141 · 3 pods" : "v142 · 3 pods") },
    { id: "postgres", label: "postgres", x: 80, y: 18, detail: (s) => `primary · max ${s.dbMaxConns} conns` },
    { id: "payments", label: "payments", x: 80, y: 82, detail: () => "external provider" },
  ],
  edges: [
    { from: "edge", to: "checkout" },
    { from: "checkout", to: "postgres" },
    { from: "checkout", to: "payments" },
  ],

  setup: (rng) => ({
    pool: 88_500 + rng.int(1001),
    leak: 18 + rng.int(7),
    rolledBack: 0,
    restarts: 0,
    failovers: 0,
    dbMaxConns: 120,
    statusPosted: 0,
    ducks: 0,
  }),
  dynamics: (s) => ({ ...s, pool: Math.min(POOL_MAX, s.pool + s.leak) }),
  errorRateBp,
  health: (s) => {
    const err = errorRateBp(s);
    const conns = dbConns(s);
    return {
      edge: err >= 1000 ? "crit" : err >= 100 ? "warn" : "ok",
      checkout: inUse(s) >= 90 ? "warn" : "ok",
      postgres: conns >= 95 ? "crit" : conns >= 85 ? "warn" : "ok",
      payments: "ok",
    };
  },
  mitigated: (s) => s.rolledBack === 0 && s.restarts + s.failovers > 0,
  resolvedWhen: (s) => s.rolledBack === 1 && s.pool < 60_000,

  metrics: [
    { id: "edge.rps", serviceId: "edge", label: "Requests", unit: "req/s", max: 40, value: (_s, n) => 20 + jitter(n, 3) },
    { id: "edge.err", serviceId: "edge", label: "5xx rate", unit: "%", max: 50, warn: 1, crit: 2, value: (s, n) => Math.max(0, errorRateBp(s) / 100 + (errorRateBp(s) ? jitter(n, 0.6) : 0)) },
    { id: "checkout.pool", serviceId: "checkout", label: "Pool in use", unit: "of 100", max: 100, warn: 90, crit: 100, value: (s) => inUse(s) },
    { id: "checkout.p99", serviceId: "checkout", label: "p99 latency", unit: "ms", max: 5500, warn: 1000, crit: 2000, value: (s, n) => Math.max(0, p99Ms(s) + jitter(n, 40)) },
    { id: "postgres.conns", serviceId: "postgres", label: "Connections", unit: "conns", max: 120, warn: 85, crit: 95, value: (s, n) => dbConns(s) + jitter(n, 2) },
    { id: "postgres.cpu", serviceId: "postgres", label: "CPU", unit: "%", max: 100, warn: 70, crit: 90, value: (_s, n) => 24 + jitter(n, 8) },
    { id: "payments.p99", serviceId: "payments", label: "p99 latency", unit: "ms", max: 2000, warn: 800, crit: 1500, value: (_s, n) => 182 + jitter(n, 40) },
    { id: "payments.err", serviceId: "payments", label: "Error rate", unit: "%", max: 5, warn: 1, crit: 2, value: (_s, n) => 0.1 + jitter(n, 0.1) },
  ],

  logs: [
    { id: "edge.upstream_timeout", serviceId: "edge", level: "ERROR", everyTicks: 7, when: (s) => errorRateBp(s) >= 100,
      text: (_s, r) => `upstream prematurely closed connection while reading response header from upstream, client 10.0.${r.int(256)}.${r.int(256)}, request "POST /checkout", upstream "checkout-api:8080"` },
    { id: "edge.access", serviceId: "edge", level: "INFO", everyTicks: 12,
      text: (_s, r) => `GET /products/${1000 + r.int(9000)} 200 ${30 + r.int(40)}ms` },
    { id: "checkout.pool_timeout", serviceId: "checkout", level: "WARN", everyTicks: 9, when: (s) => s.pool >= 95_000,
      text: (s, r) => `pool timeout: waited 5000ms for a connection (active=${inUse(s)} idle=0 waiting=${10 + r.int(40)})` },
    { id: "checkout.ok", serviceId: "checkout", level: "INFO", everyTicks: 16, when: (s) => s.pool < 98_000,
      text: (s, r) => `POST /checkout 200 ${p99Ms(s) > 1000 ? 900 + r.int(900) : 90 + r.int(80)}ms` },
    { id: "checkout.held", serviceId: "checkout", level: "WARN", everyTicks: 60, when: (s) => s.rolledBack === 0,
      text: (_s, r) => `connection held ${40 + r.int(20)} min by tx ${hex4(r)} and never released` },
    { id: "postgres.reset", serviceId: "postgres", level: "WARN", everyTicks: 5, when: (s) => dbConns(s) >= 90,
      text: () => "could not receive data from client: Connection reset by peer" },
    { id: "postgres.slow_query", serviceId: "postgres", level: "WARN", everyTicks: 40,
      text: (_s, r) => `duration: ${1000 + r.int(400)}.${r.int(1000)} ms  statement: SELECT o.* FROM orders o WHERE o.customer_id = $1` },
    { id: "postgres.checkpoint", serviceId: "postgres", level: "INFO", everyTicks: 150,
      text: (_s, r) => `checkpoint complete: wrote ${1000 + r.int(900)} buffers` },
    { id: "payments.ok", serviceId: "payments", level: "INFO", everyTicks: 18,
      text: (_s, r) => `POST /v1/charges 200 ${150 + r.int(60)}ms` },
  ],

  alerts: [
    { id: "checkout_5xx", serviceId: "edge", severity: "crit", title: "CheckoutErrorRate", description: "Checkout 5xx above 1% at the gateway", when: (s) => errorRateBp(s) >= 100 },
    { id: "pg_connections", serviceId: "postgres", severity: "crit", title: "PostgresConnectionsHigh", description: "Postgres connections above 95", when: (s) => dbConns(s) >= 95 },
    { id: "checkout_latency", serviceId: "checkout", severity: "warn", title: "CheckoutLatencyP99", description: "checkout-api p99 above 2 s", when: (s) => s.pool >= 91_000 },
  ],

  actions: [
    { id: "edge.error_log", cli: "kubectl logs deployment/edge --since=15m", tool: "logs", label: "Read gateway error log", serviceId: "edge", category: "investigate", durationS: 3, verdict: "useful",
      reveals: () => [`nginx: every 5xx in the last 5 min is a 502, "upstream prematurely closed connection" from checkout-api:8080`] },
    { id: "edge.add_workers", cliKeys: ["scale","deployment/edge"], cli: "kubectl scale deployment/edge --replicas=16", tool: "deploys", label: "Add gateway workers", serviceId: "edge", category: "mitigate", durationS: 10, verdict: "wasted",
      reveals: () => ["gateway workers 8 → 16; 502s unchanged"] },
    { id: "checkout.pool_stats", cli: "promtool query instant http://prometheus:9090 'checkout_db_pool_connections_in_use'", tool: "dashboards", label: "Check connection pool", serviceId: "checkout", category: "investigate", durationS: 4, verdict: "useful",
      reveals: (s) => [`pool: ${inUse(s)} of 100 in use, ${100 - inUse(s)} idle; oldest connection checked out 52 min ago, idle in transaction`] },
    { id: "checkout.deploys", cli: "kubectl rollout history deployment/checkout", tool: "deploys", label: "View recent deploys", serviceId: "checkout", category: "investigate", durationS: 3, verdict: "useful",
      reveals: () => [`v142 by {deployer}, 52 min ago: "checkout refactor: move tx handling to middleware"; v141 ran 6 days without issues`] },
    { id: "checkout.restart", cliKeys: ["rollout","restart","deployment/checkout"], cli: "kubectl rollout restart deployment/checkout", tool: "deploys", label: "Restart pods", serviceId: "checkout", category: "mitigate", durationS: 15, verdict: "harmful", sideEffectBp: 5000,
      effect: (s) => ({ ...s, pool: 40_000, restarts: s.restarts + 1 }),
      reveals: () => ["rolling restart done: 3 of 3 pods ready, pool reset"] },
    { id: "checkout.rollback", cliKeys: ["rollout","undo","deployment/checkout"], cli: "kubectl rollout undo deployment/checkout", tool: "deploys", label: "Roll back to v141", serviceId: "checkout", category: "fix", durationS: 30, verdict: "useful",
      available: (s) => s.rolledBack === 0,
      effect: (s) => ({ ...s, rolledBack: 1, leak: 0, pool: 30_000 }),
      reveals: () => ["rollback to v141 complete: 3 of 3 pods ready"] },
    { id: "postgres.connections", cli: "psql -c \"SELECT application_name, state, count(*) FROM pg_stat_activity GROUP BY 1, 2;\"", tool: "db", label: "Inspect active connections", serviceId: "postgres", category: "investigate", durationS: 3, verdict: "useful",
      command: "SELECT application_name, state, count(*) FROM pg_stat_activity GROUP BY 1, 2;",
      reveals: (s) => [`pg_stat_activity: ${dbConns(s)} connections of max_connections ${s.dbMaxConns} (ALTER SYSTEM changes it, and needs a restart); ${inUse(s)} from checkout-api, ${Math.max(0, inUse(s) - 6)} of them idle in transaction`] },
    { id: "postgres.raise_max_conns", cliKeys: ["alter","system","max_connections"], cli: "psql -c \"ALTER SYSTEM SET max_connections = 200; -- needs a restart\"", tool: "db", label: "Raise max_connections", serviceId: "postgres", category: "fix", durationS: 20, verdict: "harmful", sideEffectBp: 2000,
      command: "ALTER SYSTEM SET max_connections = 200; -- needs a restart",
      available: (s) => s.dbMaxConns === 120,
      effect: (s) => ({ ...s, dbMaxConns: 200 }),
      reveals: () => ["postgres restarted with max_connections = 200"] },
    { id: "postgres.failover", cliKeys: ["patronictl","failover"], cli: "psql -c \"\\! patronictl failover --candidate postgres-replica-1\"", tool: "db", label: "Fail over to replica", serviceId: "postgres", category: "mitigate", durationS: 30, verdict: "harmful", sideEffectBp: 3000,
      command: "\\! patronictl failover --candidate postgres-replica-1",
      effect: (s) => ({ ...s, pool: 40_000, failovers: s.failovers + 1 }),
      reveals: () => ["failover complete: replica promoted, clients reconnected"] },
    { id: "payments.status", cli: "curl -s https://status.payments.example/api/v2/status.json", tool: "dashboards", label: "Check provider status", serviceId: "payments", category: "investigate", durationS: 3, verdict: "wasted",
      reveals: () => ["payments provider: all systems operational, p99 182 ms"] },
    { id: "global.status_update", cliKeys: ["status-page"], cli: "incidentctl status-page \"Investigating elevated checkout errors\"", tool: "incident", label: "Post status update", serviceId: null, category: "communicate", durationS: 5, verdict: "useful",
      available: (s) => s.statusPosted === 0,
      effect: (s) => ({ ...s, statusPosted: 1 }),
      reveals: () => [`status page: "Investigating elevated checkout errors"`] },
    { ...duckAction<SlowLeak>(SLOW_LEAK_HINTS), cli: "incidentctl rubber-duck" },
    { id: "ask.deployer.changes", tool: "chat", label: "Ask the deployer what went out today", serviceId: null, category: "investigate", durationS: 30, verdict: "useful", async: true,
      ask: { to: "deployer", topic: "changes", prompt: "hey, what went out in checkout today?" },
      reveals: () => [`{deployer}: "v142, the checkout refactor. Transaction handling moved into a middleware."`] },
    { id: "ask.infra.db", tool: "chat", label: "Ask infra about postgres", serviceId: null, category: "investigate", durationS: 25, verdict: "wasted", async: true,
      ask: { to: "infra", topic: "db", prompt: "is postgres OK? lots of connection alerts" },
      reveals: () => [`{infra}: "postgres looks noisy, probably the nightly batch. CPU is fine though."`] },
    { id: "ask.support.impact", tool: "chat", label: "Ask support about customer impact", serviceId: null, category: "investigate", durationS: 20, verdict: "useful", async: true,
      ask: { to: "support", topic: "impact", prompt: "how many customers are hit, and what do they see?" },
      reveals: () => [`{support}: "about 1 in 25 payments fail. They get a 502 page at the payment step."`] },
    { id: "global.ask_secondary", cliKeys: ["page","secondary"], cli: "incidentctl page secondary", tool: "incident", label: "Ask secondary on-call", serviceId: null, category: "communicate", durationS: 10, verdict: "useful", async: true,
      reveals: () => [`{secondary} (secondary): "{deployer} shipped v142 about an hour ago. Could that be it?"`] },
  ],
  rootCauseActionIds: ["checkout.rollback"],
  hints: SLOW_LEAK_HINTS,
  maskNotes: {
    "checkout.restart": "Restart pods reset the pool, so the errors stopped for a while. The leak in v142 kept running.",
    "postgres.failover": "Fail over to replica reset the pool, so the errors stopped. The leak in v142 kept running.",
    "postgres.raise_max_conns": "Raise max_connections gave the leak more room and restarted postgres. The leak in v142 kept running.",
  },

  coldOpen: {
    scene: "cafe",
    symptom: { kind: "http_502", surface: "checkout" },
    page: { severity: "SEV2", title: "Checkout returning 5xx", body: "Checkout requests for {brand} are failing at the gateway. You are the primary on-call." },
    hotspots: {
      "laptop.slack.deploys": { kind: "clue", label: "Laptop: Slack #deploys", author: "deployer", text: "shipping the checkout refactor (v142), heading home" },
      "laptop.slack.infra": { kind: "herring", label: "Laptop: Slack #infra", author: "infra", text: "reminder: DB maintenance window tomorrow at 02:00 UTC" },
      "phone.mention": { kind: "clue", label: "Phone: new mention", text: "@{brand} checkout just errors out??", appearsAt: "incident_start" },
      "table.neighbours": { kind: "clue", label: "The next table", text: "Their site keeps giving me some gateway error." },
      "wall.poster": { kind: "herring", label: "Poster on the wall", text: "{brand} FLASH SALE 50% today" },
    },
  },

  lessons: [
    { id: "dnf", when: (r) => r.outcome === "dnf",
      text: "The pool had been leaking since v142 shipped. Postgres was loud, but its CPU stayed calm: the database was a victim, not the cause. When symptoms start after a deploy, roll it back first." },
    { id: "slow-ack", when: (r) => r.ackTick !== null && r.ackTick > 300,
      text: "Acknowledging took more than 30 seconds. A fast ack tells the team someone is on it and stops the page from escalating." },
    { id: "restart-trap", when: (r) => r.actions.some((a) => a.actionId === "checkout.restart" || a.actionId === "postgres.failover"),
      text: "Restarts buy time, not a fix. The pool drained, then v142 leaked it again. Roll back the bad deploy instead of cycling what it broke." },
    { id: "default", when: () => true,
      text: "Loud is not the same as guilty. Postgres raised the most alarms, but checkout-api was holding the connections. Checking recent deploys early is the fastest way to the cause." },
  ],
});
