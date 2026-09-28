import { fillWorld } from "@pitwall/world";
import { useState } from "react";
import { formatClock } from "../../game/format";
import { useIncident } from "../incident/IncidentProvider";

export function Notifications() {
  const incident = useIncident();
  const [later, setLater] = useState(false);
  const { phase, world, scenario, snapshot } = incident;
  const page = scenario.coldOpen.page;

  if (phase === "paging") {
    return (
      <div className="notice critical" role="alertdialog" aria-labelledby="notice-h" aria-describedby="notice-b">
        <p className="notice-meta">
          <span className="tag crit">{page.severity}</span> Paging you · <span className="mono">{formatClock(snapshot.tick)}</span>
        </p>
        <h2 id="notice-h">{page.title}</h2>
        <p id="notice-b">{fillWorld(page.body, world)}</p>
        {snapshot.escalated && (
          <p className="notice-escalated" role="status">
            <span className="tag warn">Escalated</span> No acknowledgement for 60 s. Paging the secondary on-call.
          </p>
        )}
        <div className="notice-actions">
          <button type="button" className="btn primary" autoFocus onClick={incident.acknowledge}>
            Acknowledge <kbd>A</kbd>
          </button>
        </div>
      </div>
    );
  }
  if (phase === "idle" && !later) {
    return (
      <section className="notice" aria-labelledby="notice-h">
        <p className="notice-meta">Shift</p>
        <h2 id="notice-h">Shift ready · {world.city.name}</h2>
        <p>{world.brand.name} is quiet. Start a practice incident whenever you are ready.</p>
        <div className="notice-actions">
          <button type="button" className="btn primary" onClick={incident.start}>
            Start shift
          </button>
          <button type="button" className="btn" onClick={() => setLater(true)}>
            Later
          </button>
        </div>
      </section>
    );
  }
  if (phase === "prepage") {
    return (
      <section className="notice" aria-labelledby="notice-h">
        <p className="notice-meta">Shift</p>
        <h2 id="notice-h">Shift started</h2>
        <p>Nothing is broken yet. The pager can go off at any moment.</p>
        <div className="notice-actions">
          <button type="button" className="btn" onClick={incident.skipPrepage}>
            Skip to the page
          </button>
        </div>
      </section>
    );
  }
  return null;
}
