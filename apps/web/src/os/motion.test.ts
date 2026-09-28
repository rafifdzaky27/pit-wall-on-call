import { afterEach, describe, expect, it, vi } from "vitest";
import { animate, DUR, EASE_OUT, motionAllowed } from "./motion";

function animatable() {
  const el = document.createElement("div");
  const spy = vi.fn(() => ({ finished: Promise.resolve() }));
  Object.assign(el, { animate: spy });
  return { el, spy };
}

afterEach(() => {
  delete document.documentElement.dataset.motion;
  vi.unstubAllGlobals();
});

describe("motion", () => {
  it("does nothing where the browser cannot animate (jsdom), so callers finish at once", () => {
    expect(animate(document.createElement("div"), [{ opacity: 0 }], { duration: DUR.fast })).toBeNull();
  });

  it("runs the animation with the given timing when motion is allowed", async () => {
    const { el, spy } = animatable();
    const done = animate(el, [{ opacity: 0 }, { opacity: 1 }], { duration: DUR.base, easing: EASE_OUT });
    expect(done).not.toBeNull();
    await done;
    expect(spy).toHaveBeenCalledWith([{ opacity: 0 }, { opacity: 1 }], { duration: 180, easing: EASE_OUT });
  });

  it("honours Settings → Reduce motion and the system setting", () => {
    const { el, spy } = animatable();
    document.documentElement.dataset.motion = "reduce";
    expect(animate(el, [{ opacity: 0 }], { duration: 10 })).toBeNull();
    delete document.documentElement.dataset.motion;
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("reduce") }));
    expect(motionAllowed()).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });
});
