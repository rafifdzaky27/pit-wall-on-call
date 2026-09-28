import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { synth, type SoundName } from "./sound";
import { renderOs } from "./testing";
import { useSoundCues } from "./useSoundCues";
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

let play: MockInstance<(name: SoundName) => void>;
let stop: MockInstance<() => void>;
const pagers = () => play.mock.calls.filter((c) => c[0] === "pager").length;

beforeEach(() => {
  vi.useFakeTimers();
  play = vi.spyOn(synth, "play").mockImplementation(() => {});
  stop = vi.spyOn(synth, "stop").mockImplementation(() => {});
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

  it("follows the volume and mute preferences", () => {
    renderOs(<Cues />);
    expect(synth.volume).toBe(0.7);
    expect(synth.muted).toBe(false);
  });
});

describe("useStartShift", () => {
  it("unlocks audio, requests full screen and starts the shift in one click", () => {
    const request = vi.fn(async () => undefined);
    Object.assign(document.documentElement, { requestFullscreen: request });
    const unlock = vi.spyOn(synth, "unlock").mockImplementation(() => {});
    const { incident } = renderOs(<Cues />);
    fireEvent.click(screen.getByRole("button", { name: "Start shift" }));
    expect(request).toHaveBeenCalled();
    expect(unlock).toHaveBeenCalled();
    expect(incident().phase).toBe("prepage");
  });
});
