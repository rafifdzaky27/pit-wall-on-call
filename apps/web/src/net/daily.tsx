import { dailyFor, utcDate, type Daily } from "@pitwall/scenarios";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { fetchDaily as fetchDailyFromApi } from "./client";

/** How today's ranked attempt went, remembered on this device (M3 spec Y8). */
export interface PlayedDaily {
  rank: number | null;
  total: number;
}

export interface DailyApi {
  /** Today's daily: the server's when it answered, otherwise the same function run here (spec Y1). */
  daily: Daily;
  /** Today's ranked attempt from this device, or null if there was none yet. */
  played: PlayedDaily | null;
  markPlayed: (date: string, played: PlayedDaily) => void;
}

const DailyContext = createContext<DailyApi | null>(null);

export function useDaily(): DailyApi {
  const value = useContext(DailyContext);
  if (!value) throw new Error("useDaily must be used inside <DailyProvider>");
  return value;
}

const key = (date: string) => `pitwall.daily.${date}`;

function loadPlayed(date: string): PlayedDaily | null {
  try {
    const raw = localStorage.getItem(key(date));
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<PlayedDaily>;
    return typeof v.total === "number" ? { rank: typeof v.rank === "number" ? v.rank : null, total: v.total } : null;
  } catch {
    return null;
  }
}

/** How often the day is checked for the 00:00 UTC rollover (spec Y13). */
export const ROLLOVER_CHECK_MS = 60_000;

interface Props {
  children: ReactNode;
  now?: () => number;
  fetchDaily?: () => Promise<Daily>;
}

/** Today's daily for the whole app, with a local fallback and the UTC rollover (M3 spec Y1, Y13). */
export function DailyProvider({ children, now = Date.now, fetchDaily = fetchDailyFromApi }: Props) {
  const [daily, setDaily] = useState<Daily>(() => dailyFor(utcDate(now())));
  const [played, setPlayed] = useState<PlayedDaily | null>(() => loadPlayed(daily.date));

  // Ask the server once per day; if it cannot answer, the local daily is the same one.
  useEffect(() => {
    let live = true;
    fetchDaily().then(
      (d) => {
        if (live && d.date === daily.date && (d.seed !== daily.seed || d.scenarioId !== daily.scenarioId)) setDaily({ date: d.date, number: d.number, scenarioId: d.scenarioId, seed: d.seed });
      },
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [daily.date]);

  useEffect(() => {
    const id = window.setInterval(() => {
      const today = utcDate(now());
      setDaily((d) => (d.date === today ? d : dailyFor(today)));
    }, ROLLOVER_CHECK_MS);
    return () => window.clearInterval(id);
  }, [now]);

  useEffect(() => setPlayed(loadPlayed(daily.date)), [daily.date]);

  const markPlayed = useCallback(
    (date: string, p: PlayedDaily) => {
      try {
        localStorage.setItem(key(date), JSON.stringify(p));
      } catch {
        // Storage off: the notice just won't remember today's rank.
      }
      if (date === daily.date) setPlayed(p);
    },
    [daily.date],
  );

  const value = useMemo(() => ({ daily, played, markPlayed }), [daily, played, markPlayed]);
  return <DailyContext.Provider value={value}>{children}</DailyContext.Provider>;
}
