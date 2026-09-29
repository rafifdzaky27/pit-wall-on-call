import { ACK, inspectAction, pickLesson, replay, Run, type ActionRecord } from "@pitwall/engine";
import { describe, expect, it } from "vitest";
import { slowLeak } from "./slow-leak";

const at = (tick: number, actionId: string): ActionRecord => ({ tick, actionId });

/** Reads the clue, acks in 2 s, checks the pool and the deploys, rolls back. */
const perfect = [
  at(0, inspectAction("laptop.slack.deploys")),
  at(20, ACK),
  at(20, "checkout.pool_stats"),
  at(60, "checkout.deploys"),
  at(90, "checkout.rollback"),
];

/** Chases the loud database, then restarts, and only then rolls back. */
const redHerring = [
  at(20, ACK),
  at(20, "postgres.connections"),
  at(50, "postgres.raise_max_conns"),
  at(250, "postgres.failover"),
  at(550, "checkout.restart"),
  at(700, "checkout.rollback"),
];

describe("The Slow Leak: golden players", () => {
  it("perfect player resolves under par with the root cause found", () => {
    const r = replay(slowLeak, 1, perfect);
    expect(r.outcome).toBe("resolved");
    expect(r.rootCauseFound).toBe(true);
    expect(r.budgetBurnedBp).toBeLessThanOrEqual(slowLeak.parBp);
    expect(r.cluesFound).toEqual(["laptop.slack.deploys"]);
  });

  it("perfect player resolves under par on every seed from 1 to 50", () => {
    for (let seed = 1; seed <= 50; seed++) {
      const r = replay(slowLeak, seed, perfect);
      expect({ seed, outcome: r.outcome, underPar: r.budgetBurnedBp <= slowLeak.parBp }).toEqual({ seed, outcome: "resolved", underPar: true });
    }
  });

  it("do-nothing player DNFs, escalates, and burns only unacknowledged budget", () => {
    const r = replay(slowLeak, 1, []);
    expect(r.outcome).toBe("dnf");
    expect(r.escalated).toBe(true);
    expect(Object.keys(r.burnByTag)).toEqual(["unacknowledged"]);
    expect(pickLesson(slowLeak, r).id).toBe("dnf");
  });

  it("red-herring player scores strictly worse than perfect, with side-effect burn", () => {
    const best = replay(slowLeak, 1, perfect);
    const r = replay(slowLeak, 1, redHerring);
    expect(r.outcome).toBe("resolved");
    expect(r.budgetBurnedBp).toBeGreaterThan(best.budgetBurnedBp);
    expect(r.burnByTag["side_effect:postgres.failover"]).toBeGreaterThan(0);
    expect(r.burnByTag["side_effect:checkout.restart"]).toBeGreaterThan(0);
    expect(pickLesson(slowLeak, r).id).toBe("restart-trap");
  });

  it("restart trap: the leak returns and burns as mitigated_unfixed", () => {
    const r = replay(slowLeak, 1, [at(20, ACK), at(20, "checkout.restart"), at(3200, "checkout.rollback")]);
    expect(r.outcome).toBe("resolved");
    expect(r.burnByTag.mitigated_unfixed).toBeGreaterThan(0);
  });

  it("slow ack gets the ack lesson", () => {
    const r = replay(slowLeak, 1, [at(400, ACK), at(400, "checkout.rollback")]);
    expect(pickLesson(slowLeak, r).id).toBe("slow-ack");
  });

  it("the default lesson covers a clean run", () => {
    expect(pickLesson(slowLeak, replay(slowLeak, 1, perfect)).id).toBe("default");
  });
});

describe("The Slow Leak: status after a restart (M2.5 review, regraded 6)", () => {
  it("reads mitigated while the errors are gone, and investigating again once the leak brings them back", () => {
    const run = new Run(slowLeak, 1);
    run.dispatch(ACK);
    run.dispatch("checkout.restart");
    for (let i = 0; i < 160; i++) run.step();
    expect(run.snapshot().errorRateBp).toBe(0);
    expect(run.snapshot().status).toBe("mitigated");
    // The pool refills at the leak rate; once 5xx pass 1% again, it is no longer mitigated.
    for (let i = 0; i < 2600 && run.snapshot().errorRateBp < 100; i++) run.step();
    expect(run.snapshot().errorRateBp).toBeGreaterThanOrEqual(100);
    expect(run.snapshot().status).toBe("investigating");
  });
});
