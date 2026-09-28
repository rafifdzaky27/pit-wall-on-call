import type { Bounds } from "../wm/wm";
import type { AppId } from "./ids";

export const APP_META: Record<AppId, { title: string; bounds: Bounds; maximized: boolean }> = {
  monitoring: { title: "Monitoring", bounds: { x: 40, y: 24, w: 1200, h: 760 }, maximized: true },
  browser: { title: "Browser", bounds: { x: 120, y: 30, w: 980, h: 640 }, maximized: false },
  chat: { title: "Chat", bounds: { x: 200, y: 70, w: 780, h: 540 }, maximized: false },
  files: { title: "Files", bounds: { x: 160, y: 60, w: 780, h: 520 }, maximized: false },
  settings: { title: "Settings", bounds: { x: 240, y: 80, w: 720, h: 540 }, maximized: false },
  trash: { title: "Trash", bounds: { x: 280, y: 100, w: 700, h: 460 }, maximized: false },
  postmortem: { title: "postmortem.md", bounds: { x: 180, y: 20, w: 920, h: 760 }, maximized: false },
};

export const DOCK_APPS: AppId[] = ["monitoring", "browser", "chat", "files", "settings", "trash"];
