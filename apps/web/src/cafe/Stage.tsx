import { Component, Suspense, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import { formatClock } from "../game/format";
import { preloadable } from "../lazyPreload";
import { motionGate } from "../game/motionGate";
import { useIncident } from "../os/incident/IncidentProvider";
import { animation, DUR, EASE_IN_OUT } from "../os/motion";
import { usePrefs } from "../os/PrefsProvider";
import { CoachCard } from "../os/coach/CoachCard";
import { PausedOverlay } from "../os/shell/PausedOverlay";
import { useShortcuts } from "../os/useShortcuts";
import { CafeControls } from "./CafeControls";
import { CafeFallback } from "./CafeFallback";
import { cameraReducer, INITIAL_CAMERA, laptopFit, type View } from "./camera";
import { CameraContext, type CameraApi } from "./CameraContext";
import { ColdClose } from "./ColdClose";
import { useViewport } from "./useViewport";

/** The café's art, sound and hotspots load on Start shift, apart from the main chunk (cold-open spec §9). */
const cafe = preloadable(() => import("./CafeView"));
const CafeView = cafe.Component;
/** The shift report and its leaderboard load when a run ends, apart from the main chunk (M2.5 spec §6). */
const results = preloadable(() => import("./ResultsCard").then((m) => ({ default: m.ResultsCard })));
const ResultsCard = results.Component;
/** Tests warm both chunks first, so nothing suspends under fake timers. */
export const loadCafe = cafe.load;
export const loadResults = results.load;

/** If the café cannot load, the plain backdrop keeps the shift playable (cold-open spec §9). */
class CafeBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <CafeFallback /> : this.props.children;
  }
}

/** The resolved chord plays over the postmortem opening before the camera pulls back (cold-open spec §3). */
export const COLD_CLOSE_DELAY_MS = 1500;
/** The cold close pulls back slower than a look up, so the ending reads as an ending (M2.5 spec §11). */
export const CLOSE_MOVE_MS = 1200;

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

function focusAfter(view: View): void {
  if (view === "desktop") {
    // A window's frame cannot take focus; its first control can.
    const inWindow = document.querySelector<HTMLElement>(".stage-screen .window.focused")?.querySelector<HTMLElement>(FOCUSABLE);
    (inWindow ?? document.querySelector<HTMLElement>(".stage-screen .os-topbar button"))?.focus();
  } else {
    // The cold close's button first, when it is up; otherwise the laptop, ready to look back down.
    (document.querySelector<HTMLElement>(".stage-cafe .cold-close button") ?? document.querySelector<HTMLElement>('.stage-cafe [data-hotspot="laptop"]'))?.focus();
  }
}

/**
 * The camera around PitOS (cold-open spec §12). In the café the live desktop is scaled into the
 * laptop's screen and made inert; a zoom is one transform animation on the wrapper of both layers.
 */
export function Stage({ children }: { children: ReactNode }) {
  const incident = useIncident();
  const { prefs } = usePrefs();
  const [camera, dispatch] = useReducer(cameraReducer, INITIAL_CAMERA);
  const [cafeShown, setCafeShown] = useState(false);
  const size = useViewport();
  const world = useRef<HTMLDivElement>(null);
  const screen = useRef<HTMLDivElement>(null);
  const shown = useRef<View>("desktop");
  const moving = useRef<Animation | null>(null);
  const fit = laptopFit(size.w, size.h);
  const inCafe = camera.view === "cafe";

  // "Fix confirmed" shows on the laptop only in the pause before the cold close (M2.5 spec §11).
  const [leadIn, setLeadIn] = useState(false);
  useEffect(() => {
    if (incident.phase !== "ended") {
      setLeadIn(false);
      dispatch({ type: "phase", to: incident.phase });
      return;
    }
    setLeadIn(true);
    const id = window.setTimeout(() => {
      setLeadIn(false);
      dispatch({ type: "phase", to: "ended" });
    }, COLD_CLOSE_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [incident.phase]);

  // One move at a time: a new one cancels the last, so the camera always ends where the last input sent it.
  useLayoutEffect(() => {
    const worldEl = world.current;
    const screenEl = screen.current;
    if (!worldEl || !screenEl || shown.current === camera.view) return;
    shown.current = camera.view;
    moving.current?.cancel();
    moving.current = null;
    const duration = camera.closing ? CLOSE_MOVE_MS : DUR.camera;
    const into = `translate(${fit.x}px, ${fit.y}px) scale(${fit.k})`;
    const outOf = `scale(${1 / fit.k}) translate(${-fit.x}px, ${-fit.y}px)`;
    if (camera.view === "cafe") {
      setCafeShown(true);
      const a = animation(worldEl, [{ transform: outOf }, { transform: "none" }], { duration, easing: EASE_IN_OUT });
      moving.current = a;
      if (!a) focusAfter("cafe");
      else {
        motionGate.set(true);
        a.finished.then(
          () => {
            if (moving.current === a) motionGate.set(false);
            focusAfter("cafe");
          },
          () => undefined,
        );
      }
      return;
    }
    // Zooming in keeps the desktop in the laptop until the move ends, then drops every transform.
    screenEl.style.transform = into;
    const a = animation(worldEl, [{ transform: "none" }, { transform: outOf }], { duration, easing: EASE_IN_OUT, fill: "forwards" });
    if (a) motionGate.set(true);
    const settle = () => {
      if (moving.current !== a) return;
      moving.current = null;
      motionGate.set(false);
      a?.cancel();
      screenEl.style.transform = "";
      setCafeShown(false);
      focusAfter("desktop");
    };
    moving.current = a;
    if (!a) settle();
    else a.finished.then(settle, () => undefined);
  }, [camera.view]);

  // A cancelled move (unmount) must not leave the desktop frozen.
  useEffect(() => () => motionGate.set(false), []);

  const confirmed = leadIn && incident.phase === "ended" && camera.view === "desktop" ? incident.result : null;

  const api = useMemo<CameraApi>(
    () => ({
      ...camera,
      lookUp: () => dispatch({ type: "lookUp" }),
      enterLaptop: () => dispatch({ type: "enterLaptop" }),
    }),
    [camera],
  );

  useShortcuts({ l: () => dispatch({ type: inCafe ? "enterLaptop" : "lookUp" }) }, prefs.singleKeyShortcuts && camera.started);

  return (
    <CameraContext.Provider value={api}>
      <div className={`stage${inCafe ? " in-cafe" : ""}`}>
        <div className="stage-world" ref={world}>
          {camera.started && (
            <div className="stage-cafe" role="region" aria-label="Café" hidden={!cafeShown && !inCafe} inert={!inCafe} aria-hidden={!inCafe}>
              <CafeBoundary>
                <Suspense fallback={<CafeFallback />}>
                  <CafeView />
                </Suspense>
              </CafeBoundary>
              <CafeControls />
              <ColdClose />
              {/* A new shift's city fades in: a curtain on layer 1 lifts off the art. The café wrapper
                  itself never animates, so it never traps the café UI under the screen (M2.5). */}
              <div className="cafe-curtain" key={incident.seed} aria-hidden="true" />
            </div>
          )}
          <div
            className="stage-screen"
            data-testid="stage-screen"
            ref={screen}
            inert={inCafe}
            style={inCafe ? { transform: `translate(${fit.x}px, ${fit.y}px) scale(${fit.k})` } : undefined}
          >
            {children}
          </div>
        </div>
        {confirmed && (
          <p className="fix-confirmed" role="status">
            {confirmed.outcome === "resolved" ? `Fix confirmed · resolved in ${formatClock(confirmed.endTick)}` : `Out of time · ${formatClock(confirmed.endTick)}`}
          </p>
        )}
        {/* Outside the world transform, so it is sized by the viewport, not the scene. */}
        {incident.phase === "ended" && inCafe && (
          <Suspense fallback={null}>
            <ResultsCard />
          </Suspense>
        )}
        <CoachCard />
        <PausedOverlay />
      </div>
    </CameraContext.Provider>
  );
}
