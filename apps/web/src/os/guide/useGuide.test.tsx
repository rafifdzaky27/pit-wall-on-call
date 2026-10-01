import { act, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrefs } from "../PrefsProvider";
import { renderOs } from "../testing";
import { useGuide } from "./useGuide";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  localStorage.clear();
});

let prefsNow: ReturnType<typeof usePrefs>;
function Guide() {
  prefsNow = usePrefs();
  useGuide();
  return null;
}
const ms = (n: number) => act(() => void vi.advanceTimersByTime(n));
const hint = (os: () => { notices: { id: string; body: string }[] }) => os().notices.find((n) => n.id === "guide");

function startActive(opts?: Parameters<typeof renderOs>[1]) {
  const r = renderOs(<Guide />, opts);
  act(() => r.incident().start());
  act(() => r.incident().skipPrepage());
  act(() => r.incident().acknowledge());
  return r;
}

describe("the next-step guide (M4.5 spec N3)", () => {
  it("stays quiet before the quiet spell, then points at Monitoring once", () => {
    const { os } = startActive();
    ms(44_000);
    expect(hint(os)).toBeUndefined();
    ms(2_000);
    expect(hint(os)?.body).toMatch(/Monitoring/);
    act(() => os().removeNotice("guide"));
    ms(120_000);
    expect(hint(os)).toBeUndefined();
  });

  it("sends hint_shown once per shift, for the first hint only", () => {
    const track = vi.fn();
    (window as { umami?: unknown }).umami = { track };
    const { os } = startActive();
    track.mockClear();
    ms(46_000);
    expect(hint(os)).toBeDefined();
    expect(track.mock.calls).toEqual([["hint_shown", undefined]]);
    act(() => os().openApp("monitoring"));
    ms(46_000);
    expect(hint(os)?.body).toMatch(/red service on the map/);
    expect(track).toHaveBeenCalledTimes(1);
    delete (window as { umami?: unknown }).umami;
  });

  it("moves to the next place after each milestone, clearing the old hint", () => {
    const { os } = startActive();
    ms(46_000);
    expect(hint(os)?.body).toMatch(/map of every service/);
    act(() => os().openApp("monitoring"));
    expect(hint(os)).toBeUndefined();
    ms(46_000);
    expect(hint(os)?.body).toMatch(/red service on the map/);
    act(() => os().signal("service:edge"));
    ms(46_000);
    expect(hint(os)?.body).toMatch(/Logs show/);
    act(() => os().openApp("deploys"));
    act(() => os().openApp("logs"));
    ms(46_000);
    expect(hint(os)?.body).toMatch(/act on it/);
  });

  it("counts the #deploys channel as looking at what changed", () => {
    const { os, incident } = startActive();
    act(() => os().openApp("monitoring"));
    act(() => os().signal(`service:${Object.entries(incident().snapshot.health).find(([, h]) => h === "crit")?.[0] ?? "edge"}`));
    act(() => os().openApp("logs"));
    act(() => os().signal("chat:deploys"));
    ms(46_000);
    expect(hint(os)?.body).toMatch(/act on it/);
  });

  it("stays quiet with the switch off", () => {
    const { os } = startActive({ prefs: { nextStepHints: false } });
    ms(300_000);
    expect(hint(os)).toBeUndefined();
  });

  it("stays quiet on the training shift, which has its own coach", () => {
    const { os, incident } = renderOs(<Guide />);
    act(() => incident().startTraining());
    act(() => incident().skipPrepage());
    act(() => incident().acknowledge());
    ms(300_000);
    expect(hint(os)).toBeUndefined();
  });

  it("steps aside after the first resolved shift, until the player turns it back on", () => {
    const { os, incident } = startActive();
    act(() => incident().dispatch("checkout.rollback"));
    for (let i = 0; i < 60; i++) ms(1000);
    expect(incident().result?.outcome).toBe("resolved");
    expect(prefsNow.prefs.nextStepHints).toBe(false);
    expect(prefsNow.prefs.resolvedOnce).toBe(true);
    act(() => incident().newShift());
    act(() => incident().start());
    act(() => incident().skipPrepage());
    act(() => incident().acknowledge());
    ms(300_000);
    expect(hint(os)).toBeUndefined();
    act(() => prefsNow.update({ nextStepHints: true }));
    ms(46_000);
    expect(hint(os)).toBeDefined();
  });

  it("counts only game time: a pause holds the quiet spell, and no hint shows while paused (PR 31 review I1)", () => {
    const { os, incident } = startActive();
    ms(30_000);
    act(() => incident().pause());
    ms(60_000);
    expect(hint(os)).toBeUndefined();
    act(() => incident().resume());
    ms(10_000);
    expect(hint(os)).toBeUndefined();
    ms(8_000);
    expect(hint(os)?.body).toMatch(/Monitoring/);
  });

  it("does not count #deploys read before the page as looking at what changed", () => {
    const r = renderOs(<Guide />);
    act(() => r.os().signal("chat:deploys"));
    act(() => r.incident().start());
    act(() => r.incident().skipPrepage());
    act(() => r.incident().acknowledge());
    act(() => r.os().openApp("monitoring"));
    act(() => r.os().signal("service:postgres"));
    act(() => r.os().openApp("logs"));
    ms(46_000);
    expect(hint(r.os)?.body).toMatch(/Something changed/);
  });

  it("says nothing more once the player has acted", () => {
    const { os, incident } = startActive();
    act(() => incident().dispatch("checkout.restart"));
    ms(120_000);
    expect(hint(os)).toBeUndefined();
  });
});
