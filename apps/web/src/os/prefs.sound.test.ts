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
