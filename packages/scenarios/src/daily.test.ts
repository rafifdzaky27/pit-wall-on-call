import { describe, expect, it } from "vitest";
import { DAILY_EPOCH, DAY_MS, dailyFor, dailyNumber, dayStartMs, isDailyDate, utcDate } from "./daily";
import { SCENARIOS } from "./index";

describe("the daily incident (M3 spec Y1, Y2)", () => {
  it("counts days from the epoch, which is Daily #1", () => {
    expect(dailyNumber(DAILY_EPOCH)).toBe(1);
    expect(dailyNumber("2026-09-30")).toBe(2);
    // Across a month boundary.
    expect(dailyNumber("2026-10-01")).toBe(3);
    expect(dailyNumber("2027-09-29")).toBe(366);
  });

  it("is the same for everyone on a date, and differs from day to day", () => {
    expect(dailyFor("2026-10-05")).toEqual(dailyFor("2026-10-05"));
    const seeds = new Set(Array.from({ length: 60 }, (_, i) => dailyFor(utcDate(dayStartMs(DAILY_EPOCH) + i * DAY_MS)).seed));
    expect(seeds.size).toBe(60);
    const d = dailyFor("2026-10-05");
    expect(d).toMatchObject({ date: "2026-10-05", number: 7 });
    expect(Number.isInteger(d.seed) && d.seed >= 0 && d.seed < 2 ** 32).toBe(true);
  });

  it("never picks the training shift", () => {
    const training = SCENARIOS.filter((s) => s.training).map((s) => s.id);
    for (let i = 0; i < 400; i++) expect(training).not.toContain(dailyFor(utcDate(dayStartMs(DAILY_EPOCH) + i * DAY_MS)).scenarioId);
  });

  it("rolls over at 00:00 UTC", () => {
    // Epoch milliseconds from Date.UTC, checked once by hand: the calendar math agrees with it.
    expect(utcDate(1790899200000 - 1)).toBe("2026-10-01");
    expect(utcDate(1790899200000)).toBe("2026-10-02");
    expect(dayStartMs("2026-10-02")).toBe(1790899200000);
    expect(utcDate(951782400000)).toBe("2000-02-29");
    expect(utcDate(946684799999)).toBe("1999-12-31");
  });

  it("knows a date when it sees one", () => {
    expect(isDailyDate("2026-10-02")).toBe(true);
    for (const bad of ["2026-13-01", "2026-02-30", "26-10-02", "2026-10-2", "", "2026-10-02T00:00"]) expect(isDailyDate(bad), bad).toBe(false);
  });
});
