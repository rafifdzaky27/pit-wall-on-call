import { useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import { useIncident } from "../os/incident/IncidentProvider";
import { animation, DUR, EASE_IN_OUT } from "../os/motion";
import { usePrefs } from "../os/PrefsProvider";
import { PausedOverlay } from "../os/shell/PausedOverlay";
import { useShortcuts } from "../os/useShortcuts";
import { CafeFallback } from "./CafeFallback";
import { cameraReducer, INITIAL_CAMERA, laptopFit, type View } from "./camera";
import { CameraContext, type CameraApi } from "./CameraContext";

/** The resolved chord plays over the postmortem opening before the camera pulls back (cold-open spec §3). */
export const COLD_CLOSE_DELAY_MS = 1500;

function useViewport(): { w: number; h: number } {
  const [size, setSize] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return size;
}

function focusAfter(view: View): void {
  if (view === "desktop") {
    (document.querySelector<HTMLElement>(".stage-screen .window.focused") ?? document.querySelector<HTMLElement>(".stage-screen .os-topbar button"))?.focus();
  } else {
    document.querySelector<HTMLElement>('.stage-cafe [data-hotspot="laptop"]')?.focus();
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

  useEffect(() => {
    if (incident.phase !== "ended") {
      dispatch({ type: "phase", to: incident.phase });
      return;
    }
    const id = window.setTimeout(() => dispatch({ type: "phase", to: "ended" }), COLD_CLOSE_DELAY_MS);
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
    const into = `translate(${fit.x}px, ${fit.y}px) scale(${fit.k})`;
    const outOf = `scale(${1 / fit.k}) translate(${-fit.x}px, ${-fit.y}px)`;
    if (camera.view === "cafe") {
      setCafeShown(true);
      const a = animation(worldEl, [{ transform: outOf }, { transform: "none" }], { duration: DUR.camera, easing: EASE_IN_OUT });
      moving.current = a;
      if (!a) focusAfter("cafe");
      else
        a.finished.then(
          () => focusAfter("cafe"),
          () => undefined,
        );
      return;
    }
    // Zooming in keeps the desktop in the laptop until the move ends, then drops every transform.
    screenEl.style.transform = into;
    const a = animation(worldEl, [{ transform: "none" }, { transform: outOf }], { duration: DUR.camera, easing: EASE_IN_OUT, fill: "forwards" });
    const settle = () => {
      if (moving.current !== a) return;
      moving.current = null;
      a?.cancel();
      screenEl.style.transform = "";
      setCafeShown(false);
      focusAfter("desktop");
    };
    moving.current = a;
    if (!a) settle();
    else a.finished.then(settle, () => undefined);
  }, [camera.view]);

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
            <div className="stage-cafe" hidden={!cafeShown && !inCafe} inert={!inCafe} aria-hidden={!inCafe}>
              <CafeFallback />
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
        <PausedOverlay />
      </div>
    </CameraContext.Provider>
  );
}
