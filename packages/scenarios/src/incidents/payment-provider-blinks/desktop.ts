import type { ChatMessage, DesktopContent } from "../../desktop";
import { CHANNELS, CHANNEL_INFO, storefrontRequests } from "../_dependencies/shared";
import type { BlinksVariant } from "./scenario";

/**
 * Background messages make the workspace look lived-in. The clues stay in the hotspot messages, the phone
 * mention and the teammates' replies; nothing here names the fix.
 */
export function blinksDesktop(v: BlinksVariant): DesktopContent {
  const deployHerring = v.herring === "deploy";
  const card = v.method === "card";

  const v207 = (minutesAgo: number): ChatMessage => ({
    id: "deploys.v207",
    channel: "deploys",
    trigger: { kind: "prepage" },
    minutesAgo,
    author: "deploybot",
    text: "checkout-api v207 deployed to production",
    card: { service: "checkout-api", version: "v207", sha: "7a3d9e1", by: "deployer", env: "production", changes: "Receipts email template (#2107)", status: "succeeded" },
  });

  const herringChat: ChatMessage[] = deployHerring
    ? [
        { id: "deploys.dimas", channel: "deploys", trigger: { kind: "prepage" }, minutesAgo: 61, hotspotId: "laptop.slack.deploys", reactions: [{ emoji: "🚀", by: ["secondary"] }] },
        v207(60),
        { id: "infra.quiet", channel: "infra", trigger: { kind: "prepage" }, minutesAgo: 140, author: "infra", text: "quiet on the infra side today, nothing scheduled" },
      ]
    : [
        v207(540),
        { id: "infra.reporting", channel: "infra", trigger: { kind: "prepage" }, minutesAgo: 70, hotspotId: "laptop.slack.infra", reactions: [{ emoji: "👀", by: ["secondary"] }] },
      ];

  return {
    server: "nginx",
    channels: CHANNELS,
    channelInfo: CHANNEL_INFO,
    chat: [
      { id: "incidents.sev3", channel: "incidents", trigger: { kind: "prepage" }, minutesAgo: 2900, author: "bot", text: "SEV3 resolved: image CDN cache misses above 30%. Duration 22 min. Postmortem PM-231." },
      {
        id: "incidents.pm231",
        channel: "incidents",
        trigger: { kind: "prepage" },
        minutesAgo: 2700,
        author: "secondary",
        text: "PM-231 is up for review. A purge script ran against the wrong bucket, nobody hurt.",
        reactions: [{ emoji: "👀", by: ["infra", "support"] }],
        thread: [
          { author: "infra", text: "added a note about the bucket naming", minutesAgo: 2600 },
          { author: "secondary", text: "thanks, merged", minutesAgo: 2550 },
        ],
      },
      {
        id: "deploys.v206",
        channel: "deploys",
        trigger: { kind: "prepage" },
        minutesAgo: 9200,
        author: "deploybot",
        text: "checkout-api v206 deployed to production",
        card: { service: "checkout-api", version: "v206", sha: "b18c440", by: "secondary", env: "production", changes: "Bump the HTTP client to 5.3", status: "succeeded" },
      },
      {
        id: "deploys.catalog",
        channel: "deploys",
        trigger: { kind: "prepage" },
        minutesAgo: 1500,
        author: "deploybot",
        text: "catalog-api v77 deployed to production",
        card: { service: "catalog-api", version: "v77", sha: "e902ad3", by: "infra", env: "production", changes: "Faster product image resizing", status: "succeeded" },
      },
      ...herringChat,
      { id: "infra.certs", channel: "infra", trigger: { kind: "prepage" }, minutesAgo: 200, author: "infra", text: "rotated the certs for *.{domain}, next expiry in 60 days" },
      { id: "support.queue", channel: "support", trigger: { kind: "prepage" }, minutesAgo: 30, author: "support", text: "queue is quiet, two refund requests and one password reset" },
      { id: "dm.support.refund", channel: "dm:support", trigger: { kind: "prepage" }, minutesAgo: 25, author: "support", text: "hey, are you on call today? a customer asked about an invoice, not urgent" },
      { id: "incidents.opened", channel: "incidents", trigger: { kind: "page" }, author: "bot", text: "SEV2 opened: Checkout failing at the payment step. Primary: you. Secondary: {secondary}." },
      { id: "support.tickets", channel: "support", trigger: { kind: "alert", alertId: "checkout_5xx" }, author: "support", text: `Tickets are piling up: people can add to cart but ${card ? "paying by card" : "paying by e-wallet"} fails.` },
      {
        id: "dm.secondary.mitigated",
        channel: "dm:secondary",
        trigger: { kind: "status", status: "mitigated", afterTicks: 200 },
        author: "secondary",
        text: "Errors are gone, but is checkout actually healthy? Did the wait itself go away, or did we only empty the queue?",
      },
      {
        id: "dm.deployer.changes",
        channel: "dm:deployer",
        trigger: { kind: "action", actionId: "ask.deployer.changes" },
        author: "deployer",
        text: deployHerring ? "v207 went out about an hour ago: the receipts email template, nothing near the payment call. Why, is it acting up?" : "only v207 today, the receipts email template. That was this morning and it has been quiet since.",
      },
      {
        id: "dm.infra.db",
        channel: "dm:infra",
        trigger: { kind: "action", actionId: "ask.infra.db" },
        author: "infra",
        text: v.herring === "db" ? "the reporting job is hammering the primary again. Kill it and checkout will recover, I would bet on it." : "postgres is fine: CPU 22%, connections 31 of 120. I would look at what checkout calls out to.",
      },
      {
        id: "dm.support.impact",
        channel: "dm:support",
        trigger: { kind: "action", actionId: "ask.support.impact" },
        author: "support",
        text: card ? "the page loads fine and the pay button spins, then a timeout. Card only; nobody has mentioned e-wallet problems." : "only people paying by e-wallet. Card and bank transfer both go through, so about a fifth of our orders.",
      },
      { id: "dm.secondary.ask", channel: "dm:secondary", trigger: { kind: "action", actionId: "global.ask_secondary" }, author: "secondary", text: "only the payment step is failing. What does checkout do when the provider is slow?" },
    ],
    requests: storefrontRequests({ method: "POST", path: v.symptom.path, failMs: [8000, 8100], okMs: [180, 420] }),
  };
}
