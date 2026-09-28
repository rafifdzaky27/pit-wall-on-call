import { act, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { renderOs } from "../testing";
import { DOCK_H, TOPBAR_H, workArea } from "./OsContext";

afterEach(cleanup);

describe("OsProvider", () => {
  it("opens apps with their title and default placement, once each", () => {
    const { os } = renderOs(null);
    act(() => os().openApp("chat"));
    act(() => os().openApp("chat"));
    expect(os().wm.windows).toHaveLength(1);
    expect(os().wm.windows[0]).toMatchObject({ appId: "chat", title: "Chat", mode: "normal" });
    act(() => os().openApp("monitoring"));
    expect(os().wm.windows.find((w) => w.appId === "monitoring")!.mode).toBe("maximized");
  });

  it("tracks read messages", () => {
    const { os } = renderOs(null);
    act(() => os().markRead(["a", "b"]));
    act(() => os().markRead(["b", "c"]));
    expect([...os().read].sort()).toEqual(["a", "b", "c"]);
  });

  it("follows the viewport size, minus the top bar and dock", () => {
    const { os } = renderOs(null);
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1100 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 700 });
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });
    expect(os().wm.area).toEqual({ w: 1100, h: 700 - TOPBAR_H - DOCK_H });
    expect(workArea()).toEqual({ w: 1100, h: 700 - TOPBAR_H - DOCK_H });
  });
});
