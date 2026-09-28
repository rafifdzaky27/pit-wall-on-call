import { slowLeak } from "@pitwall/scenarios";
import { CITIES, resolveScene, resolveWorld } from "@pitwall/world";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import CafeScene from "./CafeScene";

afterEach(cleanup);

/** The first seed whose café matches, so each test states the room it needs. */
function seedWhere(pred: (s: ReturnType<typeof resolveScene>) => boolean): number {
  for (let seed = 1; seed < 2000; seed++) if (pred(resolveScene(seed))) return seed;
  throw new Error("no seed matches");
}

const scene = (seed: number, props: Partial<Parameters<typeof CafeScene>[0]> = {}) =>
  render(<CafeScene seed={seed} close={null} ringing={false} page={slowLeak.coldOpen.page} radioOn={false} paused={false} {...props} />);

describe("CafeScene", () => {
  it("describes the room in words: city, time of day and weather", () => {
    const seed = seedWhere((s) => s.time === "dusk" && s.weather === "rain");
    scene(seed);
    const city = resolveWorld(seed).city.name;
    expect(screen.getByRole("img", { name: `A café in ${city} at dusk, raining` })).toBeTruthy();
  });

  it("rains only when it is raining, and keeps particles under the cap", () => {
    const wet = scene(seedWhere((s) => s.weather === "rain"));
    const drops = wet.container.querySelectorAll(".rain-drop").length;
    expect(drops).toBeGreaterThan(0);
    expect(drops).toBeLessThanOrEqual(90);
    expect(wet.container.querySelectorAll(".particle").length).toBeLessThanOrEqual(300);
    cleanup();
    const dry = scene(seedWhere((s) => s.weather === "clear"));
    expect(dry.container.querySelectorAll(".rain-drop")).toHaveLength(0);
  });

  it("paints the café's sign on the glass, mirrored, in the city's language", () => {
    const seed = seedWhere((s) => s.city === "tokyo");
    const { container } = scene(seed);
    const sign = container.querySelector(".glass-sign")!;
    expect(sign.textContent).toBe("喫茶 あかり");
    expect(sign.getAttribute("transform")).toContain("scale(-1");
  });

  it("the cup steams until the coffee has gone cold", () => {
    const hot = scene(1);
    expect(hot.container.querySelector(".cup-steam")).not.toBeNull();
    cleanup();
    const cold = scene(1, { close: "cooled" });
    expect(cold.container.querySelector(".cup-steam")).toBeNull();
  });

  it("a late close is a clear night with the next table gone", () => {
    const seed = seedWhere((s) => s.weather === "rain");
    const { container } = scene(seed, { close: "late" });
    expect(container.querySelectorAll(".rain-drop")).toHaveLength(0);
    expect(container.querySelector(".patron.at-table")).toBeNull();
    expect(screen.getByRole("img").getAttribute("aria-label")).toMatch(/at night$/);
  });

  it("lights the phone with the page only while it rings", () => {
    const quiet = scene(1);
    expect(quiet.container.textContent).not.toContain("Checkout returning 5xx");
    cleanup();
    const ringing = scene(1, { ringing: true });
    expect(ringing.container.textContent).toContain("Checkout returning 5xx");
    expect(ringing.container.querySelector(".phone.ringing")).not.toBeNull();
  });

  it("freezes while paused, and shows the radio's light while it plays", () => {
    const { container } = scene(1, { paused: true, radioOn: true });
    expect(container.querySelector(".cafe")!.classList.contains("paused")).toBe(true);
    expect(container.querySelector(".radio-led.on")).not.toBeNull();
  });

  it("draws a street prop for every city", () => {
    for (const city of CITIES) {
      const seed = seedWhere((s) => s.city === city.id);
      const { container } = scene(seed);
      expect(container.querySelector(`.prop-${resolveScene(seed).sign.prop}`), city.id).not.toBeNull();
      cleanup();
    }
  });
});
