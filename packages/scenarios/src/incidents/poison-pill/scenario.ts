import { defineScenario, type HotspotDef, type Rng, type ScenarioDef } from "@pitwall/engine";
import { duckAction } from "../../duck";

/** Which queue, which consumer and which field is malformed: what changes between the variants (M4 research G1). */
export interface Variant {
  /** "" for the first variant. */
  key: string;
  title: string;
  summary: string;
  symptom: { kind: string; surface: string };
  page: { severity: string; title: string; body: string };
  /** Service labels on the map. */
  labels: { edge: string; api: string; queue: string; consumer: string; partner: string };
  /** What the queue service card says: the broker and the queue or topic. */
  queueCard: string;
  consumerVersion: string;
  consumerPrevVersion: string;
  /** How a message is named in a log or a console: a broker id, or a partition and an offset. */
  ref: (n: number) => string;
  /** The malformed field and what is wrong with it. */
  field: { name: string; problem: string };
  /** The gateway and API lines the customer symptom leaves. */
  edgeLine: (r: Rng) => string;
  apiLine: (r: Rng) => string;
  /** What a healthy consumer logs, and what the outside provider logs. */
  consumerOk: (r: Rng) => string;
  partnerOk: (r: Rng) => string;
  partnerStatus: string;
  /** The console commands (static; the message reference is a placeholder). */
  peekCommand: string;
  moveCommand: string;
  purgeCommand: string;
  /** The innocent recent deploy. */
  deployReveal: string;
  /** Teammate answers, read by the player as a finding and shown in chat. */
  asks: { deployer: string; infra: string; support: string; secondary: string };
  /** The cold-open clues and herrings. */
  hotspots: Record<string, HotspotDef>;
  lessons: { dnf: string; purge: string; restart: string; default: string };
  hints: string[];
}

type PoisonPill = {
  /** Messages waiting in the queue. */
  backlog: number;
  /** 1 while the bad message sits at the head of the queue. */
  poison: number;
  /** Ticks left in which consumers run clean after a restart or a purge. */
  relief: number;
  /** 1 once the player has read the bad message's reference. */
  found: number;
  /** Which message it is; formatted by the variant. */
  msgId: number;
  /** Messages the queue gains per tick while consumers crash. */
  growth: number;
  dlq: number;
  restarts: number;
  purges: number;
  scaled: number;
  statusPosted: number;
  ducks: number;
};

const errorRateBp = (s: PoisonPill): number => (s.backlog < 3000 ? 0 : Math.min(3500, Math.floor((s.backlog - 3000) / 2)));
const looping = (s: PoisonPill): boolean => s.poison === 1 && s.relief === 0;
const jitter = (rng: Rng, spread: number) => (rng.next() - 0.5) * spread;

export function poisonPill(v: Variant): ScenarioDef<PoisonPill> {
  const id = v.key ? `poison-pill:${v.key}` : "poison-pill";
  const ref = (s: PoisonPill) => v.ref(s.msgId);
  return defineScenario<PoisonPill>({
    id,
    title: v.title,
    summary: v.summary,
    difficulty: "normal",
    timeLimitS: 540,
    parBp: 290,
    slo: { availability: 99.9, budgetRequests: 5000 },
    trafficPerTick: 2,

    services: [
      { id: "edge", label: v.labels.edge, x: 10, y: 50, detail: () => "nginx · 2 nodes" },
      { id: "api", label: v.labels.api, x: 38, y: 50, detail: () => "v311 · 3 pods" },
      { id: "queue", label: v.labels.queue, x: 66, y: 22, detail: (s) => `${v.queueCard} · ${s.backlog} ready` },
      { id: "consumer", label: v.labels.consumer, x: 88, y: 50, detail: (s) => `${v.consumerVersion} · ${s.scaled ? 8 : 4} pods` },
      { id: "partner", label: v.labels.partner, x: 66, y: 82, detail: () => "external provider" },
    ],
    edges: [
      { from: "edge", to: "api" },
      { from: "api", to: "queue" },
      { from: "queue", to: "consumer" },
      { from: "consumer", to: "partner" },
    ],

    setup: (rng) => ({
      backlog: 3300 + rng.int(500),
      poison: 1,
      relief: 0,
      found: 0,
      msgId: 4096 + rng.int(60_000),
      growth: 12 + rng.int(6),
      dlq: 0,
      restarts: 0,
      purges: 0,
      scaled: 0,
      statusPosted: 0,
      ducks: 0,
    }),
    dynamics: (s) => {
      if (looping(s)) return { ...s, backlog: s.backlog + s.growth };
      return { ...s, relief: Math.max(0, s.relief - 1), backlog: Math.max(150, s.backlog - (s.poison === 1 ? 40 : 90)) };
    },
    errorRateBp,
    health: (s) => {
      const err = errorRateBp(s);
      return {
        edge: err >= 1000 ? "crit" : err >= 100 ? "warn" : "ok",
        api: err >= 1000 ? "crit" : err >= 100 ? "warn" : "ok",
        queue: s.backlog >= 6000 ? "crit" : s.backlog >= 3500 ? "warn" : "ok",
        consumer: looping(s) ? "crit" : "ok",
        partner: "ok",
      };
    },
    mitigated: (s) => s.poison === 1 && s.restarts + s.purges > 0,
    resolvedWhen: (s) => s.poison === 0 && s.backlog < 3000,

    metrics: [
      { id: "edge.rps", serviceId: "edge", label: "Requests", unit: "req/s", max: 40, value: (_s, n) => 20 + jitter(n, 3) },
      { id: "edge.err", serviceId: "edge", label: "5xx rate", unit: "%", max: 50, warn: 1, crit: 2, value: (s, n) => Math.max(0, errorRateBp(s) / 100 + (errorRateBp(s) ? jitter(n, 0.5) : 0)) },
      { id: "api.p99", serviceId: "api", label: "p99 latency", unit: "ms", max: 5500, warn: 1000, crit: 2000, value: (s, n) => Math.max(0, 130 + Math.min(4800, errorRateBp(s) * 2) + jitter(n, 40)) },
      { id: "queue.depth", serviceId: "queue", label: "Messages ready", unit: "msgs", max: 12_000, warn: 3500, crit: 6000, value: (s, n) => s.backlog + jitter(n, 30) },
      { id: "queue.consumers", serviceId: "queue", label: "Consumers connected", unit: "of 8", max: 8, value: (s, n) => (looping(s) ? n.int(2) : s.scaled ? 8 : 4) },
      { id: "consumer.restarts", serviceId: "consumer", label: "Restarts, last 10 min", unit: "restarts", max: 60, warn: 5, crit: 15, value: (s, n) => (looping(s) ? 38 + jitter(n, 6) : 0) },
      { id: "consumer.cpu", serviceId: "consumer", label: "CPU", unit: "%", max: 100, warn: 70, crit: 90, value: (s, n) => (looping(s) ? 12 : 30) + jitter(n, 6) },
      { id: "partner.p99", serviceId: "partner", label: "p99 latency", unit: "ms", max: 2000, warn: 800, crit: 1500, value: (_s, n) => 210 + jitter(n, 40) },
      { id: "partner.err", serviceId: "partner", label: "Error rate", unit: "%", max: 5, warn: 1, crit: 2, value: (_s, n) => 0.1 + jitter(n, 0.1) },
    ],

    logs: [
      { id: "edge.errors", serviceId: "edge", level: "ERROR", everyTicks: 7, when: (s) => errorRateBp(s) >= 100, text: (_s, r) => v.edgeLine(r) },
      { id: "edge.access", serviceId: "edge", level: "INFO", everyTicks: 12, text: (_s, r) => `GET /products/${1000 + r.int(9000)} 200 ${30 + r.int(40)}ms` },
      { id: "api.wait", serviceId: "api", level: "WARN", everyTicks: 9, when: (s) => errorRateBp(s) >= 100, text: (_s, r) => v.apiLine(r) },
      { id: "api.ok", serviceId: "api", level: "INFO", everyTicks: 16, when: (s) => errorRateBp(s) < 3000, text: (_s, r) => `POST /orders 201 ${90 + r.int(80)}ms` },
      { id: "queue.stuck", serviceId: "queue", level: "WARN", everyTicks: 10, when: looping,
        text: (s, r) => `${v.labels.queue}: ${s.backlog + r.int(20)} messages ready, 0 acknowledged in the last 60 s, consumers reconnecting` },
      { id: "queue.ok", serviceId: "queue", level: "INFO", everyTicks: 40, when: (s) => !looping(s), text: (s) => `${v.labels.queue}: ${s.backlog} messages ready, consumers connected` },
      { id: "consumer.crash", serviceId: "consumer", level: "ERROR", everyTicks: 8, when: looping,
        text: (_s, r) => `unhandled exception in handler, message returned to the queue (delivery ${300 + r.int(4000)})` },
      { id: "consumer.restart", serviceId: "consumer", level: "WARN", everyTicks: 25, when: looping,
        text: (_s, r) => `pod ${v.labels.consumer}-${r.int(4)}-${r.int(0x1000).toString(16).padStart(3, "0")} restarted (CrashLoopBackOff)` },
      { id: "consumer.ok", serviceId: "consumer", level: "INFO", everyTicks: 14, when: (s) => !looping(s), text: (_s, r) => v.consumerOk(r) },
      { id: "partner.ok", serviceId: "partner", level: "INFO", everyTicks: 18, text: (_s, r) => v.partnerOk(r) },
    ],

    alerts: [
      { id: "customer_5xx", serviceId: "edge", severity: "crit", title: "CustomerErrorRate", description: "5xx above 1% at the gateway", when: (s) => errorRateBp(s) >= 100 },
      { id: "queue_depth", serviceId: "queue", severity: "crit", title: "QueueDepthHigh", description: `${v.labels.queue} has more than 4000 messages ready`, when: (s) => s.backlog >= 4000 },
      { id: "consumer_restarts", serviceId: "consumer", severity: "warn", title: "PodRestartsHigh", description: `${v.labels.consumer} restarted more than 5 times in 10 minutes`, when: looping },
    ],

    actions: [
      { id: "edge.error_log", tool: "logs", label: "Read gateway error log", serviceId: "edge", category: "investigate", durationS: 3, verdict: "useful",
        reveals: () => [`nginx: every 5xx in the last 5 min comes from ${v.labels.api}; the gateway itself is fine`] },
      { id: "queue.broker_log", tool: "logs", label: "Read the broker log", serviceId: "queue", category: "investigate", durationS: 3, verdict: "useful",
        reveals: (s) => [`broker: ${s.backlog} messages ready, none acknowledged for minutes; the same delivery keeps coming back to a consumer that then disconnects`] },
      { id: "consumer.crash_query", tool: "logs", label: "Find what the consumers choke on", serviceId: "consumer", category: "investigate", durationS: 4, verdict: "useful",
        effect: (s) => ({ ...s, found: 1 }),
        reveals: (s) => [`${v.labels.consumer}: every crash is on message ${ref(s)}: field ${v.field.name} ${v.field.problem}; delivered ${800 + (s.msgId % 700)} times, never acknowledged`] },
      { id: "queue.depth", tool: "dashboards", label: "Check queue depth", serviceId: "queue", category: "investigate", durationS: 4, verdict: "useful",
        reveals: (s) => [`${v.labels.queue}: ${s.backlog} ready, publish rate normal, consume rate near zero. Publishers are fine; nothing is draining it`] },
      { id: "consumer.pods", tool: "dashboards", label: "Check consumer pods", serviceId: "consumer", category: "investigate", durationS: 4, verdict: "useful",
        reveals: () => [`${v.labels.consumer}: 4 of 4 pods running but restarting every 20 to 40 s; CPU and memory are low, so it is not load`] },
      { id: "partner.status", tool: "dashboards", label: "Check provider status", serviceId: "partner", category: "investigate", durationS: 3, verdict: "wasted",
        reveals: () => [`${v.partnerStatus}: all systems operational, p99 210 ms`] },
      { id: "consumer.deploys", tool: "deploys", label: "View recent deploys", serviceId: "consumer", category: "investigate", durationS: 3, verdict: "wasted",
        reveals: () => [v.deployReveal] },
      { id: "consumer.restart", tool: "deploys", label: "Restart consumers", serviceId: "consumer", category: "mitigate", durationS: 15, verdict: "wasted",
        effect: (s) => ({ ...s, relief: 900, restarts: s.restarts + 1 }),
        reveals: () => [`rolling restart done: 4 of 4 pods ready, consumers draining the queue`] },
      { id: "consumer.scale", tool: "deploys", label: "Scale consumers to 8", serviceId: "consumer", category: "mitigate", durationS: 15, verdict: "wasted",
        available: (s) => s.scaled === 0,
        effect: (s) => ({ ...s, scaled: 1 }),
        reveals: () => ["consumers 4 → 8; all 8 pods now crash on the same delivery"] },
      { id: "queue.peek", tool: "db", label: "Peek at the head of the queue", serviceId: "queue", category: "investigate", durationS: 4, verdict: "useful",
        command: v.peekCommand,
        effect: (s) => ({ ...s, found: 1 }),
        reveals: (s) => [`head of ${v.labels.queue}: ${ref(s)}, redelivered ${800 + (s.msgId % 700)} times; ${v.field.name} ${v.field.problem}`] },
      { id: "queue.dlq_move", tool: "db", label: "Move the bad message to the dead-letter queue", serviceId: "queue", category: "fix", durationS: 20, verdict: "useful",
        command: v.moveCommand,
        available: (s) => s.found === 1 && s.poison === 1,
        effect: (s) => ({ ...s, poison: 0, dlq: 1, relief: 0 }),
        reveals: (s) => [`${ref(s)} moved to the dead-letter queue; consumers are acknowledging again`] },
      { id: "queue.purge", tool: "db", label: "Purge the whole queue", serviceId: "queue", category: "mitigate", durationS: 20, verdict: "harmful", sideEffectBp: 4000,
        command: v.purgeCommand,
        effect: (s) => ({ ...s, backlog: 100, relief: 600, purges: s.purges + 1 }),
        reveals: () => ["queue purged: every waiting message was dropped"] },
      { id: "global.status_update", tool: "incident", label: "Post status update", serviceId: null, category: "communicate", durationS: 5, verdict: "useful",
        available: (s) => s.statusPosted === 0,
        effect: (s) => ({ ...s, statusPosted: 1 }),
        reveals: () => [`status page: "Investigating delayed order processing"`] },
      duckAction<PoisonPill>(v.hints),
      { id: "ask.deployer.changes", tool: "chat", label: "Ask the deployer what went out today", serviceId: null, category: "investigate", durationS: 30, verdict: "wasted", async: true,
        ask: { to: "deployer", topic: "changes", prompt: `did the ${v.labels.consumer} deploy change anything?` },
        reveals: () => [`{deployer}: "${v.asks.deployer}"`] },
      { id: "ask.infra.queue", tool: "chat", label: "Ask infra about the queue", serviceId: null, category: "investigate", durationS: 25, verdict: "wasted", async: true,
        ask: { to: "infra", topic: "queue", prompt: `${v.labels.queue} is backing up, is the broker OK?` },
        reveals: () => [`{infra}: "${v.asks.infra}"`] },
      { id: "ask.support.impact", tool: "chat", label: "Ask support what customers report", serviceId: null, category: "investigate", durationS: 20, verdict: "useful", async: true,
        ask: { to: "support", topic: "impact", prompt: "what are customers seeing, and who wrote in first?" },
        reveals: () => [`{support}: "${v.asks.support}"`] },
      { id: "global.ask_secondary", tool: "incident", label: "Ask secondary on-call", serviceId: null, category: "communicate", durationS: 10, verdict: "useful", async: true,
        reveals: () => [`{secondary} (secondary): "${v.asks.secondary}"`] },
    ],
    rootCauseActionIds: ["queue.dlq_move"],
    hints: v.hints,
    maskNotes: {
      "consumer.restart": "Restarting the consumers let them chew through the queue for a while. The bad message was still at the head, so they crashed on it again.",
      "queue.purge": "Purging the queue emptied it, so the errors stopped, but every waiting message was lost. The publisher re-sent the bad one and the crash loop resumed.",
    },

    coldOpen: { scene: "cafe", symptom: v.symptom, page: v.page, hotspots: v.hotspots },

    lessons: [
      { id: "dnf", when: (r) => r.outcome === "dnf", text: v.lessons.dnf },
      { id: "slow-ack", when: (r) => r.ackTick !== null && r.ackTick > 300,
        text: "Acknowledging took more than 30 seconds. A fast ack tells the team someone is on it and stops the page from escalating." },
      { id: "purge-trap", when: (r) => r.actions.some((a) => a.actionId === "queue.purge"), text: v.lessons.purge },
      { id: "restart-trap", when: (r) => r.actions.some((a) => a.actionId === "consumer.restart"), text: v.lessons.restart },
      { id: "default", when: () => true, text: v.lessons.default },
    ],
  });
}
