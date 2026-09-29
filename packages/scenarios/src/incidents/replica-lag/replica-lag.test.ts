import { ACK, pickLesson, replay, Run, type ActionRecord } from "@pitwall/engine";
import { describe, expect, it } from "vitest";
import { replicaLagIncident } from "./index";

const at = (tick: number, actionId: string): ActionRecord => ({ tick, actionId });

describe.each(replicaLagIncident.variants.map((v) => [v.scenario.id, v] as const))("%s: golden players", (_id, v) => {
  const s = v.scenario;
  const finish = [at(3000, "db.long_running"), at(3050, "db.stop_job")];

  it("the perfect player wins under par; stopping the job is the only fix", () => {
    const r = replay(s, 1, v.golden.perfect);
    expect(r.outcome).toBe("resolved");
    expect(r.rootCauseFound).toBe(true);
    expect(r.budgetBurnedBp).toBeLessThanOrEqual(s.parBp);
    expect(s.rootCauseActionIds).toEqual(["db.stop_job"]);
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

  it("the job cannot be stopped before it is found", () => {
    const run = new Run(s, 1);
    run.dispatch(ACK);
    expect(() => run.dispatch("db.stop_job")).toThrow();
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
