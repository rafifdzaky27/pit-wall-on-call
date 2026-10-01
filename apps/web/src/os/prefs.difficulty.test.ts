import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_PREFS, loadPrefs } from "./prefs";

afterEach(() => localStorage.clear());

describe("difficulty preference (M6 spec H1)", () => {
  it("defaults to normal, also for preferences saved before M6", () => {
    expect(DEFAULT_PREFS.difficulty).toBe("normal");
    localStorage.setItem("pitwall.prefs", JSON.stringify({ theme: "dark", shiftsDone: 4 }));
    expect(loadPrefs().difficulty).toBe("normal");
  });

  it("keeps hard and ignores anything else", () => {
    localStorage.setItem("pitwall.prefs", JSON.stringify({ difficulty: "hard" }));
    expect(loadPrefs().difficulty).toBe("hard");
    localStorage.setItem("pitwall.prefs", JSON.stringify({ difficulty: "nightmare" }));
    expect(loadPrefs().difficulty).toBe("normal");
  });
});
