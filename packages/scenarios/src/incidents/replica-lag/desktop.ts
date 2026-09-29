import type { ChatMessage, DesktopContent, RequestPattern } from "../../desktop";
import type { Variant } from "./scenario";
import { analytics, migration } from "./variants";

// Background messages make the workspace look lived-in. None of them adds a clue: the clues stay
// in the hotspot messages, the phone mention and the teammates' DMs.

const CHANNELS = ["incidents", "deploys", "infra"] as const;
const CHANNEL_INFO: DesktopContent["channelInfo"] = {
  incidents: { topic: "Active incidents only. Declare, then keep updates in a thread.", members: 38, pinned: 3 },
  deploys: { topic: "Production deploy notifications from Deploy Bot", members: 52, pinned: 1 },
  infra: { topic: "Databases, brokers and platform maintenance notices", members: 24, pinned: 5 },
};

function chat(v: Variant): ChatMessage[] {
  const api = v.labels.api;
  return [
    { id: "incidents.sev3", channel: "incidents", trigger: { kind: "prepage" }, minutesAgo: 1600, author: "bot", text: v.filler.sev3 },
    {
      id: "incidents.pm",
      channel: "incidents",
      trigger: { kind: "prepage" },
      minutesAgo: 1500,
      author: "secondary",
      text: v.filler.pm,
      reactions: [{ emoji: "👀", by: ["infra", "support"] }],
      thread: [
        { author: "infra", text: v.filler.pmNote, minutesAgo: 1440 },
        { author: "secondary", text: "thanks, fixed both", minutesAgo: 1420 },
      ],
    },
    {
      id: "deploys.prev",
      channel: "deploys",
      trigger: { kind: "prepage" },
      minutesAgo: 11_500,
      author: "deploybot",
      text: `${api} ${v.key ? "v87" : "v206"} deployed to production`,
      card: { service: api, version: v.key ? "v87" : "v206", sha: v.filler.prevSha, by: "deployer", env: "production", changes: v.filler.prevChange, status: "succeeded" },
    },
    { id: "deploys.mine", channel: "deploys", trigger: { kind: "prepage" }, minutesAgo: v.key ? 300 : 240, hotspotId: "laptop.slack.deploys", reactions: [{ emoji: "🚀", by: ["secondary"] }] },
    {
      id: "deploys.api",
      channel: "deploys",
      trigger: { kind: "prepage" },
      minutesAgo: v.key ? 299 : 239,
      author: "deploybot",
      text: `${api} ${v.apiVersion} deployed to production`,
      card: { service: api, version: v.apiVersion, sha: v.filler.apiSha, by: "deployer", env: "production", changes: v.filler.apiChange, status: "succeeded" },
    },
    { id: "infra.cert", channel: "infra", trigger: { kind: "prepage" }, minutesAgo: 400, author: "infra", text: v.filler.cert },
    { id: "infra.lag", channel: "infra", trigger: { kind: "prepage" }, minutesAgo: 62, hotspotId: "laptop.slack.infra" },
    { id: "infra.disk", channel: "infra", trigger: { kind: "prepage" }, minutesAgo: 120, author: "infra", text: v.filler.disk.text, code: v.filler.disk.code },
    { id: "dm.support.refund", channel: "dm:support", trigger: { kind: "prepage" }, minutesAgo: 30, author: "support", text: "hey, are you on call today? someone asked about a refund, not urgent" },
    { id: "incidents.opened", channel: "incidents", trigger: { kind: "page" }, author: "bot", text: `SEV2 opened: ${v.page.title}. Primary: you. Secondary: {secondary}.` },
    { id: "incidents.support", channel: "incidents", trigger: { kind: "alert", alertId: "customer_5xx" }, author: "support", text: v.key ? "Customers are writing in: order history is empty or errors right after they order." : "Customers are writing in: their cart keeps changing and checkout gives an error page." },
    { id: "incidents.lag", channel: "incidents", trigger: { kind: "alert", alertId: "replica_lag" }, author: "bot", text: `ReplicaLagHigh firing: ${v.labels.replica} is more than 30 s behind.` },
    {
      id: "dm.secondary.mitigated",
      channel: "dm:secondary",
      trigger: { kind: "status", status: "mitigated", afterTicks: 200 },
      author: "secondary",
      text: "the errors are gone, but is the replica still behind, or did we only hide it for now?",
    },
    { id: "dm.deployer.changes", channel: "dm:deployer", trigger: { kind: "action", actionId: "ask.deployer.changes" }, author: "deployer", text: `${v.asks.deployer} Why, is it acting up?` },
    { id: "dm.infra.stale", channel: "dm:infra", trigger: { kind: "action", actionId: "ask.infra.stale" }, author: "infra", text: v.asks.infra },
    { id: "dm.support.impact", channel: "dm:support", trigger: { kind: "action", actionId: "ask.support.impact" }, author: "support", text: v.asks.support },
    { id: "dm.secondary.look", channel: "dm:secondary", trigger: { kind: "action", actionId: "global.ask_secondary" }, author: "secondary", text: v.asks.secondary },
  ];
}

const staticRequests: RequestPattern[] = [
  { method: "GET", path: "/", type: "document", initiator: "Other", weight: 3, okStatus: 200, failsWithSymptom: false, okMs: [40, 110], failMs: [40, 110] },
  { method: "GET", path: "/assets/app.js", type: "script", initiator: "(index)", weight: 2, okStatus: 304, failsWithSymptom: false, okMs: [8, 20], failMs: [8, 20] },
  { method: "GET", path: "/assets/app.css", type: "stylesheet", initiator: "(index)", weight: 1, okStatus: 304, failsWithSymptom: false, okMs: [6, 16], failMs: [6, 16] },
  { method: "GET", path: "/img/p/{id}.webp", type: "img", initiator: "(index)", weight: 3, okStatus: 200, failsWithSymptom: false, okMs: [20, 80], failMs: [20, 80] },
  { method: "GET", path: "/products/{id}", type: "fetch", initiator: "app.js", weight: 4, okStatus: 200, failsWithSymptom: false, okMs: [25, 90], failMs: [25, 90] },
];

/** The cart reads from the replica, so checkout hits a version conflict and answers 500. */
export const analyticsDesktop: DesktopContent = {
  server: "framework",
  channels: CHANNELS,
  channelInfo: CHANNEL_INFO,
  chat: chat(analytics),
  requests: [
    ...staticRequests,
    { method: "GET", path: "/cart", type: "fetch", initiator: "app.js", weight: 3, okStatus: 200, failsWithSymptom: false, okMs: [30, 90], failMs: [30, 90] },
    { method: "POST", path: "/checkout", type: "fetch", initiator: "app.js", weight: 3, okStatus: 200, failsWithSymptom: true, okMs: [180, 420], failMs: [180, 320] },
  ],
};

/** The order history page reads from the replica and cannot render a fresh order, so the gateway answers 502. */
export const migrationDesktop: DesktopContent = {
  server: "nginx",
  channels: CHANNELS,
  channelInfo: CHANNEL_INFO,
  chat: chat(migration),
  requests: [
    ...staticRequests,
    { method: "POST", path: "/checkout", type: "fetch", initiator: "app.js", weight: 2, okStatus: 200, failsWithSymptom: false, okMs: [180, 420], failMs: [180, 420] },
    { method: "GET", path: "/account/orders", type: "fetch", initiator: "app.js", weight: 3, okStatus: 200, failsWithSymptom: true, okMs: [40, 120], failMs: [90, 170] },
  ],
};
