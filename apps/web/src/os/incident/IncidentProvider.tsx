import {
  ACK,
  ActionRejected,
  inspectAction,
  Run,
  type IncidentStatus,
  type LogEntry,
  type RejectReason,
  type RunResult,
  type ScenarioDef,
  type Snapshot,
  type State,
  type TimelineEntry,
} from "@pitwall/engine";
import { desktopFor, getScenario, practiceFor, training, type Daily, type DesktopContent } from "@pitwall/scenarios";
import { resolveWorld, type World } from "@pitwall/world";
import { createContext, Fragment, memo, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRunLoop } from "../../game/useRunLoop";

/** Cold-open spec §3: about 18 s of free pre-page before the pager fires. */
export const PREPAGE_MS = 18_000;

export type IncidentPhase = "idle" | "prepage" | "paging" | "active" | "ended";

export interface IncidentApi {
  phase: IncidentPhase;
  seed: number;
  /** Goes up with every shift, so the same daily played twice is two shifts (M3 spec Y9). */
  shiftId: number;
  /** The daily this shift is, or null for practice and training. */
  daily: Daily | null;
  world: World;
  scenario: ScenarioDef<State>;
  content: DesktopContent;
  snapshot: Snapshot;
  /** The tick each status was first entered this shift (M2.5 plan A2, review I2). */
  statusSince: Partial<Record<IncidentStatus, number>>;
  history: Record<string, number[]>;
  logs: readonly LogEntry[];
  timeline: readonly TimelineEntry[];
  result: RunResult | null;
  paused: boolean;
  check: (actionId: string) => RejectReason | null;
  start: () => void;
  skipPrepage: () => void;
  acknowledge: () => void;
  dispatch: (actionId: string) => void;
  inspect: (hotspotId: string) => void;
  pause: () => void;
  resume: () => void;
  /** A real shift, ready to start. */
  newShift: () => void;
  /** The guided training shift, started at once (M2.5 spec §5). Call it from the click, like Start shift. */
  startTraining: () => void;
  /** Today's daily, started at once (M3 spec Y8). Call it from the click, like Start shift. */
  startDaily: (daily: Daily) => void;
}

const IncidentContext = createContext<IncidentApi | null>(null);

export function useIncident(): IncidentApi {
  const value = useContext(IncidentContext);
  if (!value) throw new Error("useIncident must be used inside <IncidentProvider>");
  return value;
}

const randomSeed = () => crypto.getRandomValues(new Uint32Array(1))[0]!;

interface ProviderProps {
  children: ReactNode;
  /** Pins every practice shift to one scenario (a `?incident=` link, and tests). Otherwise each seed picks one (M4). */
  scenario?: ScenarioDef<State>;
  newSeed?: () => number;
  prepageMs?: number;
  now?: () => number;
}

/**
 * One practice shift at a time. A new shift remounts the session, so no timer or loop survives it.
 * The session reports its API up to here, so the children do not remount with it: the camera and the
 * café stay (M2.5 spec §11). What must start over per shift sits in a `ShiftScope`.
 */
export function IncidentProvider({ children, scenario, newSeed = randomSeed, prepageMs = PREPAGE_MS, now }: ProviderProps) {
  const practice = useCallback((seed: number) => scenario ?? practiceFor(seed), [scenario]);
  const [shift, setShift] = useState<Shift>(() => {
    const seed = newSeed();
    return { id: 1, seed, scenario: practice(seed), startNow: false, daily: null };
  });
  const [api, setApi] = useState<IncidentApi | null>(null);
  const newShift = useCallback(() => {
    const seed = newSeed();
    setShift((s) => ({ id: s.id + 1, seed, scenario: practice(seed), startNow: false, daily: null }));
  }, [newSeed, practice]);
  const startTraining = useCallback(() => setShift((s) => ({ id: s.id + 1, seed: newSeed(), scenario: training, startNow: true, daily: null })), [newSeed]);
  const startDaily = useCallback((daily: Daily) => {
    const dailyScenario = getScenario(daily.scenarioId);
    // A daily of a scenario this build does not have (a newer server) plays as practice instead.
    const seed = newSeed();
    setShift((s) => (dailyScenario ? { id: s.id + 1, seed: daily.seed, scenario: dailyScenario, startNow: true, daily } : { id: s.id + 1, seed, scenario: practice(seed), startNow: true, daily: null }));
  }, [newSeed, practice]);
  return (
    <>
      <Session
        key={shift.id}
        shiftId={shift.id}
        daily={shift.daily}
        onStartDaily={startDaily}
        seed={shift.seed}
        scenario={shift.scenario}
        startNow={shift.startNow}
        prepageMs={prepageMs}
        now={now}
        onNewShift={newShift}
        onStartTraining={startTraining}
        onApi={setApi}
      />
      {api && <IncidentContext.Provider value={api}>{children}</IncidentContext.Provider>}
    </>
  );
}

/** Children that start over on every shift: the OS, its windows and its apps. */
export function ShiftScope({ children }: { children: ReactNode }) {
  const { shiftId } = useIncident();
  return <Fragment key={shiftId}>{children}</Fragment>;
}

interface Shift {
  id: number;
  seed: number;
  scenario: ScenarioDef<State>;
  startNow: boolean;
  daily: Daily | null;
}

interface SessionProps {
  onApi: (api: IncidentApi) => void;
  shiftId: number;
  daily: Daily | null;
  onStartDaily: (daily: Daily) => void;
  onStartTraining: () => void;
  /** Begin in the pre-page at once (the training shift starts from its button). */
  startNow: boolean;
  seed: number;
  scenario: ScenarioDef<State>;
  prepageMs: number;
  now?: () => number;
  onNewShift: () => void;
}

/** Memoised: the hub re-renders on every reported API, and must not re-render the session back (M2.5 plan A4). */
const Session = memo(function Session({ onApi, shiftId, daily, onStartDaily, onStartTraining, startNow, seed, scenario, prepageMs, now, onNewShift }: SessionProps) {
  const [run] = useState(() => new Run(scenario, seed));
  const [phase, setPhase] = useState<IncidentPhase>(startNow ? "prepage" : "idle");
  const [result, setResult] = useState<RunResult | null>(null);
  const world = useMemo(() => resolveWorld(seed), [seed]);
  const content = useMemo(() => desktopFor(scenario.id), [scenario]);

  const onFinish = useCallback((r: RunResult) => {
    setResult(r);
    setPhase("ended");
  }, []);
  const loop = useRunLoop(run, { active: phase === "paging" || phase === "active", onFinish, now });
  const { refresh } = loop;
  // The tick each status was first entered, kept for the whole shift: a teammate's message that
  // reacted to "mitigated" must stay in the chat after the status moves on (M2.5 review I2).
  const entered = useRef<Partial<Record<IncidentStatus, number>>>({});
  if (entered.current[loop.snapshot.status] === undefined) entered.current = { ...entered.current, [loop.snapshot.status]: loop.snapshot.tick };
  const statusSince = entered.current;

  useEffect(() => {
    if (phase !== "prepage") return;
    const id = window.setTimeout(() => setPhase("paging"), prepageMs);
    return () => window.clearTimeout(id);
  }, [phase, prepageMs]);

  const dispatch = useCallback(
    (actionId: string) => {
      try {
        run.dispatch(actionId);
      } catch (e) {
        // Controls are disabled when an action is unavailable; a rejection here is a double click.
        if (!(e instanceof ActionRejected)) throw e;
      }
      refresh();
    },
    [run, refresh],
  );

  const api = useMemo<IncidentApi>(
    () => ({
      phase,
      seed,
      shiftId,
      daily,
      world,
      scenario,
      content,
      snapshot: loop.snapshot,
      statusSince,
      history: loop.history,
      logs: run.logs,
      timeline: run.timeline,
      result,
      paused: loop.paused,
      check: (actionId) => run.check(actionId),
      start: () => setPhase((p) => (p === "idle" ? "prepage" : p)),
      skipPrepage: () => setPhase((p) => (p === "prepage" ? "paging" : p)),
      acknowledge: () => {
        // Paused means the clock is stopped; nothing, not even the ack, happens then (M1.6 F6).
        if (phase !== "paging" || loop.paused) return;
        dispatch(ACK);
        setPhase("active");
      },
      dispatch,
      inspect: (hotspotId) => {
        if (!run.snapshot().inspected.includes(hotspotId)) dispatch(inspectAction(hotspotId));
      },
      pause: loop.pause,
      resume: loop.resume,
      newShift: onNewShift,
      startTraining: onStartTraining,
      startDaily: onStartDaily,
    }),
    [shiftId, daily, onStartDaily, phase, seed, world, scenario, content, loop, run, result, dispatch, onNewShift, onStartTraining],
  );

  // Before paint, so the tree above never shows a frame of the previous shift's state.
  useLayoutEffect(() => onApi(api), [api, onApi]);
  return null;
});
