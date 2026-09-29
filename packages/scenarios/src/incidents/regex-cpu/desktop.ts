import type { ChatMessage, DesktopContent, RequestPattern } from "../../desktop";
import type { RegexVariant } from "./scenario";

const request = (r: Omit<RequestPattern, "method"> & { method?: RequestPattern["method"] }): RequestPattern => ({ method: "GET", ...r });

// Background messages make the workspace look lived-in. The clues stay in the hotspot messages, the
// phone mention, the config card and the DM replies; the loud herring is the lunch traffic.
export function regexCpuDesktop(v: RegexVariant): DesktopContent {
  const edge = v.layer === "edge";
  const layerLabel = edge ? "edge-gateway" : "search-api";
  const cfgNow = edge ? "config v37" : "config v52";
  const cfgOld = edge ? "config v36" : "config v51";

  const chat: ChatMessage[] = [
    { id: "incidents.sev3", channel: "incidents", trigger: { kind: "prepage" }, minutesAgo: 2900, author: "bot", text: "SEV3 resolved: image CDN cache purge slow. Duration 22 min. Postmortem PM-251." },
    {
      id: "incidents.pm251",
      channel: "incidents",
      trigger: { kind: "prepage" },
      minutesAgo: 2700,
      author: "secondary",
      text: "PM-251 is up for review. Short one: a purge job that ran without a rate limit.",
      reactions: [{ emoji: "👀", by: ["infra", "support"] }],
      thread: [{ author: "infra", text: "left a comment on the follow-ups", minutesAgo: 2600 }],
    },
    {
      id: "deploys.cfg.old",
      channel: "deploys",
      trigger: { kind: "prepage" },
      minutesAgo: edge ? 5900 : 7300,
      author: "deploybot",
      text: `${layerLabel} ${cfgOld} applied to production`,
      card: { service: layerLabel, version: cfgOld, sha: edge ? "7ad3e51" : "e02b6c4", by: "infra", env: "production", changes: edge ? "Raise the WAF request body limit to 1 MB" : "Raise the result cache size", status: "succeeded" },
    },
    {
      id: "deploys.search.v89",
      channel: "deploys",
      trigger: { kind: "prepage" },
      minutesAgo: 1900,
      author: "deploybot",
      text: "search-api v89 deployed to production",
      card: { service: "search-api", version: "v89", sha: "5c90ab2", by: "secondary", env: "production", changes: "Return facets with search results", status: "succeeded" },
    },
    { id: "deploys.lunch", channel: "deploys", trigger: { kind: "prepage" }, minutesAgo: 23, hotspotId: "laptop.slack.deploys", reactions: [{ emoji: "👍", by: ["secondary"] }] },
    {
      id: "deploys.shop.v204",
      channel: "deploys",
      trigger: { kind: "prepage" },
      minutesAgo: 41,
      author: "deploybot",
      text: "shop-api v204 deployed to production",
      card: { service: "shop-api", version: "v204", sha: "1fb8d20", by: "secondary", env: "production", changes: "Resize product images on upload (#2210)", status: "succeeded" },
    },
    {
      id: "deploys.cfg.new",
      channel: "deploys",
      trigger: { kind: "prepage" },
      minutesAgo: edge ? 21 : 18,
      author: "deploybot",
      text: `${layerLabel} ${cfgNow} applied to production`,
      card: { service: layerLabel, version: cfgNow, sha: edge ? "d4a91c8" : "3b7e0f6", by: "deployer", env: "production", changes: edge ? "Gateway hardening for query strings" : "Search: tighten query handling", status: "succeeded" },
    },
    { id: "infra.peak", channel: "infra", trigger: { kind: "prepage" }, minutesAgo: 60, hotspotId: "laptop.slack.infra" },
    { id: "infra.cert", channel: "infra", trigger: { kind: "prepage" }, minutesAgo: 240, author: "infra", text: "renewed the TLS certificate for *.{domain}. Next expiry in 60 days." },
    { id: "infra.disk", channel: "infra", trigger: { kind: "prepage" }, minutesAgo: 150, author: "infra", text: "rotated the log volumes on the batch nodes", code: "/var/log   38% used   (was 81%)" },
    { id: "dm.support.hello", channel: "dm:support", trigger: { kind: "prepage" }, minutesAgo: 30, author: "support", text: "hey, are you on call today? someone asked about a delayed parcel, not urgent" },
    { id: "incidents.opened", channel: "incidents", trigger: { kind: "page" }, author: "bot", text: `SEV2 opened: ${edge ? "Storefront pages timing out" : "Search timing out"}. Primary: you. Secondary: {secondary}.` },
    { id: "incidents.support", channel: "incidents", trigger: { kind: "alert", alertId: "site_5xx" }, author: "support", text: edge ? "Customers are writing in: pages hang and then show Gateway Time-out." : "Customers are writing in: search hangs and then shows Gateway Time-out." },
    {
      id: "dm.secondary.mitigated",
      channel: "dm:secondary",
      trigger: { kind: "status", status: "mitigated", afterTicks: 150 },
      author: "secondary",
      text: `timeouts have stopped, but ${layerLabel} CPU is climbing again. Did we fix what was burning it, or just make room?`,
    },
    { id: "dm.deployer.changes", channel: "dm:deployer", trigger: { kind: "action", actionId: "ask.deployer.changes" }, author: "deployer", text: edge ? "just a WAF rule to block junk in query strings. I tried it on a few strings and it matched fine. No code deploys from me today, why?" : "just a validation rule for search queries, tried it on a few strings and it was fine. Config only, no code. Why, is search slow?" },
    { id: "dm.infra.load", channel: "dm:infra", trigger: { kind: "action", actionId: "ask.infra.load" }, author: "infra", text: `it's the lunch peak plus the promo email, that's all. Add ${edge ? "gateway nodes" : "search-api pods"} and it goes away, I've seen it a hundred times.` },
    { id: "dm.support.impact", channel: "dm:support", trigger: { kind: "action", actionId: "ask.support.impact" }, author: "support", text: edge ? "pages hang for about 30 seconds and then say Gateway Time-out. Started maybe 20 minutes ago. Some pages load, most don't." : "search hangs and then says Gateway Time-out. Browsing product pages still works fine. Started maybe 20 minutes ago." },
    { id: "dm.secondary.config", channel: "dm:secondary", trigger: { kind: "action", actionId: "global.ask_secondary" }, author: "secondary", text: `the code deploys look boring. What else changes production around the time the errors began, besides code deploys?` },
  ];

  const requests: RequestPattern[] = edge
    ? [
        request({ path: "/", type: "document", initiator: "Other", weight: 3, okStatus: 200, failsWithSymptom: true, okMs: [40, 110], failMs: [30_000, 30_100] }),
        request({ path: "/assets/app.js", type: "script", initiator: "(index)", weight: 2, okStatus: 304, failsWithSymptom: false, okMs: [8, 20], failMs: [8, 20] }),
        request({ path: "/assets/app.css", type: "stylesheet", initiator: "(index)", weight: 1, okStatus: 304, failsWithSymptom: false, okMs: [6, 16], failMs: [6, 16] }),
        request({ path: "/img/p/{id}.webp", type: "img", initiator: "(index)", weight: 3, okStatus: 200, failsWithSymptom: false, okMs: [20, 80], failMs: [20, 80] }),
        request({ path: "/products/{id}", type: "fetch", initiator: "app.js", weight: 4, okStatus: 200, failsWithSymptom: true, okMs: [25, 90], failMs: [30_000, 30_100] }),
        request({ method: "POST", path: "/cart", type: "fetch", initiator: "app.js", weight: 2, okStatus: 201, failsWithSymptom: true, okMs: [60, 140], failMs: [30_000, 30_100] }),
      ]
    : [
        request({ path: "/", type: "document", initiator: "Other", weight: 3, okStatus: 200, failsWithSymptom: false, okMs: [40, 110], failMs: [40, 110] }),
        request({ path: "/assets/app.js", type: "script", initiator: "(index)", weight: 2, okStatus: 304, failsWithSymptom: false, okMs: [8, 20], failMs: [8, 20] }),
        request({ path: "/assets/app.css", type: "stylesheet", initiator: "(index)", weight: 1, okStatus: 304, failsWithSymptom: false, okMs: [6, 16], failMs: [6, 16] }),
        request({ path: "/img/p/{id}.webp", type: "img", initiator: "(index)", weight: 3, okStatus: 200, failsWithSymptom: false, okMs: [20, 80], failMs: [20, 80] }),
        request({ path: "/products/{id}", type: "fetch", initiator: "app.js", weight: 3, okStatus: 200, failsWithSymptom: false, okMs: [25, 90], failMs: [25, 90] }),
        request({ path: "/search?q=helmet", type: "fetch", initiator: "app.js", weight: 4, okStatus: 200, failsWithSymptom: true, okMs: [60, 160], failMs: [30_000, 30_100] }),
      ];

  return {
    server: "nginx",
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
