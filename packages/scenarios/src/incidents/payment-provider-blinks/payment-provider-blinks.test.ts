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
    expect(pickLesson(s, replay(s, 1, [{ tick: 400, actionId: ACK }, { tick: 400, actionId: "checkout.payment_config" }, { tick: 450, actionId: "checkout.enable_fallback" }])).id).toBe("slow-ack");
    expect(pickLesson(s, replay(s, 1, [])).id).toBe("dnf");
  });

  it("the fix waits for the config to be read, and its siblings are real choices", () => {
    const run = new Run(s, 1);
    run.dispatch(ACK);
    expect(run.check("checkout.enable_fallback")).toBe("unavailable");
    run.dispatch("checkout.payment_config");
    for (let i = 0; i < 40; i++) run.step();
    expect(run.check("checkout.enable_fallback")).not.toBe("unavailable");
    const siblings = s.actions.filter((a) => a.tool === "deploys" && a.category === "mitigate" && a.id !== "checkout.restart" && a.id !== "checkout.rollback");
    expect(siblings.length).toBeGreaterThanOrEqual(1);
  });

  it("the checkout.ok log line has a space between the status and the time", () => {
    const run = new Run(s, 1);
    for (let i = 0; i < 400; i++) run.step();
    const lines = run.logs.filter((l) => l.text.startsWith("POST ") && l.serviceId === "checkout" && !l.text.startsWith("POST /cart"));
    expect(lines.length).toBeGreaterThan(0);
    for (const l of lines) expect(l.text).toMatch(/ (200|503|504) \d+ms$/);
  });
});

describe("the card check variant is a different puzzle", () => {
  const v = incident.variants.find((x) => x.key === "3ds")!;
  const s = v.scenario;
  const card = incident.variants.find((x) => x.key === "")!;

  it("offers three config changes and only the bounded exemption fixes it cleanly", () => {
    const run = new Run(s, 1);
    run.dispatch(ACK);
    run.dispatch("checkout.payment_config");
    for (let i = 0; i < 40; i++) run.step();
    for (const id of ["checkout.enable_fallback", "checkout.hold_orders", "checkout.skip_check"]) expect(run.check(id), id).not.toBe("unavailable");
  });

  it("holding orders masks, and turning the check off resolves but burns side effects", () => {
    const held = replay(s, 1, [{ tick: 20, actionId: ACK }, { tick: 20, actionId: "checkout.payment_config" }, { tick: 60, actionId: "checkout.hold_orders" }, { tick: 1500, actionId: "checkout.enable_fallback" }]);
    expect(held.outcome).toBe("resolved");
    expect(held.burnByTag.mitigated_unfixed).toBeGreaterThan(0);
    expect(pickLesson(s, held).id).toBe("hold-trap");
    const open = replay(s, 1, [{ tick: 20, actionId: ACK }, { tick: 20, actionId: "checkout.payment_config" }, { tick: 60, actionId: "checkout.skip_check" }]);
    expect(open.burnByTag["side_effect:checkout.skip_check"]).toBeGreaterThan(0);
    expect(open.rootCauseFound).toBe(false);
    expect(pickLesson(s, open).id).toBe("open-door");
  });

  it("differs from the card variant in its tool path, fix and options", () => {
    expect(v.golden.perfect.map((a) => a.actionId)).toContain("orders.value_split");
    expect(card.golden.perfect.map((a) => a.actionId)).not.toContain("orders.value_split");
    const fix = (x: typeof v) => x.scenario.actions.find((a) => a.id === "checkout.enable_fallback")!;
    expect(fix(v).label).not.toBe(fix(card).label);
    expect(fix(v).command).not.toBe(fix(card).command);
    expect(v.scenario.actions.some((a) => a.id === "checkout.skip_check")).toBe(true);
    expect(card.scenario.actions.some((a) => a.id === "checkout.skip_check")).toBe(false);
  });
});
