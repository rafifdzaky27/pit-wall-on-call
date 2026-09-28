const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
/** Slack collapses a message under the previous one from the same author within five minutes. */
export const GROUP_MS = 5 * MINUTE;

export interface Timed {
  id: string;
  author: string;
  at: number;
}

export function sameDay(a: number, b: number): boolean {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

/** Ids of messages that start a group and so show an avatar and a name. */
export function groupHeads(items: readonly Timed[]): Set<string> {
  const heads = new Set<string>();
  let prev: Timed | null = null;
  for (const m of items) {
    if (!prev || prev.author !== m.author || m.at - prev.at > GROUP_MS || !sameDay(prev.at, m.at)) heads.add(m.id);
    prev = m;
  }
  return heads;
}

export function dayLabel(at: number, now: number): string {
  if (sameDay(at, now)) return "Today";
  if (sameDay(at, now - DAY)) return "Yesterday";
  return new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" }).format(at);
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0]!)
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/** 1–8, stable per name: picks one of the --avatar-* tokens. */
export function avatarIndex(name: string): number {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return (h % 8) + 1;
}

export function relative(at: number, now: number): string {
  const ms = Math.max(0, now - at);
  if (ms < MINUTE) return "just now";
  if (ms < 60 * MINUTE) return `${Math.floor(ms / MINUTE)} min ago`;
  if (ms < DAY) return `${Math.floor(ms / (60 * MINUTE))} h ago`;
  return `${Math.floor(ms / DAY)} d ago`;
}
