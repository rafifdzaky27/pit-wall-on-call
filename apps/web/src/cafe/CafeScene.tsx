import { resolveScene, resolveWorld, type CloseState, type SceneModel } from "@pitwall/world";
import { useMemo, useRef, type ReactNode } from "react";
import { Interior } from "./art/Interior";
import { Patrons } from "./art/Patrons";
import { Street } from "./art/Street";
import { Table } from "./art/Table";
import "./cafe.css";
import { SCENE } from "./camera";
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
  /** The hotspot layer, drawn over the art. */
  children?: ReactNode;
}

const WHEN: Record<SceneModel["time"], string> = { morning: "in the morning", afternoon: "in the afternoon", dusk: "at dusk", night: "at night" };
const WEATHER: Record<SceneModel["weather"], string> = { clear: "", overcast: ", overcast", rain: ", raining" };

/** The café in the incident's city, drawn in flat vector from a seeded model (cold-open spec §6). */
export default function CafeScene({ seed, close, ringing, page, radioOn, paused, children }: CafeSceneProps) {
  const model = useMemo(() => resolveScene(seed, close), [seed, close]);
  const world = useMemo(() => resolveWorld(seed), [seed]);
  const root = useRef<HTMLDivElement>(null);
  useParallax(root);
  const label = `A café in ${world.city.name} ${WHEN[model.time]}${WEATHER[model.weather]}`;
  return (
    <div ref={root} className={`cafe${paused ? " paused" : ""}`}>
      <svg className="cafe-art" viewBox={`0 0 ${SCENE.w} ${SCENE.h}`} preserveAspectRatio="xMidYMid slice" role="img" aria-label={label}>
        <rect x={0} y={0} width={SCENE.w} height={SCENE.h} fill={model.palette.wall} />
        <Street model={model} />
        <Interior model={model} brand={world.brand} radioOn={radioOn} />
        <Patrons model={model} empty={close === "late"} />
        <Table model={model} close={close} ringing={ringing} page={page} />
      </svg>
      {children}
    </div>
  );
}
