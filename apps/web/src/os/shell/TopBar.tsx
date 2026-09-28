import { useState } from "react";
import { useIncident } from "../incident/IncidentProvider";
import { usePrefs } from "../PrefsProvider";
import { useNow } from "../useNow";
import { useOs } from "./OsContext";
import { PhoneWidget } from "./PhoneWidget";

interface Props {
  overview: boolean;
  onActivities: () => void;
  onLock: () => void;
}

export function TopBar({ overview, onActivities, onLock }: Props) {
  const incident = useIncident();
  const { prefs, update } = usePrefs();
  const { openApp } = useOs();
  const now = useNow();
  const [menu, setMenu] = useState(false);
  const paging = incident.phase === "paging";
  const clock = new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(now);

  return (
    <header className="os-topbar">
      <button type="button" className="os-activities" aria-pressed={overview} onClick={onActivities}>
        Activities
      </button>
      <time className="os-clock" dateTime={now.toISOString()}>
        {clock}
      </time>
      <div className="os-tray">
        <span className={paging ? "oncall paged" : "oncall"}>{paging ? "Paged" : "On call · Primary"}</span>
        <PhoneWidget />
        <div className="sysmenu">
          <button type="button" className="tray-btn" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
            System
          </button>
          {menu && (
            <div className="sysmenu-panel" role="group" aria-label="System menu">
              <div className="seg" role="group" aria-label="Theme">
                <button type="button" aria-pressed={prefs.theme === "dark"} onClick={() => update({ theme: "dark" })}>
                  Dark
                </button>
                <button type="button" aria-pressed={prefs.theme === "light"} onClick={() => update({ theme: "light" })}>
                  Light
                </button>
              </div>
              <button
                type="button"
                className="menu-item"
                onClick={() => {
                  setMenu(false);
                  openApp("settings");
                }}
              >
                Settings
              </button>
              <button
                type="button"
                className="menu-item"
                onClick={() => {
                  setMenu(false);
                  onLock();
                }}
              >
                Lock
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
