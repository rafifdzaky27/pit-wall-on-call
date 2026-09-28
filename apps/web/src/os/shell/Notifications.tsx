import { fillWorld } from "@pitwall/world";
import { useEffect, useState } from "react";
import { formatClock } from "../../game/format";
import { Glyph } from "../brand/Glyph";
import { useIncident } from "../incident/IncidentProvider";
import { synth } from "../sound";
import { useOs, type Notice } from "./OsContext";

/** Non-critical banners move to the calendar's list after this long (polish spec §6). */
export const BANNER_MS = 8000;

function PageAlert() {
  const incident = useIncident();
  const { world, scenario, snapshot } = incident;
  const page = scenario.coldOpen.page;
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

function Banner({ notice }: { notice: Notice }) {
  const { hideBanner, removeNotice } = useOs();
  const [held, setHeld] = useState(false);

  useEffect(() => {
    if (notice.sound) synth.play(notice.sound);
  }, [notice.sound]);

  // Hovering or focusing holds the banner; the timer restarts when the player lets go.
  useEffect(() => {
    if (held) return;
    const id = window.setTimeout(() => hideBanner(notice.id), BANNER_MS);
    return () => window.clearTimeout(id);
  }, [held, notice.id, hideBanner]);

  return (
    <section
      className="notice"
      aria-labelledby="notice-h"
      onPointerEnter={() => setHeld(true)}
      onPointerLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHeld(false);
      }}
    >
      <div className="notice-top">
        <p className="notice-meta">{notice.app}</p>
        <button type="button" className="notice-close" aria-label="Dismiss notification" onClick={() => hideBanner(notice.id)}>
          <Glyph name="close" />
        </button>
      </div>
      <h2 id="notice-h">{notice.title}</h2>
      <p>{notice.body}</p>
      {notice.actions.length > 0 && (
        <div className="notice-actions">
          {notice.actions.map((a) => (
            <button
              key={a.label}
              type="button"
              className={a.primary ? "btn primary" : "btn"}
              onClick={() => {
                removeNotice(notice.id);
                a.run();
              }}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

/** The critical page while paging; otherwise the newest banner, if any. */
export function Notifications() {
  const incident = useIncident();
  const { notices } = useOs();
  if (incident.phase === "paging") return <PageAlert />;
  const banner = notices.find((n) => n.banner);
  return banner ? <Banner key={`${banner.id}:${banner.at}`} notice={banner} /> : null;
}
