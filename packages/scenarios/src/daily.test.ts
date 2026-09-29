import { describe, expect, it } from "vitest";
import { DAILY_EPOCH, dailyFor, dailyNumber, isDailyDate, utcDate } from "./daily";
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
    const seeds = new Set(Array.from({ length: 60 }, (_, i) => dailyFor(utcDate(Date.UTC(2026, 8, 29) + i * 86_400_000)).seed));
    expect(seeds.size).toBe(60);
    const d = dailyFor("2026-10-05");
    expect(d).toMatchObject({ date: "2026-10-05", number: 7 });
    expect(Number.isInteger(d.seed) && d.seed >= 0 && d.seed < 2 ** 32).toBe(true);
  });

  it("never picks the training shift", () => {
    const training = SCENARIOS.filter((s) => s.training).map((s) => s.id);
    for (let i = 0; i < 400; i++) expect(training).not.toContain(dailyFor(utcDate(Date.UTC(2026, 8, 29) + i * 86_400_000)).scenarioId);
  });

  it("rolls over at 00:00 UTC", () => {
    expect(utcDate(Date.UTC(2026, 9, 1, 23, 59, 59, 999))).toBe("2026-10-01");
    expect(utcDate(Date.UTC(2026, 9, 2, 0, 0, 0, 0))).toBe("2026-10-02");
  });

  it("knows a date when it sees one", () => {
    expect(isDailyDate("2026-10-02")).toBe(true);
    for (const bad of ["2026-13-01", "2026-02-30", "26-10-02", "2026-10-2", "", "2026-10-02T00:00"]) expect(isDailyDate(bad), bad).toBe(false);
  });
});
