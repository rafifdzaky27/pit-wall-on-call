import { describe, expect, it } from "vitest";
import { MetricHistory } from "./history";

describe("MetricHistory", () => {
  it("records at most one sample per game second", () => {
    const h = new MetricHistory();
    h.record(0, { a: 1 });
    h.record(5, { a: 2 });
    h.record(10, { a: 3 });
    expect(h.snapshot()).toEqual({ a: [1, 3] });
  });

  it("keeps only the newest samples", () => {
    const h = new MetricHistory(3);
    for (let s = 0; s < 5; s++) h.record(s * 10, { a: s });
    expect(h.snapshot().a).toEqual([2, 3, 4]);
  });

  it("returns copies", () => {
    const h = new MetricHistory();
    h.record(0, { a: 1 });
    h.snapshot().a!.push(99);
    expect(h.snapshot().a).toEqual([1]);
  });

  it("prefills a calm baseline so a sparkline starts as a line, not a dot", () => {
    const h = new MetricHistory(120);
    h.prefill({ a: 100, zero: 0 });
    h.record(0, { a: 100, zero: 0 });
    const { a, zero } = h.snapshot();
    expect(a).toHaveLength(120);
    expect(a!.every((v) => v >= 98 && v <= 102)).toBe(true);
    expect(new Set(a).size).toBeGreaterThan(10);
    expect(zero!.every((v) => v === 0)).toBe(true);
    const again = new MetricHistory(120);
    again.prefill({ a: 100, zero: 0 });
    again.record(0, { a: 100, zero: 0 });
    expect(again.snapshot()).toEqual(h.snapshot());
  });
});
