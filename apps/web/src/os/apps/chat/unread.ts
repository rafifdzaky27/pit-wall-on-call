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

export function authorName(author: Author, world: World): string {
  return author === "bot" ? "pitbot" : world.colleagues[author];
}

export function channelLabel(channel: string, world: World): string {
  if (channel.startsWith("dm:")) return authorName(channel.slice(3) as Author, world);
  return `# ${channel}`;
}
