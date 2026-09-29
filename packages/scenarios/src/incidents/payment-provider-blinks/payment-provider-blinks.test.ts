import { ACK, pickLesson, replay, Run } from "@pitwall/engine";
import { describe, expect, it } from "vitest";
import { paymentProviderBlinksIncident as incident } from "./index";

describe.each(incident.variants.map((v) => [v.scenario.id, v] as const))("%s: golden players", (_id, v) => {
  const s = v.scenario;

  it("perfect burn is well under par, and the fix is the fallback", () => {
    const r = replay(s, 1, v.golden.perfect);
    expect(r.outcome).toBe("resolved");
    expect(r.budgetBurnedBp).toBeLessThan(s.parBp);
    expect(pickLesson(s, r).id).toBe("default");
  });

  it("the restart masks, then the errors return and burn as mitigated_unfixed", () => {
    const r = replay(s, 1, v.golden.masking);
    expect(r.outcome).toBe("resolved");
    expect(r.burnByTag.mitigated_unfixed).toBeGreaterThan(0);
    expect(r.burnByTag["side_effect:checkout.restart"]).toBeGreaterThan(0);
    expect(pickLesson(s, r).id).toBe("restart-trap");
  });

  it("the red herring costs more than the fix and earns its lesson", () => {
    const best = replay(s, 1, v.golden.perfect);
    const r = replay(s, 1, v.golden.herring);
    expect(r.budgetBurnedBp).toBeGreaterThan(best.budgetBurnedBp);
    expect(["restart-trap", "innocent"]).toContain(pickLesson(s, r).id);
  });

  it("reads mitigated after a restart, then investigating once the threads refill", () => {
    const run = new Run(s, 1);
    run.dispatch(ACK);
    run.dispatch("checkout.restart");
    for (let i = 0; i < 200; i++) run.step();
    expect(run.snapshot().errorRateBp).toBe(0);
    expect(run.snapshot().status).toBe("mitigated");
    for (let i = 0; i < 3000 && run.snapshot().errorRateBp < 100; i++) run.step();
    expect(run.snapshot().status).toBe("investigating");
  });

  it("a slow ack gets the ack lesson, and doing nothing gets the dnf lesson", () => {
    expect(pickLesson(s, replay(s, 1, [{ tick: 400, actionId: ACK }, { tick: 400, actionId: "checkout.enable_fallback" }])).id).toBe("slow-ack");
    expect(pickLesson(s, replay(s, 1, [])).id).toBe("dnf");
  });
});
