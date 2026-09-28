import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatClock } from "../game/format";
import { renderOs } from "../os/testing";
import { COLD_CLOSE_DELAY_MS, Stage } from "./Stage";

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
  it("after the fix holds, pulls back to the café with a caption, and the laptop leads to the postmortem", () => {
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
    const read = screen.getByRole("button", { name: "Read the postmortem" });
    expect(document.activeElement).toBe(read);
    fireEvent.click(read);
    expect(screen.queryByRole("status")).toBeNull();
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
    await vi.waitFor(() => expect(screen.getByRole("img", { name: /^A café in .* at night$/ })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Read the postmortem" }));
    fireEvent.keyDown(window, { key: "l" });
    expect(screen.getByRole("img", { name: /^A café in / }).getAttribute("aria-label")).toMatch(/at night$/);
    expect(document.querySelector(".patron.at-table")).toBeNull();
  });
});
