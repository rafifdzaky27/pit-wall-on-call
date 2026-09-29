import { lazy, type ComponentType } from "react";
import type { AppId } from "./ids";
import { MonitoringApp } from "./monitoring/MonitoringApp";

const BrowserApp = lazy(() => import("./browser/BrowserApp").then((m) => ({ default: m.BrowserApp })));
const ChatApp = lazy(() => import("./chat/ChatApp").then((m) => ({ default: m.ChatApp })));
const FilesApp = lazy(() => import("./files/FilesApp").then((m) => ({ default: m.FilesApp })));
const TrashApp = lazy(() => import("./files/TrashApp").then((m) => ({ default: m.TrashApp })));
const SettingsApp = lazy(() => import("./settings/SettingsApp").then((m) => ({ default: () => <m.SettingsApp /> })));
const PostmortemApp = lazy(() => import("./postmortem/PostmortemApp").then((m) => ({ default: m.PostmortemApp })));
const LogsApp = lazy(() => import("./tools/LogsApp").then((m) => ({ default: m.LogsApp })));
const DeploysApp = lazy(() => import("./tools/DeploysApp").then((m) => ({ default: m.DeploysApp })));
const DbApp = lazy(() => import("./tools/DbApp").then((m) => ({ default: m.DbApp })));
const IncidentApp = lazy(() => import("./tools/IncidentApp").then((m) => ({ default: m.IncidentApp })));
const HelpApp = lazy(() => import("./help/HelpApp").then((m) => ({ default: m.HelpApp })));

/** Monitoring loads eagerly (it is the core); every other app is its own chunk. */
export const APP_COMPONENTS: Record<AppId, ComponentType> = {
  monitoring: MonitoringApp,
  browser: BrowserApp,
  chat: ChatApp,
  files: FilesApp,
  settings: SettingsApp,
  trash: TrashApp,
  postmortem: PostmortemApp,
  help: HelpApp,
  logs: LogsApp,
  deploys: DeploysApp,
  db: DbApp,
  incident: IncidentApp,
};
