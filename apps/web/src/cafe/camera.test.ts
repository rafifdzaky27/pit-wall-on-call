import { describe, expect, it } from "vitest";
import { cameraReducer, INITIAL_CAMERA, laptopFit, SCENE, sceneFit, toViewport, type Camera } from "./camera";

const run = (events: Parameters<typeof cameraReducer>[1][], from: Camera = INITIAL_CAMERA) => events.reduce(cameraReducer, from);

describe("cameraReducer", () => {
  it("starts on the desktop, and Start shift pulls back to the café", () => {
    expect(INITIAL_CAMERA).toEqual({ view: "desktop", started: false, closing: false });
    expect(run([{ type: "phase", to: "prepage" }])).toEqual({ view: "cafe", started: true, closing: false });
  });

  it("looks up only after the shift started, and enters the laptop from the café", () => {
    expect(run([{ type: "lookUp" }])).toEqual(INITIAL_CAMERA);
    const cafe = run([{ type: "phase", to: "prepage" }]);
    expect(run([{ type: "enterLaptop" }], cafe).view).toBe("desktop");
    expect(run([{ type: "enterLaptop" }, { type: "lookUp" }], cafe).view).toBe("cafe");
  });

  it("stays where it is when the page fires, and goes into the laptop on the ack (spec C10)", () => {
    const inside = run([{ type: "phase", to: "prepage" }, { type: "enterLaptop" }, { type: "phase", to: "paging" }]);
    expect(inside.view).toBe("desktop");
    const outside = run([{ type: "phase", to: "prepage" }, { type: "phase", to: "paging" }]);
    expect(outside.view).toBe("cafe");
    expect(run([{ type: "phase", to: "active" }], outside).view).toBe("desktop");
  });

  it("pulls back for the cold close, and the laptop ends it", () => {
    const closing = run([{ type: "phase", to: "prepage" }, { type: "phase", to: "active" }, { type: "phase", to: "ended" }]);
    expect(closing).toEqual({ view: "cafe", started: true, closing: true });
    expect(run([{ type: "enterLaptop" }], closing)).toEqual({ view: "desktop", started: true, closing: false });
    expect(run([{ type: "phase", to: "idle" }], closing)).toEqual(INITIAL_CAMERA);
  });
});

describe("scene geometry", () => {
  it("covers the viewport with the 1600×900 scene, cropping the long side", () => {
    expect(sceneFit(1440, 900)).toEqual({ s: 1, ox: -80, oy: 0 });
    const small = sceneFit(1366, 657);
    expect(small.s).toBeCloseTo(0.85375);
    expect(small.ox).toBe(0);
    expect(small.oy).toBeCloseTo(-55.69, 1);
  });

  it("maps scene rectangles into the viewport", () => {
    expect(toViewport(SCENE.screen, 1440, 900)).toEqual({ x: 530, y: 470, w: 380, h: 238 });
  });

  it("fits the whole desktop inside the laptop screen, centred, at every common size", () => {
    for (const [vw, vh] of [
      [1024, 768],
      [1366, 657],
      [1440, 900],
      [1920, 1080],
      [2560, 1080],
    ] as const) {
      const r = toViewport(SCENE.screen, vw, vh);
      const { x, y, k } = laptopFit(vw, vh);
      const [w, h] = [vw * k, vh * k];
      expect(x).toBeGreaterThanOrEqual(r.x - 1);
      expect(y).toBeGreaterThanOrEqual(r.y - 1);
      expect(x + w).toBeLessThanOrEqual(r.x + r.w + 1);
      expect(y + h).toBeLessThanOrEqual(r.y + r.h + 1);
      expect(Math.abs(x + w / 2 - (r.x + r.w / 2))).toBeLessThan(1);
      expect(Math.abs(y + h / 2 - (r.y + r.h / 2))).toBeLessThan(1);
    }
  });
});
