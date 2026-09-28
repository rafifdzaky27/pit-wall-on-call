import type { CityId } from "@pitwall/world";

export type Theme = "dark" | "light";
export type WallpaperChoice = "auto" | CityId;

export interface Prefs {
  theme: Theme;
  reduceMotion: boolean;
  largeText: boolean;
  systemCursor: boolean;
  singleKeyShortcuts: boolean;
  wallpaper: WallpaperChoice;
  sticky: string;
  /** 0–100 (polish spec §7). */
  volume: number;
  muted: boolean;
  /** Start shift requests full screen (polish spec S13). */
  fullscreenOnStart: boolean;
  /** Bus levels, 0–100 (cold-open spec §7). */
  ambience: number;
  music: number;
  alerts: number;
  /** Turns off budget pulses, the escalation tone and fix-hold ticks. */
  reduceAudio: boolean;
  /** The lo-fi radio was playing (cold-open spec C8). */
  radio: boolean;
}

export const DEFAULT_PREFS: Prefs = {
  theme: "dark",
  reduceMotion: false,
  largeText: false,
  systemCursor: false,
  singleKeyShortcuts: true,
  wallpaper: "auto",
  sticky: "Start here: open Monitoring from the dock.",
  volume: 70,
  muted: false,
  fullscreenOnStart: true,
  ambience: 60,
  music: 50,
  alerts: 100,
  reduceAudio: false,
  radio: false,
};

const KEY = "pitwall.prefs";
const LEGACY_THEME_KEY = "pitwall.theme";
const WALLPAPERS: readonly string[] = ["auto", "jakarta", "yogyakarta", "tokyo", "melbourne"];
const FLAGS = ["reduceMotion", "largeText", "systemCursor", "singleKeyShortcuts", "muted", "fullscreenOnStart", "reduceAudio", "radio"] as const;
const LEVELS = ["volume", "ambience", "music", "alerts"] as const;

function sanitize(raw: unknown): Prefs {
  const prefs = { ...DEFAULT_PREFS };
  if (typeof raw !== "object" || raw === null) return prefs;
  const r = raw as Record<string, unknown>;
  if (r.theme === "dark" || r.theme === "light") prefs.theme = r.theme;
  for (const flag of FLAGS) {
    const value = r[flag];
    if (typeof value === "boolean") prefs[flag] = value;
  }
  if (typeof r.wallpaper === "string" && WALLPAPERS.includes(r.wallpaper)) prefs.wallpaper = r.wallpaper as WallpaperChoice;
  if (typeof r.sticky === "string") prefs.sticky = r.sticky.slice(0, 2000);
  for (const level of LEVELS) {
    const value = r[level];
    if (typeof value === "number" && Number.isFinite(value)) prefs[level] = Math.round(Math.min(100, Math.max(0, value)));
  }
  return prefs;
}

export function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw !== null) return sanitize(JSON.parse(raw));
    return { ...DEFAULT_PREFS, theme: localStorage.getItem(LEGACY_THEME_KEY) === "light" ? "light" : "dark" };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function savePrefs(prefs: Prefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // Storage blocked: preferences last for this visit only.
  }
}

export function applyPrefs(prefs: Prefs, root: HTMLElement = document.documentElement): void {
  root.dataset.theme = prefs.theme;
  root.dataset.motion = prefs.reduceMotion ? "reduce" : "full";
  root.dataset.text = prefs.largeText ? "large" : "normal";
  root.dataset.cursor = prefs.systemCursor ? "system" : "pitos";
}
