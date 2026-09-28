import { CITIES } from "@pitwall/world";
import { useEffect, useState } from "react";
import { fetchApiVersion } from "../../../api";
import type { WallpaperChoice } from "../../prefs";
import { usePrefs } from "../../PrefsProvider";
import "./settings.css";

type Page = "appearance" | "accessibility" | "about";

const SHORTCUTS: [string, string][] = [
  ["O", "Overview"],
  ["M", "Maximize or restore the focused window"],
  ["[ / ]", "Snap the focused window left or right"],
  ["X", "Close the focused window"],
  ["A", "Acknowledge the page"],
  ["P", "Pause or resume the incident"],
  ["1–9, Esc", "Select a service, clear the log filter (Monitoring)"],
];

export function SettingsApp({ fetchVersion = fetchApiVersion }: { fetchVersion?: () => Promise<string> }) {
  const { prefs, update } = usePrefs();
  const [page, setPage] = useState<Page>("appearance");
  const [api, setApi] = useState("Checking API…");

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

  const toggle = (key: "reduceMotion" | "largeText" | "systemCursor" | "singleKeyShortcuts", label: string, help: string) => (
    <label className="setting">
      <input type="checkbox" checked={prefs[key]} onChange={(e) => update({ [key]: e.target.checked })} />
      <span>
        <b>{label}</b>
        <span className="muted">{help}</span>
      </span>
    </label>
  );

  return (
    <div className="settings">
      <nav className="settings-nav" aria-label="Settings pages">
        {(["appearance", "accessibility", "about"] as const).map((p) => (
          <button key={p} type="button" aria-pressed={page === p} onClick={() => setPage(p)}>
            {p === "appearance" ? "Appearance" : p === "accessibility" ? "Accessibility" : "About"}
          </button>
        ))}
      </nav>
      <div className="settings-page">
        {page === "appearance" && (
          <>
            <fieldset>
              <legend>Theme</legend>
              {(["dark", "light"] as const).map((t) => (
                <label key={t} className="setting-inline">
                  <input type="radio" name="theme" checked={prefs.theme === t} onChange={() => update({ theme: t })} />
                  {t === "dark" ? "Dark" : "Light"}
                </label>
              ))}
            </fieldset>
            <label className="setting-select">
              <b>Wallpaper</b>
              <select value={prefs.wallpaper} onChange={(e) => update({ wallpaper: e.target.value as WallpaperChoice })}>
                <option value="auto">Follow the shift's city</option>
                {CITIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        {page === "accessibility" && (
          <>
            {toggle("reduceMotion", "Reduce motion", "Turns off window animations and the phone shake.")}
            {toggle("largeText", "Larger text", "Raises the type scale across PitOS.")}
            {toggle("systemCursor", "Use system cursor", "Uses your browser's own cursors instead of PitOS cursors.")}
            {toggle("singleKeyShortcuts", "Single-key shortcuts", "O, M, [, ], X, A, P and number keys. Turn off if they get in your way.")}
          </>
        )}
        {page === "about" && (
          <>
            <h2>PitOS 1.0</h2>
            <dl className="about">
              <dt>Web build</dt>
              <dd className="mono">{import.meta.env.VITE_GIT_SHA ?? "dev"}</dd>
              <dt>API</dt>
              <dd>{api}</dd>
              <dt>Made by</dt>
              <dd>Rafif Dzaky Daniswara</dd>
              <dt>License</dt>
              <dd>Code AGPL-3.0-only. Game content, names and art are all rights reserved.</dd>
            </dl>
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
          </>
        )}
      </div>
    </div>
  );
}
