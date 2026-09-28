import { STABLE_TICKS_TO_RESOLVE, TICKS_PER_SECOND, type Snapshot } from "@pitwall/engine";
import { useEffect, useRef, useState } from "react";

/** How long "Fix did not hold" stays up after the resolve condition breaks. */
export const BROKEN_MS = 5000;
const HOLD_S = STABLE_TICKS_TO_RESOLVE / TICKS_PER_SECOND;

/** The engine resolves a run once the fix holds for 10 s; this makes that wait visible (M1.6 F2). */
export function HoldIndicator({ snapshot }: { snapshot: Snapshot }) {
  const since = snapshot.outcome === "running" ? snapshot.stableSinceTick : null;
  const before = useRef(since);
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    const was = before.current;
    before.current = since;
    if (since !== null) {
      setBroken(false);
      return;
    }
    if (was === null || snapshot.outcome !== "running") return;
    setBroken(true);
    const id = window.setTimeout(() => setBroken(false), BROKEN_MS);
    return () => window.clearTimeout(id);
  }, [since, snapshot.outcome]);

  if (since !== null) {
    const held = snapshot.tick - since;
    const left = Math.max(0, Math.ceil((STABLE_TICKS_TO_RESOLVE - held) / TICKS_PER_SECOND));
    const secs = Math.min(HOLD_S, Math.floor(held / TICKS_PER_SECOND));
    return (
      <span className="hold" role="status">
        Fix holding · {left} s
        <span className="hold-bar" role="progressbar" aria-label="Fix holding" aria-valuemin={0} aria-valuemax={HOLD_S} aria-valuenow={secs}>
          <i style={{ transform: `scaleX(${secs / HOLD_S})` }} />
        </span>
      </span>
    );
  }
  return broken ? (
    <span className="hold broken" role="status">
      Fix did not hold
    </span>
  ) : null;
}
