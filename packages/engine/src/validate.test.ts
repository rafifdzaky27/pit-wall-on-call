import { describe, expect, it } from "vitest";
import { fixture } from "./testing/fixture";
import { ScenarioError, validateScenario } from "./validate";

describe("validateScenario", () => {
  it("accepts a well-formed scenario", () => {
    expect(() => validateScenario(fixture)).not.toThrow();
  });

  it("rejects duplicate action ids", () => {
    const bad = { ...fixture, actions: [...fixture.actions, fixture.actions[0]!] };
    expect(() => validateScenario(bad)).toThrow(/duplicate action svc.poke/);
  });

  it("rejects reserved action ids", () => {
    const ack = { ...fixture.actions[0]!, id: "ack" };
    const inspect = { ...fixture.actions[0]!, id: "inspect:x" };
    expect(() => validateScenario({ ...fixture, actions: [ack] })).toThrow(ScenarioError);
    expect(() => validateScenario({ ...fixture, actions: [inspect] })).toThrow(/reserved/);
  });

  it("rejects references to unknown services", () => {
    const stray = { ...fixture.actions[0]!, id: "x.y", serviceId: "nope" };
    expect(() => validateScenario({ ...fixture, actions: [...fixture.actions, stray] })).toThrow(/unknown service nope/);
  });

  it("rejects fractional action durations", () => {
    const slow = { ...fixture.actions[0]!, id: "x.slow", durationS: 1.5 };
    expect(() => validateScenario({ ...fixture, actions: [...fixture.actions, slow] })).toThrow(/durationS/);
  });

  it("rejects a root cause action that does not exist", () => {
    expect(() => validateScenario({ ...fixture, rootCauseActionIds: ["svc.nope"] })).toThrow(/rootCauseActionIds/);
  });

  it("requires at least one lesson", () => {
    expect(() => validateScenario({ ...fixture, lessons: [] })).toThrow(/lesson/);
  });
});
