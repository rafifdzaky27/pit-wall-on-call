import { LONG, SHORT } from "./profanity";

export const HANDLE_RE = /^[A-Za-z0-9_-]{3,20}$/;

export type HandleCheck = { ok: true; handle: string } | { ok: false; code: "schema" | "handle_rejected" };

const SWAPS: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t" };

function normalise(handle: string): string {
  return handle
    .toLowerCase()
    .replace(/[-_]/g, "")
    .replace(/[013457]/g, (d) => SWAPS[d]!);
}

/** Handle rules (M2 spec §3): trimmed, 3–20 of [A-Za-z0-9_-], not on the profanity list. */
export function checkHandle(raw: string): HandleCheck {
  const handle = raw.trim();
  if (!HANDLE_RE.test(handle)) return { ok: false, code: "schema" };
  const n = normalise(handle);
  if (LONG.some((w) => n.includes(w)) || SHORT.includes(n)) return { ok: false, code: "handle_rejected" };
  return { ok: true, handle };
}
