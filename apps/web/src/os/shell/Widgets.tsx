import { CITIES } from "@pitwall/world";
import { usePrefs } from "../PrefsProvider";
import { useNow } from "../useNow";

export function WorldClock() {
  const now = useNow();
  return (
    <section className="widget worldclock" aria-label="World clock">
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
      <WorldClock />
    </div>
  );
}
