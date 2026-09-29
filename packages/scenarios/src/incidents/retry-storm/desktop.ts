import type { ChatMessage, DesktopContent } from "../../desktop";
import { CHANNELS, CHANNEL_INFO, storefrontRequests } from "../_dependencies/shared";
import type { StormVariant } from "./scenario";

/**
 * Background messages make the workspace look lived-in. The clues stay in the hotspot messages, the phone
 * mention and the teammates' replies; nothing here names the fix.
 */
export function stormDesktop(v: StormVariant): DesktopContent {
  const edgeCaller = v.caller.id === "edge";
  const dep = v.dep.label;
  const depDeploy = v.herring === "dependency_deploy";

  const callerCard: ChatMessage = edgeCaller
    ? {
        id: "deploys.edge33",
        channel: "deploys",
        trigger: { kind: "prepage" },
        minutesAgo: 7200,
        author: "deploybot",
        text: "edge-gateway v33 deployed to production",
        card: { service: "edge-gateway", version: "v33", sha: "3fd81c2", by: "deployer", env: "production", changes: "Add auth checks for the new login flow", status: "succeeded" },
      }
    : {
        id: "deploys.v312",
        channel: "deploys",
        trigger: { kind: "prepage" },
        minutesAgo: 5800,
        author: "deploybot",
        text: "checkout-api v312 deployed to production",
        card: { service: "checkout-api", version: "v312", sha: "c02be71", by: "deployer", env: "production", changes: "Reserve stock at checkout through inventory-svc", status: "succeeded" },
      };

  const herringChat: ChatMessage[] = depDeploy
    ? [
        { id: "deploys.dep", channel: "deploys", trigger: { kind: "prepage" }, minutesAgo: 76, hotspotId: "laptop.slack.deploys", reactions: [{ emoji: "🚀", by: ["deployer"] }] },
        {
          id: "deploys.inventory58",
          channel: "deploys",
          trigger: { kind: "prepage" },
          minutesAgo: 75,
          author: "deploybot",
          text: "inventory-svc v58 deployed to production",
          card: { service: "inventory-svc", version: "v58", sha: "a4410de", by: "secondary", env: "production", changes: "Faster warehouse lookups", status: "succeeded" },
        },
        { id: "infra.quiet", channel: "infra", trigger: { kind: "prepage" }, minutesAgo: 150, author: "infra", text: "nothing scheduled on the platform today" },
      ]
    : [
        { id: "infra.cache", channel: "infra", trigger: { kind: "prepage" }, minutesAgo: 90, hotspotId: "laptop.slack.infra", reactions: [{ emoji: "👀", by: ["secondary"] }] },
        {
          id: "deploys.auth",
          channel: "deploys",
          trigger: { kind: "prepage" },
          minutesAgo: 3100,
          author: "deploybot",
          text: "auth-svc v90 deployed to production",
          card: { service: "auth-svc", version: "v90", sha: "d7e5a63", by: "secondary", env: "production", changes: "Rotate signing keys automatically", status: "succeeded" },
        },
      ];

  return {
    server: "nginx",
    channels: CHANNELS,
    channelInfo: CHANNEL_INFO,
    chat: [
      { id: "incidents.sev3", channel: "incidents", trigger: { kind: "prepage" }, minutesAgo: 1900, author: "bot", text: `SEV3 resolved: search-api index lag above 5 min. Duration 31 min. Postmortem PM-${v.pm}.` },
      {
        id: `incidents.pm${v.pm}`,
        channel: "incidents",
        trigger: { kind: "prepage" },
        minutesAgo: 1700,
        author: "secondary",
        text: `PM-${v.pm} is up for review. A reindex ran during peak, tuned the schedule.`,
        reactions: [{ emoji: "👀", by: ["infra", "support"] }],
        thread: [
          { author: "infra", text: "left a comment on the timeline", minutesAgo: 1600 },
          { author: "secondary", text: "fixed, thanks", minutesAgo: 1580 },
        ],
      },
      callerCard,
      ...herringChat,
      { id: "infra.failover", channel: "infra", trigger: { kind: "prepage" }, minutesAgo: 15, author: "infra", text: `${v.store.label} did a quick failover a few minutes ago, back to normal now` },
      { id: "support.queue", channel: "support", trigger: { kind: "prepage" }, minutesAgo: 40, author: "support", text: "queue is quiet, a couple of shipping questions" },
      { id: "dm.support.refund", channel: "dm:support", trigger: { kind: "prepage" }, minutesAgo: 25, author: "support", text: "hey, are you on call today? a customer wants a copy of an invoice, not urgent" },
      { id: "incidents.opened", channel: "incidents", trigger: { kind: "page" }, author: "bot", text: `SEV2 opened: ${edgeCaller ? "Sign-in" : "Checkout"} timing out. Primary: you. Secondary: {secondary}.` },
      { id: "support.tickets", channel: "support", trigger: { kind: "alert", alertId: "checkout_5xx" }, author: "support", text: `Tickets are coming in: ${edgeCaller ? "people cannot sign in" : "checkout is timing out"}, on and off since about 15 minutes ago.` },
      {
        id: "dm.secondary.mitigated",
        channel: "dm:secondary",
        trigger: { kind: "status", status: "mitigated", afterTicks: 200 },
        author: "secondary",
        text: "Errors are gone, but nothing about the callers changed. Is it fixed, or just quiet for now?",
      },
      { id: "dm.deployer.changes", channel: "dm:deployer", trigger: { kind: "action", actionId: "ask.deployer.changes" }, author: "deployer", text: "nothing from me today. The last thing I shipped is four or five days old and it has been fine." },
      { id: "dm.infra.dep", channel: "dm:infra", trigger: { kind: "action", actionId: "ask.infra.dep" }, author: "infra", text: `${dep} is green: all health checks pass and the ${v.store.label} blip is over. I would look at the callers, but I would not touch ${dep} itself.` },
      { id: "dm.support.impact", channel: "dm:support", trigger: { kind: "action", actionId: "ask.support.impact" }, author: "support", text: "it broke, came back for a minute, then broke again. Customers say the page just hangs until it times out." },
      { id: "dm.secondary.ask", channel: "dm:secondary", trigger: { kind: "action", actionId: "global.ask_secondary" }, author: "secondary", text: `${dep} says it is healthy. Then why is everything still timing out?` },
    ],
    requests: storefrontRequests({ method: "POST", path: v.symptom.path, failMs: [2400, 3000], okMs: [180, 420] }),
  };
}
