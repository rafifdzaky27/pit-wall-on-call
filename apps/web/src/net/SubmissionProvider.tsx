import { ENGINE_VERSION } from "@pitwall/engine";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useIncident } from "../os/incident/IncidentProvider";
import { ApiError, NetworkError, postRun, registerPlayer, type PostedRun, type RunPost } from "./client";
import { useDaily, type DailyApi } from "./daily";
import { claim, drop, enqueue, pending, release } from "./queue";
import { forgetPlayer, loadPlayer, savePlayer } from "./player";

export type SubmitState =
  | { kind: "idle" }
  | { kind: "ask" }
  | { kind: "declined" }
  | { kind: "posting" }
  | { kind: "posted"; run: PostedRun }
  | { kind: "rejected-handle" }
  | { kind: "error"; error: ApiError | NetworkError };

export interface Submission {
  state: SubmitState;
  /** Posts this shift, registering `handle` first when the device has no player yet. */
  post: (handle?: string) => Promise<void>;
  notNow: () => void;
  retry: () => Promise<void>;
  /** Goes up after every post, so an open leaderboard refetches (plan P6). */
  leaderboardVersion: number;
}

const SubmissionContext = createContext<Submission | null>(null);

export function useSubmission(): Submission {
  const value = useContext(SubmissionContext);
  if (!value) throw new Error("useSubmission must be used inside <SubmissionProvider>");
  return value;
}

/** Network failures and 5xx retry after these delays, then stop and offer Try again (M2 spec §6). */
export const RETRY_DELAYS_MS = [1000, 2000, 4000];

const retryable = (e: unknown) => e instanceof NetworkError || (e instanceof ApiError && e.status >= 500);
/** The server will never take this run (a stale engine, an impossible log, a closed daily): stop keeping it. */
const final = (e: unknown) => e instanceof ApiError && e.status >= 400 && e.status < 500 && e.status !== 401 && e.status !== 429;

/** Remembers today's ranked daily on this device, for the landing's notice (M3 spec Y8). */
function recordDaily(run: RunPost, posted: PostedRun, markPlayed: DailyApi["markPlayed"]): void {
  if (run.mode !== "daily" || !run.dailyDate) return;
  if (posted.ranked) markPlayed(run.dailyDate, { rank: posted.board.rank, total: posted.board.total });
}

/** Sends runs left in the queue by an earlier page (offline, or closed mid-post), once each (spec Y10). */
async function sendQueued(skip: string | null, markPlayed: DailyApi["markPlayed"]): Promise<boolean> {
  const player = loadPlayer();
  if (!player) return false;
  let sent = false;
  for (const run of pending()) {
    if (run.runKey === skip || !claim(run.runKey)) continue;
    try {
      const posted = await postRun(player.token, run);
      drop(run.runKey);
      recordDaily(run, posted, markPlayed);
      sent = true;
    } catch (e) {
      if (final(e)) drop(run.runKey);
    } finally {
      release(run.runKey);
    }
  }
  return sent;
}

/**
 * Posts each finished shift: a daily to the day's board, anything else to the practice board. It
 * outlives shifts and starts over with each; unsent runs wait in a queue across reloads (M3 spec Y10).
 */
export function SubmissionProvider({ children }: { children: ReactNode }) {
  const { result, shiftId, scenario, daily } = useIncident();
  const { markPlayed } = useDaily();
  const [state, setState] = useState<SubmitState>({ kind: "idle" });
  // This provider outlives each shift (M2.5 plan A4): a new shift starts it over, and a post still in
  // flight from the previous shift is ignored when it lands. A daily repeats its seed, so shifts are
  // told apart by id (M3 spec Y9).
  const [shift, setShift] = useState(shiftId);
  const current = useRef(shiftId);
  current.current = shiftId;
  if (shift !== shiftId) {
    setShift(shiftId);
    setState({ kind: "idle" });
  }
  const [leaderboardVersion, setLeaderboardVersion] = useState(0);
  const runKey = useRef<{ shiftId: number; key: string } | null>(null);
  const pendingHandle = useRef<string | undefined>(undefined);
  const alive = useRef(true);
  // Read at call time: markPlayed changes at the UTC rollover, and that must not re-post a run (review 1).
  const markRef = useRef(markPlayed);
  markRef.current = markPlayed;
  const autoPosted = useRef<number | null>(null);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const post = useCallback(
    async (handle?: string) => {
      if (!result) return;
      const mine = shiftId;
      if (runKey.current?.shiftId !== mine) runKey.current = { shiftId: mine, key: crypto.randomUUID() };
      const key = runKey.current.key;
      const live = () => alive.current && current.current === mine;
      pendingHandle.current = handle;
      setState({ kind: "posting" });
      const body: RunPost = {
        scenarioId: result.scenarioId,
        seed: result.seed,
        ...(daily ? { mode: "daily", dailyDate: daily.date } : { mode: "practice" }),
        engineVersion: ENGINE_VERSION,
        runKey: key,
        actions: result.actions,
      };
      for (let attempt = 0; ; attempt++) {
        try {
          let player = loadPlayer();
          if (!player && handle === undefined) {
            setState({ kind: "ask" });
            return;
          }
          // Kept until the server has it, so a closed tab or a dropped network never loses it (spec Y10),
          // even before a first-time player has registered (review 2).
          enqueue(body);
          if (!player) {
            const created = await registerPlayer(handle!);
            player = { playerId: created.playerId, handle: created.handle, tag: created.tag, token: created.token };
            savePlayer(player);
            // Runs queued while there was no player go out now.
            void sendQueued(key, markRef.current);
          }
          if (!claim(key)) return;
          let run: PostedRun;
          try {
            run = await postRun(player.token, body);
            drop(key);
            recordDaily(body, run, markRef.current);
          } catch (e) {
            if (final(e)) drop(key);
            throw e;
          } finally {
            release(key);
          }
          if (!live()) return;
          setState({ kind: "posted", run });
          setLeaderboardVersion((v) => v + 1);
          return;
        } catch (e) {
          if (!live()) return;
          if (e instanceof ApiError && e.status === 401) {
            // The token is unknown (for example after a database reset): pick a handle again.
            forgetPlayer();
            setState({ kind: "ask" });
            return;
          }
          if (e instanceof ApiError && e.status === 400 && (e.code === "handle_rejected" || e.code === "schema") && !loadPlayer()) {
            setState({ kind: "rejected-handle" });
            return;
          }
          const delay = RETRY_DELAYS_MS[attempt];
          if (retryable(e) && delay !== undefined) {
            await new Promise((resolve) => window.setTimeout(resolve, delay));
            if (!live()) return;
            continue;
          }
          setState({ kind: "error", error: e instanceof ApiError || e instanceof NetworkError ? e : new NetworkError(String(e)) });
          return;
        }
      }
    },
    [result, shiftId, daily],
  );

  // Runs an earlier page could not send go out on load and whenever the browser is back online.
  useEffect(() => {
    const resend = () => {
      void sendQueued(runKey.current?.key ?? null, markRef.current).then((sent) => {
        if (sent && alive.current) setLeaderboardVersion((v) => v + 1);
      });
    };
    resend();
    window.addEventListener("online", resend);
    return () => window.removeEventListener("online", resend);
  }, []);

  // A finished shift posts at once when this device has a player, and asks for a handle otherwise.
  useEffect(() => {
    // Training is never posted (M2.5 spec D4): the report says so instead.
    if (!result || scenario.training) return;
    // Once per shift, whatever re-renders later (review 1).
    if (autoPosted.current === shiftId) return;
    autoPosted.current = shiftId;
    if (loadPlayer()) void post();
    else setState({ kind: "ask" });
  }, [result, post, scenario, shiftId]);

  const value = useMemo<Submission>(
    () => ({
      state,
      post,
      notNow: () => setState({ kind: "declined" }),
      retry: () => post(pendingHandle.current),
      leaderboardVersion,
    }),
    [state, post, leaderboardVersion],
  );

  return <SubmissionContext.Provider value={value}>{children}</SubmissionContext.Provider>;
}
