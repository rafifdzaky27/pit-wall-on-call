import { pickLesson, type RunResult, type ScenarioDef, type State, type Verdict } from "@pitwall/engine";
import type { ReactNode } from "react";
import { formatBp, formatClock } from "../game/format";

const SIDE_EFFECT = "side_effect:";

export function burnLabel(tag: string, scenario: ScenarioDef<State>): string {
  if (tag === "unacknowledged") return "Before acknowledging";
  if (tag === "investigating") return "Investigating";
  if (tag === "mitigated_unfixed") return "Mitigated, cause still active";
  if (tag.startsWith(SIDE_EFFECT)) {
    const id = tag.slice(SIDE_EFFECT.length);
    return `Side effect: ${scenario.actions.find((a) => a.id === id)?.label ?? id}`;
  }
  return tag;
}

export function burnClass(tag: string): string {
  if (tag === "unacknowledged") return "burn-unack";
  if (tag === "mitigated_unfixed") return "burn-mitigated";
  if (tag.startsWith(SIDE_EFFECT)) return "burn-side";
  return "burn-investigating";
}

const VERDICT: Record<Verdict, { label: string; tag: string }> = {
  useful: { label: "Useful", tag: "ok" },
  wasted: { label: "Wasted time", tag: "warn" },
  harmful: { label: "Harmful", tag: "crit" },
};

interface Row {
  tick: number;
  label: string;
  verdict?: Verdict;
}

function timelineRows(scenario: ScenarioDef<State>, result: RunResult): Row[] {
  const actions = new Map(scenario.actions.map((a) => [a.id, a]));
  const rows: Row[] = [];
  for (const e of result.timeline) {
    if (e.kind === "page") rows.push({ tick: e.tick, label: "Paged" });
    else if (e.kind === "ack") rows.push({ tick: e.tick, label: "Acknowledged" });
    else if (e.kind === "escalated") rows.push({ tick: e.tick, label: "Secondary on-call paged" });
    else if (e.kind === "action_start") {
      const def = actions.get(e.actionId);
      if (def) rows.push({ tick: e.tick, label: def.label, verdict: def.verdict });
    } else if (e.kind === "resolved") rows.push({ tick: e.tick, label: "Resolved" });
    else if (e.kind === "dnf") rows.push({ tick: e.tick, label: "Time limit reached" });
  }
  return rows;
}

interface BodyProps {
  scenario: ScenarioDef<State>;
  result: RunResult;
  /** Clues the player could reach in this build (desktop spec §6). */
  clueTotal: number;
  /** The leaderboard section, right under the score tiles (M2 spec §6). */
  board?: ReactNode;
  actions: ReactNode;
}

export function DebriefBody({ scenario, result, clueTotal, board, actions }: BodyProps) {
  const resolved = result.outcome === "resolved";
  const lesson = pickLesson(scenario, result);
  const burns = Object.entries(result.burnByTag)
    .filter(([, bp]) => bp > 0)
    .sort((a, b) => b[1] - a[1]);
  const burnTotal = burns.reduce((sum, [, bp]) => sum + bp, 0);

  return (
    <>
      <section className="debrief-hero">
        <p className="eyebrow">{scenario.title} · Debrief</p>
        <h1>{resolved ? `Resolved in ${formatClock(result.endTick)}` : "Did not finish"}</h1>
        {!resolved && <p className="muted">The time limit ran out before checkout recovered.</p>}
      </section>

      <ul className="tiles" aria-label="Score">
        <li className="tile">
          <span className="tile-k">Error budget burned</span>
          <span className="tile-v mono">{formatBp(result.budgetBurnedBp)}</span>
        </li>
        <li className="tile">
          <span className="tile-k">Mitigated at</span>
          <span className="tile-v mono">{result.mitigatedAtTick === null ? "Not mitigated" : formatClock(result.mitigatedAtTick)}</span>
          {resolved && <span className="tile-sub mono">Confirmed {formatClock(result.endTick)}</span>}
        </li>
        <li className="tile">
          <span className="tile-k">Root cause</span>
          <span className="tile-v">{result.rootCauseFound ? "Found" : "Not found"}</span>
        </li>
        <li className="tile">
          <span className="tile-k">Acknowledged</span>
          <span className="tile-v mono">{result.ackTick === null ? "Never" : formatClock(result.ackTick)}</span>
          {result.escalated && <span className="tag warn">Secondary paged</span>}
        </li>
        <li className="tile">
          <span className="tile-k">Clues found</span>
          <span className="tile-v mono">{`${result.cluesFound.length}/${clueTotal}`}</span>
        </li>
      </ul>

      {board}

      <section className="panel" aria-labelledby="burn-h">
        <div className="ph">
          <h2 id="burn-h">Where the budget went</h2>
        </div>
        <div className="pb">
          {burnTotal === 0 ? (
            <p className="empty">No budget burned. Nothing to break down.</p>
          ) : (
            <>
              <div className="burn-bar" aria-hidden="true">
                {burns.map(([tag, bp]) => (
                  <span key={tag} className={`burn-seg ${burnClass(tag)}`} style={{ width: `${(bp / burnTotal) * 100}%` }} />
                ))}
              </div>
              <ul className="burn-legend" aria-label="Budget burned by cause">
                {burns.map(([tag, bp]) => (
                  <li key={tag}>
                    <span className={`swatch ${burnClass(tag)}`} aria-hidden="true" />
                    <span>{burnLabel(tag, scenario)}</span>
                    <span className="mono">{formatBp(bp)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </section>

      <section className="panel" aria-labelledby="timeline-h">
        <div className="ph">
          <h2 id="timeline-h">Timeline</h2>
        </div>
        <ol className="timeline pb" aria-label="Timeline">
          {timelineRows(scenario, result).map((row, i) => (
            <li key={i}>
              <time className="mono">{formatClock(row.tick)}</time>
              <span>{row.label}</span>
              {row.verdict && <span className={`tag ${VERDICT[row.verdict].tag}`}>{VERDICT[row.verdict].label}</span>}
            </li>
          ))}
        </ol>
      </section>

      <section className="panel lesson" aria-labelledby="lesson-h">
        <div className="ph">
          <h2 id="lesson-h">Lesson</h2>
        </div>
        <p className="pb">{lesson.text}</p>
      </section>
      <div className="debrief-actions">{actions}</div>
    </>
  );
}
