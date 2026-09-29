import { dailyFor, dayStartMs } from "@pitwall/scenarios";
import { act, cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DailyProvider, ROLLOVER_CHECK_MS, useDaily } from "./daily";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  localStorage.clear();
});

function setup(clock: { t: number }, fetchDaily: () => Promise<ReturnType<typeof dailyFor>>) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <DailyProvider now={() => clock.t} fetchDaily={fetchDaily}>
      {children}
    </DailyProvider>
  );
  return renderHook(() => useDaily(), { wrapper });
}

describe("today's daily (M3 spec Y1, Y13)", () => {
  it("is known at once from the shared function, even with the API down (Review Focus 4)", async () => {
    const clock = { t: dayStartMs("2026-10-05") + 3_600_000 };
    const { result } = setup(clock, () => Promise.reject(new Error("offline")));
    expect(result.current.daily).toEqual(dailyFor("2026-10-05"));
    await act(async () => {});
    expect(result.current.daily).toEqual(dailyFor("2026-10-05"));
  });

  it("rolls over at 00:00 UTC, and forgets yesterday's rank", async () => {
    const clock = { t: dayStartMs("2026-10-06") - 30_000 };
    localStorage.setItem("pitwall.daily.2026-10-05", JSON.stringify({ rank: 3, total: 40 }));
    const { result } = setup(clock, () => new Promise(() => {}));
    expect(result.current.played).toEqual({ rank: 3, total: 40 });
    clock.t += ROLLOVER_CHECK_MS;
    act(() => vi.advanceTimersByTime(ROLLOVER_CHECK_MS));
    expect(result.current.daily.date).toBe("2026-10-06");
    expect(result.current.played).toBeNull();
  });

  it("remembers today's rank once posted", () => {
    const clock = { t: dayStartMs("2026-10-05") };
    const { result } = setup(clock, () => new Promise(() => {}));
    act(() => result.current.markPlayed("2026-10-05", { rank: 12, total: 340 }));
    expect(result.current.played).toEqual({ rank: 12, total: 340 });
    expect(JSON.parse(localStorage.getItem("pitwall.daily.2026-10-05")!)).toEqual({ rank: 12, total: 340 });
  });
});
