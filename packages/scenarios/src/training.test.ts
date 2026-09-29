import { ACK, inspectAction, pickLesson, replay, type ActionRecord } from "@pitwall/engine";
import { describe, expect, it } from "vitest";
import { SCENARIOS } from "./index";
import { training } from "./training";

const at = (tick: number, actionId: string): ActionRecord => ({ tick, actionId });

/** What the coach walks the player through: read the clue, ack, look, find the config push, roll it back, tell customers. */
const coached = [
  at(0, inspectAction("laptop.slack.deploys")),
  at(30, ACK),
  at(60, "api.logs"),
  at(120, "api.config"),
  at(180, "api.config_rollback"),
  at(400, "global.status_update"),
];

describe("Training: The Bad Config (M2.5 spec §5)", () => {
  it("is registered, marked as training, and short", () => {
    expect(SCENARIOS).toContain(training);
    expect(training.training).toBe(true);
    expect(training.timeLimitS).toBeLessThanOrEqual(240);
  });

  it("the coached path resolves under par with the root cause found, on every seed from 1 to 50", () => {
    for (let seed = 1; seed <= 50; seed++) {
      const r = replay(training, seed, coached);
      expect({ seed, outcome: r.outcome, underPar: r.budgetBurnedBp <= training.parBp, root: r.rootCauseFound }).toEqual({ seed, outcome: "resolved", underPar: true, root: true });
    }
  });

  it("doing nothing ends out of time", () => {
    const r = replay(training, 1, []);
    expect(r.outcome).toBe("dnf");
    expect(pickLesson(training, r).id).toBe("dnf");
  });

  it("restarting the api without the rollback does not resolve", () => {
    const r = replay(training, 1, [at(30, ACK), at(60, "api.restart")]);
    expect(r.outcome).toBe("dnf");
  });

  it("the coached path gets the default lesson", () => {
    expect(pickLesson(training, replay(training, 1, coached)).id).toBe("default");
  });
});
