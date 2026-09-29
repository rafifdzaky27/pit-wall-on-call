import type { TimeOfDay } from "@pitwall/world";

// Building an Intl formatter is slow and the café renders on every tick, so each is made once per zone.
const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(kind: "time" | "date", timeZone: string): Intl.DateTimeFormat {
  const key = `${kind}:${timeZone}`;
  let f = formatters.get(key);
  if (!f) {
    f =
      kind === "time"
        ? new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone })
        : new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone });
    formatters.set(key, f);
  }
  return f;
}

/** hh:mm (24-hour) in a city's own time zone. */
export function cityTime(now: Date, timeZone: string): string {
  return formatter("time", timeZone).format(now);
}

const HOUR: Record<TimeOfDay, number> = { morning: 9, afternoon: 15, dusk: 18, night: 22 };

/** When this page loaded: the café's clocks count from here. */
const PAGE_LOADED = Date.now();
const MINUTE = 60_000;
const DAY_MIN = 24 * 60;

/**
 * The café's clocks (the wall clock and the phone). They start at the city's own minutes, in the
 * hour the scene is painted in, so a sunny afternoon never reads 01:00, and then only ever move
 * forward: the hour rolls over rather than jumping back (M2.5 PR C review 1).
 */
export function sceneTime(now: Date, timeZone: string, time: TimeOfDay, anchor: number = PAGE_LOADED): string {
  const startMin = Number(cityTime(new Date(anchor), timeZone).slice(3));
  // Time zones are whole minutes from UTC, so UTC minute boundaries are the city's too.
  const elapsed = Math.floor(now.getTime() / MINUTE) - Math.floor(anchor / MINUTE);
  const total = (((HOUR[time] * 60 + startMin + elapsed) % DAY_MIN) + DAY_MIN) % DAY_MIN;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** "Monday 28 September" in a city's time zone, for the lock screen. */
export function cityDate(now: Date, timeZone: string): string {
  return formatter("date", timeZone).format(now).replace(",", "");
}
