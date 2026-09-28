import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState, type Dispatch, type ReactNode } from "react";
import type { AppId } from "../apps/ids";
import { APP_META } from "../apps/meta";
import { initialWm, MIN_H, wmReducer, type WmAction, type WmState } from "../wm/wm";

export const TOPBAR_H = 32;
export const DOCK_H = 72;

export function workArea(): { w: number; h: number } {
  return { w: window.innerWidth, h: Math.max(MIN_H, window.innerHeight - TOPBAR_H - DOCK_H) };
}

export interface OsApi {
  wm: WmState;
  dispatchWm: Dispatch<WmAction>;
  openApp: (id: AppId) => void;
  read: ReadonlySet<string>;
  markRead: (ids: string[]) => void;
}

const OsContext = createContext<OsApi | null>(null);

export function useOs(): OsApi {
  const value = useContext(OsContext);
  if (!value) throw new Error("useOs must be used inside <OsProvider>");
  return value;
}

export function OsProvider({ children }: { children: ReactNode }) {
  const [wm, dispatchWm] = useReducer(wmReducer, undefined, () => initialWm(workArea()));
  const [read, setRead] = useState<ReadonlySet<string>>(() => new Set());

  useEffect(() => {
    const onResize = () => dispatchWm({ type: "setArea", ...workArea() });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const openApp = useCallback((id: AppId) => {
    const meta = APP_META[id];
    dispatchWm({ type: "open", appId: id, title: meta.title, size: meta.size, min: meta.min, maximized: meta.maximized });
  }, []);

  const markRead = useCallback((ids: string[]) => {
    setRead((prev) => {
      if (ids.every((id) => prev.has(id))) return prev;
      return new Set([...prev, ...ids]);
    });
  }, []);

  const value = useMemo(() => ({ wm, dispatchWm, openApp, read, markRead }), [wm, openApp, read, markRead]);
  return <OsContext.Provider value={value}>{children}</OsContext.Provider>;
}
