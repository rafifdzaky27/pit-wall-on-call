import { defineScenario, type ActionDef, type LogTemplate, type Rng, type RunResult, type ScenarioDef } from "@pitwall/engine";
import { duckAction } from "../../duck";

/** Which volume fills (M4 research B1). The variants differ in where the player must look and what fixes it. */
export type DiskKind = "logs" | "wal";

export interface Variant {
  /** "" for the first variant, whose id is the incident's. */
  key: "" | "wal";
  kind: DiskKind;
}

export const VARIANTS: readonly Variant[] = [
  { key: "", kind: "logs" },
  { key: "wal", kind: "wal" },
];

/** Volume usage in milli-percent, so the fill stays integer (spec §5, rule 3). */
const FULL = 100_000;

export type DiskState = {
  /** How full the volume is, in milli-percent. */
  disk: number;
  /** Fill per tick while the cause is active. */
  rate: number;
  /** The cause is gone: the config is back to info (logs) or the stale slot is dropped (wal). */
  fixed: number;
  /** The player has found the cause: the config change (logs) or the stale slot (wal). The fix is offered only after. */
  found: number;
  /** Times the space was freed by hand. */
  freed: number;
  grown: number;
  statusPosted: number;
  ducks: number;
};

const errorRateBp = (s: DiskState): number => (s.disk < 98_000 ? 0 : Math.floor(((Math.min(s.disk, FULL) - 98_000) * 7) / 4));
const pct = (s: DiskState) => Math.floor(s.disk / 1000);
const jitter = (rng: Rng, spread: number) => (rng.next() - 0.5) * spread;

const LOGS_HINTS = [
  "Which resource ran out, and when did it start climbing?",
  "A disk that only ever grows is a symptom: what is writing so much, and did anyone change it?",
  "If you free the space and it fills again, did you fix anything?",
];
const WAL_HINTS = [
  "What is the database keeping that it should have thrown away by now?",
  "Something is holding back the cleanup: what is still reading the database's change stream?",
  "If a bigger volume only buys time, what have you actually fixed?",
];

/** The lesson for a run that freed space, or cleared the wrong thing, before fixing the cause. */
const usedBeforeFix = (r: RunResult, mask: string, fix: string): boolean => {
  const first = r.actions.findIndex((a) => a.actionId === mask);
  const fixAt = r.actions.findIndex((a) => a.actionId === fix);
  return first !== -1 && (fixAt === -1 || first < fixAt);
};

export function makeScenario(v: Variant): ScenarioDef<DiskState> {
  return v.kind === "logs" ? logsVolume(v) : walVolume(v);
}

const sharedActions = (hints: readonly string[]): ActionDef<DiskState>[] => [
  {
    id: "global.status_update", cli: "incidentctl status-page \"Investigating errors when placing orders\"", tool: "incident", label: "Post status update", serviceId: null, category: "communicate", durationS: 5, verdict: "useful",
    available: (s) => s.statusPosted === 0,
    effect: (s) => ({ ...s, statusPosted: 1 }),
    reveals: () => [`status page: "Investigating errors when placing orders"`],
  },
  { ...duckAction<DiskState>(hints), cli: "incidentctl rubber-duck" },
  {
    id: "global.ask_secondary", cli: "incidentctl page secondary", tool: "incident", label: "Ask secondary on-call", serviceId: null, category: "communicate", durationS: 10, verdict: "useful", async: true,
    reveals: () => [`{secondary} (secondary): "Orders fail, browsing is fine. That smells like something on the write path. Have you looked at what filled up?"`],
  },
];

function logsVolume(v: Variant): ScenarioDef<DiskState> {
  const rolledBack = (s: DiskState) => s.fixed === 1;
  const logs: LogTemplate<DiskState>[] = [
    { id: "edge.err", serviceId: "edge", level: "ERROR", everyTicks: 7, when: (s) => errorRateBp(s) >= 100,
      text: (_s, r) => `POST /checkout 500 ${60 + r.int(90)}ms, client 10.0.${r.int(256)}.${r.int(256)}, upstream "checkout-api:8080"` },
    { id: "edge.access", serviceId: "edge", level: "INFO", everyTicks: 12,
      text: (_s, r) => `GET /products/${1000 + r.int(9000)} 200 ${30 + r.int(40)}ms` },
    { id: "checkout.enospc", serviceId: "checkout", level: "ERROR", everyTicks: 6, when: (s) => errorRateBp(s) >= 100,
      text: (_s, r) => `order ${100000 + r.int(900000)} failed: audit write error: ENOSPC: no space left on device, write` },
    { id: "checkout.trace", serviceId: "checkout", level: "INFO", everyTicks: 4, when: (s) => !rolledBack(s),
      text: (_s, r) => `DEBUG cart.trace session=${r.int(0x10000).toString(16)} items=${1 + r.int(6)} pricing=${r.int(400)}us cache=miss` },
    { id: "checkout.ok", serviceId: "checkout", level: "INFO", everyTicks: 14, when: (s) => errorRateBp(s) < 100,
      text: (_s, r) => `POST /checkout 200 ${90 + r.int(80)}ms` },
    { id: "postgres.checkpoint", serviceId: "postgres", level: "INFO", everyTicks: 150,
      text: (_s, r) => `checkpoint complete: wrote ${1000 + r.int(900)} buffers` },
    { id: "postgres.slow_query", serviceId: "postgres", level: "WARN", everyTicks: 60,
      text: (_s, r) => `duration: ${300 + r.int(200)}.${r.int(1000)} ms  statement: SELECT o.* FROM orders o WHERE o.customer_id = $1` },
  ];

  return defineScenario<DiskState>({
    id: v.key ? `disk-full:${v.key}` : "disk-full",
    title: "Disk Full at 3AM",
    summary: "Orders fail with a server error while browsing is fine. What ran out?",
    difficulty: "normal",
    timeLimitS: 480,
    parBp: 560,
    slo: { availability: 99.9, budgetRequests: 5000 },
    trafficPerTick: 2,

    services: [
      { id: "edge", label: "edge-gateway", x: 12, y: 50, detail: () => "nginx · 2 nodes" },
      { id: "checkout", label: "checkout-api", x: 46, y: 50, detail: () => "v155 · 3 pods" },
      { id: "postgres", label: "postgres", x: 82, y: 50, detail: () => "primary · 41% data volume" },
    ],
    edges: [
      { from: "edge", to: "checkout" },
      { from: "checkout", to: "postgres" },
    ],

    setup: (rng) => ({ disk: 97_400 + rng.int(400), rate: 10 + rng.int(5), fixed: 0, found: 0, freed: 0, grown: 0, statusPosted: 0, ducks: 0 }),
    dynamics: (s) => ({ ...s, disk: Math.min(FULL, s.disk + (rolledBack(s) ? 0 : s.rate)) }),
    errorRateBp,
    health: (s) => {
      const err = errorRateBp(s);
      return {
        edge: err >= 1000 ? "crit" : err >= 100 ? "warn" : "ok",
        checkout: s.disk >= 98_000 ? "crit" : s.disk >= 90_000 ? "warn" : "ok",
        postgres: "ok",
      };
    },
    mitigated: (s) => !rolledBack(s) && s.freed > 0,
    resolvedWhen: (s) => rolledBack(s) && s.disk < 90_000,

    metrics: [
      { id: "edge.rps", serviceId: "edge", label: "Requests", unit: "req/s", max: 40, value: (_s, n) => 20 + jitter(n, 3) },
      { id: "edge.err", serviceId: "edge", label: "5xx rate", unit: "%", max: 50, warn: 1, crit: 2, value: (s, n) => Math.max(0, errorRateBp(s) / 100 + (errorRateBp(s) ? jitter(n, 0.6) : 0)) },
      { id: "checkout.disk", serviceId: "checkout", label: "/var/log used", unit: "%", max: 100, warn: 85, crit: 95, value: (s) => s.disk / 1000 },
      { id: "checkout.lograte", serviceId: "checkout", label: "Log write rate", unit: "MB/s", max: 60, warn: 30, crit: 45, value: (s, n) => (rolledBack(s) ? 2 : 38) + jitter(n, 4) },
      { id: "checkout.p99", serviceId: "checkout", label: "p99 latency", unit: "ms", max: 2000, warn: 800, crit: 1500, value: (s, n) => (errorRateBp(s) > 0 ? 260 : 140) + jitter(n, 30) },
      { id: "postgres.disk", serviceId: "postgres", label: "Data volume used", unit: "%", max: 100, warn: 85, crit: 95, value: (_s, n) => 41 + jitter(n, 0.2) },
      { id: "postgres.cpu", serviceId: "postgres", label: "CPU", unit: "%", max: 100, warn: 70, crit: 90, value: (_s, n) => 22 + jitter(n, 8) },
    ],

    logs,

    alerts: [
      { id: "checkout_5xx", serviceId: "edge", severity: "crit", title: "CheckoutErrorRate", description: "Checkout 5xx above 1% at the gateway", when: (s) => errorRateBp(s) >= 100 },
      { id: "var_log_high", serviceId: "checkout", severity: "warn", title: "NodeDiskUsageHigh", description: "/var/log on api-node-2 above 90% used", when: (s) => s.disk >= 90_000 },
      { id: "var_log_full", serviceId: "checkout", severity: "crit", title: "NodeDiskFull", description: "/var/log on api-node-2 above 98% used", when: (s) => s.disk >= 98_000 },
    ],

    actions: [
      { id: "edge.error_log", cli: "kubectl logs deployment/edge --since=15m", tool: "logs", label: "Read gateway error log", serviceId: "edge", category: "investigate", durationS: 3, verdict: "useful",
        reveals: () => ["nginx: every 5xx in the last 5 min is a 500 on POST /checkout, passed through from checkout-api:8080"] },
      { id: "checkout.write_errors", cli: "kubectl logs deployment/checkout --since=1h | grep -i enospc", tool: "logs", label: "Search checkout-api for write errors", serviceId: "checkout", category: "investigate", durationS: 3, verdict: "useful",
        reveals: (s) => [`checkout-api: audit writes to /var/log/checkout fail with ENOSPC on api-node-2; /var/log is ${pct(s)}% used, and the file that grows is app.log`] },
      { id: "checkout.disks", cli: "df -h /var/log", tool: "dashboards", label: "Check node disks", serviceId: "checkout", category: "investigate", durationS: 4, verdict: "useful",
        reveals: (s) => [`api-node-2: /var/log ${pct(s)}% used, /var/lib/docker 52%, /tmp 3%; the log write rate is 38 MB/s against 2 MB/s last week`] },
      { id: "checkout.deploys", cli: "kubectl rollout history deployment/checkout", tool: "deploys", label: "View recent deploys and config changes", serviceId: "checkout", category: "investigate", durationS: 3, verdict: "useful",
        effect: (s) => ({ ...s, found: 1 }),
        reveals: () => [
          "cfg-88 by {deployer}, 2 h ago: LOG_LEVEL info → debug for the cart trace (marked temporary)",
          "v155 by {deployer}, 41 min ago: bump the payments SDK; no logging changes",
        ] },
      { id: "checkout.rollback_config", cli: "kubectl set env deployment/checkout LOG_LEVEL=info", tool: "deploys", label: "Roll back the config to LOG_LEVEL=info", serviceId: "checkout", category: "fix", durationS: 25, verdict: "useful",
        available: (s) => s.fixed === 0 && s.found === 1,
        effect: (s) => ({ ...s, fixed: 1 }),
        reveals: () => ["config cfg-87 rolled out to 3 of 3 pods: LOG_LEVEL=info. The old debug files stay on disk until they are rotated"] },
      { id: "checkout.rotate_logs", cli: "logrotate -f /etc/logrotate.d/checkout", tool: "logs", label: "Rotate and compress logs now", serviceId: "checkout", category: "mitigate", durationS: 10, verdict: "useful",
        effect: (s) => ({ ...s, disk: Math.min(s.disk, 70_000), freed: s.freed + 1 }),
        reveals: () => ["logrotate forced on api-node-2: 31 GB compressed and shipped, the log writers reopened their files"] },
      { id: "checkout.delete_logs", cli: "rm -rf /var/log/checkout/*", tool: "logs", label: "Delete the log files by hand", serviceId: "checkout", category: "mitigate", durationS: 15, verdict: "harmful", sideEffectBp: 3000,
        command: "rm -rf /var/log/checkout/*",
        reveals: (s) => [`files removed, but the pods still hold them open: /var/log is still ${pct(s)}% used, and the audit trail is gone`] },
      { id: "checkout.rollback_deploy", cli: "kubectl rollout undo deployment/checkout", tool: "deploys", label: "Roll back to v154", serviceId: "checkout", category: "mitigate", durationS: 30, verdict: "wasted",
        reveals: () => ["rollback to v154 complete: 3 of 3 pods ready; /var/log is still filling"] },
      { id: "checkout.clear_tmp", cli: "rm -rf /tmp/*", tool: "deploys", label: "Clear /tmp on api-node-2", serviceId: "checkout", category: "mitigate", durationS: 8, verdict: "wasted",
        reveals: () => ["/tmp cleared: 212 MB freed; /var/log unchanged"] },
      { id: "checkout.restart", cli: "kubectl rollout restart deployment/checkout", tool: "deploys", label: "Restart checkout pods", serviceId: "checkout", category: "mitigate", durationS: 15, verdict: "wasted",
        reveals: () => ["rolling restart done: 3 of 3 pods ready; the first write failed with ENOSPC again"] },
      { id: "postgres.status", cli: "kubectl top pods -l app=postgres", tool: "dashboards", label: "Check postgres health", serviceId: "postgres", category: "investigate", durationS: 3, verdict: "wasted",
        reveals: () => ["postgres: data volume 41% used, 0 replication lag, CPU 22%: healthy"] },
      { id: "postgres.grow_data", cli: "kubectl patch pvc postgres-data -p '{\"spec\":{\"resources\":{\"requests\":{\"storage\":\"700Gi\"}}}}'", tool: "deploys", label: "Grow the postgres data volume", serviceId: "postgres", category: "mitigate", durationS: 25, verdict: "harmful", sideEffectBp: 1500,
        reveals: () => ["postgres data volume 500 GB → 700 GB; /var/log on api-node-2 unchanged"] },
      ...sharedActions(LOGS_HINTS),
      { id: "ask.deployer.changes", tool: "chat", label: "Ask the deployer what went out today", serviceId: null, category: "investigate", durationS: 30, verdict: "useful", async: true,
        ask: { to: "deployer", topic: "changes", prompt: "hey, what went out to checkout today?" },
        reveals: () => [`{deployer}: "only v155, the payments SDK bump. I did turn LOG_LEVEL up to debug on checkout this morning for the cart trace, but that is a config change and it is temporary, so I did not think it counted."`] },
      { id: "ask.infra.disk", tool: "chat", label: "Ask infra about the disk alerts", serviceId: null, category: "investigate", durationS: 25, verdict: "wasted", async: true,
        ask: { to: "infra", topic: "disk", prompt: "api-node-2 disk is alerting, anything running there?" },
        reveals: () => [`{infra}: "that's the nightly backup staging, it always spikes /var. Ignore it, it clears itself."`] },
      { id: "ask.support.impact", tool: "chat", label: "Ask support about customer impact", serviceId: null, category: "investigate", durationS: 20, verdict: "useful", async: true,
        ask: { to: "support", topic: "impact", prompt: "what are customers seeing?" },
        reveals: () => [`{support}: "browsing and the cart are fine. Pressing Place order gives a 500 page, every time."`] },
    ],
    rootCauseActionIds: ["checkout.rollback_config"],
    hints: [...LOGS_HINTS],
    maskNotes: {
      "checkout.rotate_logs": "Rotating the logs freed the disk, so the errors stopped for a while. Debug logging was still on and filled it again.",
    },

    coldOpen: {
      scene: "cafe",
      symptom: { kind: "http_500", surface: "checkout" },
      page: { severity: "SEV2", title: "Placing orders returns 500", body: "Customers of {brand} can browse, but placing an order fails with a server error. You are the primary on-call." },
      hotspots: {
        "laptop.slack.infra": { kind: "clue", label: "Laptop: Slack #infra", author: "infra", text: "api-node-2: /var/log is at 97% and it was 58% this morning. Anyone touching logging?" },
        "phone.mention": { kind: "clue", label: "Phone: new mention", text: "@{brand} pay button says something went wrong. three times now.", appearsAt: "incident_start" },
        "table.neighbours": { kind: "clue", label: "The next table", text: "The site loads fine. It only dies when I hit place order." },
        "laptop.slack.deploys": { kind: "herring", label: "Laptop: Slack #deploys", author: "deployer", text: "v155 is out: payments SDK bump. Should be a no-op, ping me if checkout looks odd." },
        "wall.poster": { kind: "herring", label: "Poster on the wall", text: "{brand} FLASH SALE 50% today" },
      },
    },

    lessons: [
      { id: "dnf", when: (r) => r.outcome === "dnf",
        text: "Debug logging had been left on, so /var/log kept filling. A full disk fails every write behind the request, and the errors do not come from the app that looks broken. Look for what changed, then fix the source before you free space." },
      { id: "slow-ack", when: (r) => r.ackTick !== null && r.ackTick > 300,
        text: "Acknowledging took more than 30 seconds. A fast ack tells the team someone is on it and stops the page from escalating." },
      { id: "delete-trap", when: (r) => r.actions.some((a) => a.actionId === "checkout.delete_logs"),
        text: "Deleting files that a process holds open frees nothing until the process lets go, and it erases the audit trail. Rotate instead, so the writers reopen their files." },
      { id: "rotate-trap", when: (r) => usedBeforeFix(r, "checkout.rotate_logs", "checkout.rollback_config"),
        text: "Rotating logs bought time, not a fix: debug logging was still on and filled the disk again. Free the space, but also turn off what is filling it." },
      { id: "default", when: () => true,
        text: "A full disk is a symptom. The cause was a temporary debug setting nobody turned off, visible in the config history. When a resource only ever grows, ask what changed before you clean up." },
    ],
  });
}

function walVolume(v: Variant): ScenarioDef<DiskState> {
  const dropped = (s: DiskState) => s.fixed === 1;
  return defineScenario<DiskState>({
    id: v.key ? `disk-full:${v.key}` : "disk-full",
    title: "Disk Full at 3AM",
    summary: "Orders fail while browsing is fine, and the database is complaining about its disk.",
    difficulty: "normal",
    timeLimitS: 480,
    parBp: 180,
    slo: { availability: 99.9, budgetRequests: 5000 },
    trafficPerTick: 2,

    services: [
      { id: "edge", label: "edge-gateway", x: 12, y: 50, detail: () => "nginx · 2 nodes" },
      { id: "checkout", label: "checkout-api", x: 46, y: 50, detail: () => "v212 · 3 pods" },
      { id: "postgres", label: "postgres", x: 82, y: 22, detail: (s) => `primary · WAL volume ${s.grown ? "60" : "40"} GB` },
      { id: "reporting", label: "reporting-replica", x: 82, y: 80, detail: () => "offline · analytics" },
    ],
    edges: [
      { from: "edge", to: "checkout" },
      { from: "checkout", to: "postgres" },
      { from: "postgres", to: "reporting" },
    ],

    // WAL piles up at `rate` per tick until the stale slot is dropped; then Postgres recycles it at a checkpoint.
    setup: (rng) => ({ disk: 97_300 + rng.int(500), rate: 9 + rng.int(5), fixed: 0, found: 0, freed: 0, grown: 0, statusPosted: 0, ducks: 0 }),
    dynamics: (s) => (dropped(s) ? { ...s, disk: Math.max(48_000, s.disk - 300) } : { ...s, disk: Math.min(FULL, s.disk + s.rate) }),
    errorRateBp,
    health: (s) => {
      const err = errorRateBp(s);
      return {
        edge: err >= 1000 ? "crit" : err >= 100 ? "warn" : "ok",
        checkout: err >= 100 ? "warn" : "ok",
        postgres: s.disk >= 98_000 ? "crit" : s.disk >= 90_000 ? "warn" : "ok",
        reporting: "warn",
      };
    },
    mitigated: (s) => !dropped(s) && (s.freed > 0 || s.grown > 0),
    resolvedWhen: (s) => dropped(s) && s.disk < 90_000,

    metrics: [
      { id: "edge.rps", serviceId: "edge", label: "Requests", unit: "req/s", max: 40, value: (_s, n) => 20 + jitter(n, 3) },
      { id: "edge.err", serviceId: "edge", label: "5xx rate", unit: "%", max: 50, warn: 1, crit: 2, value: (s, n) => Math.max(0, errorRateBp(s) / 100 + (errorRateBp(s) ? jitter(n, 0.6) : 0)) },
      { id: "checkout.p99", serviceId: "checkout", label: "p99 latency", unit: "ms", max: 2000, warn: 800, crit: 1500, value: (s, n) => (errorRateBp(s) > 0 ? 320 : 150) + jitter(n, 30) },
      { id: "postgres.wal", serviceId: "postgres", label: "WAL volume used", unit: "%", max: 100, warn: 85, crit: 95, value: (s) => s.disk / 1000 },
      { id: "postgres.segments", serviceId: "postgres", label: "WAL segments on disk", unit: "files", max: 3000, warn: 1500, crit: 2500, value: (s) => Math.floor(s.disk / 36) },
      { id: "postgres.data", serviceId: "postgres", label: "Data volume used", unit: "%", max: 100, warn: 85, crit: 95, value: (_s, n) => 44 + jitter(n, 0.2) },
      { id: "postgres.cpu", serviceId: "postgres", label: "CPU", unit: "%", max: 100, warn: 70, crit: 90, value: (_s, n) => 26 + jitter(n, 8) },
    ],

    logs: [
      { id: "edge.err", serviceId: "edge", level: "ERROR", everyTicks: 7, when: (s) => errorRateBp(s) >= 100,
        text: (_s, r) => `POST /checkout 500 ${60 + r.int(90)}ms, client 10.0.${r.int(256)}.${r.int(256)}, upstream "checkout-api:8080"` },
      { id: "edge.access", serviceId: "edge", level: "INFO", everyTicks: 12,
        text: (_s, r) => `GET /products/${1000 + r.int(9000)} 200 ${30 + r.int(40)}ms` },
      { id: "checkout.insert", serviceId: "checkout", level: "ERROR", everyTicks: 6, when: (s) => errorRateBp(s) >= 100,
        text: (_s, r) => `order ${100000 + r.int(900000)} failed: pq: could not extend file: No space left on device` },
      { id: "checkout.ok", serviceId: "checkout", level: "INFO", everyTicks: 14, when: (s) => errorRateBp(s) < 100,
        text: (_s, r) => `POST /checkout 200 ${90 + r.int(80)}ms` },
      { id: "postgres.wal_full", serviceId: "postgres", level: "ERROR", everyTicks: 8, when: (s) => errorRateBp(s) >= 100,
        text: (_s, r) => `PANIC: could not write to file "pg_wal/xlogtemp.${1000 + r.int(9000)}": No space left on device` },
      { id: "postgres.checkpoint", serviceId: "postgres", level: "WARN", everyTicks: 45, when: (s) => !dropped(s),
        text: () => "checkpoint complete: removed 0 WAL files, recycled 0; 4 buffers written" },
      { id: "postgres.checkpoint_ok", serviceId: "postgres", level: "INFO", everyTicks: 45, when: (s) => dropped(s),
        text: (_s, r) => `checkpoint complete: removed ${900 + r.int(300)} WAL files, recycled 12` },
      { id: "postgres.slow_query", serviceId: "postgres", level: "WARN", everyTicks: 60,
        text: (_s, r) => `duration: ${300 + r.int(200)}.${r.int(1000)} ms  statement: INSERT INTO order_events (order_id, kind) VALUES ($1, $2)` },
    ],

    alerts: [
      { id: "checkout_5xx", serviceId: "edge", severity: "crit", title: "CheckoutErrorRate", description: "Checkout 5xx above 1% at the gateway", when: (s) => errorRateBp(s) >= 100 },
      { id: "wal_high", serviceId: "postgres", severity: "warn", title: "PostgresWalVolumeHigh", description: "The WAL volume on postgres-primary is above 90% used", when: (s) => s.disk >= 90_000 },
      { id: "wal_full", serviceId: "postgres", severity: "crit", title: "PostgresWalVolumeFull", description: "The WAL volume on postgres-primary is above 98% used", when: (s) => s.disk >= 98_000 },
    ],

    actions: [
      { id: "edge.error_log", cli: "kubectl logs deployment/edge --since=15m", tool: "logs", label: "Read gateway error log", serviceId: "edge", category: "investigate", durationS: 3, verdict: "useful",
        reveals: () => ["nginx: every 5xx in the last 5 min is a 500 on POST /checkout, passed through from checkout-api:8080"] },
      { id: "postgres.disk_errors", cli: "kubectl logs deployment/postgres --since=1h | grep -i enospc", tool: "logs", label: "Search postgres for disk errors", serviceId: "postgres", category: "investigate", durationS: 3, verdict: "useful",
        reveals: (s) => [`postgres: writes fail with ENOSPC on the WAL volume (${pct(s)}% used); checkpoints run but remove no WAL files, and pg_wal holds ${Math.floor(s.disk / 36)} segments where 60 is normal`] },
      { id: "postgres.wal_usage", cli: "df -h /var/lib/postgresql/wal", tool: "dashboards", label: "Check volume usage", serviceId: "postgres", category: "investigate", durationS: 4, verdict: "useful",
        reveals: (s) => [`postgres-primary: WAL volume ${pct(s)}% used, data volume 44% used; WAL grows steadily even at low write load`] },
      { id: "postgres.slots", cli: "psql -c \"SELECT slot_name, active, pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn)) AS retained FROM pg_replication_slots;\"", tool: "db", label: "Inspect replication slots", serviceId: "postgres", category: "investigate", durationS: 3, verdict: "useful",
        command: "SELECT slot_name, active, pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn)) AS retained FROM pg_replication_slots;",
        effect: (s) => ({ ...s, found: 1 }),
        reveals: () => ["pg_replication_slots: replica_1 (active, 0 B retained); reporting_cdc (NOT active, retaining 44 GB of WAL since the consumer went away)"] },
      { id: "postgres.drop_slot", cli: "psql -c \"SELECT pg_drop_replication_slot('reporting_cdc');\"", tool: "db", label: "Drop the stale replication slot", serviceId: "postgres", category: "fix", durationS: 10, verdict: "useful",
        command: "SELECT pg_drop_replication_slot('reporting_cdc');",
        available: (s) => s.fixed === 0 && s.found === 1,
        effect: (s) => ({ ...s, fixed: 1 }),
        reveals: () => ["slot reporting_cdc dropped; the next checkpoint recycles the retained WAL"] },
      { id: "postgres.delete_wal", cli: "psql -c \"\\! find /var/lib/postgresql/16/main -type f -mmin +120 -delete\"", tool: "db", label: "Delete old files on the postgres volume by hand", serviceId: "postgres", category: "mitigate", durationS: 20, verdict: "harmful", sideEffectBp: 5000,
        command: "\\! find /var/lib/postgresql/16/main -type f -mmin +120 -delete",
        effect: (s) => ({ ...s, disk: Math.max(0, s.disk - 15_000), freed: s.freed + 1 }),
        reveals: () => ["removed 640 WAL segments; postgres logs report that replica_1 is missing WAL it still needs"] },
      { id: "postgres.grow_wal", cli: "kubectl patch pvc postgres-wal -p '{\"spec\":{\"resources\":{\"requests\":{\"storage\":\"60Gi\"}}}}'", tool: "deploys", label: "Grow the WAL volume by 20 GB", serviceId: "postgres", category: "mitigate", durationS: 25, verdict: "useful",
        effect: (s) => ({ ...s, disk: Math.floor((s.disk * 2) / 3), grown: s.grown + 1 }),
        reveals: () => ["WAL volume 40 GB → 60 GB; free space is back, and WAL is still accumulating"] },
      { id: "postgres.restart", cli: "kubectl rollout restart deployment/postgres", tool: "deploys", label: "Restart postgres", serviceId: "postgres", category: "mitigate", durationS: 20, verdict: "harmful", sideEffectBp: 4000,
        reveals: () => ["postgres restarted after 20 s of crash recovery; the WAL volume is exactly as full as before"] },
      { id: "checkout.rollback", cli: "kubectl rollout undo deployment/checkout", tool: "deploys", label: "Roll back to v211", serviceId: "checkout", category: "mitigate", durationS: 30, verdict: "wasted",
        reveals: () => ["rollback to v211 complete: 3 of 3 pods ready; postgres WAL is still growing"] },
      { id: "checkout.restart", cli: "kubectl rollout restart deployment/checkout", tool: "deploys", label: "Restart checkout pods", serviceId: "checkout", category: "mitigate", durationS: 15, verdict: "wasted",
        reveals: () => ["rolling restart done: 3 of 3 pods ready; the first insert failed with ENOSPC again"] },
      ...sharedActions(WAL_HINTS),
      { id: "ask.deployer.changes", tool: "chat", label: "Ask the deployer what went out today", serviceId: null, category: "investigate", durationS: 30, verdict: "wasted", async: true,
        ask: { to: "deployer", topic: "changes", prompt: "hey, what went out to checkout today?" },
        reveals: () => [`{deployer}: "v212 added the order_events table and an index. That has to be a lot of writes, so the WAL is my bet."`] },
      { id: "ask.infra.replica", tool: "chat", label: "Ask infra about the replicas", serviceId: null, category: "investigate", durationS: 25, verdict: "useful", async: true,
        ask: { to: "infra", topic: "replicas", prompt: "anything changed around postgres replicas lately?" },
        reveals: () => [`{infra}: "we switched analytics off the reporting replica on Tuesday. The replica is down, and I don't remember cleaning up its slot."`] },
      { id: "ask.support.impact", tool: "chat", label: "Ask support about customer impact", serviceId: null, category: "investigate", durationS: 20, verdict: "useful", async: true,
        ask: { to: "support", topic: "impact", prompt: "what are customers seeing?" },
        reveals: () => [`{support}: "browsing works. Placing an order gives a 500 page, and a couple of customers say their cart is intact."`] },
    ],
    rootCauseActionIds: ["postgres.drop_slot"],
    hints: [...WAL_HINTS],
    maskNotes: {
      "postgres.grow_wal": "Growing the WAL volume made room, so the errors stopped for a while. The stale replication slot kept retaining WAL and filled it again.",
      "postgres.delete_wal": "Deleting WAL files freed some space and broke a replica that still needed them. The stale slot kept retaining WAL.",
    },

    coldOpen: {
      scene: "cafe",
      symptom: { kind: "http_500", surface: "checkout" },
      page: { severity: "SEV2", title: "Placing orders returns 500", body: "Customers of {brand} can browse, but placing an order fails with a server error. You are the primary on-call." },
      hotspots: {
        "laptop.slack.infra": { kind: "clue", label: "Laptop: Slack #infra", author: "infra", text: "analytics is off the reporting replica for good as of Tuesday. Will tidy up its leftovers this week." },
        "phone.mention": { kind: "clue", label: "Phone: new mention", text: "@{brand} order button gives me an error page. Tried 4 times.", appearsAt: "incident_start" },
        "table.neighbours": { kind: "clue", label: "The next table", text: "I can look at everything, I just can't buy anything." },
        "laptop.slack.deploys": { kind: "herring", label: "Laptop: Slack #deploys", author: "deployer", text: "v212 is out: new order_events table and index. Migration ran clean." },
        "wall.poster": { kind: "herring", label: "Poster on the wall", text: "{brand} FLASH SALE 50% today" },
      },
    },

    lessons: [
      { id: "dnf", when: (r) => r.outcome === "dnf",
        text: "The WAL volume filled because an inactive replication slot made Postgres keep every segment. The recent migration was innocent. When the database will not recycle something, ask who is still supposed to read it." },
      { id: "slow-ack", when: (r) => r.ackTick !== null && r.ackTick > 300,
        text: "Acknowledging took more than 30 seconds. A fast ack tells the team someone is on it and stops the page from escalating." },
      { id: "wal-trap", when: (r) => r.actions.some((a) => a.actionId === "postgres.delete_wal"),
        text: "Deleting WAL files by hand can break a replica and the database itself. WAL is cleaned up by checkpoints once nothing needs it: find what still needs it instead." },
      { id: "grow-trap", when: (r) => usedBeforeFix(r, "postgres.grow_wal", "postgres.drop_slot"),
        text: "A bigger volume bought time, not a fix: the stale slot kept retaining WAL and filled the new space too. Find what is holding it before you buy space." },
      { id: "default", when: () => true,
        text: "A slot for a consumer that is gone keeps WAL forever. After decommissioning a replica or a CDC consumer, drop its slot, and alert on retained WAL per slot." },
    ],
  });
}
