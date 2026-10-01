import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Board, BoardEntry } from "../../net/client";
import { savePlayer } from "../../net/player";
import { LeaderboardPage } from "./LeaderboardPage";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});

const entry = (rank: number, over: Partial<BoardEntry> = {}): BoardEntry => ({
  rank,
  handle: `player${rank}`,
  tag: "ab12",
  budgetBurnedBp: 200 + rank,
  mitigatedAtTick: 300 + rank * 10,
  outcome: "resolved",
  runId: `r${rank}`,
  you: false,
  ...over,
});
const board = (entries: BoardEntry[], you: BoardEntry | null = null, total = entries.length): Board => ({ board: "practice", scenarioId: "db-pool-exhaustion", total, entries, you });

function serve(...bodies: (Board | "fail")[]) {
  const fetch = vi.fn(async () => {
    const next = bodies.length > 1 ? bodies.shift()! : bodies[0]!;
    return next === "fail" ? new Response("oops", { status: 502 }) : new Response(JSON.stringify(next), { status: 200, headers: { "content-type": "application/json" } });
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

const page = (version = 0) => <LeaderboardPage scenarioId="db-pool-exhaustion" scenarioTitle="The Slow Leak" version={version} />;

describe("LeaderboardPage", () => {
  it("loads, then lists rank, player, burn, mitigation and result", async () => {
    serve(board([entry(1), entry(2, { outcome: "dnf", mitigatedAtTick: null, budgetBurnedBp: 7270 })]));
    render(page());
    expect(screen.getByRole("status").textContent).toBe("Loading the leaderboard…");
    const table = await screen.findByRole("table", { name: "Practice leaderboard" });
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Practice leaderboard");
    expect(screen.getByText("The Slow Leak · best shift per player · all time")).toBeTruthy();
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows.map((r) => [...r.querySelectorAll("td")].map((c) => c.textContent))).toEqual([
      ["1", "player1#ab12", "2.0%", "00:31", "Resolved"],
      ["2", "player2#ab12", "72.7%", "—", "DNF"],
    ]);
  });

  it("marks the caller's row, and adds it after a gap when they are outside the top 50", async () => {
    const top = Array.from({ length: 50 }, (_, i) => entry(i + 1));
    serve(board(top, entry(53, { handle: "me", you: true }), 60));
    render(page());
    const table = await screen.findByRole("table", { name: "Practice leaderboard" });
    const rows = within(table).getAllByRole("row");
    expect(rows).toHaveLength(52);
    expect(rows.at(-1)!.textContent).toContain("me#ab12 (you)");
    expect(rows.at(-1)!.className).toContain("lb-you");
    // The gap is drawn for sighted players; the rank numbers already say it.
    expect(rows.at(-1)!.previousElementSibling!.textContent).toBe("…");
  });

  it("sends the stored player's token so the server can mark their row", async () => {
    savePlayer({ playerId: "p", handle: "me", tag: "ab12", token: `pw_${"b".repeat(43)}` });
    const fetch = serve(board([entry(1, { you: true, handle: "me" })]));
    render(page());
    const table = await screen.findByRole("table", { name: "Practice leaderboard" });
    expect(table.textContent).toContain("me#ab12 (you)");
    expect((fetch.mock.calls[0] as unknown as [string, RequestInit])[1].headers).toMatchObject({ authorization: `Bearer pw_${"b".repeat(43)}` });
  });

  it("says so when nobody has posted yet", async () => {
    serve(board([]));
    render(page());
    expect(await screen.findByText("No shifts posted yet. Finish a shift and post it from its postmortem.")).toBeTruthy();
  });

  it("shows an error with Try again, which loads the board again", async () => {
    serve("fail", board([entry(1)]));
    render(page());
    expect(await screen.findByText("Couldn't load the leaderboard.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("table", { name: "Practice leaderboard" })).toBeTruthy();
  });

  it("loads again when the version changes, for example after a post", async () => {
    const fetch = serve(board([entry(1)]));
    const { rerender } = render(page(0));
    await screen.findByRole("table");
    await act(async () => rerender(page(1)));
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});

describe("the daily board (M3 spec Y7, Y11)", () => {
  it("fetches the day's board and names it by number and date", async () => {
    const fetch = serve({ ...board([entry(1), entry(2, { you: true })]), board: "daily", date: "2026-10-05", number: 7 } as unknown as Board);
    render(<LeaderboardPage scenarioId="db-pool-exhaustion" scenarioTitle="The Slow Leak" daily={{ date: "2026-10-05", number: 7 }} />);
    const table = await screen.findByRole("table", { name: "Daily leaderboard" });
    expect((fetch.mock.calls[0] as unknown as [string])[0]).toBe("/api/leaderboard?date=2026-10-05");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Daily #7");
    expect(screen.getByText("2026-10-05 · first attempt per player")).toBeTruthy();
    expect(within(table).getAllByRole("row")).toHaveLength(3);
  });

  it("says when nobody has played today's yet", async () => {
    serve({ ...board([]), board: "daily", date: "2026-10-05", number: 7 } as unknown as Board);
    render(<LeaderboardPage scenarioId="db-pool-exhaustion" scenarioTitle="The Slow Leak" daily={{ date: "2026-10-05", number: 7 }} />);
    expect(await screen.findByText("Nobody has posted today's daily yet. Be the first.")).toBeTruthy();
  });
});

describe("the hard boards (M6 spec H11)", () => {
  it("fetches the hard practice board, names it, and has its own empty state", async () => {
    const fetch = serve(board([]));
    render(<LeaderboardPage scenarioId="db-pool-exhaustion" scenarioTitle="The Slow Leak" difficulty="hard" />);
    expect(await screen.findByText("No hard shifts posted yet. Finish one on hard and post it from its postmortem.")).toBeTruthy();
    expect((fetch.mock.calls[0] as unknown as [string])[0]).toBe("/api/leaderboard?scenario=db-pool-exhaustion&difficulty=hard");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Practice leaderboard · Hard");
  });

  it("fetches the hard daily board and says nobody has played the hard daily", async () => {
    const fetch = serve({ ...board([]), board: "daily", date: "2026-10-05", number: 7 } as unknown as Board);
    render(<LeaderboardPage scenarioId="db-pool-exhaustion" scenarioTitle="The Slow Leak" daily={{ date: "2026-10-05", number: 7 }} difficulty="hard" />);
    expect(await screen.findByText("Nobody has posted today's daily on hard yet. Be the first.")).toBeTruthy();
    expect((fetch.mock.calls[0] as unknown as [string])[0]).toBe("/api/leaderboard?date=2026-10-05&difficulty=hard");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Daily #7 · Hard");
  });

  it("names the hard table", async () => {
    serve(board([entry(1)]));
    render(<LeaderboardPage scenarioId="db-pool-exhaustion" scenarioTitle="The Slow Leak" difficulty="hard" />);
    expect(await screen.findByRole("table", { name: "Practice leaderboard (hard)" })).toBeTruthy();
  });
});
