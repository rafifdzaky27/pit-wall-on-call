import { describe, expect, it } from "vitest";
import { sceneTime } from "./time";

const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));

describe("the café clocks (M2.5 PR C review 1)", () => {
  it("start in the painted hour and only ever move forward, rolling the hour over", () => {
    // 21:58:30 in Jakarta (UTC+7), a scene painted at night (22:xx).
    const anchor = Date.UTC(2026, 8, 29, 14, 58, 30);
    const at = (ms: number) => sceneTime(new Date(anchor + ms), "Asia/Jakarta", "night", anchor);
    expect(at(0)).toBe("22:58");
    let prev = toMin(at(0));
    for (let s = 60; s <= 3 * 60 * 60; s += 60) {
      const t = toMin(at(s * 1000));
      expect(t === prev || t === prev + 1 || (prev === 1439 && t === 0), `at +${s}s`).toBe(true);
      prev = t;
    }
    expect(at(90 * 1000)).toBe("23:00");
    expect(at(62 * 60 * 1000)).toBe("00:00");
  });
});
