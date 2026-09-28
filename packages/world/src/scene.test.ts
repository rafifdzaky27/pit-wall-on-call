import { describe, expect, it } from "vitest";
import { CAFE, CAFE_SIGNS, CITIES, closeState, paletteFor, resolveScene, resolveWorld } from "./index";

describe("resolveScene", () => {
  it("is deterministic per seed and follows the world's city", () => {
    for (let seed = 1; seed <= 50; seed++) {
      expect(resolveScene(seed)).toEqual(resolveScene(seed));
      expect(resolveScene(seed).city).toBe(resolveWorld(seed).city.id);
    }
  });

  it("reaches every time of day, weather and patron arrangement", () => {
    const times = new Set<string>();
    const weathers = new Set<string>();
    const patrons = new Set<number>();
    for (let seed = 1; seed <= 400; seed++) {
      const s = resolveScene(seed);
      times.add(s.time);
      weathers.add(s.weather);
      patrons.add(s.patrons);
    }
    expect([...times].sort()).toEqual(["afternoon", "dusk", "morning", "night"]);
    expect([...weathers].sort()).toEqual(["clear", "overcast", "rain"]);
    expect([...patrons].sort()).toEqual([0, 1, 2]);
  });

  it("a late cold close is a clear night", () => {
    const s = resolveScene(7, "late");
    expect(s.time).toBe("night");
    expect(s.weather).toBe("clear");
    expect(s.palette).toEqual(paletteFor("night", "clear"));
  });
});

describe("palettes", () => {
  it("lamps glow brighter at night than in the morning", () => {
    expect(paletteFor("night", "clear").lampGlow).toBeGreaterThan(paletteFor("morning", "clear").lampGlow);
  });

  it("clouds and rain grey the sky", () => {
    const clear = paletteFor("afternoon", "clear");
    expect(paletteFor("afternoon", "overcast").skyTop).not.toBe(clear.skyTop);
    expect(paletteFor("afternoon", "rain").street).not.toBe(clear.street);
    for (const p of [clear, paletteFor("dusk", "rain")]) for (const c of [p.skyTop, p.skyBottom, p.street, p.wall]) expect(c).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe("closeState", () => {
  it("changes at 3 and 8 minutes", () => {
    expect(closeState(1799)).toBe("steaming");
    expect(closeState(1800)).toBe("cooled");
    expect(closeState(4799)).toBe("cooled");
    expect(closeState(4800)).toBe("late");
  });
});

describe("the café", () => {
  it("has a sign, menu, street prop and skyline for every city", () => {
    for (const city of CITIES) {
      const sign = CAFE_SIGNS[city.id];
      expect(sign.name.length).toBeGreaterThan(0);
      expect(sign.menu.length).toBe(3);
      expect(sign.skyline.length).toBeGreaterThanOrEqual(5);
      for (const [x, w, h] of sign.skyline) expect(x >= 80 && x + w <= 760 && h > 0).toBe(true);
    }
  });

  it("names its hotspots", () => {
    expect(CAFE.hotspots).toContain("table.neighbours");
    expect(CAFE.hotspots).toContain("wall.poster");
  });
});
