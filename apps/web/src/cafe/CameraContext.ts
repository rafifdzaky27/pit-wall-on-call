import { createContext, useContext } from "react";
import type { View } from "./camera";

export interface CameraApi {
  view: View;
  started: boolean;
  closing: boolean;
  lookUp: () => void;
  enterLaptop: () => void;
}

const noop = () => undefined;
/** Outside a Stage (tests of single components, and before M1.6) PitOS is simply the whole screen. */
const DESKTOP_ONLY: CameraApi = { view: "desktop", started: false, closing: false, lookUp: noop, enterLaptop: noop };

export const CameraContext = createContext<CameraApi>(DESKTOP_ONLY);

export function useCamera(): CameraApi {
  return useContext(CameraContext);
}
