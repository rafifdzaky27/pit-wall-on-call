import { audio } from "../audio/engine";
import { loadRadio } from "../audio/useRadio";
import { Glyph } from "../brand/Glyph";
import { enterFullscreen, exitFullscreen, fullscreenSupported, useFullscreen } from "../fullscreen";
import { usePrefs } from "../PrefsProvider";
import { useOs } from "./OsContext";

/** GNOME-style quick settings in the System menu (polish spec §6). */
export function QuickSettings({ onLock }: { onLock: () => void }) {
  const { prefs, update } = usePrefs();
  const { openSettings, setOpenMenu } = useOs();
  const full = useFullscreen();
  const volume = prefs.muted ? 0 : prefs.volume;

  const go = (page: "appearance" | "about") => {
    setOpenMenu(null);
    openSettings(page);
  };

  return (
    <div className="menu qs" role="group" aria-label="Quick settings">
      <div className="qs-volume">
        <button type="button" className="qs-mute" aria-pressed={prefs.muted} aria-label={prefs.muted ? "Unmute" : "Mute"} onClick={() => update({ muted: !prefs.muted })}>
          <Glyph name={prefs.muted ? "mute" : "volume"} />
        </button>
        <input type="range" min={0} max={100} step={5} aria-label="Volume" value={volume} onChange={(e) => update({ volume: Number(e.target.value), muted: false })} />
        <span className="qs-value mono" aria-hidden="true">
          {volume}%
        </span>
      </div>
      <div className="qs-radio" role="group" aria-label="Lo-fi radio">
        <span>Lo-fi radio</span>
        <button
          type="button"
          className="btn"
          aria-label={prefs.radio ? "Pause lo-fi radio" : "Play lo-fi radio"}
          onClick={() => {
            audio.unlock();
            update({ radio: !prefs.radio });
          }}
        >
          {prefs.radio ? "Pause" : "Play"}
        </button>
        {prefs.radio && (
          <button type="button" className="btn" aria-label="Next track" onClick={() => void loadRadio().then((radio) => radio.next())}>
            Next
          </button>
        )}
      </div>
      <div className="seg seg-fill" role="group" aria-label="Theme">
        <button type="button" aria-pressed={prefs.theme === "dark"} onClick={() => update({ theme: "dark" })}>
          Dark
        </button>
        <button type="button" aria-pressed={prefs.theme === "light"} onClick={() => update({ theme: "light" })}>
          Light
        </button>
      </div>
      {fullscreenSupported() && (
        <button type="button" className="qs-toggle" aria-pressed={full} onClick={() => void (full ? exitFullscreen() : enterFullscreen())}>
          <span>Full screen</span>
          <span className="qs-toggle-state">{full ? "On" : "Off"}</span>
        </button>
      )}
      <hr />
      <button type="button" className="menu-item" onClick={() => go("appearance")}>
        Settings
      </button>
      <button type="button" className="menu-item" onClick={() => go("about")}>
        About PitOS
      </button>
      <button type="button" className="menu-item" onClick={onLock}>
        Lock
      </button>
    </div>
  );
}
