import { useState, type ReactNode } from "react";
import { Glyph } from "../../brand/Glyph";
import { useIncident } from "../../incident/IncidentProvider";
import { LeaderboardPage } from "../../leaderboard/LeaderboardPage";
import { useSubmission } from "../../../net/SubmissionProvider";

export const LEADERBOARD_TITLE = "Leaderboard · Pit Wall On-Call";

/**
 * The real leaderboard as a site in the Browser (M2 spec L2), at this deployment's own address.
 * It loads again when opened, reloaded, or after a post (plan P6).
 */
export function LeaderboardTab({ bookmarks, opened }: { bookmarks: ReactNode; opened: number }) {
  const { scenario } = useIncident();
  const { leaderboardVersion } = useSubmission();
  const [reloads, setReloads] = useState(0);
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
            <LeaderboardPage scenarioId={scenario.id} scenarioTitle={scenario.title} version={opened + reloads + leaderboardVersion} />
          </div>
        </div>
      </div>
    </>
  );
}
