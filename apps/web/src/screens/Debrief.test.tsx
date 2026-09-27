import { ACK, inspectAction, replay } from "@pitwall/engine";
import { slowLeak } from "@pitwall/scenarios";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { burnLabel, Debrief } from "./Debrief";

afterEach(cleanup);

const perfect = replay(slowLeak, 1, [
  { tick: 0, actionId: inspectAction("laptop.slack.deploys") },
  { tick: 20, actionId: ACK },
  { tick: 20, actionId: "checkout.pool_stats" },
  { tick: 60, actionId: "checkout.deploys" },
  { tick: 90, actionId: "checkout.rollback" },
]);
const dnf = replay(slowLeak, 1, []);

const show = (result = perfect) => {
  const handlers = { onPlayAgain: vi.fn(), onHome: vi.fn() };
  render(<Debrief scenario={slowLeak} result={result} {...handlers} />);
  return handlers;
};

describe("Debrief", () => {
  it("headlines a resolved run with its score tiles", () => {
    show();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/^Resolved in \d\d:\d\d$/);
    const tiles = screen.getByRole("list", { name: "Score" });
    expect(within(tiles).getByText("Found")).toBeTruthy();
    expect(within(tiles).getByText("00:02")).toBeTruthy();
    expect(within(tiles).getByText("1/3")).toBeTruthy();
  });

  it("headlines a DNF and says the secondary was paged", () => {
    show(dnf);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Did not finish");
    expect(screen.getByText("Never")).toBeTruthy();
    expect(screen.getByText("Not mitigated")).toBeTruthy();
    expect(screen.getByText("Secondary paged")).toBeTruthy();
  });

  it("breaks the burn down by cause, in words", () => {
    show();
    const legend = screen.getByRole("list", { name: "Budget burned by cause" });
    expect(within(legend).getByText("Before acknowledging")).toBeTruthy();
    expect(within(legend).getByText("Investigating")).toBeTruthy();
  });

  it("labels each action on the timeline with its verdict", () => {
    show();
    const timeline = screen.getByRole("list", { name: "Timeline" });
    expect(within(timeline).getByText("Roll back to v141")).toBeTruthy();
    expect(within(timeline).getAllByText("Useful").length).toBe(3);
    expect(within(timeline).getByText("Acknowledged")).toBeTruthy();
  });

  it("shows the scenario lesson and the next steps", () => {
    const h = show(dnf);
    expect(screen.getByText(/the database was a victim, not the cause/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Play again" }));
    fireEvent.click(screen.getByRole("button", { name: "Back to start" }));
    expect(h.onPlayAgain).toHaveBeenCalled();
    expect(h.onHome).toHaveBeenCalled();
  });

  it("names side-effect burn after the action", () => {
    expect(burnLabel("side_effect:checkout.restart", slowLeak)).toBe("Side effect: Restart pods");
    expect(burnLabel("mitigated_unfixed", slowLeak)).toBe("Mitigated, cause still active");
  });
});
