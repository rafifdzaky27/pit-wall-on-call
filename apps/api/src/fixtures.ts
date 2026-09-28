import { ACK, ENGINE_VERSION, inspectAction, type ActionRecord } from "@pitwall/engine";
import { slowLeak } from "@pitwall/scenarios";

const at = (tick: number, actionId: string): ActionRecord => ({ tick, actionId });

/** The golden perfect player (packages/scenarios/src/golden.test.ts) on seed 1. */
export const PERFECT_ACTIONS: ActionRecord[] = [
  at(0, inspectAction("laptop.slack.deploys")),
  at(20, ACK),
  at(20, "checkout.pool_stats"),
  at(60, "checkout.deploys"),
  at(90, "checkout.rollback"),
];

/** What the server's replay must score it. The deploy smoke test checks this literal (M2 spec §7). */
export const PERFECT_EXPECTED = { outcome: "resolved", budgetBurnedBp: 253, mitigatedAtTick: 389, endTick: 489 } as const;

export function perfectRun(overrides: Record<string, unknown> = {}) {
  return {
    scenarioId: slowLeak.id,
    seed: 1,
    mode: "practice",
    engineVersion: ENGINE_VERSION,
    runKey: crypto.randomUUID(),
    actions: PERFECT_ACTIONS,
    ...overrides,
  };
}
