import { ENGINE_VERSION } from "@pitwall/engine";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useIncident } from "../os/incident/IncidentProvider";
import { ApiError, NetworkError, postRun, registerPlayer, type PostedRun } from "./client";
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

/**
 * Posts each finished shift to the practice leaderboard. It lives inside the incident session, so a
 * new shift starts it over. M3 persists a pending post across reloads.
 */
export function SubmissionProvider({ children }: { children: ReactNode }) {
  const { result, seed } = useIncident();
  const [state, setState] = useState<SubmitState>({ kind: "idle" });
  // This provider outlives each shift (M2.5 plan A4): a new seed starts it over, and a post still in
  // flight from the previous shift is ignored when it lands.
  const [shift, setShift] = useState(seed);
  const current = useRef(seed);
  current.current = seed;
  if (shift !== seed) {
    setShift(seed);
    setState({ kind: "idle" });
  }
  const [leaderboardVersion, setLeaderboardVersion] = useState(0);
  const runKey = useRef<{ seed: number; key: string } | null>(null);
  const pendingHandle = useRef<string | undefined>(undefined);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const post = useCallback(
    async (handle?: string) => {
      if (!result) return;
      const mine = seed;
      if (runKey.current?.seed !== mine) runKey.current = { seed: mine, key: crypto.randomUUID() };
      const key = runKey.current.key;
      const live = () => alive.current && current.current === mine;
      pendingHandle.current = handle;
      setState({ kind: "posting" });
      for (let attempt = 0; ; attempt++) {
        try {
          let player = loadPlayer();
          if (!player) {
            if (handle === undefined) {
              setState({ kind: "ask" });
              return;
            }
            const created = await registerPlayer(handle);
            player = { playerId: created.playerId, handle: created.handle, tag: created.tag, token: created.token };
            savePlayer(player);
          }
          const run = await postRun(player.token, {
            scenarioId: result.scenarioId,
            seed: result.seed,
            mode: "practice",
            engineVersion: ENGINE_VERSION,
            runKey: key,
            actions: result.actions,
          });
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
    [result, seed],
  );

  // A finished shift posts at once when this device has a player, and asks for a handle otherwise.
  useEffect(() => {
    if (!result) return;
    if (loadPlayer()) void post();
    else setState({ kind: "ask" });
  }, [result, post]);

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
