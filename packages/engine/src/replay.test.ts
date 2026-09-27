import { describe, expect, it } from "vitest";
import { ACK, inspectAction } from "./constants";
import { replay } from "./replay";
import { ActionRejected, Run } from "./run";
import { fixture, runToEnd } from "./testing/fixture";

const rejection = (fn: () => unknown): ActionRejected => {
  try {
    fn();
  } catch (e) {
    if (e instanceof ActionRejected) return e;
    throw e;
  }
  throw new Error("expected ActionRejected");
};

describe("replay", () => {
  it("reproduces a live run exactly, including tick-0 inspects and same-tick actions", () => {
    const live = new Run(fixture, 99);
    live.dispatch(inspectAction("a.clue"));
    live.dispatch(inspectAction("b.herring"));
    for (let i = 0; i < 3; i++) live.step();
    live.dispatch(ACK);
    live.dispatch("svc.poke");
    for (let i = 0; i < 22; i++) live.step();
    live.dispatch(inspectAction("c.late"));
    live.dispatch("svc.fix");
    runToEnd(live);
    const result = live.result();

    expect(replay(fixture, 99, result.actions)).toEqual(result);
  });

  it("is deterministic: the same log twice gives the same result", () => {
    const log = [{ tick: 4, actionId: ACK }, { tick: 4, actionId: "svc.fix" }];
    expect(replay(fixture, 5, log)).toEqual(replay(fixture, 5, log));
  });

  it("rejects a console action before the ack", () => {
    const e = rejection(() => replay(fixture, 1, [{ tick: 0, actionId: "svc.fix" }]));
    expect(e.reason).toBe("not_acknowledged");
  });

  it("rejects out-of-order, negative and fractional ticks", () => {
    const outOfOrder = [{ tick: 5, actionId: ACK }, { tick: 3, actionId: "svc.poke" }];
    expect(rejection(() => replay(fixture, 1, outOfOrder)).reason).toBe("out_of_order");
    expect(rejection(() => replay(fixture, 1, [{ tick: -1, actionId: ACK }])).reason).toBe("out_of_order");
    expect(rejection(() => replay(fixture, 1, [{ tick: 2.5, actionId: ACK }])).reason).toBe("out_of_order");
  });

  it("rejects actions after the run ended", () => {
    const late = [{ tick: 0, actionId: ACK }, { tick: 0, actionId: "svc.fix" }, { tick: 500, actionId: "svc.poke" }];
    expect(rejection(() => replay(fixture, 1, late)).reason).toBe("finished");
    expect(rejection(() => replay(fixture, 1, [{ tick: 5000, actionId: ACK }])).reason).toBe("finished");
  });

  it("rejects unknown actions and a busy player", () => {
    expect(rejection(() => replay(fixture, 1, [{ tick: 0, actionId: "rm -rf" }])).reason).toBe("unknown_action");
    const busy = [{ tick: 0, actionId: ACK }, { tick: 0, actionId: "svc.poke" }, { tick: 3, actionId: "svc.fix" }];
    expect(rejection(() => replay(fixture, 1, busy)).reason).toBe("busy");
  });
});
