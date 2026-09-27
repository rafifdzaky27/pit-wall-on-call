import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { WindowState } from "../wm/wm";
import { Window } from "./Window";

afterEach(cleanup);

const win: WindowState = { id: "w1", appId: "chat", title: "Chat", mode: "normal", minimized: false, bounds: { x: 100, y: 50, w: 600, h: 400 }, z: 3 };
const area = { w: 1280, h: 760 };

function setup(over: Partial<WindowState> = {}) {
  const dispatch = vi.fn();
  render(
    <Window win={{ ...win, ...over }} area={area} focused dispatch={dispatch}>
      <p>body</p>
    </Window>,
  );
  return dispatch;
}

describe("Window", () => {
  it("is a labelled region placed at its frame", () => {
    setup();
    const region = screen.getByRole("region", { name: "Chat" });
    expect(region.style.left).toBe("100px");
    expect(region.style.width).toBe("600px");
    expect(screen.getByText("body")).toBeTruthy();
  });

  it("title bar buttons minimize, maximize and close", () => {
    const dispatch = setup();
    fireEvent.click(screen.getByRole("button", { name: "Minimize Chat" }));
    fireEvent.click(screen.getByRole("button", { name: "Maximize Chat" }));
    fireEvent.click(screen.getByRole("button", { name: "Close Chat" }));
    expect(dispatch.mock.calls.map((c) => c[0].type)).toEqual(["minimize", "toggleMaximize", "close"]);
  });

  it("labels the maximize button Restore when maximized", () => {
    setup({ mode: "maximized" });
    expect(screen.getByRole("button", { name: "Restore Chat" })).toBeTruthy();
  });

  it("dragging the title bar moves the window by the pointer delta", () => {
    const dispatch = setup();
    const title = screen.getByText("Chat", { selector: ".titlebar-title" }).parentElement!;
    fireEvent.pointerDown(title, { button: 0, clientX: 300, clientY: 70, pointerId: 1 });
    fireEvent.pointerMove(title, { clientX: 350, clientY: 90, pointerId: 1 });
    fireEvent.pointerUp(title, { pointerId: 1 });
    expect(dispatch).toHaveBeenCalledWith({ type: "move", id: "w1", x: 150, y: 70 });
  });

  it("double-clicking the title bar toggles maximize", () => {
    const dispatch = setup();
    fireEvent.doubleClick(screen.getByText("Chat", { selector: ".titlebar-title" }));
    expect(dispatch).toHaveBeenCalledWith({ type: "toggleMaximize", id: "w1" });
  });

  it("stays mounted but hidden when minimized, so the app keeps its state", () => {
    setup({ minimized: true });
    expect(screen.queryByRole("region", { name: "Chat" })).toBeNull();
    expect(screen.getByText("body", { selector: "p" })).toBeTruthy();
  });
});
