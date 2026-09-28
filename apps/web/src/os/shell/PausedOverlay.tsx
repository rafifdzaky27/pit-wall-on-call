import { useIncident } from "../incident/IncidentProvider";

export function PausedOverlay() {
  const incident = useIncident();
  if (!incident.paused) return null;
  return (
    <div className="overlay opaque">
      <div className="card" role="dialog" aria-modal="true" aria-labelledby="paused-h" aria-describedby="paused-d">
        <h2 id="paused-h">Paused</h2>
        <p id="paused-d">The incident clock is stopped and your screen is hidden until you resume.</p>
        <button type="button" className="btn primary" autoFocus onClick={incident.resume}>
          Resume <kbd>P</kbd>
        </button>
      </div>
    </div>
  );
}
