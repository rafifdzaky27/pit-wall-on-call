import { useEffect } from "react";
import { usePrefs } from "../PrefsProvider";
import { audio } from "./engine";
import { radio } from "./lofi";

/** Plays the lo-fi radio while it is switched on, and ducks it while the pager rings (cold-open spec §7). */
export function useRadio(ringing: boolean): void {
  const { prefs } = usePrefs();

  useEffect(() => {
    audio.setDucked(ringing);
  }, [ringing]);

  useEffect(() => {
    if (!prefs.radio) return;
    // Audio exists only after a user gesture: try now, and again on each gesture until it plays.
    const tryStart = () => radio.start();
    tryStart();
    window.addEventListener("pointerdown", tryStart);
    window.addEventListener("keydown", tryStart);
    return () => {
      window.removeEventListener("pointerdown", tryStart);
      window.removeEventListener("keydown", tryStart);
      radio.stop();
    };
  }, [prefs.radio]);
}
