import type { ScenarioDef, State, TimelineEntry } from "@pitwall/engine";
import { slowLeakDesktop } from "./slow-leak.desktop";

export type Author = "deployer" | "secondary" | "infra" | "support" | "bot";

export type MessageTrigger =
  | { kind: "prepage" }
  | { kind: "page" }
  | { kind: "alert"; alertId: string }
  | { kind: "action"; actionId: string };

interface MessageBase {
  id: string;
  /** A channel name from `channels`, or "dm:<role>" for a direct message. */
  channel: string;
  trigger: MessageTrigger;
  /** Shown as "53 min ago" for messages that predate the page. */
  minutesAgo?: number;
}

/** A message is either a cold-open hotspot (author and text come from it) or plain chat. */
export type ChatMessage = MessageBase & ({ hotspotId: string } | { author: Author; text: string });

export interface RequestPattern {
  method: "GET" | "POST";
  /** `{id}` is replaced with a random product id. */
  path: string;
  weight: number;
  okStatus: number;
  failsWithSymptom: boolean;
  okMs: readonly [number, number];
  failMs: readonly [number, number];
}

export interface DesktopContent {
  server: "nginx" | "framework" | "cdn";
  channels: readonly string[];
  chat: readonly ChatMessage[];
  requests: readonly RequestPattern[];
}

const DESKTOP: Record<string, DesktopContent> = { "db-pool-exhaustion": slowLeakDesktop };

export function desktopFor(scenarioId: string): DesktopContent {
  const content = DESKTOP[scenarioId];
  if (!content) throw new Error(`no desktop content for scenario ${scenarioId}`);
  return content;
}

/** "http_502" → 502. */
export function symptomCode(scenario: ScenarioDef<State>): number {
  const code = Number(scenario.coldOpen.symptom.kind.replace(/^http_/, ""));
  if (!Number.isInteger(code)) throw new Error(`${scenario.id}: symptom ${scenario.coldOpen.symptom.kind} is not http_<code>`);
  return code;
}

export function visibleMessages(content: DesktopContent, view: { paged: boolean; timeline: readonly TimelineEntry[] }): ChatMessage[] {
  const fired = new Set<string>();
  const done = new Set<string>();
  for (const e of view.timeline) {
    if (e.kind === "alert_fired") fired.add(e.alertId);
    if (e.kind === "action_done") done.add(e.actionId);
  }
  return content.chat.filter((m) => {
    switch (m.trigger.kind) {
      case "prepage":
        return true;
      case "page":
        return view.paged;
      case "alert":
        return view.paged && fired.has(m.trigger.alertId);
      case "action":
        return done.has(m.trigger.actionId);
    }
  });
}

export function messageAuthor(msg: ChatMessage, scenario: ScenarioDef<State>): Author {
  if ("hotspotId" in msg) return scenario.coldOpen.hotspots[msg.hotspotId]?.author ?? "bot";
  return msg.author;
}

export function messageText(msg: ChatMessage, scenario: ScenarioDef<State>): string {
  if ("hotspotId" in msg) return scenario.coldOpen.hotspots[msg.hotspotId]?.text ?? "";
  return msg.text;
}
