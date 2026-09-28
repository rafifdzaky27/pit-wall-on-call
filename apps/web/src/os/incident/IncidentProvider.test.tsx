import { act, cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IncidentProvider, useIncident } from "./IncidentProvider";

const now = () => Date.now();

function setup(seeds = [1, 2, 3]) {
  const queue = [...seeds];
  const newSeed = () => queue.shift() ?? 99;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <IncidentProvider newSeed={newSeed} prepageMs={18_000} now={now}>
      {children}
    </IncidentProvider>
  );
  return renderHook(() => useIncident(), { wrapper });
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("IncidentProvider", () => {
  it("starts idle, with the world of the next shift already chosen", () => {
    const { result } = setup();
    expect(result.current.phase).toBe("idle");
    expect(result.current.seed).toBe(1);
    expect(result.current.world.city.id).toBeTruthy();
    expect(result.current.snapshot.tick).toBe(0);
  });

  it("runs start → pre-page → page (after 18 s) → ack → active", () => {
    const { result } = setup();
    act(() => result.current.start());
    expect(result.current.phase).toBe("prepage");
    act(() => vi.advanceTimersByTime(17_999));
    expect(result.current.phase).toBe("prepage");
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.phase).toBe("paging");
    act(() => vi.advanceTimersByTime(2000));
    expect(result.current.snapshot.tick).toBe(20);
    act(() => result.current.acknowledge());
    expect(result.current.phase).toBe("active");
    expect(result.current.snapshot.ackTick).toBe(20);
  });

  it("skipPrepage pages immediately; acknowledge before the page does nothing", () => {
    const { result } = setup();
    act(() => result.current.start());
    act(() => result.current.acknowledge());
    expect(result.current.phase).toBe("prepage");
    act(() => result.current.skipPrepage());
    expect(result.current.phase).toBe("paging");
  });

  it("records each hotspot inspect once", () => {
    const { result } = setup();
    act(() => result.current.inspect("laptop.slack.deploys"));
    act(() => result.current.inspect("laptop.slack.deploys"));
    expect(result.current.snapshot.inspected).toEqual(["laptop.slack.deploys"]);
    expect(result.current.timeline.filter((e) => e.kind === "inspect")).toHaveLength(1);
  });

  it("newShift picks a new seed and cancels the old pre-page timer", () => {
    const { result } = setup();
    act(() => result.current.start());
    act(() => result.current.newShift());
    expect(result.current.seed).toBe(2);
    expect(result.current.phase).toBe("idle");
    act(() => vi.advanceTimersByTime(30_000));
    expect(result.current.phase).toBe("idle");
  });

  it("ends with a result when the run resolves", () => {
    const { result } = setup();
    act(() => result.current.start());
    act(() => result.current.skipPrepage());
    act(() => result.current.acknowledge());
    act(() => result.current.dispatch("checkout.rollback"));
    act(() => vi.advanceTimersByTime(60_000));
    expect(result.current.phase).toBe("ended");
    expect(result.current.result?.outcome).toBe("resolved");
  });

  it("useIncident outside the provider fails loudly", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useIncident())).toThrow(/IncidentProvider/);
  });
});
