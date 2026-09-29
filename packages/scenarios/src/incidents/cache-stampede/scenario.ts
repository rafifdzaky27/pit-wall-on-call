import { defineScenario, type Rng, type ScenarioDef } from "@pitwall/engine";
import { duckAction } from "../../duck";

/**
 * F1, Cache Stampede After Restart (M4 research F1). The cache goes cold at once, either because a deploy
 * changed the key prefix or because infra restarted redis. Every request misses, and every miss goes to the
 * database. The database saturates, so the cache cannot refill. Capacity only helps until every key expires
 * together again.
 *
 * Units: database load is a percentage of its capacity; hit is the cache hit ratio in basis points.
 */
type Stampede = {
  base: number;
  dbBase: number;
  t: number;
  hit: number;
  /** Ticks left before the synchronised keys expire together again. */
  ttl: number;
  /** 1 once the real fix is in (old prefix restored, or misses coalesced). */
  fixed: number;
  coal: number;
  conns: number;
  failover: number;
  restarts: number;
  statusPosted: number;
  ducks: number;
};

export interface CacheVariant {
  /** "" for the first variant; otherwise the slug after the incident id. */
  key: string;
  /** What emptied the cache. */
  trigger: "prefix" | "restart";
}

export const CACHE_VARIANTS: readonly CacheVariant[] = [
  { key: "", trigger: "prefix" },
  { key: "redis-restart", trigger: "restart" },
];

const DB_CAP = 1000;
const TTL = 900;
const HIT_MAX = 9400;
const reqNow = (s: Stampede) => s.base + Math.min(900, Math.floor(s.t / 3));
const dbCap = (s: Stampede) => DB_CAP + 750 * s.conns + 700 * s.failover;
const missPerS = (s: Stampede) => Math.floor((reqNow(s) * (10_000 - s.hit)) / 10_000 / (s.coal === 1 ? 12 : 1));
const load = (s: Stampede) => Math.floor(((s.dbBase + missPerS(s)) * 100) / dbCap(s));
const errorRateBp = (s: Stampede): number => {
  const l = load(s);
  return l <= 100 ? 0 : Math.min(7000, Math.floor(((l - 100) * 10_000) / l));
};
const jitter = (rng: Rng, spread: number) => (rng.next() - 0.5) * spread;

const HINTS = [
  "The database is the loudest thing on the board. What is it being asked to do that it was not an hour ago?",
  "If the database were twice as big, would it get fewer questions, or just answer them slower?",
  "Every cache has a starting state. What state is this one in, and who or what put it there?",
];

export function cacheStampede(v: CacheVariant): ScenarioDef<Stampede> {
  const prefix = v.trigger === "prefix";
  const api = prefix ? "catalog-api" : "pricing-api";
  const db = prefix ? "postgres" : "pricing-db";
  const path = prefix ? "/products" : "/prices";
  const surface = prefix ? "storefront" : "checkout";

  return defineScenario<Stampede>({
    id: v.key === "" ? "cache-stampede" : `cache-stampede:${v.key}`,
    title: "Cache Stampede After Restart",
    summary: prefix ? "Product pages fail with 503s. Postgres is saturated. Is it the database?" : "Prices will not load and checkout fails with 503s. The database is saturated. Is it the database?",
    difficulty: "normal",
    timeLimitS: 480,
    parBp: 300,
    slo: { availability: 99.9, budgetRequests: 5000 },
    trafficPerTick: 2,

    services: [
      { id: "front", label: "storefront", x: 12, y: 50, detail: () => "nginx · 2 nodes" },
      { id: "api", label: api, x: 46, y: 50, detail: (s) => (prefix ? "v311 · 4 pods" : `v155 · 4 pods${s.coal === 1 ? " · coalescing on" : ""}`) },
      { id: "cache", label: "redis-cache", x: 84, y: 18, detail: () => "redis 7 · 1 primary" },
      { id: "db", label: db, x: 84, y: 82, detail: (s) => `primary · max ${200 * (1 + s.conns)} conns` },
    ],
    edges: [
      { from: "front", to: "api" },
      { from: "api", to: "cache" },
      { from: "api", to: "db" },
    ],

    setup: (rng) => ({
      base: 950 + rng.int(151),
      dbBase: 300 + rng.int(31),
      t: 0,
      hit: 300 + rng.int(200),
      ttl: TTL,
      fixed: 0,
      coal: 0,
      conns: 0,
      failover: 0,
      restarts: 0,
      statusPosted: 0,
      ducks: 0,
    }),
    dynamics: (s) => {
      let hit = s.hit;
      let ttl = s.ttl;
      if (hit < HIT_MAX) hit = Math.min(HIT_MAX, hit + (load(s) >= 100 ? 1 : 10));
      // Keys that all filled in the same minute all expire in the same minute, unless the fix staggers them.
      if (s.fixed === 0 && hit >= 9000) {
        ttl -= 1;
        if (ttl <= 0) {
          hit = 400;
          ttl = TTL;
        }
      }
      return { ...s, t: s.t + 1, hit, ttl };
    },
    errorRateBp,
    health: (s) => {
      const l = load(s);
      const err = errorRateBp(s);
      return {
        front: err >= 1500 ? "crit" : err >= 100 ? "warn" : "ok",
        api: err >= 1000 ? "crit" : err >= 100 ? "warn" : "ok",
        cache: "ok",
        db: l >= 100 ? "crit" : l >= 80 ? "warn" : "ok",
      };
    },
    mitigated: (s) => s.fixed === 0 && (s.conns > 0 || s.failover > 0),
    resolvedWhen: (s) => s.fixed === 1 && load(s) < 100,

    metrics: [
      { id: "front.rps", serviceId: "front", label: "Requests", unit: "req/s", max: 3500, value: (s, n) => reqNow(s) + jitter(n, 60) },
      { id: "api.err", serviceId: "api", label: "5xx rate", unit: "%", max: 70, warn: 1, crit: 2, value: (s, n) => Math.max(0, errorRateBp(s) / 100 + (errorRateBp(s) ? jitter(n, 0.8) : 0)) },
      { id: "api.p99", serviceId: "api", label: "p99 latency", unit: "ms", max: 5000, warn: 500, crit: 1500, value: (s, n) => Math.max(0, 90 + Math.max(0, load(s) - 70) * 45 + jitter(n, 20)) },
      { id: "api.cpu", serviceId: "api", label: "CPU", unit: "%", max: 100, warn: 70, crit: 90, value: (_s, n) => 34 + jitter(n, 6) },
      { id: "cache.hit", serviceId: "cache", label: "Hit ratio", unit: "%", max: 100, value: (s, n) => Math.min(100, s.hit / 100 + jitter(n, 0.4)) },
      { id: "cache.cpu", serviceId: "cache", label: "CPU", unit: "%", max: 100, warn: 70, crit: 90, value: (_s, n) => 9 + jitter(n, 3) },
      { id: "cache.mem", serviceId: "cache", label: "Memory", unit: "%", max: 100, warn: 80, crit: 92, value: (_s, n) => (prefix ? 58 : 12) + jitter(n, 2) },
      { id: "db.cpu", serviceId: "db", label: "CPU", unit: "%", max: 100, warn: 70, crit: 90, value: (s, n) => Math.min(100, load(s) + jitter(n, 2)) },
      { id: "db.conns", serviceId: "db", label: "Connections in use", unit: "%", max: 100, warn: 80, crit: 95, value: (s, n) => Math.min(100, Math.floor(load(s) * 0.95) + jitter(n, 2)) },
    ],

    logs: [
      { id: "api.fail", serviceId: "api", level: "ERROR", everyTicks: 6, when: (s) => errorRateBp(s) >= 100,
        text: (_s, r) => `${path}/${1000 + r.int(9000)} 503 upstream ${db} timed out after 3000ms (pool wait ${2800 + r.int(400)}ms)` },
      { id: "api.miss", serviceId: "api", level: "INFO", everyTicks: 5, when: (s) => s.hit < 6000,
        text: (_s, r) => (prefix ? `cache miss key=${path.slice(1)}:v3:${1000 + r.int(9000)}, loading from ${db}` : `cache miss key=price:${1000 + r.int(9000)}, loading from ${db}`) },
      { id: "api.ok", serviceId: "api", level: "INFO", everyTicks: 14, when: (s) => s.hit >= 6000, text: (_s, r) => `GET ${path}/${1000 + r.int(9000)} 200 ${8 + r.int(20)}ms` },
      { id: "api.config", serviceId: "api", level: "INFO", everyTicks: 60, when: () => prefix, text: () => "cache config: key prefix v3, ttl 900s, refresh-ahead off" },
      { id: "cache.info", serviceId: "cache", level: "INFO", everyTicks: 30, text: (s) => `keyspace hit ratio ${Math.floor(s.hit / 100)}%, evicted_keys 0, connected_clients ${180 + Math.floor(load(s) / 2)}` },
      { id: "cache.boot", serviceId: "cache", level: "WARN", everyTicks: 90, when: () => !prefix, text: () => "Server started 21 minutes ago, dataset loaded 0 keys from disk (rdb disabled)" },
      { id: "db.slow", serviceId: "db", level: "WARN", everyTicks: 7, when: (s) => load(s) >= 100,
        text: (_s, r) => `duration: ${900 + r.int(2400)} ms  statement: SELECT * FROM ${prefix ? "products" : "prices"} WHERE id = $1` },
      { id: "db.conn", serviceId: "db", level: "ERROR", everyTicks: 12, when: (s) => load(s) >= 100,
        text: () => "FATAL: remaining connection slots are reserved for non-replication superuser connections" },
      { id: "db.ok", serviceId: "db", level: "INFO", everyTicks: 20, when: (s) => load(s) < 100, text: (_s, r) => `checkpoint complete: wrote ${900 + r.int(700)} buffers` },
      { id: "front.access", serviceId: "front", level: "INFO", everyTicks: 12, text: (s, r) => `${prefix ? "GET /products" : "POST /checkout"}/${1000 + r.int(9000)} ${errorRateBp(s) >= 2000 ? 503 : 200}` },
    ],

    alerts: [
      { id: "db_cpu", serviceId: "db", severity: "crit", title: prefix ? "PostgresCpuSaturated" : "PricingDbCpuSaturated", description: `${db} CPU above 90%`, when: (s) => load(s) >= 90 },
      { id: "db_conns", serviceId: "db", severity: "warn", title: "DbConnectionsNearLimit", description: `${db} connections above 95% of the limit`, when: (s) => Math.floor(load(s) * 0.95) >= 95 },
      { id: "site_5xx", serviceId: "api", severity: "crit", title: prefix ? "CatalogApi5xx" : "PricingApi5xx", description: `${api} 5xx above 1%`, when: (s) => errorRateBp(s) >= 100 },
    ],

    actions: [
      { id: "redis.stats", tool: "db", label: "Check redis keyspace stats", serviceId: "cache", category: "investigate", durationS: 3, verdict: "useful",
        command: "redis-cli info stats keyspace",
        reveals: (s) => [prefix
          ? `redis-cache: hit ratio ${Math.floor(s.hit / 100)}% (was 96% yesterday), 41k keys and growing slowly, all under prefix cat:v3; 1.9M keys under cat:v2 are still there and untouched; uptime 41 days, evicted 0`
          : `redis-cache: hit ratio ${Math.floor(s.hit / 100)}% (was 96% yesterday), 38k keys (2.1M yesterday), evicted 0; uptime 21 minutes`] },
      { id: "api.logs", tool: "logs", label: `Search ${api} for cache misses`, serviceId: "api", category: "investigate", durationS: 3, verdict: "useful",
        reveals: () => [prefix
          ? `${api}: nearly every request logs a cache miss and goes to ${db}; the keys are all cat:v3:..., a prefix that does not appear in older logs`
          : `${api}: nearly every request logs a cache miss and goes to ${db}, for keys that were hot an hour ago`] },
      { id: "api.deploys", tool: "deploys", label: `View ${api} deploys`, serviceId: "api", category: "investigate", durationS: 3, verdict: prefix ? "useful" : "wasted",
        reveals: () => [prefix
          ? "catalog-api v311 by {deployer}, 24 min ago: \"Cache key prefix v2 to v3 for the schema change\". It ships with the new prefix; v310 ran 3 days without issues."
          : "pricing-api v155 by {secondary}, 3 h ago: \"Fix rounding on tax-inclusive prices\". p99 did not move at deploy time."] },
      { id: "redis.maintenance", tool: "deploys", label: "View redis maintenance log", serviceId: "cache", category: "investigate", durationS: 3, verdict: prefix ? "wasted" : "useful",
        reveals: () => [prefix
          ? "redis-cache: last restart 41 days ago, no maintenance window today"
          : "redis-cache: restarted by {infra} 21 min ago for the memory upgrade; persistence is off, so it came back with an empty dataset"] },
      { id: "db.connections", tool: "dashboards", label: `Check ${db} connections`, serviceId: "db", category: "investigate", durationS: 4, verdict: "wasted",
        reveals: () => [`${db}: 196 of 200 connections active, CPU 100%; every active query is the same primary-key lookup, about a millisecond each when it runs`] },
      { id: "db.slow_log", tool: "logs", label: `Read the ${db} slow query log`, serviceId: "db", category: "investigate", durationS: 3, verdict: "wasted",
        reveals: () => [`${db}: no bad plan and no long transaction; the queries are fast on their own, there are just far too many of them at once`] },
      { id: "traffic.compare", tool: "dashboards", label: "Compare traffic with last week", serviceId: "front", category: "investigate", durationS: 4, verdict: "wasted",
        reveals: () => ["requests 6% above the same hour last week; the database is sized for twice that"] },
      ...(prefix
        ? [{ id: "cache.rollback", tool: "deploys" as const, label: "Roll back catalog-api to v310", serviceId: "api", category: "fix" as const, durationS: 15, verdict: "useful" as const,
            available: (s: Stampede) => s.fixed === 0,
            effect: (s: Stampede): Stampede => ({ ...s, fixed: 1, hit: 9000 }),
            reveals: () => ["v310 live on every pod; requests read the old cat:v2 keys again and the hit ratio is back above 90%"] }]
        : []),
      { id: "cache.coalesce", tool: "deploys", label: `Enable request coalescing on ${api}`, serviceId: "api", category: "fix", durationS: 15, verdict: "useful",
        available: (s) => s.coal === 0,
        effect: (s) => ({ ...s, coal: 1, fixed: 1 }),
        reveals: () => [`${api}: one database read per missing key, the other waiting requests share it; ${db} load falling while the cache refills`] },
      { id: "db.raise_conns", tool: "db", label: `Raise ${db} max connections to 400`, serviceId: "db", category: "mitigate", durationS: 20, verdict: "wasted",
        command: "ALTER SYSTEM SET max_connections = 400;",
        available: (s) => s.conns === 0,
        effect: (s) => ({ ...s, conns: 1 }),
        reveals: () => [`${db}: max_connections 400, more queries in flight, CPU below 100% for now`] },
      { id: "db.failover", tool: "db", label: `Fail over ${db} to the replica`, serviceId: "db", category: "mitigate", durationS: 25, verdict: "wasted", sideEffectBp: 1000,
        available: (s) => s.failover === 0,
        effect: (s) => ({ ...s, failover: 1 }),
        reveals: () => [`${db}: replica promoted, a few seconds of failed writes, capacity higher for now`] },
      { id: "redis.restart", tool: "deploys", label: "Restart redis-cache", serviceId: "cache", category: "mitigate", durationS: 15, verdict: "harmful", sideEffectBp: 3000,
        effect: (s) => ({ ...s, hit: 300, ttl: TTL, restarts: s.restarts + 1 }),
        reveals: () => ["redis-cache: restarted, dataset empty again, hit ratio back at 3%"] },
      { id: "global.status_update", tool: "incident", label: "Post status update", serviceId: null, category: "communicate", durationS: 5, verdict: "useful",
        available: (s) => s.statusPosted === 0,
        effect: (s) => ({ ...s, statusPosted: 1 }),
        reveals: () => [`status page: "Investigating errors on ${surface} requests"`] },
      duckAction<Stampede>(HINTS),
      { id: "ask.deployer.changes", tool: "chat", label: "Ask the deployer what went out today", serviceId: null, category: "investigate", durationS: 30, verdict: "useful", async: true,
        ask: { to: "deployer", topic: "changes", prompt: "hey, did anything go out today?" },
        reveals: () => [prefix
          ? `{deployer}: "catalog-api v311, it renames the cache key prefix because of a schema change. It was fine in staging, why?"`
          : `{deployer}: "nothing from me. Only {secondary} shipped a rounding fix on pricing-api this morning."`] },
      { id: "ask.infra.db", tool: "chat", label: "Ask infra about the database", serviceId: null, category: "investigate", durationS: 25, verdict: "wasted", async: true,
        ask: { to: "infra", topic: "db", prompt: `${db} is at 100% CPU and out of connections, what should I do?` },
        reveals: () => [`{infra}: "it's out of connections and CPU, classic. Raise max_connections or fail over to the replica, that's what I'd do."`] },
      { id: "ask.support.impact", tool: "chat", label: "Ask support about customer impact", serviceId: null, category: "investigate", durationS: 20, verdict: "useful", async: true,
        ask: { to: "support", topic: "impact", prompt: "what are customers seeing?" },
        reveals: () => [prefix
          ? `{support}: "product pages come back with 'Service Unavailable' or take forever. It started about 25 minutes ago."`
          : `{support}: "the price line shows 'Service Unavailable' and checkout fails. It started about 20 minutes ago."`] },
      { id: "global.ask_secondary", tool: "incident", label: "Ask secondary on-call", serviceId: null, category: "communicate", durationS: 10, verdict: "useful", async: true,
        reveals: () => [`{secondary} (secondary): "The database is the victim, I think. Why did it suddenly get so many more reads than the traffic explains?"`] },
    ],
    rootCauseActionIds: prefix ? ["cache.rollback", "cache.coalesce"] : ["cache.coalesce"],
    hints: HINTS,
    maskNotes: {
      "db.raise_conns": `More ${db} connections gave the database room, so the errors stopped while the cache refilled. Every key had been written at the same moment, so they all expired together and the stampede came back.`,
      "db.failover": `Failing over ${db} bought capacity for a while. The cache kept refilling in lockstep, the keys expired together again, and the replica was hit by the same herd.`,
      "redis.restart": "Restarting redis emptied the cache again: a fresh stampede on the database, at peak.",
    },

    coldOpen: {
      scene: "cafe",
      symptom: { kind: "http_503", surface },
      page: {
        severity: "SEV2",
        title: prefix ? "Product pages failing with 503" : "Prices and checkout failing with 503",
        body: prefix ? "Product pages on {brand} return Service Unavailable. You are the primary on-call." : "Prices will not load on {brand} and checkout fails with Service Unavailable. You are the primary on-call.",
      },
      hotspots: prefix
        ? {
            "laptop.slack.deploys": { kind: "clue", label: "Laptop: Slack #deploys", author: "deployer", text: "shipped catalog-api v311 (new cache key prefix for the schema change), off to a late lunch" },
            "laptop.slack.infra": { kind: "herring", label: "Laptop: Slack #infra", author: "infra", text: "heads up: the promo email went out at noon, expect a bigger lunch peak today" },
            "phone.mention": { kind: "clue", label: "Phone: new mention", text: "@{brand} product pages keep saying Service Unavailable, then they load super slowly", appearsAt: "incident_start" },
            "table.neighbours": { kind: "clue", label: "The next table", text: "Every product page hangs. The home page is fine, though." },
            "wall.poster": { kind: "herring", label: "Poster on the wall", text: "{brand} FLASH SALE 50% today" },
          }
        : {
            "laptop.slack.infra": { kind: "clue", label: "Laptop: Slack #infra", author: "infra", text: "restarted redis-cache for the memory upgrade, took 4 minutes, all green afterwards" },
            "laptop.slack.deploys": { kind: "herring", label: "Laptop: Slack #deploys", author: "secondary", text: "pricing-api v155 is out, a rounding fix for tax-inclusive prices" },
            "phone.mention": { kind: "clue", label: "Phone: new mention", text: "@{brand} tried to pay and the total never loads. Service Unavailable, twice", appearsAt: "incident_start" },
            "table.neighbours": { kind: "clue", label: "The next table", text: "The cart fills fine but the price never shows up." },
            "wall.poster": { kind: "herring", label: "Poster on the wall", text: "{brand} FLASH SALE 50% today" },
          },
    },

    lessons: [
      { id: "dnf", when: (r) => r.outcome === "dnf",
        text: "The database was not the cause, it was the victim of an empty cache: every request missed and went to it. When the loudest system is fast on each query and just gets too many, look at what stopped absorbing the reads." },
      { id: "slow-ack", when: (r) => r.ackTick !== null && r.ackTick > 300,
        text: "Acknowledging took more than 30 seconds. A fast ack tells the team someone is on it and stops the page from escalating." },
      { id: "harmful", when: (r) => r.actions.some((a) => a.actionId === "redis.restart"),
        text: "Restarting redis emptied the cache again and brought back the stampede at peak. Restart the thing that is already cold and you start the cold over." },
      { id: "capacity-trap", when: (r) => r.actions.some((a) => a.actionId === "db.raise_conns" || a.actionId === "db.failover"),
        text: "More database capacity bought minutes, not a fix. The keys refilled in lockstep, so they expired together and the stampede returned. Shrink the herd (coalesce, or bring back the warm keys) before you grow the database." },
      { id: "default", when: () => true,
        text: "After a cache goes cold, watch the hit ratio and what the database is being asked, not just how busy it is. Coalescing misses and staggering expiry stops a stampede from coming back." },
    ],
  });
}
