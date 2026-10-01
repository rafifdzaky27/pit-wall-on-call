import type { ComponentType } from "react";
import { act, cleanup, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DbApp } from "./apps/tools/DbApp";
import { DeploysApp } from "./apps/tools/DeploysApp";
import { IncidentApp } from "./apps/tools/IncidentApp";
import { LogsApp } from "./apps/tools/LogsApp";
import { MonitoringApp } from "./apps/monitoring/MonitoringApp";
import { SettingsApp } from "./apps/settings/SettingsApp";
import { loadPrefs } from "./prefs";
import { Desktop } from "./shell/Desktop";
import { StatusChip } from "./shell/StatusChip";
import { renderOs } from "./testing";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.useRealTimers();
});

const HARD_LINE = "Hard mode: run commands in Terminal";
const buttons = (c: HTMLElement) => c.querySelectorAll("[data-coach^='action:']");

function paged(ui: React.ReactNode, difficulty: "normal" | "hard") {
  const r = renderOs(ui, { prefs: { difficulty } });
  act(() => r.incident().start());
  act(() => r.incident().skipPrepage());
  act(() => r.incident().acknowledge());
  return r;
}

describe("hard mode takes the action buttons out of every tool (M6 spec H2)", () => {
  const TOOLS: [string, ComponentType][] = [
    ["Monitoring", MonitoringApp],
    ["Logs", LogsApp],
    ["Deploys", DeploysApp],
    ["DB console", DbApp],
    ["Incident", IncidentApp],
  ];

  it.each(TOOLS)("%s: buttons in normal mode, one muted line in hard mode", (_name, App) => {
    const normal = paged(<App />, "normal");
    if (_name === "Monitoring") fireEvent.click(screen.getByRole("button", { name: (n) => n.startsWith("checkout-api") }));
    expect(buttons(normal.container).length).toBeGreaterThan(0);
    expect(screen.queryByText(HARD_LINE)).toBeNull();
    normal.unmount();

    const hard = paged(<App />, "hard");
    if (_name === "Monitoring") fireEvent.click(screen.getByRole("button", { name: (n) => n.startsWith("checkout-api") }));
    expect(buttons(hard.container)).toHaveLength(0);
    expect(screen.getAllByText(HARD_LINE).length).toBeGreaterThan(0);
  });

  it("Incident keeps the checklist and timeline but not the status composer or paging", () => {
    paged(<IncidentApp />, "hard");
    expect(screen.getByRole("list", { name: "Incident checklist" })).toBeTruthy();
    expect(screen.getByRole("list", { name: "Timeline" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Post status update" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Page secondary on-call" })).toBeNull();
  });

  it("Monitoring keeps its read-only views", () => {
    paged(<MonitoringApp />, "hard");
    expect(screen.getByRole("region", { name: "Alerts" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Service map" })).toBeTruthy();
  });
});

describe("the Terminal in the dock and at the first ack (M6 spec H3)", () => {
  const dock = () => screen.getByRole("navigation", { name: "Dock" });

  it("is in the dock only during a hard shift", () => {
    const hard = renderOs(<Desktop />, { prefs: { difficulty: "hard" } });
    expect(within(dock()).queryByRole("button", { name: "Terminal" })).toBeNull();
    act(() => hard.incident().start());
    expect(within(dock()).getByRole("button", { name: "Terminal" })).toBeTruthy();
    hard.unmount();

    const normal = renderOs(<Desktop />);
    act(() => normal.incident().start());
    expect(within(dock()).queryByRole("button", { name: "Terminal" })).toBeNull();
  });

  it("opens by itself at the first ack of a hard shift, not of a normal one", async () => {
    const hard = renderOs(<Desktop />, { prefs: { difficulty: "hard" } });
    act(() => hard.incident().start());
    act(() => hard.incident().skipPrepage());
    expect(hard.os().wm.windows.some((w) => w.appId === "terminal")).toBe(false);
    act(() => hard.incident().acknowledge());
    expect(hard.os().wm.windows.some((w) => w.appId === "terminal")).toBe(true);
    hard.unmount();

    const normal = renderOs(<Desktop />);
    act(() => normal.incident().start());
    act(() => normal.incident().skipPrepage());
    act(() => normal.incident().acknowledge());
    expect(normal.os().wm.windows.some((w) => w.appId === "terminal")).toBe(false);
  });
});

describe("Settings: Difficulty (M6 spec H1)", () => {
  const gameplay = () => fireEvent.click(within(screen.getByRole("navigation", { name: "Settings pages" })).getByRole("button", { name: "Gameplay" }));

  it("chooses Normal or Hard, with a line on each", () => {
    renderOs(<SettingsApp />);
    gameplay();
    const group = screen.getByRole("radiogroup", { name: "Difficulty" });
    expect((within(group).getByRole("radio", { name: "Normal" }) as HTMLInputElement).checked).toBe(true);
    expect(group.textContent).toMatch(/buttons/i);
    expect(group.textContent).toMatch(/Terminal/);
    fireEvent.click(within(group).getByRole("radio", { name: "Hard" }));
    expect(loadPrefs().difficulty).toBe("hard");
    expect(screen.queryByText("Applies from your next shift")).toBeNull();
  });

  it("says a change applies from the next shift once a shift has started", () => {
    const r = renderOs(<SettingsApp />);
    act(() => r.incident().start());
    gameplay();
    fireEvent.click(screen.getByRole("radio", { name: "Hard" }));
    expect(screen.getByText("Applies from your next shift")).toBeTruthy();
  });

  it("is offered to search", () => {
    renderOs(<SettingsApp />);
    fireEvent.change(screen.getByRole("searchbox", { name: "Search settings" }), { target: { value: "difficulty" } });
    expect(screen.getByRole("button", { name: "Gameplay" })).toBeTruthy();
  });
});

describe("the status chip says Hard in a hard shift", () => {
  it("only once the shift has started, and only when hard", () => {
    const hard = renderOs(<StatusChip />, { prefs: { difficulty: "hard" } });
    expect(screen.getByRole("button", { name: /^Incident status/ }).textContent).toBe("On call · Primary");
    act(() => hard.incident().start());
    expect(screen.getByRole("button", { name: /^Incident status/ }).textContent).toContain("Hard");
    expect(screen.getByRole("button", { name: /^Incident status/ }).getAttribute("aria-label")).toMatch(/hard/i);
    hard.unmount();

    const normal = renderOs(<StatusChip />);
    act(() => normal.incident().start());
    expect(screen.getByRole("button", { name: /^Incident status/ }).textContent).not.toContain("Hard");
  });
});
