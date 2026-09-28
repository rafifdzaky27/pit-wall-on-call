import { DebriefBody } from "../../../screens/Debrief";
import { useIncident } from "../../incident/IncidentProvider";
import { M16_SURFACES, reachableClueCount } from "../../surfaces";

export function PostmortemApp() {
  const incident = useIncident();
  if (!incident.result) return <p className="app-pad empty">No incident has finished yet.</p>;
  return (
    <div className="postmortem">
      <DebriefBody
        scenario={incident.scenario}
        result={incident.result}
        clueTotal={reachableClueCount(incident.scenario, M16_SURFACES)}
        actions={
          <button type="button" className="btn primary btn-lg" onClick={incident.newShift}>
            New shift
          </button>
        }
      />
    </div>
  );
}
