import { act, cleanup, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { savePlayer } from "../../../net/player";
import { renderOs } from "../../testing";
import { useOs } from "../../shell/OsContext";
import { LeaderboardCard as Card } from "./LeaderboardCard";

/** As the postmortem mounts it: View leaderboard opens the Browser tab. */
function LeaderboardCard() {
  const { openBrowserTab } = useOs();
  return <Card onView={() => openBrowserTab("leaderboard")} />;
}

const PLAYER = { playerId: "0c1f2e3d-0000-4000-8000-0000abcd1234", handle: "rafif", tag: "1234", token: `pw_${"a".repeat(43)}` };
const posted = (board: { rank: number | null; total: number; best: boolean }, flagged = false) => ({
  runId: "r1",
  mode: "practice",
  flagged,
  score: { outcome: "resolved", budgetBurnedBp: 253, mitigatedAtTick: 389, endTick: 489 },
  board,
});
const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
const apiError = (status: number, code: string) => json(status, { error: { code, message: code, requestId: "req-9" } }, { "x-request-id": "req-9" });

let fetchMock: ReturnType<typeof vi.fn>;
function serve(route: (url: string) => Response) {
  fetchMock = vi.fn(async (url: string) => route(url));
  vi.stubGlobal("fetch", fetchMock);
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  localStorage.clear();
});

async function finished() {
  const view = renderOs(<LeaderboardCard />);
  const { incident } = view;
  act(() => incident().start());
  act(() => incident().skipPrepage());
  act(() => incident().acknowledge());
  act(() => incident().dispatch("checkout.rollback"));
  for (let i = 0; i < 45; i++) act(() => vi.advanceTimersByTime(1000));
  await act(async () => vi.advanceTimersByTimeAsync(0));
  return view;
}
const region = () => screen.getByRole("region", { name: "Leaderboard" });
const text = () => region().textContent ?? "";

describe("the postmortem's Leaderboard section", () => {
  it("asks for a handle, validates it, then posts and shows the new best", async () => {
    serve((url) => (url === "/api/players" ? json(201, PLAYER) : json(201, posted({ rank: 12, total: 340, best: true }))));
    await finished();
    expect(text()).toContain("Pick a handle to post this shift to the practice leaderboard.");
    const field = within(region()).getByRole("textbox", { name: "Handle" });
    expect(text()).toContain("3 to 20 letters, numbers, - or _.");
    fireEvent.change(field, { target: { value: "no spaces" } });
    fireEvent.click(within(region()).getByRole("button", { name: "Post score" }));
    expect(field.getAttribute("aria-invalid")).toBe("true");
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.change(field, { target: { value: "rafif" } });
    await act(async () => {
      fireEvent.click(within(region()).getByRole("button", { name: "Post score" }));
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(text()).toContain("New best: #12 of 340 on the practice leaderboard.");
    expect(within(region()).getByRole("button", { name: "View leaderboard" })).toBeTruthy();
  });

  it("Not now says the shift was not posted, and Post score brings the form back", async () => {
    serve(() => json(500, {}));
    await finished();
    fireEvent.click(within(region()).getByRole("button", { name: "Not now" }));
    expect(text()).toContain("This shift was not posted.");
    fireEvent.click(within(region()).getByRole("button", { name: "Post score" }));
    expect(within(region()).getByRole("textbox", { name: "Handle" })).toBeTruthy();
  });

  it("says when a posted shift is not the player's best", async () => {
    savePlayer(PLAYER);
    serve(() => json(201, posted({ rank: 8, total: 340, best: false })));
    await finished();
    expect(text()).toContain("Posted. Your best is still #8 of 340.");
  });

  it("a ranked daily says where it stands on today's board (M3 spec Y11)", async () => {
    savePlayer(PLAYER);
    serve(() => json(201, { ...posted({ rank: 12, total: 340, best: true }), mode: "daily_ranked", ranked: true, dailyDate: "2026-10-05" }));
    await finished();
    expect(text()).toContain("Ranked #12 of 340 on today's daily board.");
  });

  it("a hard run says which board it landed on (M6 spec H11)", async () => {
    savePlayer(PLAYER);
    serve(() => json(201, { ...posted({ rank: 2, total: 9, best: true }), difficulty: "hard", mode: "daily_ranked", ranked: true, dailyDate: "2026-10-05" }));
    await finished();
    expect(text()).toContain("Ranked #2 of 9 on today's daily board (hard).");
  });

  it("a second daily says it was practice (M3 spec Y6)", async () => {
    savePlayer(PLAYER);
    serve(() => json(201, { ...posted({ rank: 8, total: 340, best: false }), mode: "practice", ranked: false, dailyDate: "2026-10-05" }));
    await finished();
    expect(text()).toContain("Practice: your ranked attempt at today's daily came earlier. This one counts on the practice board.");
  });

  it("says a flagged shift is held for review", async () => {
    savePlayer(PLAYER);
    serve(() => json(201, posted({ rank: null, total: 340, best: false }, true)));
    await finished();
    expect(text()).toContain("Posted and held for review. Fixes this fast are checked by hand.");
  });

  it("asks for a different handle when the server rejects it", async () => {
    serve(() => apiError(400, "handle_rejected"));
    await finished();
    fireEvent.change(within(region()).getByRole("textbox", { name: "Handle" }), { target: { value: "sh1thead" } });
    await act(async () => {
      fireEvent.click(within(region()).getByRole("button", { name: "Post score" }));
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(text()).toContain("Pick a different handle.");
    expect(within(region()).getByRole("textbox", { name: "Handle" })).toBeTruthy();
  });

  it("offers Refresh after a new version shipped", async () => {
    savePlayer(PLAYER);
    serve(() => apiError(409, "stale_version"));
    await finished();
    expect(text()).toContain("A new version of Pit Wall On-Call is out, so this shift can't be posted. Refresh to play the new version.");
    expect(within(region()).getByRole("button", { name: "Refresh" })).toBeTruthy();
  });

  it("explains a replay the server could not accept, with no retry", async () => {
    savePlayer(PLAYER);
    serve(() => apiError(422, "impossible_actions"));
    await finished();
    expect(text()).toContain("The server replayed this shift and could not accept it, so it wasn't posted.");
    expect(within(region()).queryByRole("button")).toBeNull();
  });

  it("offers Try again when rate limited", async () => {
    savePlayer(PLAYER);
    serve(() => apiError(429, "rate_limited"));
    await finished();
    expect(text()).toContain("Too many shifts posted in a short time. Try again in a minute.");
    serve(() => json(201, posted({ rank: 2, total: 3, best: true })));
    await act(async () => {
      fireEvent.click(within(region()).getByRole("button", { name: "Try again" }));
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(text()).toContain("New best: #2 of 3 on the practice leaderboard.");
  });

  it("shows the request ID when the server fails, after the retries", async () => {
    savePlayer(PLAYER);
    serve(() => apiError(503, "internal"));
    await finished();
    expect(text()).toContain("Posting your score…");
    await act(async () => vi.advanceTimersByTimeAsync(7000));
    expect(text()).toContain("Couldn't reach the leaderboard (request req-9).");
    expect(within(region()).getByRole("button", { name: "Try again" })).toBeTruthy();
  });

  it("leaves the request ID out when the network is down", async () => {
    savePlayer(PLAYER);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    await finished();
    await act(async () => vi.advanceTimersByTimeAsync(7000));
    expect(text()).toContain("Couldn't reach the leaderboard.");
  });

  it("View leaderboard opens the leaderboard tab in the Browser", async () => {
    savePlayer(PLAYER);
    serve(() => json(201, posted({ rank: 1, total: 1, best: true })));
    const { os } = await finished();
    fireEvent.click(within(region()).getByRole("button", { name: "View leaderboard" }));
    expect(os().browserTab?.id).toBe("leaderboard");
    expect(os().wm.windows.some((w) => w.appId === "browser")).toBe(true);
  });
});
