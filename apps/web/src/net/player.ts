import { useSyncExternalStore } from "react";

/** The leaderboard identity on this device (M2 spec §6). */
export interface StoredPlayer {
  playerId: string;
  handle: string;
  tag: string;
  token: string;
}

const KEY = "pitwall.player";
/** The same rule the API applies after trimming (M2 spec §3). */
export const HANDLE_RE = /^[A-Za-z0-9_-]{3,20}$/;

const listeners = new Set<() => void>();
/** Used only when storage is unavailable, so the player still works for this page load. */
let memory: StoredPlayer | null = null;
let lastRaw: string | null | undefined;
let lastParsed: StoredPlayer | null = null;

function parse(raw: string | null): StoredPlayer | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as Partial<StoredPlayer>;
    if ([p.playerId, p.handle, p.tag, p.token].every((v) => typeof v === "string")) return p as StoredPlayer;
  } catch {
    // Corrupt: behave as a device without a player.
  }
  return null;
}

/** The same object while the stored value is unchanged, as useSyncExternalStore requires. */
export function loadPlayer(): StoredPlayer | null {
  let raw: string | null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return memory;
  }
  if (raw !== lastRaw) {
    lastRaw = raw;
    lastParsed = parse(raw);
  }
  return lastParsed;
}

function write(p: StoredPlayer | null): void {
  memory = p;
  try {
    if (p) localStorage.setItem(KEY, JSON.stringify(p));
    else localStorage.removeItem(KEY);
  } catch {
    // Kept in memory above.
  }
  for (const l of listeners) l();
}

export const savePlayer = (p: StoredPlayer) => write(p);
export const forgetPlayer = () => write(null);

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Another tab changing the player updates this one too.
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export function usePlayer(): StoredPlayer | null {
  return useSyncExternalStore(subscribe, loadPlayer, () => null);
}
