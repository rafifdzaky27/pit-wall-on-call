import { useIncident } from "../os/incident/IncidentProvider";
import { useCamera } from "./CameraContext";

/** A plain café backdrop: shown while the café loads, and if it cannot load (cold-open spec §9). */
export function CafeFallback() {
  const camera = useCamera();
  const incident = useIncident();
  const page = incident.scenario.coldOpen.page;
  return (
    <section className="cafe-fallback" aria-label="Café">
      <button type="button" className="cafe-fallback-laptop" data-hotspot="laptop" onClick={camera.enterLaptop}>
        Laptop
      </button>
      {incident.phase === "paging" && (
        <div className="cafe-fallback-phone" role="alert">
          <b>
            {page.severity} · {page.title}
          </b>
          <span>Your phone is ringing.</span>
          <button type="button" className="btn primary" onClick={incident.acknowledge}>
            Acknowledge <kbd>A</kbd>
          </button>
        </div>
      )}
    </section>
  );
}
