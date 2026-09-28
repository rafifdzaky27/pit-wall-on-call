import { Fragment, useEffect, useState } from "react";
import { formatBp, formatClock } from "../../game/format";
import { fetchLeaderboard, type Board, type BoardEntry } from "../../net/client";
import { usePlayer } from "../../net/player";
import "./leaderboard.css";

type Load = { kind: "loading" } | { kind: "error" } | { kind: "ok"; board: Board };

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
      <td className="lb-num">{e.mitigatedAtTick === null ? "—" : formatClock(e.mitigatedAtTick)}</td>
      <td>{e.outcome === "resolved" ? "Resolved" : "DNF"}</td>
    </tr>
  );
}

/**
 * The practice leaderboard (M2 spec §6), as a web page: inside the PitOS Browser and under the lock
 * screen on small screens. It loads again whenever `version` changes.
 */
export function LeaderboardPage({ scenarioId, scenarioTitle, version = 0 }: { scenarioId: string; scenarioTitle: string; version?: number }) {
  const player = usePlayer();
  const token = player?.token;
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    setLoad({ kind: "loading" });
    fetchLeaderboard(scenarioId, token).then(
      (board) => live && setLoad({ kind: "ok", board }),
      () => live && setLoad({ kind: "error" }),
    );
    return () => {
      live = false;
    };
  }, [scenarioId, token, version, attempt]);

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
    body = <p>No shifts posted yet. Finish a shift and post it from its postmortem.</p>;
  } else {
    const { entries, you, total } = load.board;
    const outside = you && !entries.some((e) => e.you) ? you : null;
    body = (
      <>
        <div className="lb-table-wrap">
          <table className="lb-table" aria-label="Practice leaderboard">
            <thead>
              <tr>
                <th scope="col">Rank</th>
                <th scope="col">Player</th>
                <th scope="col" className="lb-num">
                  Budget burned
                </th>
                <th scope="col" className="lb-num">
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

  return (
    <article className="lb-page">
      <header className="lb-head">
        <p className="lb-site">Pit Wall On-Call</p>
        <h1>Practice leaderboard</h1>
        <p className="lb-sub">{scenarioTitle} · best shift per player · all time</p>
      </header>
      {body}
    </article>
  );
}
