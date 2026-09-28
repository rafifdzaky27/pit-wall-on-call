import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { WindowState } from "../wm/wm";
import { Window } from "./Window";

afterEach(cleanup);

const win: WindowState = {
  id: "w1",
  appId: "chat",
  title: "Chat",
  mode: "normal",
  minimized: false,
  closing: false,
  bounds: { x: 100, y: 50, w: 600, h: 400 },
  min: { w: 480, h: 320 },
  z: 3,
};
const area = { w: 1280, h: 760 };

function setup(over: Partial<WindowState> = {}) {
  const dispatch = vi.fn();
  const onDragChange = vi.fn();
  const view = render(
    <Window win={{ ...win, ...over }} area={area} focused layer={12} dispatch={dispatch} onDragChange={onDragChange}>
      <p>body</p>
    </Window>,
  );
  return { dispatch, onDragChange, view };
}

const titlebar = () => screen.getByText("Chat", { selector: ".titlebar-title" }).parentElement!;

describe("Window", () => {
  it("is a labelled region placed at its frame and layer", () => {
    setup();
    const region = screen.getByRole("region", { name: "Chat" });
    expect(region.style.left).toBe("100px");
    expect(region.style.width).toBe("600px");
    expect(region.style.zIndex).toBe("12");
    expect(screen.getByText("body")).toBeTruthy();
  });

  it("title bar buttons minimize, maximize and close", () => {
    const { dispatch } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Minimize Chat" }));
    fireEvent.click(screen.getByRole("button", { name: "Maximize Chat" }));
    fireEvent.click(screen.getByRole("button", { name: "Close Chat" }));
    expect(dispatch.mock.calls.map((c) => c[0].type)).toEqual(["minimize", "toggleMaximize", "close"]);
  });

  it("labels the maximize button Restore when maximized", () => {
    setup({ mode: "maximized" });
    expect(screen.getByRole("button", { name: "Restore Chat" })).toBeTruthy();
  });

  it("dragging the title bar moves the window by the pointer delta and reports the drag", () => {
    const { dispatch, onDragChange } = setup();
    fireEvent.pointerDown(titlebar(), { button: 0, clientX: 300, clientY: 70, pointerId: 1 });
    fireEvent.pointerMove(titlebar(), { clientX: 350, clientY: 90, pointerId: 1 });
    fireEvent.pointerUp(titlebar(), { pointerId: 1 });
    expect(dispatch).toHaveBeenCalledWith({ type: "move", id: "w1", x: 150, y: 70 });
    expect(onDragChange.mock.calls).toEqual([[true], [false]]);
  });

  it("dragging a maximized window restores it under the pointer, like GNOME", () => {
    const { dispatch } = setup({ mode: "maximized" });
    fireEvent.pointerDown(titlebar(), { button: 0, clientX: 640, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(titlebar(), { clientX: 642, clientY: 11, pointerId: 1 });
    expect(dispatch).not.toHaveBeenCalled();
    fireEvent.pointerMove(titlebar(), { clientX: 650, clientY: 30, pointerId: 1 });
    expect(dispatch).toHaveBeenCalledWith({ type: "setBounds", id: "w1", bounds: { x: 350, y: 20, w: 600, h: 400 } });
  });

  it("has eight resize handles, and resizing from the west edge keeps the east edge", () => {
    const { dispatch, view } = setup();
    expect(view.container.querySelectorAll(".rz")).toHaveLength(8);
    const west = view.container.querySelector(".rz-w")!;
    fireEvent.pointerDown(west, { button: 0, clientX: 100, clientY: 200, pointerId: 2 });
    fireEvent.pointerMove(west, { clientX: 500, clientY: 200, pointerId: 2 });
    expect(dispatch).toHaveBeenLastCalledWith({ type: "setBounds", id: "w1", bounds: { x: 220, y: 50, w: 480, h: 400 } });
  });

  it("has no resize handles while maximized", () => {
    const { view } = setup({ mode: "maximized" });
    expect(view.container.querySelectorAll(".rz")).toHaveLength(0);
  });

  it("double-clicking the title bar toggles maximize", () => {
    const { dispatch } = setup();
    fireEvent.doubleClick(screen.getByText("Chat", { selector: ".titlebar-title" }));
    expect(dispatch).toHaveBeenCalledWith({ type: "toggleMaximize", id: "w1" });
  });

  it("stays mounted but hidden when minimized, so the app keeps its state", () => {
    setup({ minimized: true });
    expect(screen.queryByRole("region", { name: "Chat" })).toBeNull();
    expect(screen.getByText("body", { selector: "p" })).toBeTruthy();
  });

  it("a closing window asks to be removed once its exit animation is done (at once without motion)", () => {
    const { dispatch } = setup({ closing: true });
    expect(dispatch).toHaveBeenCalledWith({ type: "remove", id: "w1" });
  });
});
