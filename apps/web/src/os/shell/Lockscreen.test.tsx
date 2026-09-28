import { cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderOs } from "../testing";
import { Lockscreen } from "./Lockscreen";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Lockscreen", () => {
  it("on a small screen, pitches the game and explains the laptop requirement", () => {
    renderOs(<Lockscreen />);
    expect(screen.getByRole("heading", { level: 1, name: "Pit Wall On-Call" })).toBeTruthy();
    expect(screen.getByText(/needs a screen at least 1024 px wide/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Unlock" })).toBeNull();
  });

  it("shows no personal facts about the developer", () => {
    renderOs(<Lockscreen />);
    expect(screen.queryByRole("heading", { name: "About the developer" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Another fact" })).toBeNull();
  });

  it("on a small screen, shows the practice leaderboard under the card (M2)", async () => {
    const board = { board: "practice", scenarioId: "db-pool-exhaustion", total: 0, entries: [], you: null };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(board), { status: 200, headers: { "content-type": "application/json" } })));
    renderOs(<Lockscreen />);
    expect(await screen.findByRole("heading", { level: 1, name: "Practice leaderboard" })).toBeTruthy();
    expect(await screen.findByText("No shifts posted yet. Finish a shift and post it from its postmortem.")).toBeTruthy();
  });

  it("with an Unlock button (a wide screen), shows no leaderboard", () => {
    renderOs(<Lockscreen onUnlock={() => {}} />);
    expect(screen.queryByRole("heading", { name: "Practice leaderboard" })).toBeNull();
  });
});
