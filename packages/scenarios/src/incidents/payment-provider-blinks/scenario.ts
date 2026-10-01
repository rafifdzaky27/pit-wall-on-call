import { defineScenario, type Rng, type ScenarioDef, type State } from "@pitwall/engine";
import { duckAction } from "../../duck";

/** Checkout worker threads that are stuck waiting on the payment provider, in milli-percent of the pool. */
const MAX = 100_000;
/** Below this, checkout still has threads to spare and no request fails. */
const FLOOR = 40_000;

type Blinks = {
  /** Threads stuck waiting on the provider, milli-percent of the pool. */
  blocked: number;
  /** How fast they pile up while the provider stays slow. */
  rate: number;
  fallback: number;
  restarts: number;
  rolledBack: number;
  /** The player has read the checkout payment config. */
  sawConfig: number;
  raised: number;
  held: number;
  skipped: number;
  statusPosted: number;
  ducks: number;
};

/** What one variant of the incident looks like: which provider blinks, its fallback, and what is loud. */
export interface BlinksVariant {
  /** "" for the first variant, otherwise the slug in the scenario id. */
  key: string;
  title: string;
  summary: string;
  /** The provider that degrades. */
  provider: string;
  providerLabel: string;
  /** The payment method that fails. */
  method: "card" | "wallet";
  /** The provider's own status page, and whether it tells the truth yet. */
  statusPage: { honest: boolean; text: string };
  /** The fallback the checkout config already supports. */
  fallbackName: string;
  fallbackLabel: string;
  fallbackDone: string;
  /** The log line for one payment that took the fallback. */
  routedLine: string;
  /** How the fallback's box on the service map reads: [standby, taking traffic]. */
  fallbackDetail: readonly [string, string];
  /** What is loud but innocent: a recent deploy, a rules change, or a busy database. */
  herring: "deploy" | "rules" | "db";
  /** How the fix works. "reroute" sends new payments elsewhere; "exempt" skips the card check for small orders (fail open). */
  mechanism: "reroute" | "exempt";
  /** Words that name the cause, lower case, for the harness (PR 30 review I3). */
  spoilers: readonly string[];
  /** The number in the postmortem the channel shows, so each variant has its own. */
  pm: number;
  /** What checkout's payment config says, once the player opens it. */
  configLine: string;
  /** The fix's command, as the Deploys config panel shows it. */
  fixCommand: string;
  /** The recent innocent deploy (not used when the herring is the database). */
  deploy: { change: string; slack: string; history: string; dm: string; rollbackLabel: string; rollbackDone: string };
  symptom: { code: 503 | 504; path: string };
  region: string;
}

const HINTS = [
  "What changed recently, and does the timing of the errors line up with it?",
  "Which part of checkout is slow: your own code, your database, or something it calls out to?",
  "If a restart cleared it for a while and it came back, what is still true that you have not touched?",
];

const inUse = (s: Blinks) => Math.floor(s.blocked / 1000);
const errorRateBp = (s: Blinks): number => (s.blocked <= FLOOR ? 0 : s.blocked >= MAX ? 3800 : Math.floor(((s.blocked - FLOOR) * 3800) / (MAX - FLOOR)));
const p99Ms = (s: Blinks): number => (s.blocked <= FLOOR ? 190 : Math.min(8000, 190 + Math.floor(((s.blocked - FLOOR) * 7800) / (MAX - FLOOR))));
const jitter = (rng: Rng, spread: number) => (rng.next() - 0.5) * spread;

export function paymentProviderBlinks(v: BlinksVariant): ScenarioDef<State> {
  const id = v.key ? `payment-provider-blinks:${v.key}` : "payment-provider-blinks";
  const noisyDb = v.herring === "db";
  const innocentDeploy = v.herring !== "db";
  const exempt = v.mechanism === "exempt";
  const isCard = v.method === "card";

  return defineScenario<Blinks>({
    id,
    title: v.title,
    summary: v.summary,
    difficulty: "normal",
    timeLimitS: 480,
    parBp: 260,
    slo: { availability: 99.9, budgetRequests: 5000 },
    trafficPerTick: 2,

    services: [
      { id: "edge", label: "edge-gateway", x: 10, y: 50, detail: () => "nginx · 2 nodes" },
      { id: "checkout", label: "checkout-api", x: 42, y: 50, detail: (s) => `${s.rolledBack ? "v206" : "v207"} · 6 pods${s.fallback ? " · fallback on" : ""}` },
      { id: "postgres", label: "postgres", x: 78, y: 16, detail: () => "primary · max 120 conns" },
      { id: "payments", label: v.providerLabel, x: 78, y: 50, detail: () => "external provider" },
      { id: "fallback", label: v.fallbackName.toLowerCase(), x: 78, y: 84, detail: (s) => v.fallbackDetail[s.fallback ? 1 : 0] },
    ],
    edges: [
      { from: "edge", to: "checkout" },
      { from: "checkout", to: "postgres" },
      { from: "checkout", to: "payments" },
      { from: "checkout", to: "fallback" },
    ],

    setup: (rng) => ({
      blocked: 50_000 + rng.int(8001),
      rate: 50 + rng.int(21),
      fallback: 0,
      restarts: 0,
      rolledBack: 0,
      sawConfig: 0,
      raised: 0,
      held: 0,
      skipped: 0,
      statusPosted: 0,
      ducks: 0,
    }),
    // The provider stays slow the whole shift: it is not ours to fix. With the fallback on, new payments
    // stop waiting on it and the stuck threads drain.
    dynamics: (s) => ({ ...s, blocked: s.fallback ? Math.max(0, s.blocked - 1500) : Math.min(MAX, s.blocked + s.rate) }),
    errorRateBp,
    health: (s) => {
      const err = errorRateBp(s);
      return {
        edge: err >= 1000 ? "crit" : err >= 100 ? "warn" : "ok",
        checkout: s.blocked >= 70_000 ? "crit" : s.blocked >= FLOOR ? "warn" : "ok",
        postgres: noisyDb ? "warn" : "ok",
        payments: "crit",
        fallback: "ok",
      };
    },
    mitigated: (s) => s.fallback === 0 && (s.restarts > 0 || s.held > 0),
    resolvedWhen: (s) => s.fallback === 1 && s.blocked < 20_000,

    metrics: [
      { id: "edge.rps", serviceId: "edge", label: "Requests", unit: "req/s", max: 40, value: (_s, n) => 20 + jitter(n, 3) },
      { id: "edge.err", serviceId: "edge", label: "5xx rate", unit: "%", max: 50, warn: 1, crit: 2, value: (s, n) => Math.max(0, errorRateBp(s) / 100 + (errorRateBp(s) ? jitter(n, 0.6) : 0)) },
      { id: "checkout.waiting", serviceId: "checkout", label: "Threads waiting on payments", unit: "of 100", max: 100, warn: 70, crit: 90, value: (s) => inUse(s) },
      { id: "checkout.p99", serviceId: "checkout", label: "p99 latency", unit: "ms", max: 8500, warn: 1000, crit: 3000, value: (s, n) => Math.max(0, p99Ms(s) + jitter(n, 60)) },
      { id: "postgres.cpu", serviceId: "postgres", label: "CPU", unit: "%", max: 100, warn: 70, crit: 90, value: (_s, n) => (noisyDb ? 74 + jitter(n, 8) : 22 + jitter(n, 8)) },
      { id: "postgres.conns", serviceId: "postgres", label: "Connections", unit: "conns", max: 120, warn: 85, crit: 95, value: (_s, n) => 31 + jitter(n, 4) },
      { id: "payments.p99", serviceId: "payments", label: "Authorise p99", unit: "ms", max: 12_000, warn: 2000, crit: 5000, value: (_s, n) => 7800 + jitter(n, 900) },
      { id: "payments.err", serviceId: "payments", label: "Timeouts", unit: "%", max: 100, warn: 5, crit: 20, value: (_s, n) => 72 + jitter(n, 10) },
      { id: "fallback.rps", serviceId: "fallback", label: "Authorisations", unit: "req/s", max: 40, value: (s, n) => (s.fallback ? 6 + jitter(n, 1) : 0) },
    ],

    logs: [
      { id: "edge.upstream_timeout", serviceId: "edge", level: "ERROR", everyTicks: 7, when: (s) => errorRateBp(s) >= 100,
        text: (_s, r) => `upstream timed out (110: Connection timed out) while reading response header from upstream, client 10.0.${r.int(256)}.${r.int(256)}, request "POST ${v.symptom.path}", upstream "checkout-api:8080"` },
      { id: "edge.access", serviceId: "edge", level: "INFO", everyTicks: 12, text: (_s, r) => `GET /products/${1000 + r.int(9000)} 200 ${30 + r.int(40)}ms` },
      { id: "checkout.provider_timeout", serviceId: "checkout", level: "WARN", everyTicks: 6, when: (s) => s.fallback === 0,
        text: (s, r) => `${v.provider} authorise timed out after 8000ms, order ${100_000 + r.int(900_000)} (threads waiting=${inUse(s)} of 100)` },
      { id: "checkout.ok", serviceId: "checkout", level: "INFO", everyTicks: 16, when: (s) => s.blocked < 90_000,
        text: (s, r) => `POST ${v.symptom.path} ${s.fallback || s.blocked < FLOOR ? 200 : v.symptom.code} ${s.blocked > FLOOR ? 8000 + r.int(200) : 320 + r.int(160)}ms` },
      { id: "checkout.fallback_route", serviceId: "checkout", level: "INFO", everyTicks: 14, when: (s) => s.fallback === 1,
        text: (_s, r) => `authorisation ${100_000 + r.int(900_000)} ${v.routedLine} 200 ${260 + r.int(140)}ms` },
      { id: "checkout.cart", serviceId: "checkout", level: "INFO", everyTicks: 20, text: (_s, r) => `POST /cart 201 ${60 + r.int(60)}ms` },
      ...(noisyDb
        ? [
            { id: "postgres.reporting", serviceId: "postgres", level: "WARN" as const, everyTicks: 8,
              text: (_s: Blinks, r: Rng) => `duration: ${41_000 + r.int(9000)}.${r.int(1000)} ms  statement: SELECT date_trunc('hour', o.created_at), sum(o.total) FROM orders o JOIN order_items i ON i.order_id = o.id GROUP BY 1` },
            { id: "postgres.checkpoint", serviceId: "postgres", level: "INFO" as const, everyTicks: 60,
              text: (_s: Blinks, r: Rng) => `checkpoint starting: time (wrote ${3000 + r.int(2000)} buffers)` },
          ]
        : [{ id: "postgres.checkpoint", serviceId: "postgres", level: "INFO" as const, everyTicks: 150, text: (_s: Blinks, r: Rng) => `checkpoint complete: wrote ${1000 + r.int(900)} buffers` }]),
      { id: "payments.slow", serviceId: "payments", level: "WARN", everyTicks: 10, text: (_s, r) => `POST /v1/authorisations 504 ${8000 + r.int(60)}ms (${v.region})` },
      { id: "fallback.ok", serviceId: "fallback", level: "INFO", everyTicks: 10, when: (s) => s.fallback === 1, text: (_s, r) => `POST /v1/authorisations 200 ${240 + r.int(120)}ms` },
    ],

    alerts: [
      { id: "checkout_5xx", serviceId: "edge", severity: "crit", title: "CheckoutErrorRate", description: "Checkout 5xx above 1% at the gateway", when: (s) => errorRateBp(s) >= 100 },
      { id: "checkout_threads", serviceId: "checkout", severity: "warn", title: "CheckoutThreadsSaturated", description: "checkout-api threads waiting above 70%", when: (s) => s.blocked >= 70_000 },
      ...(isCard ? [{ id: "provider_latency", serviceId: "payments", severity: "warn" as const, title: "PaymentAuthoriseLatency", description: `${v.provider} authorise p99 above 5 s`, when: () => true }] : []),
      ...(noisyDb ? [{ id: "pg_slow", serviceId: "postgres", severity: "warn" as const, title: "PostgresSlowQueries", description: "Postgres statements running longer than 30 s", when: () => true }] : []),
    ],

    actions: [
      { id: "payments.timeouts", cli: `logcli query 'service:checkout-api "${v.provider}" timeout | stats count by upstream'`, tool: "logs", label: `Search ${v.provider} timeouts`, serviceId: "payments", category: "investigate", durationS: 3, verdict: "useful",
        command: `service:checkout-api "${v.provider}" timeout | stats count by upstream`,
        reveals: () => [
          `checkout-api → ${v.provider} (${v.region}): 42 of 44 authorise calls in the last 5 min timed out after 8 s; every other upstream answers in under 120 ms`,
        ] },
      { id: "edge.error_log", cli: "kubectl logs deployment/edge --since=15m", tool: "logs", label: "Read gateway error log", serviceId: "edge", category: "investigate", durationS: 3, verdict: "useful",
        reveals: () => [`nginx: every 5xx in the last 5 min is a ${v.symptom.code} on POST ${v.symptom.path}; GET requests are all fine`] },
      { id: "checkout.threads", cli: "promtool query instant http://prometheus:9090 'checkout_worker_threads_waiting'", tool: "dashboards", label: "Check worker threads", serviceId: "checkout", category: "investigate", durationS: 4, verdict: "useful",
        reveals: (s) => [`checkout-api: ${inUse(s)} of 100 worker threads are waiting on an outbound call; the rest are idle. All ${inUse(s)} are inside the payment client`] },
      { id: "payments.latency", cli: `promtool query instant http://prometheus:9090 'histogram_quantile(0.99, rate(payments_${exempt ? "challenge" : "authorise"}_duration_seconds_bucket[5m]))'`, tool: "dashboards", label: `Check ${v.provider} latency`, serviceId: "payments", category: "investigate", durationS: 3, verdict: "useful",
        reveals: () => [exempt
          ? `${v.provider} ${v.region}: challenge p99 7.8 s (normally 210 ms), 72% timeouts. Every card order waits on the check before it can be paid`
          : `${v.provider} ${v.region}: authorise p99 7.8 s (normally 210 ms), 72% timeouts. ${v.fallbackName} is idle at 0 req/s`] },
      { id: "checkout.deploys", cli: "kubectl rollout history deployment/checkout", tool: "deploys", label: "View recent deploys", serviceId: "checkout", category: "investigate", durationS: 3, verdict: "useful",
        reveals: () => innocentDeploy
          ? [v.deploy.history]
          : [`v207 by {deployer}, 9 h ago: "receipts email template"; it has run clean since. No config changes today`] },
      { id: "checkout.payment_config", cli: "kubectl describe deployment/checkout", tool: "deploys", label: exempt ? "View card check config" : "View payment config", serviceId: "checkout", category: "investigate", durationS: 3, verdict: "useful",
        effect: (s) => ({ ...s, sawConfig: 1 }),
        reveals: () => [v.configLine] },
      { id: "checkout.rollback", cli: "kubectl rollout undo deployment/checkout", tool: "deploys", label: innocentDeploy ? v.deploy.rollbackLabel : "Roll back to v206", serviceId: "checkout", category: "mitigate", durationS: 30, verdict: "wasted",
        available: (s) => s.rolledBack === 0,
        effect: (s) => ({ ...s, rolledBack: 1 }),
        reveals: () => [innocentDeploy ? v.deploy.rollbackDone : "rollback to v206 complete: 6 of 6 pods ready; threads waiting unchanged"] },
      { id: "checkout.restart", cli: "kubectl rollout restart deployment/checkout", tool: "deploys", label: "Restart pods", serviceId: "checkout", category: "mitigate", durationS: 15, verdict: "harmful", sideEffectBp: 4000,
        effect: (s) => ({ ...s, blocked: 12_000, restarts: s.restarts + 1 }),
        reveals: () => ["rolling restart done: 6 of 6 pods ready, threads reset"] },
      { id: "checkout.enable_fallback", cli: `kubectl exec deployment/checkout -- ${v.fixCommand}`, tool: "deploys", label: v.fallbackLabel, serviceId: "checkout", category: "fix", durationS: 20, verdict: "useful",
        command: v.fixCommand,
        // The config change is only on offer once the player has opened the config that says it exists.
        available: (s) => s.fallback === 0 && s.sawConfig === 1,
        effect: (s) => ({ ...s, fallback: 1 }),
        reveals: () => [v.fallbackDone] },
      ...(exempt
        ? [
            { id: "checkout.hold_orders", cli: "kubectl exec deployment/checkout -- config set checkout.threeds.hold_on_timeout = true", tool: "deploys" as const, label: "Hold card orders until the check answers", serviceId: "checkout", category: "mitigate" as const, durationS: 15, verdict: "wasted" as const,
              command: "config set checkout.threeds.hold_on_timeout = true",
              available: (s: Blinks) => s.fallback === 0 && s.sawConfig === 1 && s.held === 0,
              effect: (s: Blinks) => ({ ...s, held: 1, blocked: Math.min(s.blocked, 20_000) }),
              reveals: () => [`card orders now show "payment pending" while they wait: 188 orders held, none confirmed. Threads freed for now, but every held order still waits on ${v.provider} for its answer`] },
            { id: "checkout.skip_check", cli: "kubectl exec deployment/checkout -- config set checkout.threeds.enabled = false", tool: "deploys" as const, label: "Turn the card check off", serviceId: "checkout", category: "mitigate" as const, durationS: 10, verdict: "harmful" as const, sideEffectBp: 3000,
              command: "config set checkout.threeds.enabled = false",
              available: (s: Blinks) => s.fallback === 0 && s.sawConfig === 1,
              effect: (s: Blinks) => ({ ...s, fallback: 1, skipped: 1 }),
              reveals: () => ["card check off for every order: threads are draining, but all card orders now go through with no issuer check, including the large ones. Chargebacks are on us"] },
          ]
        : [
            { id: "checkout.raise_timeout", cli: "kubectl exec deployment/checkout -- config set payments.timeout_ms = 15000", tool: "deploys" as const, label: "Raise the payment timeout to 15 s", serviceId: "checkout", category: "mitigate" as const, durationS: 10, verdict: "wasted" as const,
              command: "config set payments.timeout_ms = 15000",
              available: (s: Blinks) => s.fallback === 0 && s.sawConfig === 1 && s.raised === 0,
              effect: (s: Blinks) => ({ ...s, raised: 1, rate: s.rate * 2 }),
              reveals: () => ["timeout raised to 15 s: each stuck thread now waits almost twice as long before giving up, and the pool is filling faster"] },
          ]),
      ...(exempt
        ? [{ id: "orders.value_split", cli: `psql -c "SELECT width_bucket(total, ARRAY[30, 100, 500]) AS band, count(*) FROM orders WHERE status = 'pending_auth' GROUP BY 1 ORDER BY 1;"`, tool: "db" as const, label: "See what the waiting orders are worth", serviceId: "postgres", category: "investigate" as const, durationS: 3, verdict: "useful" as const,
            command: "SELECT width_bucket(total, ARRAY[30, 100, 500]) AS band, count(*) FROM orders WHERE status = 'pending_auth' GROUP BY 1 ORDER BY 1;",
            reveals: () => ["orders waiting on the card check: 212, of which 187 are under 30 (median 14), 21 are 30 to 500 and 4 are over 500"] }]
        : []),
      { id: "postgres.activity", cli: `psql -c "SELECT pid, application_name, state, now() - query_start AS runtime FROM pg_stat_activity WHERE state <> 'idle' ORDER BY runtime DESC;"`, tool: "db", label: "Inspect running queries", serviceId: "postgres", category: "investigate", durationS: 3, verdict: "wasted",
        command: "SELECT pid, application_name, state, now() - query_start AS runtime FROM pg_stat_activity WHERE state <> 'idle' ORDER BY runtime DESC;",
        reveals: () => noisyDb
          ? ["pg_stat_activity: one reporting query (analytics_ro) has run 4 min; no lock waits. checkout-api's queries all finish in under 20 ms"]
          : ["pg_stat_activity: 3 active queries, longest 0.3 s, no lock waits; checkout-api's queries finish in under 20 ms"] },
      ...(noisyDb
        ? [{ id: "postgres.cancel_report", cli: `psql -c "SELECT pg_cancel_backend(pid) FROM pg_stat_activity WHERE application_name = 'analytics_ro';"`, tool: "db" as const, label: "Cancel the reporting query", serviceId: "postgres", category: "mitigate" as const, durationS: 10, verdict: "wasted" as const,
            command: "SELECT pg_cancel_backend(pid) FROM pg_stat_activity WHERE application_name = 'analytics_ro';",
            reveals: () => ["reporting query cancelled; postgres CPU 71% → 24%. Threads waiting on checkout-api unchanged"] }]
        : []),
      { id: "global.provider_status", cli: `curl -s https://status.${v.providerLabel}.example/api/v2/status.json`, tool: "incident", label: `Open ${v.provider} status page`, serviceId: null, category: "investigate", durationS: 4, verdict: v.statusPage.honest ? "useful" : "wasted",
        reveals: () => [v.statusPage.text] },
      { id: "global.status_update", cli: `incidentctl status-page "Investigating problems paying by ${v.method === "card" ? "card" : "e-wallet"} at checkout"`, tool: "incident", label: "Post status update", serviceId: null, category: "communicate", durationS: 5, verdict: "useful",
        available: (s) => s.statusPosted === 0,
        effect: (s) => ({ ...s, statusPosted: 1 }),
        reveals: () => [`status page: "Investigating problems paying by ${v.method === "card" ? "card" : "e-wallet"} at checkout"`] },
      { ...duckAction<Blinks>(HINTS), cli: "incidentctl rubber-duck" },
      { id: "ask.deployer.changes", tool: "chat", label: "Ask the deployer what went out today", serviceId: null, category: "investigate", durationS: 30, verdict: "useful", async: true,
        ask: { to: "deployer", topic: "changes", prompt: "hey, what went out in checkout today?" },
        reveals: () => [innocentDeploy ? `{deployer}: "${v.deploy.dm}"` : `{deployer}: "v207, the receipts email template. Nothing near the payment call."`] },
      { id: "ask.infra.db", tool: "chat", label: "Ask infra about postgres", serviceId: null, category: "investigate", durationS: 25, verdict: "wasted", async: true,
        ask: { to: "infra", topic: "db", prompt: "is postgres OK? checkout is failing" },
        reveals: () => noisyDb ? [`{infra}: "the reporting job is hammering the primary again. Kill it and checkout will recover."`] : [`{infra}: "postgres is fine: CPU 22%, connections 31 of 120."`] },
      { id: "ask.support.impact", tool: "chat", label: "Ask support what customers see", serviceId: null, category: "investigate", durationS: 20, verdict: "useful", async: true,
        ask: { to: "support", topic: "impact", prompt: "what are customers seeing, and who is hit?" },
        reveals: () => [isCard ? `{support}: "the page loads fine and the pay button spins, then a timeout. Card only; we have not seen wallet failures."` : `{support}: "only people paying by e-wallet. Card and bank transfer both go through."`] },
      { id: "global.ask_secondary", cli: "incidentctl page secondary", tool: "incident", label: "Ask secondary on-call", serviceId: null, category: "communicate", durationS: 10, verdict: "useful", async: true,
        reveals: () => [`{secondary} (secondary): "only the payment step is failing. What does checkout do when the provider is slow?"`] },
    ],
    rootCauseActionIds: ["checkout.enable_fallback"],
    hints: HINTS,
    maskNotes: {
      "checkout.restart": `Restart pods emptied the stuck threads, so the errors stopped for a while. ${v.provider} was still slow, so the threads filled up again.`,
      ...(exempt ? { "checkout.hold_orders": `Holding orders freed the threads, so the errors stopped for a while. Every held order was still waiting on ${v.provider}, so the threads filled up again.` } : {}),
    },

    coldOpen: {
      scene: "cafe",
      symptom: { kind: `http_${v.symptom.code}`, surface: "checkout" },
      page: { severity: "SEV2", title: "Checkout failing at the payment step", body: "Customers of {brand} can browse and fill a cart, but paying fails. You are the primary on-call." },
      hotspots: {
        "phone.mention": { kind: "clue", label: "Phone: new mention", text: isCard ? "@{brand} the pay button just spins and then errors, can't pay by card" : "@{brand} paying with my e-wallet just times out, card still works?", appearsAt: "incident_start" },
        "table.neighbours": { kind: "clue", label: "The next table", text: "The shop loads fine for me. It only dies when I hit pay." },
        ...(innocentDeploy
          ? { "laptop.slack.deploys": { kind: "herring" as const, label: "Laptop: Slack #deploys", author: "deployer" as const, text: v.deploy.slack } }
          : { "laptop.slack.infra": { kind: "herring" as const, label: "Laptop: Slack #infra", author: "infra" as const, text: "the analytics reporting job is running long again, postgres CPU is up" } }),
        "wall.poster": { kind: "herring", label: "Poster on the wall", text: "{brand} FLASH SALE 50% today" },
      },
    },

    lessons: [
      { id: "dnf", when: (r) => r.outcome === "dnf",
        text: `${v.provider} was timing out on almost every payment, and checkout kept a thread waiting on each one until the pool ran dry. Your own code and database were fine: the fix was to stop waiting on the provider.` },
      { id: "slow-ack", when: (r) => r.ackTick !== null && r.ackTick > 300,
        text: "Acknowledging took more than 30 seconds. A fast ack tells the team someone is on it and stops the page from escalating." },
      { id: "restart-trap", when: (r) => r.actions.some((a) => a.actionId === "checkout.restart"),
        text: `Restarting checkout emptied the pool, then the threads stuck on ${v.provider} filled it again. When a dependency is the cause, a restart only resets your side of the wait.` },
      ...(exempt
        ? [
            { id: "hold-trap", when: (r: { actions: { actionId: string }[] }) => r.actions.some((a) => a.actionId === "checkout.hold_orders"),
              text: `Holding the orders freed the threads, but every held order was still waiting on ${v.provider}, so nothing was paid and the pool filled again. A hold is a queue, not a way around the slow step.` },
            { id: "open-door", when: (r: { actions: { actionId: string }[] }) => r.actions.some((a) => a.actionId === "checkout.skip_check"),
              text: "Turning the card check off ended the timeouts, but it also removed the issuer's check on every order, big ones included. A bounded exemption for small orders keeps most of the protection while the provider is down." },
          ]
        : []),
      { id: "innocent", when: (r) => r.actions.some((a) => a.actionId === "checkout.rollback" || a.actionId === "postgres.cancel_report"),
        text: noisyDb
          ? "The reporting query was loud but not blocking checkout. Before touching your own systems, confirm whether the slow part is one you call out to."
          : "The v207 deploy was recent but innocent: errors began long after it went out, and it does not touch the failing call. Check what the failing calls have in common before you roll anything back." },
      { id: "default", when: () => true,
        text: `A slow dependency looks like your own outage. The logs showed every timeout was on the call to ${v.provider}; a fallback that stops waiting on it is faster than any restart.` },
    ],
  }) as unknown as ScenarioDef<State>;
}

const RECEIPTS_DEPLOY = {
  change: "Receipts email template (#2107)",
  slack: "receipts template is live (v207), checkout looks fine on my side",
  history: `v207 by {deployer}, 61 min ago: "receipts email template"; error rate stayed flat for 35 min after it went out. The first authorise timeout was 24 min ago`,
  dm: "v207 went out about an hour ago: the receipts email template, nothing near the payment call. Why, is it acting up?",
  rollbackLabel: "Roll back to v206",
  rollbackDone: "rollback to v206 complete: 6 of 6 pods ready; threads waiting unchanged",
};

/** The variants: which provider blinks, what the fix is, what the player reads first, and what is loud. */
export const BLINKS_VARIANTS: readonly BlinksVariant[] = [
  {
    key: "",
    title: "The Payment Provider Blinks",
    summary: "Paying by card fails at the last step, and checkout is slow to answer. Where is the time going?",
    provider: "Kestrel Pay",
    providerLabel: "kestrel-pay",
    method: "card",
    statusPage: { honest: false, text: `Kestrel Pay status: "All systems operational." (last updated 41 min ago, and it disagrees with your own timeout numbers)` },
    fallbackName: "Larkspur",
    fallbackLabel: "Route card payments to Larkspur",
    fallbackDone: "config applied: card authorisations that time out are re-routed to the secondary provider; checkout is draining its stuck threads",
    routedLine: "routed to Larkspur",
    fallbackDetail: ["secondary card provider · standby", "secondary card provider · taking traffic"],
    herring: "deploy",
    mechanism: "reroute",
    spoilers: ["larkspur", "secondary provider", "route_on_timeout", "re-route", "route card"],
    pm: 241,
    configLine: "checkout-api payment config: payments.provider = kestrel-pay, payments.timeout_ms = 8000, payments.route_on_timeout = off. A secondary card provider (Larkspur) is configured and idle",
    fixCommand: "config set payments.route_on_timeout = secondary",
    deploy: RECEIPTS_DEPLOY,
    symptom: { code: 504, path: "/checkout/pay" },
    region: "eu-west",
  },
  {
    key: "wallet",
    title: "The E-wallet Blinks",
    summary: "Only e-wallet payments fail, and the whole checkout feels sluggish. What is it really waiting on?",
    provider: "Mangosteen Wallet",
    providerLabel: "mangosteen-wallet",
    method: "wallet",
    statusPage: { honest: true, text: `Mangosteen Wallet status: "Degraded performance: slow confirmations for merchants in ap-southeast. We are investigating." (posted 18 min ago)` },
    fallbackName: "Deferred capture",
    fallbackLabel: "Accept e-wallet payments and capture later",
    fallbackDone: "config applied: e-wallet orders are accepted now and captured from a queue once the provider recovers; checkout is draining its stuck threads",
    routedLine: "accepted for deferred capture",
    fallbackDetail: ["capture queue · idle", "capture queue · taking orders"],
    herring: "db",
    mechanism: "reroute",
    spoilers: ["deferred", "capture", "wallet.deferred_capture", "capture later"],
    pm: 242,
    configLine: "checkout-api payment config: wallet.provider = mangosteen-wallet, wallet.timeout_ms = 8000, wallet.deferred_capture = false. A capture queue is configured and idle",
    fixCommand: "config set wallet.deferred_capture = true",
    deploy: RECEIPTS_DEPLOY,
    symptom: { code: 503, path: "/checkout/wallet" },
    region: "ap-southeast",
  },
  {
    key: "3ds",
    title: "The Card Check Blinks",
    summary: "Card payments hang at the bank check step and the pay button spins. What are the orders waiting for?",
    provider: "Halyard 3DS",
    providerLabel: "halyard-3ds",
    method: "card",
    statusPage: { honest: true, text: `Halyard 3DS status: "Partial outage: card authentication is slow for issuers in us-east." (posted 12 min ago)` },
    fallbackName: "Low-value exemption",
    fallbackLabel: "Exempt orders under 30 from the card check",
    fallbackDone: "config applied: orders under 30 skip the card check and are paid straight away; larger orders still wait for it. Checkout is draining its stuck threads, and the exempt orders carry the fraud risk while the check is down",
    routedLine: "exempted from the card check (under 30)",
    fallbackDetail: ["exemption rule · off", "exemption rule · under 30"],
    herring: "rules",
    mechanism: "exempt",
    spoilers: ["3ds", "threeds", "card check", "exempt", "halyard"],
    pm: 243,
    configLine: "checkout-api card check config: threeds.provider = halyard-3ds, threeds.challenge_timeout_ms = 8000, threeds.exempt_below = 0 (no exemptions), threeds.hold_on_timeout = false, threeds.enabled = true",
    fixCommand: "config set checkout.threeds.exempt_below = 3000",
    deploy: {
      change: "Challenge rules for big baskets (#2131)",
      slack: "the challenge rules for big baskets went out at lunch (v207), nothing else changed",
      history: `v207 by {deployer}, 61 min ago: "challenge rules for big baskets"; it only affects orders over 500, and the error rate stayed flat for 35 min after it went out. The first challenge timeout was 24 min ago`,
      dm: "v207 went out about an hour ago: the challenge rules for big baskets. It only touches orders over 500, about 1 in 40. Why, is it acting up?",
      rollbackLabel: "Roll back the challenge rules to v206",
      rollbackDone: "checkout-api rolled back to v206: 6 of 6 pods ready; challenge rate 31% → 30%, threads waiting unchanged",
    },
    symptom: { code: 504, path: "/checkout/pay" },
    region: "us-east",
  },
];
