import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useCamera } from "../../cafe/CameraContext";
import { AppBoundary } from "../../chunks";
import { unreadCount } from "../apps/chat/unread";
import type { AppId } from "../apps/ids";
import { APP_COMPONENTS } from "../apps/registry";
import { Wallpaper } from "../brand/Wallpaper";
import { useIncident } from "../incident/IncidentProvider";
import { usePrefs } from "../PrefsProvider";
import { useRadio } from "../audio/useRadio";
import { useShortcuts } from "../useShortcuts";
import { useSoundCues } from "../useSoundCues";
import { useStartShift } from "../useStartShift";
import { DesktopIcons } from "./DesktopIcons";
import { Dock } from "./Dock";
import { Lockscreen } from "./Lockscreen";
import { useGuide } from "../guide/useGuide";
import { useNoticeFeed } from "./noticeFeed";
import { useUpdateNotice } from "./useUpdateNotice";
import { Notifications } from "./Notifications";
import { useOs } from "./OsContext";
import { Overview } from "./Overview";
import { TopBar } from "./TopBar";
import { Widgets } from "./Widgets";
import { Window } from "./Window";

export function Desktop() {
  const incident = useIncident();
  const { wm, dispatchWm, openApp, read, setDragging, markSeen } = useOs();
  const { prefs } = usePrefs();
  const [overview, setOverview] = useState(false);
  const [locked, setLocked] = useState(false);
  const startShift = useStartShift();
  const camera = useCamera();
  const focused = wm.focusedId;
  const running = incident.phase === "paging" || incident.phase === "active";

  useNoticeFeed(startShift);
  useGuide();
  useUpdateNotice();
  useSoundCues(locked);
  useRadio(incident.phase === "paging");

  // Each phase brings the right app forward (desktop spec §6).
  const previous = useRef(incident.phase);
  useEffect(() => {
    const before = previous.current;
    previous.current = incident.phase;
    if (before === incident.phase) return;
    if (incident.phase === "prepage") openApp("browser");
    if (incident.phase === "ended") openApp("postmortem");
  }, [incident.phase, openApp]);

  // The checklist counts the Browser when the player brings it forward during the incident (not when it
  // opened by itself before the page), and the postmortem once there is one to read (M2.5 spec §4).
  const focusedApp = wm.windows.find((w) => w.id === focused)?.appId as AppId | undefined;
  const lastFocused = useRef(focusedApp);
  useEffect(() => {
    const moved = lastFocused.current !== focusedApp;
    lastFocused.current = focusedApp;
    if (focusedApp === "browser" && moved && running) markSeen("browser");
    if (focusedApp === "postmortem" && incident.phase === "ended") markSeen("postmortem");
  }, [focusedApp, running, incident.phase, markSeen]);

  // In the café the desktop is out of reach: only the ack and pause work from there (M1.6 plan R6).
  const acknowledge = () => incident.acknowledge();
  const togglePause = () => {
    if (!running) return;
    if (incident.paused) incident.resume();
    else incident.pause();
  };
  const desktopKeys = {
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
    a: acknowledge,
    p: togglePause,
    "?": () => openApp("help"),
  };
  useShortcuts(camera.view === "cafe" ? { a: acknowledge, p: togglePause } : desktopKeys, prefs.singleKeyShortcuts && !locked);

  // z-index by rank keeps every window between 10 and 999, below the dock (polish spec S24).
  const layers = useMemo(() => new Map([...wm.windows].sort((a, b) => a.z - b.z).map((w, i) => [w.id, 10 + i])), [wm.windows]);

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
            <Window key={w.id} win={w} area={wm.area} focused={w.id === focused} layer={layers.get(w.id) ?? 10} dispatch={dispatchWm} onDragChange={setDragging}>
              <AppBoundary autoReload={!running}>
                <Suspense
                  fallback={
                    <p className="app-pad empty" aria-busy="true">
                      Opening {w.title}…
                    </p>
                  }
                >
                  <App />
                </Suspense>
              </AppBoundary>
            </Window>
          );
        })}
      </main>
      <Notifications />
      <Dock unread={unreadCount(incident, read)} forceShow={overview} />
      {overview && <Overview onClose={() => setOverview(false)} />}
    </div>
  );
}
