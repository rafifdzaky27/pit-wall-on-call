import type { ScenarioDef, State } from "@pitwall/engine";
import { slowLeak } from "./slow-leak";

/** Daily #1 (M3 spec Y2). */
export const DAILY_EPOCH = "2026-09-29";

const DAY_MS = 86_400_000;

/** The daily incident for a UTC date: the same scenario and seed for everyone (M3 spec Y1). */
export interface Daily {
  date: string;
  number: number;
  scenarioId: string;
  seed: number;
}

/** The scenarios a daily can be. Training never is; M4's scenarios join here. */
const PLAYABLE: readonly ScenarioDef<State>[] = [slowLeak];

/** The UTC date (YYYY-MM-DD) of an instant: the daily rolls over at 00:00 UTC. */
export function utcDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** A real calendar date in YYYY-MM-DD form. */
export function isDailyDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const ms = Date.parse(`${s}T00:00:00Z`);
  return Number.isFinite(ms) && utcDate(ms) === s;
}

const dayIndex = (date: string) => Math.round(Date.parse(`${date}T00:00:00Z`) / DAY_MS);

export function dailyNumber(date: string): number {
  return dayIndex(date) - dayIndex(DAILY_EPOCH) + 1;
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
