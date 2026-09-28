import { useIncident } from "../os/incident/IncidentProvider";
import { useCamera } from "./CameraContext";

/** Text controls in the café's corner: skip the free minute, or look back down at the laptop. */
export function CafeControls() {
  const incident = useIncident();
  const camera = useCamera();
  return (
    <div className="cafe-controls" role="group" aria-label="Café controls">
      {incident.phase === "prepage" && (
        <button type="button" className="cafe-btn" data-coach="skip" onClick={incident.skipPrepage}>
          Skip to the page
        </button>
      )}
      <button type="button" className="cafe-btn" onClick={camera.enterLaptop}>
        Back to laptop (L)
      </button>
    </div>
  );
}
