import { describe, expect, it } from "vitest";
import { monthGrid } from "./calendar";

describe("monthGrid", () => {
  it("lays out September 2026 Monday first, padded to whole weeks", () => {
    const weeks = monthGrid(new Date(2026, 8, 28));
    expect(weeks).toHaveLength(5);
    expect(weeks[0]).toEqual([null, 1, 2, 3, 4, 5, 6]);
    expect(weeks[4]).toEqual([28, 29, 30, null, null, null, null]);
  });

  it("handles a month that starts on a Monday and February in a leap year", () => {
    expect(monthGrid(new Date(2026, 5, 10))[0]![0]).toBe(1);
    expect(monthGrid(new Date(2028, 1, 1)).flat().filter(Boolean)).toHaveLength(29);
  });
});
