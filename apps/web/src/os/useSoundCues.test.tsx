import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import type { Cue } from "./audio/cues";
import { audio } from "./audio/engine";
import { renderOs } from "./testing";
import { pulsesBetween, useSoundCues } from "./useSoundCues";
import { useStartShift } from "./useStartShift";

function Cues({ locked = false }: { locked?: boolean }) {
  useSoundCues(locked);
  const start = useStartShift();
  return (
    <button type="button" onClick={start}>
      Start shift
    </button>
  );
}

let play: MockInstance<(name: Cue, opts?: { gain?: number }) => void>;
let stop: MockInstance<(bus?: string) => void>;
let suspend: MockInstance<() => void>;
let resume: MockInstance<() => void>;
const plays = (cue: Cue) => play.mock.calls.filter((c) => c[0] === cue);
/** Advances one second at a time, so each tick renders as it does in the browser. */
const seconds = (n: number) => {
  for (let i = 0; i < n; i++) act(() => vi.advanceTimersByTime(1000));
};
const pagers = () => play.mock.calls.filter((c) => c[0] === "pager").length;

beforeEach(() => {
  vi.useFakeTimers();
  play = vi.spyOn(audio, "play").mockImplementation(() => {});
  stop = vi.spyOn(audio, "stop").mockImplementation(() => {});
  suspend = vi.spyOn(audio, "suspend").mockImplementation(() => {});
  resume = vi.spyOn(audio, "resume").mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  delete (document.documentElement as { requestFullscreen?: unknown }).requestFullscreen;
});

describe("useSoundCues", () => {
  it("rings the pager every 2.5 s until the page is acknowledged, then chirps once", () => {
    const { incident } = renderOs(<Cues />);
    act(() => incident().start());
    act(() => incident().skipPrepage());
    expect(pagers()).toBe(1);
    act(() => vi.advanceTimersByTime(2500));
    expect(pagers()).toBe(2);
    act(() => incident().acknowledge());
    expect(stop).toHaveBeenCalled();
    expect(play).toHaveBeenLastCalledWith("ack");
    act(() => vi.advanceTimersByTime(10_000));
    expect(pagers()).toBe(2);
  });

  it("stops the pager at once when paused, and never rings while locked", () => {
    const { incident } = renderOs(<Cues />);
    act(() => incident().start());
    act(() => incident().skipPrepage());
    act(() => incident().pause());
    expect(stop).toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(10_000));
    expect(pagers()).toBe(1);
    cleanup();
    play.mockClear();
    const locked = renderOs(<Cues locked />);
    act(() => locked.incident().start());
    act(() => locked.incident().skipPrepage());
    expect(pagers()).toBe(0);
  });

  it("stays silent while the tab is hidden", () => {
    const { incident } = renderOs(<Cues />);
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    act(() => incident().start());
    act(() => incident().skipPrepage());
    expect(pagers()).toBe(0);
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
  });

  it("plays the DNF tone when the error budget runs out", () => {
    const { incident } = renderOs(<Cues />);
    act(() => incident().start());
    act(() => incident().skipPrepage());
    act(() => incident().acknowledge());
    act(() => vi.advanceTimersByTime(600_000));
    expect(incident().phase).toBe("ended");
    expect(play).toHaveBeenLastCalledWith("dnf");
  });

  it("follows the volume, level and mute preferences", () => {
    const levels = vi.spyOn(audio, "setLevels");
    renderOs(<Cues />);
    expect(levels).toHaveBeenLastCalledWith({ master: 0.7, ambience: 0.6, music: 0.5, alerts: 1, muted: false });
  });

  it("buzzes the phone with every pager repeat, and the pager grows louder every 10 s", () => {
    const { incident } = renderOs(<Cues />);
    act(() => incident().start());
    act(() => incident().skipPrepage());
    act(() => vi.advanceTimersByTime(10_000));
    expect(plays("vibrate").length).toBe(pagers());
    expect(plays("pager")[0]![1]).toEqual({ gain: 1 });
    expect(plays("pager").at(-1)![1]).toEqual({ gain: 1.25 });
    act(() => vi.advanceTimersByTime(60_000));
    expect(Math.max(...plays("pager").map((c) => c[1]!.gain!))).toBe(2);
  });

  it("sounds the escalation when the secondary is paged", () => {
    const { incident } = renderOs(<Cues />);
    act(() => incident().start());
    act(() => incident().skipPrepage());
    act(() => vi.advanceTimersByTime(61_000));
    expect(plays("escalation")).toHaveLength(1);
  });

  it("pulses when the error budget passes 50 % (the idle run stops at 72.7 %)", () => {
    const { incident } = renderOs(<Cues />);
    act(() => incident().start());
    act(() => incident().skipPrepage());
    act(() => incident().acknowledge());
    seconds(600);
    expect(plays("pulse")).toHaveLength(1);
    expect(play).toHaveBeenLastCalledWith("dnf");
  });

  it("counts the 50 % and 80 % thresholds a budget change crosses", () => {
    expect(pulsesBetween(4999, 5000)).toBe(1);
    expect(pulsesBetween(5000, 7999)).toBe(0);
    expect(pulsesBetween(7999, 8000)).toBe(1);
    expect(pulsesBetween(0, 10_000)).toBe(2);
  });

  it("marks actions, alerts and each second of the fix hold", () => {
    const { incident } = renderOs(<Cues />);
    act(() => incident().start());
    act(() => incident().skipPrepage());
    act(() => incident().acknowledge());
    act(() => incident().dispatch("checkout.rollback"));
    expect(plays("actionStart")).toHaveLength(1);
    seconds(31);
    expect(plays("actionDone")).toHaveLength(1);
    seconds(6);
    expect(plays("tick").length).toBeGreaterThanOrEqual(5);
    expect(plays("alertCleared").length).toBeGreaterThanOrEqual(1);
  });

  it("with reduced audio intensity, leaves out the pulses, escalation and fix-hold ticks", () => {
    {
      const { incident } = renderOs(<Cues />, { prefs: { reduceAudio: true } });
      act(() => incident().start());
      act(() => incident().skipPrepage());
      seconds(61);
      act(() => incident().acknowledge());
      act(() => incident().dispatch("checkout.rollback"));
      seconds(60);
      expect([plays("escalation"), plays("pulse"), plays("tick")].map((c) => c.length)).toEqual([0, 0, 0]);
    }
  });

  it("suspends all audio while paused and resumes after", () => {
    const { incident } = renderOs(<Cues />);
    act(() => incident().start());
    act(() => incident().skipPrepage());
    act(() => incident().pause());
    expect(suspend).toHaveBeenCalled();
    act(() => incident().resume());
    expect(resume).toHaveBeenCalled();
  });
});

describe("useStartShift", () => {
  it("unlocks audio, requests full screen and starts the shift in one click", () => {
    const request = vi.fn(async () => undefined);
    Object.assign(document.documentElement, { requestFullscreen: request });
    const unlock = vi.spyOn(audio, "unlock").mockImplementation(() => {});
    const { incident } = renderOs(<Cues />);
    fireEvent.click(screen.getByRole("button", { name: "Start shift" }));
    expect(request).toHaveBeenCalled();
    expect(unlock).toHaveBeenCalled();
    expect(incident().phase).toBe("prepage");
  });
});
