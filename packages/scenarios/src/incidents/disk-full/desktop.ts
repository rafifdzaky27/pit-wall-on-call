import type { ChatMessage, DesktopContent, RequestPattern } from "../../desktop";

const CHANNELS = ["incidents", "deploys", "infra"] as const;
const CHANNEL_INFO: DesktopContent["channelInfo"] = {
  incidents: { topic: "Active incidents only. Declare, then keep updates in a thread.", members: 38, pinned: 3 },
  deploys: { topic: "Production deploy notifications from Deploy Bot", members: 52, pinned: 1 },
  infra: { topic: "Databases, networking and platform maintenance notices", members: 24, pinned: 5 },
};

/** Browsing is fine; only the order POST fails (the write path is what the full disk breaks). */
const REQUESTS: RequestPattern[] = [
  { method: "GET", path: "/", type: "document", initiator: "Other", weight: 3, okStatus: 200, failsWithSymptom: false, okMs: [40, 110], failMs: [40, 110] },
  { method: "GET", path: "/assets/app.js", type: "script", initiator: "(index)", weight: 2, okStatus: 304, failsWithSymptom: false, okMs: [8, 20], failMs: [8, 20] },
  { method: "GET", path: "/assets/app.css", type: "stylesheet", initiator: "(index)", weight: 1, okStatus: 304, failsWithSymptom: false, okMs: [6, 16], failMs: [6, 16] },
  { method: "GET", path: "/img/p/{id}.webp", type: "img", initiator: "(index)", weight: 3, okStatus: 200, failsWithSymptom: false, okMs: [20, 80], failMs: [20, 80] },
  { method: "GET", path: "/products/{id}", type: "fetch", initiator: "app.js", weight: 4, okStatus: 200, failsWithSymptom: false, okMs: [25, 90], failMs: [25, 90] },
  { method: "POST", path: "/cart", type: "fetch", initiator: "app.js", weight: 2, okStatus: 201, failsWithSymptom: false, okMs: [60, 140], failMs: [60, 140] },
  { method: "POST", path: "/checkout", type: "fetch", initiator: "app.js", weight: 3, okStatus: 200, failsWithSymptom: true, okMs: [180, 420], failMs: [60, 180] },
];

/** Background chat shared by both variants. It adds no clue: the clues live in the hotspots and the teammates' replies. */
const BACKGROUND: ChatMessage[] = [
  { id: "incidents.sev3", channel: "incidents", trigger: { kind: "prepage" }, minutesAgo: 2900, author: "bot", text: "SEV3 resolved: image-resizer queue backlog. Duration 22 min. Postmortem PM-219." },
  {
    id: "incidents.pm219",
    channel: "incidents",
    trigger: { kind: "prepage" },
    minutesAgo: 2700,
    author: "secondary",
    text: "PM-219 is up for review. A worker pool was sized too small; resized, alert added.",
    reactions: [{ emoji: "👀", by: ["infra", "support"] }],
    thread: [
      { author: "infra", text: "left a comment on the timeline", minutesAgo: 2600 },
      { author: "secondary", text: "thanks, fixed", minutesAgo: 2580 },
    ],
  },
  {
    id: "deploys.search",
    channel: "deploys",
    trigger: { kind: "prepage" },
    minutesAgo: 4200,
    author: "deploybot",
    text: "search-api v91 deployed to production",
    card: { service: "search-api", version: "v91", sha: "e02a7c4", by: "secondary", env: "production", changes: "Tune the result cache TTL", status: "succeeded" },
  },
  { id: "infra.cert", channel: "infra", trigger: { kind: "prepage" }, minutesAgo: 900, author: "infra", text: "renewed the TLS certificate for *.{domain}. Next expiry in 60 days." },
  { id: "dm.support.refund", channel: "dm:support", trigger: { kind: "prepage" }, minutesAgo: 25, author: "support", text: "hey, are you on call tonight? a customer asked about a refund, not urgent" },
  { id: "incidents.opened", channel: "incidents", trigger: { kind: "page" }, author: "bot", text: "SEV2 opened: Placing orders returns 500. Primary: you. Secondary: {secondary}." },
];

const ASK_SECONDARY: ChatMessage = {
  id: "dm.secondary.deploy",
  channel: "dm:secondary",
  trigger: { kind: "action", actionId: "global.ask_secondary" },
  author: "secondary",
  text: "Orders fail, browsing is fine. That smells like something on the write path. Have you looked at what filled up?",
};

const SUPPORT_IMPACT = (text: string): ChatMessage => ({ id: "dm.support.impact", channel: "dm:support", trigger: { kind: "action", actionId: "ask.support.impact" }, author: "support", text });

export const diskFullLogsDesktop: DesktopContent = {
  server: "nginx",
  channels: CHANNELS,
  channelInfo: CHANNEL_INFO,
  chat: [
    ...BACKGROUND,
    {
      id: "deploys.cfg88",
      channel: "deploys",
      trigger: { kind: "prepage" },
      minutesAgo: 120,
      author: "deploybot",
      text: "checkout-api cfg-88 applied to production",
      card: { service: "checkout-api", version: "cfg-88", sha: "b7710e2", by: "deployer", env: "production", changes: "LOG_LEVEL info to debug for the cart trace (temporary)", status: "succeeded" },
    },
    {
      id: "deploys.v155",
      channel: "deploys",
      trigger: { kind: "prepage" },
      minutesAgo: 41,
      author: "deploybot",
      text: "checkout-api v155 deployed to production",
      card: { service: "checkout-api", version: "v155", sha: "5d1c9a0", by: "deployer", env: "production", changes: "Bump payments SDK to 4.3", status: "succeeded" },
    },
    { id: "deploys.note", channel: "deploys", trigger: { kind: "prepage" }, minutesAgo: 42, hotspotId: "laptop.slack.deploys" },
    { id: "infra.disk", channel: "infra", trigger: { kind: "prepage" }, minutesAgo: 20, hotspotId: "laptop.slack.infra" },
    {
      id: "dm.secondary.mitigated",
      channel: "dm:secondary",
      trigger: { kind: "status", status: "mitigated", afterTicks: 200 },
      author: "secondary",
      text: "Orders are going through again, but /var/log on api-node-2 is filling up again. Did we stop what is writing so much?",
    },
    { id: "dm.deployer.changes", channel: "dm:deployer", trigger: { kind: "action", actionId: "ask.deployer.changes" }, author: "deployer", text: "only v155, the payments SDK bump. Nothing that touches logging, I'd say. Is it acting up?" },
    { id: "dm.infra.disk", channel: "dm:infra", trigger: { kind: "action", actionId: "ask.infra.disk" }, author: "infra", text: "that's the nightly backup staging, it always spikes /var. Ignore it, it clears itself." },
    SUPPORT_IMPACT("browsing and the cart are fine. Pressing Place order gives a 500 page, every time."),
    ASK_SECONDARY,
  ],
  requests: REQUESTS,
};

export const diskFullWalDesktop: DesktopContent = {
  server: "nginx",
  channels: CHANNELS,
  channelInfo: CHANNEL_INFO,
  chat: [
    ...BACKGROUND,
    {
      id: "deploys.v211",
      channel: "deploys",
      trigger: { kind: "prepage" },
      minutesAgo: 5400,
      author: "deploybot",
      text: "checkout-api v211 deployed to production",
      card: { service: "checkout-api", version: "v211", sha: "0c3f5e8", by: "deployer", env: "production", changes: "Fix rounding on discounted totals", status: "succeeded" },
    },
    {
      id: "deploys.v212",
      channel: "deploys",
      trigger: { kind: "prepage" },
      minutesAgo: 95,
      author: "deploybot",
      text: "checkout-api v212 deployed to production",
      card: { service: "checkout-api", version: "v212", sha: "a94d1be", by: "deployer", env: "production", changes: "Add the order_events table and an index (migration ran clean)", status: "succeeded" },
    },
    { id: "deploys.note", channel: "deploys", trigger: { kind: "prepage" }, minutesAgo: 96, hotspotId: "laptop.slack.deploys" },
    { id: "infra.reporting", channel: "infra", trigger: { kind: "prepage" }, minutesAgo: 3100, hotspotId: "laptop.slack.infra" },
    { id: "infra.replica", channel: "infra", trigger: { kind: "prepage" }, minutesAgo: 3050, author: "infra", text: "reporting-replica is shut down. Analytics moved to the warehouse." },
    {
      id: "dm.secondary.mitigated",
      channel: "dm:secondary",
      trigger: { kind: "status", status: "mitigated", afterTicks: 200 },
      author: "secondary",
      text: "Orders work again, but the WAL volume is climbing again. Is something still holding the WAL back?",
    },
    { id: "dm.deployer.changes", channel: "dm:deployer", trigger: { kind: "action", actionId: "ask.deployer.changes" }, author: "deployer", text: "v212 added the order_events table and an index. That has to be a lot of writes, so the WAL is my bet." },
    { id: "dm.infra.replica", channel: "dm:infra", trigger: { kind: "action", actionId: "ask.infra.replica" }, author: "infra", text: "we switched analytics off the reporting replica on Tuesday. The replica is down, and I don't remember cleaning up its slot." },
    SUPPORT_IMPACT("browsing works. Placing an order gives a 500 page, and a couple of customers say their cart is intact."),
    ASK_SECONDARY,
  ],
  requests: REQUESTS,
};
