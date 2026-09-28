import { ACK, replay } from "@pitwall/engine";
import { slowLeak } from "@pitwall/scenarios";
import { describe, expect, it } from "vitest";
import { PERFECT_ACTIONS } from "../fixtures";
import { isImplausible } from "./plausibility";

describe("isImplausible", () => {
  it("accepts the golden perfect player", () => {
    expect(isImplausible(slowLeak, replay(slowLeak, 1, PERFECT_ACTIONS))).toBe(false);
  });

  it("flags a root-cause fix started less than 2 s after the page", () => {
    const fast = replay(slowLeak, 1, [
      { tick: 0, actionId: ACK },
      { tick: 10, actionId: "checkout.rollback" },
    ]);
    expect(fast.outcome).toBe("resolved");
    expect(isImplausible(slowLeak, fast)).toBe(true);
  });

  it("never flags a run that did not resolve", () => {
    expect(isImplausible(slowLeak, replay(slowLeak, 1, [{ tick: 0, actionId: ACK }]))).toBe(false);
  });
});
