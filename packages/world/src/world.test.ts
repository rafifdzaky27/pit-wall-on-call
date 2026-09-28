import { describe, expect, it } from "vitest";
import { CITIES, fillWorld, formatPrice, resolveWorld } from "./index";

describe("resolveWorld", () => {
  it("is deterministic per seed", () => {
    expect(resolveWorld(42)).toEqual(resolveWorld(42));
  });

  it("reaches every city across seeds", () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 200; seed++) seen.add(resolveWorld(seed).city.id);
    expect([...seen].sort()).toEqual(["jakarta", "melbourne", "tokyo", "yogyakarta"]);
  });

  it("handles seeds across the whole uint32 range", () => {
    expect(resolveWorld(0xffffffff).city).toBeDefined();
    expect(resolveWorld(0).city).toBeDefined();
  });
});

describe("city data", () => {
  it.each(CITIES.map((c) => [c.id, c] as const))("%s is complete", (_id, city) => {
    expect(city.brand.products.length).toBeGreaterThanOrEqual(3);
    expect(city.brand.domain).toMatch(/^[a-z0-9-]+(\.[a-z]{2,})+$/);
    expect(Object.values(city.colleagues).every((n) => n.length > 0)).toBe(true);
    expect(() => new Intl.DateTimeFormat("en", { timeZone: city.timeZone })).not.toThrow();
    for (const p of city.brand.products) expect(Number.isInteger(p.price) && p.price > 0).toBe(true);
  });
});

describe("formatPrice", () => {
  it("formats rupiah, yen and Australian dollars the local way", () => {
    expect(formatPrice(89000, "IDR")).toBe("Rp89.000");
    expect(formatPrice(1234567, "IDR")).toBe("Rp1.234.567");
    expect(formatPrice(12800, "JPY")).toBe("¥12,800");
    expect(formatPrice(3950, "AUD")).toBe("$39.50");
    expect(formatPrice(123405, "AUD")).toBe("$1,234.05");
  });
});

describe("fillWorld", () => {
  it("fills brand and colleague tokens, and leaves unknown tokens alone", () => {
    const world = resolveWorld(1);
    const text = fillWorld("{deployer} and {secondary} at {brand}; {infra}, {support}, {nope}", world);
    expect(text).toBe(
      `${world.colleagues.deployer} and ${world.colleagues.secondary} at ${world.brand.name}; ${world.colleagues.infra}, ${world.colleagues.support}, {nope}`,
    );
  });
});
