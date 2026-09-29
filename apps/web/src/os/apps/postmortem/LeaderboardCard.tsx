import { useId, useState, type FormEvent } from "react";
import { ApiError } from "../../../net/client";
import { HANDLE_RE } from "../../../net/player";
import { useSubmission, type SubmitState } from "../../../net/SubmissionProvider";

const HINT = "3 to 20 letters, numbers, - or _.";

function HandleForm({ rejected, onPost, onNotNow }: { rejected: boolean; onPost: (handle: string) => void; onNotNow?: () => void }) {
  const id = useId();
  const [value, setValue] = useState("");
  const [invalid, setInvalid] = useState(false);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const handle = value.trim();
    if (!HANDLE_RE.test(handle)) {
      setInvalid(true);
      return;
    }
    onPost(handle);
  };
  const error = invalid ? `Use ${HINT}` : rejected ? "Pick a different handle." : null;
  return (
    <form className="board-form" onSubmit={submit} noValidate>
      <p>Pick a handle to post this shift to the practice leaderboard.</p>
      <div className="field">
        <label className="field-label" htmlFor={`${id}-handle`}>
          Handle
        </label>
        <input
          id={`${id}-handle`}
          className="text-input mono"
          name="handle"
          autoComplete="nickname"
          maxLength={40}
          value={value}
          aria-invalid={error !== null}
          aria-describedby={`${id}-hint`}
          onChange={(e) => {
            setValue(e.target.value);
            setInvalid(false);
          }}
        />
        <span id={`${id}-hint`} className={error ? "field-hint error" : "field-hint"}>
          {error ?? HINT}
        </span>
      </div>
      <div className="board-actions">
        <button type="submit" className="btn primary">
          Post score
        </button>
        {onNotNow && (
          <button type="button" className="btn" onClick={onNotNow}>
            Not now
          </button>
        )}
      </div>
    </form>
  );
}

function errorCopy(error: Extract<SubmitState, { kind: "error" }>["error"]): { text: string; action: "refresh" | "retry" | null } {
  if (error instanceof ApiError && error.status === 409) {
    return { text: "A new version of Pit Wall On-Call is out, so this shift can't be posted. Refresh to play the new version.", action: "refresh" };
  }
  if (error instanceof ApiError && error.status === 422) {
    return { text: "The server replayed this shift and could not accept it, so it wasn't posted.", action: null };
  }
  if (error instanceof ApiError && error.status === 429) {
    return { text: "Too many shifts posted in a short time. Try again in a minute.", action: "retry" };
  }
  const requestId = error instanceof ApiError ? error.requestId : null;
  return { text: requestId ? `Couldn't reach the leaderboard (request ${requestId}).` : "Couldn't reach the leaderboard.", action: "retry" };
}

/**
 * Posting this shift to the practice leaderboard, in every state of M2 spec §6. `onView` opens the
 * full board: the Browser tab in the postmortem, the board view in the shift report.
 */
export function LeaderboardCard({ onView, bare = false }: { onView?: () => void; bare?: boolean }) {
  const { state, post, notNow, retry } = useSubmission();
  const [formAgain, setFormAgain] = useState(false);
  const view = onView ? (
    <button type="button" className="btn" onClick={onView}>
      View leaderboard
    </button>
  ) : null;

  let body;
  if (state.kind === "idle") return null;
  if (state.kind === "ask" || state.kind === "rejected-handle" || (state.kind === "declined" && formAgain)) {
    body = (
      <HandleForm
        rejected={state.kind === "rejected-handle"}
        onPost={(handle) => {
          setFormAgain(false);
          void post(handle);
        }}
        onNotNow={state.kind === "ask" ? notNow : undefined}
      />
    );
  } else if (state.kind === "declined") {
    body = (
      <>
        <p role="status">This shift was not posted.</p>
        <div className="board-actions">
          <button type="button" className="btn" onClick={() => setFormAgain(true)}>
            Post score
          </button>
        </div>
      </>
    );
  } else if (state.kind === "posting") {
    body = <p role="status">Posting your score…</p>;
  } else if (state.kind === "posted") {
    const { board, flagged, ranked, dailyDate } = state.run;
    const line = flagged
      ? "Posted and held for review. Fixes this fast are checked by hand."
      : ranked
        ? `Ranked #${board.rank} of ${board.total} on today's daily board.`
        : dailyDate
          ? "Practice: your ranked attempt at today's daily came earlier. This one counts on the practice board."
          : board.best
        ? `New best: #${board.rank} of ${board.total} on the practice leaderboard.`
        : `Posted. Your best is still #${board.rank} of ${board.total}.`;
    body = (
      <>
        <p role="status">{line}</p>
        {view && <div className="board-actions">{view}</div>}
      </>
    );
  } else {
    const { text, action } = errorCopy(state.error);
    body = (
      <>
        <p role="status">{text}</p>
        {action && (
          <div className="board-actions">
            {action === "refresh" ? (
              <button type="button" className="btn" onClick={() => window.location.reload()}>
                Refresh
              </button>
            ) : (
              <button type="button" className="btn" onClick={() => void retry()}>
                Try again
              </button>
            )}
          </div>
        )}
      </>
    );
  }

  if (bare) return <div className="board-card-bare">{body}</div>;
  return (
    <section className="panel board-card" aria-labelledby="board-h">
      <div className="ph">
        <h2 id="board-h">Leaderboard</h2>
      </div>
      <div className="pb">{body}</div>
    </section>
  );
}
