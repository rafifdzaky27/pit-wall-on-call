import type { IncidentPhase } from "../os/incident/IncidentProvider";

/** Where the player is looking (cold-open spec §12): at the laptop (PitOS fills the screen) or up at the café. */
export type View = "desktop" | "cafe";

export interface Camera {
  view: View;
  /** Start shift has happened, so there is a café to look up at. */
  started: boolean;
  /** The cold close after the run ends. */
  closing: boolean;
}

export type CameraEvent = { type: "phase"; to: IncidentPhase } | { type: "lookUp" } | { type: "enterLaptop" };

export const INITIAL_CAMERA: Camera = { view: "desktop", started: false, closing: false };

export function cameraReducer(c: Camera, e: CameraEvent): Camera {
  switch (e.type) {
    case "phase":
      // New shift keeps the café and returns to the laptop's fresh desktop (M2.5 spec §11).
      if (e.to === "idle") return c.started ? { view: "desktop", started: true, closing: false } : INITIAL_CAMERA;
      if (e.to === "prepage") return { view: "cafe", started: true, closing: false };
      // The ack takes you into the laptop, to the desktop as you left it (M2.5 follow-up).
      if (e.to === "active") return { view: "desktop", started: true, closing: false };
      if (e.to === "ended") return { view: "cafe", started: true, closing: true };
      // The page does not move the camera (spec C10).
      return { ...c, started: true };
    case "lookUp":
      return c.started && c.view !== "cafe" ? { ...c, view: "cafe" } : c;
    case "enterLaptop":
      return c.view === "desktop" ? c : { ...c, view: "desktop", closing: false };
  }
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The café is drawn on a 1600×900 canvas; the laptop's screen is where the live desktop sits. */
export const SCENE = { w: 1600, h: 900, screen: { x: 610, y: 470, w: 380, h: 238 } } as const;

/** Scale and offset of the scene when it covers the viewport (SVG "xMidYMid slice"). */
export function sceneFit(vw: number, vh: number): { s: number; ox: number; oy: number } {
  const s = Math.max(vw / SCENE.w, vh / SCENE.h);
  return { s, ox: (vw - SCENE.w * s) / 2, oy: (vh - SCENE.h * s) / 2 };
}

export function toViewport(r: Rect, vw: number, vh: number): Rect {
  const { s, ox, oy } = sceneFit(vw, vh);
  return { x: ox + r.x * s, y: oy + r.y * s, w: r.w * s, h: r.h * s };
}

/** Where the full-size desktop goes, and at what scale, to sit inside the laptop's screen. */
export function laptopFit(vw: number, vh: number): { x: number; y: number; k: number } {
  const r = toViewport(SCENE.screen, vw, vh);
  const k = Math.min(r.w / vw, r.h / vh);
  return { x: r.x + (r.w - vw * k) / 2, y: r.y + (r.h - vh * k) / 2, k };
}

/**
 * The one point the camera zooms about: under `scale(1 / k)` around it, the laptop's screen fills the
 * viewport. Zooming about a fixed point keeps the laptop where it is on screen for the whole move; a
 * scale and a translate interpolated apart swing the view across the street first (M2.5 follow-up).
 */
export function zoomOrigin(fit: { x: number; y: number; k: number }): { x: number; y: number } {
  const d = 1 - fit.k || 1;
  return { x: fit.x / d, y: fit.y / d };
}

/** Pure scales about the zoom origin, evenly spaced in zoom, so the move reads at one steady pace. */
export function zoomKeyframes(from: number, to: number, steps = 8): Keyframe[] {
  return Array.from({ length: steps + 1 }, (_, i) => ({ offset: i / steps, transform: `scale(${from * Math.pow(to / from, i / steps)})` }));
}
