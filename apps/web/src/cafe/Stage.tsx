import { Component, Suspense, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import { formatClock } from "../game/format";
import { fullscreenSettling } from "../os/fullscreen";
import { preloadable } from "../lazyPreload";
import { motionGate } from "../game/motionGate";
import { useIncident } from "../os/incident/IncidentProvider";
import { animation, DUR, EASE_IN_OUT, EASE_OUT } from "../os/motion";
import { usePrefs } from "../os/PrefsProvider";
import { CoachCard } from "../os/coach/CoachCard";
import { PausedOverlay } from "../os/shell/PausedOverlay";
import { useShortcuts } from "../os/useShortcuts";
import { CafeControls } from "./CafeControls";
import { CafeFallback } from "./CafeFallback";
import { cameraReducer, INITIAL_CAMERA, laptopFit, zoomKeyframes, zoomOrigin, type View } from "./camera";
import { CameraContext, type CameraApi } from "./CameraContext";
import { ColdClose } from "./ColdClose";
import { ReportBoundary } from "./ReportBoundary";
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
/** The shortest turn-around when a move is cut short near its end. */
const MIN_TURN_MS = 180;
/** The café's chunk is fetched this long after the desktop comes up, so Start shift rarely waits on it. */
const CAFE_WARM_MS = 1000;

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

/** What a pull-back must wait for: the café's chunk, and the window going full screen. Null when nothing. */
function beforePullBack(): Promise<unknown> | null {
  const waits = [cafe.loaded() ? null : Promise.resolve(cafe.load()), fullscreenSettling()].filter((w) => w !== null);
  return waits.length ? Promise.all(waits).then(undefined, () => undefined) : null;
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
  // The café's chunk comes in while the desktop is idle, so Start shift rarely waits on it.
  useEffect(() => {
    const id = window.setTimeout(() => void Promise.resolve(cafe.load()).then(undefined, () => undefined), CAFE_WARM_MS);
    return () => window.clearTimeout(id);
  }, []);
  // What a pull-back to the café is waiting on, and a nudge to run the move once it lands.
  const waitFor = useRef<Promise<unknown> | null>(null);
  // A pull-back waits once: a café that failed to load gets the plain backdrop, not a camera stuck at the laptop.
  const waited = useRef(false);
  const [released, release] = useReducer((n: number) => n + 1, 0);

  // Fetch the report's chunk as the shift starts: a stale tab then fails before anything is at stake,
  // and the report renders without suspending when the run ends (M2.5 review I4).
  useEffect(() => {
    if (incident.phase === "prepage") void Promise.resolve(loadResults()).catch(() => undefined);
  }, [incident.phase]);

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
    if (!worldEl || !screenEl) return;
    // Every move is a pure zoom about one point, so the laptop stays put on screen (M2.5 follow-up).
    const origin = zoomOrigin(fit);
    worldEl.style.transformOrigin = `${origin.x}px ${origin.y}px`;
    // The camera holds at the laptop until the café is in and a full screen has its size: pulling back
    // onto an empty café, or on geometry that changes mid-move, is the glitch on every new shift (M2.5 follow-up).
    if (camera.view === "cafe" && shown.current !== "cafe" && !moving.current) {
      const wait = waitFor.current ?? (waited.current ? null : beforePullBack());
      if (wait) {
        waitFor.current = wait;
        worldEl.style.transform = `scale(${1 / fit.k})`;
        void wait.then(() => {
          if (waitFor.current !== wait) return;
          waitFor.current = null;
          waited.current = true;
          release();
        });
        return;
      }
    }
    waitFor.current = null;
    waited.current = false;
    worldEl.style.transform = "";
    if (shown.current === camera.view) return;
    shown.current = camera.view;
    // A move cut short turns around from where the camera is, not from its start: pressing L again
    // mid-move never snaps. The rest of the way takes its share of the time.
    const current = moving.current ? getComputedStyle(worldEl).transform : "none";
    const at = current && current !== "none" ? new DOMMatrix(current).a : null;
    moving.current?.cancel();
    moving.current = null;
    const full = camera.closing ? CLOSE_MOVE_MS : DUR.camera;
    const zoomed = 1 / fit.k;
    // How far in the camera is: 0 in the café, 1 at the laptop.
    const inward = at === null ? null : Math.min(1, Math.max(0, Math.log(at) / Math.log(zoomed)));
    const duration = inward === null ? full : Math.max(MIN_TURN_MS, Math.round(full * (camera.view === "cafe" ? inward : 1 - inward)));
    const easing = at === null ? EASE_IN_OUT : EASE_OUT;
    const into = `translate(${fit.x}px, ${fit.y}px) scale(${fit.k})`;
    if (camera.view === "cafe") {
      setCafeShown(true);
      const a = animation(worldEl, zoomKeyframes(at ?? zoomed, 1), { duration, easing });
      moving.current = a;
      if (!a) {
        // No animation (reduced motion): a cut, and nothing left holding the desktop's renders.
        motionGate.set(false);
        focusAfter("cafe");
      } else {
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
    const a = animation(worldEl, zoomKeyframes(at ?? 1, zoomed), { duration, easing, fill: "forwards" });
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
  }, [camera.view, released]);

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
            <div className={`stage-cafe${!cafeShown && !inCafe ? " off" : ""}`} role="region" aria-label="Café" inert={!inCafe} aria-hidden={!inCafe}>
              <CafeBoundary>
                <Suspense fallback={<CafeFallback />}>
                  <CafeView />
                </Suspense>
              </CafeBoundary>
              <CafeControls />
              <ColdClose />
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
          <ReportBoundary onRead={api.enterLaptop}>
            <Suspense fallback={null}>
              <ResultsCard />
            </Suspense>
          </ReportBoundary>
        )}
        <CoachCard />
        <PausedOverlay />
      </div>
    </CameraContext.Provider>
  );
}
