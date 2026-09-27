import { describe, expect, it } from "vitest";
import { formatBp, formatClock, formatMetric } from "./format";

describe("format", () => {
  it("formats ticks as mm:ss", () => {
    expect(formatClock(0)).toBe("00:00");
    expect(formatClock(615)).toBe("01:01");
    expect(formatClock(4800)).toBe("08:00");
  });

  it("formats basis points as a percentage with one decimal", () => {
    expect(formatBp(0)).toBe("0.0%");
    expect(formatBp(1834)).toBe("18.3%");
    expect(formatBp(12000)).toBe("120.0%");
  });

  it("formats metric values by magnitude", () => {
    expect(formatMetric(3.14159)).toBe("3.1");
    expect(formatMetric(97.6)).toBe("97.6");
    expect(formatMetric(2143.7)).toBe("2144");
  });
});
