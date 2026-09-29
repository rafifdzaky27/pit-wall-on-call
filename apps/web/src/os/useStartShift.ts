import { useCallback, useEffect, useRef } from "react";
import { enterFullscreen } from "./fullscreen";
import { useIncident } from "./incident/IncidentProvider";
import { usePrefs } from "./PrefsProvider";
import { audio } from "./audio/engine";

/**
 * Start shift, as one click. Full screen and audio both need the click's user activation, so
 * they are requested first (polish spec §3, §7). The returned function is stable and reads the
 * latest preferences, because notifications keep it long after they were pushed.
 */
export function useStartShift(): () => void {
  const incident = useIncident();
  const { prefs } = usePrefs();
  const latest = useRef({ fullscreenOnStart: prefs.fullscreenOnStart, start: incident.start });

  useEffect(() => {
    latest.current = { fullscreenOnStart: prefs.fullscreenOnStart, start: incident.start };
  });

  return useCallback(() => {
    if (latest.current.fullscreenOnStart) void enterFullscreen();
    audio.unlock();
    latest.current.start();
  }, []);
}

/** The training shift, as one click, with the same full-screen and audio unlock as Start shift. */
export function useStartTraining(): () => void {
  const incident = useIncident();
  const { prefs } = usePrefs();
  const latest = useRef({ fullscreenOnStart: prefs.fullscreenOnStart, training: incident.startTraining });

  useEffect(() => {
    latest.current = { fullscreenOnStart: prefs.fullscreenOnStart, training: incident.startTraining };
  });

  return useCallback(() => {
    if (latest.current.fullscreenOnStart) void enterFullscreen();
    audio.unlock();
    latest.current.training();
  }, []);
}
