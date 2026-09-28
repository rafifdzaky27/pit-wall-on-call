import { useCamera } from "./CameraContext";

/** A plain café backdrop: shown while the café loads, and if it cannot load (cold-open spec §9). */
export function CafeFallback() {
  const camera = useCamera();
  return (
    <section className="cafe-fallback" aria-label="Café">
      <button type="button" className="cafe-fallback-laptop" data-hotspot="laptop" onClick={camera.enterLaptop}>
        Laptop
      </button>
    </section>
  );
}
