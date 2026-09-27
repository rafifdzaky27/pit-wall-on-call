import type { ScenarioDef, State } from "@pitwall/engine";
import { fillBrand } from "../game/brand";

/** Everything the player looked at before the console opened, clue or not (no spoilers). */
export function SceneNotes({ scenario, inspected, brand }: { scenario: ScenarioDef<State>; inspected: string[]; brand: string }) {
  return (
    <section className="panel notes" aria-labelledby="notes-h">
      <div className="ph">
        <h2 id="notes-h">What you noticed</h2>
      </div>
      <div className="pb">
        {inspected.length === 0 ? (
          <p className="empty">You went straight to the page. Nothing noted.</p>
        ) : (
          <ul className="note-list">
            {inspected.map((id) => {
              const hotspot = scenario.coldOpen.hotspots[id]!;
              return (
                <li key={id}>
                  <span className="note-src">{hotspot.label}</span>
                  <span>{fillBrand(hotspot.text, brand)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
