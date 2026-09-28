export interface Bounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Size {
  w: number;
  h: number;
}

export type WindowMode = "normal" | "maximized" | "left" | "right";
export type Edge = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

export interface WindowState {
  id: string;
  appId: string;
  title: string;
  mode: WindowMode;
  minimized: boolean;
  /** Set by `close`: the window plays its exit animation, then `remove` deletes it. */
  closing: boolean;
  /** The normal-mode rectangle, kept while maximized or snapped so it can be restored. */
  bounds: Bounds;
  /** Smallest normal-mode size (polish spec §4), never above the work area. */
  min: Size;
  z: number;
}

export interface WmState {
  windows: WindowState[];
  focusedId: string | null;
  nextZ: number;
  nextId: number;
  area: Size;
  /** Normal-mode bounds of each app's last closed window, for this session only. */
  lastBounds: Record<string, Bounds>;
  /** Step of the cascade the next new window takes. */
  cascade: number;
}

export type WmAction =
  | { type: "open"; appId: string; title: string; size: Size; min: Size; maximized: boolean }
  | { type: "close"; id: string }
  | { type: "remove"; id: string }
  | { type: "focus"; id: string }
  | { type: "minimize"; id: string }
  | { type: "toggleMaximize"; id: string }
  | { type: "snap"; id: string; side: "left" | "right" }
  | { type: "move"; id: string; x: number; y: number }
  | { type: "setBounds"; id: string; bounds: Bounds }
  | { type: "setArea"; w: number; h: number };

export const MIN_W = 360;
export const MIN_H = 240;
export const CASCADE_STEP = 32;
const CASCADE_STEPS = 6;
/** Pixels of title bar that must stay on screen, horizontally and vertically. */
const GRAB_X = 80;
const TITLEBAR = 36;

export function initialWm(area: Size): WmState {
  return { windows: [], focusedId: null, nextZ: 1, nextId: 1, area, lastBounds: {}, cascade: 0 };
}

export function frameOf(win: WindowState, area: Size): Bounds {
  const half = Math.floor(area.w / 2);
  if (win.mode === "maximized") return { x: 0, y: 0, w: area.w, h: area.h };
  if (win.mode === "left") return { x: 0, y: 0, w: half, h: area.h };
  if (win.mode === "right") return { x: half, y: 0, w: area.w - half, h: area.h };
  return win.bounds;
}

/** The effective minimum: at least MIN_W×MIN_H, at most the work area. */
export function minSize(min: Size, area: Size): Size {
  return { w: Math.min(Math.max(MIN_W, min.w), area.w), h: Math.min(Math.max(MIN_H, min.h), area.h) };
}

function clamp(b: Bounds, area: Size, min: Size): Bounds {
  const m = minSize(min, area);
  const w = Math.max(m.w, Math.min(b.w, area.w));
  const h = Math.max(m.h, Math.min(b.h, area.h));
  const x = Math.min(Math.max(b.x, GRAB_X - w), area.w - GRAB_X);
  const y = Math.min(Math.max(b.y, 0), Math.max(0, area.h - TITLEBAR));
  return { x, y, w, h };
}

function cascadeOrigin(size: Size, area: Size): Bounds {
  const w = Math.min(size.w, area.w);
  const h = Math.min(size.h, area.h);
  return {
    x: Math.max(24, Math.round((area.w - w) / 2) - 2 * CASCADE_STEP),
    y: Math.max(16, Math.round((area.h - h) / 2) - 2 * CASCADE_STEP),
    w,
    h,
  };
}

function cascadeFits(step: number, size: Size, area: Size): boolean {
  const o = cascadeOrigin(size, area);
  return o.x + step * CASCADE_STEP + o.w <= area.w && o.y + step * CASCADE_STEP + o.h <= area.h;
}

/** Where the n-th new window opens: near the centre, then 32 px down and right per window, like GNOME. */
export function cascadeAt(step: number, size: Size, area: Size): Bounds {
  const o = cascadeOrigin(size, area);
  return {
    x: Math.max(0, Math.min(o.x + step * CASCADE_STEP, area.w - o.w)),
    y: Math.max(0, Math.min(o.y + step * CASCADE_STEP, area.h - o.h)),
    w: o.w,
    h: o.h,
  };
}

/**
 * The frame after dragging `edge` by (dx, dy). West and north edges move the origin, and at the
 * minimum size the opposite edge stays where it was.
 */
export function resizeFrom(start: Bounds, edge: Edge, dx: number, dy: number, min: Size, area: Size): Bounds {
  const m = minSize(min, area);
  let { x, y, w, h } = start;
  if (edge.includes("e")) w = Math.max(m.w, start.w + dx);
  if (edge.includes("s")) h = Math.max(m.h, start.h + dy);
  if (edge.includes("w")) {
    w = Math.max(m.w, start.w - dx);
    x = start.x + start.w - w;
  }
  if (edge.includes("n")) {
    h = Math.max(m.h, start.h - dy);
    y = start.y + start.h - h;
    if (y < 0) {
      h += y;
      y = 0;
    }
  }
  return { x, y, w, h };
}

function topVisible(windows: WindowState[], except?: string): string | null {
  let best: WindowState | null = null;
  for (const w of windows) {
    if (w.minimized || w.closing || w.id === except) continue;
    if (!best || w.z > best.z) best = w;
  }
  return best?.id ?? null;
}

function patch(state: WmState, id: string, fn: (w: WindowState) => WindowState): WmState {
  return { ...state, windows: state.windows.map((w) => (w.id === id ? fn(w) : w)) };
}

function raise(state: WmState, id: string): WmState {
  const z = state.nextZ;
  return { ...patch(state, id, (w) => ({ ...w, z, minimized: false })), nextZ: z + 1, focusedId: id };
}

export function wmReducer(state: WmState, action: WmAction): WmState {
  if (action.type === "open") {
    const existing = state.windows.find((w) => w.appId === action.appId && !w.closing);
    if (existing) return raise(state, existing.id);
    const id = `w${state.nextId}`;
    let cascade = state.cascade;
    let bounds = state.lastBounds[action.appId];
    if (!bounds) {
      let step = cascade % CASCADE_STEPS;
      if (step > 0 && !cascadeFits(step, action.size, state.area)) step = 0;
      bounds = cascadeAt(step, action.size, state.area);
      if (!action.maximized) cascade = step + 1;
    }
    const win: WindowState = {
      id,
      appId: action.appId,
      title: action.title,
      mode: action.maximized ? "maximized" : "normal",
      minimized: false,
      closing: false,
      bounds: clamp(bounds, state.area, action.min),
      min: action.min,
      z: 0,
    };
    return raise({ ...state, windows: [...state.windows, win], nextId: state.nextId + 1, cascade }, id);
  }
  if (action.type === "setArea") {
    const area = { w: action.w, h: action.h };
    return { ...state, area, windows: state.windows.map((w) => ({ ...w, bounds: clamp(w.bounds, area, w.min) })) };
  }

  const target = state.windows.find((w) => w.id === action.id);
  if (!target) return state;
  if (target.closing && action.type !== "remove") return state;

  switch (action.type) {
    case "close": {
      const windows = state.windows.map((w) => (w.id === action.id ? { ...w, closing: true } : w));
      return {
        ...state,
        windows,
        lastBounds: { ...state.lastBounds, [target.appId]: target.bounds },
        focusedId: state.focusedId === action.id ? topVisible(windows) : state.focusedId,
      };
    }
    case "remove": {
      const windows = state.windows.filter((w) => w.id !== action.id);
      return { ...state, windows, focusedId: state.focusedId === action.id ? topVisible(windows) : state.focusedId };
    }
    case "focus":
      return raise(state, action.id);
    case "minimize": {
      const next = patch(state, action.id, (w) => ({ ...w, minimized: true }));
      return { ...next, focusedId: state.focusedId === action.id ? topVisible(next.windows, action.id) : state.focusedId };
    }
    case "toggleMaximize":
      return raise(patch(state, action.id, (w) => ({ ...w, mode: w.mode === "maximized" ? "normal" : "maximized" })), action.id);
    case "snap":
      return raise(patch(state, action.id, (w) => ({ ...w, mode: w.mode === action.side ? "normal" : action.side })), action.id);
    case "move":
      return patch(state, action.id, (w) => ({ ...w, mode: "normal", bounds: clamp({ ...w.bounds, x: action.x, y: action.y }, state.area, w.min) }));
    case "setBounds":
      return patch(state, action.id, (w) => ({ ...w, mode: "normal", bounds: clamp(action.bounds, state.area, w.min) }));
  }
}
