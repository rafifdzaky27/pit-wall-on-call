import type { ChatMessage, DesktopContent, RequestPattern } from "../../desktop";
import type { CacheVariant } from "./scenario";

const request = (r: Omit<RequestPattern, "method"> & { method?: RequestPattern["method"] }): RequestPattern => ({ method: "GET", ...r });

// The clues are in the hotspot messages, the phone mention, the deploy card or the maintenance note, and the DM
// replies. The loud herring is the database, which infra confidently says to grow.
export function cacheStampedeDesktop(v: CacheVariant): DesktopContent {
  const prefix = v.trigger === "prefix";
  const api = prefix ? "catalog-api" : "pricing-api";
  const db = prefix ? "postgres" : "pricing-db";

  const chat: ChatMessage[] = [
    { id: "incidents.sev3", channel: "incidents", trigger: { kind: "prepage" }, minutesAgo: 3100, author: "bot", text: "SEV3 resolved: transactional emails delayed. Duration 34 min. Postmortem PM-224." },
    {
      id: "incidents.pm224",
      channel: "incidents",
      trigger: { kind: "prepage" },
      minutesAgo: 2900,
      author: "secondary",
      text: "PM-224 is up for review. The queue consumer had no backoff, so a retry storm doubled the delay.",
      reactions: [{ emoji: "👀", by: ["infra", "deployer"] }],
      thread: [{ author: "deployer", text: "added a comment on the backoff follow-up", minutesAgo: 2800 }],
    },
    {
      id: "deploys.api.old",
      channel: "deploys",
      trigger: { kind: "prepage" },
      minutesAgo: prefix ? 4300 : 5200,
      author: "deploybot",
      text: `${api} ${prefix ? "v310" : "v154"} deployed to production`,
      card: { service: api, version: prefix ? "v310" : "v154", sha: prefix ? "a83c7d2" : "9e51b04", by: "secondary", env: "production", changes: prefix ? "Add related products to the product page" : "Round line totals per item", status: "succeeded" },
    },
    prefix
      ? {
          id: "deploys.api.new",
          channel: "deploys",
          trigger: { kind: "prepage" },
          minutesAgo: 24,
          author: "deploybot",
          text: "catalog-api v311 deployed to production",
          card: { service: "catalog-api", version: "v311", sha: "c04f19e", by: "deployer", env: "production", changes: "Cache key prefix v2 to v3 for the schema change (#3481)", status: "succeeded" },
        }
      : {
          id: "deploys.api.new",
          channel: "deploys",
          trigger: { kind: "prepage" },
          minutesAgo: 180,
          author: "deploybot",
          text: "pricing-api v155 deployed to production",
          card: { service: "pricing-api", version: "v155", sha: "2bd68a7", by: "secondary", env: "production", changes: "Fix rounding on tax-inclusive prices (#3475)", status: "succeeded" },
        },
    prefix
      ? { id: "deploys.lunch", channel: "deploys", trigger: { kind: "prepage" }, minutesAgo: 25, hotspotId: "laptop.slack.deploys", reactions: [{ emoji: "👍", by: ["secondary"] }] }
      : { id: "deploys.rounding", channel: "deploys", trigger: { kind: "prepage" }, minutesAgo: 175, hotspotId: "laptop.slack.deploys", reactions: [{ emoji: "👍", by: ["deployer"] }] },
    prefix
      ? { id: "infra.peak", channel: "infra", trigger: { kind: "prepage" }, minutesAgo: 60, hotspotId: "laptop.slack.infra" }
      : { id: "infra.redis", channel: "infra", trigger: { kind: "prepage" }, minutesAgo: 22, hotspotId: "laptop.slack.infra", reactions: [{ emoji: "✅", by: ["secondary"] }] },
    { id: "infra.cert", channel: "infra", trigger: { kind: "prepage" }, minutesAgo: 300, author: "infra", text: "renewed the TLS certificate for *.{domain}. Next expiry in 60 days." },
    { id: "infra.disk", channel: "infra", trigger: { kind: "prepage" }, minutesAgo: 170, author: "infra", text: "rotated the log volumes on the batch nodes", code: "/var/log   36% used   (was 79%)" },
    { id: "dm.support.hello", channel: "dm:support", trigger: { kind: "prepage" }, minutesAgo: 40, author: "support", text: "morning! did the new return-label template ever go live? no rush" },
    { id: "incidents.opened", channel: "incidents", trigger: { kind: "page" }, author: "bot", text: `SEV2 opened: ${prefix ? "Product pages failing with 503" : "Prices and checkout failing with 503"}. Primary: you. Secondary: {secondary}.` },
    { id: "incidents.support", channel: "incidents", trigger: { kind: "alert", alertId: "site_5xx" }, author: "support", text: prefix ? "Customers are writing in: product pages say Service Unavailable." : "Customers are writing in: prices will not load and checkout fails." },
    {
      id: "dm.secondary.mitigated",
      channel: "dm:secondary",
      trigger: { kind: "status", status: "mitigated", afterTicks: 150 },
      author: "secondary",
      text: `errors have stopped, but the hit ratio on redis is still low and ${db} is close to its limit again. Did we fix why it is cold, or just make room?`,
    },
    {
      id: "dm.deployer.changes",
      channel: "dm:deployer",
      trigger: { kind: "action", actionId: "ask.deployer.changes" },
      author: "deployer",
      text: prefix ? "catalog-api v311. It renames the cache key prefix because of a schema change. It was fine in staging, why? Is something on fire?" : "nothing from me today. Only {secondary} shipped a rounding fix on pricing-api this morning, and that was fine.",
    },
    { id: "dm.infra.db", channel: "dm:infra", trigger: { kind: "action", actionId: "ask.infra.db" }, author: "infra", text: `it's out of connections and CPU, classic. Raise max_connections or fail over to the replica, that's what I'd do. I've seen ${db} do this a hundred times.` },
    { id: "dm.support.impact", channel: "dm:support", trigger: { kind: "action", actionId: "ask.support.impact" }, author: "support", text: prefix ? "product pages come back with 'Service Unavailable' or take forever. Started about 25 minutes ago. The home page is fine." : "the price line shows 'Service Unavailable' and checkout fails. Started about 20 minutes ago." },
    { id: "dm.secondary.reads", channel: "dm:secondary", trigger: { kind: "action", actionId: "global.ask_secondary" }, author: "secondary", text: `the database is the victim, I think. Why did it suddenly get so many more reads than the traffic explains?` },
  ];

  const requests: RequestPattern[] = prefix
    ? [
        request({ path: "/", type: "document", initiator: "Other", weight: 3, okStatus: 200, failsWithSymptom: false, okMs: [40, 110], failMs: [40, 110] }),
        request({ path: "/assets/app.js", type: "script", initiator: "(index)", weight: 2, okStatus: 304, failsWithSymptom: false, okMs: [8, 20], failMs: [8, 20] }),
        request({ path: "/assets/app.css", type: "stylesheet", initiator: "(index)", weight: 1, okStatus: 304, failsWithSymptom: false, okMs: [6, 16], failMs: [6, 16] }),
        request({ path: "/img/p/{id}.webp", type: "img", initiator: "(index)", weight: 3, okStatus: 200, failsWithSymptom: false, okMs: [20, 80], failMs: [20, 80] }),
        request({ path: "/products/{id}", type: "document", initiator: "Other", weight: 4, okStatus: 200, failsWithSymptom: true, okMs: [30, 120], failMs: [3000, 3100] }),
        request({ path: "/api/products/{id}", type: "fetch", initiator: "app.js", weight: 4, okStatus: 200, failsWithSymptom: true, okMs: [8, 30], failMs: [3000, 3100] }),
      ]
    : [
        request({ path: "/cart", type: "document", initiator: "Other", weight: 3, okStatus: 200, failsWithSymptom: false, okMs: [40, 110], failMs: [40, 110] }),
        request({ path: "/assets/app.js", type: "script", initiator: "(index)", weight: 2, okStatus: 304, failsWithSymptom: false, okMs: [8, 20], failMs: [8, 20] }),
        request({ path: "/assets/app.css", type: "stylesheet", initiator: "(index)", weight: 1, okStatus: 304, failsWithSymptom: false, okMs: [6, 16], failMs: [6, 16] }),
        request({ path: "/img/p/{id}.webp", type: "img", initiator: "(index)", weight: 3, okStatus: 200, failsWithSymptom: false, okMs: [20, 80], failMs: [20, 80] }),
        request({ path: "/api/prices/{id}", type: "fetch", initiator: "app.js", weight: 4, okStatus: 200, failsWithSymptom: true, okMs: [8, 30], failMs: [3000, 3100] }),
        request({ method: "POST", path: "/api/checkout", type: "fetch", initiator: "app.js", weight: 2, okStatus: 201, failsWithSymptom: true, okMs: [80, 180], failMs: [3000, 3100] }),
      ];

  return {
    server: "framework",
    channels: ["incidents", "deploys", "infra"],
    channelInfo: {
      incidents: { topic: "Active incidents only. Declare, then keep updates in a thread.", members: 38, pinned: 3 },
      deploys: { topic: "Production deploy and config notifications from Deploy Bot", members: 52, pinned: 1 },
      infra: { topic: "Databases, networking and platform maintenance notices", members: 24, pinned: 5 },
    },
    chat,
    requests,
  };
}
