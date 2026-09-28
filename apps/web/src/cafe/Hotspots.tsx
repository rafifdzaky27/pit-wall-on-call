import { fillWorld } from "@pitwall/world";
import { useEffect, useState } from "react";
import { audio } from "../os/audio/engine";
import { useIncident } from "../os/incident/IncidentProvider";
import { usePrefs } from "../os/PrefsProvider";
import { NEIGHBOURS } from "./art/Patrons";
import { POSTER, RADIO } from "./art/Interior";
import { LAPTOP, PHONE } from "./art/Table";
import { toViewport, type Rect } from "./camera";
import { useCamera } from "./CameraContext";
import { PhoneCloseup } from "./PhoneCloseup";
import { useViewport } from "./useViewport";

type Spot = { id: string; rect: Rect; name: string };

/** Transparent buttons over the art (cold-open spec §6, §9): Tab reaches each, and each says what it is. */
export function Hotspots() {
  const incident = useIncident();
  const camera = useCamera();
  const { prefs, update } = usePrefs();
  const size = useViewport();
  const [caption, setCaption] = useState<string | null>(null);
  const [phoneOpen, setPhoneOpen] = useState(false);
  const clues = incident.scenario.coldOpen.hotspots;

  useEffect(() => {
    if (!caption) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCaption(null);
    };
    const onDown = (e: PointerEvent) => {
      if (!(e.target as Element).closest?.(`[data-hotspot="${caption}"]`)) setCaption(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [caption]);

  const spots: Spot[] = [
    { id: "laptop", rect: LAPTOP, name: "Laptop" },
    { id: "phone", rect: PHONE, name: "Phone" },
    ...(["table.neighbours", "wall.poster"] as const).filter((id) => clues[id]).map((id) => ({ id, rect: id === "wall.poster" ? POSTER : NEIGHBOURS, name: clues[id]!.label })),
    { id: "radio", rect: RADIO, name: prefs.radio ? "Radio, playing" : "Radio, off" },
  ];

  const press = (id: string) => {
    if (id === "laptop") camera.enterLaptop();
    else if (id === "phone") setPhoneOpen(true);
    else if (id === "radio") {
      audio.unlock();
      update({ radio: !prefs.radio });
    } else {
      incident.inspect(id);
      setCaption(id);
    }
  };

  const shown = caption ? clues[caption] : null;
  const at = caption ? toViewport(caption === "wall.poster" ? POSTER : NEIGHBOURS, size.w, size.h) : null;
  return (
    <div className="hotspots">
      {spots.map(({ id, rect, name }) => {
        const r = toViewport(rect, size.w, size.h);
        return (
          <button key={id} type="button" className="hotspot" data-hotspot={id} aria-label={name} style={{ left: r.x, top: r.y, width: r.w, height: r.h }} onClick={() => press(id)}>
            <span className="hotspot-label" aria-hidden="true">
              {name}
            </span>
          </button>
        );
      })}
      {shown && at && (
        <div className="cafe-caption" role="status" style={{ left: Math.max(16, Math.min(at.x + at.w / 2, size.w - 16)), top: Math.max(56, at.y) }}>
          <span className="cafe-caption-src">{shown.label}</span>
          <q>{fillWorld(shown.text, incident.world)}</q>
        </div>
      )}
      {phoneOpen && <PhoneCloseup onClose={() => setPhoneOpen(false)} />}
    </div>
  );
}
