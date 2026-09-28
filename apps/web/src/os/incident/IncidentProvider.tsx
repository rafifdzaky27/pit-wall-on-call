import {
  ACK,
  ActionRejected,
  inspectAction,
  Run,
  type LogEntry,
  type RejectReason,
  type RunResult,
  type ScenarioDef,
  type Snapshot,
  type State,
  type TimelineEntry,
} from "@pitwall/engine";
import { desktopFor, slowLeak, type DesktopContent } from "@pitwall/scenarios";
import { resolveWorld, type World } from "@pitwall/world";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRunLoop } from "../../game/useRunLoop";

/** Cold-open spec §3: about 18 s of free pre-page before the pager fires. */
export const PREPAGE_MS = 18_000;

export type IncidentPhase = "idle" | "prepage" | "paging" | "active" | "ended";

export interface IncidentApi {
  phase: IncidentPhase;
  seed: number;
  world: World;
  scenario: ScenarioDef<State>;
  content: DesktopContent;
  snapshot: Snapshot;
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
  newShift: () => void;
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
  scenario?: ScenarioDef<State>;
  newSeed?: () => number;
  prepageMs?: number;
  now?: () => number;
}

/** One practice shift at a time. A new shift remounts the session, so no timer or loop survives it. */
export function IncidentProvider({ children, scenario = slowLeak, newSeed = randomSeed, prepageMs = PREPAGE_MS, now }: ProviderProps) {
  const [seed, setSeed] = useState(newSeed);
  const newShift = useCallback(() => setSeed(newSeed()), [newSeed]);
  return (
    <Session key={seed} seed={seed} scenario={scenario} prepageMs={prepageMs} now={now} onNewShift={newShift}>
      {children}
    </Session>
  );
}

interface SessionProps {
  children: ReactNode;
  seed: number;
  scenario: ScenarioDef<State>;
  prepageMs: number;
  now?: () => number;
  onNewShift: () => void;
}

function Session({ children, seed, scenario, prepageMs, now, onNewShift }: SessionProps) {
  const [run] = useState(() => new Run(scenario, seed));
  const [phase, setPhase] = useState<IncidentPhase>("idle");
  const [result, setResult] = useState<RunResult | null>(null);
  const world = useMemo(() => resolveWorld(seed), [seed]);
  const content = useMemo(() => desktopFor(scenario.id), [scenario]);

  const onFinish = useCallback((r: RunResult) => {
    setResult(r);
    setPhase("ended");
  }, []);
  const loop = useRunLoop(run, { active: phase === "paging" || phase === "active", onFinish, now });
  const { refresh } = loop;

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
      world,
      scenario,
      content,
      snapshot: loop.snapshot,
      history: loop.history,
      logs: run.logs,
      timeline: run.timeline,
      result,
      paused: loop.paused,
      check: (actionId) => run.check(actionId),
      start: () => setPhase((p) => (p === "idle" ? "prepage" : p)),
      skipPrepage: () => setPhase((p) => (p === "prepage" ? "paging" : p)),
      acknowledge: () => {
        if (phase !== "paging") return;
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
    }),
    [phase, seed, world, scenario, content, loop, run, result, dispatch, onNewShift],
  );

  return <IncidentContext.Provider value={api}>{children}</IncidentContext.Provider>;
}
