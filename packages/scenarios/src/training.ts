import { defineScenario, type Rng } from "@pitwall/engine";
import { duckAction } from "./duck";

type Training = {
  rolledBack: number;
  restarts: number;
  statusPosted: number;
  ducks: number;
};

/** A config push set the api's Redis timeout to 5 ms, so every slow cache call fails with a 500. */
const errorRateBp = (s: Training): number => (s.rolledBack ? 0 : 2500);
const jitter = (rng: Rng, spread: number) => (rng.next() - 0.5) * spread;

const TRAINING_HINTS = [
  "Which service answers with the errors, and what does its own log say?",
  "What changed recently, in code or in config?",
  "If you undo that change, what should the error rate do?",
];

/**
 * The training shift (M2.5 spec §5): one clear fault, a short clock, and a coach in the chat.
 * It is never posted to the leaderboard.
 */
export const training = defineScenario<Training>({
  id: "training-config-push",
  title: "Training: The Bad Config",
  summary: "A guided first shift: find what changed, undo it, tell your customers.",
  difficulty: "easy",
  timeLimitS: 240,
  parBp: 450,
  slo: { availability: 99.9, budgetRequests: 5000 },
  trafficPerTick: 2,
  training: true,

  services: [
    { id: "edge", label: "edge-gateway", x: 14, y: 50, detail: () => "nginx · 2 nodes" },
    { id: "api", label: "shop-api", x: 50, y: 50, detail: (s) => (s.rolledBack ? "config v11 · 3 pods" : "config v12 · 3 pods") },
    { id: "redis", label: "redis", x: 84, y: 50, detail: () => "cache · 1 primary" },
  ],
  edges: [
    { from: "edge", to: "api" },
    { from: "api", to: "redis" },
  ],

  setup: () => ({ rolledBack: 0, restarts: 0, statusPosted: 0, ducks: 0 }),
  dynamics: (s) => s,
  errorRateBp,
  health: (s) => {
    const err = errorRateBp(s);
    return { edge: err >= 1000 ? "crit" : err >= 100 ? "warn" : "ok", api: err > 0 ? "crit" : "ok", redis: "ok" };
  },
  mitigated: () => false,
  resolvedWhen: (s) => s.rolledBack === 1,

  metrics: [
    { id: "edge.rps", serviceId: "edge", label: "Requests", unit: "req/s", max: 40, value: (_s, n) => 22 + jitter(n, 3) },
    { id: "edge.err", serviceId: "edge", label: "5xx rate", unit: "%", max: 50, warn: 1, crit: 2, value: (s, n) => Math.max(0, errorRateBp(s) / 100 + (errorRateBp(s) ? jitter(n, 1) : 0)) },
    { id: "api.errors", serviceId: "api", label: "500s", unit: "/s", max: 20, warn: 1, crit: 3, value: (s, n) => Math.max(0, (errorRateBp(s) / 10000) * 22 + (errorRateBp(s) ? jitter(n, 1) : 0)) },
    { id: "api.p99", serviceId: "api", label: "p99 latency", unit: "ms", max: 1000, warn: 400, crit: 800, value: (_s, n) => Math.max(0, 95 + jitter(n, 20)) },
    { id: "redis.p99", serviceId: "redis", label: "p99 latency", unit: "ms", max: 20, warn: 10, crit: 15, value: (_s, n) => Math.max(0.3, 1.8 + jitter(n, 0.6)) },
    { id: "redis.hits", serviceId: "redis", label: "Hit rate", unit: "%", max: 100, value: (_s, n) => 94 + jitter(n, 2) },
  ],

  logs: [
    { id: "edge.500", serviceId: "edge", level: "ERROR", everyTicks: 8, when: (s) => errorRateBp(s) > 0,
      text: (_s, r) => `"GET /checkout" 500 from upstream "shop-api:8080", client 10.0.${r.int(256)}.${r.int(256)}` },
    { id: "edge.access", serviceId: "edge", level: "INFO", everyTicks: 12,
      text: (_s, r) => `GET /products/${1000 + r.int(9000)} 200 ${30 + r.int(40)}ms` },
    { id: "api.timeout", serviceId: "api", level: "ERROR", everyTicks: 6, when: (s) => s.rolledBack === 0,
      text: (_s, r) => `redis GET cart:${r.int(90000) + 10000} timed out after 5ms (timeout_ms=5); returning 500` },
    { id: "api.ok", serviceId: "api", level: "INFO", everyTicks: 14,
      text: (_s, r) => `GET /checkout 200 ${80 + r.int(60)}ms` },
    { id: "redis.ok", serviceId: "redis", level: "INFO", everyTicks: 50,
      text: (_s, r) => `slowlog: 0 entries over 10ms; ops/sec ${2000 + r.int(400)}` },
  ],

  alerts: [
    { id: "api_5xx", serviceId: "api", severity: "crit", title: "ShopApi500s", description: "shop-api returning 500s above 1%", when: (s) => errorRateBp(s) >= 100 },
  ],

  actions: [
    { id: "edge.error_log", label: "Read gateway error log", serviceId: "edge", category: "investigate", durationS: 3, verdict: "useful",
      reveals: () => ["nginx: every 5xx in the last 5 min is a 500 passed through from shop-api:8080"] },
    { id: "api.logs", label: "Read shop-api logs", serviceId: "api", category: "investigate", durationS: 3, verdict: "useful",
      reveals: () => ["shop-api: redis calls time out after 5 ms, then the request fails with a 500. Redis itself answers in about 2 ms at p99."] },
    { id: "api.config", label: "View config history", serviceId: "api", category: "investigate", durationS: 3, verdict: "useful",
      reveals: () => [`config v12 by {deployer}, 6 min ago: "tune redis for speed" — redis.timeout_ms 250 → 5. v11 ran for weeks without issues.`] },
    { id: "api.restart", label: "Restart pods", serviceId: "api", category: "mitigate", durationS: 10, verdict: "wasted", sideEffectBp: 1500,
      effect: (s) => ({ ...s, restarts: s.restarts + 1 }),
      reveals: () => ["rolling restart done: 3 of 3 pods ready, still on config v12"] },
    { id: "api.config_rollback", label: "Roll back config to v11", serviceId: "api", category: "fix", durationS: 15, verdict: "useful",
      available: (s) => s.rolledBack === 0,
      effect: (s) => ({ ...s, rolledBack: 1 }),
      reveals: () => ["config v11 applied: redis.timeout_ms = 250"] },
    { id: "redis.stats", label: "Check Redis latency", serviceId: "redis", category: "investigate", durationS: 3, verdict: "useful",
      reveals: () => ["redis: p99 1.8 ms, no evictions, no slow commands. Redis is healthy."] },
    { id: "global.status_update", label: "Post status update", serviceId: null, category: "communicate", durationS: 5, verdict: "useful",
      available: (s) => s.statusPosted === 0,
      effect: (s) => ({ ...s, statusPosted: 1 }),
      reveals: () => [`status page: "Some checkouts are failing. We have found the cause and are fixing it."`] },
    { id: "global.ask_secondary", label: "Ask secondary on-call", serviceId: null, category: "communicate", durationS: 10, verdict: "useful",
      reveals: () => [`{secondary} (secondary): "{deployer} pushed a config change a few minutes ago. Worth a look."`] },
    duckAction<Training>(TRAINING_HINTS),
  ],
  rootCauseActionIds: ["api.config_rollback"],
  hints: TRAINING_HINTS,
  maskNotes: { "api.restart": "Restart pods came back on the same config v12, so the 500s came straight back." },

  coldOpen: {
    scene: "cafe",
    symptom: { kind: "http_500", surface: "checkout" },
    page: { severity: "SEV2", title: "Checkout returning 500s", body: "Checkout requests for {brand} fail with 500 Internal Server Error. You are the primary on-call. Your secondary will coach you." },
    hotspots: {
      "laptop.slack.deploys": { kind: "clue", label: "Laptop: Slack #deploys", author: "deployer", text: "pushed config v12 (redis timeouts tuned for speed), grabbing lunch" },
      "laptop.slack.infra": { kind: "herring", label: "Laptop: Slack #infra", author: "infra", text: "redis was patched last week, no issues since" },
      "phone.mention": { kind: "clue", label: "Phone: new mention", text: "@{brand} checkout says 500 Internal Server Error??", appearsAt: "incident_start" },
      "table.neighbours": { kind: "clue", label: "The next table", text: "I can't pay, it just says Internal Server Error." },
      "wall.poster": { kind: "herring", label: "Poster on the wall", text: "{brand} FLASH SALE 50% today" },
    },
  },

  lessons: [
    { id: "dnf", when: (r) => r.outcome === "dnf",
      text: "The 500s started with config v12. When errors start right after a change, undo the change first, then investigate at leisure." },
    { id: "restart", when: (r) => r.actions.some((a) => a.actionId === "api.restart"),
      text: "Restarting pods reloads the same bad config. Rolling back the config is what fixes it." },
    { id: "default", when: () => true,
      text: "That is the loop: acknowledge, look at what customers see, find what changed, undo it, confirm it holds, and tell people. Real shifts hide the cause better." },
  ],
});
