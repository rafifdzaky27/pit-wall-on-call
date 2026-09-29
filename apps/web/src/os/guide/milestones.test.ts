import { describe, expect, it } from "vitest";
import { due, markHinted, MILESTONES, nextMilestone, observe, QUIET_MS, startGuide } from "./milestones";

describe("the milestone reducer", () => {
  it("adds each milestone once and moves the quiet clock only when there is news", () => {
    const s0 = startGuide(1000);
    const s1 = observe(s0, { acked: true }, 2000);
    expect(s1.done).toEqual(["acked"]);
    expect(s1.lastAt).toBe(2000);
    expect(observe(s1, { acked: true }, 3000)).toBe(s1);
    expect(observe(s1, { acked: false, fix: false }, 3000)).toBe(s1);
  });

  it("names the first milestone still to reach, in order", () => {
    let s = startGuide(0);
    expect(nextMilestone(s)).toBe("acked");
    s = observe(s, { acked: true, service: true }, 1);
    expect(nextMilestone(s)).toBe("monitoring");
    s = observe(s, Object.fromEntries(MILESTONES.map((m) => [m, true])), 2);
    expect(nextMilestone(s)).toBeNull();
  });

  it("is due only after the quiet spell, and once per milestone", () => {
    const s = observe(startGuide(0), { acked: true }, 0);
    expect(due(s, QUIET_MS - 1)).toBeNull();
    expect(due(s, QUIET_MS)).toBe("monitoring");
    const hinted = markHinted(s, "monitoring");
    expect(due(hinted, QUIET_MS * 10)).toBeNull();
    const moved = observe(hinted, { monitoring: true }, QUIET_MS * 10);
    expect(due(moved, QUIET_MS * 10)).toBeNull();
    expect(due(moved, QUIET_MS * 11)).toBe("service");
  });
});
