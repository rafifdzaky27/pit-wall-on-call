import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatClock } from "../game/format";
import { renderOs } from "../os/testing";
import { RESULTS_DELAY_MS } from "./ResultsCard";
import { COLD_CLOSE_DELAY_MS, Stage } from "./Stage";

// The report is a lazy chunk; its first import is slow under vitest.
vi.setConfig({ testTimeout: 20_000 });

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const seconds = (n: number) => {
  for (let i = 0; i < n; i++) act(() => vi.advanceTimersByTime(1000));
};

function stage() {
  return renderOs(
    <Stage>
      <p>laptop screen</p>
    </Stage>,
  );
}

describe("cold close", () => {
  it("after the fix holds, pulls back to the café with a caption, then the report leads to the postmortem", async () => {
    const { incident } = stage();
    act(() => incident().start());
    act(() => incident().skipPrepage());
    act(() => incident().acknowledge());
    act(() => incident().dispatch("checkout.rollback"));
    seconds(45);
    expect(incident().phase).toBe("ended");
    act(() => vi.advanceTimersByTime(COLD_CLOSE_DELAY_MS));
    const end = incident().result!.endTick;
    expect(screen.getByRole("status").textContent).toBe(`Checkout is back. Resolved in ${formatClock(end)}.`);
    // The shift report opens by itself and takes focus (M2.5 spec §6).
    await act(async () => vi.advanceTimersByTimeAsync(RESULTS_DELAY_MS));
    const report = await vi.waitFor(() => screen.getByRole("dialog", { name: "Shift report" }), { timeout: 15000 });
    expect(document.activeElement).toBe(report);
    fireEvent.click(screen.getByRole("button", { name: "Read the postmortem" }));
    expect(screen.queryByRole("dialog", { name: "Shift report" })).toBeNull();
    expect(document.querySelector("[data-testid=stage-screen]")!.hasAttribute("inert")).toBe(false);
  });

  it("says so when the shift ended without a fix", () => {
    const { incident } = stage();
    act(() => incident().start());
    act(() => incident().skipPrepage());
    act(() => incident().acknowledge());
    seconds(481);
    act(() => vi.advanceTimersByTime(COLD_CLOSE_DELAY_MS));
    expect(screen.getByRole("status").textContent).toBe(`Checkout is still down. The shift ended at ${formatClock(incident().result!.endTick)}.`);
  });

  it("keeps its end state when you look up again after reading the postmortem", async () => {
    const { incident } = stage();
    act(() => incident().start());
    act(() => incident().skipPrepage());
    act(() => incident().acknowledge());
    seconds(481);
    act(() => vi.advanceTimersByTime(COLD_CLOSE_DELAY_MS));
    // The lazy café chunk's first import can take over 1 s under a full parallel `pnpm test`.
    await vi.waitFor(() => expect(screen.getByRole("img", { name: /^A café in .* at night$/ })).toBeTruthy(), { timeout: 5000 });
    await act(async () => vi.advanceTimersByTimeAsync(RESULTS_DELAY_MS));
    fireEvent.click(await vi.waitFor(() => screen.getByRole("button", { name: "Read the postmortem" }), { timeout: 15000 }));
    fireEvent.keyDown(window, { key: "l" });
    expect(screen.getByRole("img", { name: /^A café in / }).getAttribute("aria-label")).toMatch(/at night$/);
    expect(document.querySelector(".patron.at-table")).toBeNull();
  });
});
