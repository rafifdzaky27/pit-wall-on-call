export interface Bounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type WindowMode = "normal" | "maximized" | "left" | "right";

export interface WindowState {
  id: string;
  appId: string;
  title: string;
  mode: WindowMode;
  minimized: boolean;
  /** The normal-mode rectangle, kept while maximized or snapped so it can be restored. */
  bounds: Bounds;
  z: number;
}

export interface WmState {
  windows: WindowState[];
  focusedId: string | null;
  nextZ: number;
  nextId: number;
  area: { w: number; h: number };
}

export type WmAction =
  | { type: "open"; appId: string; title: string; bounds: Bounds; maximized: boolean }
  | { type: "close"; id: string }
  | { type: "focus"; id: string }
  | { type: "minimize"; id: string }
  | { type: "toggleMaximize"; id: string }
  | { type: "snap"; id: string; side: "left" | "right" }
  | { type: "move"; id: string; x: number; y: number }
  | { type: "resize"; id: string; w: number; h: number }
  | { type: "setArea"; w: number; h: number };

export const MIN_W = 360;
export const MIN_H = 240;
/** Pixels of title bar that must stay on screen, horizontally and vertically. */
const GRAB_X = 80;
const TITLEBAR = 36;

export function initialWm(area: { w: number; h: number }): WmState {
  return { windows: [], focusedId: null, nextZ: 1, nextId: 1, area };
}

export function frameOf(win: WindowState, area: { w: number; h: number }): Bounds {
  const half = Math.floor(area.w / 2);
  if (win.mode === "maximized") return { x: 0, y: 0, w: area.w, h: area.h };
  if (win.mode === "left") return { x: 0, y: 0, w: half, h: area.h };
  if (win.mode === "right") return { x: half, y: 0, w: area.w - half, h: area.h };
  return win.bounds;
}

function clamp(b: Bounds, area: { w: number; h: number }): Bounds {
  const w = Math.max(MIN_W, Math.min(b.w, area.w));
  const h = Math.max(MIN_H, Math.min(b.h, area.h));
  const x = Math.min(Math.max(b.x, GRAB_X - w), area.w - GRAB_X);
  const y = Math.min(Math.max(b.y, 0), Math.max(0, area.h - TITLEBAR));
  return { x, y, w, h };
}

function topVisible(windows: WindowState[], except?: string): string | null {
  let best: WindowState | null = null;
  for (const w of windows) {
    if (w.minimized || w.id === except) continue;
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
    const existing = state.windows.find((w) => w.appId === action.appId);
    if (existing) return raise(state, existing.id);
    const id = `w${state.nextId}`;
    const win: WindowState = {
      id,
      appId: action.appId,
      title: action.title,
      mode: action.maximized ? "maximized" : "normal",
      minimized: false,
      bounds: clamp(action.bounds, state.area),
      z: 0,
    };
    return raise({ ...state, windows: [...state.windows, win], nextId: state.nextId + 1 }, id);
  }
  if (action.type === "setArea") {
    const area = { w: action.w, h: action.h };
    return { ...state, area, windows: state.windows.map((w) => ({ ...w, bounds: clamp(w.bounds, area) })) };
  }

  if (!state.windows.some((w) => w.id === action.id)) return state;

  switch (action.type) {
    case "close": {
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
      return patch(state, action.id, (w) => ({ ...w, mode: "normal", bounds: clamp({ ...w.bounds, x: action.x, y: action.y }, state.area) }));
    case "resize":
      return patch(state, action.id, (w) => ({ ...w, mode: "normal", bounds: clamp({ ...w.bounds, w: action.w, h: action.h }, state.area) }));
  }
}
