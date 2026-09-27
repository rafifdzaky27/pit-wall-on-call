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
});
