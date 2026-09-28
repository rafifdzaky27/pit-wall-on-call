import { ACK, Run, type Snapshot, type State } from "@pitwall/engine";
import { slowLeak } from "@pitwall/scenarios";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BROKEN_MS, HoldIndicator } from "./HoldIndicator";

const base = (): Snapshot => {
  const run = new Run<State>(slowLeak, 1);
  run.dispatch(ACK);
  return run.snapshot();
};
const at = (tick: number, stableSinceTick: number | null): Snapshot => ({ ...base(), tick, stableSinceTick });

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("HoldIndicator", () => {
  it("renders nothing until the fix starts holding", () => {
    const { container } = render(<HoldIndicator snapshot={at(50, null)} />);
    expect(container.textContent).toBe("");
  });

  it("counts down the 10 s hold with a progress bar", () => {
    render(<HoldIndicator snapshot={at(130, 100)} />);
    expect(screen.getByRole("status").textContent).toContain("Fix holding · 7 s");
    expect(screen.getByRole("progressbar", { name: "Fix holding" }).getAttribute("aria-valuenow")).toBe("3");
  });

  it("says the fix did not hold when the condition breaks, then clears", () => {
    const view = render(<HoldIndicator snapshot={at(130, 100)} />);
    view.rerender(<HoldIndicator snapshot={at(131, null)} />);
    expect(screen.getByRole("status").textContent).toBe("Fix did not hold");
    act(() => vi.advanceTimersByTime(BROKEN_MS));
    expect(screen.queryByRole("status")).toBeNull();
  });
});
