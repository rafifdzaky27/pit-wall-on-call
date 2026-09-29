import { closeState, resolveScene } from "@pitwall/world";
import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
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
  // Known in the same render as the view change, so no frame of a move runs the loops (review 5).
  const [moveTo, setMoveTo] = useState<{ view: string; settled: boolean }>({ view: camera.view, settled: false });
  if (moveTo.view !== camera.view) setMoveTo({ view: camera.view, settled: false });
  const moving = moveTo.view !== camera.view || !moveTo.settled;
  useEffect(() => {
    if (moveTo.settled) return;
    const id = window.setTimeout(() => setMoveTo((m) => (m.view === moveTo.view ? { ...m, settled: true } : m)), CAMERA_SETTLE_MS);
    return () => window.clearTimeout(id);
  }, [moveTo]);
  // New shift sends the camera back to the laptop: until it gets there, the café stays the city you
  // were in. The next city is drawn once the café is out of sight, so nothing swaps mid-move (M2.5
  // follow-up: the flicker on New shift).
  const held = useRef<{ seed: number; scene: ReactElement } | null>(null);
  // Only while the new shift is still idle: once it starts, the café you look up at is the new city (review 1).
  const settledAtLaptop = camera.view === "desktop" && !moving;
  if (held.current && held.current.seed !== incident.seed && incident.phase === "idle" && !settledAtLaptop) return held.current.scene;
  const scene = (
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
  held.current = { seed: incident.seed, scene };
  return scene;
}
