import { defineScenario, type ActionDef, type Health, type LogTemplate, type Rng, type ScenarioDef } from "@pitwall/engine";
import { duckAction } from "../../duck";

/** Which certificate expired, and on which hop (M4 research C4). The variants change what the player reads and what they roll out. */
export interface Variant {
  /** "" for the first variant, whose id is the incident's. */
  key: "" | "mesh";
}

export const VARIANTS: readonly Variant[] = [{ key: "" }, { key: "mesh" }];

export type CertState = {
  /** The renewed certificate is rolled out and loaded. */
  fixed: number;
  /** The player has found the expired certificate (its secret, or its pending renewal request). The fix is offered only after. */
  found: number;
  /** Ticks left of a temporary lull after a restart (pooled connections that still hold a valid session). */
  lull: number;
  /** Certificate verification is off: orders pass, unprotected. */
  insecure: number;
  restarts: number;
  statusPosted: number;
  ducks: number;
};

const ERR_BP = 3500;
const LULL_TICKS = 700;
/** "infra: ..." becomes "{infra}: ...", the world token for the teammate. */
const who = (t: string) => t.replace(/^(\w+):/, "{$1}:");
const jitter = (rng: Rng, spread: number) => (rng.next() - 0.5) * spread;
const failing = (s: CertState) => s.fixed === 0 && s.insecure === 0 && s.lull === 0;
const errorRateBp = (s: CertState): number => (failing(s) ? ERR_BP : 0);

/** The words that differ between the two variants: which hop, which cert, which tool finds it. */
interface Cfg {
  id: string;
  summary: string;
  /** The dependency the checkout calls over mutual TLS. */
  dep: { id: string; label: string; detail: string; health: Health };
  /** The service whose pods or secret carry the expired certificate, and whose rollout fixes it. */
  fixOn: { id: string; label: string };
  checkoutVersion: string;
  /** Version of the innocent recent deploy, and what it changed. */
  herring: { service: string; version: string; note: string; rollbackTo: string };
  clientLog: (r: Rng) => string;
  depLog: ((r: Rng) => string) | null;
  hints: string[];
  errLabel: string;
  errReveal: string;
  certReveal: string[];
  rolloutLabel: string;
  rolloutReveal: string;
  restartLabel: string;
  restartId: string;
  restartReveal: string;
  bypassLabel: string;
  bypassReveal: string;
  asks: { infra: string; infraTopic: string; infraPrompt: string; deployer: string; support: string };
  hotspots: ScenarioDef<CertState>["coldOpen"]["hotspots"];
  maskNotes: Record<string, string>;
  lessons: { dnf: string; restart: string; bypass: string; default: string };
}

const CFGS: Record<"" | "mesh", Cfg> = {
  "": {
    id: "expired-cert",
    summary: "Payments fail with a 502 while everything else works. Is it the gateway, or the provider?",
    dep: { id: "payments", label: "payments", detail: "external provider · mTLS", health: "ok" },
    fixOn: { id: "checkout", label: "checkout-api" },
    checkoutVersion: "v88",
    herring: { service: "checkout-api", version: "v88", note: "copy changes on the order confirmation page; no TLS or payments changes", rollbackTo: "v87" },
    clientLog: (r) => `payment call failed: Post "https://pay.provider.example/v1/charges": remote error: tls: expired certificate (our client certificate was rejected, attempt ${1 + r.int(3)})`,
    depLog: null,
    hints: [
      "Was it working an hour ago? What is the newest thing that changed, and does it touch the failing path?",
      "The error text names a reason. Which part of the connection is it about, and how old is that part?",
      "If restarting quiets it for a while, did you renew what expired?",
    ],
    errLabel: "Search checkout-api for payment errors",
    errReveal: "checkout-api: every failing charge dies in the TLS handshake with the payment provider: remote error: tls: expired certificate, so the provider rejects our client certificate. The certificate is checkout-api's own client cert (CN=checkout-api.mtls). checkout-api env: CALL_RETRIES=2, TLS_VERIFY=on (TLS_VERIFY=off would skip certificate checks)",
    certReveal: [
      "secret checkout-mtls-client: issued 90 days ago, expired 34 minutes ago; the renew job has failed since day 60 (its DNS challenge was rejected)",
      "a renewed certificate valid for 90 days is already in the vault as the manifest checkout-mtls-client.yaml, not yet applied",
      "v88 by {deployer}, 3 h ago: order confirmation copy; no TLS or payments changes",
    ],
    rolloutLabel: "Roll out the renewed client certificate",
    rolloutReveal: "secret checkout-mtls-client updated on 3 of 3 pods: the new client certificate is loaded and valid for 90 days",
    restartLabel: "Restart checkout pods",
    restartId: "checkout.restart",
    restartReveal: "rolling restart done: 3 of 3 pods ready; charges went through for a moment on TLS sessions the provider still honoured",
    bypassLabel: "Relax the security checks on payment calls",
    bypassReveal: "TLS_VERIFY=off rolled out: charges go through, and every connection to the provider is now unauthenticated",
    asks: {
      infra: "infra: \"we renew certs with the DNS job. It has been red for a while, I keep meaning to look. Why?\"",
      infraTopic: "certs",
      infraPrompt: "do we have any certificates that are due to renew around now?",
      deployer: "deployer: \"only v88, a copy change on the confirmation page. Nothing near payments.\"",
      support: "support: \"about 1 in 3 orders fail at the pay step with a 502 page. Refund requests are piling up.\"",
    },
    hotspots: {
      "laptop.slack.infra": { kind: "clue", label: "Laptop: Slack #infra", author: "infra", text: "the cert renew job has been red for weeks. I'll look at it after the freeze." },
      "phone.mention": { kind: "clue", label: "Phone: new mention", text: "@{brand} paying just gives a 502 page. Cart and browsing are fine.", appearsAt: "incident_start" },
      "table.neighbours": { kind: "clue", label: "The next table", text: "Everything loads. It is only the pay button that fails." },
      "laptop.slack.deploys": { kind: "herring", label: "Laptop: Slack #deploys", author: "deployer", text: "v88 is out: confirmation page copy. Ping me if checkout looks odd." },
      "wall.poster": { kind: "herring", label: "Poster on the wall", text: "{brand} FLASH SALE 50% today" },
    },
    maskNotes: {
      "checkout.restart": "Restarting the pods let charges through for a while on sessions the provider still honoured. The client certificate was still expired, and the errors came back.",
      "checkout.disable_verify": "Turning verification off let charges through and left every connection to the provider unauthenticated. The certificate was still expired.",
    },
    lessons: {
      dnf: "The client certificate checkout-api presents to the payment provider had expired, and the renewal job had been failing for weeks. The recent deploy was innocent. When a handshake fails, read the error: it names the cause.",
      restart: "The pod restart rode on old sessions and bought a few minutes. The certificate was still expired, so the errors returned. Renew what expired.",
      bypass: "Switching verification off made the errors stop by removing the protection the certificate exists for. Rotate the certificate instead, and alert on days until expiry.",
      default: "The logs said it: tls, expired certificate. Renewal automation had been red for weeks with no alert. Alert on days-to-expiry, and read handshake errors before you suspect the last deploy.",
    },
  },
  mesh: {
    id: "expired-cert:mesh",
    summary: "Orders fail with a 502 while stock lookups time out. The stock service looks fine.",
    dep: { id: "stock", label: "stock-api", detail: "v301 · 2 pods · mesh mTLS", health: "warn" },
    fixOn: { id: "stock", label: "stock-api" },
    checkoutVersion: "v207",
    herring: { service: "stock-api", version: "v301", note: "adds an index on reservations; no TLS changes", rollbackTo: "v300" },
    clientLog: (r) => `reserve stock failed: Post "https://stock-api.mesh.internal:8443/reserve": x509: certificate has expired or is not yet valid (retry ${1 + r.int(3)} of 3)`,
    depLog: (r) => `http: TLS handshake error from 10.4.${r.int(256)}.${r.int(256)}:${30000 + r.int(30000)}: remote error: tls: bad certificate`,
    hints: [
      "Which hop fails first, and does the service at the far end of it log anything about it?",
      "Both sides of a handshake log their half. What does each one say about the other?",
      "If you reset the pods and it works for a bit, what did the reset not change?",
    ],
    errLabel: "Search checkout-api for stock errors",
    errReveal: "checkout-api: every failing order dies reserving stock over the mesh: x509: certificate has expired or is not yet valid. The serving certificate is stock-api's (CN=stock-api.mesh.internal). checkout-api env: CALL_RETRIES=2; the stock reservation is behind the flag stock_check=on",
    certReveal: [
      "mesh.cert_inventory: stock-api serving certificate (CN=stock-api.mesh.internal), issued 30 days ago by the mesh CA, expired 12 minutes ago; its renewal request req-4471 has been pending_approval for 2 days",
      "also pending: req-4468 for reporting-api, whose certificate is valid for 9 more days",
      "requests live in the table mesh.cert_requests (columns id, status); a request waiting in pending_approval is issued once its status is set to approved",
    ],
    rolloutLabel: "Approve pending request req-4471 (stock-api)",
    rolloutReveal: "req-4471 approved: the mesh CA reissued the stock-api certificate and it hot-reloaded on 2 of 2 pods, valid for 30 days",
    restartLabel: "Restart checkout pods",
    restartId: "checkout.restart",
    restartReveal: "rolling restart done: 3 of 3 pods ready; orders went through for a moment, on connections still held open",
    bypassLabel: "Skip the stock check at checkout",
    bypassReveal: "feature flag stock_check=off rolled out: orders go through without reserving stock, and nothing counts what is sold",
    asks: {
      infra: "infra: \"the mesh certs last 30 days, and the auto-reissue needs someone to approve it. I approved the last one. Did it go stale?\"",
      infraTopic: "mesh",
      infraPrompt: "how do the internal service certs get renewed?",
      deployer: "deployer: \"v301 on stock-api added an index on reservations, so it has to be the database. Have you looked at postgres?\"",
      support: "support: \"orders fail at 'Place order' with a 502 page. Product pages still show stock levels, so that part is fine.\"",
    },
    hotspots: {
      "laptop.slack.infra": { kind: "clue", label: "Laptop: Slack #infra", author: "infra", text: "mesh cert reissue for stock-api is waiting on approval. Anyone with rights, ping me." },
      "phone.mention": { kind: "clue", label: "Phone: new mention", text: "@{brand} tried to order 3 times, gateway error every time.", appearsAt: "incident_start" },
      "table.neighbours": { kind: "clue", label: "The next table", text: "I can see the item is in stock, but it will not let me order it." },
      "laptop.slack.deploys": { kind: "herring", label: "Laptop: Slack #deploys", author: "deployer", text: "stock-api v301 is out: a new index on reservations. Should make lookups faster." },
      "wall.poster": { kind: "herring", label: "Poster on the wall", text: "{brand} FLASH SALE 50% today" },
    },
    maskNotes: {
      "checkout.restart": "Restarting the pods gave orders a brief lull on connections that were still open. The certificate was still expired, and the errors came back.",
      "checkout.disable_verify": "Skipping the stock check let orders through and stopped counting inventory. The certificate was still expired.",
    },
    lessons: {
      dnf: "stock-api's serving certificate had expired, and the reissue was waiting on a manual approval. The stock-api deploy and postgres were innocent. Read both sides of a failing handshake before you suspect the newest change.",
      restart: "Restarting the pods reused connections that were still open, then the errors came back: the certificate was still expired. Renew it.",
      bypass: "Skipping the stock check hid the errors and stopped counting inventory, so it can oversell. Fix the certificate; do not switch off the check that depends on it.",
      default: "Both sides logged the handshake failure: the client saw x509 expired, the server saw bad certificate. Automatic renewal that waits on a person is a timer, so alert on days-to-expiry.",
    },
  },
};

export function makeScenario(v: Variant): ScenarioDef<CertState> {
  const c = CFGS[v.key];
  const mesh = v.key === "mesh";
  const dep = c.dep;
  const rolloutId = mesh ? "stock.approve_request" : "checkout.rollout_cert";
  const bypassId = "checkout.disable_verify";
  const restartOn = "checkout";

  const logs: LogTemplate<CertState>[] = [
    { id: "edge.err", serviceId: "edge", level: "ERROR", everyTicks: 7, when: (s) => failing(s),
      text: (_s, r) => `POST /checkout 502 ${60 + r.int(90)}ms, client 10.0.${r.int(256)}.${r.int(256)}, upstream "checkout-api:8080" returned "bad gateway"` },
    { id: "edge.access", serviceId: "edge", level: "INFO", everyTicks: 12,
      text: (_s, r) => `GET /products/${1000 + r.int(9000)} 200 ${30 + r.int(40)}ms` },
    { id: "checkout.tls", serviceId: "checkout", level: "ERROR", everyTicks: 5, when: (s) => failing(s), text: (_s, r) => c.clientLog(r) },
    { id: "checkout.ok", serviceId: "checkout", level: "INFO", everyTicks: 14, when: (s) => !failing(s),
      text: (_s, r) => `POST /checkout 200 ${90 + r.int(80)}ms` },
    { id: "checkout.noise", serviceId: "checkout", level: "WARN", everyTicks: 90,
      text: (_s, r) => `slow template render: order_confirmation took ${120 + r.int(60)}ms` },
    { id: "postgres.checkpoint", serviceId: "postgres", level: "INFO", everyTicks: 150,
      text: (_s, r) => `checkpoint complete: wrote ${1000 + r.int(900)} buffers` },
    { id: "postgres.slow_query", serviceId: "postgres", level: "WARN", everyTicks: 60,
      text: (_s, r) => `duration: ${250 + r.int(200)}.${r.int(1000)} ms  statement: SELECT * FROM reservations WHERE sku = $1` },
  ];
  if (c.depLog) {
    const depLog = c.depLog;
    logs.push({ id: "stock.tls", serviceId: dep.id, level: "WARN", everyTicks: 6, when: (s) => failing(s), text: (_s, r) => depLog(r) });
    logs.push({ id: "stock.ok", serviceId: dep.id, level: "INFO", everyTicks: 20, when: (s) => !failing(s), text: () => "GET /levels 200 12ms" });
  } else {
    logs.push({ id: "payments.ok", serviceId: dep.id, level: "INFO", everyTicks: 18, when: (s) => !failing(s), text: (_s, r) => `POST /v1/charges 200 ${150 + r.int(60)}ms` });
  }

  const actions: ActionDef<CertState>[] = [
    { id: "edge.error_log", cli: "kubectl logs deployment/edge --since=15m", tool: "logs", label: "Read gateway error log", serviceId: "edge", category: "investigate", durationS: 3, verdict: "useful",
      reveals: () => ['nginx: every 5xx in the last 5 min is a 502 on POST /checkout, "bad gateway" returned by checkout-api:8080'] },
    { id: "checkout.tls_errors", cli: `kubectl logs deployment/checkout --since=1h | grep -i ${mesh ? "x509" : "tls"}`, tool: "logs", label: c.errLabel, serviceId: "checkout", category: "investigate", durationS: 3, verdict: "useful", reveals: () => [c.errReveal] },
    { id: `${dep.id}.status`, cli: mesh ? "kubectl top pods -l app=stock" : "curl -s https://status.pay.provider.example/api/v2/status.json", tool: "dashboards", label: mesh ? "Check stock-api health" : "Check provider status", serviceId: dep.id, category: "investigate", durationS: 3, verdict: "wasted",
      reveals: () => [mesh ? "stock-api: pods ready, CPU 9%, p99 12 ms on the requests it does answer" : "payments provider: all systems operational, p99 182 ms; other merchants are unaffected"] },
    { id: "postgres.status", cli: "kubectl top pods -l app=postgres", tool: "dashboards", label: "Check postgres health", serviceId: "postgres", category: "investigate", durationS: 3, verdict: "wasted",
      reveals: () => ["postgres: 24 connections, CPU 21%, no slow queries beyond the usual"] },
    ...(mesh
      ? ([
          // The mesh cert lives in the CA's inventory, so the player reads it in the DB console and fixes it there.
          { id: "stock.certs", cli: `psql -c "SELECT name, not_after, request_id, request_status FROM mesh.cert_inventory ORDER BY name;"`, tool: "db", label: "Query the mesh inventory", serviceId: "stock", category: "investigate", durationS: 3, verdict: "useful",
            command: "SELECT name, not_after, request_id, request_status FROM mesh.cert_inventory ORDER BY name;",
            effect: (s) => ({ ...s, found: 1 }),
            reveals: () => c.certReveal },
          { id: "stock.deploys", cli: "kubectl rollout history deployment/stock", tool: "deploys", label: "View stock-api deploys", serviceId: "stock", category: "investigate", durationS: 3, verdict: "wasted",
            reveals: () => ["v301 by {deployer}, 2 h ago: adds an index on reservations; no TLS changes"] },
          { id: rolloutId, cliKeys: ["update", "mesh.cert_requests", "approved", "req-4471"], cli: `psql -c "UPDATE mesh.cert_requests SET status = 'approved' WHERE id = 'req-4471';"`, tool: "db", label: c.rolloutLabel, serviceId: "stock", category: "fix", durationS: 12, verdict: "useful",
            command: "UPDATE mesh.cert_requests SET status = 'approved' WHERE id = 'req-4471';",
            available: (s) => s.fixed === 0 && s.found === 1,
            effect: (s) => ({ ...s, fixed: 1, lull: 0 }),
            reveals: () => [c.rolloutReveal] },
          { id: "stock.approve_other", cliKeys: ["update","mesh.cert_requests","approved","req-4468"], cli: `psql -c "UPDATE mesh.cert_requests SET status = 'approved' WHERE id = 'req-4468';"`, tool: "db", label: "Approve pending request req-4468 (reporting-api)", serviceId: "stock", category: "mitigate", durationS: 12, verdict: "wasted",
            command: "UPDATE mesh.cert_requests SET status = 'approved' WHERE id = 'req-4468';",
            available: (s) => s.found === 1,
            reveals: () => ["req-4468 approved: reporting-api's certificate renewed for 30 days; stock-api's is untouched and still failing"] },
        ] as ActionDef<CertState>[])
      : ([
          { id: "checkout.deploys", cli: "kubectl describe deployment/checkout", tool: "deploys", label: "View checkout-api deploys and secrets", serviceId: "checkout", category: "investigate", durationS: 3, verdict: "useful",
            effect: (s) => ({ ...s, found: 1 }),
            reveals: () => c.certReveal },
          { id: rolloutId, cliKeys: ["apply", "checkout-mtls-client.yaml"], cli: "kubectl apply -f checkout-mtls-client.yaml", tool: "deploys", label: c.rolloutLabel, serviceId: "checkout", category: "fix", durationS: 12, verdict: "useful",
            available: (s) => s.fixed === 0 && s.found === 1,
            effect: (s) => ({ ...s, fixed: 1, lull: 0 }),
            reveals: () => [c.rolloutReveal] },
        ] as ActionDef<CertState>[])),
    { id: c.restartId, cliKeys: ["rollout", "restart", "deployment/checkout"], cli: "kubectl rollout restart deployment/checkout", tool: "deploys", label: c.restartLabel, serviceId: restartOn, category: "mitigate", durationS: 15, verdict: "wasted",
      effect: (s) => ({ ...s, lull: LULL_TICKS, restarts: s.restarts + 1 }),
      reveals: () => [c.restartReveal] },
    { id: "checkout.raise_retries", cliKeys: ["set","env","deployment/checkout","call_retries"], cli: "kubectl set env deployment/checkout CALL_RETRIES=5", tool: "deploys", label: "Raise checkout retries to 5", serviceId: "checkout", category: "mitigate", durationS: 15, verdict: "wasted",
      reveals: () => ["retries 2 to 5 rolled out; every retry fails the same way and p99 latency doubled"] },
    { id: `${c.herring.service === "checkout-api" ? "checkout" : "stock"}.rollback_deploy`, cliKeys: ["rollout", "undo", `deployment/${c.herring.service === "checkout-api" ? "checkout" : "stock"}`], cli: `kubectl rollout undo deployment/${c.herring.service === "checkout-api" ? "checkout" : "stock"}`, tool: "deploys", label: `Roll back to ${c.herring.rollbackTo}`, serviceId: c.herring.service === "checkout-api" ? "checkout" : "stock", category: "mitigate", durationS: 30, verdict: "wasted",
      reveals: () => [`rollback to ${c.herring.rollbackTo} complete; the errors are unchanged`] },
    { id: bypassId, cliKeys: mesh ? ["disable", "stock_check"] : ["set", "env", "deployment/checkout", "tls_verify=off"], cli: mesh ? "flagctl disable stock_check" : "kubectl set env deployment/checkout TLS_VERIFY=off", tool: "deploys", label: c.bypassLabel, serviceId: "checkout", category: "mitigate", durationS: 15, verdict: "harmful", sideEffectBp: 4000,
      available: (s) => s.insecure === 0,
      effect: (s) => ({ ...s, insecure: 1 }),
      reveals: () => [c.bypassReveal] },
    { id: "global.status_update", cliKeys: ["status-page"], cli: 'incidentctl status-page "Investigating errors when placing orders"', tool: "incident", label: "Post status update", serviceId: null, category: "communicate", durationS: 5, verdict: "useful",
      available: (s) => s.statusPosted === 0,
      effect: (s) => ({ ...s, statusPosted: 1 }),
      reveals: () => ['status page: "Investigating errors when placing orders"'] },
    { ...duckAction<CertState>(c.hints), cli: "incidentctl rubber-duck" },
    { id: "ask.deployer.changes", tool: "chat", label: "Ask the deployer what went out today", serviceId: null, category: "investigate", durationS: 30, verdict: mesh ? "wasted" : "useful", async: true,
      ask: { to: "deployer", topic: "changes", prompt: "hey, what went out today?" },
      reveals: () => [who(c.asks.deployer)] },
    { id: `ask.infra.${c.asks.infraTopic}`, tool: "chat", label: mesh ? "Ask infra what changed on the mesh" : "Ask infra about the payment client", serviceId: null, category: "investigate", durationS: 25, verdict: "useful", async: true,
      ask: { to: "infra", topic: c.asks.infraTopic, prompt: c.asks.infraPrompt },
      reveals: () => [who(c.asks.infra)] },
    { id: "ask.support.impact", tool: "chat", label: "Ask support about customer impact", serviceId: null, category: "investigate", durationS: 20, verdict: "useful", async: true,
      ask: { to: "support", topic: "impact", prompt: "what are customers seeing?" },
      reveals: () => [who(c.asks.support)] },
    { id: "global.ask_secondary", cliKeys: ["page","secondary"], cli: "incidentctl page secondary", tool: "incident", label: "Ask secondary on-call", serviceId: null, category: "communicate", durationS: 10, verdict: "useful", async: true,
      reveals: () => [`{secondary} (secondary): "Only the pay step fails, and every error is a handshake. Has anything with a lifetime run out?"`] },
  ];

  const services: ScenarioDef<CertState>["services"] = mesh
    ? [
        { id: "edge", label: "edge-gateway", x: 12, y: 50, detail: () => "nginx · 2 nodes" },
        { id: "checkout", label: "checkout-api", x: 46, y: 50, detail: () => `${c.checkoutVersion} · 3 pods` },
        { id: "stock", label: "stock-api", x: 80, y: 20, detail: (s) => (s.fixed ? "v301 · 2 pods · cert valid" : "v301 · 2 pods · mesh mTLS") },
        { id: "postgres", label: "postgres", x: 80, y: 80, detail: () => "primary · 41% data volume" },
      ]
    : [
        { id: "edge", label: "edge-gateway", x: 12, y: 50, detail: () => "nginx · 2 nodes" },
        { id: "checkout", label: "checkout-api", x: 46, y: 50, detail: () => `${c.checkoutVersion} · 3 pods` },
        { id: "payments", label: "payments", x: 80, y: 20, detail: () => "external provider · mTLS" },
        { id: "postgres", label: "postgres", x: 80, y: 80, detail: () => "primary · 41% data volume" },
      ];

  return defineScenario<CertState>({
    id: c.id,
    title: "The Expired Cert",
    summary: c.summary,
    difficulty: "normal",
    timeLimitS: 480,
    parBp: 330,
    slo: { availability: 99.9, budgetRequests: 5000 },
    trafficPerTick: 2,

    services,
    edges: [
      { from: "edge", to: "checkout" },
      { from: "checkout", to: dep.id },
      { from: "checkout", to: "postgres" },
    ],

    setup: () => ({ fixed: 0, found: 0, lull: 0, insecure: 0, restarts: 0, statusPosted: 0, ducks: 0 }),
    dynamics: (s) => (s.lull > 0 ? { ...s, lull: s.lull - 1 } : s),
    errorRateBp,
    health: (s) => {
      const err = errorRateBp(s);
      return {
        edge: err >= 1000 ? "crit" : "ok",
        checkout: err >= 100 ? "crit" : "ok",
        [dep.id]: mesh ? (failing(s) ? "warn" : "ok") : "ok",
        postgres: "ok",
      };
    },
    mitigated: (s) => s.fixed === 0 && (s.lull > 0 || s.insecure === 1 || s.restarts > 0),
    resolvedWhen: (s) => s.fixed === 1,

    metrics: [
      { id: "edge.rps", serviceId: "edge", label: "Requests", unit: "req/s", max: 40, value: (_s, n) => 20 + jitter(n, 3) },
      { id: "edge.err", serviceId: "edge", label: "5xx rate", unit: "%", max: 50, warn: 1, crit: 2, value: (s, n) => Math.max(0, errorRateBp(s) / 100 + (errorRateBp(s) ? jitter(n, 0.6) : 0)) },
      { id: "checkout.p99", serviceId: "checkout", label: "p99 latency", unit: "ms", max: 2000, warn: 800, crit: 1500, value: (s, n) => (failing(s) ? 380 : 140) + jitter(n, 30) },
      { id: "checkout.handshake", serviceId: "checkout", label: "TLS handshake failures", unit: "/s", max: 30, warn: 1, crit: 5, value: (s, n) => (failing(s) ? 12 + jitter(n, 3) : 0) },
      { id: `${dep.id}.p99`, serviceId: dep.id, label: "p99 latency", unit: "ms", max: 2000, warn: 800, crit: 1500, value: (_s, n) => (mesh ? 12 : 182) + jitter(n, mesh ? 3 : 40) },
      { id: "postgres.cpu", serviceId: "postgres", label: "CPU", unit: "%", max: 100, warn: 70, crit: 90, value: (_s, n) => 21 + jitter(n, 8) },
    ],

    logs,

    alerts: [
      { id: "checkout_5xx", serviceId: "edge", severity: "crit", title: "CheckoutErrorRate", description: "Checkout 5xx above 1% at the gateway", when: (s) => errorRateBp(s) >= 100 },
      { id: "tls_failures", serviceId: "checkout", severity: "warn", title: "TlsHandshakeFailures", description: "TLS handshake failures from checkout-api above 1 per second", when: (s) => failing(s) },
    ],

    actions,
    rootCauseActionIds: [rolloutId],
    hints: c.hints,
    maskNotes: c.maskNotes,

    coldOpen: {
      scene: "cafe",
      symptom: { kind: "http_502", surface: "checkout" },
      page: { severity: "SEV2", title: "Placing orders returns 502", body: "Customers of {brand} can browse, but placing an order fails with a gateway error. You are the primary on-call." },
      hotspots: c.hotspots,
    },

    lessons: [
      { id: "dnf", when: (r) => r.outcome === "dnf", text: c.lessons.dnf },
      { id: "slow-ack", when: (r) => r.ackTick !== null && r.ackTick > 300,
        text: "Acknowledging took more than 30 seconds. A fast ack tells the team someone is on it and stops the page from escalating." },
      { id: "bypass-trap", when: (r) => r.actions.some((a) => a.actionId === bypassId), text: c.lessons.bypass },
      { id: "restart-trap", when: (r) => r.actions.some((a) => a.actionId === c.restartId), text: c.lessons.restart },
      { id: "default", when: () => true, text: c.lessons.default },
    ],
  });
}
