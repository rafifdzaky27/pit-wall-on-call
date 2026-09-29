import { act, cleanup, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSubmission } from "../../net/SubmissionProvider";
import { loadPrefs } from "../prefs";
import { useNoticeFeed } from "../shell/noticeFeed";
import { renderOs } from "../testing";
import { CoachCard } from "./CoachCard";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  localStorage.clear();
});

const seconds = (n: number) => {
  for (let i = 0; i < n; i++) act(() => vi.advanceTimersByTime(1000));
};
const coach = () => screen.getByRole("region", { name: "Training coach" });
const step = () => within(coach()).getByRole("status").textContent;

describe("the training shift (M2.5 spec §5)", () => {
  it("coaches one step at a time, from the page to the report, and remembers it was done", () => {
    const { incident } = renderOs(<CoachCard />);
    act(() => incident().startTraining());
    expect(incident().scenario.id).toBe("training-config-push");
    expect(incident().phase).toBe("prepage");
    expect(step()).toMatch(/^Nothing is broken yet/);
    act(() => incident().skipPrepage());
    expect(step()).toMatch(/^The pager is ringing/);
    act(() => incident().acknowledge());
    expect(step()).toMatch(/^Select shop-api/);
    act(() => incident().dispatch("api.logs"));
    seconds(4);
    expect(step()).toMatch(/config history/);
    act(() => incident().dispatch("api.config"));
    seconds(4);
    // Tell customers before fixing: the update is never blocked by a running rollback (review I3).
    expect(step()).toMatch(/status update/);
    act(() => incident().dispatch("global.status_update"));
    seconds(6);
    expect(step()).toMatch(/roll the config back/);
    act(() => incident().dispatch("api.config_rollback"));
    expect(step()).toMatch(/^Watch the fix hold/);
    seconds(27);
    expect(incident().phase).toBe("ended");
    expect(step()).toMatch(/shift report/);
    expect(loadPrefs().trainingDone).toBe(true);
  });

  it("never gets stuck: once the run is over, the report is the step, whatever was skipped (review I3)", () => {
    const { incident } = renderOs(<CoachCard />);
    act(() => incident().startTraining());
    act(() => incident().skipPrepage());
    act(() => incident().acknowledge());
    act(() => incident().dispatch("api.config_rollback"));
    seconds(27);
    expect(incident().phase).toBe("ended");
    expect(step()).toMatch(/shift report/);
  });

  it("Show me outlines the control for the current step", () => {
    const { incident } = renderOs(
      <>
        <CoachCard />
        <button type="button" data-coach="ack">
          Acknowledge
        </button>
      </>,
    );
    act(() => incident().startTraining());
    act(() => incident().skipPrepage());
    fireEvent.click(within(coach()).getByRole("button", { name: "Show me" }));
    expect(screen.getByRole("button", { name: "Acknowledge" }).classList.contains("coach-highlight")).toBe(true);
    seconds(4);
    expect(screen.getByRole("button", { name: "Acknowledge" }).classList.contains("coach-highlight")).toBe(false);
  });

  it("is not there on a real shift", () => {
    const { incident } = renderOs(<CoachCard />);
    act(() => incident().start());
    expect(screen.queryByRole("region", { name: "Training coach" })).toBeNull();
  });

  it("a training shift is never posted, even with a handle", () => {
    localStorage.setItem("pitwall.player", JSON.stringify({ playerId: "p", handle: "h", tag: "abcd", token: `pw_${"a".repeat(43)}` }));
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    let kind = "";
    function Probe() {
      kind = useSubmission().state.kind;
      return null;
    }
    const { incident } = renderOs(<Probe />);
    act(() => incident().startTraining());
    act(() => incident().skipPrepage());
    act(() => incident().acknowledge());
    act(() => incident().dispatch("api.config_rollback"));
    seconds(30);
    expect(incident().phase).toBe("ended");
    expect(fetch).not.toHaveBeenCalled();
    expect(kind).toBe("idle");
  });

  it("the first visit puts Training first; after it, Start shift", () => {
    function Feed() {
      useNoticeFeed(() => {});
      return null;
    }
    const first = renderOs(<Feed />);
    expect(first.os().notices.find((n) => n.id === "shift")!.actions.map((a) => a.label)).toEqual(["Training shift (about 3 min)", "Start shift"]);
    cleanup();
    const later = renderOs(<Feed />, { prefs: { trainingDone: true } });
    expect(later.os().notices.find((n) => n.id === "shift")!.actions.map((a) => a.label)).toEqual(["Start shift", "Training shift (about 3 min)"]);
  });
});
