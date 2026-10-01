import { defineScenario, type ActionDef, type HotspotDef, type Rng, type ScenarioDef } from "@pitwall/engine";
import { duckAction } from "../../duck";

/** Which queue, which consumer and which field is malformed: what changes between the variants (M4 research G1). */
export interface Variant {
  /** "" for the first variant. */
  key: string;
  /** One more discovery step on a partitioned broker, so a little more budget. */
  parBp?: number;
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
  /** How the queue's depth reads: the metric, and the words for "N of them waiting". */
  depth: { label: string; unit: string; word: string };
  /** What the broker log, the depth check and the consumers' crash log say. A partitioned broker's crash log does not name the record. */
  brokerReveal: (backlog: number) => string;
  depthReveal: (backlog: number) => string;
  crashReveal: (s: { msgId: number; backlog: number }) => string;
  crashLine: (r: Rng) => string;
  stuckLine: (n: number) => string;
  okLine: (n: number) => string;
  /** The console commands for a broker whose bad message sits at the head of the queue (static). */
  peekCommand: string;
  moveCommand: string;
  purgeCommand: string;
  /**
   * A broker with partitions: the bad record shows only in a partition-level view of the consumer group, and
   * the fix is to skip that one offset for the group. When set, the peek, move and purge actions give way to these.
   */
  partition?: {
    describeCommand: string;
    describeReveal: (s: { msgId: number; backlog: number }) => string;
    readCommand: string;
    readReveal: (s: { msgId: number }) => string;
    skipLabel: string;
    skipCommand: string;
    skipReveal: (s: { msgId: number }) => string;
    resetLabel: string;
    resetCommand: string;
    resetReveal: string;
  };
  /** Background chat, so that no two incidents share a postmortem, a commit hash or a filler line. */
  filler: {
    sev3: string;
    pm: string;
    pmNote: string;
    disk: { text: string; code: string };
    cert: string;
    prevSha: string;
    prevChange: string;
    apiSha: string;
    apiChange: string;
    workerSha: string;
    workerChange: string;
  };
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
  /** 1 once the player has read the bad message's reference; on a partitioned broker, 2 once they have read the record itself. */
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
  const part = v.partition;
  const purgeId = part ? "queue.reset_group" : "queue.purge";
  return defineScenario<PoisonPill>({
    id,
    title: v.title,
    summary: v.summary,
    difficulty: "normal",
    timeLimitS: 540,
    parBp: v.parBp ?? 290,
    slo: { availability: 99.9, budgetRequests: 5000 },
    trafficPerTick: 2,

    services: [
      { id: "edge", label: v.labels.edge, x: 10, y: 50, detail: () => "nginx · 2 nodes" },
      { id: "api", label: v.labels.api, x: 38, y: 50, detail: () => "v311 · 3 pods" },
      { id: "queue", label: v.labels.queue, x: 66, y: 22, detail: (s) => `${v.queueCard} · ${s.backlog} ${v.depth.word}` },
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
      { id: "queue.depth", serviceId: "queue", label: v.depth.label, unit: v.depth.unit, max: 12_000, warn: 3500, crit: 6000, value: (s, n) => s.backlog + jitter(n, 30) },
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
        text: (s, r) => v.stuckLine(s.backlog + r.int(20)) },
      { id: "queue.ok", serviceId: "queue", level: "INFO", everyTicks: 40, when: (s) => !looping(s), text: (s) => v.okLine(s.backlog) },
      { id: "consumer.crash", serviceId: "consumer", level: "ERROR", everyTicks: 8, when: looping, text: (_s, r) => v.crashLine(r) },
      { id: "consumer.restart", serviceId: "consumer", level: "WARN", everyTicks: 25, when: looping,
        text: (_s, r) => `pod ${v.labels.consumer}-${r.int(4)}-${r.int(0x1000).toString(16).padStart(3, "0")} restarted (CrashLoopBackOff)` },
      { id: "consumer.ok", serviceId: "consumer", level: "INFO", everyTicks: 14, when: (s) => !looping(s), text: (_s, r) => v.consumerOk(r) },
      { id: "partner.ok", serviceId: "partner", level: "INFO", everyTicks: 18, text: (_s, r) => v.partnerOk(r) },
    ],

    alerts: [
      { id: "customer_5xx", serviceId: "edge", severity: "crit", title: "CustomerErrorRate", description: "5xx above 1% at the gateway", when: (s) => errorRateBp(s) >= 100 },
      { id: "queue_depth", serviceId: "queue", severity: "crit", title: "QueueDepthHigh", description: `${v.labels.queue} has more than 4000 ${v.depth.word}`, when: (s) => s.backlog >= 4000 },
      { id: "consumer_restarts", serviceId: "consumer", severity: "warn", title: "PodRestartsHigh", description: `${v.labels.consumer} restarted more than 5 times in 10 minutes`, when: looping },
    ],

    actions: [
      { id: "edge.error_log", cli: `kubectl logs deployment/${v.labels.edge} --since=15m`, tool: "logs", label: "Read gateway error log", serviceId: "edge", category: "investigate", durationS: 3, verdict: "useful",
        reveals: () => [`nginx: every 5xx in the last 5 min comes from ${v.labels.api}; the gateway itself is fine`] },
      { id: "queue.broker_log", cli: `kubectl logs deployment/${v.queueCard.startsWith("Kafka") ? "kafka" : "rabbitmq"} --since=15m`, tool: "logs", label: "Read the broker log", serviceId: "queue", category: "investigate", durationS: 3, verdict: "useful",
        reveals: (s) => [v.brokerReveal(s.backlog)] },
      { id: "consumer.crash_query", cli: `kubectl logs deployment/${v.labels.consumer} --since=1h | grep -i error`, tool: "logs", label: "Find what the consumers choke on", serviceId: "consumer", category: "investigate", durationS: 4, verdict: "useful",
        // On a partitioned broker the log names no partition or offset, so it cannot be what finds the record.
        effect: (s) => (v.partition ? s : { ...s, found: 1 }),
        reveals: (s) => [v.crashReveal(s)] },
      { id: "queue.depth", cli: `promtool query instant http://prometheus:9090 '${part ? `kafka_consumergroup_lag{group="${v.labels.consumer}"}` : `rabbitmq_queue_messages_ready{queue="${v.labels.queue}"}`}'`, tool: "dashboards", label: "Check queue depth", serviceId: "queue", category: "investigate", durationS: 4, verdict: "useful",
        reveals: (s) => [v.depthReveal(s.backlog)] },
      { id: "consumer.pods", cli: `kubectl top pods -l app=${v.labels.consumer}`, tool: "dashboards", label: "Check consumer pods", serviceId: "consumer", category: "investigate", durationS: 4, verdict: "useful",
        reveals: () => [`${v.labels.consumer}: 4 of 4 pods running but restarting every 20 to 40 s; CPU and memory are low, so it is not load`] },
      { id: "partner.status", cli: `curl -s https://status.${v.labels.partner}.example/api/status`, tool: "dashboards", label: "Check provider status", serviceId: "partner", category: "investigate", durationS: 3, verdict: "wasted",
        reveals: () => [`${v.partnerStatus}: all systems operational, p99 210 ms`] },
      { id: "consumer.deploys", cli: `kubectl rollout history deployment/${v.labels.consumer}`, tool: "deploys", label: "View recent deploys", serviceId: "consumer", category: "investigate", durationS: 3, verdict: "wasted",
        reveals: () => [v.deployReveal] },
      { id: "consumer.restart", cli: `kubectl rollout restart deployment/${v.labels.consumer}`, tool: "deploys", label: "Restart consumers", serviceId: "consumer", category: "mitigate", durationS: 15, verdict: "wasted",
        effect: (s) => ({ ...s, relief: 900, restarts: s.restarts + 1 }),
        reveals: () => [`rolling restart done: 4 of 4 pods ready, consumers draining the queue`] },
      { id: "consumer.scale", cli: `kubectl scale deployment/${v.labels.consumer} --replicas=8`, tool: "deploys", label: "Scale consumers to 8", serviceId: "consumer", category: "mitigate", durationS: 15, verdict: "wasted",
        available: (s) => s.scaled === 0,
        effect: (s) => ({ ...s, scaled: 1 }),
        reveals: () => ["consumers 4 → 8; all 8 pods now crash on the same delivery"] },
      ...(part
        ? [
            // The partition-level view: the only place the stuck partition and its offset show up.
            { id: "queue.describe", cli: part.describeCommand, tool: "db", label: "Describe the consumer group", serviceId: "queue", category: "investigate", durationS: 4, verdict: "useful",
              command: part.describeCommand,
              effect: (s: PoisonPill) => ({ ...s, found: Math.max(s.found, 1) }),
              reveals: (s: PoisonPill) => [part.describeReveal(s)] } satisfies ActionDef<PoisonPill>,
            { id: "queue.read_record", cli: part.readCommand.replace("<the stuck offset>", "{offset}"), cliVars: (s: PoisonPill) => ({ offset: 1_842_000 + (s.msgId % 9000) }), tool: "db", label: "Read the record at the stuck offset", serviceId: "queue", category: "investigate", durationS: 4, verdict: "useful",
              command: part.readCommand,
              available: (s: PoisonPill) => s.found >= 1,
              effect: (s: PoisonPill) => ({ ...s, found: 2 }),
              reveals: (s: PoisonPill) => [part.readReveal(s)] } satisfies ActionDef<PoisonPill>,
            { id: "queue.skip_offset", cli: part.skipCommand.replace("<stuck offset + 1>", "{next}"), cliVars: (s: PoisonPill) => ({ next: 1_842_001 + (s.msgId % 9000) }), tool: "db", label: part.skipLabel, serviceId: "queue", category: "fix", durationS: 20, verdict: "useful",
              command: part.skipCommand,
              available: (s: PoisonPill) => s.found === 2 && s.poison === 1,
              effect: (s: PoisonPill) => ({ ...s, poison: 0, dlq: 1, relief: 0 }),
              reveals: (s: PoisonPill) => [part.skipReveal(s)] } satisfies ActionDef<PoisonPill>,
            { id: "queue.reset_group", cli: part.resetCommand, tool: "db", label: part.resetLabel, serviceId: "queue", category: "mitigate", durationS: 20, verdict: "harmful", sideEffectBp: 4000,
              command: part.resetCommand,
              effect: (s: PoisonPill) => ({ ...s, backlog: 100, relief: 600, purges: s.purges + 1 }),
              reveals: () => [part.resetReveal] } satisfies ActionDef<PoisonPill>,
          ]
        : [
            { id: "queue.peek", cli: v.peekCommand, tool: "db", label: "Peek at the head of the queue", serviceId: "queue", category: "investigate", durationS: 4, verdict: "useful",
              command: v.peekCommand,
              effect: (s: PoisonPill) => ({ ...s, found: 1 }),
              reveals: (s: PoisonPill) => [`head of ${v.labels.queue}: ${ref(s)}, redelivered ${800 + (s.msgId % 700)} times; ${v.field.name} ${v.field.problem}`] } satisfies ActionDef<PoisonPill>,
            { id: "queue.dlq_move", cli: v.moveCommand.replace("<id from the crash log>", "{msg}"), cliVars: (s: PoisonPill) => ({ msg: v.ref(s.msgId) }), tool: "db", label: "Move the bad message to the dead-letter queue", serviceId: "queue", category: "fix", durationS: 20, verdict: "useful",
              command: v.moveCommand,
              available: (s: PoisonPill) => s.found === 1 && s.poison === 1,
              effect: (s: PoisonPill) => ({ ...s, poison: 0, dlq: 1, relief: 0 }),
              reveals: (s: PoisonPill) => [`${ref(s)} moved to the dead-letter queue; consumers are acknowledging again`] } satisfies ActionDef<PoisonPill>,
            { id: "queue.purge", cli: v.purgeCommand, tool: "db", label: "Purge the whole queue", serviceId: "queue", category: "mitigate", durationS: 20, verdict: "harmful", sideEffectBp: 4000,
              command: v.purgeCommand,
              effect: (s: PoisonPill) => ({ ...s, backlog: 100, relief: 600, purges: s.purges + 1 }),
              reveals: () => ["queue purged: every waiting message was dropped"] } satisfies ActionDef<PoisonPill>,
          ]),
      { id: "global.status_update", cli: 'incidentctl status-page "Investigating delayed order processing"', tool: "incident", label: "Post status update", serviceId: null, category: "communicate", durationS: 5, verdict: "useful",
        available: (s) => s.statusPosted === 0,
        effect: (s) => ({ ...s, statusPosted: 1 }),
        reveals: () => [`status page: "Investigating delayed order processing"`] },
      { ...duckAction<PoisonPill>(v.hints), cli: "incidentctl rubber-duck" },
      { id: "ask.deployer.changes", tool: "chat", label: "Ask the deployer what went out today", serviceId: null, category: "investigate", durationS: 30, verdict: "wasted", async: true,
        ask: { to: "deployer", topic: "changes", prompt: `did the ${v.labels.consumer} deploy change anything?` },
        reveals: () => [`{deployer}: "${v.asks.deployer}"`] },
      { id: "ask.infra.queue", tool: "chat", label: "Ask infra about the queue", serviceId: null, category: "investigate", durationS: 25, verdict: "wasted", async: true,
        ask: { to: "infra", topic: "queue", prompt: `${v.labels.queue} is backing up, is the broker OK?` },
        reveals: () => [`{infra}: "${v.asks.infra}"`] },
      { id: "ask.support.impact", tool: "chat", label: "Ask support what customers report", serviceId: null, category: "investigate", durationS: 20, verdict: "useful", async: true,
        ask: { to: "support", topic: "impact", prompt: "what are customers seeing, and who wrote in first?" },
        reveals: () => [`{support}: "${v.asks.support}"`] },
      { id: "global.ask_secondary", cli: "incidentctl page secondary", tool: "incident", label: "Ask secondary on-call", serviceId: null, category: "communicate", durationS: 10, verdict: "useful", async: true,
        reveals: () => [`{secondary} (secondary): "${v.asks.secondary}"`] },
    ],
    rootCauseActionIds: [part ? "queue.skip_offset" : "queue.dlq_move"],
    hints: v.hints,
    maskNotes: {
      "consumer.restart": "Restarting the consumers let them chew through the queue for a while. The bad message was still at the head, so they crashed on it again.",
      [purgeId]: part
        ? "Resetting the group to the latest offsets skipped every waiting reservation, so the errors stopped, but all of those stock holds were lost. The bulk import re-published the bad line and the partition stalled again."
        : "Purging the queue emptied it, so the errors stopped, but every waiting message was lost. The publisher re-sent the bad one and the crash loop resumed.",
    },

    coldOpen: { scene: "cafe", symptom: v.symptom, page: v.page, hotspots: v.hotspots },

    lessons: [
      { id: "dnf", when: (r) => r.outcome === "dnf", text: v.lessons.dnf },
      { id: "slow-ack", when: (r) => r.ackTick !== null && r.ackTick > 300,
        text: "Acknowledging took more than 30 seconds. A fast ack tells the team someone is on it and stops the page from escalating." },
      { id: "purge-trap", when: (r) => r.actions.some((a) => a.actionId === purgeId), text: v.lessons.purge },
      { id: "restart-trap", when: (r) => r.actions.some((a) => a.actionId === "consumer.restart"), text: v.lessons.restart },
      { id: "default", when: () => true, text: v.lessons.default },
    ],
  });
}
