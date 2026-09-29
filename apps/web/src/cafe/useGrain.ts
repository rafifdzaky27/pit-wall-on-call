import { useEffect, type RefObject } from "react";

let tile: string | null = null;

/** A 160 px tile of monochrome noise, drawn once into a canvas (M2.5 spec §12: a subtle grain). */
function grainTile(): string | null {
  if (tile) return tile;
  // jsdom has no canvas; the art simply goes without grain there.
  if (/jsdom/i.test(navigator.userAgent)) return null;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 160;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const img = ctx.createImageData(160, 160);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() < 0.5 ? 0 : 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = Math.floor(Math.random() * 160);
  }
  ctx.putImageData(img, 0, 0);
  tile = canvas.toDataURL("image/png");
  return tile;
}

/** Fills the art's noise pattern (#cf-noise) with the grain tile: a bitmap, so it rasters cheaply with the art. */
export function useGrain(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const image = ref.current?.querySelector("#cf-noise image");
    let url: string | null;
    try {
      url = grainTile();
    } catch {
      url = null;
    }
    if (image && url) image.setAttribute("href", url);
  }, [ref]);
}
