import type { Size } from "../wm/wm";
import type { AppId } from "./ids";

export interface AppMeta {
  title: string;
  /** Opening size; the position comes from the cascade (polish spec §4). */
  size: Size;
  min: Size;
  maximized: boolean;
}

export const APP_META: Record<AppId, AppMeta> = {
  monitoring: { title: "Monitoring", size: { w: 1200, h: 760 }, min: { w: 960, h: 480 }, maximized: true },
  browser: { title: "Browser", size: { w: 1040, h: 700 }, min: { w: 640, h: 420 }, maximized: false },
  chat: { title: "Chat", size: { w: 920, h: 620 }, min: { w: 560, h: 400 }, maximized: false },
  files: { title: "Files", size: { w: 860, h: 560 }, min: { w: 480, h: 320 }, maximized: false },
  settings: { title: "Settings", size: { w: 860, h: 600 }, min: { w: 560, h: 400 }, maximized: false },
  trash: { title: "Trash", size: { w: 780, h: 500 }, min: { w: 480, h: 320 }, maximized: false },
  postmortem: { title: "postmortem.md", size: { w: 920, h: 760 }, min: { w: 480, h: 360 }, maximized: false },
  help: { title: "Help", size: { w: 820, h: 600 }, min: { w: 520, h: 380 }, maximized: false },
};

export const DOCK_APPS: AppId[] = ["monitoring", "browser", "chat", "files", "settings", "trash"];
