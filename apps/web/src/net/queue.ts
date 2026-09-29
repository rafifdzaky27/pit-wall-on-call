import type { RunPost } from "./client";

/**
 * Finished shifts waiting to be posted, kept across reloads (M3 spec Y10). A run goes in before its
 * first post and comes out once the server has it or refuses it for good; its `runKey` makes a resend
 * safe. Storage can be off: then the queue is simply empty.
 */
const KEY = "pitwall.pending";

export function pending(): RunPost[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? (list as RunPost[]).filter((r) => typeof r?.runKey === "string") : [];
  } catch {
    return [];
  }
}

function save(list: RunPost[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // Storage off or full: the run is only posted from this page.
  }
}

export function enqueue(run: RunPost): void {
  const list = pending();
  if (!list.some((r) => r.runKey === run.runKey)) save([...list, run]);
}

export function drop(runKey: string): void {
  save(pending().filter((r) => r.runKey !== runKey));
}

/** Runs being sent from this page right now, so two senders never post one twice at once. */
const inFlight = new Set<string>();

/** Claims a run for sending; false if it is already on its way. */
export function claim(runKey: string): boolean {
  if (inFlight.has(runKey)) return false;
  inFlight.add(runKey);
  return true;
}

export function release(runKey: string): void {
  inFlight.delete(runKey);
}
