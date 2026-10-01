import { CITIES } from "@pitwall/world";
import { useEffect, useState } from "react";
import { fetchApiVersion } from "../../../api";
import photos from "../../../content/store-photos.json";
import { LogoMark } from "../../brand/Logo";
import { useIncident } from "../../incident/IncidentProvider";
import { enterFullscreen, exitFullscreen, fullscreenSupported, useFullscreen } from "../../fullscreen";
import type { WallpaperChoice } from "../../prefs";
import { usePrefs } from "../../PrefsProvider";
import { useOs, type SettingsPageId } from "../../shell/OsContext";
import { SHORTCUTS } from "../../shortcutList";
import { audio, type Cue } from "../../audio/engine";
import { AccountPage } from "./AccountPage";
import { Group, Row } from "./rows";
import "./settings.css";

const PAGES: { id: SettingsPageId; label: string; keywords: string }[] = [
  { id: "appearance", label: "Appearance", keywords: "style theme dark light wallpaper background" },
  { id: "sound", label: "Sound", keywords: "volume mute pager alert audio" },
  { id: "accessibility", label: "Accessibility", keywords: "motion animation larger text cursor shortcuts" },
  { id: "display", label: "Display", keywords: "full screen fullscreen" },
  { id: "gameplay", label: "Gameplay", keywords: "difficulty hard normal terminal commands hints guide next step help newcomer" },
  { id: "keyboard", label: "Keyboard", keywords: "shortcuts keys" },
  { id: "account", label: "Account", keywords: "handle leaderboard name player" },
  { id: "about", label: "About", keywords: "version build api license credits photos" },
];

const SOUND_ROWS: [Cue, string, string][] = [
  ["pager", "Pager", "Repeats until you acknowledge the page, a little louder every 10 s"],
  ["vibrate", "Phone vibration", "Your phone on the café table, with every ring"],
  ["escalation", "Escalation", "The secondary is paged after 60 s without an ack"],
  ["tick", "Fix holding", "Once a second while the fix holds"],
  ["ack", "Acknowledge", "When you take the page"],
  ["message", "Chat message", "A DM or #incidents while Chat is in the background"],
  ["notify", "Notification", "Other banners"],
  ["resolved", "Resolved", "The fix held"],
  ["dnf", "Budget exhausted", "The error budget ran out"],
];

const LEVEL_ROWS: ["ambience" | "music" | "alerts", string, string][] = [
  ["ambience", "Ambience", "The café: voices, cups, rain"],
  ["music", "Music", "The lo-fi radio"],
  ["alerts", "Alerts", "The pager, the phone and every PitOS sound"],
];

function Switch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (on: boolean) => void }) {
  return <input type="checkbox" role="switch" className="switch" aria-label={label} checked={checked} onChange={(e) => onChange(e.target.checked)} />;
}

/** GNOME Settings: a searchable page list and libadwaita-style boxed rows (polish spec S22). */
export function SettingsApp({ fetchVersion = fetchApiVersion }: { fetchVersion?: () => Promise<string> }) {
  const { prefs, update } = usePrefs();
  const { settingsPage } = useOs();
  const incident = useIncident();
  const full = useFullscreen();
  const [page, setPage] = useState<SettingsPageId>(settingsPage);
  const [query, setQuery] = useState("");
  const [api, setApi] = useState("Checking API…");

  useEffect(() => {
    setPage(settingsPage);
  }, [settingsPage]);

  useEffect(() => {
    if (page !== "about") return;
    let cancelled = false;
    fetchVersion().then(
      (v) => !cancelled && setApi(`API online · ${v}`),
      () => !cancelled && setApi("API unreachable"),
    );
    return () => {
      cancelled = true;
    };
  }, [page, fetchVersion]);

  const q = query.trim().toLowerCase();
  const shown = PAGES.filter((p) => q === "" || `${p.label} ${p.keywords}`.toLowerCase().includes(q));
  const label = PAGES.find((p) => p.id === page)!.label;
  const volume = prefs.muted ? 0 : prefs.volume;

  return (
    <div className="settings">
      <nav className="settings-nav" aria-label="Settings pages">
        <input type="search" className="settings-search" aria-label="Search settings" placeholder="Search" value={query} onChange={(e) => setQuery(e.target.value)} />
        {shown.length === 0 ? (
          <p className="empty settings-none">No results</p>
        ) : (
          shown.map((p) => (
            <button key={p.id} type="button" aria-current={page === p.id ? "page" : undefined} onClick={() => setPage(p.id)}>
              {p.label}
            </button>
          ))
        )}
      </nav>
      <div className="settings-page">
        <h2 className="settings-title">{label}</h2>

        {page === "appearance" && (
          <>
            <Group title="Style">
              <div className="styles" role="radiogroup" aria-label="Style">
                {(["light", "dark"] as const).map((t) => (
                  <label key={t} className="style-card">
                    <span className={`style-preview ${t}`} aria-hidden="true" />
                    <span className="style-label">
                      <input type="radio" name="theme" checked={prefs.theme === t} onChange={() => update({ theme: t })} />
                      {t === "dark" ? "Dark" : "Light"}
                    </span>
                  </label>
                ))}
              </div>
            </Group>
            <Group title="Background">
              <Row title="Wallpaper" subtitle="The shift's city, or one you pick">
                <select aria-label="Wallpaper" value={prefs.wallpaper} onChange={(e) => update({ wallpaper: e.target.value as WallpaperChoice })}>
                  <option value="auto">Follow the shift's city</option>
                  {CITIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Row>
            </Group>
          </>
        )}

        {page === "sound" && (
          <>
            <Group title="Output">
              <Row title="Volume">
                <input type="range" min={0} max={100} step={5} aria-label="Volume" value={volume} onChange={(e) => update({ volume: Number(e.target.value), muted: false })} />
                <span className="mono row-value">{volume}%</span>
              </Row>
              {LEVEL_ROWS.map(([key, title, subtitle]) => (
                <Row key={key} title={title} subtitle={subtitle}>
                  <input type="range" min={0} max={100} step={5} aria-label={`${title} volume`} value={prefs[key]} onChange={(e) => update({ [key]: Number(e.target.value) })} />
                  <span className="mono row-value">{prefs[key]}%</span>
                </Row>
              ))}
              <Row title="Mute" subtitle="Silences every PitOS sound">
                <Switch label="Mute" checked={prefs.muted} onChange={(on) => update({ muted: on })} />
              </Row>
              <Row title="Reduce audio intensity" subtitle="Turns off budget pulses, the escalation tone and fix-hold ticks">
                <Switch label="Reduce audio intensity" checked={prefs.reduceAudio} onChange={(on) => update({ reduceAudio: on })} />
              </Row>
            </Group>
            <Group title="Alert sounds">
              {SOUND_ROWS.map(([id, title, subtitle]) => (
                <Row key={id} title={title} subtitle={subtitle}>
                  <button
                    type="button"
                    className="btn"
                    aria-label={`Play ${title}`}
                    disabled={prefs.muted}
                    onClick={() => {
                      audio.unlock();
                      audio.play(id);
                    }}
                  >
                    Play
                  </button>
                </Row>
              ))}
            </Group>
          </>
        )}

        {page === "accessibility" && (
          <Group title="Seeing and moving">
            <Row title="Reduce motion" subtitle="Turns off window animations and the phone shake">
              <Switch label="Reduce motion" checked={prefs.reduceMotion} onChange={(on) => update({ reduceMotion: on })} />
            </Row>
            <Row title="Larger text" subtitle="Raises the type scale across PitOS">
              <Switch label="Larger text" checked={prefs.largeText} onChange={(on) => update({ largeText: on })} />
            </Row>
            <Row title="Use system cursor" subtitle="Your browser's own cursors instead of PitOS cursors">
              <Switch label="Use system cursor" checked={prefs.systemCursor} onChange={(on) => update({ systemCursor: on })} />
            </Row>
            <Row title="Single-key shortcuts" subtitle="O, M, [, ], X, A, P, ? and number keys. Turn off if they get in your way.">
              <Switch label="Single-key shortcuts" checked={prefs.singleKeyShortcuts} onChange={(on) => update({ singleKeyShortcuts: on })} />
            </Row>
          </Group>
        )}

        {page === "display" && (
          <Group title="Full screen">
            <Row title="Full screen on Start shift" subtitle="Hides the browser's toolbars while you are on call. Esc leaves full screen.">
              <Switch label="Full screen on Start shift" checked={prefs.fullscreenOnStart} onChange={(on) => update({ fullscreenOnStart: on })} />
            </Row>
            {fullscreenSupported() && (
              <Row title="Full screen now">
                <Switch label="Full screen now" checked={full} onChange={(on) => void (on ? enterFullscreen() : exitFullscreen())} />
              </Row>
            )}
          </Group>
        )}

        {page === "gameplay" && (
          <Group title="Difficulty">
            <div role="radiogroup" aria-label="Difficulty">
              <Row title="Normal" subtitle="Every action is a button in the tools: Monitoring, Logs, Deploys, DB console and Incident.">
                <input type="radio" name="difficulty" aria-label="Normal" checked={prefs.difficulty === "normal"} onChange={() => update({ difficulty: "normal" })} />
              </Row>
              <Row title="Hard" subtitle="No action buttons. Run every command by typing it in the Terminal. Hard shifts have their own leaderboards.">
                <input type="radio" name="difficulty" aria-label="Hard" checked={prefs.difficulty === "hard"} onChange={() => update({ difficulty: "hard" })} />
              </Row>
            </div>
            {prefs.difficulty !== incident.difficulty && (
              <Row title="Applies from your next shift" subtitle="The shift in progress keeps the difficulty it started with. Training is always Normal." />
            )}
          </Group>
        )}

        {page === "gameplay" && (
          <Group title="Guidance">
            <Row title="Show next-step hints" subtitle="After a quiet spell in an early shift, a notice points at where to look next. It never says what the fix is.">
              <Switch label="Show next-step hints" checked={prefs.nextStepHints} onChange={(on) => update({ nextStepHints: on })} />
            </Row>
          </Group>
        )}

        {page === "keyboard" && (
          <Group title="Shortcuts">
            <table className="shortcuts" aria-label="Keyboard shortcuts">
              <tbody>
                {SHORTCUTS.map(([k, v]) => (
                  <tr key={k}>
                    <th scope="row">
                      <kbd>{k}</kbd>
                    </th>
                    <td>{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Group>
        )}

        {page === "account" && <AccountPage />}

        {page === "about" && (
          <>
            <div className="about-head">
              <LogoMark size={64} />
              <p className="about-name">PitOS</p>
              <p className="muted">Version 1.1 · Pit Wall On-Call</p>
            </div>
            <Group title="System">
              <Row title="Web build">
                <span className="mono">{import.meta.env.VITE_GIT_SHA ?? "dev"}</span>
              </Row>
              <Row title="API">
                <span>{api}</span>
              </Row>
              <Row title="Made by">
                <span>Rafif Dzaky Daniswara</span>
              </Row>
              <Row title="License" subtitle="Code AGPL-3.0-only. Game content, names and art are all rights reserved." />
            </Group>
            <Group title="Photo credits">
              <Row title="Store photos" subtitle="From Unsplash, under the Unsplash License" />
              {photos.map((p) => (
                <Row key={p.file} title={p.by} subtitle={`${p.file}.webp`}>
                  <a href={`https://unsplash.com/photos/${p.id}`} target="_blank" rel="noreferrer">
                    Unsplash
                  </a>
                </Row>
              ))}
            </Group>
          </>
        )}
      </div>
    </div>
  );
}
