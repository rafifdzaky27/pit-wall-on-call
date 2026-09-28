import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { applyPrefs, DEFAULT_PREFS, loadPrefs, savePrefs } from "./prefs";
import { PrefsProvider, usePrefs } from "./PrefsProvider";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("prefs", () => {
  it("defaults when nothing is stored", () => {
    expect(loadPrefs()).toEqual(DEFAULT_PREFS);
  });

  it("round-trips through storage", () => {
    savePrefs({ ...DEFAULT_PREFS, theme: "light", largeText: true, wallpaper: "tokyo", sticky: "hi" });
    expect(loadPrefs()).toMatchObject({ theme: "light", largeText: true, wallpaper: "tokyo", sticky: "hi" });
  });

  it("drops invalid stored values field by field", () => {
    localStorage.setItem("pitwall.prefs", JSON.stringify({ theme: "sepia", wallpaper: "paris", reduceMotion: "yes", sticky: 42, largeText: true }));
    expect(loadPrefs()).toEqual({ ...DEFAULT_PREFS, largeText: true });
  });

  it("survives corrupt JSON and blocked storage", () => {
    localStorage.setItem("pitwall.prefs", "{not json");
    expect(loadPrefs()).toEqual(DEFAULT_PREFS);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(loadPrefs()).toEqual(DEFAULT_PREFS);
    expect(() => savePrefs(DEFAULT_PREFS)).not.toThrow();
  });

  it("migrates the M1 theme key", () => {
    localStorage.setItem("pitwall.theme", "light");
    expect(loadPrefs().theme).toBe("light");
  });

  it("applies prefs as data attributes", () => {
    const root = document.createElement("div");
    applyPrefs({ ...DEFAULT_PREFS, theme: "light", reduceMotion: true, largeText: true, systemCursor: true }, root);
    expect(root.dataset).toMatchObject({ theme: "light", motion: "reduce", text: "large", cursor: "system" });
  });
});

describe("PrefsProvider", () => {
  function Probe() {
    const { prefs, update } = usePrefs();
    return (
      <button type="button" onClick={() => update({ theme: prefs.theme === "dark" ? "light" : "dark" })}>
        {prefs.theme}
      </button>
    );
  }

  it("updates, applies to <html>, and persists", () => {
    render(
      <PrefsProvider>
        <Probe />
      </PrefsProvider>,
    );
    act(() => screen.getByRole("button").click());
    expect(screen.getByRole("button").textContent).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(loadPrefs().theme).toBe("light");
  });

  it("usePrefs outside the provider fails loudly", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(/PrefsProvider/);
  });
});
