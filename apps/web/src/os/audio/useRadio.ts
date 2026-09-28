import { useEffect } from "react";
import { usePrefs } from "../PrefsProvider";
import { audio } from "./engine";

/** The radio's code loads only when someone turns it on (it is off by default). */
export const loadRadio = () => import("./lofi").then((m) => m.radio);

/** Plays the lo-fi radio while it is switched on, and ducks it while the pager rings (cold-open spec §7). */
export function useRadio(ringing: boolean): void {
  const { prefs } = usePrefs();

  useEffect(() => {
    audio.setDucked(ringing);
  }, [ringing]);

  useEffect(() => {
    if (!prefs.radio) return;
    let on = true;
    let stop = () => undefined as void;
    void loadRadio().then((radio) => {
      if (!on) return;
      // Audio exists only after a user gesture: try now, and again on each gesture until it plays.
      const tryStart = () => radio.start();
      tryStart();
      window.addEventListener("pointerdown", tryStart);
      window.addEventListener("keydown", tryStart);
      stop = () => {
        window.removeEventListener("pointerdown", tryStart);
        window.removeEventListener("keydown", tryStart);
        radio.stop();
      };
    });
    return () => {
      on = false;
      stop();
    };
  }, [prefs.radio]);
}
