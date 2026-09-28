import { act, cleanup, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderOs } from "../os/testing";
import { RESULTS_DELAY_MS } from "./ResultsCard";
import { COLD_CLOSE_DELAY_MS, Stage } from "./Stage";

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

function finished() {
  const view = renderOs(
    <Stage>
      <p>laptop screen</p>
    </Stage>,
  );
  const { incident } = view;
  act(() => incident().start());
  act(() => incident().skipPrepage());
  act(() => incident().acknowledge());
  seconds(3);
  act(() => incident().dispatch("checkout.rollback"));
  seconds(45);
  act(() => vi.advanceTimersByTime(COLD_CLOSE_DELAY_MS));
  return view;
}
// The first test pays for the report chunk's cold import.
vi.setConfig({ testTimeout: 20_000 });

const card = () => screen.getByRole("dialog", { name: "Shift report" });
/** The report is a lazy chunk; give the import time to land. */
const opened = async () => {
  await act(async () => vi.advanceTimersByTimeAsync(RESULTS_DELAY_MS));
  await vi.waitFor(() => card(), { timeout: 15000 });
};

describe("the shift report (M2.5 spec §6)", () => {
  it("opens by itself after the cold close caption, with the score", async () => {
    finished();
    expect(screen.queryByRole("dialog", { name: "Shift report" })).toBeNull();
    await opened();
    expect(within(card()).getByRole("heading", { level: 2 }).textContent).toMatch(/^Resolved in \d\d:\d\d$/);
    expect(within(card()).getByText("Budget burned")).toBeTruthy();
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
});
