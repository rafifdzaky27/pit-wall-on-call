import { mulberry32, streamSeed } from "@pitwall/engine";
import type { DesktopContent } from "@pitwall/scenarios";

export interface NetRow {
  id: number;
  tick: number;
  method: "GET" | "POST";
  path: string;
  status: number;
  ms: number;
  bytes: number;
}

export const ROW_EVERY_TICKS = 5;

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
  return {
    id: tick,
    tick,
    method: pattern.method,
    path: pattern.path.replace("{id}", String(1000 + rng.int(9000))),
    status,
    ms: lo + rng.int(hi - lo + 1),
    bytes: status === 304 ? 0 : failed ? 157 + rng.int(40) : 1200 + rng.int(38_000),
  };
}
