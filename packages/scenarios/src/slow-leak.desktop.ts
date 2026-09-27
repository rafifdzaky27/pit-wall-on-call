import type { DesktopContent } from "./desktop";

export const slowLeakDesktop: DesktopContent = {
  server: "nginx",
  channels: ["incidents", "deploys", "infra"],
  chat: [
    { id: "deploys.v141", channel: "deploys", trigger: { kind: "prepage" }, minutesAgo: 8640, author: "bot", text: "checkout-api v141 deployed to production" },
    { id: "deploys.dimas", channel: "deploys", trigger: { kind: "prepage" }, minutesAgo: 53, hotspotId: "laptop.slack.deploys" },
    { id: "deploys.v142", channel: "deploys", trigger: { kind: "prepage" }, minutesAgo: 52, author: "bot", text: "checkout-api v142 deployed to production" },
    { id: "infra.maintenance", channel: "infra", trigger: { kind: "prepage" }, minutesAgo: 120, hotspotId: "laptop.slack.infra" },
    { id: "infra.noisy", channel: "infra", trigger: { kind: "prepage" }, minutesAgo: 35, author: "infra", text: "postgres dashboards look noisy today, probably the nightly batch jobs" },
    { id: "incidents.opened", channel: "incidents", trigger: { kind: "page" }, author: "bot", text: "SEV2 opened: Checkout returning 5xx. Primary: you. Secondary: {secondary}." },
    { id: "incidents.support", channel: "incidents", trigger: { kind: "alert", alertId: "checkout_latency" }, author: "support", text: "Customers are writing in: the payment step shows a gateway error." },
    { id: "dm.secondary.deploy", channel: "dm:secondary", trigger: { kind: "action", actionId: "global.ask_secondary" }, author: "secondary", text: "{deployer} shipped v142 about an hour ago. Could that be it?" },
  ],
  requests: [
    { method: "GET", path: "/", weight: 3, okStatus: 200, failsWithSymptom: false, okMs: [40, 110], failMs: [40, 110] },
    { method: "GET", path: "/products/{id}", weight: 4, okStatus: 200, failsWithSymptom: false, okMs: [25, 90], failMs: [25, 90] },
    { method: "GET", path: "/assets/app.js", weight: 2, okStatus: 304, failsWithSymptom: false, okMs: [8, 20], failMs: [8, 20] },
    { method: "POST", path: "/cart", weight: 2, okStatus: 201, failsWithSymptom: false, okMs: [60, 140], failMs: [60, 140] },
    { method: "POST", path: "/checkout", weight: 3, okStatus: 200, failsWithSymptom: true, okMs: [180, 420], failMs: [5000, 5200] },
  ],
};
