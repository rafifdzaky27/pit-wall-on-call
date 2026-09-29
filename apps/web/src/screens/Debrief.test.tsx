import { ACK, inspectAction, replay } from "@pitwall/engine";
import { slowLeak } from "@pitwall/scenarios";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { formatClock } from "../game/format";
import { burnLabel, DebriefBody } from "./Debrief";

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
  const onNewShift = vi.fn();
  render(
    <DebriefBody
      scenario={slowLeak}
      result={result}
      clueTotal={2}
      actions={
        <button type="button" onClick={onNewShift}>
          New shift
        </button>
      }
    />,
  );
  return { onNewShift };
};

describe("Debrief", () => {
  it("names what only hid the symptom (M2.5 spec §3)", () => {
    const masked = replay(slowLeak, 1, [
      { tick: 20, actionId: ACK },
      { tick: 30, actionId: "postgres.failover" },
      { tick: 400, actionId: "checkout.rollback" },
    ]);
    show(masked);
    const section = screen.getByRole("region", { name: "Symptom or cause" });
    expect(section.textContent).toContain("Fail over to replica reset the pool, so the errors stopped. The leak in v142 kept running.");
  });

  it("leaves that section out when nothing masked the symptom", () => {
    show();
    expect(screen.queryByRole("region", { name: "Symptom or cause" })).toBeNull();
  });

  it("headlines a resolved run with its score tiles", () => {
    show();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/^Resolved in \d\d:\d\d$/);
    const tiles = screen.getByRole("list", { name: "Score" });
    expect(within(tiles).getByText("Found")).toBeTruthy();
    expect(within(tiles).getByText("00:02")).toBeTruthy();
    expect(within(tiles).getByText("1/2")).toBeTruthy();
  });

  it("shows when the fix was mitigated and when it was confirmed (M1.6 F2)", () => {
    show();
    const tiles = screen.getByRole("list", { name: "Score" });
    expect(within(tiles).getByText(formatClock(perfect.mitigatedAtTick!))).toBeTruthy();
    expect(within(tiles).getByText(`Confirmed ${formatClock(perfect.endTick)}`)).toBeTruthy();
    cleanup();
    show(dnf);
    expect(screen.queryByText(/^Confirmed/)).toBeNull();
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
    fireEvent.click(screen.getByRole("button", { name: "New shift" }));
    expect(h.onNewShift).toHaveBeenCalled();
  });

  it("names side-effect burn after the action", () => {
    expect(burnLabel("side_effect:checkout.restart", slowLeak)).toBe("Side effect: Restart pods");
    expect(burnLabel("mitigated_unfixed", slowLeak)).toBe("Mitigated, cause still active");
  });
});
