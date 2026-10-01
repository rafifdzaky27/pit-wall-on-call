import { DUCK as DUCK_ACTION } from "@pitwall/scenarios";
import { fillWorld, resolveScene } from "@pitwall/world";
import { useEffect, useMemo, useState } from "react";
import { isPaged } from "../os/apps/chat/unread";
import { audio } from "../os/audio/engine";
import { useIncident } from "../os/incident/IncidentProvider";
import { refusalText } from "../os/incident/refusal";
import { usePrefs } from "../os/PrefsProvider";
import { CLOCK_3AM, DAYS_SIGN, HUG_OPS, POSTER, RADIO } from "./art/Interior";
import { CAT, FORCE_PUSH, NEIGHBOURS } from "./art/Patrons";
import { DUCK, LAPTOP, PHONE } from "./art/Table";
import { toViewport, type Rect } from "./camera";
import { useCamera } from "./CameraContext";
import { PhoneCloseup } from "./PhoneCloseup";
import { useViewport } from "./useViewport";

type Spot = { id: string; rect: Rect; name: string };
/** An easter egg (M2.5 spec §12): a real, named button with a caption, but never a clue and never an engine action. */
type Egg = Spot & { text: string };

/** Transparent buttons over the art (cold-open spec §6, §9): Tab reaches each, and each says what it is. */
export function Hotspots() {
  const incident = useIncident();
  const camera = useCamera();
  const { prefs, update } = usePrefs();
  const size = useViewport();
  const [caption, setCaption] = useState<string | null>(null);
  const [phoneOpen, setPhoneOpen] = useState(false);
  /** What the duck said when pressed; kept, because pressing it changes what it would say next. */
  const [duckSaid, setDuckSaid] = useState("");
  const clues = incident.scenario.coldOpen.hotspots;
  const days = useMemo(() => resolveScene(incident.seed).daysSince, [incident.seed]);
  const paged = isPaged(incident.phase);

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
    { id: "duck", rect: DUCK, name: "Rubber duck" },
  ];
  const eggs: Egg[] = [
    { id: "egg.cat", rect: CAT, name: "Sleeping café cat", text: "The cat purrs. It has seen worse outages." },
    {
      id: "egg.days",
      rect: DAYS_SIGN,
      name: "Days since last incident",
      text: paged ? "0 days since the last incident. Someone reaches up and flips the sign back to zero." : `${days} days since the last incident. Nobody says it out loud.`,
    },
    { id: "egg.hug-ops", rect: HUG_OPS, name: "HUG OPS poster", text: "HUG OPS. Hug your ops team: they were up at 3 AM so you did not have to be." },
    { id: "egg.clock", rect: CLOCK_3AM, name: "Clock stopped at 3:00", text: "This clock stopped at 3:00. The sticky note says “Disk full at 3AM”. A story for another night." },
    { id: "egg.force-push", rect: FORCE_PUSH, name: "The coder at the window seat", text: "Their screen says git push --force. On a Friday. You look away." },
  ];

  const press = (id: string) => {
    if (id === "laptop") camera.enterLaptop();
    else if (id === "phone") setPhoneOpen(true);
    else if (id === "radio") {
      audio.unlock();
      update({ radio: !prefs.radio });
    } else if (id === "duck") {
      // The rubber duck is the duck action (M2.5 spec §9): 30 s of incident time for the next question.
      if (incident.difficulty === "hard") {
        // No clickable actions in a hard shift: the duck is a command like any other (M6 review I3).
        setDuckSaid("A rubber duck. To explain the problem to it, type incidentctl rubber-duck in the Terminal.");
        setCaption(id);
        return;
      }
      const why = incident.phase === "active" ? refusalText(incident.check(DUCK_ACTION)) : "A rubber duck. When you are stuck, explain the problem to it.";
      if (!why) incident.dispatch(DUCK_ACTION);
      setDuckSaid(why ?? "You explain the problem to the duck. Its question lands in your logs in 30 s.");
      setCaption(id);
    } else if (id.startsWith("egg.")) {
      setCaption(id);
    } else {
      incident.inspect(id);
      setCaption(id);
    }
  };

  const clue = caption && !caption.startsWith("egg.") && caption !== "duck" ? clues[caption] : null;
  const egg = caption === "duck" ? { id: "duck", rect: DUCK, name: "Rubber duck", text: duckSaid } : caption ? eggs.find((e) => e.id === caption) : undefined;
  const anchor = egg?.rect ?? (caption === "wall.poster" ? POSTER : NEIGHBOURS);
  const at = caption ? toViewport(anchor, size.w, size.h) : null;
  // Things high on the wall get their caption underneath, so it never leaves the screen.
  const below = !!at && at.y < 200;
  const button = ({ id, rect, name }: Spot) => {
    const r = toViewport(rect, size.w, size.h);
    return (
      <button
        key={id}
        type="button"
        className={`hotspot${id.startsWith("egg.") ? " egg" : ""}`}
        data-hotspot={id}
        data-open={caption === id ? "" : undefined}
        aria-label={name}
        style={{ left: r.x, top: r.y, width: r.w, height: r.h }}
        onClick={() => press(id)}
      >
        <span className="hotspot-label" aria-hidden="true">
          {name}
        </span>
      </button>
    );
  };
  return (
    <div className="hotspots">
      {spots.map(button)}
      {/* The easter eggs come after the clues, so the clues keep their reading order. */}
      {eggs.map(button)}
      {(clue || egg) && at && (
        <div className={`cafe-caption${below ? " below" : ""}`} role="status" style={{ left: Math.max(176, Math.min(at.x + at.w / 2, size.w - 176)), top: below ? at.y + at.h : Math.max(56, at.y) }}>
          <span className="cafe-caption-src">{clue ? clue.label : egg!.name}</span>
          {clue ? <q>{fillWorld(clue.text, incident.world)}</q> : <p>{egg!.text}</p>}
        </div>
      )}
      {phoneOpen && <PhoneCloseup onClose={() => setPhoneOpen(false)} />}
    </div>
  );
}
