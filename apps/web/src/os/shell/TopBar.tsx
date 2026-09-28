import { useEffect, useRef } from "react";
import { Glyph } from "../brand/Glyph";
import { useIncident } from "../incident/IncidentProvider";
import { usePrefs } from "../PrefsProvider";
import { useNow } from "../useNow";
import { CalendarMenu } from "./CalendarMenu";
import { useOs, type MenuId } from "./OsContext";
import { PhoneWidget } from "./PhoneWidget";
import { QuickSettings } from "./QuickSettings";

interface Props {
  overview: boolean;
  onActivities: () => void;
  onLock: () => void;
}

export function TopBar({ overview, onActivities, onLock }: Props) {
  const incident = useIncident();
  const { prefs } = usePrefs();
  const { openMenu, setOpenMenu, notices } = useOs();
  const now = useNow();
  const bar = useRef<HTMLElement>(null);
  const paging = incident.phase === "paging";
  const unread = notices.some((n) => !n.read);
  const clock = new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(now);

  // One menu at a time; Esc or a click anywhere outside the top bar closes it (polish spec S17).
  useEffect(() => {
    if (!openMenu) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!bar.current?.contains(e.target as Node)) setOpenMenu(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenMenu(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [openMenu, setOpenMenu]);

  const toggle = (menu: MenuId) => setOpenMenu(openMenu === menu ? null : menu);

  return (
    <header className="os-topbar" ref={bar}>
      <button type="button" className="os-activities" aria-pressed={overview} onClick={onActivities}>
        Activities
      </button>
      <div className="clockmenu">
        <button type="button" className="os-clock" aria-expanded={openMenu === "calendar"} aria-label={unread ? `${clock}, unread notifications` : clock} onClick={() => toggle("calendar")}>
          <time dateTime={now.toISOString()}>{clock}</time>
          {unread && <span className="clock-dot" aria-hidden="true" />}
        </button>
        {openMenu === "calendar" && <CalendarMenu now={now} />}
      </div>
      <div className="os-tray">
        <span className={paging ? "oncall paged" : "oncall"}>{paging ? "Paged" : "On call · Primary"}</span>
        <PhoneWidget />
        <div className="sysmenu">
          <button type="button" className="tray-btn" aria-label="System" aria-expanded={openMenu === "system"} onClick={() => toggle("system")}>
            <Glyph name={prefs.muted ? "mute" : "volume"} />
            <Glyph name="power" />
          </button>
          {openMenu === "system" && (
            <QuickSettings
              onLock={() => {
                setOpenMenu(null);
                onLock();
              }}
            />
          )}
        </div>
      </div>
    </header>
  );
}
