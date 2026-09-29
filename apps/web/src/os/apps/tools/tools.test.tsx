import type { ActionTool } from "@pitwall/engine";
import { slowLeak, training } from "@pitwall/scenarios";
import { act, cleanup, fireEvent, screen, within } from "@testing-library/react";
import type { ComponentType } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderOs } from "../../testing";
import { MonitoringApp } from "../monitoring/MonitoringApp";
import { DbApp } from "./DbApp";
import { DeploysApp } from "./DeploysApp";
import { IncidentApp } from "./IncidentApp";
import { LogsApp } from "./LogsApp";
import { toolOf } from "./toolActions";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const seconds = (n: number) => act(() => vi.advanceTimersByTime(n * 1000));

function paged(ui: React.ReactNode, { training: drill = false } = {}) {
  const r = renderOs(ui);
  act(() => (drill ? r.incident().startTraining() : r.incident().start()));
  act(() => r.incident().skipPrepage());
  act(() => r.incident().acknowledge());
  return r;
}

const APPS: [Exclude<ActionTool, "chat">, ComponentType][] = [
  ["dashboards", MonitoringApp],
  ["logs", LogsApp],
  ["deploys", DeploysApp],
  ["db", DbApp],
  ["incident", IncidentApp],
];

describe("every action has one home (M2.5 plan B4, Review Focus 4)", () => {
  it.each([
    ["Slow Leak", slowLeak, false],
    ["training", training, true],
  ] as const)("%s: each action is in exactly one tool, and that tool shows it", (_name, scenario, drill) => {
    const shown = new Map<string, string[]>();
    for (const [tool, App] of APPS) {
      const { unmount, container } = paged(<App practice={slowLeak} />, { training: drill });
      const ids =
        tool === "dashboards"
          ? // Monitoring shows one service at a time.
            scenario.services.flatMap((s) => {
              fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${s.label}`) }));
              return [...container.querySelectorAll("[data-coach^='action:']")].map((b) => b.getAttribute("data-coach")!.slice(7));
            })
          : [...container.querySelectorAll("[data-coach^='action:']")].map((b) => b.getAttribute("data-coach")!.slice(7));
      for (const id of new Set(ids)) shown.set(id, [...(shown.get(id) ?? []), tool]);
      unmount();
    }
    for (const a of scenario.actions) {
      if (toolOf(a) === "chat") {
        expect(a.ask, `${a.id} is a question in Chat`).toBeDefined();
        expect(shown.get(a.id), `${a.id} only in Chat`).toBeUndefined();
      } else {
        expect(shown.get(a.id), a.id).toEqual([toolOf(a)]);
      }
    }
  });
});

describe("Monitoring alone is not enough (M2.5 follow-up)", () => {
  it.each([
    ["Slow Leak", slowLeak],
    ["training", training],
  ] as const)("%s: every fix for the root cause lives in another tool, so the player has to leave Monitoring", (_name, scenario) => {
    expect(scenario.rootCauseActionIds.length).toBeGreaterThan(0);
    for (const id of scenario.rootCauseActionIds) {
      const action = scenario.actions.find((a) => a.id === id)!;
      expect(toolOf(action), id).not.toBe("dashboards");
    }
  });
});

describe("Logs", () => {
  it("runs a saved query, which is the engine action, and filters by service, level and text", () => {
    const { incident } = paged(<LogsApp />);
    seconds(20);
    const saved = screen.getByRole("group", { name: "Saved queries" });
    fireEvent.click(within(saved).getByRole("button", { name: /Read gateway error log/ }));
    expect(incident().snapshot.busy?.actionId).toBe("edge.error_log");
    seconds(4);
    expect(screen.getByRole("list", { name: "Pinned findings" }).textContent).toContain("upstream prematurely closed");

    fireEvent.change(screen.getByRole("combobox", { name: "Service" }), { target: { value: "postgres" } });
    const lines = () => [...screen.getByRole("list", { name: "Log lines" }).querySelectorAll("[data-testid=log-service]")].map((n) => n.textContent);
    expect(new Set(lines())).toEqual(new Set(["postgres"]));

    fireEvent.change(screen.getByRole("combobox", { name: "Service" }), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "INFO", pressed: true }));
    expect(screen.getByRole("list", { name: "Log lines" }).querySelector(".lvl.INFO")).toBeNull();

    fireEvent.change(screen.getByRole("searchbox", { name: "Search logs" }), { target: { value: "no such text anywhere" } });
    expect(screen.getByText("No log lines match.")).toBeTruthy();
  });

  it("opens pre-filtered from Monitoring's Open in link", () => {
    const { os } = paged(
      <>
        <MonitoringApp />
        <LogsApp />
      </>,
    );
    fireEvent.click(screen.getByRole("button", { name: /^postgres/ }));
    fireEvent.click(within(screen.getByRole("navigation", { name: "Open in" })).getByRole("button", { name: "Logs" }));
    expect(os().wm.windows.map((w) => w.appId)).toContain("logs");
    expect((screen.getByRole("combobox", { name: "Service" }) as HTMLSelectElement).value).toBe("postgres");
  });

  it("links a version in a log line to Deploys", () => {
    const { os, incident } = paged(<LogsApp />);
    act(() => incident().dispatch("checkout.deploys"));
    seconds(4);
    // Only a version the service really has is a link: "POST /v1/charges" on payments is not (review I2).
    expect(screen.getByRole("list", { name: "Log lines" }).textContent).toContain("/v1/charges");
    expect(screen.queryAllByRole("button", { name: /^v1, open in Deploys$/ })).toHaveLength(0);
    const link = screen.getAllByRole("button", { name: /^v14\d, open in Deploys$/ })[0]!;
    fireEvent.click(link);
    expect(os().wm.windows.map((w) => w.appId)).toContain("deploys");
    expect(os().toolFocus).toMatchObject({ app: "deploys", serviceId: "checkout" });
  });
});

describe("Deploys", () => {
  it("shows each service's version and deploy history, and rolls back", () => {
    const { incident } = paged(<DeploysApp />);
    const checkout = screen.getByRole("region", { name: "checkout-api" });
    expect(within(checkout).getByText("v142 · 3 pods")).toBeTruthy();
    const history = within(checkout).getByRole("list", { name: "Deploy history" });
    // Relative, like Chat: days, not thousands of minutes (walkthrough W2).
    expect(within(history).getAllByRole("listitem")[1]!.textContent).toMatch(/6 d ago/);
    expect(within(history).getAllByRole("listitem").map((li) => li.querySelector(".tool-version")!.textContent)).toEqual(["v142", "v141"]);
    fireEvent.click(within(checkout).getByRole("button", { name: /View recent deploys/ }));
    seconds(4);
    expect(within(checkout).getByRole("list", { name: "Findings" }).textContent).toContain("checkout refactor");
    fireEvent.click(within(checkout).getByRole("button", { name: /Roll back to v141/ }));
    expect(incident().snapshot.busy?.actionId).toBe("checkout.rollback");
    seconds(31);
    expect(within(checkout).getByText("v141 · 3 pods")).toBeTruthy();
  });
});

describe("DB console", () => {
  it("shows actions as the commands they stand for, and their output", () => {
    paged(<DbApp />);
    const cmd = screen.getByRole("button", { name: /pg_stat_activity/ });
    expect(cmd.textContent).toContain("Inspect active connections");
    fireEvent.click(cmd);
    seconds(4);
    const out = screen.getByRole("log", { name: "psql session" });
    expect(out.textContent).toContain("pitwall=# SELECT");
    expect(out.textContent).toContain("pg_stat_activity:");
  });

  it("says so when the incident has no database", () => {
    paged(<DbApp />, { training: true });
    expect(screen.getByText("No database in this incident.")).toBeTruthy();
  });
});

describe("Incident", () => {
  it("shows the status, the checklist and the timeline, posts your status text, and pages the secondary", () => {
    const { incident, os } = paged(<IncidentApp />);
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Checkout returning 5xx");
    expect(screen.getByText("Investigating")).toBeTruthy();
    expect(screen.getByRole("list", { name: "Incident checklist" })).toBeTruthy();
    expect(screen.getByRole("list", { name: "Timeline" }).textContent).toContain("Acknowledged");

    fireEvent.change(screen.getByRole("textbox", { name: "Status page message" }), { target: { value: "We are looking into failed payments." } });
    fireEvent.click(screen.getByRole("button", { name: "Post status update" }));
    expect(incident().snapshot.busy?.actionId).toBe("global.status_update");
    expect(os().chatPosts.at(-1)).toMatchObject({ channel: "incidents", author: "you", text: "Status update: We are looking into failed payments." });
    seconds(6);
    expect(screen.getByRole("list", { name: "Timeline" }).textContent).toContain("Done: Post status update");
    expect((screen.getByRole("button", { name: "Post status update" }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: /Page secondary/ }));
    expect(incident().snapshot.pending.map((p) => p.actionId)).toContain("global.ask_secondary");
    expect(os().chatPosts.at(-1)).toMatchObject({ channel: "dm:secondary", author: "you" });
  });

  it("is where the status chip leads", async () => {
    const { StatusChip } = await import("../../shell/StatusChip");
    const { os } = paged(<StatusChip />);
    fireEvent.click(screen.getByRole("button", { name: /^Incident status/ }));
    expect(os().wm.windows.map((w) => w.appId)).toEqual(["incident"]);
  });
});
