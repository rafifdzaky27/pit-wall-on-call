import { ACK, pickLesson, replay, Run, type ActionRecord } from "@pitwall/engine";
import { describe, expect, it } from "vitest";
import { replicaLagIncident } from "./index";

const at = (tick: number, actionId: string): ActionRecord => ({ tick, actionId });

describe.each(replicaLagIncident.variants.map((v) => [v.scenario.id, v] as const))("%s: golden players", (_id, v) => {
  const s = v.scenario;
  const blocker = s.id.endsWith(":migration");
  const find = blocker ? "replica.sessions" : "db.long_running";
  const fix = blocker ? "replica.kill_session" : "db.stop_job";
  const finish = [at(3000, find), at(3050, fix)];

  it("the perfect player wins under par; the one fix is the only fix", () => {
    const r = replay(s, 1, v.golden.perfect);
    expect(r.outcome).toBe("resolved");
    expect(r.rootCauseFound).toBe(true);
    expect(r.budgetBurnedBp).toBeLessThanOrEqual(s.parBp);
    expect(s.rootCauseActionIds).toEqual([fix]);
  });

  it("flushing the cache masks the errors, which then return", () => {
    const r = replay(s, 1, v.golden.masking);
    expect(r.outcome).toBe("resolved");
    expect(r.burnByTag.mitigated_unfixed).toBeGreaterThan(0);
    expect(pickLesson(s, r).id).toBe("flush-trap");
  });

  it("routing reads to the primary masks the errors until the primary saturates", () => {
    const r = replay(s, 1, [at(20, ACK), at(20, "api.route_primary"), ...finish]);
    expect(r.outcome).toBe("resolved");
    expect(r.burnByTag.mitigated_unfixed).toBeGreaterThan(0);
    expect(pickLesson(s, r).id).toBe("route-trap");
  });

  it("failing over to the lagging replica burns side effects, and the lag comes back", () => {
    const r = replay(s, 1, [at(20, ACK), at(20, "db.failover"), ...finish]);
    expect(r.burnByTag["side_effect:db.failover"]).toBeGreaterThan(0);
    expect(pickLesson(s, r).id).toBe("failover-trap");
  });

  it("the fix cannot be run before its target is found", () => {
    const run = new Run(s, 1);
    run.dispatch(ACK);
    expect(run.check(fix)).toBe("unavailable");
    expect(() => run.dispatch(fix)).toThrow();
  });

  it("the replica lag grows if nothing is done, and the alert fires", () => {
    const run = new Run(s, 1);
    run.dispatch(ACK);
    for (let i = 0; i < 400; i++) run.step();
    expect(run.snapshot().alerts.some((a) => a.alertId === "replica_lag")).toBe(true);
  });

  it("do nothing: dnf lesson", () => {
    expect(pickLesson(s, replay(s, 1, [])).id).toBe("dnf");
  });
});

describe("the two variants are different puzzles", () => {
  const [report, migration] = replicaLagIncident.variants.map((v) => v.scenario);
  const has = (s: NonNullable<typeof report>, id: string) => s.actions.some((a) => a.id === id);

  it("the cause is on the primary in one and on the replica in the other", () => {
    expect(has(report!, "db.long_running") && has(report!, "db.stop_job")).toBe(true);
    expect(has(report!, "replica.sessions")).toBe(false);
    expect(has(migration!, "replica.sessions") && has(migration!, "replica.kill_session")).toBe(true);
    expect(has(migration!, "db.stop_job")).toBe(false);
  });

  it("in the migration variant the busy backfill is a herring: listing it or pausing it does not find or fix anything", () => {
    const run = new Run(migration!, 1);
    run.dispatch(ACK);
    run.dispatch("db.long_running");
    for (let i = 0; i < 60; i++) run.step();
    expect(run.check("replica.kill_session")).toBe("unavailable");
    run.dispatch("batch.pause");
    for (let i = 0; i < 200; i++) run.step();
    expect(run.snapshot().alerts.some((a) => a.alertId === "replica_lag")).toBe(true);
    expect(run.check("replica.kill_session")).toBe("unavailable");
  });
});
