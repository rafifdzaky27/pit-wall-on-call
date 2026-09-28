import { describe, expect, it } from "vitest";
import { perfectRun, PERFECT_ACTIONS } from "../fixtures";
import { ApiError } from "../http/errors";
import { parseRunBody } from "./schema";

function codeOf(json: unknown): string {
  try {
    parseRunBody(json);
  } catch (e) {
    if (e instanceof ApiError) return `${e.status} ${e.code}`;
    throw e;
  }
  return "ok";
}

describe("parseRunBody", () => {
  it("accepts a valid practice run", () => {
    const body = parseRunBody(perfectRun());
    expect(body.actions).toEqual(PERFECT_ACTIONS);
    expect(body.dryRun).toBe(false);
  });

  it("accepts several actions on one tick", () => {
    expect(codeOf(perfectRun())).toBe("ok");
  });

  it.each([
    ["an unknown scenario", { scenarioId: "nope" }],
    ["a negative seed", { seed: -1 }],
    ["a fractional seed", { seed: 1.5 }],
    ["a seed of 2^32", { seed: 2 ** 32 }],
    ["daily mode, which opens in M3", { mode: "daily" }],
    ["a runKey that is not a UUID", { runKey: "abc" }],
    ["no actions", { actions: [] }],
    ["201 actions", { actions: Array.from({ length: 201 }, () => ({ tick: 0, actionId: "ack" })) }],
    ["a negative tick", { actions: [{ tick: -1, actionId: "ack" }] }],
    ["a fractional tick", { actions: [{ tick: 1.5, actionId: "ack" }] }],
    ["decreasing ticks", { actions: [{ tick: 5, actionId: "ack" }, { tick: 4, actionId: "checkout.deploys" }] }],
    ["an unknown hotspot", { actions: [{ tick: 0, actionId: "inspect:nope" }] }],
    ["an unknown action", { actions: [{ tick: 0, actionId: "drop_tables" }] }],
    ["a missing engineVersion", { engineVersion: undefined }],
    ["a body that is not an object", null],
  ])("rejects %s as 400 schema", (_label, overrides) => {
    expect(codeOf(overrides === null ? [] : perfectRun(overrides as Record<string, unknown>))).toBe("400 schema");
  });

  it("refuses a training shift: training is never posted (M2.5 spec D4)", () => {
    expect(codeOf(perfectRun({ scenarioId: "training-config-push", actions: [{ tick: 0, actionId: "ack" }] }))).toBe("400 schema");
  });

  it("answers a stale engine version with 409, even when its actions are unknown here", () => {
    expect(codeOf(perfectRun({ engineVersion: "0.9.0", actions: [{ tick: 0, actionId: "future.action" }] }))).toBe("409 stale_version");
  });
});
