import { act, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Desktop } from "../os/shell/Desktop";
import { renderOs } from "../os/testing";
import { laptopFit } from "./camera";
import { Stage } from "./Stage";

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
    expect(cafeEl()!.hidden).toBe(true);
    expect(cafeEl()!.hasAttribute("inert")).toBe(true);
    press("l");
    expect(cafeEl()!.hidden).toBe(false);
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
});
