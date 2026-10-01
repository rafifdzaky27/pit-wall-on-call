import { act, cleanup, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { dailyFor, utcDate } from "@pitwall/scenarios";
import { renderOs } from "../os/testing";
import { RESULTS_DELAY_MS } from "./ResultsCard";
import { COLD_CLOSE_DELAY_MS, loadResults, Stage } from "./Stage";

const board = { board: "practice", scenarioId: "db-pool-exhaustion", total: 1, entries: [{ rank: 1, handle: "ana", tag: "ab12", budgetBurnedBp: 253, mitigatedAtTick: 389, outcome: "resolved", runId: "r1", you: false }], you: null };

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(board), { status: 200, headers: { "content-type": "application/json" } })));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  localStorage.clear();
});

const seconds = (n: number) => {
  for (let i = 0; i < n; i++) act(() => vi.advanceTimersByTime(1000));
};

function finished({ daily = false } = {}) {
  const view = renderOs(
    <Stage>
      <p>laptop screen</p>
    </Stage>,
  );
  const { incident } = view;
  act(() => (daily ? incident().startDaily(dailyFor(utcDate(Date.now()))) : incident().start()));
  act(() => incident().skipPrepage());
  act(() => incident().acknowledge());
  seconds(3);
  act(() => incident().dispatch("checkout.rollback"));
  // Stop the moment the run ends; the caption follows COLD_CLOSE_DELAY_MS later, the report after that.
  for (let s = 0; s < 60 && incident().phase !== "ended"; s++) seconds(1);
  act(() => vi.advanceTimersByTime(COLD_CLOSE_DELAY_MS));
  return view;
}
// The report module loads once up front, so it renders without suspending under fake timers.
beforeAll(async () => {
  await loadResults();
});

const card = () => screen.getByRole("dialog", { name: "Shift report" });
/** The report is a lazy chunk; give the import time to land. */
const opened = async () => {
  await act(async () => vi.advanceTimersByTimeAsync(RESULTS_DELAY_MS));
  await vi.waitFor(() => card());
};

describe("the shift report (M2.5 spec §6)", () => {
  it("opens by itself after the cold close caption, with the score", async () => {
    finished();
    expect(screen.queryByRole("dialog", { name: "Shift report" })).toBeNull();
    await opened();
    expect(within(card()).getByRole("heading", { level: 2 }).textContent).toMatch(/^Resolved in \d\d:\d\d$/);
    expect(within(card()).getAllByText("Budget burned")[0]!.tagName).toBe("DT");
    // No handle yet: the handle field is right here, above the top of the board.
    expect(within(card()).getByRole("textbox", { name: "Handle" })).toBeTruthy();
    await vi.waitFor(() => within(card()).getByRole("table", { name: "Practice leaderboard" }));
  });

  it("Share copies the spoiler-free text", async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>(async () => {});
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    finished();
    await opened();
    await act(async () => fireEvent.click(within(card()).getByRole("button", { name: "Share" })));
    expect(writeText.mock.calls[0]![0]).toMatch(/^Pit Wall On-Call · The Slow Leak\nBudget burned: /);
    expect(within(card()).getByText("Copied to the clipboard.")).toBeTruthy();
  });

  it("Share sends one share_click per click, whether or not the copy works", async () => {
    const track = vi.fn();
    (window as { umami?: unknown }).umami = { track };
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText: vi.fn(async () => Promise.reject(new Error("denied"))) } });
    finished();
    await opened();
    track.mockClear();
    await act(async () => fireEvent.click(within(card()).getByRole("button", { name: "Share" })));
    expect(track.mock.calls).toEqual([["share_click", undefined]]);
    await act(async () => fireEvent.click(within(card()).getByRole("button", { name: "Share" })));
    expect(track).toHaveBeenCalledTimes(2);
    delete (window as { umami?: unknown }).umami;
  });

  it("a daily says which one, shows today's board, and shares as the daily (M3 spec Y11, Y12)", async () => {
    const today = dailyFor(utcDate(Date.now()));
    const writeText = vi.fn<(text: string) => Promise<void>>(async () => {});
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    finished({ daily: true });
    await opened();
    expect(within(card()).getByText(`Daily #${today.number} · Shift report`)).toBeTruthy();
    await vi.waitFor(() => within(card()).getByRole("table", { name: "Daily leaderboard" }));
    await act(async () => fireEvent.click(within(card()).getByRole("button", { name: "Share" })));
    expect(writeText.mock.calls[0]![0].split("\n")[0]).toBe(`Pit Wall On-Call · Daily #${today.number}`);
    expect(writeText.mock.calls[0]![0]).toMatch(/\/daily$/);
  });

  it("Full leaderboard shows the whole board inside the card", async () => {
    finished();
    await opened();
    fireEvent.click(within(card()).getByRole("button", { name: "Full leaderboard" }));
    await act(async () => vi.advanceTimersByTimeAsync(0));
    expect(within(card()).getByRole("heading", { name: "Practice leaderboard" })).toBeTruthy();
    fireEvent.click(within(card()).getByRole("button", { name: "Back to the report" }));
    expect(within(card()).getByRole("button", { name: "Share" })).toBeTruthy();
  });

  it("Read the postmortem goes into the laptop; New shift starts over", async () => {
    const { incident } = finished();
    await opened();
    fireEvent.click(within(card()).getByRole("button", { name: "Read the postmortem" }));
    expect(document.querySelector("[data-testid=stage-screen]")!.hasAttribute("inert")).toBe(false);
    expect(screen.queryByRole("dialog", { name: "Shift report" })).toBeNull();
    act(() => incident().newShift());
    expect(incident().phase).toBe("idle");
  });

  it("New shift from the card starts the next shift", async () => {
    const { incident } = finished();
    await opened();
    const seed = incident().seed;
    fireEvent.click(within(card()).getByRole("button", { name: "New shift" }));
    expect(incident().seed).not.toBe(seed);
    expect(incident().phase).toBe("idle");
  });

  it("after the training shift, says Training complete and leads to a real shift, with no board", async () => {
    const view = renderOs(
      <Stage>
        <p>laptop screen</p>
      </Stage>,
    );
    const { incident } = view;
    act(() => incident().startTraining());
    act(() => incident().skipPrepage());
    act(() => incident().acknowledge());
    seconds(3);
    act(() => incident().dispatch("api.config_rollback"));
    seconds(30);
    act(() => vi.advanceTimersByTime(COLD_CLOSE_DELAY_MS));
    await opened();
    expect(within(card()).getByRole("heading", { level: 2 }).textContent).toBe("Training complete");
    // No status update was posted in this run, so the report does not claim one (review I3).
    expect(card().textContent).not.toContain("told customers");
    expect(card().textContent).toContain("Next time, post a status update");
    expect(within(card()).queryByRole("region", { name: "Leaderboard" })).toBeNull();
    expect(within(card()).queryByRole("button", { name: "Share" })).toBeNull();
    fireEvent.click(within(card()).getByRole("button", { name: "Start a real shift" }));
    expect(incident().scenario.id).toBe("db-pool-exhaustion");
    expect(incident().phase).toBe("idle");
  });
});
