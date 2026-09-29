import { closeState, fillWorld, resolveScene } from "@pitwall/world";
import { useEffect, useMemo } from "react";
import { formatClock } from "../game/format";
import { isPaged } from "../os/apps/chat/unread";
import { useIncident } from "../os/incident/IncidentProvider";
import { surfaceOf } from "../os/surfaces";
import { useNow } from "../os/useNow";
import { shortTitle } from "./art/Table";
import { cityDate, sceneTime } from "./time";

/** A lo-fi dusk over hills, drawn in code like the rest of the café. */
function Wallpaper() {
  return (
    <svg className="phone-wallpaper" viewBox="0 0 300 620" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="pw-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1d1f4a" />
          <stop offset="0.5" stopColor="#7a3f78" />
          <stop offset="0.78" stopColor="#e27a6a" />
          <stop offset="1" stopColor="#f6b77a" />
        </linearGradient>
        <radialGradient id="pw-sun">
          <stop offset="0" stopColor="#fff0c8" />
          <stop offset="0.35" stopColor="#ffd08a" stopOpacity={0.8} />
          <stop offset="1" stopColor="#ffb07a" stopOpacity={0} />
        </radialGradient>
      </defs>
      <rect width="300" height="620" fill="url(#pw-sky)" />
      {Array.from({ length: 24 }, (_, i) => (
        <circle key={i} cx={(i * 73) % 300} cy={(i * 41) % 240} r={i % 4 ? 0.8 : 1.4} fill="#ffffff" opacity={0.3 + (i % 3) * 0.2} />
      ))}
      <circle cx="200" cy="430" r="120" fill="url(#pw-sun)" />
      <circle cx="200" cy="430" r="26" fill="#fff1d0" opacity={0.95} />
      <path d="M 0 470 Q 60 420 130 450 T 300 430 L 300 620 L 0 620 Z" fill="#5a3a6a" opacity={0.85} />
      <path d="M 0 520 Q 90 470 170 510 T 300 490 L 300 620 L 0 620 Z" fill="#3a2650" />
      <path d="M 0 570 Q 110 530 200 560 T 300 550 L 300 620 L 0 620 Z" fill="#221838" />
      <rect x="60" y="540" width="26" height="18" fill="#ffcf8a" opacity={0.8} />
      <path d="M 54 540 L 73 526 L 92 540 Z" fill="#221838" />
    </svg>
  );
}

/** Picking the phone up off the table: its lock screen, its notifications, and the page while it rings (M2.5 spec D1). */
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

  const zone = incident.world.city.timeZone;
  const scene = useMemo(() => resolveScene(incident.seed, incident.result ? closeState(incident.result.endTick) : null), [incident.seed, incident.result]);
  const time = sceneTime(now, zone, scene.time);
  return (
    <div className="phone-closeup-scrim" onClick={onClose}>
      <div className={`phone-closeup${ringing ? " ringing" : ""}`} role="dialog" aria-modal="true" aria-label="Phone" onClick={(e) => e.stopPropagation()}>
        <div className="phone-screen">
          <Wallpaper />
          <div className="phone-status" aria-hidden="true">
            <span>{time}</span>
            <span className="phone-signal">
              <span className="phone-bars">
                <i />
                <i />
                <i />
                <i />
              </span>
              <span className="phone-battery" />
            </span>
          </div>
          {/* The island: a pill that becomes the pager's live activity, with the incident clock, while it rings. */}
          <div className={`phone-island${ringing ? " live" : ""}`}>
            {ringing && (
              <>
                <span className="phone-island-dot" aria-hidden="true" />
                <span className="phone-island-sev">{page.severity}</span>
                <span>{` · ${shortTitle(page.title)} · `}</span>
                <span className="phone-island-clock">{formatClock(incident.snapshot.tick)}</span>
              </>
            )}
          </div>
          <div className="phone-lock">
            <p className="phone-date">{cityDate(now, zone)}</p>
            <p className="phone-lock-time">{time}</p>
          </div>
          <div className="phone-stack">
            {paged && (
              <div className="phone-card phone-page">
                <div className="phone-card-head">
                  <span className="phone-card-app">
                    <i aria-hidden="true" />
                    Pager
                  </span>
                  <span className="phone-card-when">{ringing ? "now" : "earlier"}</span>
                </div>
                <div>
                  <span className="tag crit">{page.severity}</span> <b>{page.title}</b>
                </div>
                <p>{fillWorld(page.body, incident.world)}</p>
                {ringing && (
                  <button type="button" className="btn primary" autoFocus onClick={incident.acknowledge}>
                    Acknowledge <kbd>A</kbd>
                  </button>
                )}
              </div>
            )}
            {items.map(([id, h]) => (
              <div key={id} className="phone-card">
                <div className="phone-card-head">
                  <span className="phone-card-app mention">
                    <i aria-hidden="true" />
                    {h.label}
                  </span>
                  <span className="phone-card-when">now</span>
                </div>
                <p>{fillWorld(h.text, incident.world)}</p>
              </div>
            ))}
            {!paged && items.length === 0 && <p className="phone-empty">No notifications</p>}
          </div>
          <div className="phone-foot">
            <button type="button" className="btn phone-close" autoFocus={!ringing} onClick={onClose}>
              Close
            </button>
            <span className="phone-home" aria-hidden="true" />
          </div>
        </div>
      </div>
    </div>
  );
}
