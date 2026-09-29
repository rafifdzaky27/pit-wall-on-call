import { ACK, pickLesson, replay, Run } from "@pitwall/engine";
import { describe, expect, it } from "vitest";
import { retryStormIncident as incident } from "./index";

describe.each(incident.variants.map((v) => [v.scenario.id, v] as const))("%s: golden players", (_id, v) => {
  const s = v.scenario;

  it("the perfect player resolves under par with the caller's config", () => {
    const r = replay(s, 1, v.golden.perfect);
    expect(r.outcome).toBe("resolved");
    expect(r.rootCauseFound).toBe(true);
    expect(r.budgetBurnedBp).toBeLessThanOrEqual(s.parBp);
    expect(pickLesson(s, r).id).toBe("default");
  });

  it("scaling masks: the errors stop, then a blip brings the storm back, burning as mitigated_unfixed", () => {
    const run = new Run(s, 1);
    run.dispatch(ACK);
    run.dispatch("dep.scale_up");
    for (let i = 0; i < 700; i++) run.step();
    expect(run.snapshot().errorRateBp).toBe(0);
    expect(run.snapshot().status).toBe("mitigated");
    for (let i = 0; i < 1500 && run.snapshot().errorRateBp < 100; i++) run.step();
    expect(run.snapshot().errorRateBp).toBeGreaterThanOrEqual(100);
    expect(run.snapshot().status).toBe("investigating");

    const r = replay(s, 1, v.golden.masking);
    expect(r.outcome).toBe("resolved");
    expect(r.burnByTag.mitigated_unfixed).toBeGreaterThan(0);
    expect(pickLesson(s, r).id).toBe("scale-trap");
  });

  it("restarting the dependency is a thundering herd: it burns side effects and does not mask", () => {
    const r = replay(s, 1, [{ tick: 20, actionId: ACK }, { tick: 20, actionId: "dep.restart" }, { tick: 300, actionId: "caller.deploys" }, { tick: 350, actionId: "caller.fix" }]);
    expect(r.burnByTag["side_effect:dep.restart"]).toBeGreaterThan(0);
    expect(r.burnByTag.mitigated_unfixed ?? 0).toBe(0);
    expect(pickLesson(s, r).id).toBe("restart-trap");
  });

  it("chasing the loud herring costs more than the fix", () => {
    const best = replay(s, 1, v.golden.perfect);
    const r = replay(s, 1, v.golden.herring);
    expect(r.outcome).toBe("resolved");
    expect(r.budgetBurnedBp).toBeGreaterThan(best.budgetBurnedBp);
  });

  it("a fix rolled out just before a blip holds: the blip does not become a storm", () => {
    const run = new Run(s, 1);
    run.dispatch(ACK);
    for (let i = 0; i < 1400; i++) run.step();
    run.dispatch("caller.deploys");
    for (let i = 0; i < 40; i++) run.step();
    run.dispatch("caller.fix");
    for (let i = 0; i < 3000 && run.outcome === "running"; i++) run.step();
    expect(run.outcome).toBe("resolved");
  });

  it("a slow ack gets the ack lesson, and doing nothing gets the dnf lesson", () => {
    expect(pickLesson(s, replay(s, 1, [{ tick: 400, actionId: ACK }, { tick: 400, actionId: "caller.deploys" }, { tick: 450, actionId: "caller.fix" }])).id).toBe("slow-ack");
    expect(pickLesson(s, replay(s, 1, [])).id).toBe("dnf");
  });

  it("the fix is not on offer until the caller's config has been read, and the event log states the load for this variant", () => {
    const run = new Run(s, 1);
    run.dispatch(ACK);
    expect(run.check("caller.fix")).toBe("unavailable");
    run.dispatch("caller.deploys");
    for (let i = 0; i < 40; i++) run.step();
    expect(run.check("caller.fix")).not.toBe("unavailable");
    const load = v.scenario.actions.find((a) => a.id === "dep.incident_log")!.reveals!(undefined as never)[0] ?? "";
    expect(load).toContain(v.key === "auth" ? "about 4.5x" : "about 3.6x");
  });
});
