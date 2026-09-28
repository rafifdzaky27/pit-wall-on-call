import type { Bounds, Size } from "../wm/wm";

/** The dock's 56 px bar plus its 8 px margin from the bottom edge (DESIGN.md §9). */
export const DOCK_BAR_H = 64;

export function dockRect(area: Size, width: number): Bounds {
  return { x: Math.round((area.w - width) / 2), y: area.h - DOCK_BAR_H, w: width, h: DOCK_BAR_H };
}

export function overlaps(a: Bounds, b: Bounds): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** Intellihide: the dock tucks away while any window covers it (polish spec S14). */
export function dockHidden(frames: Bounds[], dock: Bounds): boolean {
  return frames.some((f) => overlaps(f, dock));
}
