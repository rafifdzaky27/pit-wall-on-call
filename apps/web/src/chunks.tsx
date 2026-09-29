import { Component, type ReactNode } from "react";

/**
 * A deploy replaces every hashed chunk, so a tab opened before it asks for files that no longer
 * exist. That is not a crash: reload once to get the new version (M2.5 spec §10, finding F3).
 */
export function isChunkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (error.name === "ChunkLoadError") return true;
  return /dynamically imported module|Importing a module script failed|Unable to preload CSS/i.test(error.message);
}

const KEY = "pitwall.reloadedAt";
const WINDOW_MS = 10_000;

/** Indirection so tests can observe a reload (jsdom's location.reload cannot be replaced). */
export const reloader = { reload: () => window.location.reload() };

/** Reloads unless it already did in the last 10 s, which would mean the chunk is really gone. */
export function reloadOnce(now = Date.now()): boolean {
  let last = 0;
  try {
    last = Number(sessionStorage.getItem(KEY) ?? 0);
  } catch {
    // No storage: allow the reload, and the browser's own loop protection takes over.
  }
  if (last && now - last < WINDOW_MS) return false;
  try {
    sessionStorage.setItem(KEY, String(now));
  } catch {
    // Reload anyway.
  }
  reloader.reload();
  return true;
}

/** What shows while the page reloads onto the new version. */
export function Reloading() {
  return (
    <div className="overlay">
      <p className="card" role="status">
        Loading the new version of Pit Wall On-Call…
      </p>
    </div>
  );
}

/**
 * Around each window's app: a chunk that still fails after the reload is reported inside that window,
 * and the run goes on. Any other error is the app's own bug and goes up to the crash guard.
 */
interface AppBoundaryProps {
  children: ReactNode;
  /** False mid-shift: a reload would throw the run away, so the player decides (M2.5 review I4). */
  autoReload?: boolean;
}

export class AppBoundary extends Component<AppBoundaryProps, { error: Error | null; refused: boolean }> {
  state = { error: null as Error | null, refused: false };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    if (!isChunkError(error)) return;
    if (this.props.autoReload === false || !reloadOnce()) this.setState({ refused: true });
  }

  render() {
    const { error, refused } = this.state;
    if (!error) return this.props.children;
    if (!isChunkError(error)) throw error;
    if (!refused && this.props.autoReload !== false) return <p className="app-pad empty">Loading the new version…</p>;
    return (
      <div className="app-pad empty">
        <p>{this.props.autoReload === false ? "Couldn't load this app. Reloading ends this shift." : "Couldn't load this app."}</p>
        <button type="button" className="btn" onClick={() => reloader.reload()}>
          Reload
        </button>
      </div>
    );
  }
}
