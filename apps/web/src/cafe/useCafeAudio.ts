import { useEffect, useState } from "react";
import { Ambience } from "../os/audio/ambience";
import { audio } from "../os/audio/engine";
import type { View } from "./camera";

/** The café's room tone for the shift: clear when you look up, heard through the room on the laptop (cold-open spec §7). */
export function useCafeAudio(view: View, rain: boolean): void {
  const [ambience] = useState(() => new Ambience(audio));

  useEffect(() => {
    void ambience.start({ rain });
    return () => {
      ambience.stop();
      audio.setMuffled(false);
    };
  }, [ambience, rain]);

  useEffect(() => {
    audio.setMuffled(view === "desktop");
  }, [view]);
}
