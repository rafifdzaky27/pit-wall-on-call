/**
 * While the camera moves, the live desktop inside the laptop stops re-rendering every tick, so the
 * one transform animation has the main thread to itself (M2.5 spec §11). The run keeps stepping;
 * the view catches up when the camera settles.
 */
let moving = false;
const settled = new Set<() => void>();

export const motionGate = {
  get moving(): boolean {
    return moving;
  },
  set(on: boolean): void {
    if (moving === on) return;
    moving = on;
    if (!on) for (const listener of [...settled]) listener();
  },
  onSettle(listener: () => void): () => void {
    settled.add(listener);
    return () => settled.delete(listener);
  },
};
