import type { ScenarioDef, State } from "@pitwall/engine";
import { slowLeak } from "./slow-leak";

/** Daily #1 (M3 spec Y2). */
export const DAILY_EPOCH = "2026-09-29";

export const DAY_MS = 86_400_000;

/** The daily incident for a UTC date: the same scenario and seed for everyone (M3 spec Y1). */
export interface Daily {
  date: string;
  number: number;
  scenarioId: string;
  seed: number;
}

/** The scenarios a daily can be. Training never is; M4's scenarios join here. */
const PLAYABLE: readonly ScenarioDef<State>[] = [slowLeak];

// Calendar arithmetic without the wall clock (content stays deterministic, spec §5): days since
// 1970-01-01 to and from a proleptic Gregorian date (H. Hinnant's algorithms).
function daysFromCivil(y: number, m: number, d: number): number {
  const yy = m <= 2 ? y - 1 : y;
  const era = Math.floor(yy / 400);
  const yoe = yy - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

function civilFromDays(days: number): [number, number, number] {
  const z = days + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp < 10 ? mp + 3 : mp - 9;
  return [yoe + era * 400 + (m <= 2 ? 1 : 0), m, d];
}

const pad = (n: number, w = 2) => String(n).padStart(w, "0");

const parse = (s: string): [number, number, number] | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
};

/** Days since 1970-01-01 of a YYYY-MM-DD date. */
export function dayOf(date: string): number {
  const p = parse(date);
  if (!p) throw new Error(`not a date: ${date}`);
  return daysFromCivil(...p);
}

/** The UTC date (YYYY-MM-DD) of an instant: the daily rolls over at 00:00 UTC. */
export function utcDate(ms: number): string {
  const [y, m, d] = civilFromDays(Math.floor(ms / DAY_MS));
  return `${pad(y, 4)}-${pad(m)}-${pad(d)}`;
}

/** 00:00 UTC of a date, in epoch milliseconds. */
export function dayStartMs(date: string): number {
  return dayOf(date) * DAY_MS;
}

/** A real calendar date in YYYY-MM-DD form. */
export function isDailyDate(s: string): boolean {
  const p = parse(s);
  return !!p && p[1] >= 1 && p[1] <= 12 && p[2] >= 1 && utcDate(dayStartMs(s)) === s;
}

export function dailyNumber(date: string): number {
  return dayOf(date) - dayOf(DAILY_EPOCH) + 1;
}

/** FNV-1a, 32-bit: a stable hash of the date, the same in every browser and on the server. */
function fnv1a(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function dailyFor(date: string): Daily {
  const seed = fnv1a(`pitwall:daily:${date}`);
  const scenario = PLAYABLE[fnv1a(`pitwall:daily-scenario:${date}`) % PLAYABLE.length]!;
  return { date, number: dailyNumber(date), scenarioId: scenario.id, seed };
}
