import { describe, expect, it } from "vitest";
import { cascadeAt, CASCADE_STEP, frameOf, initialWm, MIN_H, MIN_W, resizeFrom, wmReducer, type WmAction, type WmState } from "./wm";

const AREA = { w: 1280, h: 760 };
const SIZE = { w: 800, h: 500 };
const MIN = { w: 360, h: 240 };
const run = (actions: WmAction[], state: WmState = initialWm(AREA)) => actions.reduce(wmReducer, state);
const open = (appId: string, maximized = false, min = MIN): WmAction => ({ type: "open", appId, title: appId, size: SIZE, min, maximized });
const closeAndRemove = (s: WmState, id: string) => wmReducer(wmReducer(s, { type: "close", id }), { type: "remove", id });

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

  it("cascades new windows 32 px down and right from near the centre", () => {
    const s = run([open("chat"), open("files"), open("settings")]);
    const [a, b, c] = s.windows.map((w) => w.bounds);
    expect(a).toEqual(cascadeAt(0, SIZE, AREA));
    expect(b).toEqual({ ...a!, x: a!.x + CASCADE_STEP, y: a!.y + CASCADE_STEP });
    expect(c).toEqual({ ...a!, x: a!.x + 2 * CASCADE_STEP, y: a!.y + 2 * CASCADE_STEP });
  });

  it("wraps the cascade to the start when the next window would leave the screen", () => {
    const s = run([open("a"), open("b"), open("c"), open("d")], initialWm({ w: 900, h: 640 }));
    expect(s.windows[3]!.bounds).toEqual(s.windows[0]!.bounds);
  });

  it("does not advance the cascade for a window that opens maximized", () => {
    const s = run([open("monitoring", true), open("chat")]);
    expect(s.windows[1]!.bounds).toEqual(cascadeAt(0, SIZE, AREA));
  });

  it("close marks the window closing and moves focus; remove deletes it", () => {
    let s = run([open("chat"), open("files")]);
    const files = s.focusedId!;
    s = wmReducer(s, { type: "close", id: files });
    expect(s.windows.find((w) => w.id === files)!.closing).toBe(true);
    expect(s.focusedId).toBe(s.windows[0]!.id);
    s = wmReducer(s, { type: "remove", id: files });
    expect(s.windows.map((w) => w.appId)).toEqual(["chat"]);
    s = closeAndRemove(s, s.focusedId!);
    expect(s.windows).toEqual([]);
    expect(s.focusedId).toBeNull();
  });

  it("reopening an app while its window is closing makes exactly one live window", () => {
    let s = run([open("chat")]);
    const first = s.focusedId!;
    s = wmReducer(s, { type: "close", id: first });
    s = wmReducer(s, open("chat"));
    const live = s.windows.filter((w) => w.appId === "chat" && !w.closing);
    expect(live).toHaveLength(1);
    expect(live[0]!.id).not.toBe(first);
    s = wmReducer(s, { type: "remove", id: first });
    expect(s.windows.filter((w) => w.appId === "chat")).toHaveLength(1);
    expect(s.focusedId).toBe(live[0]!.id);
  });

  it("ignores every action but remove on a closing window", () => {
    let s = run([open("chat")]);
    const id = s.focusedId!;
    s = wmReducer(s, { type: "close", id });
    for (const a of [{ type: "focus", id }, { type: "minimize", id }, { type: "toggleMaximize", id }, { type: "close", id }] as WmAction[]) {
      expect(wmReducer(s, a)).toBe(s);
    }
  });

  it("remembers an app's bounds for the session after it closes", () => {
    let s = run([open("chat")]);
    s = wmReducer(s, { type: "move", id: s.focusedId!, x: 300, y: 200 });
    s = closeAndRemove(s, s.focusedId!);
    s = wmReducer(s, open("chat"));
    expect(s.windows[0]!.bounds).toMatchObject({ x: 300, y: 200, w: 800, h: 500 });
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

  it("maximize and snap fill the work area, and toggle back to the normal bounds", () => {
    let s = run([open("chat")]);
    const id = s.focusedId!;
    const normal = s.windows[0]!.bounds;
    s = wmReducer(s, { type: "toggleMaximize", id });
    expect(frameOf(s.windows[0]!, AREA)).toEqual({ x: 0, y: 0, w: 1280, h: 760 });
    s = wmReducer(s, { type: "snap", id, side: "left" });
    expect(frameOf(s.windows[0]!, AREA)).toEqual({ x: 0, y: 0, w: 640, h: 760 });
    s = wmReducer(s, { type: "snap", id, side: "right" });
    expect(frameOf(s.windows[0]!, AREA)).toEqual({ x: 640, y: 0, w: 640, h: 760 });
    s = wmReducer(s, { type: "snap", id, side: "right" });
    expect(s.windows[0]!.mode).toBe("normal");
    expect(frameOf(s.windows[0]!, AREA)).toEqual(normal);
  });

  it("moving or setting the bounds of a maximized window restores it to normal", () => {
    let s = run([open("chat", true)]);
    s = wmReducer(s, { type: "move", id: s.focusedId!, x: 200, y: 100 });
    expect(s.windows[0]!.mode).toBe("normal");
    expect(s.windows[0]!.bounds).toMatchObject({ x: 200, y: 100 });
    s = wmReducer(s, { type: "toggleMaximize", id: s.focusedId! });
    s = wmReducer(s, { type: "setBounds", id: s.focusedId!, bounds: { x: 350, y: 20, w: 600, h: 400 } });
    expect(s.windows[0]).toMatchObject({ mode: "normal", bounds: { x: 350, y: 20, w: 600, h: 400 } });
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

  it("enforces each window's minimum size, and never less than the global minimum", () => {
    let s = run([open("chat", false, { w: 560, h: 400 })]);
    s = wmReducer(s, { type: "setBounds", id: s.focusedId!, bounds: { x: 10, y: 10, w: 10, h: 10 } });
    expect(s.windows[0]!.bounds).toMatchObject({ w: 560, h: 400 });
    s = run([open("files", false, { w: 1, h: 1 })]);
    s = wmReducer(s, { type: "setBounds", id: s.focusedId!, bounds: { x: 10, y: 10, w: 10, h: 10 } });
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
      { type: "remove", id: "nope" },
      { type: "minimize", id: "nope" },
      { type: "move", id: "nope", x: 1, y: 1 },
      { type: "setBounds", id: "nope", bounds: { x: 1, y: 1, w: 500, h: 500 } },
    ] as WmAction[]) {
      expect(wmReducer(s, a)).toBe(s);
    }
  });
});

describe("resizeFrom", () => {
  const start = { x: 100, y: 50, w: 600, h: 400 };
  const min = { w: 480, h: 320 };

  it("grows and shrinks from the east and south edges", () => {
    expect(resizeFrom(start, "se", 40, 30, min, AREA)).toEqual({ x: 100, y: 50, w: 640, h: 430 });
    expect(resizeFrom(start, "e", -500, 0, min, AREA)).toEqual({ x: 100, y: 50, w: 480, h: 400 });
  });

  it("moves the origin when dragging the west or north edge", () => {
    expect(resizeFrom(start, "nw", -20, -10, min, AREA)).toEqual({ x: 80, y: 40, w: 620, h: 410 });
  });

  it("keeps the opposite edge fixed when the west or north edge hits the minimum", () => {
    const w = resizeFrom(start, "w", 400, 0, min, AREA);
    expect(w).toEqual({ x: 220, y: 50, w: 480, h: 400 });
    expect(w.x + w.w).toBe(start.x + start.w);
    const n = resizeFrom(start, "n", 0, 300, min, AREA);
    expect(n).toEqual({ x: 100, y: 130, w: 600, h: 320 });
    expect(n.y + n.h).toBe(start.y + start.h);
  });

  it("never pulls the title bar above the work area", () => {
    expect(resizeFrom(start, "n", 0, -200, min, AREA)).toEqual({ x: 100, y: 0, w: 600, h: 450 });
  });

  it("uses a minimum no larger than the work area", () => {
    expect(resizeFrom(start, "e", -500, 0, { w: 2000, h: 320 }, { w: 700, h: 760 }).w).toBe(700);
  });
});
