import { resolveScene, resolveWorld, type CloseState, type SceneModel } from "@pitwall/world";
import { useMemo, useRef, type ReactNode } from "react";
import { useNow } from "../os/useNow";
import { Counter } from "./art/Counter";
import { Defs } from "./art/Defs";
import { Walls } from "./art/Interior";
import { Lights } from "./art/Lights";
import { Patrons } from "./art/Patrons";
import { Street } from "./art/Street";
import { Table, TablePhone } from "./art/Table";
import "./cafe.css";
import { SCENE } from "./camera";
import { sceneTime } from "./time";
import { useParallax } from "./useParallax";

export interface CafeSceneProps {
  seed: number;
  /** The cold close's state, or null during the shift. */
  close: CloseState | null;
  ringing: boolean;
  /** What the phone shows while it rings. */
  page: { severity: string; title: string };
  radioOn: boolean;
  paused: boolean;
  /** The incident clock, mm:ss, for the phone's live activity. */
  clock?: string;
  /** The page has fired: the days-since sign reads 0 and the phone keeps the page on its lock screen. */
  paged?: boolean;
  /** The hotspot layer, drawn over the art. */
  children?: ReactNode;
}

const WHEN: Record<SceneModel["time"], string> = { morning: "in the morning", afternoon: "in the afternoon", dusk: "at dusk", night: "at night" };
const WEATHER: Record<SceneModel["weather"], string> = { clear: "", overcast: ", overcast", rain: ", raining" };

/**
 * The café in the incident's city, drawn as a lo-fi illustration from a seeded model (M2.5 spec §12):
 * the street through the window, the walls, the counter, the room and the player's table, then light.
 */
export default function CafeScene({ seed, close, ringing, page, radioOn, paused, clock = "00:00", paged = false, children }: CafeSceneProps) {
  const model = useMemo(() => resolveScene(seed, close), [seed, close]);
  const world = useMemo(() => resolveWorld(seed), [seed]);
  const root = useRef<HTMLDivElement>(null);
  useParallax(root);
  const hhmm = sceneTime(useNow(), world.city.timeZone, model.time);
  const label = `A café in ${world.city.name} ${WHEN[model.time]}${WEATHER[model.weather]}`;
  return (
    <div ref={root} className={`cafe${paused ? " paused" : ""}`}>
      <svg className="cafe-art" viewBox={`0 0 ${SCENE.w} ${SCENE.h}`} preserveAspectRatio="xMidYMid slice" role="img" aria-label={label}>
        <Defs model={model} />
        <Street model={model} />
        <Walls model={model} brand={world.brand} cityName={world.city.name} hhmm={hhmm} paged={paged} />
        <Counter model={model} radioOn={radioOn} />
        <g className="room" data-layer="room">
          <Patrons model={model} empty={close === "late"} />
          <Table model={model} close={close} />
          <TablePhone ringing={ringing} paged={paged} page={page} clock={clock} hhmm={hhmm} mention={paged ? "1 new mention" : null} />
        </g>
        <Lights model={model} />
      </svg>
      <div className="cafe-grain" aria-hidden="true" />
      {children}
    </div>
  );
}
