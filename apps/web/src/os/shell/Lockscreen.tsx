import { useState } from "react";
import { FACTS, FAVORITES } from "../../content/aboutRafif";
import { Wallpaper } from "../brand/Wallpaper";
import { useIncident } from "../incident/IncidentProvider";
import { useNow } from "../useNow";

export function Lockscreen({ onUnlock }: { onUnlock?: () => void }) {
  const { world } = useIncident();
  const now = useNow();
  const [pick, setPick] = useState(0);
  const [all, setAll] = useState(false);
  const time = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(now);
  const date = new Intl.DateTimeFormat(undefined, { weekday: "long", day: "numeric", month: "long" }).format(now);

  return (
    <div className="lockscreen">
      <Wallpaper city={world.city.id} />
      <main className="lock-content" aria-label="Lock screen">
        <time className="lock-clock mono" dateTime={now.toISOString()}>
          {time}
        </time>
        <p className="lock-date">{date}</p>
        <section className="lock-card" aria-labelledby="lock-h">
          <span className="tag info">Shift ready</span>
          <h1 id="lock-h">Pit Wall On-Call</h1>
          <p>
            You are on call and production is failing. Find the cause before the error budget runs out. Today's shift: {world.brand.name}, {world.city.name}.
          </p>
          {onUnlock ? (
            <button type="button" className="btn primary btn-lg" onClick={onUnlock}>
              Unlock
            </button>
          ) : (
            <p className="note">The incident console needs a screen at least 1024 px wide. Open this page on a laptop or desktop to play.</p>
          )}
        </section>
        <section className="lock-card" aria-labelledby="lock-about-h">
          <h2 id="lock-about-h">About the developer</h2>
          <p>{FACTS[FAVORITES[pick]!]}</p>
          <div className="lock-actions">
            <button type="button" className="btn" onClick={() => setPick((pick + 1) % FAVORITES.length)}>
              Another fact
            </button>
            <button type="button" className="btn" aria-expanded={all} onClick={() => setAll(!all)}>
              {all ? "Hide the list" : "All 20 facts"}
            </button>
          </div>
          {all && (
            <ol className="lock-facts">
              {FACTS.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ol>
          )}
        </section>
      </main>
    </div>
  );
}
