import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { loadCafe, loadResults } from "./cafe/Stage";

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
  await Promise.all([loadCafe(), loadResults()]);
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

describe("Review Focus 2 and 5 (M2.5 review I5)", () => {
  it("New shift straight from the report keeps the Stage and lands on an empty desktop", async () => {
    let seed = 0;
    render(<App newSeed={() => ++seed} />);
    const before = stage();
    await playAndFix(46);
    seconds(4);
    const report = await until(() => screen.getByRole("dialog", { name: "Shift report" }));
    fireEvent.click(within(report).getByRole("button", { name: "New shift" }));
    seconds(2);
    expect(stage()).toBe(before);
    expect(windows()).toHaveLength(0);
    expect(document.querySelector("[data-testid=stage-screen]")!.hasAttribute("inert")).toBe(false);
  });

  it("after the training (never posted), the real shift is posted", async () => {
    localStorage.setItem("pitwall.player", JSON.stringify({ playerId: "0c1f2e3d-0000-4000-8000-0000abcd1234", handle: "rafif", tag: "1234", token: `pw_${"a".repeat(43)}` }));
    const posted = { runId: "r1", mode: "practice", flagged: false, score: { outcome: "resolved", budgetBurnedBp: 1, mitigatedAtTick: 1, endTick: 1 }, board: { rank: 1, total: 1, best: true } };
    const fetch = vi.fn(async (url: string) => new Response(JSON.stringify(url === "/api/runs" ? posted : { board: "practice", scenarioId: "x", total: 0, entries: [], you: null }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetch);
    let seed = 0;
    render(<App newSeed={() => ++seed} />);
    // Training first: ack, roll the config back, let it hold.
    fireEvent.click(screen.getAllByRole("button", { name: "Training shift (about 3 min)" })[0]!);
    fireEvent.click(within(screen.getByRole("group", { name: "Café controls" })).getByRole("button", { name: "Skip to the page" }));
    fireEvent.keyDown(window, { key: "a" });
    await until(() => screen.getByRole("region", { name: "Monitoring" }));
    fireEvent.keyDown(window, { key: "2" });
    fireEvent.click(await until(() => screen.getByRole("button", { name: /Roll back config to v11/ })));
    seconds(30);
    seconds(4);
    const posts = () => fetch.mock.calls.filter(([url]) => url === "/api/runs");
    expect(posts()).toHaveLength(0);
    const report = await until(() => screen.getByRole("dialog", { name: "Shift report" }));
    fireEvent.click(within(report).getByRole("button", { name: "Start a real shift" }));
    seconds(2);
    await playAndFix(46);
    await act(async () => {
      await new Promise((r) => setImmediate(r));
    });
    expect(posts()).toHaveLength(1);
    expect(JSON.parse(String((posts()[0] as unknown as [string, RequestInit])[1].body)).scenarioId).toBe("db-pool-exhaustion");
    vi.unstubAllGlobals();
  });
});

