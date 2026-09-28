import { act, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderOs } from "../testing";
import { TOPBAR_H, workArea } from "./OsContext";

afterEach(cleanup);

const notice = (id: string, title = id) => ({ id, app: "Shift", title, body: "body", actions: [] });

describe("OsProvider", () => {
  it("opens apps with their title and placement, once each", () => {
    const { os } = renderOs(null);
    act(() => os().openApp("chat"));
    act(() => os().openApp("chat"));
    expect(os().wm.windows).toHaveLength(1);
    expect(os().wm.windows[0]).toMatchObject({ appId: "chat", title: "Chat", mode: "normal", min: { w: 560, h: 400 } });
    act(() => os().openApp("monitoring"));
    expect(os().wm.windows.find((w) => w.appId === "monitoring")!.mode).toBe("maximized");
  });

  it("tracks read messages", () => {
    const { os } = renderOs(null);
    act(() => os().markRead(["a", "b"]));
    act(() => os().markRead(["b", "c"]));
    expect([...os().read].sort()).toEqual(["a", "b", "c"]);
  });

  it("gives windows the whole screen below the top bar", () => {
    const { os } = renderOs(null);
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1100 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 700 });
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });
    expect(os().wm.area).toEqual({ w: 1100, h: 700 - TOPBAR_H });
    expect(workArea()).toEqual({ w: 1100, h: 700 - TOPBAR_H });
  });

  it("keeps a single open menu", () => {
    const { os } = renderOs(null);
    act(() => os().setOpenMenu("phone"));
    act(() => os().setOpenMenu("system"));
    expect(os().openMenu).toBe("system");
    act(() => os().setOpenMenu(null));
    expect(os().openMenu).toBeNull();
  });

  it("opens Settings on a given page", () => {
    const { os } = renderOs(null);
    act(() => os().openSettings("about"));
    expect(os().settingsPage).toBe("about");
    expect(os().wm.windows.map((w) => w.appId)).toEqual(["settings"]);
  });

  it("pushes notices newest first as unread banners, and replaces a notice with the same id", () => {
    vi.spyOn(Date, "now").mockReturnValue(1000);
    const { os } = renderOs(null);
    act(() => os().pushNotice(notice("a")));
    act(() => os().pushNotice(notice("b")));
    act(() => os().pushNotice(notice("a", "again")));
    expect(os().notices.map((n) => [n.id, n.title, n.banner, n.read, n.at])).toEqual([
      ["a", "again", true, false, 1000],
      ["b", "b", true, false, 1000],
    ]);
    vi.restoreAllMocks();
  });

  it("hides a banner but keeps the notice, then marks read, removes and clears", () => {
    const { os } = renderOs(null);
    act(() => os().pushNotice(notice("a")));
    act(() => os().pushNotice(notice("b")));
    act(() => os().hideBanner("a"));
    expect(os().notices.find((n) => n.id === "a")).toMatchObject({ banner: false, read: false });
    act(() => os().markNoticesRead());
    expect(os().notices.every((n) => n.read)).toBe(true);
    act(() => os().removeNotice("b"));
    expect(os().notices.map((n) => n.id)).toEqual(["a"]);
    act(() => os().clearNotices());
    expect(os().notices).toEqual([]);
  });

  it("records the first arrival time of each chat message", () => {
    const { os } = renderOs(null);
    act(() => os().recordArrivals(["m1", "m2"], 100));
    act(() => os().recordArrivals(["m2", "m3"], 200));
    expect([...os().arrivals]).toEqual([
      ["m1", 100],
      ["m2", 100],
      ["m3", 200],
    ]);
    expect(os().bootAt).toBeGreaterThan(0);
  });

  it("reports dragging", () => {
    const { os } = renderOs(null);
    act(() => os().setDragging(true));
    expect(os().dragging).toBe(true);
  });
});
