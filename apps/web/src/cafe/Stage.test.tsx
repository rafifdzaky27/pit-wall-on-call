import { act, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { Desktop } from "../os/shell/Desktop";
import { renderOs } from "../os/testing";
import { motionGate } from "../game/motionGate";
import { laptopFit, zoomOrigin } from "./camera";
import { loadCafe, Stage } from "./Stage";

// The café chunk is in, as after the desktop's idle warm-up: a pull-back never waits on it here (StageCold covers that).
beforeAll(() => loadCafe());

afterEach(() => {
  cleanup();
  Object.assign(window, { innerWidth: 1024, innerHeight: 768 });
});

const screenEl = () => document.querySelector<HTMLElement>("[data-testid=stage-screen]")!;
const cafeEl = () => document.querySelector<HTMLElement>(".stage-cafe");
const press = (key: string) => fireEvent.keyDown(window, { key });

describe("Stage", () => {
  it("shows PitOS full size until Start shift, then shrinks it into the laptop, out of reach", () => {
    const { incident } = renderOs(
      <Stage>
        <p>laptop screen</p>
      </Stage>,
    );
    expect(cafeEl()).toBeNull();
    expect(screenEl().hasAttribute("inert")).toBe(false);
    expect(screenEl().style.transform).toBe("");
    act(() => incident().start());
    expect(screenEl().hasAttribute("inert")).toBe(true);
    const { x, y, k } = laptopFit(window.innerWidth, window.innerHeight);
    expect(screenEl().style.transform).toBe(`translate(${x}px, ${y}px) scale(${k})`);
    expect(screen.getByRole("region", { name: "Café" })).toBeTruthy();
  });

  it("L toggles between the café and the laptop, and ends where the last press left it", () => {
    const { incident } = renderOs(
      <Stage>
        <p>laptop screen</p>
      </Stage>,
    );
    act(() => incident().start());
    press("l");
    press("l");
    press("l");
    expect(screenEl().hasAttribute("inert")).toBe(false);
    expect(screenEl().style.transform).toBe("");
    expect(document.querySelector<HTMLElement>(".stage-world")!.style.transform).toBe("");
    // Out of sight but never display: none, so looking up again does not lay out and paint the art from scratch (the L flicker).
    expect(cafeEl()!.hidden).toBe(false);
    expect(cafeEl()!.classList.contains("off")).toBe(true);
    expect(cafeEl()!.hasAttribute("inert")).toBe(true);
    press("l");
    expect(cafeEl()!.classList.contains("off")).toBe(false);
  });

  it("after looking up, keyboard focus is on the laptop, ready to go back down", async () => {
    const { incident } = renderOs(
      <Stage>
        <button type="button">inside PitOS</button>
      </Stage>,
    );
    act(() => incident().start());
    press("l");
    press("l");
    await waitFor(() => expect(document.activeElement?.getAttribute("data-hotspot")).toBe("laptop"));
  });

  it("after zooming into the laptop, focus lands inside the focused window", () => {
    const { incident } = renderOs(
      <Stage>
        <section className="window focused">
          <button type="button">inside PitOS</button>
        </section>
      </Stage>,
    );
    act(() => incident().start());
    press("l");
    expect(document.activeElement?.textContent).toBe("inside PitOS");
  });

  it("ignores L when single-key shortcuts are off", () => {
    const { incident } = renderOs(
      <Stage>
        <p>laptop screen</p>
      </Stage>,
      { prefs: { singleKeyShortcuts: false } },
    );
    act(() => incident().start());
    press("l");
    expect(screenEl().hasAttribute("inert")).toBe(true);
  });

  it("keeps the desktop inside the laptop when the window is resized", () => {
    const { incident } = renderOs(
      <Stage>
        <p>laptop screen</p>
      </Stage>,
    );
    act(() => incident().start());
    act(() => {
      Object.assign(window, { innerWidth: 1366, innerHeight: 657 });
      window.dispatchEvent(new Event("resize"));
    });
    const { x, y, k } = laptopFit(1366, 657);
    expect(screenEl().style.transform).toBe(`translate(${x}px, ${y}px) scale(${k})`);
  });

  it("in the café, only A and P reach the desktop; the overview stays shut", () => {
    const { incident } = renderOs(
      <Stage>
        <Desktop />
      </Stage>,
    );
    act(() => incident().start());
    act(() => incident().skipPrepage());
    press("o");
    expect(screen.queryByRole("dialog", { name: "Overview" })).toBeNull();
    press("p");
    expect(screen.getByRole("dialog", { name: "Paused" }).closest("[data-testid=stage-screen]")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Resume/ }));
    press("a");
    expect(incident().phase).toBe("active");
    expect(screenEl().hasAttribute("inert")).toBe(false);
  });

  it("a camera move that cannot animate never leaves the desktop frozen (M2.5 review)", () => {
    const { incident } = renderOs(
      <Stage>
        <p>laptop screen</p>
      </Stage>,
    );
    act(() => incident().start());
    press("l");
    // As if a zoom-in were cut short mid-move, with the gate still closed.
    motionGate.set(true);
    press("l");
    expect(motionGate.moving).toBe(false);
  });

  it("every move, on L and on a new shift, is a pure zoom about the laptop: never a swing across the street (M2.5 follow-up)", () => {
    const calls: { keyframes: Keyframe[]; origin: string }[] = [];
    const animate = vi.fn(function (this: HTMLElement, keyframes: Keyframe[]) {
      calls.push({ keyframes, origin: this.style.transformOrigin });
      return { finished: new Promise(() => undefined), cancel: () => undefined } as unknown as Animation;
    });
    Object.assign(HTMLElement.prototype, { animate });
    try {
      const { incident } = renderOs(
        <Stage>
          <p>laptop screen</p>
        </Stage>,
      );
      act(() => incident().start());
      press("l");
      press("l");
      const o = zoomOrigin(laptopFit(window.innerWidth, window.innerHeight));
      expect(calls.length).toBeGreaterThanOrEqual(2);
      for (const c of calls) {
        expect(c.origin).toBe(`${o.x}px ${o.y}px`);
        for (const f of c.keyframes) expect(String(f.transform)).toMatch(/^scale\([\d.e-]+\)$/);
      }
    } finally {
      delete (HTMLElement.prototype as { animate?: unknown }).animate;
    }
  });
});
