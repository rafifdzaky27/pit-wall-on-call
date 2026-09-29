import { ENGINE_VERSION } from "@pitwall/engine";
import { dailyFor, dayStartMs, utcDate } from "@pitwall/scenarios";
import { act, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderOs } from "../os/testing";
import { ROLLOVER_CHECK_MS } from "./daily";
import { loadPlayer, savePlayer } from "./player";
import { useSubmission, type Submission } from "./SubmissionProvider";

const PLAYER = { playerId: "0c1f2e3d-0000-4000-8000-0000abcd1234", handle: "rafif", tag: "1234", token: `pw_${"a".repeat(43)}` };
const POSTED = { runId: "r1", mode: "practice", flagged: false, score: { outcome: "resolved", budgetBurnedBp: 253, mitigatedAtTick: 389, endTick: 489 }, board: { rank: 3, total: 40, best: true } };

type Route = (url: string, init: RequestInit) => Response | Promise<Response>;
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const apiError = (status: number, code: string) => json(status, { error: { code, message: code, requestId: "req-9" } });

let calls: { url: string; method: string; body: Record<string, unknown> | null; auth: string | null }[];
function serve(route: Route) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      const headers = init.headers as Record<string, string>;
      calls.push({ url, method: init.method ?? "GET", body: init.body ? JSON.parse(String(init.body)) : null, auth: headers.authorization ?? null });
      return route(url, init);
    }),
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  calls = [];
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  localStorage.clear();
});

let submission: Submission;
function Probe() {
  submission = useSubmission();
  return null;
}

/** Plays a shift to the end: ack and roll back, then let the fix hold. */
function finishShift(incident: ReturnType<typeof renderOs>["incident"]) {
  act(() => incident().start());
  act(() => incident().skipPrepage());
  act(() => incident().acknowledge());
  act(() => incident().dispatch("checkout.rollback"));
  for (let i = 0; i < 45; i++) act(() => vi.advanceTimersByTime(1000));
  expect(incident().phase).toBe("ended");
}
const flush = () => act(async () => {
  await vi.advanceTimersByTimeAsync(0);
});

describe("posting a finished shift", () => {
  it("asks for a handle when there is no player, and posts nothing", async () => {
    serve(() => json(500, {}));
    const { incident } = renderOs(<Probe />);
    expect(submission.state.kind).toBe("idle");
    finishShift(incident);
    await flush();
    expect(submission.state.kind).toBe("ask");
    expect(calls).toEqual([]);
  });

  it("registers the handle, stores the player, and posts the replayable run", async () => {
    serve((url) => (url === "/api/players" ? json(201, { ...PLAYER }) : json(201, POSTED)));
    const { incident } = renderOs(<Probe />);
    finishShift(incident);
    await act(async () => submission.post("rafif"));
    expect(submission.state).toEqual({ kind: "posted", run: POSTED });
    expect(loadPlayer()).toEqual(PLAYER);
    const run = calls[1]!;
    expect(run.url).toBe("/api/runs");
    expect(run.auth).toBe(`Bearer ${PLAYER.token}`);
    const result = incident().result!;
    expect(run.body).toMatchObject({ scenarioId: result.scenarioId, seed: result.seed, mode: "practice", engineVersion: ENGINE_VERSION, actions: result.actions });
    expect(run.body!.runKey).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("posts automatically when a player is stored", async () => {
    savePlayer(PLAYER);
    serve(() => json(201, POSTED));
    const { incident } = renderOs(<Probe />);
    finishShift(incident);
    await flush();
    expect(submission.state).toEqual({ kind: "posted", run: POSTED });
    expect(calls.map((c) => c.url)).toEqual(["/api/runs"]);
  });

  it("retries a network failure after 1, 2 and 4 s with the same runKey, then shows the error", async () => {
    savePlayer(PLAYER);
    serve(() => {
      throw new TypeError("Failed to fetch");
    });
    const { incident } = renderOs(<Probe />);
    finishShift(incident);
    await flush();
    expect(calls).toHaveLength(1);
    await act(async () => vi.advanceTimersByTimeAsync(1000));
    expect(calls).toHaveLength(2);
    await act(async () => vi.advanceTimersByTimeAsync(2000));
    expect(calls).toHaveLength(3);
    expect(submission.state.kind).toBe("posting");
    await act(async () => vi.advanceTimersByTimeAsync(4000));
    expect(calls).toHaveLength(4);
    expect(submission.state.kind).toBe("error");
    expect(new Set(calls.map((c) => c.body!.runKey)).size).toBe(1);
  });

  it("forgets the player on a 401 and asks for a handle again", async () => {
    savePlayer(PLAYER);
    serve(() => apiError(401, "unauthorized"));
    const { incident } = renderOs(<Probe />);
    finishShift(incident);
    await flush();
    expect(loadPlayer()).toBeNull();
    expect(submission.state.kind).toBe("ask");
  });

  it.each([
    [409, "stale_version"],
    [422, "impossible_actions"],
    [429, "rate_limited"],
  ])("shows %i %s at once, without retrying", async (status, code) => {
    savePlayer(PLAYER);
    serve(() => apiError(status, code));
    const { incident } = renderOs(<Probe />);
    finishShift(incident);
    await flush();
    await act(async () => vi.advanceTimersByTimeAsync(10_000));
    expect(calls).toHaveLength(1);
    expect(submission.state).toMatchObject({ kind: "error", error: { status, code } });
  });

  it("asks again when the server rejects the handle", async () => {
    serve(() => apiError(400, "handle_rejected"));
    const { incident } = renderOs(<Probe />);
    finishShift(incident);
    await act(async () => submission.post("sh1thead"));
    expect(submission.state.kind).toBe("rejected-handle");
    expect(loadPlayer()).toBeNull();
  });

  it("Not now posts nothing, and Try again after an error posts again", async () => {
    serve(() => apiError(429, "rate_limited"));
    const { incident } = renderOs(<Probe />);
    finishShift(incident);
    await flush();
    act(() => submission.notNow());
    expect(submission.state.kind).toBe("declined");
    expect(calls).toEqual([]);
    savePlayer(PLAYER);
    await act(async () => submission.post());
    expect(submission.state.kind).toBe("error");
    serve(() => json(201, POSTED));
    await act(async () => submission.retry());
    expect(submission.state.kind).toBe("posted");
  });

  it("counts posts, so an open leaderboard can refetch", async () => {
    savePlayer(PLAYER);
    serve(() => json(201, POSTED));
    const { incident } = renderOs(<Probe />);
    const before = submission.leaderboardVersion;
    finishShift(incident);
    await flush();
    expect(submission.leaderboardVersion).toBe(before + 1);
  });

  it("starts over on a new shift", async () => {
    savePlayer(PLAYER);
    serve(() => json(201, POSTED));
    const { incident } = renderOs(<Probe />);
    finishShift(incident);
    await flush();
    act(() => incident().newShift());
    expect(submission.state.kind).toBe("idle");
  });
});

describe("the daily and the queue (M3 spec Y6, Y10)", () => {
  const today = () => utcDate(Date.now());

  function finishDaily(incident: ReturnType<typeof renderOs>["incident"]) {
    act(() => incident().startDaily(dailyFor(today())));
    act(() => incident().skipPrepage());
    act(() => incident().acknowledge());
    act(() => incident().dispatch("checkout.rollback"));
    for (let i = 0; i < 45; i++) act(() => vi.advanceTimersByTime(1000));
    expect(incident().phase).toBe("ended");
  }

  it("a daily posts as the day's daily, and remembers today's rank", async () => {
    savePlayer(PLAYER);
    serve(() => json(201, { ...POSTED, mode: "daily_ranked", ranked: true, dailyDate: today() }));
    const { incident } = renderOs(<Probe />);
    finishDaily(incident);
    await flush();
    expect(calls[0]!.body).toMatchObject({ mode: "daily", dailyDate: today(), seed: dailyFor(today()).seed });
    expect(JSON.parse(localStorage.getItem(`pitwall.daily.${today()}`)!)).toEqual({ rank: 3, total: 40 });
    expect(localStorage.getItem("pitwall.pending")).toBe("[]");
  });

  it("a daily finished offline is kept, and sent once on the next load (Review Focus 3)", async () => {
    savePlayer(PLAYER);
    serve(() => {
      throw new TypeError("offline");
    });
    const first = renderOs(<Probe />);
    finishDaily(first.incident);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(8_000);
    });
    expect(submission.state.kind).toBe("error");
    const queued = JSON.parse(localStorage.getItem("pitwall.pending")!) as { runKey: string }[];
    expect(queued).toHaveLength(1);
    cleanup();

    calls = [];
    serve(() => json(201, { ...POSTED, mode: "daily_ranked", ranked: true, dailyDate: today() }));
    // Two tabs load at once: the run still goes out once, with the same key.
    renderOs(<Probe />);
    renderOs(<Probe />);
    await flush();
    const posts = calls.filter((c) => c.url === "/api/runs");
    expect(posts).toHaveLength(1);
    expect(posts[0]!.body!.runKey).toBe(queued[0]!.runKey);
    expect(localStorage.getItem("pitwall.pending")).toBe("[]");
  });

  it("drops a queued run the server refuses for good", async () => {
    savePlayer(PLAYER);
    localStorage.setItem("pitwall.pending", JSON.stringify([{ scenarioId: "db-pool-exhaustion", seed: 1, mode: "practice", engineVersion: "0.0.0", runKey: "k-1", actions: [] }]));
    serve(() => apiError(409, "stale_version"));
    renderOs(<Probe />);
    await flush();
    expect(calls).toHaveLength(1);
    expect(localStorage.getItem("pitwall.pending")).toBe("[]");
  });
});

describe("M3 review fixes", () => {
  it("the UTC rollover never posts a finished shift again (review 1)", async () => {
    savePlayer(PLAYER);
    // Finish just before midnight UTC, then let the day roll over with the report open.
    vi.setSystemTime(dayStartMs(utcDate(Date.now())) + 86_400_000 - 70_000);
    serve(() => json(201, POSTED));
    const { incident } = renderOs(<Probe />);
    finishShift(incident);
    await flush();
    expect(calls.filter((c) => c.url === "/api/runs")).toHaveLength(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ROLLOVER_CHECK_MS * 2);
    });
    expect(calls.filter((c) => c.url === "/api/runs")).toHaveLength(1);
    expect(submission.state.kind).toBe("posted");
  });

  it("a first-time player's shift is queued even when registering fails (review 2)", async () => {
    serve(() => {
      throw new TypeError("offline");
    });
    const { incident } = renderOs(<Probe />);
    finishShift(incident);
    await flush();
    await act(async () => {
      void submission.post("newbie");
      await vi.advanceTimersByTimeAsync(8_000);
    });
    expect(submission.state.kind).toBe("error");
    expect(JSON.parse(localStorage.getItem("pitwall.pending")!)).toHaveLength(1);
  });
});
