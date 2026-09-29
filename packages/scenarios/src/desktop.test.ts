import { ACK, replay, Run, type State } from "@pitwall/engine";
import { describe, expect, it } from "vitest";
import { messageAuthor, messageText, symptomCode, typingFor, visibleMessages } from "./desktop";
import { desktopFor } from "./registry";
import { SCENARIOS, slowLeak } from "./index";

describe.each(SCENARIOS.map((s) => [s.id, s] as const))("%s desktop content", (_id, scenario) => {
  const content = desktopFor(scenario.id);

  it("links only to hotspots that exist and have an author", () => {
    for (const m of content.chat) {
      if ("hotspotId" in m) {
        const h = scenario.coldOpen.hotspots[m.hotspotId];
        expect(h, m.id).toBeDefined();
        expect(h!.author, m.id).toBeDefined();
      }
    }
  });

  it("puts laptop.slack.<channel> hotspots in that channel", () => {
    for (const m of content.chat) {
      if ("hotspotId" in m && m.hotspotId.startsWith("laptop.slack.")) {
        expect(m.channel).toBe(m.hotspotId.slice("laptop.slack.".length));
      }
    }
  });

  it("uses known channels, alerts and actions", () => {
    const alerts = new Set(scenario.alerts.map((a) => a.id));
    const actions = new Set(scenario.actions.map((a) => a.id));
    for (const m of content.chat) {
      expect(content.channels.includes(m.channel) || m.channel.startsWith("dm:"), m.id).toBe(true);
      if (m.trigger.kind === "alert") expect(alerts.has(m.trigger.alertId), m.id).toBe(true);
      if (m.trigger.kind === "action") expect(actions.has(m.trigger.actionId), m.id).toBe(true);
    }
  });

  it("has unique message ids and sane request patterns", () => {
    expect(new Set(content.chat.map((m) => m.id)).size).toBe(content.chat.length);
    expect(content.requests.some((r) => r.failsWithSymptom)).toBe(true);
    for (const r of content.requests) {
      expect(r.weight).toBeGreaterThan(0);
      expect(r.okMs[0]).toBeLessThanOrEqual(r.okMs[1]);
      expect(r.failMs[0]).toBeLessThanOrEqual(r.failMs[1]);
    }
  });

  it("describes every channel and keeps chat metadata consistent", () => {
    for (const ch of content.channels) expect(content.channelInfo[ch], ch).toMatchObject({ topic: expect.any(String) });
    for (const m of content.chat) {
      for (const r of m.reactions ?? []) {
        expect(r.emoji.length, m.id).toBeGreaterThan(0);
        expect(r.by.length, m.id).toBeGreaterThan(0);
      }
      for (const reply of m.thread ?? []) {
        if (m.minutesAgo !== undefined) expect(reply.minutesAgo, m.id).toBeLessThanOrEqual(m.minutesAgo);
      }
      if (m.card) expect(["deployer", "secondary", "infra", "support"], m.id).toContain(m.card.by);
    }
  });

  it("maps its symptom to a real HTTP error code", () => {
    expect([403, 429, 500, 502, 503, 504]).toContain(symptomCode(scenario));
  });
});

describe("visibleMessages", () => {
  const content = desktopFor(slowLeak.id);

  it("shows only pre-page messages before the page", () => {
    const run = new Run<State>(slowLeak, 1);
    const ids = visibleMessages(content, { paged: false, timeline: run.timeline }).map((m) => m.id);
    expect(ids).toContain("deploys.v142");
    expect(ids).not.toContain("incidents.opened");
  });

  it("adds page, alert and action messages as they happen", () => {
    const r = replay(slowLeak, 1, [
      { tick: 20, actionId: ACK },
      { tick: 20, actionId: "global.ask_secondary" },
      { tick: 120, actionId: "checkout.rollback" },
    ]);
    const ids = visibleMessages(content, { paged: true, timeline: r.timeline }).map((m) => m.id);
    expect(ids).toEqual(expect.arrayContaining(["incidents.opened", "incidents.support", "dm.secondary.deploy"]));
  });

  it("shows a status message only after its status has lasted long enough (M2.5 spec §7)", () => {
    const view = (since: number | null, tick: number) =>
      visibleMessages(content, { paged: true, timeline: [], statusSince: { mitigated: since }, tick }).map((m) => m.id);
    expect(view(null, 500)).not.toContain("dm.secondary.mitigated");
    expect(view(100, 299)).not.toContain("dm.secondary.mitigated");
    expect(view(100, 300)).toContain("dm.secondary.mitigated");
  });

  it("resolves hotspot-linked messages to the hotspot's author and text", () => {
    const msg = content.chat.find((m) => m.id === "deploys.dimas")!;
    expect(messageAuthor(msg, slowLeak)).toBe("deployer");
    expect(messageText(msg, slowLeak)).toBe(slowLeak.coldOpen.hotspots["laptop.slack.deploys"]!.text);
  });
});

describe("typingFor", () => {
  const content = desktopFor(slowLeak.id);

  it("shows who is typing while the action that sends their message runs", () => {
    expect(typingFor(content, ["global.ask_secondary"])).toEqual([{ channel: "dm:secondary", author: "secondary" }]);
    expect(typingFor(content, ["checkout.rollback"])).toEqual([]);
    expect(typingFor(content, [])).toEqual([]);
    // Several at once: the foreground action and any teammates still answering (M2.5 plan B1).
    expect(typingFor(content, ["checkout.rollback", "global.ask_secondary"])).toHaveLength(1);
  });
});

describe.each(SCENARIOS.map((s) => [s.id, s] as const))("%s: tools and teammates (M2.5 plan B4, Task 2)", (_id, scenario) => {
  const TOOLS = ["dashboards", "logs", "deploys", "db", "incident", "chat"];
  const content = desktopFor(scenario.id);

  it("gives every action a home tool", () => {
    for (const a of scenario.actions) expect(TOOLS, a.id).toContain(a.tool);
  });

  it("has teammates to ask, each question async, in chat, with exactly one reply in that teammate's DM", () => {
    const asks = scenario.actions.filter((a) => a.ask);
    expect(asks.length).toBeGreaterThanOrEqual(2);
    for (const a of asks) {
      expect(a.async, a.id).toBe(true);
      expect(a.tool, a.id).toBe("chat");
      const replies = content.chat.filter((m) => m.trigger.kind === "action" && m.trigger.actionId === a.id);
      expect(replies.map((m) => m.channel), a.id).toEqual([`dm:${a.ask!.to}`]);
    }
  });

  it("uses a distinct topic per teammate", () => {
    const keys = scenario.actions.filter((a) => a.ask).map((a) => `${a.ask!.to} ${a.ask!.topic}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
