import { fillWorld } from "@pitwall/world";
import { isPaged } from "../apps/chat/unread";
import { AppIcon } from "../brand/AppIcon";
import { useIncident } from "../incident/IncidentProvider";
import { surfaceOf } from "../surfaces";
import { useOs } from "./OsContext";

export function PhoneWidget() {
  const incident = useIncident();
  const { openMenu, setOpenMenu } = useOs();
  const open = openMenu === "phone";
  const paged = isPaged(incident.phase);
  const ringing = incident.phase === "paging";
  const page = incident.scenario.coldOpen.page;
  const items = Object.entries(incident.scenario.coldOpen.hotspots).filter(
    ([id, h]) => surfaceOf(id) === "phone" && (paged || h.appearsAt !== "incident_start"),
  );
  const unseen = items.filter(([id]) => !incident.snapshot.inspected.includes(id)).length + (ringing ? 1 : 0);

  const toggle = () => {
    if (open) {
      setOpenMenu(null);
      return;
    }
    setOpenMenu("phone");
    for (const [id] of items) incident.inspect(id);
  };

  return (
    <div className="phone">
      <button type="button" className={`tray-btn${ringing ? " ringing" : ""}`} aria-expanded={open} aria-label={unseen ? `Phone, ${unseen} new` : "Phone"} onClick={toggle}>
        <AppIcon app="phone" size={18} />
        {unseen > 0 && (
          <span className="tray-badge" aria-hidden="true">
            {unseen}
          </span>
        )}
      </button>
      {open && (
        <div className="menu phone-panel" role="dialog" aria-label="Phone notifications">
          {ringing && (
            <div className="phone-item phone-page">
              <span className="tag crit">{page.severity}</span>
              <b>{page.title}</b>
              <button type="button" className="btn primary" onClick={incident.acknowledge}>
                Acknowledge <kbd>A</kbd>
              </button>
            </div>
          )}
          {items.map(([id, h]) => (
            <div key={id} className="phone-item">
              <span className="phone-app">{h.label}</span>
              <p>{fillWorld(h.text, incident.world)}</p>
            </div>
          ))}
          {!ringing && items.length === 0 && <p className="empty">No notifications.</p>}
        </div>
      )}
    </div>
  );
}
