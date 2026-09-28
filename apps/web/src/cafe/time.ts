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

/**
 * The café's clocks (the wall clock and the phone): the city's own minutes, in the hour the scene is
 * painted in, so a sunny afternoon never reads 01:00. The minutes still tick with the city's time.
 */
export function sceneTime(now: Date, timeZone: string, time: TimeOfDay): string {
  const minutes = cityTime(now, timeZone).slice(3);
  return `${String(HOUR[time]).padStart(2, "0")}:${minutes}`;
}

/** "Monday 28 September" in a city's time zone, for the lock screen. */
export function cityDate(now: Date, timeZone: string): string {
  return formatter("date", timeZone).format(now).replace(",", "");
}
