import { slowLeak } from "@pitwall/scenarios";
import { CITIES, resolveScene, resolveWorld } from "@pitwall/world";
import { cleanup, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import CafeScene from "./CafeScene";

const cafeCss = readFileSync(resolve(__dirname, "cafe.css"), "utf8");

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

describe("the café's art (M2.5 spec §12)", () => {
  it("is dense: 40 or more distinct props in every city, across all four depth layers", () => {
    for (const city of CITIES) {
      const seed = seedWhere((s) => s.city === city.id);
      const { container } = scene(seed);
      const names = (sel: string) => new Set([...container.querySelectorAll(`${sel}[data-prop]`)].map((e) => e.getAttribute("data-prop")));
      expect(names("").size, city.id).toBeGreaterThanOrEqual(40);
      for (const layer of ["street", "walls", "counter", "room"]) expect(names(`[data-layer="${layer}"] `).size, `${city.id} ${layer}`).toBeGreaterThanOrEqual(5);
      cleanup();
    }
  });

  it("puts the player's things on the table, the rubber duck among them", () => {
    const { container } = scene(1);
    for (const prop of ["laptop", "keyboard", "trackpad", "phone", "latte", "notebook", "earbuds", "rubber-duck"])
      expect(container.querySelector(`[data-layer="room"] [data-prop="${prop}"]`), prop).not.toBeNull();
  });

  it("the phone's island expands into a live pager activity only while it rings", () => {
    const quiet = scene(1, { clock: "00:12" });
    expect(quiet.container.querySelector(".phone .island")).not.toBeNull();
    expect(quiet.container.querySelector(".phone .island.live")).toBeNull();
    cleanup();
    const ringing = scene(1, { ringing: true, clock: "00:12" });
    expect(ringing.container.querySelector(".phone .island.live")?.textContent).toBe("SEV2 · Checkout 5xx · 00:12");
  });

  it("the days-since-last-incident sign resets to 0 when the page fires", () => {
    const before = scene(1);
    const days = Number(before.container.querySelector('[data-prop="days-since"] .days')!.textContent);
    expect(days).toBeGreaterThan(0);
    cleanup();
    const after = scene(1, { paged: true });
    expect(after.container.querySelector('[data-prop="days-since"] .days')!.textContent).toBe("0");
  });

  it("hides its easter eggs in the art: the sticker, the force push, HUG OPS, the cat and the clock at 3", () => {
    const { container } = scene(1);
    expect(container.querySelector('[data-prop="sticker-works-on-my-machine"]')!.textContent).toMatch(/works on my machine/i);
    expect(container.querySelector('[data-prop="patron-force-push"]')!.textContent).toContain("git push --force");
    expect(container.querySelector('[data-prop="hug-ops"]')!.textContent).toMatch(/HUG OPS/);
    expect(container.querySelector('[data-prop="clock-3am"]')).not.toBeNull();
    expect(container.querySelector('[data-prop="cafe-cat"]')).not.toBeNull();
  });
});

describe("café motion (M2.5 spec §12)", () => {
  const noFrames = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "").replace(/@keyframes[^{]*\{(?:[^{}]*\{[^{}]*\})*\s*\}/g, "");
  const rules = (css: string) => [...noFrames(css).matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ sel: m[1]!.trim(), body: m[2]! }));

  it("animates only transform and opacity", () => {
    const frames = [...cafeCss.matchAll(/@keyframes\s+([\w-]+)\s*\{((?:[^{}]*\{[^{}]*\})*)\s*\}/g)];
    expect(frames.length).toBeGreaterThan(5);
    for (const [, name, body] of frames) for (const [, p] of body!.matchAll(/([\w-]+)\s*:/g)) expect(["transform", "opacity"], `${name}: ${p}`).toContain(p);
  });

  it("holds everything still while paused and under reduced motion, both ways of asking", () => {
    const all = rules(cafeCss);
    expect(all.some((r) => r.sel.includes(".cafe.paused *") && /animation-play-state:\s*paused/.test(r.body))).toBe(true);
    expect(all.some((r) => r.sel.includes('[data-motion="reduce"] .cafe *') && /animation:\s*none/.test(r.body))).toBe(true);
    expect(cafeCss).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{[^}]*\.cafe \*[^}]*animation:\s*none/);
  });

  it("gives transform-box only to the animated loops, never to every group (M1.6 lesson)", () => {
    for (const r of rules(cafeCss)) if (/transform-box/.test(r.body)) for (const sel of r.sel.split(",")) expect(sel.trim(), sel).not.toMatch(/(\*|^g$|^svg$|^\.cafe$|\bg$)/);
  });
});
