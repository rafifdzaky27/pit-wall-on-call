import { mulberry32, streamSeed } from "@pitwall/engine";
import type { DesktopContent, RequestPattern } from "@pitwall/scenarios";

export type NetType = RequestPattern["type"];
export type NetFilter = "all" | NetType;

export interface NetRow {
  id: number;
  tick: number;
  method: "GET" | "POST";
  path: string;
  status: number;
  ms: number;
  bytes: number;
  type: NetType;
  initiator: string;
}

export const ROW_EVERY_TICKS = 5;
const MS_PER_TICK = 100;

/** One simulated request for a tick. Presentation only, from the web app's own seeded stream. */
export function rowForTick(content: DesktopContent, symptom: number, seed: number, tick: number, errorRateBp: number): NetRow {
  const rng = mulberry32(streamSeed(seed, `network:${tick}`));
  const total = content.requests.reduce((sum, r) => sum + r.weight, 0);
  let pick = rng.int(total);
  let pattern = content.requests[0]!;
  for (const r of content.requests) {
    if (pick < r.weight) {
      pattern = r;
      break;
    }
    pick -= r.weight;
  }
  const failed = pattern.failsWithSymptom && rng.int(10_000) < errorRateBp;
  const [lo, hi] = failed ? pattern.failMs : pattern.okMs;
  const status = failed ? symptom : pattern.okStatus;
  const size = pattern.type === "img" ? 18_000 + rng.int(42_000) : 1200 + rng.int(38_000);
  return {
    id: tick,
    tick,
    method: pattern.method,
    path: pattern.path.replace("{id}", String(1000 + rng.int(9000))),
    status,
    ms: lo + rng.int(hi - lo + 1),
    bytes: status === 304 ? 0 : failed ? 157 + rng.int(40) : size,
    type: pattern.type,
    initiator: pattern.initiator,
  };
}

export function matchesFilter(row: NetRow, filter: NetFilter, text: string): boolean {
  return (filter === "all" || row.type === filter) && (text === "" || row.path.includes(text));
}

/** DevTools' footer: request count, bytes transferred, and when the last request finished. */
export function summarize(rows: readonly NetRow[]): { count: number; bytes: number; finishMs: number } {
  if (rows.length === 0) return { count: 0, bytes: 0, finishMs: 0 };
  const start = Math.min(...rows.map((r) => r.tick * MS_PER_TICK));
  const end = Math.max(...rows.map((r) => r.tick * MS_PER_TICK + r.ms));
  return { count: rows.length, bytes: rows.reduce((s, r) => s + r.bytes, 0), finishMs: end - start };
}
