import type { IncidentStatus, ScenarioDef, State, TimelineEntry } from "@pitwall/engine";
import { slowLeakDesktop } from "./slow-leak.desktop";

export type Person = "deployer" | "secondary" | "infra" | "support";
export type Author = Person | "bot" | "deploybot";

export type MessageTrigger =
  | { kind: "prepage" }
  | { kind: "page" }
  | { kind: "alert"; alertId: string }
  | { kind: "action"; actionId: string }
  /** Once the incident has been in `status` for `afterTicks` (presentation only, M2.5 plan A2). */
  | { kind: "status"; status: IncidentStatus; afterTicks: number };

/** An emoji reaction. Emoji are in-world content here, never PitOS chrome (polish spec S19). */
export interface Reaction {
  emoji: string;
  by: Author[];
}

export interface ThreadReply {
  author: Author;
  text: string;
  minutesAgo: number;
}

/** The attachment Deploy Bot posts with each deploy. */
export interface DeployCard {
  service: string;
  version: string;
  sha: string;
  by: Person;
  env: string;
  changes: string;
  status: "succeeded" | "failed";
}

export interface ChannelInfo {
  topic: string;
  members: number;
  pinned: number;
}

interface MessageBase {
  id: string;
  /** A channel name from `channels`, or "dm:<role>" for a direct message. */
  channel: string;
  trigger: MessageTrigger;
  /** Minutes before the desktop session started, for messages that predate the page. */
  minutesAgo?: number;
  reactions?: Reaction[];
  thread?: ThreadReply[];
  card?: DeployCard;
  /** A code block shown under the text, for log or command output. */
  code?: string;
}

/** A message is either a cold-open hotspot (author and text come from it) or plain chat. */
export type ChatMessage = MessageBase & ({ hotspotId: string } | { author: Author; text: string });

export interface RequestPattern {
  method: "GET" | "POST";
  /** `{id}` is replaced with a random product id. */
  path: string;
  /** DevTools' resource type, for the Network panel's filter chips. */
  type: "document" | "fetch" | "script" | "stylesheet" | "img";
  /** DevTools' Initiator column. */
  initiator: string;
  weight: number;
  okStatus: number;
  failsWithSymptom: boolean;
  okMs: readonly [number, number];
  failMs: readonly [number, number];
}

export interface DesktopContent {
  server: "nginx" | "framework" | "cdn";
  channels: readonly string[];
  channelInfo: Record<string, ChannelInfo>;
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

export interface ChatView {
  paged: boolean;
  timeline: readonly TimelineEntry[];
  /** The tick each status began, while it lasts. */
  statusSince?: Partial<Record<IncidentStatus, number | null>>;
  tick?: number;
}

export function visibleMessages(content: DesktopContent, view: ChatView): ChatMessage[] {
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
      case "status": {
        const since = view.statusSince?.[m.trigger.status];
        return since != null && (view.tick ?? 0) - since >= m.trigger.afterTicks;
      }
    }
  });
}

/** Who is typing: the authors of messages the running action will produce (polish plan R6). */
export function typingFor(content: DesktopContent, busyActionId: string | null): { channel: string; author: Author }[] {
  if (!busyActionId) return [];
  return content.chat.flatMap((m) => (m.trigger.kind === "action" && m.trigger.actionId === busyActionId && "author" in m ? [{ channel: m.channel, author: m.author }] : []));
}

export function messageAuthor(msg: ChatMessage, scenario: ScenarioDef<State>): Author {
  if ("hotspotId" in msg) return scenario.coldOpen.hotspots[msg.hotspotId]?.author ?? "bot";
  return msg.author;
}

export function messageText(msg: ChatMessage, scenario: ScenarioDef<State>): string {
  if ("hotspotId" in msg) return scenario.coldOpen.hotspots[msg.hotspotId]?.text ?? "";
  return msg.text;
}
