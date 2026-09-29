import { ACK, pickLesson, replay, Run, type ActionRecord } from "@pitwall/engine";
import { describe, expect, it } from "vitest";
import { regexCpuIncident } from "./index";

const at = (tick: number, actionId: string): ActionRecord => ({ tick, actionId });

describe.each(regexCpuIncident.variants.map((v) => [v.scenario.id, v] as const))("%s: golden players", (_id, v) => {
  const s = v.scenario;

  it("the perfect player gets the default lesson and finds the root cause", () => {
    const r = replay(s, 1, v.golden.perfect);
    expect(r.outcome).toBe("resolved");
    expect(r.rootCauseFound).toBe(true);
    expect(pickLesson(s, r).id).toBe("default");
  });

  it("scaling out masks the timeouts, then the bad rule pegs the CPU again", () => {
    const run = new Run(s, 1);
    run.dispatch(ACK);
    run.dispatch("rule.scale_out");
    for (let i = 0; i < 400; i++) run.step();
    expect(run.snapshot().status).toBe("mitigated");
    for (let i = 0; i < 3200; i++) run.step();
    expect(run.snapshot().status).toBe("investigating");
    const r = replay(s, 1, v.golden.masking);
    expect(r.burnByTag.mitigated_unfixed).toBeGreaterThan(0);
    expect(pickLesson(s, r).id).toBe("scale-trap");
  });

  it("restarting and disabling burn side effects and teach the harmful lesson", () => {
    const r = replay(s, 1, v.golden.herring);
    expect(r.burnByTag["side_effect:rule.restart"]).toBeGreaterThan(0);
    expect(pickLesson(s, r).id).toBe("harmful");
    const d = replay(s, 1, [at(20, ACK), at(20, "rule.disable"), at(200, "rule.config_rollback")]);
    expect(d.burnByTag["side_effect:rule.disable"]).toBeGreaterThan(0);
    expect(pickLesson(s, d).id).toBe("harmful");
  });

  it("doing nothing gets the dnf lesson and a slow ack gets the ack lesson", () => {
    expect(pickLesson(s, replay(s, 1, [])).id).toBe("dnf");
    expect(pickLesson(s, replay(s, 1, [at(400, ACK), at(400, "rule.config_rollback")])).id).toBe("slow-ack");
  });
});

describe("regex-cpu variants differ for the player", () => {
  const [edge, search] = regexCpuIncident.variants;
  it("puts the rule in a different layer with different config history", () => {
    const e = edge!.scenario;
    const q = search!.scenario;
    expect(e.actions.find((a) => a.id === "rule.config_rollback")!.label).not.toBe(q.actions.find((a) => a.id === "rule.config_rollback")!.label);
    expect(e.services.map((x) => x.label)).not.toEqual(q.services.map((x) => x.label));
    expect(e.coldOpen.symptom.surface).not.toBe(q.coldOpen.symptom.surface);
  });
});
