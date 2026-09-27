import { describe, expect, it } from "vitest";
import { ACK } from "./constants";
import { pickLesson } from "./lessons";
import { replay } from "./replay";
import { fixture } from "./testing/fixture";

describe("pickLesson", () => {
  it("returns the first lesson whose condition matches", () => {
    expect(pickLesson(fixture, replay(fixture, 1, [])).id).toBe("dnf");
    const fixed = replay(fixture, 1, [{ tick: 0, actionId: ACK }, { tick: 0, actionId: "svc.fix" }]);
    expect(pickLesson(fixture, fixed).id).toBe("default");
  });

  it("throws when no lesson matches, so a missing catch-all is caught in tests", () => {
    const noCatchAll = { ...fixture, lessons: [fixture.lessons[0]!] };
    const fixed = replay(fixture, 1, [{ tick: 0, actionId: ACK }, { tick: 0, actionId: "svc.fix" }]);
    expect(() => pickLesson(noCatchAll, fixed)).toThrow(/no lesson/);
  });
});
