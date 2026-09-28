import { Suspense, useEffect, useRef, useState } from "react";
import { unreadCount } from "../apps/chat/unread";
import type { AppId } from "../apps/ids";
import { APP_COMPONENTS } from "../apps/registry";
import { Wallpaper } from "../brand/Wallpaper";
import { useIncident } from "../incident/IncidentProvider";
import { usePrefs } from "../PrefsProvider";
import { useShortcuts } from "../useShortcuts";
import { useStartShift } from "../useStartShift";
import { DesktopIcons } from "./DesktopIcons";
import { Dock } from "./Dock";
import { Lockscreen } from "./Lockscreen";
import { useNoticeFeed } from "./noticeFeed";
import { Notifications } from "./Notifications";
import { useOs } from "./OsContext";
import { Overview } from "./Overview";
import { PausedOverlay } from "./PausedOverlay";
import { TopBar } from "./TopBar";
import { Widgets } from "./Widgets";
import { Window } from "./Window";

export function Desktop() {
  const startShift = useStartShift();
  useNoticeFeed(startShift);
  const incident = useIncident();
  const { wm, dispatchWm, openApp, read } = useOs();
  const { prefs } = usePrefs();
  const [overview, setOverview] = useState(false);
  const [locked, setLocked] = useState(false);
  const focused = wm.focusedId;
  const running = incident.phase === "paging" || incident.phase === "active";

  // Each phase brings the right app forward (desktop spec §6).
  const previous = useRef(incident.phase);
  useEffect(() => {
    const before = previous.current;
    previous.current = incident.phase;
    if (before === incident.phase) return;
    if (incident.phase === "prepage") openApp("browser");
    if (incident.phase === "active") openApp("monitoring");
    if (incident.phase === "ended") openApp("postmortem");
  }, [incident.phase, openApp]);

  useShortcuts(
    {
      o: () => setOverview((v) => !v),
      Escape: () => setOverview(false),
      m: () => {
        if (focused) dispatchWm({ type: "toggleMaximize", id: focused });
      },
      "[": () => {
        if (focused) dispatchWm({ type: "snap", id: focused, side: "left" });
      },
      "]": () => {
        if (focused) dispatchWm({ type: "snap", id: focused, side: "right" });
      },
      x: () => {
        if (focused) dispatchWm({ type: "close", id: focused });
      },
      a: () => incident.acknowledge(),
      p: () => {
        if (!running) return;
        if (incident.paused) incident.resume();
        else incident.pause();
      },
    },
    prefs.singleKeyShortcuts && !locked,
  );

  const lock = () => {
    if (running && !incident.paused) incident.pause();
    setLocked(true);
  };

  if (locked) return <Lockscreen onUnlock={() => setLocked(false)} />;

  const city = prefs.wallpaper === "auto" ? incident.world.city.id : prefs.wallpaper;
  return (
    <div className="desktop">
      <Wallpaper city={city} />
      <TopBar overview={overview} onActivities={() => setOverview((v) => !v)} onLock={lock} />
      <main className="workspace" aria-label="Desktop">
        <h1 className="visually-hidden">Pit Wall On-Call</h1>
        <DesktopIcons />
        <Widgets />
        {wm.windows.map((w) => {
          const App = APP_COMPONENTS[w.appId as AppId];
          return (
            <Window key={w.id} win={w} area={wm.area} focused={w.id === focused} layer={10 + w.z} dispatch={dispatchWm}>
              <Suspense
                fallback={
                  <p className="app-pad empty" aria-busy="true">
                    Opening {w.title}…
                  </p>
                }
              >
                <App />
              </Suspense>
            </Window>
          );
        })}
      </main>
      <Notifications />
      <Dock unread={unreadCount(incident, read)} />
      {overview && <Overview onClose={() => setOverview(false)} />}
      <PausedOverlay />
    </div>
  );
}
