import { useSyncExternalStore } from "react";

export function fullscreenSupported(): boolean {
  return typeof document.documentElement.requestFullscreen === "function" && document.fullscreenEnabled !== false;
}

export function isFullscreen(): boolean {
  return document.fullscreenElement != null;
}

/** The longest a camera move waits for the window to finish going full screen. */
export const FULLSCREEN_SETTLE_MS = 800;
let settling: Promise<void> | null = null;

/**
 * While the window is going full screen, the promise that resolves once it has its new size, else null.
 * The café camera waits on it: a move that starts before the resize lands runs on the old geometry
 * and jumps when the window grows (M2.5 follow-up: every new shift from the laptop).
 */
export function fullscreenSettling(): Promise<void> | null {
  return settling;
}

/** Resolves true when full screen is on. A refusal is normal (iframes, iOS, permissions) and never throws. */
export async function enterFullscreen(): Promise<boolean> {
  if (isFullscreen()) return true;
  if (!fullscreenSupported()) return false;
  let settled = () => undefined as void;
  const current = new Promise<void>((resolve) => {
    let frame = 0;
    const done = () => {
      window.removeEventListener("resize", onResize);
      document.removeEventListener("fullscreenchange", onResize);
      window.clearTimeout(timer);
      cancelAnimationFrame(frame);
      if (settling === current) settling = null;
      resolve();
    };
    // The size lands with a resize, around the full-screen change; two more frames let the page lay out at it.
    const onResize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => (frame = requestAnimationFrame(done)));
    };
    const timer = window.setTimeout(done, FULLSCREEN_SETTLE_MS);
    window.addEventListener("resize", onResize);
    document.addEventListener("fullscreenchange", onResize);
    settled = done;
  });
  settling = current;
  try {
    await document.documentElement.requestFullscreen({ navigationUI: "hide" });
    return true;
  } catch {
    settled();
    return false;
  }
}

export async function exitFullscreen(): Promise<void> {
  if (!isFullscreen() || typeof document.exitFullscreen !== "function") return;
  try {
    await document.exitFullscreen();
  } catch {
    // Already left, for example with Esc.
  }
}

const subscribe = (onChange: () => void) => {
  document.addEventListener("fullscreenchange", onChange);
  return () => document.removeEventListener("fullscreenchange", onChange);
};

export function useFullscreen(): boolean {
  return useSyncExternalStore(subscribe, isFullscreen, () => false);
}
