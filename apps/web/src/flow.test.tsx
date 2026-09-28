import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { loadResults } from "./cafe/Stage";

// The run loop reads performance.now(); setImmediate stays real so lazy chunks can finish loading.
beforeEach(() => vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date", "performance", "requestAnimationFrame", "cancelAnimationFrame"] }));
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  localStorage.clear();
});

const seconds = (n: number) => {
  for (let i = 0; i < n; i++) act(() => vi.advanceTimersByTime(1000));
};
/** Retries `get` while giving real I/O (lazy imports) and fake time a turn. */
async function until<T>(get: () => T, tries = 80): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return get();
    } catch (e) {
      if (i >= tries) throw e;
      await act(async () => {
        await new Promise((r) => setImmediate(r));
        // Each step re-renders the whole app, so steps are coarse.
        vi.advanceTimersByTime(100);
      });
    }
  }
}
const stage = () => document.querySelector(".stage");
const windows = () => document.querySelectorAll(".stage-screen .window:not(.closing)");

/** Start shift → skip → ack → select checkout → roll back, then `hold` seconds. */
async function playAndFix(hold: number) {
  fireEvent.click(screen.getAllByRole("button", { name: "Start shift" })[0]!);
  fireEvent.click(within(screen.getByRole("group", { name: "Café controls" })).getByRole("button", { name: "Skip to the page" }));
  fireEvent.keyDown(window, { key: "a" });
  await until(() => screen.getByRole("region", { name: "Monitoring" }));
  fireEvent.keyDown(window, { key: "2" });
  seconds(3);
  fireEvent.click(await until(() => screen.getByRole("button", { name: /Roll back to v141/ })));
  seconds(hold);
}

async function toNewShift() {
  await playAndFix(46);
  seconds(3);
  expect(screen.getByRole("region", { name: "Café" })).toBeTruthy();
  fireEvent.click((await until(() => screen.getAllByRole("button", { name: "Read the postmortem" })))[0]!);
  fireEvent.click(await until(() => screen.getByRole("button", { name: "New shift" })));
  seconds(2);
}

// The report renders without suspending once loaded (see loadResults).
beforeAll(async () => {
  await loadResults();
});

// Whole-app flows load lazy chunks; a full parallel suite needs more than the default 5 s.
vi.setConfig({ testTimeout: 30_000 });

describe("New shift keeps the camera and the café (M2.5 spec §11)", () => {
  it("lands on the desktop with no app open, and the Stage is the same element", async () => {
    let seed = 0;
    render(<App newSeed={() => ++seed} />);
    const before = stage();
    await toNewShift();
    expect(stage()).toBe(before);
    expect(document.querySelector(".stage-cafe")).not.toBeNull();
    expect(document.querySelector("[data-testid=stage-screen]")!.hasAttribute("inert")).toBe(false);
    expect(windows()).toHaveLength(0);
    expect(screen.getAllByRole("button", { name: "Start shift" }).length).toBeGreaterThan(0);
  });

  it("after New shift, Start shift goes back out to the café", async () => {
    let seed = 0;
    render(<App newSeed={() => ++seed} />);
    await toNewShift();
    fireEvent.click(screen.getAllByRole("button", { name: "Start shift" })[0]!);
    expect(document.querySelector("[data-testid=stage-screen]")!.hasAttribute("inert")).toBe(true);
    expect(document.querySelector(".stage-cafe")!.hasAttribute("inert")).toBe(false);
  });
});

describe("the cold close lead-in (M2.5 spec §11)", () => {
  it("shows Fix confirmed on the laptop before the camera pulls back", async () => {
    render(<App newSeed={() => 1} />);
    await playAndFix(0);
    let seen = false;
    for (let s = 0; s < 50 && !seen; s++) {
      seconds(1);
      seen = screen.queryByText(/^Fix confirmed · resolved in \d\d:\d\d$/) !== null;
      // While it shows, the camera is still on the laptop.
      if (seen) expect(document.querySelector("[data-testid=stage-screen]")!.hasAttribute("inert")).toBe(false);
    }
    expect(seen).toBe(true);
  });
});
