import { describe, expect, it } from "vitest";
import { DAILY_EPOCH, DAY_MS, dailyFor, dailyNumber, dayStartMs, isDailyDate, ROTATION_FROM, utcDate } from "./daily";
import type { Family, Incident } from "./kit/incident";
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

describe("the daily rotation (M4 spec N2)", () => {
  const fake = (id: string, family: Family, difficulty: 1 | 2 | 3 | 4 | 5, keys = ["", "b"], from = ROTATION_FROM): Incident =>
    ({ id, title: id, family, difficulty, from, variants: keys.map((key) => ({ key, scenario: { id: key ? `${id}:${key}` : id }, desktop: {}, golden: {} })) }) as unknown as Incident;
  const catalogue: Incident[] = [
    fake("disk", "capacity", 2),
    fake("cert", "dependencies", 2),
    fake("regex", "deploys", 3),
    fake("stampede", "caching", 3),
    fake("storm", "dependencies", 4),
    fake("lag", "data", 4),
    fake("pill", "queues", 5),
  ];
  const familyOf = (scenarioId: string) => catalogue.find((c) => scenarioId === c.id || scenarioId.startsWith(`${c.id}:`))!;
  const days = (from: string, n: number) => Array.from({ length: n }, (_, i) => utcDate(dayStartMs(from) + i * DAY_MS));

  it("keeps every date before the rotation exactly as M3 chose it (Daily #1 and #2 are live)", () => {
    for (const date of ["2026-09-29", "2026-09-30"]) {
      expect(dailyFor(date, catalogue).scenarioId).toBe("db-pool-exhaustion");
      expect(dailyFor(date, catalogue).seed).toBe(dailyFor(date).seed);
    }
  });

  it("never picks the same family two days running", () => {
    const picks = days(ROTATION_FROM, 120).map((d) => familyOf(dailyFor(d, catalogue).scenarioId).family);
    for (let i = 1; i < picks.length; i++) expect(picks[i], `day ${i}`).not.toBe(picks[i - 1]);
  });

  it("gets harder through the week: Mondays are easy, Sundays hardest", () => {
    const all = days(ROTATION_FROM, 84);
    // 1970-01-01 was a Thursday, so the weekday is (day index + 4) mod 7, 0 for Sunday.
    const weekday = (d: string) => (dayStartMs(d) / DAY_MS + 4) % 7;
    const mean = (w: number) => {
      const ds = all.filter((d) => weekday(d) === w).map((d) => familyOf(dailyFor(d, catalogue).scenarioId).difficulty);
      return ds.reduce((a, b) => a + b, 0) / ds.length;
    };
    expect(mean(1)).toBeLessThan(mean(5));
    expect(mean(5)).toBeLessThanOrEqual(mean(0));
  });

  it("adding an incident never changes a day already picked (review 1)", () => {
    const window = days(ROTATION_FROM, 40);
    const before = window.map((d) => dailyFor(d, catalogue).scenarioId);
    // Shipped on day 30, joining the rotation from day 31.
    const joined = [...catalogue, fake("dns", "network", 3, [""], window[31]!)];
    const after = window.map((d) => dailyFor(d, joined).scenarioId);
    expect(after.slice(0, 31)).toEqual(before.slice(0, 31));
  });

  it("stays cheap and sane for a clock far in the future (review 2)", () => {
    const started = performance.now();
    expect(dailyFor("9999-12-31", catalogue).scenarioId).toBe("db-pool-exhaustion");
    expect(performance.now() - started).toBeLessThan(200);
  });

  it("is the same answer every time, and uses every incident over a quarter", () => {
    const quarter = days(ROTATION_FROM, 91);
    const first = quarter.map((d) => dailyFor(d, catalogue).scenarioId);
    expect(quarter.map((d) => dailyFor(d, catalogue).scenarioId)).toEqual(first);
    expect(new Set(first.map((id) => familyOf(id).id)).size).toBe(catalogue.length);
  });
});
