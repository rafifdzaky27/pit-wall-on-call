import { useEffect, useRef, useState } from "react";
import { useIncident } from "./incident/IncidentProvider";
import { usePrefs } from "./PrefsProvider";
import { PAGER_EVERY_MS, synth } from "./sound";

/** Maps incident phases to sounds (polish spec §7). Chat and banner sounds are played by Notifications. */
export function useSoundCues(locked: boolean): void {
  const { phase, paused, result } = useIncident();
  const { prefs } = usePrefs();
  const [hidden, setHidden] = useState(() => document.hidden);

  useEffect(() => {
    synth.volume = prefs.volume / 100;
    synth.muted = prefs.muted;
    if (prefs.muted) synth.stop();
  }, [prefs.volume, prefs.muted]);

  useEffect(() => {
    const unlock = () => synth.unlock();
    const onVisibility = () => setHidden(document.hidden);
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const ringing = phase === "paging" && !paused && !hidden && !locked;
  useEffect(() => {
    if (!ringing) return;
    synth.play("pager");
    const id = window.setInterval(() => synth.play("pager"), PAGER_EVERY_MS);
    return () => {
      window.clearInterval(id);
      synth.stop();
    };
  }, [ringing]);

  const before = useRef(phase);
  useEffect(() => {
    const was = before.current;
    before.current = phase;
    if (was === "paging" && phase === "active") synth.play("ack");
    if (was !== "ended" && phase === "ended" && result) synth.play(result.outcome === "resolved" ? "resolved" : "dnf");
  }, [phase, result]);
}
