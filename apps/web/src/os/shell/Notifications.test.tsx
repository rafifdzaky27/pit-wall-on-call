import { dailyFor, utcDate } from "@pitwall/scenarios";
import { resolveWorld } from "@pitwall/world";
import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrefs } from "../PrefsProvider";
import { renderOs } from "../testing";
import { useStartShift } from "../useStartShift";
import { useNoticeFeed } from "./noticeFeed";
import { BANNER_MS, Notifications } from "./Notifications";

const today = dailyFor(utcDate(Date.now()));
const DAILY_TITLE = `Daily #${today.number} · ${resolveWorld(today.seed).city.name}`;

const world = resolveWorld(1);

function Shell() {
  const start = useStartShift();
  useNoticeFeed(start);
  return <Notifications />;
}

function NoFullScreen() {
  const { update } = usePrefs();
  return (
    <button type="button" onClick={() => update({ fullscreenOnStart: false })}>
      No full screen
    </button>
  );
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("Notifications", () => {
  it("greets with today's daily, which hides after 8 s and stays in the list", () => {
    const { os } = renderOs(<Shell />);
    expect(screen.getByRole("heading", { name: DAILY_TITLE })).toBeTruthy();
    act(() => vi.advanceTimersByTime(BANNER_MS));
    expect(screen.queryByRole("heading", { name: DAILY_TITLE })).toBeNull();
    expect(os().notices.find((n) => n.id === "shift")).toMatchObject({ banner: false });
  });

  it("holds a banner while it is hovered or focused, then hides it after the pointer leaves", () => {
    renderOs(<Shell />);
    const banner = screen.getByRole("region", { name: DAILY_TITLE });
    fireEvent.pointerEnter(banner);
    act(() => vi.advanceTimersByTime(BANNER_MS * 3));
    expect(screen.getByRole("region", { name: DAILY_TITLE })).toBeTruthy();
    fireEvent.pointerLeave(banner);
    act(() => vi.advanceTimersByTime(BANNER_MS));
    expect(screen.queryByRole("region", { name: DAILY_TITLE })).toBeNull();
  });

  it("Start shift in the banner starts the shift, drops the notice and announces the pre-page", () => {
    const { incident, os } = renderOs(<Shell />);
    fireEvent.click(screen.getByRole("button", { name: "Practice shift" }));
    expect(incident().phase).toBe("prepage");
    expect(os().notices.some((n) => n.id === "shift")).toBe(false);
    expect(screen.getByRole("heading", { name: "Shift started" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Skip to the page" }));
    expect(incident().phase).toBe("paging");
  });

  it("the page is a critical alert that never hides by itself", () => {
    const { incident } = renderOs(<Shell />);
    act(() => incident().start());
    act(() => incident().skipPrepage());
    act(() => vi.advanceTimersByTime(40_000));
    expect(screen.getByRole("alertdialog", { name: "Checkout returning 5xx" })).toBeTruthy();
  });

  it("a colleague's DM arrives as a Chat banner, unless Chat is focused", () => {
    const { incident, os } = renderOs(<Shell />);
    act(() => incident().start());
    act(() => incident().skipPrepage());
    act(() => incident().acknowledge());
    act(() => incident().dispatch("global.ask_secondary"));
    act(() => vi.advanceTimersByTime(11_000));
    const dm = os().notices.find((n) => n.id === "chat:dm.secondary.deploy");
    expect(dm).toMatchObject({ app: "Chat", title: world.colleagues.secondary, banner: true, sound: "message" });
    expect(os().notices.some((n) => n.id === "chat:incidents.opened")).toBe(false);
    cleanup();
    const again = renderOs(<Shell />);
    act(() => again.os().openApp("chat"));
    act(() => again.incident().start());
    act(() => again.incident().skipPrepage());
    act(() => again.incident().acknowledge());
    act(() => again.incident().dispatch("global.ask_secondary"));
    act(() => vi.advanceTimersByTime(11_000));
    expect(again.os().notices.some((n) => n.id.startsWith("chat:"))).toBe(false);
  });

  it("dismissing a banner keeps it in the list", () => {
    const { os } = renderOs(<Shell />);
    fireEvent.click(screen.getByRole("button", { name: "Dismiss notification" }));
    expect(screen.queryByRole("region", { name: DAILY_TITLE })).toBeNull();
    expect(os().notices).toHaveLength(1);
  });

  it("honours a full-screen preference changed after the Start shift notice appeared", () => {
    const request = vi.fn(async () => undefined);
    Object.assign(document.documentElement, { requestFullscreen: request });
    const { incident } = renderOs(
      <>
        <NoFullScreen />
        <Shell />
      </>,
    );
    fireEvent.click(screen.getByRole("button", { name: "No full screen" }));
    fireEvent.click(screen.getByRole("button", { name: "Practice shift" }));
    expect(incident().phase).toBe("prepage");
    expect(request).not.toHaveBeenCalled();
    delete (document.documentElement as { requestFullscreen?: unknown }).requestFullscreen;
  });
});
