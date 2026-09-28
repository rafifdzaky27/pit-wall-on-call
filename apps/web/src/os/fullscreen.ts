import { useSyncExternalStore } from "react";

export function fullscreenSupported(): boolean {
  return typeof document.documentElement.requestFullscreen === "function" && document.fullscreenEnabled !== false;
}

export function isFullscreen(): boolean {
  return document.fullscreenElement != null;
}

/** Resolves true when full screen is on. A refusal is normal (iframes, iOS, permissions) and never throws. */
export async function enterFullscreen(): Promise<boolean> {
  if (isFullscreen()) return true;
  if (!fullscreenSupported()) return false;
  try {
    await document.documentElement.requestFullscreen({ navigationUI: "hide" });
    return true;
  } catch {
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
