import type { ActionDef, ActionTool, LogEntry, ScenarioDef, State, TimelineEntry } from "@pitwall/engine";
import type { AppId } from "../ids";

/** Where an action lives (M2.5 plan B4). An action without a tool is a dashboard check in Monitoring. */
export function toolOf(a: ActionDef<State>): ActionTool {
  return a.tool ?? "dashboards";
}

export function actionsIn(scenario: ScenarioDef<State>, tool: ActionTool, serviceId?: string | null): ActionDef<State>[] {
  return scenario.actions.filter((a) => toolOf(a) === tool && (serviceId === undefined || serviceId === null || a.serviceId === serviceId));
}

/**
 * The actions a tool lists now: one whose target the player has not found yet is not there at all, the way
 * you cannot drop a replication slot before you have seen its name. So a list never gives the fix away,
 * and nothing sits disabled without a reason (PR 30 review I3).
 */
export function offered(actions: ActionDef<State>[], offers: (actionId: string) => boolean): ActionDef<State>[] {
  return actions.filter((a) => offers(a.id));
}

/** The app each tool opens in. */
export const TOOL_APP: Record<ActionTool, AppId> = {
  dashboards: "monitoring",
  logs: "logs",
  deploys: "deploys",
  db: "db",
  incident: "incident",
  chat: "chat",
};

export type ToolAppId = "logs" | "deploys" | "db";

export const TOOL_LABEL: Record<ToolAppId, string> = { logs: "Logs", deploys: "Deploys", db: "DB console" };

/** One finished action and the finding lines it revealed. */
export interface ActionOutput {
  action: ActionDef<State>;
  tick: number;
  lines: LogEntry[];
}

/**
 * The output of each finished action in `ids`, in order. Findings carry no action id, so they are
 * matched by the tick the action finished and the service it ran on.
 */
export function outputsOf(scenario: ScenarioDef<State>, timeline: readonly TimelineEntry[], logs: readonly LogEntry[], ids: ReadonlySet<string>): ActionOutput[] {
  const defs = new Map(scenario.actions.map((a) => [a.id, a]));
  return timeline.flatMap((e) => {
    if (e.kind !== "action_done" || !ids.has(e.actionId)) return [];
    const action = defs.get(e.actionId)!;
    const service = action.serviceId ?? "global";
    return [{ action, tick: e.tick, lines: logs.filter((l) => l.finding && l.tick === e.tick && l.serviceId === service) }];
  });
}
