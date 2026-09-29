import { ACK, pickLesson, replay, Run, type ActionRecord } from "@pitwall/engine";
import { describe, expect, it } from "vitest";
import { poisonPillIncident } from "./index";

const at = (tick: number, actionId: string): ActionRecord => ({ tick, actionId });

describe.each(poisonPillIncident.variants.map((v) => [v.scenario.id, v] as const))("%s: golden players", (_id, v) => {
  const s = v.scenario;
  const partitioned = s.id.endsWith(":inventory");
  const fix = partitioned ? "queue.skip_offset" : "queue.dlq_move";
  const trap = partitioned ? "queue.reset_group" : "queue.purge";
  const find = partitioned ? [at(3000, "queue.describe"), at(3050, "queue.read_record")] : [at(3000, "consumer.crash_query")];
  const finish = [...find, at(3100, fix)];

  it("the perfect player wins under par; the one-message fix is the only fix", () => {
    const r = replay(s, 1, v.golden.perfect);
    expect(r.outcome).toBe("resolved");
    expect(r.rootCauseFound).toBe(true);
    expect(r.budgetBurnedBp).toBeLessThanOrEqual(s.parBp);
    expect(s.rootCauseActionIds).toEqual([fix]);
  });

  it("restarting the consumers masks the loop, which then returns", () => {
    const r = replay(s, 1, v.golden.masking);
    expect(r.outcome).toBe("resolved");
    expect(r.burnByTag.mitigated_unfixed).toBeGreaterThan(0);
    expect(pickLesson(s, r).id).toBe("restart-trap");
  });

  it("wiping the queue or the group burns side effects and gets its lesson", () => {
    const r = replay(s, 1, [at(20, ACK), at(20, trap), ...finish]);
    expect(r.burnByTag[`side_effect:${trap}`]).toBeGreaterThan(0);
    expect(pickLesson(s, r).id).toBe("purge-trap");
  });

  it("the fix waits for its target", () => {
    const run = new Run(s, 1);
    run.dispatch(ACK);
    expect(run.check(fix)).toBe("unavailable");
  });

  it("do nothing: dnf lesson", () => {
    expect(pickLesson(s, replay(s, 1, [])).id).toBe("dnf");
  });
});

describe("the two variants are different puzzles", () => {
  const [queue, kafka] = poisonPillIncident.variants.map((v) => v.scenario);

  it("the crash log names the message on RabbitMQ, and not on Kafka", () => {
    const logAfter = (s: NonNullable<typeof queue>) => {
      const run = new Run(s, 1);
      run.dispatch(ACK);
      run.dispatch("consumer.crash_query");
      for (let i = 0; i < 60; i++) run.step();
      return run;
    };
    expect(logAfter(queue!).logs.some((l) => l.finding && l.text.includes("never acknowledged"))).toBe(true);
    // On Kafka the log is a dead end: the fix stays unavailable after reading it.
    expect(logAfter(kafka!).check("queue.skip_offset")).toBe("unavailable");
  });

  it("on Kafka the record can be read only once the group has been described, and the skip only once it has been read", () => {
    const run = new Run(kafka!, 1);
    run.dispatch(ACK);
    expect(run.check("queue.read_record")).toBe("unavailable");
    run.dispatch("queue.describe");
    for (let i = 0; i < 60; i++) run.step();
    expect(run.check("queue.read_record")).not.toBe("unavailable");
    expect(run.check("queue.skip_offset")).toBe("unavailable");
    run.dispatch("queue.read_record");
    for (let i = 0; i < 60; i++) run.step();
    expect(run.check("queue.skip_offset")).not.toBe("unavailable");
  });
});
