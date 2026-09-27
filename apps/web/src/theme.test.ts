import { afterEach, describe, expect, it, vi } from "vitest";
import { applyTheme, currentTheme, readStoredTheme } from "./theme";

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  delete document.documentElement.dataset.theme;
});

describe("theme", () => {
  it("defaults to dark when nothing is stored", () => {
    expect(readStoredTheme()).toBe("dark");
  });

  it("applies the theme to <html> and remembers it", () => {
    applyTheme("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(currentTheme()).toBe("light");
    expect(readStoredTheme()).toBe("light");
  });

  it("still works when storage is blocked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(readStoredTheme()).toBe("dark");
    expect(() => applyTheme("light")).not.toThrow();
    expect(currentTheme()).toBe("light");
  });

  it("ignores an unknown stored value", () => {
    localStorage.setItem("pitwall.theme", "sepia");
    expect(readStoredTheme()).toBe("dark");
  });
});
