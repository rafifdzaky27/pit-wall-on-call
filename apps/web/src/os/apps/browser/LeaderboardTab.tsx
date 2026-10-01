import { useState, type ReactNode } from "react";
import { Glyph } from "../../brand/Glyph";
import { useIncident } from "../../incident/IncidentProvider";
import { LeaderboardPage } from "../../leaderboard/LeaderboardPage";
import type { Difficulty } from "../../prefs";
import { useDaily } from "../../../net/daily";
import { useSubmission } from "../../../net/SubmissionProvider";

export const LEADERBOARD_TITLE = "Leaderboard · Pit Wall On-Call";

const BOARD_DIFFICULTY_KEY = "pitwall.boardDifficulty";

/** Which difficulty's boards this viewer last looked at (M6 spec H11); normal when storage is off or empty. */
function loadBoardDifficulty(): Difficulty {
  try {
    return localStorage.getItem(BOARD_DIFFICULTY_KEY) === "hard" ? "hard" : "normal";
  } catch {
    return "normal";
  }
}

function saveBoardDifficulty(d: Difficulty): void {
  try {
    localStorage.setItem(BOARD_DIFFICULTY_KEY, d);
  } catch {
    // Storage off: the switch just resets next time.
  }
}

/**
 * The real leaderboard as a site in the Browser (M2 spec L2), at this deployment's own address.
 * It loads again when opened, reloaded, or after a post (plan P6).
 */
export function LeaderboardTab({ bookmarks, opened }: { bookmarks: ReactNode; opened: number }) {
  const { scenario } = useIncident();
  const { leaderboardVersion } = useSubmission();
  const [reloads, setReloads] = useState(0);
  const { daily } = useDaily();
  // Today's daily first, the practice board second (M3 spec Y11).
  const [board, setBoard] = useState<"daily" | "practice">("daily");
  const [difficulty, setDifficulty] = useState<Difficulty>(loadBoardDifficulty);
  const pick = (d: Difficulty) => {
    setDifficulty(d);
    saveBoardDifficulty(d);
  };
  return (
    <>
      <div className="browser-toolbar">
        <button type="button" className="tool-btn" aria-label="Back" disabled>
          <Glyph name="back" />
        </button>
        <button type="button" className="tool-btn" aria-label="Forward" disabled>
          <Glyph name="forward" />
        </button>
        <button type="button" className="tool-btn" aria-label="Reload" onClick={() => setReloads((n) => n + 1)}>
          <Glyph name="reload" />
        </button>
        <div className="omnibox">
          <Glyph name="lock" size={14} />
          <input className="address mono" aria-label="Address" value={`${window.location.origin}/leaderboard`} readOnly />
        </div>
      </div>
      {bookmarks}
      <div className="browser-main">
        <div className="browser-page">
          <div className="browser-scroll">
            <div className="lb-tabs" role="group" aria-label="Boards">
              {(["daily", "practice"] as const).map((b) => (
                <button key={b} type="button" className="lb-tab" aria-pressed={board === b} onClick={() => setBoard(b)}>
                  {b === "daily" ? "Daily" : "Practice"}
                </button>
              ))}
            </div>
            <div className="lb-tabs lb-difficulty" role="group" aria-label="Difficulty">
              {(["normal", "hard"] as const).map((d) => (
                <button key={d} type="button" className="lb-tab" aria-pressed={difficulty === d} onClick={() => pick(d)}>
                  {d === "normal" ? "Normal" : "Hard"}
                </button>
              ))}
            </div>
            <LeaderboardPage
              scenarioId={scenario.id}
              scenarioTitle={scenario.title}
              difficulty={difficulty}
              daily={board === "daily" ? { date: daily.date, number: daily.number } : undefined}
              version={opened + reloads + leaderboardVersion}
            />
          </div>
        </div>
      </div>
    </>
  );
}
