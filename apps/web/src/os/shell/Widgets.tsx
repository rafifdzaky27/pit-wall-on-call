import { CITIES } from "@pitwall/world";
import { useState } from "react";
import { FACTS } from "../../content/aboutRafif";
import { usePrefs } from "../PrefsProvider";
import { useNow } from "../useNow";

export function Fortune() {
  const [index, setIndex] = useState(() => Math.floor(Math.random() * FACTS.length));
  return (
    <section className="widget fortune" aria-label="fortune">
      <p className="widget-h mono">$ fortune</p>
      <p className="fortune-text" aria-live="polite">
        {FACTS[index]}
      </p>
      <button type="button" className="btn" onClick={() => setIndex((index + 1) % FACTS.length)}>
        Another
      </button>
    </section>
  );
}

export function WorldClock() {
  const now = useNow();
  return (
    <section className="widget clock" aria-label="World clock">
      <ul>
        {CITIES.map((c) => (
          <li key={c.id}>
            <span>{c.name}</span>
            <time className="mono">{new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: c.timeZone }).format(now)}</time>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function StickyNote() {
  const { prefs, update } = usePrefs();
  return (
    <section className="widget sticky" aria-label="Sticky note section">
      <textarea aria-label="Sticky note" rows={5} value={prefs.sticky} onChange={(e) => update({ sticky: e.target.value })} />
    </section>
  );
}

export function Widgets() {
  return (
    <div className="widgets">
      <StickyNote />
      <Fortune />
      <WorldClock />
    </div>
  );
}
