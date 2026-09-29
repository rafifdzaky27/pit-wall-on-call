import { DebriefBody } from "../../../screens/Debrief";
import { useIncident } from "../../incident/IncidentProvider";
import { useOs } from "../../shell/OsContext";
import { M16_SURFACES, reachableClueCount } from "../../surfaces";
import { LeaderboardCard } from "./LeaderboardCard";

export function PostmortemApp() {
  const incident = useIncident();
  const { openBrowserTab } = useOs();
  if (!incident.result) return <p className="app-pad empty">No incident has finished yet.</p>;
  return (
    <div className="postmortem">
      <DebriefBody
        scenario={incident.scenario}
        result={incident.result}
        clueTotal={reachableClueCount(incident.scenario, M16_SURFACES)}
        board={<LeaderboardCard onView={() => openBrowserTab("leaderboard")} />}
        actions={
          <button type="button" className="btn primary btn-lg" onClick={incident.newShift}>
            New shift
          </button>
        }
      />
    </div>
  );
}
