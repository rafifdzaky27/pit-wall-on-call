/**
 * Funnel analytics (M5 spec L5-3, L5-4). Umami runs on our own origin under /stats; the script loads only
 * when a website id was built in and the browser does not ask not to be tracked. Without it, `track` does
 * nothing. Events carry no player identifiers and no free text: names and props are closed sets.
 */

export type ShiftMode = "daily" | "practice" | "training";

/** Each event and the only props it may carry. */
export interface AnalyticsEvents {
  shift_start: { incident: string; mode: ShiftMode };
  ack: undefined;
  shift_finish: { result: "resolved" | "dnf"; incident: string; mode: ShiftMode };
  share_click: undefined;
  hint_shown: undefined;
}

export type AnalyticsEvent = keyof AnalyticsEvents;

interface UmamiGlobal {
  track?: (name: string, props?: Record<string, string>) => void;
}

const SCRIPT_SRC = "/stats/script.js";

/** Call once from the app entry. */
export function initAnalytics(): void {
  const websiteId = import.meta.env.VITE_UMAMI_WEBSITE_ID;
  if (typeof websiteId !== "string" || websiteId === "") return;
  if (navigator.doNotTrack === "1") return;
  if (document.querySelector(`script[src="${SCRIPT_SRC}"]`)) return;
  const script = document.createElement("script");
  script.defer = true;
  script.src = SCRIPT_SRC;
  script.dataset.websiteId = websiteId;
  script.dataset.autoTrack = "true";
  // Caddy strips /stats before Umami (its prebuilt image has no base path), so the collect
  // endpoint must be /stats/api/send, never our own /api/*.
  script.dataset.hostUrl = "/stats";
  document.head.appendChild(script);
}

/** Pick only the keys an event may carry, so nothing else can leak into a payload. */
const KEYS: { [E in AnalyticsEvent]: readonly string[] } = {
  shift_start: ["incident", "mode"],
  ack: [],
  shift_finish: ["result", "incident", "mode"],
  share_click: [],
  hint_shown: [],
};

/** Safe anywhere: a no-op when analytics is off, never throws, never queues. */
export function track<E extends AnalyticsEvent>(event: E, ...[props]: AnalyticsEvents[E] extends undefined ? [] : [AnalyticsEvents[E]]): void {
  try {
    const umami = (window as { umami?: UmamiGlobal }).umami;
    if (!umami?.track) return;
    const source = props as Record<string, string> | undefined;
    const keys = KEYS[event];
    const clean = source && keys.length > 0 ? Object.fromEntries(keys.filter((k) => k in source).map((k) => [k, source[k]!])) : undefined;
    umami.track(event, clean);
  } catch {
    // Analytics must never break the game.
  }
}
