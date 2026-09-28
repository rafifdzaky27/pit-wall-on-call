import { describe, expect, it } from "vitest";
import { CITIES, fillWorld, formatPrice, resolveWorld, STORE_COPY } from "./index";

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
  it.each(CITIES.map((c) => [c.id, c] as const))("%s is complete", (id, city) => {
    const { brand } = city;
    expect(brand.products.length).toBeGreaterThanOrEqual(3);
    expect(brand.domain).toMatch(/^[a-z0-9-]+(\.[a-z]{2,})+$/);
    expect(Object.values(city.colleagues).every((n) => n.length > 0)).toBe(true);
    expect(() => new Intl.DateTimeFormat("en", { timeZone: city.timeZone })).not.toThrow();
    expect(STORE_COPY[brand.locale]).toBeDefined();
    expect(brand.categories.length).toBeGreaterThanOrEqual(3);
    expect(brand.banner.image).toBe(`${id}-banner`);
    for (const p of brand.products) {
      expect(Number.isInteger(p.price) && p.price > 0).toBe(true);
      if (p.was !== undefined) expect(p.was).toBeGreaterThan(p.price);
      expect(p.image.startsWith(`${id}-`)).toBe(true);
      expect(p.rating).toBeGreaterThanOrEqual(1);
      expect(p.rating).toBeLessThanOrEqual(5);
      expect(Number.isInteger(p.sold)).toBe(true);
    }
  });
});

describe("store copy", () => {
  it("formats ratings and sales the way each market does", () => {
    expect(STORE_COPY["id-ID"].rating(4.8, 2100)).toBe("★ 4,8 · 2,1 rb terjual");
    expect(STORE_COPY["id-ID"].rating(5, 96)).toBe("★ 5,0 · 96 terjual");
    expect(STORE_COPY["id-ID"].rating(4.9, 12000)).toBe("★ 4,9 · 12 rb terjual");
    expect(STORE_COPY["ja-JP"].rating(4.8, 1204)).toBe("★4.8（1,204件）");
    expect(STORE_COPY["en-AU"].rating(4.7, 312)).toBe("★ 4.7 (312 reviews)");
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
    const text = fillWorld("{deployer} and {secondary} at {brand} ({domain}); {infra}, {support}, {nope}", world);
    expect(text).toBe(
      `${world.colleagues.deployer} and ${world.colleagues.secondary} at ${world.brand.name} (${world.brand.domain}); ${world.colleagues.infra}, ${world.colleagues.support}, {nope}`,
    );
  });
});
