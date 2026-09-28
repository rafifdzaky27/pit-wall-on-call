import { enterFullscreen } from "./fullscreen";
import { useIncident } from "./incident/IncidentProvider";
import { usePrefs } from "./PrefsProvider";
import { synth } from "./sound";

/**
 * Start shift, as one click. Full screen and audio both need the click's user activation, so
 * they are requested first (polish spec §3, §7).
 */
export function useStartShift(): () => void {
  const incident = useIncident();
  const { prefs } = usePrefs();
  return () => {
    if (prefs.fullscreenOnStart) void enterFullscreen();
    synth.unlock();
    incident.start();
  };
}
