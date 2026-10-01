import { dailyFor, slowLeak, utcDate } from "@pitwall/scenarios";
import { act, cleanup, renderHook } from "@testing-library/react";
import { StrictMode, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IncidentProvider, useIncident } from "./IncidentProvider";

const spy = vi.fn();
const calls = () => spy.mock.calls.map(([name, props]) => [name, props]);

beforeEach(() => {
  vi.useFakeTimers();
  spy.mockClear();
  (window as { umami?: unknown }).umami = { track: spy };
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  delete (window as { umami?: unknown }).umami;
});

function setup() {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <StrictMode>
      <IncidentProvider scenario={slowLeak} newSeed={() => 1} prepageMs={18_000} now={() => Date.now()}>
        {children}
      </IncidentProvider>
    </StrictMode>
  );
  return renderHook(() => useIncident(), { wrapper });
}

const tick = (s: number) => act(() => void vi.advanceTimersByTime(s * 1000));

describe("funnel events from the incident (M5 spec L5-4)", () => {
  it("a practice shift sends shift_start once, under StrictMode, and nothing while idle", () => {
    const { result } = setup();
    expect(calls()).toEqual([]);
    act(() => result.current.start());
    act(() => result.current.start());
    tick(1);
    expect(calls()).toEqual([["shift_start", { incident: "db-pool-exhaustion", mode: "practice" }]]);
  });

  it("a daily starts as mode daily; training as mode training", () => {
    const { result } = setup();
    act(() => result.current.startDaily(dailyFor(utcDate(Date.now()))));
    expect(calls()).toHaveLength(1);
    expect(calls()[0]![1]).toMatchObject({ mode: "daily" });
    spy.mockClear();
    act(() => result.current.startTraining());
    expect(calls()).toEqual([["shift_start", { incident: expect.any(String), mode: "training" }]]);
  });

  it("sends ack once, when the page is acknowledged, not for a refused ack", () => {
    const { result } = setup();
    act(() => result.current.start());
    act(() => result.current.acknowledge());
    expect(calls().filter(([n]) => n === "ack")).toHaveLength(0);
    act(() => result.current.skipPrepage());
    act(() => result.current.acknowledge());
    act(() => result.current.acknowledge());
    expect(calls().filter(([n]) => n === "ack")).toHaveLength(1);
  });

  it("sends shift_finish once with the result when the run ends", () => {
    const { result } = setup();
    act(() => result.current.start());
    act(() => result.current.skipPrepage());
    act(() => result.current.acknowledge());
    tick(3);
    act(() => result.current.dispatch("checkout.rollback"));
    for (let s = 0; s < 120 && result.current.phase !== "ended"; s++) tick(1);
    tick(5);
    expect(result.current.phase).toBe("ended");
    expect(calls().filter(([n]) => n === "shift_finish")).toEqual([["shift_finish", { result: "resolved", incident: "db-pool-exhaustion", mode: "practice" }]]);
  });

  it("an unanswered page ends as dnf", () => {
    const { result } = setup();
    act(() => result.current.start());
    act(() => result.current.skipPrepage());
    for (let s = 0; s < 1200 && result.current.phase !== "ended"; s++) tick(1);
    const finish = calls().filter(([n]) => n === "shift_finish");
    expect(finish).toHaveLength(1);
    expect(finish[0]![1]).toMatchObject({ result: "dnf" });
  });
});
