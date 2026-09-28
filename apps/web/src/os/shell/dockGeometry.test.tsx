import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderOs } from "../testing";
import { Dock, HIDE_MS, REVEAL_MS } from "./Dock";
import { dockHidden, dockRect, overlaps } from "./dockGeometry";

describe("dock geometry", () => {
  const area = { w: 1280, h: 736 };
  const dock = dockRect(area, 400);

  it("sits at the bottom centre of the work area", () => {
    expect(dock).toEqual({ x: 440, y: 672, w: 400, h: 64 });
  });

  it("hides only when a window frame overlaps it", () => {
    expect(overlaps({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 10, h: 10 })).toBe(false);
    expect(dockHidden([{ x: 0, y: 0, w: 1280, h: 736 }], dock)).toBe(true);
    expect(dockHidden([{ x: 100, y: 40, w: 800, h: 500 }], dock)).toBe(false);
    expect(dockHidden([], dock)).toBe(false);
  });
});

describe("Dock", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  const nav = () => screen.getByRole("navigation", { name: "Dock" });

  it("stays visible over an empty desktop and hides under a maximized window", () => {
    const { os } = renderOs(<Dock unread={0} />);
    expect(nav().className).not.toContain("hidden");
    act(() => os().openApp("monitoring"));
    expect(nav().className).toContain("hidden");
  });

  it("reveals when the pointer rests on the bottom edge, and hides after it leaves", () => {
    const { os, container } = renderOs(<Dock unread={0} />);
    act(() => os().openApp("monitoring"));
    fireEvent.pointerEnter(container.querySelector(".dock-hotzone")!);
    act(() => vi.advanceTimersByTime(REVEAL_MS - 1));
    expect(nav().className).toContain("hidden");
    act(() => vi.advanceTimersByTime(1));
    expect(nav().className).not.toContain("hidden");
    fireEvent.pointerLeave(nav());
    act(() => vi.advanceTimersByTime(HIDE_MS));
    expect(nav().className).toContain("hidden");
    fireEvent.pointerEnter(container.querySelector(".dock-hotzone")!);
    act(() => vi.advanceTimersByTime(REVEAL_MS));
    fireEvent.pointerLeave(container.querySelector(".dock-hotzone")!);
    act(() => vi.advanceTimersByTime(HIDE_MS));
    expect(nav().className).toContain("hidden");
  });

  it("reveals for keyboard focus, in the overview, and while a window is dragged", () => {
    const { os } = renderOs(<Dock unread={0} />);
    act(() => os().openApp("monitoring"));
    const browser = screen.getByRole("button", { name: "Browser" });
    act(() => browser.focus());
    expect(nav().className).not.toContain("hidden");
    act(() => browser.blur());
    expect(nav().className).toContain("hidden");
    act(() => os().setDragging(true));
    expect(nav().className).not.toContain("hidden");
    act(() => os().setDragging(false));
    cleanup();
    const over = renderOs(<Dock unread={0} forceShow />);
    act(() => over.os().openApp("monitoring"));
    expect(nav().className).not.toContain("hidden");
  });

  it("reveals on a swipe up from the bottom edge", () => {
    const { os } = renderOs(<Dock unread={0} />);
    act(() => os().openApp("monitoring"));
    const touch = (type: string, clientY: number) => {
      const e = new Event(type);
      Object.defineProperty(e, "touches", { value: [{ clientX: 500, clientY }] });
      act(() => {
        document.dispatchEvent(e);
      });
    };
    touch("touchstart", window.innerHeight - 5);
    touch("touchmove", window.innerHeight - 60);
    expect(nav().className).not.toContain("hidden");
  });

  it("ignores minimized windows", () => {
    const { os } = renderOs(<Dock unread={0} />);
    act(() => os().openApp("monitoring"));
    act(() => os().dispatchWm({ type: "minimize", id: os().wm.windows[0]!.id }));
    expect(nav().className).not.toContain("hidden");
  });

  it("hides an item's tooltip once it is clicked, until the pointer leaves it", () => {
    renderOs(<Dock unread={0} />);
    const files = screen.getByRole("button", { name: "Files" });
    fireEvent.click(files);
    expect(files.className).toContain("tip-off");
    fireEvent.pointerLeave(files);
    expect(files.className).not.toContain("tip-off");
    expect(files.getAttribute("data-dock-app")).toBe("files");
  });
});
