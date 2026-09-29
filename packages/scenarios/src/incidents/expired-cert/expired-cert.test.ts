import { ACK, pickLesson, replay, Run, type ActionRecord } from "@pitwall/engine";
import { describe, expect, it } from "vitest";
import { expiredCertIncident } from "./index";

const at = (tick: number, actionId: string): ActionRecord => ({ tick, actionId });

describe.each(expiredCertIncident.variants.map((v) => [v.scenario.id, v] as const))("%s: golden players", (_id, v) => {
  const s = v.scenario;
  const fix = s.rootCauseActionIds[0]!;
  const mask = v.golden.masking[1]!.actionId;
  const discover = v.golden.perfect.at(-2)!.actionId;

  it("perfect resolves under par with the root cause found and the default lesson", () => {
    const r = replay(s, 1, v.golden.perfect);
    expect(r.outcome).toBe("resolved");
    expect(r.rootCauseFound).toBe(true);
    expect(r.budgetBurnedBp).toBeLessThanOrEqual(s.parBp);
    expect(pickLesson(s, r).id).toBe("default");
  });

  it("doing nothing runs out the clock with the dnf lesson", () => {
    const r = replay(s, 1, []);
    expect(r.outcome).toBe("dnf");
    expect(pickLesson(s, r).id).toBe("dnf");
  });

  it("the restart hides the symptom, then the errors come back and burn as mitigated_unfixed", () => {
    const run = new Run(s, 1);
    run.dispatch(ACK);
    run.dispatch(mask);
    for (let i = 0; i < 400; i++) run.step();
    expect(run.snapshot().errorRateBp).toBe(0);
    expect(run.snapshot().status).toBe("mitigated");
    for (let i = 0; i < 500; i++) run.step();
    expect(run.snapshot().errorRateBp).toBeGreaterThan(0);
    const r = replay(s, 1, v.golden.masking);
    expect(r.outcome).toBe("resolved");
    expect(r.burnByTag.mitigated_unfixed).toBeGreaterThan(0);
    expect(pickLesson(s, r).id).toBe("restart-trap");
  });

  it("turning verification off is harmful: it burns side effects, never resolves, and gets its lesson", () => {
    const list = [at(20, ACK), at(20, "checkout.disable_verify"), at(300, discover), at(400, fix)];
    const r = replay(s, 1, list);
    expect(r.burnByTag["side_effect:checkout.disable_verify"]).toBeGreaterThan(0);
    expect(pickLesson(s, r).id).toBe("bypass-trap");
    // Without the fix the run never resolves.
    expect(replay(s, 1, [at(20, ACK), at(20, "checkout.disable_verify")]).outcome).toBe("dnf");
  });

  it("the herring player scores worse than perfect", () => {
    expect(replay(s, 1, v.golden.herring).budgetBurnedBp).toBeGreaterThan(replay(s, 1, v.golden.perfect).budgetBurnedBp);
  });

  it("a slow ack gets the ack lesson", () => {
    expect(pickLesson(s, replay(s, 1, [at(400, ACK), at(400, discover), at(450, fix)])).id).toBe("slow-ack");
  });
});

describe.each(expiredCertIncident.variants.map((v) => [v.scenario.id, v] as const))("%s: the fix waits for its discovery step", (_id, v) => {
  it("is unavailable until the expired certificate has been found", () => {
    const s = v.scenario;
    const fix = s.rootCauseActionIds[0]!;
    const discover = v.golden.perfect.at(-2)!.actionId;
    const run = new Run(s, 1);
    run.dispatch(ACK);
    expect(run.check(fix)).toBe("unavailable");
    run.dispatch(discover);
    for (let i = 0; i < 50; i++) run.step();
    expect(run.check(fix)).toBeNull();
  });
});

describe("the variants differ in what the player looks at", () => {
  const [a, b] = expiredCertIncident.variants.map((v) => v.scenario);
  it("puts the expired cert on different services", () => {
    expect(a!.services.map((x) => x.id)).toContain("payments");
    expect(b!.services.map((x) => x.id)).toContain("stock");
    expect(a!.rootCauseActionIds).not.toEqual(b!.rootCauseActionIds);
  });
  it("finds and fixes it through different tools", () => {
    const tool = (s: typeof a, id: string) => s!.actions.find((x) => x.id === id)!.tool;
    expect(tool(a, a!.rootCauseActionIds[0]!)).toBe("deploys");
    expect(tool(b, b!.rootCauseActionIds[0]!)).toBe("db");
    expect(tool(b, "stock.certs")).toBe("db");
  });
});
