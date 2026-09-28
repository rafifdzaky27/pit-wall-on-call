/** Motion tokens (DESIGN.md §9). CSS uses the matching --motion-* and --ease-* variables. */
/** `camera` is the café zoom: a longer move across the whole screen (M1.6 plan R12). */
export const DUR = { fast: 120, base: 180, slow: 240, camera: 700 } as const;
export const EASE_OUT = "cubic-bezier(0.2, 0, 0, 1)";
export const EASE_IN = "cubic-bezier(0.3, 0, 1, 1)";
export const EASE_IN_OUT = "cubic-bezier(0.6, 0, 0.2, 1)";

/** False when Settings → Reduce motion or the system asks for reduced motion. */
export function motionAllowed(root: HTMLElement = document.documentElement): boolean {
  if (root.dataset.motion === "reduce") return false;
  if (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  return true;
}

/**
 * Runs a Web Animations API animation on transform and opacity. Returns null when nothing
 * animates (reduced motion, or no `animate`, as in jsdom), so callers can finish at once.
 */
export function animate(el: Element, keyframes: Keyframe[], options: KeyframeAnimationOptions): Promise<void> | null {
  const a = animation(el, keyframes, options);
  if (!a) return null;
  return a.finished.then(
    () => undefined,
    () => undefined,
  );
}

/** Like `animate`, but hands back the Animation so a newer move can cancel it. */
export function animation(el: Element, keyframes: Keyframe[], options: KeyframeAnimationOptions): Animation | null {
  if (!motionAllowed() || typeof (el as { animate?: unknown }).animate !== "function") return null;
  return el.animate(keyframes, options);
}
