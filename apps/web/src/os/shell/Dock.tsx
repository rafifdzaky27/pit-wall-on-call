import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { AppId } from "../apps/ids";
import { APP_META, DOCK_APPS } from "../apps/meta";
import { AppIcon } from "../brand/AppIcon";
import { frameOf } from "../wm/wm";
import { dockHidden, dockRect } from "./dockGeometry";
import { useOs } from "./OsContext";

/** The pointer must rest on the bottom edge this long before the dock reveals itself. */
export const REVEAL_MS = 150;
/** The dock hides again this long after the pointer leaves it. */
export const HIDE_MS = 400;
const SWIPE_ZONE = 24;
const SWIPE_MIN = 24;
/** Width used before the dock has been measured (jsdom never lays out). */
const FALLBACK_WIDTH = 400;

export function Dock({ unread, forceShow = false }: { unread: number; forceShow?: boolean }) {
  const { wm, dispatchWm, openApp, dragging } = useOs();
  const ref = useRef<HTMLElement>(null);
  const [width, setWidth] = useState(0);
  const [peek, setPeek] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const [tipOff, setTipOff] = useState<AppId | null>(null);
  const enterTimer = useRef<number | undefined>(undefined);
  const leaveTimer = useRef<number | undefined>(undefined);

  useLayoutEffect(() => {
    setWidth(ref.current?.offsetWidth ?? 0);
  }, []);

  const frames = wm.windows.filter((w) => !w.minimized && !w.closing).map((w) => frameOf(w, wm.area));
  const covered = dockHidden(frames, dockRect(wm.area, width || FALLBACK_WIDTH));
  const hidden = covered && !peek && !focusWithin && !forceShow && !dragging;

  useEffect(() => {
    let startY: number | null = null;
    const onTouchStart = (e: TouchEvent) => {
      const y = e.touches[0]?.clientY;
      startY = y !== undefined && y > window.innerHeight - SWIPE_ZONE ? y : null;
    };
    const onTouchMove = (e: TouchEvent) => {
      const y = e.touches[0]?.clientY;
      if (startY !== null && y !== undefined && startY - y > SWIPE_MIN) {
        setPeek(true);
        startY = null;
      }
    };
    const onPointerDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setPeek(false);
    };
    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: true });
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("pointerdown", onPointerDown);
      window.clearTimeout(enterTimer.current);
      window.clearTimeout(leaveTimer.current);
    };
  }, []);

  const activate = (id: AppId) => {
    const win = wm.windows.find((w) => w.appId === id && !w.closing);
    if (!win) openApp(id);
    else if (wm.focusedId === win.id && !win.minimized) dispatchWm({ type: "minimize", id: win.id });
    else dispatchWm({ type: "focus", id: win.id });
  };

  return (
    <>
      <div
        className="dock-hotzone"
        aria-hidden="true"
        onPointerEnter={() => {
          window.clearTimeout(enterTimer.current);
          enterTimer.current = window.setTimeout(() => setPeek(true), REVEAL_MS);
        }}
        onPointerLeave={() => {
          // Leaving the edge without moving onto the dock tucks it away again.
          window.clearTimeout(enterTimer.current);
          window.clearTimeout(leaveTimer.current);
          leaveTimer.current = window.setTimeout(() => setPeek(false), HIDE_MS);
        }}
      />
      <nav
        ref={ref}
        className={`dock${hidden ? " hidden" : ""}${forceShow ? " over" : ""}`}
        aria-label="Dock"
        onPointerEnter={() => window.clearTimeout(leaveTimer.current)}
        onPointerLeave={() => {
          window.clearTimeout(leaveTimer.current);
          leaveTimer.current = window.setTimeout(() => setPeek(false), HIDE_MS);
        }}
        onFocus={() => setFocusWithin(true)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocusWithin(false);
        }}
      >
        <ul>
          {DOCK_APPS.map((id) => {
            const running = wm.windows.some((w) => w.appId === id && !w.closing);
            const badge = id === "chat" ? unread : 0;
            const title = APP_META[id].title;
            const classes = ["dock-item", running && "running", tipOff === id && "tip-off"].filter(Boolean).join(" ");
            return (
              <li key={id}>
                <button
                  type="button"
                  className={classes}
                  data-dock-app={id}
                  aria-label={badge ? `${title}, ${badge} unread` : title}
                  onClick={() => {
                    setTipOff(id);
                    activate(id);
                  }}
                  onPointerLeave={() => setTipOff(null)}
                >
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
    </>
  );
}
