import { ACK, ActionRejected, inspectAction, Run, type RunResult, type ScenarioDef, type State } from "@pitwall/engine";
import { useCallback, useEffect, useState } from "react";
import { Console } from "../console/Console";
import { brandFor } from "../game/brand";
import { useRunLoop } from "../game/useRunLoop";
import { ColdOpen } from "./ColdOpen";

/** Cold-open spec §3: about 18 s of free pre-page before the pager fires. */
export const PREPAGE_MS = 18_000;

interface Props {
  scenario: ScenarioDef<State>;
  seed: number;
  onFinish: (result: RunResult) => void;
  prepageMs?: number;
  now?: () => number;
}

type Phase = "prepage" | "paging" | "console";

export function Incident({ scenario, seed, onFinish, prepageMs = PREPAGE_MS, now }: Props) {
  const [run] = useState(() => new Run(scenario, seed));
  const [phase, setPhase] = useState<Phase>("prepage");
  const { snapshot, history, paused, pause, resume, refresh } = useRunLoop(run, { active: phase !== "prepage", onFinish, now });
  const brand = brandFor(seed);

  useEffect(() => {
    if (phase !== "prepage") return;
    const id = window.setTimeout(() => setPhase("paging"), prepageMs);
    return () => window.clearTimeout(id);
  }, [phase, prepageMs]);

  useEffect(() => {
    if (phase === "prepage") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "p" && e.key !== "P") return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (paused) resume();
      else pause();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, paused, pause, resume]);

  const dispatch = useCallback(
    (actionId: string) => {
      try {
        run.dispatch(actionId);
      } catch (e) {
        // The UI disables unavailable actions; a rejection here is a harmless double click.
        if (!(e instanceof ActionRejected)) throw e;
      }
      refresh();
    },
    [run, refresh],
  );

  const acknowledge = useCallback(() => {
    dispatch(ACK);
    setPhase("console");
  }, [dispatch]);

  return (
    <>
      <div hidden={paused}>
        {phase === "console" ? (
          <Console
            scenario={scenario}
            snapshot={snapshot}
            logs={run.logs}
            history={history}
            brand={brand}
            check={(id) => run.check(id)}
            onAction={dispatch}
            onPause={pause}
          />
        ) : (
          <ColdOpen
            coldOpen={scenario.coldOpen}
            brand={brand}
            phase={phase}
            ticks={snapshot.tick}
            escalated={snapshot.escalated}
            onInspect={(id) => dispatch(inspectAction(id))}
            onSkip={() => setPhase("paging")}
            onAck={acknowledge}
          />
        )}
      </div>
      {paused && (
        <div className="overlay">
          <div className="card" role="dialog" aria-modal="true" aria-labelledby="paused-h" aria-describedby="paused-d">
            <h2 id="paused-h">Paused</h2>
            <p id="paused-d">The incident clock is stopped and the console is hidden until you resume.</p>
            <button type="button" className="btn primary" autoFocus onClick={resume}>
              Resume <kbd>P</kbd>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
