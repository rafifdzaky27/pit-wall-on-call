import { describe, expect, it } from "vitest";
import { ACK, ENGINE_VERSION, ESCALATION_TICK, inspectAction } from "./constants";
import { defineScenario } from "./define";
import { replay } from "./replay";
import { ActionRejected, Run } from "./run";
import { fixture, runToEnd } from "./testing/fixture";

const newRun = (seed = 1) => new Run(fixture, seed);
const steps = (run: { step(): void }, n: number) => {
  for (let i = 0; i < n; i++) run.step();
};

describe("paging phase", () => {
  it("starts at tick 0 with the page on the timeline", () => {
    const run = newRun();
    expect(run.tick).toBe(0);
    expect(run.timeline[0]).toEqual({ tick: 0, kind: "page" });
    expect(run.snapshot().acked).toBe(false);
  });

  it("rejects console actions before the ack", () => {
    const run = newRun();
    expect(run.check("svc.poke")).toBe("not_acknowledged");
    expect(() => run.dispatch("svc.poke")).toThrow(ActionRejected);
    try {
      run.dispatch("svc.poke");
    } catch (e) {
      expect((e as ActionRejected).reason).toBe("not_acknowledged");
      expect((e as ActionRejected).tick).toBe(0);
    }
  });

  it("records the ack tick and rejects a second ack", () => {
    const run = newRun();
    steps(run, 25);
    run.dispatch(ACK);
    expect(run.snapshot().ackTick).toBe(25);
    expect(run.check(ACK)).toBe("already_acknowledged");
  });

  it("tags burn before the ack as unacknowledged", () => {
    const run = newRun();
    steps(run, 10);
    run.dispatch(ACK);
    steps(run, 5);
    run.dispatch("svc.fix");
    runToEnd(run);
    const r = run.result();
    expect(r.burnByTag.unacknowledged).toBe(10);
    expect(r.burnByTag.investigating).toBe(14);
  });

  it("escalates at tick 600 when nobody acks", () => {
    const run = newRun();
    steps(run, ESCALATION_TICK);
    expect(run.snapshot().escalated).toBe(false);
    run.step();
    expect(run.snapshot().escalated).toBe(true);
    expect(run.timeline).toContainEqual({ tick: ESCALATION_TICK, kind: "escalated" });
  });

  it("never escalates once acknowledged", () => {
    const run = newRun();
    run.dispatch(ACK);
    steps(run, ESCALATION_TICK + 10);
    expect(run.snapshot().escalated).toBe(false);
  });
});

describe("inspect actions", () => {
  it("are allowed at tick 0 before the ack and take no time", () => {
    const run = newRun();
    run.dispatch(inspectAction("a.clue"));
    run.dispatch(inspectAction("b.herring"));
    run.dispatch(inspectAction("a.clue"));
    const snap = run.snapshot();
    expect(snap.busy).toBeNull();
    expect(snap.inspected).toEqual(["a.clue", "b.herring"]);
    expect(snap.cluesFound).toEqual(["a.clue"]);
    expect(run.actions).toHaveLength(3);
    expect(run.actions.every((a) => a.tick === 0)).toBe(true);
  });

  it("are allowed after the page while the clock runs", () => {
    const run = newRun();
    steps(run, 5);
    run.dispatch(inspectAction("c.late"));
    expect(run.timeline).toContainEqual({ tick: 5, kind: "inspect", hotspotId: "c.late" });
    expect(run.snapshot().cluesFound).toEqual(["c.late"]);
  });

  it("reject unknown hotspots, including prototype keys", () => {
    const run = newRun();
    for (const id of ["nope", "constructor", "__proto__", "toString"]) {
      expect(run.check(inspectAction(id))).toBe("unknown_action");
    }
    expect(run.check("svc.nope")).toBe("unknown_action");
  });
});

describe("timed actions", () => {
  it("keep the player busy until they finish, then reveal findings", () => {
    const run = newRun();
    run.dispatch(ACK);
    run.dispatch("svc.poke");
    expect(run.snapshot().busy).toEqual({ actionId: "svc.poke", startTick: 0, endTick: 20 });
    steps(run, 5);
    expect(run.check("svc.fix")).toBe("busy");
    expect(run.check(ACK)).toBe("already_acknowledged");
    expect(run.check(inspectAction("a.clue"))).toBeNull();
    steps(run, 15);
    expect(run.snapshot().busy).toBeNull();
    const finding = run.logs.find((l) => l.finding);
    expect(finding).toMatchObject({ tick: 19, serviceId: "svc", text: "poked at level 20", finding: true });
    expect(run.timeline).toContainEqual({ tick: 19, kind: "action_done", actionId: "svc.poke" });
  });

  it("log findings from global actions under 'global'", () => {
    const run = newRun();
    run.dispatch(ACK);
    run.dispatch("status");
    steps(run, 10);
    expect(run.logs.find((l) => l.finding)).toMatchObject({ serviceId: "global", text: "status posted" });
  });

  it("tag side-effect burn with the action id", () => {
    const run = newRun();
    run.dispatch(ACK);
    run.dispatch("svc.break");
    steps(run, 10);
    run.dispatch("svc.fix");
    runToEnd(run);
    const r = run.result();
    expect(r.burnByTag["side_effect:svc.break"]).toBe(50);
    expect(r.burnByTag.investigating).toBe(19);
  });

  it("tag burn as mitigated_unfixed while a mitigation hides the cause", () => {
    const run = newRun();
    run.dispatch(ACK);
    run.dispatch("svc.patch");
    steps(run, 20);
    run.dispatch("svc.fix");
    runToEnd(run);
    const r = run.result();
    expect(r.burnByTag.investigating).toBe(9);
    expect(r.burnByTag.mitigated_unfixed).toBe(20);
  });

  it("reports the current error rate, including a running side effect", () => {
    const run = newRun();
    run.dispatch(ACK);
    expect(run.snapshot().errorRateBp).toBe(1000);
    run.dispatch("svc.break");
    expect(run.snapshot().errorRateBp).toBe(6000);
    steps(run, 10);
    expect(run.snapshot().errorRateBp).toBe(1000);
  });

  it("respect availability", () => {
    const run = newRun();
    run.dispatch(ACK);
    run.dispatch("svc.fix");
    steps(run, 10);
    expect(run.check("svc.fix")).toBe("unavailable");
  });
});

describe("resolution and time limit", () => {
  it("resolves after the fix holds for 10 s and records mitigatedAtTick", () => {
    const run = newRun();
    run.dispatch(ACK);
    run.dispatch("svc.fix");
    expect(runToEnd(run)).toBe(109);
    const r = run.result();
    expect(r.outcome).toBe("resolved");
    expect(r.endTick).toBe(109);
    expect(r.mitigatedAtTick).toBe(9);
    expect(r.budgetBurnedBp).toBe(9);
    expect(r.rootCauseFound).toBe(true);
    expect(r.timeline).toContainEqual({ tick: 109, kind: "resolved" });
    expect(r.timeline).toContainEqual({ tick: 9, kind: "alert_cleared", alertId: "svc.down" });
  });

  it("exposes when the fix started holding, for the countdown (M1.6 F2)", () => {
    const run = newRun();
    run.dispatch(ACK);
    expect(run.snapshot().stableSinceTick).toBeNull();
    run.dispatch("svc.fix");
    steps(run, 20);
    expect(run.snapshot().stableSinceTick).toBe(9);
    runToEnd(run);
    expect(run.result().mitigatedAtTick).toBe(9);
  });

  it("ends as DNF at the time limit with every tick unacknowledged", () => {
    const run = newRun();
    expect(runToEnd(run)).toBe(900);
    const r = run.result();
    expect(r).toMatchObject({ outcome: "dnf", endTick: 900, mitigatedAtTick: null, ackTick: null, escalated: true, budgetBurnedBp: 900, rootCauseFound: false });
    expect(r.burnByTag).toEqual({ unacknowledged: 900 });
  });

  it("refuses to step, dispatch or report once finished, and refuses a result while running", () => {
    const run = newRun();
    expect(() => run.result()).toThrow(/in progress/);
    runToEnd(run);
    expect(() => run.step()).toThrow(/finished/);
    expect(run.check(ACK)).toBe("finished");
  });
});

describe("alerts, logs and metrics", () => {
  it("fires alerts at construction so the page shows them", () => {
    const snap = newRun().snapshot();
    expect(snap.alerts).toEqual([{ alertId: "svc.down", firedAtTick: 0, clearedAtTick: null }]);
  });

  it("emits template logs on their cadence", () => {
    const run = newRun();
    steps(run, 100);
    const lines = run.logs.filter((l) => !l.finding);
    expect(lines).toHaveLength(10);
    expect(lines.every((l) => l.level === "INFO" && l.serviceId === "svc")).toBe(true);
  });

  it("is deterministic per seed, and noise differs across seeds", () => {
    const a = newRun(7);
    const b = newRun(7);
    const c = newRun(8);
    for (const r of [a, b, c]) steps(r, 50);
    expect(a.snapshot()).toEqual(b.snapshot());
    expect(a.logs).toEqual(b.logs);
    expect(a.snapshot().metrics["svc.level"]).not.toBe(c.snapshot().metrics["svc.level"]);
  });

  it("reports service details and health from state", () => {
    const run = newRun();
    steps(run, 3);
    const snap = run.snapshot();
    expect(snap.details).toEqual({ svc: "level 3" });
    expect(snap.health).toEqual({ svc: "crit" });
  });
});

describe("determinism guards", () => {
  it("throws when dynamics produce a non-integer state", () => {
    const bad = defineScenario({ ...fixture, dynamics: (s) => ({ ...s, level: s.level + 0.5 }) });
    const run = new Run(bad, 1);
    expect(() => run.step()).toThrow(/integers/);
  });

  it("validates the scenario on construction", () => {
    expect(() => new Run({ ...fixture, lessons: [] }, 1)).toThrow(/lesson/);
  });
});

describe("snapshot status (M2.5 spec §3)", () => {
  // Here the patch brings errors under 1% while the cause stays, which is what "mitigated" means.
  const hiding = defineScenario({ ...fixture, errorRateBp: (s) => (s.fixed ? 0 : s.patched ? 50 : 1000) });
  const until = (run: Run<Record<string, number>>, pred: () => boolean, max = 2000) => {
    for (let i = 0; i < max && !pred(); i++) run.step();
  };

  it("walks paging → investigating → mitigated → holding → resolved", () => {
    const run = new Run(hiding, 1);
    expect(run.snapshot().status).toBe("paging");
    run.dispatch(ACK);
    expect(run.snapshot().status).toBe("investigating");
    run.dispatch("svc.patch");
    until(run, () => run.snapshot().busy === null);
    expect(run.snapshot().status).toBe("mitigated");
    run.dispatch("svc.fix");
    until(run, () => run.snapshot().stableSinceTick !== null);
    expect(run.snapshot().status).toBe("holding");
    until(run, () => run.outcome !== "running");
    expect(run.snapshot().status).toBe("resolved");
  });

  it("is dnf when time runs out", () => {
    const run = newRun();
    run.dispatch(ACK);
    until(run, () => run.outcome !== "running", 5000);
    expect(run.snapshot().status).toBe("dnf");
  });
});

describe("mitigated needs the symptoms down (M2.5 review)", () => {
  it("a mitigation that leaves errors at 10% is still an investigation", () => {
    const run = newRun();
    run.dispatch(ACK);
    run.dispatch("svc.patch");
    steps(run, 20);
    expect(run.snapshot().errorRateBp).toBe(1000);
    expect(run.snapshot().status).toBe("investigating");
describe("asynchronous actions (M2.5 plan B1)", () => {
  it("do not block the next action, and complete on their own clock", () => {
    const run = newRun();
    run.dispatch(ACK);
    run.dispatch("ask");
    expect(run.snapshot().busy).toBeNull();
    expect(run.snapshot().pending).toEqual([{ actionId: "ask", startTick: 0, endTick: 50 }]);
    run.dispatch("svc.poke");
    steps(run, 49);
    expect(run.timeline.some((e) => e.kind === "action_done" && e.actionId === "ask")).toBe(false);
    steps(run, 1);
    expect(run.timeline).toContainEqual({ tick: 49, kind: "action_done", actionId: "ask" });
    expect(run.logs.some((l) => l.finding && l.text.startsWith("teammate answered"))).toBe(true);
    expect(run.snapshot().pending).toEqual([]);
  });

  it("cannot be asked again while the first is pending", () => {
    const run = newRun();
    run.dispatch(ACK);
    run.dispatch("ask");
    expect(run.check("ask")).toBe("pending");
    steps(run, 50);
    expect(run.check("ask")).toBeNull();
  });

  it("replay agrees with the live run", () => {
    const actions = [
      { tick: 0, actionId: ACK },
      { tick: 0, actionId: "ask" },
      { tick: 0, actionId: "svc.poke" },
      { tick: 20, actionId: "svc.fix" },
    ];
    const r = replay(fixture, 1, actions);
    expect(r.outcome).toBe("resolved");
    expect(r.timeline.filter((e) => e.kind === "action_done").map((e) => (e as { actionId: string }).actionId)).toEqual(["svc.poke", "svc.fix", "ask"]);
  });
});

describe("engine version", () => {
  it("is 1.1.0 since asynchronous actions (M2.5 spec D3)", () => {
    expect(ENGINE_VERSION).toBe("1.1.0");
  });
});
