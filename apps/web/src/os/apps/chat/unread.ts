import { visibleMessages, type Author } from "@pitwall/scenarios";
import type { World } from "@pitwall/world";
import type { IncidentApi, IncidentPhase } from "../../incident/IncidentProvider";

export function isPaged(phase: IncidentPhase): boolean {
  return phase === "paging" || phase === "active" || phase === "ended";
}

export function visibleFor(incident: IncidentApi) {
  return visibleMessages(incident.content, { paged: isPaged(incident.phase), timeline: incident.timeline });
}

export function unreadCount(incident: IncidentApi, read: ReadonlySet<string>): number {
  return visibleFor(incident).filter((m) => !read.has(m.id)).length;
}

export function isBot(author: Author): boolean {
  return author === "bot" || author === "deploybot";
}

export function authorName(author: Author, world: World): string {
  if (author === "bot") return "PitBot";
  if (author === "deploybot") return "Deploy Bot";
  return world.colleagues[author];
}

export function channelLabel(channel: string, world: World): string {
  if (channel.startsWith("dm:")) return authorName(channel.slice(3) as Author, world);
  return `# ${channel}`;
}

/** Unread DMs and #incidents get a count badge, as mentions do in Slack; other channels only turn bold. */
export function isMention(channel: string): boolean {
  return channel.startsWith("dm:") || channel === "incidents";
}
