import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { formatBp, formatClock } from "../game/format";
import { shareText } from "../game/share";
import { useIncident } from "../os/incident/IncidentProvider";
import { LeaderboardCard } from "../os/apps/postmortem/LeaderboardCard";
import { LeaderboardPage } from "../os/leaderboard/LeaderboardPage";
import { useSubmission } from "../net/SubmissionProvider";
import { M16_SURFACES, reachableClueCount } from "../os/surfaces";
import { useCamera } from "./CameraContext";
import "./results.css";

/** The report opens this long after the cold close caption (M2.5 spec §6). */
export const RESULTS_DELAY_MS = 1500;

/**
 * The shift report, as in Wordle: it opens by itself over the café once the run is over, with the
 * score, the leaderboard (and the handle field when there is none), Share and New shift.
 */
export function ResultsCard() {
  const incident = useIncident();
  const camera = useCamera();
  const { leaderboardVersion } = useSubmission();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"report" | "board">("report");
  const [copied, setCopied] = useState<"yes" | "no" | null>(null);
  const card = useRef<HTMLDivElement>(null);
  const result = incident.result;
  const closing = camera.closing && camera.view === "cafe" && result !== null;

  useEffect(() => {
    if (!closing) {
      setOpen(false);
      return;
    }
    const id = window.setTimeout(() => setOpen(true), RESULTS_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [closing]);

  // Focus moves with the commit that opens the report, not a frame later.
  useLayoutEffect(() => {
    if (open) card.current?.focus();
  }, [open]);

  if (!open || !result) return null;
  const resolved = result.outcome === "resolved";
  const scenario = incident.scenario;
  // Training is never posted: its report points at the real shift instead (M2.5 spec §5).
  const drill = scenario.training === true;
  // A daily reports as that day's daily, on that day's board (M3 spec Y11, Y12).
  const daily = incident.daily ? { date: incident.daily.date, number: incident.daily.number } : undefined;
  const told = result.timeline.some((e) => e.kind === "action_start" && e.actionId === "global.status_update");

  const share = async () => {
    const text = shareText(scenario, result, window.location.origin, daily);
    try {
      await navigator.clipboard.writeText(text);
      setCopied("yes");
    } catch {
      setCopied("no");
    }
  };

  return (
    <div className="results-scrim">
      <div className="results-card" role="dialog" aria-label="Shift report" aria-modal="true" tabIndex={-1} ref={card}>
        {view === "board" ? (
          <div className="results-body">
            <LeaderboardPage scenarioId={scenario.id} scenarioTitle={scenario.title} daily={daily} version={leaderboardVersion} />
          </div>
        ) : (
          <div className="results-body">
            <p className="eyebrow">{daily ? `Daily #${daily.number}` : scenario.title} · Shift report</p>
            <h2 className="results-title">{resolved ? (drill ? "Training complete" : `Resolved in ${formatClock(result.endTick)}`) : "Out of time"}</h2>
            {drill && (
              <p>
                {!resolved
                  ? "The clock ran out this time. Try the training again, or go straight to a real shift."
                  : told
                    ? "You acknowledged, found what changed, undid it, watched it hold and told customers. Real shifts hide the cause better, and nobody coaches you."
                    : "You acknowledged, found what changed, undid it and watched it hold. Next time, post a status update too: customers only know what you tell them."}
              </p>
            )}
            <dl className="results-tiles">
              <div>
                <dt>Budget burned</dt>
                <dd className="mono">{formatBp(result.budgetBurnedBp)}</dd>
              </div>
              <div>
                <dt>Mitigated</dt>
                <dd className="mono">{result.mitigatedAtTick === null ? "Not mitigated" : formatClock(result.mitigatedAtTick)}</dd>
              </div>
              <div>
                <dt>Root cause</dt>
                <dd>{result.rootCauseFound ? "Found" : "Not found"}</dd>
              </div>
              <div>
                <dt>Clues</dt>
                <dd className="mono">{`${result.cluesFound.length}/${reachableClueCount(scenario, M16_SURFACES)}`}</dd>
              </div>
            </dl>
            {!drill && (
              <section className="results-board" aria-label="Leaderboard">
                <LeaderboardCard bare />
                <LeaderboardPage scenarioId={scenario.id} scenarioTitle={scenario.title} daily={daily} version={leaderboardVersion} limit={5} bare />
              </section>
            )}
            {copied && <p role="status">{copied === "yes" ? "Copied to the clipboard." : "Couldn't copy. Select the text in the postmortem instead."}</p>}
          </div>
        )}
        <div className="results-actions">
          <button type="button" className="btn primary" onClick={incident.newShift}>
            {drill ? "Start a real shift" : "New shift"}
          </button>
          {drill ? (
            <button type="button" className="btn" onClick={incident.startTraining}>
              Try the training again
            </button>
          ) : view === "board" ? (
            <button type="button" className="btn" onClick={() => setView("report")}>
              Back to the report
            </button>
          ) : (
            <>
              <button type="button" className="btn" onClick={() => void share()}>
                Share
              </button>
              <button type="button" className="btn" onClick={() => setView("board")}>
                Full leaderboard
              </button>
            </>
          )}
          <button type="button" className="btn" onClick={camera.enterLaptop}>
            Read the postmortem
          </button>
        </div>
      </div>
    </div>
  );
}
