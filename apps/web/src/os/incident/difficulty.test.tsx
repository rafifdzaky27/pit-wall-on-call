import { act, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { usePrefs } from "../PrefsProvider";
import { renderOs } from "../testing";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

let prefsNow: ReturnType<typeof usePrefs>;
function Prefs() {
  prefsNow = usePrefs();
  return null;
}

describe("a shift's difficulty (M6 spec H1)", () => {
  it("follows the pref before the shift starts, then stays fixed for the shift", () => {
    const { incident } = renderOs(<Prefs />, { prefs: { difficulty: "hard" } });
    expect(incident().difficulty).toBe("hard");
    act(() => incident().start());
    act(() => prefsNow.update({ difficulty: "normal" }));
    expect(incident().difficulty).toBe("hard");
    act(() => incident().newShift());
    expect(incident().difficulty).toBe("normal");
  });

  it("is always normal for the training shift", () => {
    const { incident } = renderOs(<Prefs />, { prefs: { difficulty: "hard" } });
    act(() => incident().startTraining());
    expect(incident().difficulty).toBe("normal");
  });
});

describe("the run's state for hard-mode commands", () => {
  it("is a readable copy of the current scenario state", () => {
    const { incident } = renderOs(<Prefs />);
    act(() => incident().start());
    expect(typeof incident().runState()).toBe("object");
  });
});
