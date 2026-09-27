import { describe, expect, it } from "vitest";
import { frameOf, initialWm, MIN_H, MIN_W, wmReducer, type WmAction, type WmState } from "./wm";

const AREA = { w: 1280, h: 760 };
const run = (actions: WmAction[], state: WmState = initialWm(AREA)) => actions.reduce(wmReducer, state);
const open = (appId: string, maximized = false): WmAction => ({ type: "open", appId, title: appId, bounds: { x: 100, y: 50, w: 800, h: 500 }, maximized });

describe("wmReducer", () => {
  it("opens a window focused and on top", () => {
    const s = run([open("chat"), open("files")]);
    expect(s.windows.map((w) => w.appId)).toEqual(["chat", "files"]);
    expect(s.focusedId).toBe(s.windows[1]!.id);
    expect(s.windows[1]!.z).toBeGreaterThan(s.windows[0]!.z);
  });

  it("opening an app that is already open focuses it instead of duplicating", () => {
    const s = run([open("chat"), open("files"), open("chat")]);
    expect(s.windows).toHaveLength(2);
    expect(s.focusedId).toBe(s.windows.find((w) => w.appId === "chat")!.id);
  });

  it("closing the focused window focuses the next one down", () => {
    let s = run([open("chat"), open("files")]);
    s = wmReducer(s, { type: "close", id: s.focusedId! });
    expect(s.windows.map((w) => w.appId)).toEqual(["chat"]);
    expect(s.focusedId).toBe(s.windows[0]!.id);
    s = wmReducer(s, { type: "close", id: s.focusedId! });
    expect(s.focusedId).toBeNull();
  });

  it("minimizing hides the window and moves focus; focusing restores it", () => {
    let s = run([open("chat"), open("files")]);
    const files = s.focusedId!;
    s = wmReducer(s, { type: "minimize", id: files });
    expect(s.windows.find((w) => w.id === files)!.minimized).toBe(true);
    expect(s.focusedId).not.toBe(files);
    s = wmReducer(s, { type: "focus", id: files });
    expect(s.windows.find((w) => w.id === files)!.minimized).toBe(false);
    expect(s.focusedId).toBe(files);
  });

  it("maximize and snap fill the work area, and toggle back", () => {
    let s = run([open("chat")]);
    const id = s.focusedId!;
    s = wmReducer(s, { type: "toggleMaximize", id });
    expect(frameOf(s.windows[0]!, AREA)).toEqual({ x: 0, y: 0, w: 1280, h: 760 });
    s = wmReducer(s, { type: "snap", id, side: "left" });
    expect(frameOf(s.windows[0]!, AREA)).toEqual({ x: 0, y: 0, w: 640, h: 760 });
    s = wmReducer(s, { type: "snap", id, side: "right" });
    expect(frameOf(s.windows[0]!, AREA)).toEqual({ x: 640, y: 0, w: 640, h: 760 });
    s = wmReducer(s, { type: "snap", id, side: "right" });
    expect(s.windows[0]!.mode).toBe("normal");
    expect(frameOf(s.windows[0]!, AREA)).toEqual({ x: 100, y: 50, w: 800, h: 500 });
  });

  it("opens maximized when asked", () => {
    const s = run([open("monitoring", true)]);
    expect(s.windows[0]!.mode).toBe("maximized");
  });

  it("moving a maximized window restores it to normal", () => {
    let s = run([open("chat", true)]);
    s = wmReducer(s, { type: "move", id: s.focusedId!, x: 200, y: 100 });
    expect(s.windows[0]!.mode).toBe("normal");
    expect(s.windows[0]!.bounds).toMatchObject({ x: 200, y: 100 });
  });

  it("keeps the title bar reachable when moved off screen", () => {
    let s = run([open("chat")]);
    s = wmReducer(s, { type: "move", id: s.focusedId!, x: -5000, y: -300 });
    const b = s.windows[0]!.bounds;
    expect(b.x + b.w).toBeGreaterThanOrEqual(80);
    expect(b.y).toBe(0);
    s = wmReducer(s, { type: "move", id: s.focusedId!, x: 99999, y: 99999 });
    expect(s.windows[0]!.bounds.x).toBeLessThanOrEqual(AREA.w - 80);
    expect(s.windows[0]!.bounds.y).toBeLessThanOrEqual(AREA.h - 36);
  });

  it("enforces a minimum size", () => {
    let s = run([open("chat")]);
    s = wmReducer(s, { type: "resize", id: s.focusedId!, w: 10, h: 10 });
    expect(s.windows[0]!.bounds).toMatchObject({ w: MIN_W, h: MIN_H });
  });

  it("re-clamps every window when the work area shrinks", () => {
    let s = run([open("chat")]);
    s = wmReducer(s, { type: "move", id: s.focusedId!, x: 1100, y: 600 });
    s = wmReducer(s, { type: "setArea", w: 900, h: 500 });
    const b = s.windows[0]!.bounds;
    expect(s.area).toEqual({ w: 900, h: 500 });
    expect(b.x).toBeLessThanOrEqual(900 - 80);
    expect(b.y).toBeLessThanOrEqual(500 - 36);
    expect(b.w).toBeLessThanOrEqual(900);
  });

  it("ignores actions for unknown windows", () => {
    const s = run([open("chat")]);
    for (const a of [
      { type: "focus", id: "nope" },
      { type: "close", id: "nope" },
      { type: "minimize", id: "nope" },
      { type: "move", id: "nope", x: 1, y: 1 },
    ] as WmAction[]) {
      expect(wmReducer(s, a)).toBe(s);
    }
  });
});
