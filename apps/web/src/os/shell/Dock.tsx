import type { AppId } from "../apps/ids";
import { APP_META, DOCK_APPS } from "../apps/meta";
import { AppIcon } from "../brand/AppIcon";
import { useOs } from "./OsContext";

export function Dock({ unread }: { unread: number }) {
  const { wm, dispatchWm, openApp } = useOs();

  const activate = (id: AppId) => {
    const win = wm.windows.find((w) => w.appId === id);
    if (!win) openApp(id);
    else if (wm.focusedId === win.id && !win.minimized) dispatchWm({ type: "minimize", id: win.id });
    else dispatchWm({ type: "focus", id: win.id });
  };

  return (
    <nav className="dock" aria-label="Dock">
      <ul>
        {DOCK_APPS.map((id) => {
          const running = wm.windows.some((w) => w.appId === id);
          const badge = id === "chat" ? unread : 0;
          const title = APP_META[id].title;
          return (
            <li key={id}>
              <button type="button" className={running ? "dock-item running" : "dock-item"} aria-label={badge ? `${title}, ${badge} unread` : title} onClick={() => activate(id)}>
                <AppIcon app={id} size={44} />
                {badge > 0 && (
                  <span className="dock-badge" aria-hidden="true">
                    {badge}
                  </span>
                )}
                <span className="dock-tip" aria-hidden="true">
                  {title}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
