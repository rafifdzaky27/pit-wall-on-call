import { ACK, replay } from "@pitwall/engine";
import { describe, expect, it } from "vitest";
import { DUCK, DUCK_DONE } from "./duck";
import { SCENARIOS } from "./index";

describe.each(SCENARIOS.map((s) => [s.id, s] as const))("%s: the rubber duck (M2.5 spec §9)", (_id, scenario) => {
  const findings = (ducks: number) => {
    const actions = [{ tick: 0, actionId: ACK }];
    for (let i = 0; i < ducks; i++) actions.push({ tick: 1 + i * 310, actionId: DUCK });
    const r = replay(scenario, 1, actions);
    return r.timeline.filter((e) => e.kind === "action_done" && e.actionId === DUCK).length;
  };

  it("has three or more hints, none of which names an action or a version", () => {
    expect(scenario.hints?.length ?? 0).toBeGreaterThanOrEqual(3);
    const labels = scenario.actions.map((a) => a.label.toLowerCase());
    for (const hint of scenario.hints!) {
      for (const label of labels) expect(hint.toLowerCase()).not.toContain(label);
      expect(hint).not.toMatch(/\bv\d+/);
    }
  });

  it("is a 30-second action that completes each time", () => {
    const duck = scenario.actions.find((a) => a.id === DUCK)!;
    expect(duck.durationS).toBe(30);
    expect(findings(4)).toBe(4);
  });

  it("reveals the hints in order, then says it has nothing more", () => {
    const duck = scenario.actions.find((a) => a.id === DUCK)!;
    let s = scenario.setup({ next: () => 0.5, int: () => 0 } as never);
    const said: string[] = [];
    for (let i = 0; i < scenario.hints!.length + 1; i++) {
      said.push(...duck.reveals!(s));
      s = duck.effect!(s);
    }
    expect(said).toEqual([...scenario.hints!, DUCK_DONE].map((h) => `rubber duck: "${h}"`));
  });
});
