import { mulberry32, streamSeed } from "@pitwall/engine";
import type { CityId } from "./cities";
import { resolveWorld } from "./index";

export type TimeOfDay = "morning" | "afternoon" | "dusk" | "night";
export type Weather = "clear" | "overcast" | "rain";
/** The café when the camera comes back after the incident (cold-open spec §3). */
export type CloseState = "steaming" | "cooled" | "late";
export type StreetProp = "scooter" | "becak" | "vending" | "tram";

export interface Palette {
  skyTop: string;
  skyBottom: string;
  street: string;
  buildings: string;
  wall: string;
  wallShade: string;
  floor: string;
  wood: string;
  woodDark: string;
  counter: string;
  lamp: string;
  /** Opacity of the pendant lamps' glow, 0–1. */
  lampGlow: number;
  ink: string;
  skin: string[];
}

export interface CafeSign {
  name: string;
  menu: string[];
  prop: StreetProp;
  /** Buildings seen through the window: [x, width, height] in scene units, on a baseline at y 430. */
  skyline: [x: number, w: number, h: number][];
}

export interface SceneDef {
  id: "cafe";
  hotspots: readonly string[];
}

export interface SceneModel {
  city: CityId;
  time: TimeOfDay;
  weather: Weather;
  /** 0: two people at the next table; 1: two there plus one at the counter; 2: one there plus one at the counter. */
  patrons: 0 | 1 | 2;
  palette: Palette;
  sign: CafeSign;
}

export function defineScene(def: SceneDef): SceneDef {
  return def;
}

/** Every hotspot the café can show; scenarios may use only these (cold-open spec §5). */
export const CAFE = defineScene({
  id: "cafe",
  hotspots: ["laptop.slack.deploys", "laptop.slack.infra", "phone.mention", "table.neighbours", "wall.poster"],
});

const TIMES: readonly TimeOfDay[] = ["morning", "afternoon", "dusk", "night"];
const WEATHERS: readonly Weather[] = ["clear", "overcast", "rain"];

const BASE: Record<TimeOfDay, Pick<Palette, "skyTop" | "skyBottom" | "wall" | "wallShade" | "floor" | "lamp" | "lampGlow">> = {
  morning: { skyTop: "#bcd8ee", skyBottom: "#f4ecdc", wall: "#e8d9c0", wallShade: "#d6c3a4", floor: "#9a7a5c", lamp: "#ffe7b0", lampGlow: 0.15 },
  afternoon: { skyTop: "#8fc1e6", skyBottom: "#e2f0f7", wall: "#e2d0b2", wallShade: "#cdb894", floor: "#94735a", lamp: "#ffe2a0", lampGlow: 0.1 },
  dusk: { skyTop: "#f2a36a", skyBottom: "#594878", wall: "#c8a585", wallShade: "#aa876a", floor: "#6f5443", lamp: "#ffc877", lampGlow: 0.5 },
  night: { skyTop: "#141a33", skyBottom: "#2c3358", wall: "#86684f", wallShade: "#6c5240", floor: "#4a372c", lamp: "#ffbe62", lampGlow: 0.85 },
};

const SHARED = {
  street: "#5d646e",
  buildings: "#39404c",
  wood: "#8a5a3b",
  woodDark: "#5e3b26",
  counter: "#3d2c24",
  ink: "#1f1a17",
  skin: ["#8d5a3b", "#c68b62", "#e4b893"],
};

/** Linear mix of two #rrggbb colours. */
export function mix(a: string, b: string, t: number): string {
  const ch = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  const out = [0, 1, 2].map((i) => Math.round(ch(a, i) + (ch(b, i) - ch(a, i)) * t));
  return `#${out.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

export function paletteFor(time: TimeOfDay, weather: Weather): Palette {
  const base = BASE[time];
  const palette: Palette = { ...SHARED, ...base, skin: [...SHARED.skin] };
  if (weather === "overcast") {
    palette.skyTop = mix(base.skyTop, "#9aa3ad", 0.6);
    palette.skyBottom = mix(base.skyBottom, "#9aa3ad", 0.6);
  }
  if (weather === "rain") {
    palette.skyTop = mix(base.skyTop, "#56606c", 0.75);
    palette.skyBottom = mix(base.skyBottom, "#56606c", 0.75);
    palette.street = mix(SHARED.street, "#000000", 0.2);
  }
  return palette;
}

export const CAFE_SIGNS: Record<CityId, CafeSign> = {
  jakarta: {
    name: "Kopi Senja",
    menu: ["Kopi susu 28K", "Es teh manis 15K", "Roti bakar 25K"],
    prop: "scooter",
    skyline: [
      [90, 110, 250],
      [210, 70, 170],
      [290, 120, 300],
      [420, 90, 210],
      [520, 130, 270],
      [660, 90, 190],
    ],
  },
  yogyakarta: {
    name: "Kopi Lor",
    menu: ["Kopi joss 12K", "Wedang uwuh 15K", "Bakpia 20K"],
    prop: "becak",
    skyline: [
      [90, 150, 110],
      [250, 120, 150],
      [380, 160, 95],
      [550, 90, 170],
      [650, 105, 120],
    ],
  },
  tokyo: {
    name: "喫茶 あかり",
    menu: ["ブレンド ¥550", "ナポリタン ¥900", "プリン ¥450"],
    prop: "vending",
    skyline: [
      [85, 80, 230],
      [170, 60, 280],
      [240, 100, 190],
      [350, 70, 310],
      [430, 120, 240],
      [560, 60, 200],
      [630, 125, 260],
    ],
  },
  melbourne: {
    name: "Laneway Espresso",
    menu: ["Flat white 5.5", "Long black 5.0", "Banana bread 7.0"],
    prop: "tram",
    skyline: [
      [90, 140, 160],
      [240, 90, 290],
      [340, 150, 140],
      [500, 80, 250],
      [590, 165, 180],
    ],
  },
};

/** Thresholds are in ticks: 3 and 8 minutes of incident time. */
export function closeState(endTick: number): CloseState {
  if (endTick < 1800) return "steaming";
  if (endTick < 4800) return "cooled";
  return "late";
}

/** The café for a shift: the same seed always gives the same room (cold-open spec §6). */
export function resolveScene(seed: number, close: CloseState | null = null): SceneModel {
  const rng = mulberry32(streamSeed(seed, "scene"));
  const city = resolveWorld(seed).city.id;
  let time = TIMES[rng.int(TIMES.length)]!;
  let weather = WEATHERS[rng.int(WEATHERS.length)]!;
  const patrons = rng.int(3) as 0 | 1 | 2;
  if (close === "late") {
    time = "night";
    weather = "clear";
  }
  return { city, time, weather, patrons, palette: paletteFor(time, weather), sign: CAFE_SIGNS[city] };
}
