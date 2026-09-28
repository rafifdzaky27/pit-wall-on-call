import { formatClock } from "../game/format";
import { useIncident } from "../os/incident/IncidentProvider";
import { useCamera } from "./CameraContext";

const title = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** The lower third over the café after the run (cold-open spec §3). The shift report follows it (M2.5 spec §6). */
export function ColdClose() {
  const incident = useIncident();
  const camera = useCamera();
  const result = incident.result;
  if (!camera.closing || camera.view !== "cafe" || !result) return null;
  const surface = title(incident.scenario.coldOpen.symptom.surface);
  const line =
    result.outcome === "resolved" ? `${surface} is back. Resolved in ${formatClock(result.endTick)}.` : `${surface} is still down. The shift ended at ${formatClock(result.endTick)}.`;
  return (
    <div className="cold-close">
      <p role="status">{line}</p>
    </div>
  );
}
