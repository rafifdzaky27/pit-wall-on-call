import { fillWorld } from "@pitwall/world";
import { useEffect } from "react";
import { isPaged } from "../os/apps/chat/unread";
import { useIncident } from "../os/incident/IncidentProvider";
import { surfaceOf } from "../os/surfaces";
import { useNow } from "../os/useNow";

/** Picking the phone up off the table: its lock screen, its notifications, and the page while it rings. */
export function PhoneCloseup({ onClose }: { onClose: () => void }) {
  const incident = useIncident();
  const now = useNow();
  const ringing = incident.phase === "paging";
  const paged = isPaged(incident.phase);
  const page = incident.scenario.coldOpen.page;
  const items = Object.entries(incident.scenario.coldOpen.hotspots).filter(([id, h]) => surfaceOf(id) === "phone" && (paged || h.appearsAt !== "incident_start"));
  const ids = items.map(([id]) => id).join(",");

  // Reading the phone counts, the same as opening it from the top bar.
  useEffect(() => {
    for (const [id] of items) incident.inspect(id);
  }, [ids]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const time = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", timeZone: incident.world.city.timeZone }).format(now);
  return (
    <div className="phone-closeup-scrim" onClick={onClose}>
      <div className={`phone-closeup${ringing ? " ringing" : ""}`} role="dialog" aria-modal="true" aria-label="Phone" onClick={(e) => e.stopPropagation()}>
        <p className="phone-time">{time}</p>
        {ringing && (
          <div className="phone-card phone-page">
            <span className="tag crit">{page.severity}</span>
            <b>{page.title}</b>
            <p>{fillWorld(page.body, incident.world)}</p>
            <button type="button" className="btn primary" autoFocus onClick={incident.acknowledge}>
              Acknowledge <kbd>A</kbd>
            </button>
          </div>
        )}
        {items.map(([id, h]) => (
          <div key={id} className="phone-card">
            <span className="phone-app">{h.label}</span>
            <p>{fillWorld(h.text, incident.world)}</p>
          </div>
        ))}
        {!ringing && items.length === 0 && <p className="phone-empty">No notifications</p>}
        <button type="button" className="btn phone-close" autoFocus={!ringing} onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
