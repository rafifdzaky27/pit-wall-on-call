import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { DailyProvider } from "../net/daily";
import { SubmissionProvider } from "../net/SubmissionProvider";
import { IncidentProvider, ShiftScope, useIncident, type IncidentApi } from "../os/incident/IncidentProvider";
import { PrefsProvider } from "../os/PrefsProvider";
import { OsProvider } from "../os/shell/OsContext";
import { loadCafe, loadResults, Stage } from "./Stage";

beforeAll(async () => {
  await Promise.all([loadCafe(), loadResults()]);
});
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const art = () => document.querySelector(".cafe-art")!.getAttribute("aria-label")!;

describe("New shift from the café (M2.5 follow-up: the flicker)", () => {
  it("keeps the old city while the camera goes back to the laptop, then swaps it in unseen, with no curtain", () => {
    // Seed 1 is Jakarta, seed 2 (the next shift) Tokyo.
    // As in App: the Stage outlives shifts; only what is inside ShiftScope starts over.
    let api: IncidentApi | null = null;
    function Capture() {
      api = useIncident();
      return null;
    }
    const seeds = [1, 2, 3];
    render(
      <PrefsProvider>
        <DailyProvider fetchDaily={() => new Promise(() => {})}>
        <IncidentProvider newSeed={() => seeds.shift() ?? 9} now={() => Date.now()}>
          <SubmissionProvider>
            <Capture />
            <Stage>
              <ShiftScope>
                <OsProvider>
                  <p>laptop screen</p>
                </OsProvider>
              </ShiftScope>
            </Stage>
          </SubmissionProvider>
        </IncidentProvider>
        </DailyProvider>
      </PrefsProvider>,
    );
    const incident = () => api!;
    act(() => incident().start());
    act(() => incident().skipPrepage());
    act(() => incident().acknowledge());
    act(() => vi.advanceTimersByTime(481_000));
    act(() => vi.advanceTimersByTime(3_000));
    expect(incident().phase).toBe("ended");
    expect(art()).toMatch(/^A café in Jakarta/);
    act(() => incident().newShift());
    act(() => vi.advanceTimersByTime(300));
    // Mid-move: still Jakarta, and nothing flashes over it.
    expect(art()).toMatch(/^A café in Jakarta/);
    expect(document.querySelector(".cafe-curtain")).toBeNull();
    act(() => vi.advanceTimersByTime(2_000));
    expect(art()).toMatch(/^A café in Tokyo/);
  });

  it("never holds the old city once you look at the café again, even straight after New shift (review 1)", () => {
    let api: IncidentApi | null = null;
    function Capture() {
      api = useIncident();
      return null;
    }
    const seeds = [1, 2, 3];
    render(
      <PrefsProvider>
        <DailyProvider fetchDaily={() => new Promise(() => {})}>
        <IncidentProvider newSeed={() => seeds.shift() ?? 9} now={() => Date.now()}>
          <SubmissionProvider>
            <Capture />
            <Stage>
              <ShiftScope>
                <OsProvider>
                  <p>laptop screen</p>
                </OsProvider>
              </ShiftScope>
            </Stage>
          </SubmissionProvider>
        </IncidentProvider>
        </DailyProvider>
      </PrefsProvider>,
    );
    const incident = () => api!;
    act(() => incident().start());
    act(() => incident().skipPrepage());
    act(() => incident().acknowledge());
    act(() => vi.advanceTimersByTime(481_000));
    act(() => vi.advanceTimersByTime(3_000));
    // The cold close has pulled back: you are looking at the café.
    expect(document.querySelector(".stage")!.classList.contains("in-cafe")).toBe(true);
    expect(art()).toMatch(/^A café in Jakarta/);
    act(() => incident().newShift());
    act(() => vi.advanceTimersByTime(300));
    expect(art()).toMatch(/^A café in Jakarta/);
    // Start shift before the camera has settled at the laptop: the café you look up at is the new city.
    act(() => incident().start());
    expect(art()).toMatch(/^A café in Tokyo/);
  });
});
