import { describe, expect, it } from "vitest";
import { brandFor, fillBrand } from "./brand";

describe("brand", () => {
  it("picks a stable brand per seed", () => {
    expect(brandFor(4)).toBe(brandFor(4));
    expect(new Set([0, 1, 2].map(brandFor)).size).toBe(3);
  });

  it("handles seeds above 2^31", () => {
    expect(typeof brandFor(0xffffffff)).toBe("string");
  });

  it("fills every {brand} placeholder", () => {
    expect(fillBrand("{brand} sale at {brand}", "Northbound")).toBe("Northbound sale at Northbound");
  });
});
