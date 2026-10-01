import { defineScenario, type Rng, type ScenarioDef } from "@pitwall/engine";
import { duckAction } from "../../duck";

/**
 * A2, The Regex That Ate the CPU (M4 research A2; grounded in the Cloudflare WAF outage of 2 July 2019).
 * A config change, not a code deploy, ships a rule with a backtracking regex. The layer that runs it
 * pegs its CPU and requests time out. Capacity only buys minutes, because the bad rule follows the load.
 *
 * Units: demand and capacity are in milli-percent of one fleet's CPU (100_000 = one fleet at 100%).
 */
type RegexCpu = {
  /** CPU the bad rule burns on top of the base load; it grows as more matching input arrives. */
  extra: number;
  growth: number;
  /** 1 while the bad config is live, 0 after the rollback. */
  rule: number;
  /** 1 while the rule (or the whole WAF or validator) is switched off. */
  disabled: number;
  scale: number;
  restarts: number;
  statusPosted: number;
  ducks: number;
};

export interface RegexVariant {
  /** "" for the first variant; otherwise the slug after the incident id. */
  key: string;
  /** Which layer holds the rule, and so whose CPU pegs. */
  layer: "edge" | "search";
}

export const REGEX_VARIANTS: readonly RegexVariant[] = [
  { key: "", layer: "edge" },
  { key: "search-validator", layer: "search" },
];

const BASE = 42_000;
const CAP = 100_000;
const cap = (s: RegexCpu) => CAP * (1 + s.scale);
const active = (s: RegexCpu) => s.rule === 1 && s.disabled === 0;
const demand = (s: RegexCpu) => BASE + (active(s) ? s.extra : 0);
const cpuPct = (s: RegexCpu) => Math.min(100, Math.floor((demand(s) * 100) / cap(s)));
const errorRateBp = (s: RegexCpu): number => {
  const over = demand(s) - cap(s);
  const timeouts = over <= 0 ? 0 : Math.min(6000, Math.floor((over * 10_000) / demand(s)));
  // With the rule switched off but the config still live, abusive input reaches the app unfiltered.
  return timeouts + (s.rule === 1 && s.disabled === 1 ? 350 : 0);
};
const jitter = (rng: Rng, spread: number) => (rng.next() - 0.5) * spread;

const HINTS = [
  "The CPU is pegged. What is that service actually spending it on: the traffic, or something it does to every request?",
  "If more capacity only buys minutes, was capacity ever the problem?",
  "What changed recently that never showed up in the code deploys?",
];

export function regexCpu(v: RegexVariant): ScenarioDef<RegexCpu> {
  const edge = v.layer === "edge";
  /** The service id of the layer that holds the rule. */
  const L = v.layer;
  const layerLabel = edge ? "edge-gateway" : "search-api";
  const cfgNow = edge ? "config v37" : "config v52";
  const cfgOld = edge ? "config v36" : "config v51";
  const ruleName = edge ? "waf custom rule 100154" : "query validator rule safe-query";
  const scaleUnit = edge ? "gateway nodes" : "search-api pods";
  const path = () => (edge ? "GET /products" : "GET /search");

  const sc = defineScenario<RegexCpu>({
    id: v.key === "" ? "regex-cpu" : `regex-cpu:${v.key}`,
    title: "The Regex That Ate the CPU",
    summary: edge
      ? "Every page hangs, then times out. The gateway CPU is pegged. Is it traffic?"
      : "Search hangs, then times out. Search-api CPU is pegged. Is it traffic?",
    difficulty: "normal",
    timeLimitS: 480,
    parBp: 310,
    slo: { availability: 99.9, budgetRequests: 5000 },
    trafficPerTick: 2,

    services: [
      { id: "edge", label: "edge-gateway", x: 12, y: 50, detail: (s) => (edge ? `nginx + waf · ${cfgFor(s)} · ${2 * (1 + s.scale)} nodes` : "nginx · 2 nodes") },
      { id: "shop", label: "shop-api", x: 46, y: 18, detail: () => "v204 · 4 pods" },
      { id: "search", label: "search-api", x: 46, y: 82, detail: (s) => (edge ? "v89 · 4 pods" : `v89 · ${cfgFor(s)} · ${4 * (1 + s.scale)} pods`) },
      edge
        ? { id: "store", label: "postgres", x: 84, y: 30, detail: () => "primary · max 200 conns" }
        : { id: "store", label: "search-index", x: 84, y: 82, detail: () => "elasticsearch · 3 nodes" },
    ],
    edges: [
      { from: "edge", to: "shop" },
      { from: "edge", to: "search" },
      { from: "shop", to: "store" },
      { from: "search", to: "store" },
    ],

    setup: (rng) => ({ extra: 62_000 + rng.int(8001), growth: 40 + rng.int(11), rule: 1, disabled: 0, scale: 0, restarts: 0, statusPosted: 0, ducks: 0 }),
    dynamics: (s) => (active(s) ? { ...s, extra: s.extra + s.growth } : s),
    errorRateBp,
    health: (s) => {
      const err = errorRateBp(s);
      const cpu = cpuPct(s);
      const layerHealth = cpu >= 100 ? "crit" : cpu >= 80 ? "warn" : "ok";
      return {
        edge: edge ? layerHealth : err >= 1000 ? "crit" : err >= 100 ? "warn" : "ok",
        shop: "ok",
        search: edge ? "ok" : layerHealth,
        store: "ok",
      };
    },
    mitigated: (s) => s.rule === 1 && (s.scale > 0 || s.restarts > 0 || s.disabled === 1),
    resolvedWhen: (s) => s.rule === 0,

    metrics: [
      { id: "edge.rps", serviceId: "edge", label: "Requests", unit: "req/s", max: 40, value: (_s, n) => 27 + jitter(n, 3) },
      { id: "edge.err", serviceId: "edge", label: "5xx rate", unit: "%", max: 60, warn: 1, crit: 2, value: (s, n) => Math.max(0, errorRateBp(s) / 100 + (errorRateBp(s) ? jitter(n, 0.8) : 0)) },
      { id: "edge.cpu", serviceId: "edge", label: "CPU", unit: "%", max: 100, warn: 70, crit: 90, value: (s, n) => (edge ? Math.min(100, cpuPct(s) + jitter(n, 2)) : 31 + jitter(n, 6)) },
      { id: "shop.cpu", serviceId: "shop", label: "CPU", unit: "%", max: 100, warn: 70, crit: 90, value: (_s, n) => (edge ? 52 : 26) + jitter(n, 6) },
      { id: "shop.p99", serviceId: "shop", label: "p99 latency", unit: "ms", max: 2000, warn: 800, crit: 1500, value: (_s, n) => 120 + jitter(n, 30) },
      { id: "search.cpu", serviceId: "search", label: "CPU", unit: "%", max: 100, warn: 70, crit: 90, value: (s, n) => (edge ? 34 + jitter(n, 6) : Math.min(100, cpuPct(s) + jitter(n, 2))) },
      { id: "search.p99", serviceId: "search", label: "p99 latency", unit: "ms", max: 8000, warn: 1000, crit: 3000, value: (s, n) => Math.max(0, (edge ? 160 : 160 + Math.max(0, cpuPct(s) - 60) * 90) + jitter(n, 40)) },
      { id: "store.cpu", serviceId: "store", label: "CPU", unit: "%", max: 100, warn: 70, crit: 90, value: (_s, n) => (edge ? 22 : 57) + jitter(n, 8) },
    ],

    logs: [
      { id: "edge.timeout", serviceId: "edge", level: "ERROR", everyTicks: 6, when: (s) => errorRateBp(s) >= 100,
        text: (_s, r) => `upstream timed out (110: Connection timed out) while reading response header, client 10.0.${r.int(256)}.${r.int(256)}, request "${path()}/${1000 + r.int(9000)}"` },
      { id: "edge.queue", serviceId: "edge", level: "WARN", everyTicks: 11, when: (s) => edge && cpuPct(s) >= 100,
        text: (_s, r) => `worker connections are not enough: ${30 + r.int(90)} requests waiting for a worker` },
      { id: "edge.rule_slow", serviceId: "edge", level: "WARN", everyTicks: 9, when: (s) => edge && active(s),
        text: (_s, r) => `waf: custom rule 100154 took ${1800 + r.int(3200)}ms on a ${300 + r.int(900)}-byte input (budget 100ms), request passed` },
      { id: "edge.access", serviceId: "edge", level: "INFO", everyTicks: 12,
        text: (_s, r) => `GET /products/${1000 + r.int(9000)} 200 ${30 + r.int(40)}ms` },
      { id: "shop.ok", serviceId: "shop", level: "INFO", everyTicks: 15, text: (_s, r) => `GET /products/${1000 + r.int(9000)} 200 ${60 + r.int(60)}ms` },
      { id: "shop.report", serviceId: "shop", level: "INFO", everyTicks: 45, when: () => edge,
        text: (_s, r) => `scheduled job nightly-report: exported ${40_000 + r.int(9000)} rows, 3% CPU` },
      { id: "search.queue", serviceId: "search", level: "WARN", everyTicks: 11, when: (s) => !edge && cpuPct(s) >= 100,
        text: (_s, r) => `request queue length ${40 + r.int(120)}, workers busy 16 of 16` },
      { id: "search.rule_slow", serviceId: "search", level: "WARN", everyTicks: 9, when: (s) => !edge && active(s),
        text: (_s, r) => `query validation: rule safe-query took ${1800 + r.int(3200)}ms on a ${24 + r.int(40)}-char query, allowed anyway` },
      { id: "search.ok", serviceId: "search", level: "INFO", everyTicks: 16, when: (s) => edge || cpuPct(s) < 100,
        text: (_s, r) => `GET /search?q=${["helmet", "gloves", "visor", "boots", "jacket"][r.int(5)]} 200 ${60 + r.int(80)}ms` },
      { id: "store.reindex", serviceId: "store", level: "INFO", everyTicks: 40, when: () => !edge,
        text: (_s, r) => `scheduled reindex: ${20_000 + r.int(9000)} documents, segment merge running, CPU 57%` },
      { id: "store.ok", serviceId: "store", level: "INFO", everyTicks: 150, text: (_s, r) => `checkpoint complete: wrote ${1000 + r.int(900)} buffers` },
    ],

    alerts: [
      { id: "layer_cpu", serviceId: L, severity: "crit", title: edge ? "GatewayCpuSaturated" : "SearchApiCpuSaturated", description: `${layerLabel} CPU above 90%`, when: (s) => cpuPct(s) >= 90 },
      { id: "site_5xx", serviceId: "edge", severity: "crit", title: edge ? "StorefrontGatewayTimeouts" : "SearchGatewayTimeouts", description: edge ? "Storefront requests timing out above 1%" : "Search requests timing out above 1%", when: (s) => errorRateBp(s) >= 100 },
      { id: "traffic_forecast", serviceId: "edge", severity: "warn", title: "TrafficAboveForecast", description: "Requests 12% above the same hour last week", when: () => true },
    ],

    actions: [
      { id: "edge.error_log", cli: `kubectl logs deployment/edge-gateway --since=15m`, tool: "logs", label: "Read gateway error log", serviceId: "edge", category: "investigate", durationS: 3, verdict: "useful",
        reveals: () => [`nginx: every 5xx in the last 5 min is a 504, "upstream timed out" after 30 s, all on ${edge ? "every path" : "/search"}`] },
      { id: "rule.cpu", cli: `kubectl top pods -l app=${layerLabel}`, tool: "dashboards", label: `Check ${layerLabel} CPU`, serviceId: L, category: "investigate", durationS: 4, verdict: "useful",
        reveals: (s) => [`${layerLabel}: CPU ${cpuPct(s)}% on every ${edge ? "node" : "pod"}, all user time, no iowait; request volume is only 12% above last week and the ${edge ? "gateway" : "search tier"} is sized for three times that`] },
      { id: "rule.logs", cli: `kubectl logs deployment/${layerLabel} --since=1h | grep -i slow`, tool: "logs", label: `Search ${layerLabel} for slow requests`, serviceId: L, category: "investigate", durationS: 3, verdict: "useful",
        reveals: () => [edge
          ? `${layerLabel}: 94% of slow requests spend their time in ${ruleName}; a ${300}-byte input takes seconds while the same request without that rule takes 2 ms`
          : `${layerLabel}: 94% of slow requests spend their time in ${ruleName}, a regex on the q parameter; a ${24}-char query takes seconds`] },
      { id: "rule.config_history", cli: `kubectl rollout history deployment/${layerLabel}`, tool: "deploys", label: "View config history", serviceId: L, category: "investigate", durationS: 3, verdict: "useful",
        reveals: () => [edge
          ? `${cfgNow} by {deployer}, 21 min ago: "WAF: block junk input in query strings". It adds custom rule 100154, a regex with nested repetition. ${cfgOld} ran 4 days without issues. Config rolls out at the edge without a code deploy.`
          : `${cfgNow} by {deployer}, 18 min ago: "search: reject junk queries". It adds a validation regex with nested repetition on the q parameter. ${cfgOld} ran 5 days without issues. Config is applied without a code deploy.`] },
      { id: "rule.config_rollback", cli: `kubectl rollout undo deployment/${layerLabel}`, tool: "deploys", label: edge ? "Roll back gateway config to v36" : "Roll back search-api config to v51", serviceId: L, category: "fix", durationS: 30, verdict: "useful",
        available: (s) => s.rule === 1,
        effect: (s) => ({ ...s, rule: 0, disabled: 0, extra: 0, growth: 0 }),
        reveals: () => [`${cfgOld} applied to every ${edge ? "node" : "pod"}; CPU falling`] },
      { id: "rule.rollback_shop", cli: `kubectl rollout undo deployment/shop-api`, tool: "deploys", label: "Roll back shop-api to v203", serviceId: "shop", category: "mitigate", durationS: 20, verdict: "wasted",
        reveals: () => [`shop-api v203 live; ${edge ? "gateway" : "search-api"} CPU did not move, the timeouts are still there`] },
      { id: "rule.rollback_other", cli: `kubectl rollout undo deployment/${edge ? "search-api" : "edge-gateway"}`, tool: "deploys", label: edge ? "Roll back search-api to v88" : "Roll back gateway config to v61", serviceId: edge ? "search" : "edge", category: "mitigate", durationS: 20, verdict: "wasted",
        reveals: () => [edge ? "search-api v88 live; the gateway CPU did not move, the timeouts are still there" : "gateway config v61 applied; search-api CPU did not move, the timeouts are still there"] },
      { id: "rule.scale_out", cli: `kubectl scale deployment/${layerLabel} --replicas=${edge ? 4 : 8}`, tool: "deploys", label: edge ? "Add gateway nodes" : "Add search-api pods", serviceId: L, category: "mitigate", durationS: 20, verdict: "wasted",
        available: (s) => s.scale === 0,
        effect: (s) => ({ ...s, scale: s.scale + 1 }),
        reveals: () => [`${scaleUnit} doubled; CPU dropped for now`] },
      { id: "rule.restart", cli: `kubectl rollout restart deployment/${layerLabel}`, tool: "deploys", label: edge ? "Restart the gateway fleet" : "Restart search-api pods", serviceId: L, category: "mitigate", durationS: 15, verdict: "harmful", sideEffectBp: 3500,
        effect: (s) => ({ ...s, extra: Math.min(s.extra, 25_000), restarts: s.restarts + 1 }),
        reveals: () => [`rolling restart done, still on ${cfgNow}; dropped connections during the restart, at peak traffic`] },
      { id: "rule.disable", cli: `flagctl disable ${edge ? "waf" : "query-validation"}`, tool: "deploys", label: edge ? "Disable the WAF" : "Turn off search query validation", serviceId: L, category: "mitigate", durationS: 10, verdict: "harmful", sideEffectBp: 2500,
        available: (s) => s.disabled === 0 && s.rule === 1,
        effect: (s) => ({ ...s, disabled: 1 }),
        reveals: () => [edge ? "waf: mode set to off; every rule skipped, including the managed security rules" : "search-api: query validation off; raw q values now reach the index"] },
      { id: "traffic.compare", cli: "promtool query instant http://prometheus:9090 'sum(rate(http_requests_total[5m])) / sum(rate(http_requests_total[5m] offset 1w))'", tool: "dashboards", label: "Compare traffic with last week", serviceId: "edge", category: "investigate", durationS: 4, verdict: "wasted",
        reveals: () => ["requests 12% above the same hour last week, a promo email went out at noon; the capacity plan covers 3x that"] },
      { id: "job.report", cli: `kubectl logs deployment/${edge ? "shop-api" : "search-index"} --since=1h | grep -i ${edge ? "nightly-report" : "reindex"}`, tool: "logs", label: edge ? "Check the nightly report job" : "Check the reindex job", serviceId: edge ? "shop" : "store", category: "investigate", durationS: 3, verdict: "wasted",
        reveals: () => [edge ? "nightly-report finished on time, 3% CPU on shop-api, not on the request path" : "reindex job is in a segment merge, index nodes at 57% CPU; search reads are unaffected"] },
      { id: "shop.deploys", cli: "kubectl rollout history deployment/shop-api", tool: "deploys", label: "View recent code deploys", serviceId: "shop", category: "investigate", durationS: 3, verdict: "wasted",
        reveals: () => [`shop-api v204 by {secondary}, 41 min ago: "resize product images on upload". p99 did not move at deploy time`] },
      { id: "global.status_update", cli: `incidentctl status-page "Investigating slow and failing ${edge ? 'page loads' : 'searches'}"`, tool: "incident", label: "Post status update", serviceId: null, category: "communicate", durationS: 5, verdict: "useful",
        available: (s) => s.statusPosted === 0,
        effect: (s) => ({ ...s, statusPosted: 1 }),
        reveals: () => [`status page: "Investigating slow and failing ${edge ? "page loads" : "searches"}"`] },
      { ...duckAction<RegexCpu>(HINTS), cli: "incidentctl rubber-duck" },
      { id: "ask.deployer.changes", tool: "chat", label: "Ask the deployer what went out today", serviceId: null, category: "investigate", durationS: 30, verdict: "useful", async: true,
        ask: { to: "deployer", topic: "changes", prompt: "hey, did anything go out today?" },
        reveals: () => [edge
          ? `{deployer}: "a WAF rule to block junk in query strings, tested on a few strings. Nothing in the code deploys."`
          : `{deployer}: "a validation rule for search queries, tested on a few strings. Config only, no code."`] },
      { id: "ask.infra.load", tool: "chat", label: "Ask infra about the load", serviceId: null, category: "investigate", durationS: 25, verdict: "wasted", async: true,
        ask: { to: "infra", topic: "load", prompt: `${layerLabel} CPU is pegged, is it the traffic?` },
        reveals: () => [`{infra}: "that's the lunch peak plus the promo email. Just add ${scaleUnit}, I'd do it now."`] },
      { id: "ask.support.impact", tool: "chat", label: "Ask support about customer impact", serviceId: null, category: "investigate", durationS: 20, verdict: "useful", async: true,
        ask: { to: "support", topic: "impact", prompt: "what are customers seeing?" },
        reveals: () => [edge
          ? `{support}: "pages hang for about 30 seconds and then say Gateway Time-out. It started roughly 20 minutes ago."`
          : `{support}: "search hangs and then says Gateway Time-out. Browsing pages still works. It started roughly 20 minutes ago."`] },
      { id: "global.ask_secondary", cli: "incidentctl page secondary", tool: "incident", label: "Ask secondary on-call", serviceId: null, category: "communicate", durationS: 10, verdict: "useful", async: true,
        reveals: () => [`{secondary} (secondary): "The code deploys look boring. What else changes production around the time the errors began, besides code deploys?"`] },
    ],
    rootCauseActionIds: ["rule.config_rollback"],
    hints: HINTS,
    maskNotes: {
      "rule.scale_out": `${edge ? "Adding gateway nodes" : "Adding search-api pods"} bought headroom, so the timeouts stopped for a while. The bad rule kept burning CPU on every matching request, and load caught up.`,
      "rule.restart": `${edge ? "Restarting the gateway fleet" : "Restarting search-api pods"} cleared the queue, then the bad rule pegged the CPU again, and the restart dropped connections at peak.`,
      "rule.disable": `${edge ? "Disabling the WAF" : "Turning off query validation"} stopped the CPU burn, but left the site without ${edge ? "its security rules" : "input validation"} while the bad config stayed live.`,
    },

    coldOpen: {
      scene: "cafe",
      symptom: { kind: "http_504", surface: edge ? "storefront" : "search" },
      page: {
        severity: "SEV2",
        title: edge ? "Storefront pages timing out" : "Search timing out",
        body: edge ? "Pages on {brand} hang and then fail with a gateway timeout. You are the primary on-call." : "Search on {brand} hangs and then fails with a gateway timeout. You are the primary on-call.",
      },
      hotspots: {
        "laptop.slack.deploys": { kind: "clue", label: "Laptop: Slack #deploys", author: "deployer", text: edge ? "pushed a config change to prod, off to a late lunch" : "shipped a config tweak, off to a late lunch" },
        "laptop.slack.infra": { kind: "herring", label: "Laptop: Slack #infra", author: "infra", text: "heads up: the promo email went out at noon, expect a bigger lunch peak today" },
        "phone.mention": { kind: "clue", label: "Phone: new mention", text: edge ? "@{brand} your site just spins and then says 504 Gateway Time-out" : "@{brand} the search box just spins and then says 504 Gateway Time-out", appearsAt: "incident_start" },
        "table.neighbours": { kind: "clue", label: "The next table", text: edge ? "Their whole site is hanging, then it just gives up." : "The search never comes back, everything else loads fine." },
        "wall.poster": { kind: "herring", label: "Poster on the wall", text: "{brand} FLASH SALE 50% today" },
      },
    },

    lessons: [
      { id: "dnf", when: (r) => r.outcome === "dnf",
        text: `The CPU burn started with ${cfgNow}, a config change with a backtracking regex, not a code deploy. When one layer pegs its CPU and the load looks normal, look at what changed in its config, not at how much capacity it has.` },
      { id: "slow-ack", when: (r) => r.ackTick !== null && r.ackTick > 300,
        text: "Acknowledging took more than 30 seconds. A fast ack tells the team someone is on it and stops the page from escalating." },
      { id: "harmful", when: (r) => r.actions.some((a) => a.actionId === "rule.disable" || a.actionId === "rule.restart"),
        text: `${edge ? "Disabling the WAF or restarting the fleet" : "Switching off validation or restarting the pods"} traded one problem for another: exposed inputs or dropped connections at peak. The bad rule was still live. Undo the change that caused it.` },
      { id: "scale-trap", when: (r) => r.actions.some((a) => a.actionId === "rule.scale_out"),
        text: "More capacity bought minutes, not a fix: a backtracking regex costs more CPU with every matching request, so load caught up. Config changes have history too. Check it before you scale." },
      { id: "default", when: () => true,
        text: "CPU pegged on one layer with normal traffic points at what that layer runs on every request. Config has a history like code does, and its rollbacks are just as fast." },
    ],
  });

  function cfgFor(s: RegexCpu): string {
    return s.rule === 1 ? cfgNow : cfgOld;
  }
  return sc;
}
