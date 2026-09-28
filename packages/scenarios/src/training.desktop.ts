import type { DesktopContent } from "./desktop";
import { slowLeakDesktop } from "./slow-leak.desktop";

// The training shift's workspace. The secondary coaches in a DM, one step behind the player, so the
// chat reads like a colleague walking you through your first page (M2.5 spec §5).
export const trainingDesktop: DesktopContent = {
  server: "nginx",
  channels: ["incidents", "deploys", "infra"],
  channelInfo: {
    incidents: { topic: "Active incidents only. Declare, then keep updates in a thread.", members: 38, pinned: 3 },
    deploys: { topic: "Production deploy and config notifications", members: 52, pinned: 1 },
    infra: { topic: "Databases, caches and platform maintenance notices", members: 24, pinned: 5 },
  },
  chat: [
    {
      id: "deploys.v11",
      channel: "deploys",
      trigger: { kind: "prepage" },
      minutesAgo: 20160,
      author: "deploybot",
      text: "shop-api config v11 applied to production",
      card: { service: "shop-api", version: "config v11", sha: "4a1e20b", by: "secondary", env: "production", changes: "Raise the Redis pool to 64", status: "succeeded" },
    },
    { id: "deploys.lunch", channel: "deploys", trigger: { kind: "prepage" }, minutesAgo: 7, hotspotId: "laptop.slack.deploys" },
    {
      id: "deploys.v12",
      channel: "deploys",
      trigger: { kind: "prepage" },
      minutesAgo: 6,
      author: "deploybot",
      text: "shop-api config v12 applied to production",
      card: { service: "shop-api", version: "config v12", sha: "b93c7d1", by: "deployer", env: "production", changes: "Tune redis for speed", status: "succeeded" },
    },
    { id: "infra.patch", channel: "infra", trigger: { kind: "prepage" }, minutesAgo: 90, hotspotId: "laptop.slack.infra" },
    { id: "dm.secondary.hello", channel: "dm:secondary", trigger: { kind: "prepage" }, minutesAgo: 1, author: "secondary", text: "hey! first shift? this one is a drill, and I'll coach you through it. When the pager goes off, acknowledge it first (press A)." },
    { id: "incidents.opened", channel: "incidents", trigger: { kind: "page" }, author: "bot", text: "SEV2 opened: Checkout returning 500s. Primary: you. Secondary: {secondary} (coaching)." },
    {
      id: "dm.secondary.logs",
      channel: "dm:secondary",
      trigger: { kind: "action", actionId: "api.logs" },
      author: "secondary",
      text: "nice. Redis answers in 2 ms but the api gives up after 5 ms. That timeout looks new. What changed? Try the api's config history.",
    },
    {
      id: "dm.secondary.config",
      channel: "dm:secondary",
      trigger: { kind: "action", actionId: "api.config" },
      author: "secondary",
      text: "there it is: v12 cut the timeout from 250 ms to 5 ms. Roll the config back to v11.",
    },
    {
      id: "dm.secondary.rollback",
      channel: "dm:secondary",
      trigger: { kind: "action", actionId: "api.config_rollback" },
      author: "secondary",
      text: "rolled back. Now watch the fix hold for 10 s, and post a status update so customers know.",
    },
    { id: "dm.secondary.deploy", channel: "dm:secondary", trigger: { kind: "action", actionId: "global.ask_secondary" }, author: "secondary", text: "{deployer} pushed a config change a few minutes ago. Worth a look." },
  ],
  // The same shop, so the same traffic; only the failing status differs (a 500, from the symptom).
  requests: slowLeakDesktop.requests,
};
