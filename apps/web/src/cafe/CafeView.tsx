import { closeState, resolveScene } from "@pitwall/world";
import { useEffect, useMemo, useState } from "react";
import { formatClock } from "../game/format";
import { isPaged } from "../os/apps/chat/unread";
import { useIncident } from "../os/incident/IncidentProvider";
import { usePrefs } from "../os/PrefsProvider";
import CafeScene from "./CafeScene";
import { useCamera } from "./CameraContext";
import { Hotspots } from "./Hotspots";
import { useCafeAudio } from "./useCafeAudio";

/** Longest camera move (the cold close's 1.2 s pull-back) plus a little slack. */
const CAMERA_SETTLE_MS = 1400;

/** The café for this shift, with its hotspots and sound; loaded apart from the main chunk. */
export default function CafeView() {
  const incident = useIncident();
  const camera = useCamera();
  const { prefs } = usePrefs();
  // Once the run is over the café stays as it ended, however often you look up again.
  const close = incident.result ? closeState(incident.result.endTick) : null;
  const weather = useMemo(() => resolveScene(incident.seed).weather, [incident.seed]);
  useCafeAudio(camera.view, weather === "rain" && close !== "late");
  // While the camera moves, the café's loops hold still: an animated drop would make the art raster again,
  // at the zoom's scale, on every frame of the move. They carry on once it settles.
  const [moving, setMoving] = useState(true);
  useEffect(() => {
    setMoving(true);
    const id = window.setTimeout(() => setMoving(false), CAMERA_SETTLE_MS);
    return () => window.clearTimeout(id);
  }, [camera.view]);
  return (
    <CafeScene
      seed={incident.seed}
      close={close}
      ringing={incident.phase === "paging"}
      page={incident.scenario.coldOpen.page}
      radioOn={prefs.radio}
      paused={incident.paused}
      moving={moving}
      clock={formatClock(incident.snapshot.tick)}
      paged={isPaged(incident.phase)}
    >
      <Hotspots />
    </CafeScene>
  );
}
