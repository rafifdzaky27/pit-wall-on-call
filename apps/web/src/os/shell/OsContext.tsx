import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState, type Dispatch, type MutableRefObject, type ReactNode } from "react";
import type { Author } from "@pitwall/scenarios";
import type { AppId } from "../apps/ids";
import type { ToolAppId } from "../apps/tools/toolActions";
import { APP_META } from "../apps/meta";
import { initialWm, MIN_H, wmReducer, type WmAction, type WmState } from "../wm/wm";

export const TOPBAR_H = 32;

/** Maximized and snapped windows reach the bottom of the screen; the dock hides over them (polish spec S14). */
export function workArea(): { w: number; h: number } {
  return { w: window.innerWidth, h: Math.max(MIN_H, window.innerHeight - TOPBAR_H) };
}

export type MenuId = "phone" | "system" | "calendar";
export type SettingsPageId = "appearance" | "sound" | "accessibility" | "display" | "gameplay" | "keyboard" | "account" | "about";
export type BrowserTabId = "store" | "leaderboard";

export interface NoticeAction {
  label: string;
  run: () => void;
  primary?: boolean;
}

export interface Notice {
  /** Stable per source ("shift", "chat:<message id>"). Pushing the same id replaces the notice. */
  id: string;
  /** Source shown above the title, for example "Shift" or "Chat". */
  app: string;
  title: string;
  body: string;
  actions: NoticeAction[];
  sound?: "notify" | "message";
  at: number;
  read: boolean;
  /** Showing as a banner right now. A hidden banner stays in the calendar's list (polish spec §6). */
  banner: boolean;
}

/** A message the player (or a teammate answering them) posted this shift. Presentation only (M2.5 plan B3). */
export interface ChatPost {
  id: string;
  channel: string;
  author: Author | "you";
  text: string;
  at: number;
}

export type NewNotice = Omit<Notice, "at" | "read" | "banner">;

export interface OsApi {
  wm: WmState;
  dispatchWm: Dispatch<WmAction>;
  openApp: (id: AppId) => void;
  read: ReadonlySet<string>;
  markRead: (ids: string[]) => void;
  openMenu: MenuId | null;
  setOpenMenu: (menu: MenuId | null) => void;
  dragging: boolean;
  setDragging: (on: boolean) => void;
  settingsPage: SettingsPageId;
  openSettings: (page: SettingsPageId) => void;
  /** The tab the Browser should show; `nonce` makes a repeated request for the same tab count. */
  browserTab: { id: BrowserTabId; nonce: number } | null;
  openBrowserTab: (id: BrowserTabId) => void;
  notices: Notice[];
  pushNotice: (notice: NewNotice) => void;
  hideBanner: (id: string) => void;
  removeNotice: (id: string) => void;
  markNoticesRead: () => void;
  clearNotices: () => void;
  /** When this desktop session started. Messages with `minutesAgo` are dated before it. */
  bootAt: number;
  /** Wall-clock time each chat message first appeared during the session. */
  arrivals: ReadonlyMap<string, number>;
  recordArrivals: (ids: string[], at: number) => void;
  /** Apps the player brought forward while it counted, for the incident checklist (M2.5 spec §4). */
  seenApps: ReadonlySet<AppId>;
  markSeen: (id: AppId) => void;
  /** Messages posted this shift, kept here so they outlive the Chat window. */
  chatPosts: readonly ChatPost[];
  postChat: (channel: string, author: ChatPost["author"], text: string) => void;
  /** The service a tool should show; `nonce` makes a repeated request count (M2.5 plan B4 links). */
  toolFocus: { app: ToolAppId; serviceId: string | null; nonce: number } | null;
  openTool: (app: ToolAppId, serviceId: string | null) => void;
  /** Things the player did that no window state shows ("service:<id>" selected on the map, "chat:<channel>" read). For the next-step guide. */
  signals: ReadonlySet<string>;
  signal: (id: string) => void;
}

const OsContext = createContext<OsApi | null>(null);

/** Where something outside the OS (the coach, on the Stage) asks it to open an app. */
export type OpenRequest = { app: ToolAppId | "incident"; serviceId: string | null };
type Opener = (to: OpenRequest) => void;
const BridgeContext = createContext<MutableRefObject<Opener | null> | null>(null);

/** Lets layers above the OS (the Stage's coach) open apps in it. The OS fills it in while mounted. */
export function OsBridge({ children }: { children: ReactNode }) {
  const ref = useRef<Opener | null>(null);
  return <BridgeContext.Provider value={ref}>{children}</BridgeContext.Provider>;
}

const openWith = (os: OsApi): Opener => (to) => (to.app === "incident" ? os.openApp("incident") : os.openTool(to.app, to.serviceId));

/** Opens an app from inside the OS, or from above it through the bridge. */
export function useOsOpener(): Opener {
  const os = useContext(OsContext);
  const bridge = useContext(BridgeContext);
  return (to) => (os ? openWith(os) : bridge?.current)?.(to);
}

export function useOs(): OsApi {
  const value = useContext(OsContext);
  if (!value) throw new Error("useOs must be used inside <OsProvider>");
  return value;
}

export function OsProvider({ children }: { children: ReactNode }) {
  const [wm, dispatchWm] = useReducer(wmReducer, undefined, () => initialWm(workArea()));
  const [read, setRead] = useState<ReadonlySet<string>>(() => new Set());
  const [openMenu, setOpenMenu] = useState<MenuId | null>(null);
  const [dragging, setDragging] = useState(false);
  const [settingsPage, setSettingsPage] = useState<SettingsPageId>("appearance");
  const [browserTab, setBrowserTab] = useState<OsApi["browserTab"]>(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [bootAt] = useState(() => Date.now());
  const [arrivals, setArrivals] = useState<ReadonlyMap<string, number>>(() => new Map());
  const [seenApps, setSeenApps] = useState<ReadonlySet<AppId>>(() => new Set());
  const [chatPosts, setChatPosts] = useState<readonly ChatPost[]>([]);
  const [toolFocus, setToolFocus] = useState<OsApi["toolFocus"]>(null);
  const [signals, setSignals] = useState<ReadonlySet<string>>(() => new Set());

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
    setRead((prev) => (ids.every((id) => prev.has(id)) ? prev : new Set([...prev, ...ids])));
  }, []);

  const openSettings = useCallback(
    (page: SettingsPageId) => {
      setSettingsPage(page);
      openApp("settings");
    },
    [openApp],
  );

  const openBrowserTab = useCallback(
    (id: BrowserTabId) => {
      setBrowserTab((prev) => ({ id, nonce: (prev?.nonce ?? 0) + 1 }));
      openApp("browser");
    },
    [openApp],
  );

  const pushNotice = useCallback((n: NewNotice) => {
    setNotices((list) => [{ ...n, at: Date.now(), read: false, banner: true }, ...list.filter((x) => x.id !== n.id)]);
  }, []);
  const hideBanner = useCallback((id: string) => {
    setNotices((list) => (list.some((x) => x.id === id && x.banner) ? list.map((x) => (x.id === id ? { ...x, banner: false } : x)) : list));
  }, []);
  const removeNotice = useCallback((id: string) => {
    setNotices((list) => (list.some((x) => x.id === id) ? list.filter((x) => x.id !== id) : list));
  }, []);
  const markNoticesRead = useCallback(() => {
    setNotices((list) => (list.some((x) => !x.read) ? list.map((x) => ({ ...x, read: true })) : list));
  }, []);
  const clearNotices = useCallback(() => {
    setNotices((list) => (list.length > 0 ? [] : list));
  }, []);

  const recordArrivals = useCallback((ids: string[], at: number) => {
    setArrivals((prev) => {
      const fresh = ids.filter((id) => !prev.has(id));
      if (fresh.length === 0) return prev;
      const next = new Map(prev);
      for (const id of fresh) next.set(id, at);
      return next;
    });
  }, []);

  const markSeen = useCallback((id: AppId) => {
    setSeenApps((prev) => (prev.has(id) ? prev : new Set([...prev, id])));
  }, []);

  const signal = useCallback((id: string) => {
    setSignals((prev) => (prev.has(id) ? prev : new Set([...prev, id])));
  }, []);

  const postChat = useCallback((channel: string, author: ChatPost["author"], text: string) => {
    setChatPosts((list) => [...list, { id: `post-${list.length}`, channel, author, text, at: Date.now() }]);
  }, []);

  const openTool = useCallback(
    (app: ToolAppId, serviceId: string | null) => {
      setToolFocus((prev) => ({ app, serviceId, nonce: (prev?.nonce ?? 0) + 1 }));
      openApp(app);
    },
    [openApp],
  );

  const value = useMemo<OsApi>(
    () => ({
      wm,
      dispatchWm,
      openApp,
      read,
      markRead,
      openMenu,
      setOpenMenu,
      dragging,
      setDragging,
      settingsPage,
      openSettings,
      browserTab,
      openBrowserTab,
      notices,
      pushNotice,
      hideBanner,
      removeNotice,
      markNoticesRead,
      clearNotices,
      bootAt,
      arrivals,
      recordArrivals,
      seenApps,
      markSeen,
      chatPosts,
      postChat,
      toolFocus,
      openTool,
      signals,
      signal,
    }),
    [signals, signal, chatPosts, postChat, toolFocus, openTool, wm, openApp, read, markRead, openMenu, dragging, settingsPage, openSettings, browserTab, openBrowserTab, notices, pushNotice, hideBanner, removeNotice, markNoticesRead, clearNotices, bootAt, arrivals, recordArrivals, seenApps, markSeen],
  );
  const bridge = useContext(BridgeContext);
  useLayoutEffect(() => {
    if (!bridge) return;
    const open = openWith(value);
    bridge.current = open;
    return () => {
      if (bridge.current === open) bridge.current = null;
    };
  }, [bridge, value]);
  return <OsContext.Provider value={value}>{children}</OsContext.Provider>;
}
