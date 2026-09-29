import type { ChatMessage, DesktopContent, RequestPattern } from "../../desktop";

const CHANNELS = ["incidents", "deploys", "infra"] as const;
const CHANNEL_INFO: DesktopContent["channelInfo"] = {
  incidents: { topic: "Active incidents only. Declare, then keep updates in a thread.", members: 38, pinned: 3 },
  deploys: { topic: "Production deploy notifications from Deploy Bot", members: 52, pinned: 1 },
  infra: { topic: "Databases, networking and platform maintenance notices", members: 24, pinned: 5 },
};

/** Browsing and the cart are fine; the order POST is what fails, with a 502 from the gateway. */
const REQUESTS: RequestPattern[] = [
  { method: "GET", path: "/", type: "document", initiator: "Other", weight: 3, okStatus: 200, failsWithSymptom: false, okMs: [40, 110], failMs: [40, 110] },
  { method: "GET", path: "/assets/app.js", type: "script", initiator: "(index)", weight: 2, okStatus: 304, failsWithSymptom: false, okMs: [8, 20], failMs: [8, 20] },
  { method: "GET", path: "/assets/app.css", type: "stylesheet", initiator: "(index)", weight: 1, okStatus: 304, failsWithSymptom: false, okMs: [6, 16], failMs: [6, 16] },
  { method: "GET", path: "/img/p/{id}.webp", type: "img", initiator: "(index)", weight: 3, okStatus: 200, failsWithSymptom: false, okMs: [20, 80], failMs: [20, 80] },
  { method: "GET", path: "/products/{id}", type: "fetch", initiator: "app.js", weight: 4, okStatus: 200, failsWithSymptom: false, okMs: [25, 90], failMs: [25, 90] },
  { method: "POST", path: "/cart", type: "fetch", initiator: "app.js", weight: 2, okStatus: 201, failsWithSymptom: false, okMs: [60, 140], failMs: [60, 140] },
  { method: "POST", path: "/checkout", type: "fetch", initiator: "app.js", weight: 3, okStatus: 200, failsWithSymptom: true, okMs: [180, 420], failMs: [380, 700] },
];

/** Background chat for both variants. It adds no clue: the clues are the hotspots and the teammates' replies. */
const background = (pm: number): ChatMessage[] => [
  { id: "incidents.sev3", channel: "incidents", trigger: { kind: "prepage" }, minutesAgo: 3300, author: "bot", text: `SEV3 resolved: email provider delays. Duration 31 min. Postmortem PM-${pm}.` },
  {
    id: "incidents.pm",
    channel: "incidents",
    trigger: { kind: "prepage" },
    minutesAgo: 3100,
    author: "secondary",
    text: `PM-${pm} is up for review. The provider was slow, we queued and retried. No action items.`,
    reactions: [{ emoji: "👍", by: ["infra", "support"] }],
    thread: [{ author: "infra", text: "looks right to me", minutesAgo: 3000 }],
  },
  {
    id: "deploys.search",
    channel: "deploys",
    trigger: { kind: "prepage" },
    minutesAgo: 4200,
    author: "deploybot",
    text: "search-api v92 deployed to production",
    card: { service: "search-api", version: "v92", sha: "77e10cd", by: "secondary", env: "production", changes: "Tune the result cache TTL", status: "succeeded" },
  },
  { id: "infra.dns", channel: "infra", trigger: { kind: "prepage" }, minutesAgo: 700, author: "infra", text: "DNS TTLs for the marketing pages are back to 300 s after the migration." },
  { id: "dm.support.refund", channel: "dm:support", trigger: { kind: "prepage" }, minutesAgo: 30, author: "support", text: "hey, are you on call? a customer wants a receipt resent, not urgent" },
  { id: "incidents.opened", channel: "incidents", trigger: { kind: "page" }, author: "bot", text: "SEV2 opened: Placing orders returns 502. Primary: you. Secondary: {secondary}." },
  {
    id: "dm.secondary.deploy",
    channel: "dm:secondary",
    trigger: { kind: "action", actionId: "global.ask_secondary" },
    author: "secondary",
    text: "Only the pay step fails, and every error is a handshake. Has anything with a lifetime run out?",
  },
];

const dm = (id: string, actionId: string, author: "deployer" | "infra" | "support", text: string): ChatMessage => ({
  id,
  channel: `dm:${author}`,
  trigger: { kind: "action", actionId },
  author,
  text,
});

export const expiredCertPaymentsDesktop: DesktopContent = {
  server: "nginx",
  channels: CHANNELS,
  channelInfo: CHANNEL_INFO,
  chat: [
    ...background(234),
    {
      id: "deploys.v87",
      channel: "deploys",
      trigger: { kind: "prepage" },
      minutesAgo: 9000,
      author: "deploybot",
      text: "checkout-api v87 deployed to production",
      card: { service: "checkout-api", version: "v87", sha: "3ab90fe", by: "deployer", env: "production", changes: "Cart totals rounding", status: "succeeded" },
    },
    {
      id: "deploys.v88",
      channel: "deploys",
      trigger: { kind: "prepage" },
      minutesAgo: 180,
      author: "deploybot",
      text: "checkout-api v88 deployed to production",
      card: { service: "checkout-api", version: "v88", sha: "e6d21c5", by: "deployer", env: "production", changes: "Order confirmation copy", status: "succeeded" },
    },
    { id: "deploys.note", channel: "deploys", trigger: { kind: "prepage" }, minutesAgo: 181, hotspotId: "laptop.slack.deploys" },
    { id: "infra.certjob", channel: "infra", trigger: { kind: "prepage" }, minutesAgo: 45, hotspotId: "laptop.slack.infra" },
    {
      id: "dm.secondary.mitigated",
      channel: "dm:secondary",
      trigger: { kind: "status", status: "mitigated", afterTicks: 200 },
      author: "secondary",
      text: "Payments are flowing again, but I see handshake errors coming back. Did we change the thing that was failing, or just reset it?",
    },
    dm("dm.deployer.changes", "ask.deployer.changes", "deployer", "only v88, a copy change on the confirmation page. Nothing near payments."),
    dm("dm.infra.certs", "ask.infra.certs", "infra", "we renew certs with the DNS job. It has been red for a while, I keep meaning to look. Why?"),
    dm("dm.support.impact", "ask.support.impact", "support", "about 1 in 3 orders fail at the pay step with a 502 page. Refund requests are piling up."),
  ],
  requests: REQUESTS,
};

export const expiredCertMeshDesktop: DesktopContent = {
  server: "nginx",
  channels: CHANNELS,
  channelInfo: CHANNEL_INFO,
  chat: [
    ...background(235),
    {
      id: "deploys.stock300",
      channel: "deploys",
      trigger: { kind: "prepage" },
      minutesAgo: 6000,
      author: "deploybot",
      text: "stock-api v300 deployed to production",
      card: { service: "stock-api", version: "v300", sha: "1f8a7d3", by: "deployer", env: "production", changes: "Batch the reservation queries", status: "succeeded" },
    },
    {
      id: "deploys.stock301",
      channel: "deploys",
      trigger: { kind: "prepage" },
      minutesAgo: 120,
      author: "deploybot",
      text: "stock-api v301 deployed to production",
      card: { service: "stock-api", version: "v301", sha: "9be04c1", by: "deployer", env: "production", changes: "Add an index on reservations", status: "succeeded" },
    },
    {
      id: "deploys.v207",
      channel: "deploys",
      trigger: { kind: "prepage" },
      minutesAgo: 4000,
      author: "deploybot",
      text: "checkout-api v207 deployed to production",
      card: { service: "checkout-api", version: "v207", sha: "c02e6b9", by: "secondary", env: "production", changes: "Retry the stock call once", status: "succeeded" },
    },
    { id: "deploys.note", channel: "deploys", trigger: { kind: "prepage" }, minutesAgo: 121, hotspotId: "laptop.slack.deploys" },
    { id: "infra.approval", channel: "infra", trigger: { kind: "prepage" }, minutesAgo: 60, hotspotId: "laptop.slack.infra" },
    {
      id: "dm.secondary.mitigated",
      channel: "dm:secondary",
      trigger: { kind: "status", status: "mitigated", afterTicks: 200 },
      author: "secondary",
      text: "Orders are going through, but stock-api handshake errors are back in the logs. Is the far end really fixed?",
    },
    dm("dm.deployer.changes", "ask.deployer.changes", "deployer", "v301 on stock-api added an index on reservations, so it has to be the database. Have you looked at postgres?"),
    dm("dm.infra.mesh", "ask.infra.mesh", "infra", "the mesh certs last 30 days, and the auto-reissue needs someone to approve it. I approved the last one. Did it go stale?"),
    dm("dm.support.impact", "ask.support.impact", "support", "orders fail at 'Place order' with a 502 page. Product pages still show stock levels, so that part is fine."),
  ],
  requests: REQUESTS,
};
