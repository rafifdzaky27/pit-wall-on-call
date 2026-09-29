import { useEffect, type RefObject } from "react";
import { motionAllowed } from "../os/motion";

/**
 * Sets --px and --py (−1…1) on the element from the pointer, without re-rendering React.
 * The café's far and middle layers move by a few pixels against them (cold-open spec §6). While the
 * camera moves (`.moving`), they hold still: a layer that shifts mid-zoom re-rasters at the zoom's scale.
 */
export function useParallax(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const el = ref.current;
    if (!el || !motionAllowed()) return;
    let frame = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(frame);
      if (el.classList.contains("moving")) return;
      frame = requestAnimationFrame(() => {
        el.style.setProperty("--px", ((e.clientX / window.innerWidth) * 2 - 1).toFixed(3));
        el.style.setProperty("--py", ((e.clientY / window.innerHeight) * 2 - 1).toFixed(3));
      });
    };
    window.addEventListener("pointermove", onMove);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
    };
  }, [ref]);
}
