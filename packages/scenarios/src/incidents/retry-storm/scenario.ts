import { defineScenario, type Rng, type ScenarioDef, type State } from "@pitwall/engine";
import { duckAction } from "../../duck";

/** How backed up the dependency is, in milli-percent of the point where it falls over. */
const MAX = 100_000;
/** Below this, the dependency's queue is short enough that no request fails. */
const FLOOR = 20_000;
/** The queue depth at which every failing call is being retried. */
const FULL_RETRY = 25_000;
/** A short blip of the dependency hits every 2000 ticks, starting at this tick. */
const BLIP_AT = 1500;
const BLIP_EVERY = 2000;
const BLIP_SIZE = 60_000;

type Storm = {
  /** Backlog at the dependency, milli-percent. */
  queue: number;
  /** Normal request rate to the dependency, milli-requests per second. */
  base: number;
  /** What the dependency can serve, milli-requests per second. */
  cap: number;
  /** Extra attempts the caller makes for every failed call. */
  retries: number;
  /** The player has opened the caller's config. */
  sawConfig: number;
  fixed: number;
  scaled: number;
  restarts: number;
  rolledBack: number;
  flushed: number;
  statusPosted: number;
  ducks: number;
};

/** One variant: which caller hammers which dependency, and what is loud but innocent. */
export interface StormVariant {
  /** "" for the first variant, otherwise the slug in the scenario id. */
  key: string;
  title: string;
  summary: string;
  /** The service that retries, and its map id. */
  caller: { id: "checkout" | "edge"; label: string };
  dep: { label: string; what: string };
  /** The dependency's own store, drawn behind it. */
  store: { label: string; detail: string };
  retries: number;
  /** The postmortem number the channel shows, unique per variant. */
  pm: number;
  /** Words that name the cause, lower case, for the harness (PR 30 review I3). */
  spoilers: readonly string[];
  /** Par for this variant: more retries means a steeper storm. */
  parBp: number;
  fix: { label: string; command: string; done: string; setting: string; keys: readonly string[] };
  /** The caller's policy for the dependency as `kubectl describe` shows it: every config key the fix and its decoys use. */
  policy: string;
  /** The caller's timeout key for the dependency, one of the keys in `policy`. */
  timeoutKey: string;
  /** A recent deploy of the dependency (variant a) or a loud cache (variant b). */
  herring: "dependency_deploy" | "cache";
  symptom: { code: 503 | 504; path: string };
}

const HINTS = [
  "When the original blip ended, did the load on the dependency go back to normal?",
  "How many times is one failed call tried before the caller gives up, and how long does it wait in between?",
  "If more capacity only helps for a while, what is still multiplying the load?",
];

const fq = (s: Storm) => Math.min(s.queue, FULL_RETRY);
/** What the dependency is asked for, milli-requests per second: every failing call comes back `retries` more times. */
const offered = (s: Storm): number => (s.fixed ? s.base : s.base + Math.floor((s.base * s.retries * fq(s)) / FULL_RETRY));
const errorRateBp = (s: Storm): number => (s.queue <= FLOOR ? 0 : s.queue >= MAX ? 4500 : Math.floor(((s.queue - FLOOR) * 4500) / (MAX - FLOOR)));
const p99Ms = (s: Storm): number => (s.queue <= FLOOR ? 90 : Math.min(9000, 90 + Math.floor(((s.queue - FLOOR) * 8900) / (MAX - FLOOR))));
const retryShare = (s: Storm): number => (s.fixed ? 0 : Math.floor((100 * s.retries * fq(s)) / (FULL_RETRY + s.retries * fq(s))));
const jitter = (rng: Rng, spread: number) => (rng.next() - 0.5) * spread;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export function retryStorm(v: StormVariant): ScenarioDef<State> {
  const id = v.key ? `retry-storm:${v.key}` : "retry-storm";
  const callerId = v.caller.id;
  const dep = v.dep.label;
  const cacheHerring = v.herring === "cache";
  const depDeploy = v.herring === "dependency_deploy";
  // With every failing call retried `retries` times, the dependency sees about 0.9 x (retries + 1) times its usual load, in tenths.
  const load = (v.retries + 1) * 9;

  return defineScenario<Storm>({
    id,
    title: v.title,
    summary: v.summary,
    difficulty: "hard",
    timeLimitS: 600,
    parBp: v.parBp,
    slo: { availability: 99.9, budgetRequests: 5000 },
    trafficPerTick: 2,

    services: [
      { id: "edge", label: "edge-gateway", x: 10, y: 50, detail: () => "nginx · 2 nodes" },
      { id: "checkout", label: "checkout-api", x: 40, y: 50, detail: () => "v312 · 6 pods" },
      { id: "dep", label: dep, x: 72, y: 50, detail: (s) => `${s.rolledBack ? "v57" : "v58"} · ${s.scaled ? 8 : 4} pods` },
      { id: "store", label: v.store.label, x: 90, y: 16, detail: () => v.store.detail },
    ],
    edges: [
      { from: "edge", to: "checkout" },
      { from: callerId, to: "dep" },
      { from: "dep", to: "store" },
    ],

    setup: (rng) => ({
      queue: 22_000 + rng.int(4_001),
      base: 95_000 + rng.int(10_001),
      cap: 240_000 + rng.int(20_001),
      retries: v.retries,
      sawConfig: 0,
      fixed: 0,
      scaled: 0,
      restarts: 0,
      rolledBack: 0,
      flushed: 0,
      statusPosted: 0,
      ducks: 0,
    }),
    // The dependency's brief blip is long over. The backlog now feeds itself: every failing call comes back
    // `retries` times, so the dependency is asked for more than it can serve, and stays down.
    dynamics: (s, _rng, tick) => {
      const net = offered(s) - s.cap;
      let queue = clamp(s.queue + clamp(Math.trunc(net / 500), -900, 900), 0, MAX);
      // The dependency hiccups again now and then, and with retries on, each hiccup becomes a storm.
      if (tick >= BLIP_AT && (tick - BLIP_AT) % BLIP_EVERY === 0) queue = Math.min(MAX, queue + BLIP_SIZE);
      return { ...s, queue };
    },
    errorRateBp,
    health: (s) => {
      const err = errorRateBp(s);
      return {
        edge: err >= 1000 ? "crit" : err >= 100 ? "warn" : "ok",
        checkout: callerId === "checkout" ? (s.queue >= 50_000 ? "crit" : s.queue >= FLOOR ? "warn" : "ok") : "ok",
        dep: s.queue >= FLOOR ? "warn" : "ok",
        store: cacheHerring ? "warn" : "ok",
      };
    },
    mitigated: (s) => s.fixed === 0 && s.scaled > 0,
    resolvedWhen: (s) => s.fixed === 1 && s.queue < 10_000,

    metrics: [
      { id: "edge.rps", serviceId: "edge", label: "Requests", unit: "req/s", max: 40, value: (_s, n) => 20 + jitter(n, 3) },
      { id: "edge.err", serviceId: "edge", label: "5xx rate", unit: "%", max: 50, warn: 1, crit: 2, value: (s, n) => Math.max(0, errorRateBp(s) / 100 + (errorRateBp(s) ? jitter(n, 0.6) : 0)) },
      { id: "caller.retries", serviceId: callerId, label: `Calls to ${dep} that are retries`, unit: "%", max: 100, warn: 30, crit: 60, value: (s) => retryShare(s) },
      { id: "caller.p99", serviceId: callerId, label: "p99 latency", unit: "ms", max: 9500, warn: 1000, crit: 3000, value: (s, n) => Math.max(0, p99Ms(s) + jitter(n, 60)) },
      { id: "dep.rps", serviceId: "dep", label: "Incoming requests", unit: "req/s", max: 600, warn: 250, crit: 400, value: (s, n) => Math.floor(offered(s) / 1000) + jitter(n, 6) },
      { id: "dep.cpu", serviceId: "dep", label: "CPU", unit: "%", max: 100, warn: 70, crit: 90, value: (s, n) => clamp(20 + Math.floor((offered(s) * 70) / s.cap), 5, 99) + jitter(n, 3) },
      { id: "dep.p99", serviceId: "dep", label: "p99 latency", unit: "ms", max: 9500, warn: 1000, crit: 3000, value: (s, n) => Math.max(0, p99Ms(s) + jitter(n, 40)) },
      { id: "dep.health", serviceId: "dep", label: "Health checks passing", unit: "%", max: 100, value: () => 100 },
      { id: "store.cpu", serviceId: "store", label: cacheHerring ? "Memory" : "CPU", unit: "%", max: 100, warn: 70, crit: 90, value: (_s, n) => (cacheHerring ? 82 + jitter(n, 4) : 24 + jitter(n, 8)) },
    ],

    logs: [
      { id: "edge.upstream_timeout", serviceId: "edge", level: "ERROR", everyTicks: 7, when: (s) => errorRateBp(s) >= 100,
        text: (_s, r) => `upstream timed out (110: Connection timed out) while reading response header from upstream, client 10.0.${r.int(256)}.${r.int(256)}, request "POST ${v.symptom.path}", upstream "${callerId === "edge" ? dep : "checkout-api"}:8080"` },
      { id: "edge.access", serviceId: "edge", level: "INFO", everyTicks: 12, text: (_s, r) => `GET /products/${1000 + r.int(9000)} 200 ${30 + r.int(40)}ms` },
      { id: "caller.retry", serviceId: callerId, level: "WARN", everyTicks: 5, when: (s) => s.fixed === 0 && s.queue >= FLOOR,
        text: (s, r) => `${dep} ${v.dep.what} timed out after 800ms, retry ${1 + r.int(s.retries)} of ${s.retries}, backoff 0ms, request ${100_000 + r.int(900_000)}` },
      { id: "caller.ok", serviceId: callerId, level: "INFO", everyTicks: 16, when: (s) => s.queue < MAX,
        text: (s, r) => `POST ${v.symptom.path} ${s.queue >= FLOOR ? v.symptom.code : 200} ${s.queue >= FLOOR ? 2400 + r.int(600) : 180 + r.int(120)}ms` },
      { id: "caller.policy", serviceId: callerId, level: "INFO", everyTicks: 12, when: (s) => s.fixed === 1,
        text: () => `${dep} client: ${v.fix.setting}; failed calls are no longer retried in a loop` },
      { id: "dep.queue", serviceId: "dep", level: "WARN", everyTicks: 6, when: (s) => s.queue >= FLOOR,
        text: (s, r) => `request queue depth ${Math.floor(offered(s) / 400) + r.int(30)}, ${Math.floor(errorRateBp(s) / 40)}% of requests waiting over 800ms` },
      { id: "dep.healthz", serviceId: "dep", level: "INFO", everyTicks: 20, text: () => "health check ok: /healthz 200 3ms" },
      ...(depDeploy
        ? [{ id: "dep.warm", serviceId: "dep", level: "INFO" as const, everyTicks: 200, text: () => "warehouse lookup cache warmed: 41,882 entries in 14 s" }]
        : [{ id: "store.evict", serviceId: "store", level: "WARN" as const, everyTicks: 9, text: (_s: Storm, r: Rng) => `evicted ${300 + r.int(200)} keys (maxmemory reached, policy allkeys-lru)` }]),
      { id: "store.ok", serviceId: "store", level: "INFO", everyTicks: 40, text: (_s, r) => `${v.store.label}: ${1000 + r.int(900)} ops/s, p99 ${2 + r.int(3)}ms` },
    ],

    alerts: [
      { id: "checkout_5xx", serviceId: "edge", severity: "crit", title: "GatewayErrorRate", description: "5xx above 1% at the gateway", when: (s) => errorRateBp(s) >= 100 },
      { id: "dep_latency", serviceId: "dep", severity: "warn", title: `${dep[0]!.toUpperCase()}${dep.split("-")[0]!.slice(1)}LatencyP99`, description: `${dep} p99 above 1 s`, when: (s) => s.queue >= 30_000 },
      ...(cacheHerring ? [{ id: "cache_memory", serviceId: "store", severity: "warn" as const, title: "SessionCacheMemory", description: `${v.store.label} memory above 80%`, when: () => true }] : []),
    ],

    actions: [
      { id: "edge.error_log", cli: "kubectl logs deployment/edge --since=15m", tool: "logs", label: "Read gateway error log", serviceId: "edge", category: "investigate", durationS: 3, verdict: "useful",
        reveals: () => [`nginx: every 5xx in the last 5 min is a ${v.symptom.code} on POST ${v.symptom.path}; the timeouts come from ${callerId === "edge" ? dep : "checkout-api"}`] },
      { id: "caller.retry_logs", cli: `logcli query 'service:${v.caller.label} "${dep}" retry | stats count by attempt'`, tool: "logs", label: `Search ${v.caller.label} retries`, serviceId: callerId, category: "investigate", durationS: 3, verdict: "useful",
        command: `service:${v.caller.label} "${dep}" retry | stats count by attempt`,
        reveals: (s) => [`${v.caller.label} → ${dep}: ${retryShare(s) || 72}% of the calls in the last 5 min are retries (max ${v.retries} extra attempts per call, backoff 0 ms). Every failed call is sent again at once`] },
      { id: "dep.incident_log", cli: `logcli query 'service:${dep} level:(WARN OR ERROR) | timeline'`, tool: "logs", label: `Read the ${dep} event log`, serviceId: "dep", category: "investigate", durationS: 3, verdict: "useful",
        command: `service:${dep} level:(WARN OR ERROR) | timeline`,
        reveals: () => [`${dep}: a 38 s burst of 5xx started 14 min ago (${v.store.label} failover) and ended 13 min ago. Health checks have passed since, but the queue never drained and the request rate is about ${Math.floor(load / 10)}.${load % 10}x its usual`] },
      { id: "dep.rate", cli: `promtool query instant http://prometheus:9090 'sum(rate(http_requests_total{service="${dep}"}[1m]))'`, tool: "dashboards", label: `Check ${dep} request rate`, serviceId: "dep", category: "investigate", durationS: 4, verdict: "useful",
        reveals: (s) => [`${dep}: ${Math.floor(offered(s) / 1000)} req/s in, normally ${Math.floor(s.base / 1000)}; it can serve about ${Math.floor(s.cap / 1000)}. The blip is over, the load is not`] },
      { id: "dep.health", cli: `curl -s http://${dep}:8080/healthz`, tool: "dashboards", label: `Check ${dep} health`, serviceId: "dep", category: "investigate", durationS: 3, verdict: "wasted",
        reveals: () => [`${dep}: 100% of health checks pass, no errors from ${v.store.label}. It looks healthy while every real request waits`] },
      { id: "caller.deploys", cli: `kubectl describe deployment/${callerId}`, tool: "deploys", label: "View recent deploys and config", serviceId: callerId, category: "investigate", durationS: 3, verdict: "useful",
        effect: (s) => ({ ...s, sawConfig: 1 }),
        reveals: () => [callerId === "edge"
          ? `edge-gateway v33 by {deployer}, 5 days ago; auth call policy in config: ${v.policy}. Nothing changed today`
          : `checkout-api v312 by {deployer}, 4 days ago; inventory client policy in config: ${v.policy}. Nothing changed today`] },
      { id: "caller.fix", cliKeys: ["config", "set", `${v.fix.keys[0]}=${v.fix.keys[1]}`], cli: `kubectl exec deployment/${callerId} -- sh -c "${v.fix.command.split("\n").join(" && ")}"`, tool: "deploys", label: v.fix.label, serviceId: callerId, category: "fix", durationS: 15, verdict: "useful",
        command: v.fix.command,
        // Only on offer once the player has opened the caller's config and seen the policy it would change.
        available: (s) => s.fixed === 0 && s.sawConfig === 1,
        effect: (s) => ({ ...s, fixed: 1 }),
        reveals: () => [v.fix.done] },
      { id: "caller.timeout", cliKeys: ["config", "set", v.timeoutKey], cli: `kubectl exec deployment/${callerId} -- config set ${v.timeoutKey} = 3000`, tool: "deploys", label: `Raise the ${dep} client timeout to 3 s`, serviceId: callerId, category: "mitigate", durationS: 10, verdict: "wasted",
        command: `config set ${v.timeoutKey} = 3000`,
        available: (s) => s.fixed === 0 && s.sawConfig === 1,
        reveals: () => [`timeout raised to 3 s: calls wait longer before failing, but each failure is still retried ${v.retries} times, so the request rate on ${dep} is unchanged`] },
      { id: "dep.scale_up", cliKeys: ["scale", "deployment/dep"], cli: `kubectl scale deployment/${dep} --replicas=8`, tool: "deploys", label: `Scale ${dep} to 8 pods`, serviceId: "dep", category: "mitigate", durationS: 25, verdict: "wasted",
        available: (s) => s.scaled === 0,
        effect: (s) => ({ ...s, scaled: 1, cap: s.cap + 90_000, queue: Math.min(s.queue, 10_000) }),
        reveals: () => [`${dep} scaled 4 → 8 pods: the queue drained and 5xx dropped`] },
      { id: "dep.restart", cliKeys: ["rollout", "restart", "deployment/dep"], cli: `kubectl rollout restart deployment/${dep}`, tool: "deploys", label: `Restart ${dep} pods`, serviceId: "dep", category: "mitigate", durationS: 15, verdict: "harmful", sideEffectBp: 4500,
        effect: (s) => ({ ...s, queue: MAX, restarts: s.restarts + 1 }),
        reveals: () => [`${dep} rolling restart done: 4 of 4 pods ready. Every caller reconnected and retried at once; the queue filled instantly`] },
      ...(depDeploy
        ? [{ id: "dep.rollback", cliKeys: ["rollout", "undo", "deployment/dep"], cli: `kubectl rollout undo deployment/${dep}`, tool: "deploys" as const, label: `Roll back ${dep} to v57`, serviceId: "dep", category: "mitigate" as const, durationS: 30, verdict: "wasted" as const,
            available: (s: Storm) => s.rolledBack === 0,
            effect: (s: Storm) => ({ ...s, rolledBack: 1 }),
            reveals: () => [`${dep} rolled back to v57: 4 of 4 pods ready; request rate unchanged`] }]
        : [{ id: "store.flush", cliKeys: ["flushdb"], cli: "redis-cli -h sessions-cache FLUSHDB", tool: "db" as const, label: "Flush the session cache", serviceId: "store", category: "mitigate" as const, durationS: 10, verdict: "harmful" as const, sideEffectBp: 1500,
            command: "redis-cli -h sessions-cache FLUSHDB",
            available: (s: Storm) => s.flushed === 0,
            effect: (s: Storm) => ({ ...s, flushed: 1, queue: Math.min(MAX, s.queue + 15_000) }),
            reveals: () => ["cache flushed: memory 82% → 3%. Every token check now goes to the auth database; latency is up, not down"] }]),
      { id: "store.queries", cli: cacheHerring ? "redis-cli -h sessions-cache INFO memory" : `psql -c "SELECT pid, application_name, state, now() - query_start AS runtime FROM pg_stat_activity WHERE state <> 'idle' ORDER BY runtime DESC;"`, tool: "db", label: cacheHerring ? "Check the session cache" : "Inspect running queries", serviceId: "store", category: "investigate", durationS: 3, verdict: "wasted",
        command: cacheHerring ? "redis-cli -h sessions-cache INFO memory" : "SELECT pid, application_name, state, now() - query_start AS runtime FROM pg_stat_activity WHERE state <> 'idle' ORDER BY runtime DESC;",
        reveals: () => cacheHerring
          ? ["used_memory 82%, evicted_keys 61 per s, all normal for this cache; hit rate 96%. It is not blocking anything"]
          : ["pg_stat_activity: 4 active queries, longest 0.2 s, no lock waits; every query the service sends finishes in under 20 ms"] },
      { id: "global.status_update", cliKeys: ["status-page"], cli: `incidentctl status-page "Investigating errors at ${callerId === "edge" ? "sign-in" : "checkout"}"`, tool: "incident", label: "Post status update", serviceId: null, category: "communicate", durationS: 5, verdict: "useful",
        available: (s) => s.statusPosted === 0,
        effect: (s) => ({ ...s, statusPosted: 1 }),
        reveals: () => [`status page: "Investigating errors at ${callerId === "edge" ? "sign-in" : "checkout"}"`] },
      { ...duckAction<Storm>(HINTS), cli: "incidentctl rubber-duck" },
      { id: "ask.deployer.changes", tool: "chat", label: "Ask the deployer what went out today", serviceId: null, category: "investigate", durationS: 30, verdict: "useful", async: true,
        ask: { to: "deployer", topic: "changes", prompt: "hey, what went out today?" },
        reveals: () => [`{deployer}: "nothing on my side today."`] },
      { id: "ask.infra.dep", tool: "chat", label: `Ask infra about ${dep}`, serviceId: null, category: "investigate", durationS: 25, verdict: "wasted", async: true,
        ask: { to: "infra", topic: "dependency", prompt: `is ${dep} OK? it had a blip earlier` },
        reveals: () => [`{infra}: "it's green, the blip is over. Look at the caller."`] },
      { id: "ask.support.impact", tool: "chat", label: "Ask support what customers see", serviceId: null, category: "investigate", durationS: 20, verdict: "useful", async: true,
        ask: { to: "support", topic: "impact", prompt: "what are customers seeing, and did it ever recover?" },
        reveals: () => [`{support}: "it hiccuped, then got better for a minute, then it all timed out again."`] },
      { id: "global.ask_secondary", cliKeys: ["page", "secondary"], cli: "incidentctl page secondary", tool: "incident", label: "Ask secondary on-call", serviceId: null, category: "communicate", durationS: 10, verdict: "useful", async: true,
        reveals: () => [`{secondary} (secondary): "${dep} says it is healthy. Then why is everything still timing out?"`] },
    ],
    rootCauseActionIds: ["caller.fix"],
    hints: HINTS,
    maskNotes: {
      "dep.scale_up": `Scaling ${dep} drained the queue, so the errors stopped for a while. The retries were still multiplying every failure, and the next blip sent the load back over the limit.`,
    },

    coldOpen: {
      scene: "cafe",
      symptom: { kind: `http_${v.symptom.code}`, surface: callerId === "edge" ? "login" : "checkout" },
      page: { severity: "SEV2", title: callerId === "edge" ? "Sign-in timing out" : "Checkout timing out", body: `Customers of {brand} are getting timeouts ${callerId === "edge" ? "signing in" : "at checkout"}, on and off. You are the primary on-call.` },
      hotspots: {
        "phone.mention": { kind: "clue", label: "Phone: new mention", text: callerId === "edge" ? "@{brand} could sign in fine ten minutes ago, now it just spins and times out" : "@{brand} checkout worked, then it timed out, then it worked, now it's dead. Stock check maybe?", appearsAt: "incident_start" },
        "table.neighbours": { kind: "clue", label: "The next table", text: "It came back for a minute and then broke again. Weird." },
        ...(depDeploy
          ? { "laptop.slack.deploys": { kind: "herring" as const, label: "Laptop: Slack #deploys", author: "secondary" as const, text: `${dep} v58 is out (faster warehouse lookups), all green on my side` } }
          : { "laptop.slack.infra": { kind: "herring" as const, label: "Laptop: Slack #infra", author: "infra" as const, text: "the session cache is at 80% memory again, might need a bigger node" } }),
        "wall.poster": { kind: "herring", label: "Poster on the wall", text: "{brand} FLASH SALE 50% today" },
      },
    },

    lessons: [
      { id: "dnf", when: (r) => r.outcome === "dnf",
        text: `${dep} had a short blip, and the callers' retries kept it overloaded long after it recovered. Health checks passed the whole time: it was healthy and drowning. The fix was on the caller: fewer, backed-off retries.` },
      { id: "slow-ack", when: (r) => r.ackTick !== null && r.ackTick > 300,
        text: "Acknowledging took more than 30 seconds. A fast ack tells the team someone is on it and stops the page from escalating." },
      { id: "restart-trap", when: (r) => r.actions.some((a) => a.actionId === "dep.restart"),
        text: `Restarting ${dep} made every caller reconnect and retry at the same moment, the thundering herd. A dependency that is overloaded by its callers does not need a cold start.` },
      { id: "scale-trap", when: (r) => r.actions.some((a) => a.actionId === "dep.scale_up"),
        text: `Scaling ${dep} made room, so the errors stopped, but every failure was still being retried ${v.retries} times. The next blip put the load back over the limit. Capacity buys time; cutting the amplification fixes it.` },
      { id: "innocent", when: (r) => r.actions.some((a) => a.actionId === "dep.rollback" || a.actionId === "store.flush"),
        text: depDeploy
          ? `The ${dep} v58 deploy was recent but innocent: the blip came from its store, and the rate stayed high after it ended. Ask what is sending the load before you change the thing that receives it.`
          : "The session cache was loud but not the cause. When a dependency looks healthy and still fails, look at who is calling it and how often." },
      { id: "default", when: () => true,
        text: `A retry storm outlives its trigger. The dependency was healthy again minutes earlier, but callers retrying with no backoff kept it under ${Math.round(v.retries + 1)}x its normal load. Reduce the retries, do not add more capacity or restart it.` },
    ],
  }) as unknown as ScenarioDef<State>;
}

export const STORM_VARIANTS: readonly StormVariant[] = [
  {
    key: "",
    title: "Retry Storm",
    summary: "Checkout timed out, recovered, and timed out again. The dependency says it is healthy. Why is it still failing?",
    caller: { id: "checkout", label: "checkout-api" },
    dep: { label: "inventory-svc", what: "stock reservation" },
    store: { label: "stock-db", detail: "postgres · primary" },
    retries: 3,
    pm: 244,
    spoilers: ["retry", "retries", "backoff", "max_retries"],
    parBp: 520,
    fix: {
      label: "Cut checkout-api retries to one attempt",
      command: "config set inventory.client.max_retries = 1\nconfig set inventory.client.backoff = exponential",
      done: "config rolled out to checkout-api: 1 extra attempt per call, exponential backoff with jitter; the load on inventory-svc is falling",
      setting: "max_retries=1, backoff=exponential",
      keys: ["inventory.client.max_retries", "0|1|2"],
    },
    policy: "inventory.client.max_retries = 3 (0 to 3 extra attempts per call), inventory.client.backoff = none (0 ms), inventory.client.timeout_ms = 800",
    timeoutKey: "inventory.client.timeout_ms",
    herring: "dependency_deploy",
    symptom: { code: 504, path: "/checkout/reserve" },
  },
  {
    key: "auth",
    title: "Retry Storm at the Edge",
    summary: "Sign-in spins, recovers and spins again. The auth service says it is healthy. What is still calling it?",
    caller: { id: "edge", label: "edge-gateway" },
    dep: { label: "auth-svc", what: "token check" },
    store: { label: "sessions-cache", detail: "redis · 4 GB" },
    retries: 4,
    pm: 245,
    spoilers: ["retry", "retries", "backoff", "circuit breaker", "retry_budget"],
    parBp: 600,
    fix: {
      label: "Turn on the auth circuit breaker at the edge",
      command: "config set edge.auth.circuit_breaker = enabled\nconfig set edge.auth.retry_budget = 10%",
      done: "config rolled out to edge-gateway: the circuit breaker opens on failures and retries are capped at 10% of traffic; the load on auth-svc is falling",
      setting: "circuit_breaker=enabled, retry_budget=10%",
      keys: ["edge.auth.circuit_breaker", "enabled"],
    },
    policy: "edge.auth.max_retries = 4, edge.auth.backoff = none (0 ms), edge.auth.timeout_ms = 800, edge.auth.circuit_breaker = disabled (enabled opens it after repeated failures), edge.auth.retry_budget = unlimited (a percentage caps retries)",
    timeoutKey: "edge.auth.timeout_ms",
    herring: "cache",
    symptom: { code: 503, path: "/login" },
  },
];
