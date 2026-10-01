import { Fragment, useEffect, useState } from "react";
import { formatBp, formatClock } from "../../game/format";
import { fetchDailyBoard, fetchLeaderboard, type Board, type BoardEntry, type DailyBoard } from "../../net/client";
import { usePlayer } from "../../net/player";
import type { Difficulty } from "../prefs";
import "./leaderboard.css";

type Load = { kind: "loading" } | { kind: "error" } | { kind: "ok"; board: Board | DailyBoard };

function Row({ e }: { e: BoardEntry }) {
  return (
    <tr className={e.you ? "lb-you" : undefined}>
      <td className="lb-rank">{e.rank}</td>
      <td className="lb-player">
        {e.handle}
        <span className="lb-tag">#{e.tag}</span>
        {e.you && " (you)"}
      </td>
      <td className="lb-num">{formatBp(e.budgetBurnedBp)}</td>
      <td className="lb-num lb-mit">{e.mitigatedAtTick === null ? "—" : formatClock(e.mitigatedAtTick)}</td>
      <td>{e.outcome === "resolved" ? "Resolved" : "DNF"}</td>
    </tr>
  );
}

/**
 * A leaderboard as a web page: the practice board (M2 spec §6), or a day's daily board with `daily`
 * (M3 spec Y7). It sits inside the PitOS Browser, the shift report and the lock screen, and loads
 * again whenever `version` changes.
 */
export function LeaderboardPage({
  scenarioId,
  scenarioTitle,
  version = 0,
  limit,
  bare = false,
  daily,
  difficulty = "normal",
}: {
  scenarioId: string;
  scenarioTitle: string;
  version?: number;
  /** Show only the top `limit`, plus the caller's row (the shift report's mini board). */
  limit?: number;
  /** No page heading: the board sits inside another surface. */
  bare?: boolean;
  /** The day's daily board instead of the practice board. */
  daily?: { date: string; number: number };
  /** Which difficulty's board (M6 spec H11). */
  difficulty?: Difficulty;
}) {
  const player = usePlayer();
  const token = player?.token;
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    setLoad({ kind: "loading" });
    (daily ? fetchDailyBoard(daily.date, token, difficulty) : fetchLeaderboard(scenarioId, token, difficulty)).then(
      (board) => live && setLoad({ kind: "ok", board }),
      () => live && setLoad({ kind: "error" }),
    );
    return () => {
      live = false;
    };
  }, [scenarioId, daily?.date, difficulty, token, version, attempt]);

  let body;
  if (load.kind === "loading") {
    body = <p role="status">Loading the leaderboard…</p>;
  } else if (load.kind === "error") {
    body = (
      <div className="lb-error">
        <p role="alert">Couldn't load the leaderboard.</p>
        <button type="button" className="lb-btn" onClick={() => setAttempt((n) => n + 1)}>
          Try again
        </button>
      </div>
    );
  } else if (load.board.entries.length === 0) {
    const hard = difficulty === "hard";
    body = (
      <p>
        {daily
          ? hard
            ? "Nobody has posted today's daily on hard yet. Be the first."
            : "Nobody has posted today's daily yet. Be the first."
          : hard
            ? "No hard shifts posted yet. Finish one on hard and post it from its postmortem."
            : "No shifts posted yet. Finish a shift and post it from its postmortem."}
      </p>
    );
  } else {
    const { you, total } = load.board;
    const entries = limit === undefined ? load.board.entries : load.board.entries.slice(0, limit);
    const outside = you && !entries.some((e) => e.you) ? you : null;
    body = (
      <>
        <div className="lb-table-wrap">
          <table className="lb-table" aria-label={`${daily ? "Daily" : "Practice"} leaderboard${difficulty === "hard" ? " (hard)" : ""}`}>
            <thead>
              <tr>
                <th scope="col">Rank</th>
                <th scope="col">Player</th>
                <th scope="col" className="lb-num">
                  Budget burned
                </th>
                <th scope="col" className="lb-num lb-mit">
                  Mitigated
                </th>
                <th scope="col">Result</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <Row key={e.runId} e={e} />
              ))}
              {outside && (
                <Fragment>
                  <tr className="lb-gap" aria-hidden="true">
                    <td colSpan={5}>…</td>
                  </tr>
                  <Row e={outside} />
                </Fragment>
              )}
            </tbody>
          </table>
        </div>
        <p className="lb-total">{total === 1 ? "1 player ranked." : `${total} players ranked.`}</p>
      </>
    );
  }

  if (bare) return <div className="lb-page lb-bare">{body}</div>;
  return (
    <article className="lb-page">
      <header className="lb-head">
        <p className="lb-site">Pit Wall On-Call</p>
        <h1>{`${daily ? `Daily #${daily.number}` : "Practice leaderboard"}${difficulty === "hard" ? " · Hard" : ""}`}</h1>
        <p className="lb-sub">{daily ? `${daily.date} · first attempt per player` : `${scenarioTitle} · best shift per player · all time`}</p>
      </header>
      {body}
    </article>
  );
}
