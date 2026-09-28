import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_PREFS, loadPrefs } from "./prefs";

afterEach(() => localStorage.clear());

describe("sound and full screen preferences", () => {
  it("default to volume 70, not muted, and full screen on Start shift", () => {
    expect(DEFAULT_PREFS).toMatchObject({ volume: 70, muted: false, fullscreenOnStart: true });
  });

  it("fill in defaults for preferences saved by M1.5", () => {
    localStorage.setItem(
      "pitwall.prefs",
      JSON.stringify({ theme: "light", reduceMotion: true, largeText: false, systemCursor: false, singleKeyShortcuts: true, wallpaper: "auto", sticky: "x" }),
    );
    expect(loadPrefs()).toMatchObject({ theme: "light", reduceMotion: true, volume: 70, muted: false, fullscreenOnStart: true });
  });

  it("keeps valid values, clamps the volume and ignores junk", () => {
    localStorage.setItem("pitwall.prefs", JSON.stringify({ volume: 140, muted: true, fullscreenOnStart: false }));
    expect(loadPrefs()).toMatchObject({ volume: 100, muted: true, fullscreenOnStart: false });
    localStorage.setItem("pitwall.prefs", JSON.stringify({ volume: -3 }));
    expect(loadPrefs().volume).toBe(0);
    localStorage.setItem("pitwall.prefs", JSON.stringify({ volume: "loud", muted: "yes" }));
    expect(loadPrefs()).toMatchObject({ volume: 70, muted: false });
  });
});

describe("café audio preferences (M1.6)", () => {
  it("default to ambience 60, music 50, alerts 100, full intensity, radio off", () => {
    expect(DEFAULT_PREFS).toMatchObject({ ambience: 60, music: 50, alerts: 100, reduceAudio: false, radio: false });
  });

  it("clamp levels, keep flags and survive a reload", () => {
    localStorage.setItem("pitwall.prefs", JSON.stringify({ ambience: 180, music: -1, alerts: 40, reduceAudio: true, radio: true }));
    expect(loadPrefs()).toMatchObject({ ambience: 100, music: 0, alerts: 40, reduceAudio: true, radio: true });
    localStorage.setItem("pitwall.prefs", JSON.stringify({ ambience: "x", radio: "on" }));
    expect(loadPrefs()).toMatchObject({ ambience: 60, radio: false });
  });
});
