import type { AppId } from "../apps/ids";
import { AppIcon } from "../brand/AppIcon";
import { useOs } from "./OsContext";

export function Overview({ onClose }: { onClose: () => void }) {
  const { wm, dispatchWm } = useOs();
  const windows = wm.windows.filter((w) => !w.closing).sort((a, b) => b.z - a.z);
  return (
    <div className="overview" role="dialog" aria-modal="true" aria-label="Overview">
      {windows.length === 0 ? (
        <p className="empty">No windows open. Pick an app from the dock.</p>
      ) : (
        <ul className="overview-grid">
          {windows.map((w, i) => (
            <li key={w.id}>
              <button
                type="button"
                className="overview-card"
                style={{ animationDelay: `${i * 30}ms` }}
                autoFocus={i === 0}
                onClick={() => {
                  dispatchWm({ type: "focus", id: w.id });
                  onClose();
                }}
              >
                <AppIcon app={w.appId as AppId} size={48} />
                <span>{w.title}</span>
                {w.minimized && <span className="muted">Minimized</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="btn" onClick={onClose}>
        Close <kbd>Esc</kbd>
      </button>
    </div>
  );
}
