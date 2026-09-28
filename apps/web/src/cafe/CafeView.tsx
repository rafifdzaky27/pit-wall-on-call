import { closeState, resolveScene } from "@pitwall/world";
import { useMemo } from "react";
import { formatClock } from "../game/format";
import { isPaged } from "../os/apps/chat/unread";
import { useIncident } from "../os/incident/IncidentProvider";
import { usePrefs } from "../os/PrefsProvider";
import CafeScene from "./CafeScene";
import { useCamera } from "./CameraContext";
import { Hotspots } from "./Hotspots";
import { useCafeAudio } from "./useCafeAudio";

/** The café for this shift, with its hotspots and sound; loaded apart from the main chunk. */
export default function CafeView() {
  const incident = useIncident();
  const camera = useCamera();
  const { prefs } = usePrefs();
  // Once the run is over the café stays as it ended, however often you look up again.
  const close = incident.result ? closeState(incident.result.endTick) : null;
  const weather = useMemo(() => resolveScene(incident.seed).weather, [incident.seed]);
  useCafeAudio(camera.view, weather === "rain" && close !== "late");
  return (
    <CafeScene
      seed={incident.seed}
      close={close}
      ringing={incident.phase === "paging"}
      page={incident.scenario.coldOpen.page}
      radioOn={prefs.radio}
      paused={incident.paused}
      clock={formatClock(incident.snapshot.tick)}
      paged={isPaged(incident.phase)}
    >
      <Hotspots />
    </CafeScene>
  );
}
