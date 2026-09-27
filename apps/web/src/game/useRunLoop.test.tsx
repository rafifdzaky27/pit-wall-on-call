import { ACK, Run, type State } from "@pitwall/engine";
import { slowLeak } from "@pitwall/scenarios";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRunLoop } from "./useRunLoop";

const now = () => Date.now();
const setHidden = (hidden: boolean) => {
  Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
  document.dispatchEvent(new Event("visibilitychange"));
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  setHidden(false);
});

describe("useRunLoop", () => {
  it("does not tick while inactive", () => {
    const run = new Run<State>(slowLeak, 1);
    const { result } = renderHook(() => useRunLoop(run, { active: false, onFinish: vi.fn(), now }));
    act(() => vi.advanceTimersByTime(2000));
    expect(result.current.snapshot.tick).toBe(0);
  });

  it("advances 10 ticks per real second", () => {
    const run = new Run<State>(slowLeak, 1);
    const { result } = renderHook(() => useRunLoop(run, { active: true, onFinish: vi.fn(), now }));
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.snapshot.tick).toBe(10);
    expect(result.current.history["checkout.pool"]!.length).toBeGreaterThanOrEqual(2);
  });

  it("pauses when the tab is hidden and loses no time on resume", () => {
    const run = new Run<State>(slowLeak, 1);
    const { result } = renderHook(() => useRunLoop(run, { active: true, onFinish: vi.fn(), now }));
    act(() => vi.advanceTimersByTime(500));
    act(() => setHidden(true));
    act(() => vi.advanceTimersByTime(30_000));
    expect(result.current.paused).toBe(true);
    expect(result.current.snapshot.tick).toBe(5);
    act(() => result.current.resume());
    act(() => vi.advanceTimersByTime(500));
    expect(result.current.paused).toBe(false);
    expect(result.current.snapshot.tick).toBe(10);
  });

  it("starts paused when the tab is already hidden as the clock starts", () => {
    const run = new Run<State>(slowLeak, 1);
    act(() => setHidden(true));
    const { result } = renderHook(() => useRunLoop(run, { active: true, onFinish: vi.fn(), now }));
    act(() => vi.advanceTimersByTime(10_000));
    expect(result.current.paused).toBe(true);
    expect(result.current.snapshot.tick).toBe(0);
  });

  it("reports the result once when the run ends", () => {
    const run = new Run<State>(slowLeak, 1);
    run.dispatch(ACK);
    run.dispatch("checkout.rollback");
    const onFinish = vi.fn();
    renderHook(() => useRunLoop(run, { active: true, onFinish, now }));
    act(() => vi.advanceTimersByTime(60_000));
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(onFinish.mock.calls[0]![0].outcome).toBe("resolved");
  });

  it("refresh() shows a dispatched action immediately", () => {
    const run = new Run<State>(slowLeak, 1);
    const { result } = renderHook(() => useRunLoop(run, { active: true, onFinish: vi.fn(), now }));
    run.dispatch(ACK);
    act(() => result.current.refresh());
    expect(result.current.snapshot.acked).toBe(true);
  });
});
