import type { Run, RunResult, State } from "@pitwall/engine";
import { useCallback, useEffect, useRef, useState } from "react";
import { TickDriver } from "./clock";
import { MetricHistory } from "./history";

export interface RunLoopOptions {
  active: boolean;
  onFinish: (result: RunResult) => void;
  now?: () => number;
  intervalMs?: number;
}

const defaultNow = () => performance.now();

/** Drives a Run in real time, pauses it when the tab is hidden, and exposes a render view. */
export function useRunLoop(run: Run<State>, { active, onFinish, now = defaultNow, intervalMs = 50 }: RunLoopOptions) {
  const [history] = useState(() => {
    const h = new MetricHistory();
    const snap = run.snapshot();
    h.record(snap.tick, snap.metrics);
    return h;
  });
  const [view, setView] = useState(() => ({ snapshot: run.snapshot(), history: history.snapshot() }));
  const [paused, setPaused] = useState(false);
  const driverRef = useRef<TickDriver | null>(null);
  const onFinishRef = useRef(onFinish);

  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);

  const refresh = useCallback(() => setView({ snapshot: run.snapshot(), history: history.snapshot() }), [run, history]);

  useEffect(() => {
    if (!active || run.outcome !== "running") return;
    const driver = new TickDriver(now);
    driver.start();
    driverRef.current = driver;

    const id = window.setInterval(() => {
      const due = driver.due();
      if (due === 0) return;
      for (let i = 0; i < due && run.outcome === "running"; i++) run.step();
      const snapshot = run.snapshot();
      history.record(snapshot.tick, snapshot.metrics);
      setView({ snapshot, history: history.snapshot() });
      if (run.outcome !== "running") {
        window.clearInterval(id);
        onFinishRef.current(run.result());
      }
    }, intervalMs);

    const onVisibility = () => {
      if (document.hidden) {
        driver.pause();
        setPaused(true);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
      driverRef.current = null;
    };
  }, [active, run, history, now, intervalMs]);

  const pause = useCallback(() => {
    driverRef.current?.pause();
    setPaused(true);
  }, []);

  const resume = useCallback(() => {
    driverRef.current?.resume();
    setPaused(false);
  }, []);

  return { snapshot: view.snapshot, history: view.history, paused, pause, resume, refresh };
}
