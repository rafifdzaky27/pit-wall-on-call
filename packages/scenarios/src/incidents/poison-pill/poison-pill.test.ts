import { ACK, pickLesson, replay, Run, type ActionRecord } from "@pitwall/engine";
import { describe, expect, it } from "vitest";
import { poisonPillIncident } from "./index";

const at = (tick: number, actionId: string): ActionRecord => ({ tick, actionId });

describe.each(poisonPillIncident.variants.map((v) => [v.scenario.id, v] as const))("%s: golden players", (_id, v) => {
  const s = v.scenario;

  it("the perfect player wins under par; the DLQ move is the only fix", () => {
    const r = replay(s, 1, v.golden.perfect);
    expect(r.outcome).toBe("resolved");
    expect(r.rootCauseFound).toBe(true);
    expect(r.budgetBurnedBp).toBeLessThanOrEqual(s.parBp);
    expect(s.rootCauseActionIds).toEqual(["queue.dlq_move"]);
  });

  it("restarting the consumers masks the loop, which then returns", () => {
    const r = replay(s, 1, v.golden.masking);
    expect(r.outcome).toBe("resolved");
    expect(r.burnByTag.mitigated_unfixed).toBeGreaterThan(0);
    expect(pickLesson(s, r).id).toBe("restart-trap");
  });

  it("purging the queue burns side effects and gets its lesson", () => {
    const r = replay(s, 1, [at(20, ACK), at(20, "queue.purge"), at(3000, "consumer.crash_query"), at(3050, "queue.dlq_move")]);
    expect(r.burnByTag["side_effect:queue.purge"]).toBeGreaterThan(0);
    expect(pickLesson(s, r).id).toBe("purge-trap");
  });

  it("the crash log names the message", () => {
    const run = new Run(s, 1);
    run.dispatch(ACK);
    run.dispatch("consumer.crash_query");
    for (let i = 0; i < 60; i++) run.step();
    expect(run.logs.some((l) => l.finding && l.text.includes("never acknowledged"))).toBe(true);
  });

  it("do nothing: dnf lesson", () => {
    expect(pickLesson(s, replay(s, 1, [])).id).toBe("dnf");
  });
});
