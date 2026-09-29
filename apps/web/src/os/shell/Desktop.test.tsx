import { dailyFor, utcDate } from "@pitwall/scenarios";
import { resolveWorld } from "@pitwall/world";
import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Stage } from "../../cafe/Stage";
import { renderOs } from "../testing";
import { Desktop } from "./Desktop";

const today = dailyFor(utcDate(Date.now()));
const DAILY_TITLE = `Daily #${today.number} · ${resolveWorld(today.seed).city.name}`;

afterEach(cleanup);
const world = resolveWorld(1);

/** The System menu loads on its first open (M1.6 main-chunk budget), so tests wait for it. */
const openSystem = async () => {
  fireEvent.click(screen.getByRole("button", { name: "System" }));
  await screen.findByRole("group", { name: "Quick settings" });
};

describe("Desktop", () => {
  it("greets with the shift notification, wallpaper, widgets and dock", () => {
    const { container } = renderOs(<Desktop />);
    expect(screen.getByRole("heading", { name: DAILY_TITLE })).toBeTruthy();
    expect(container.querySelector(`svg.wallpaper[data-city="${world.city.id}"]`)).toBeTruthy();
    expect(screen.queryByRole("region", { name: "fortune" })).toBeNull();
    expect(screen.getByRole("region", { name: "World clock" })).toBeTruthy();
    const dock = screen.getByRole("navigation", { name: "Dock" });
    expect(dock.querySelectorAll("button")).toHaveLength(10);
    expect(screen.getByRole("button", { name: "Chat, 11 unread" })).toBeTruthy();
  });

  it("the dock opens, focuses and minimizes apps", async () => {
    const { os } = renderOs(<Desktop />);
    fireEvent.click(screen.getByRole("button", { name: "Files" }));
    expect(await screen.findByRole("region", { name: "Files" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Files" }));
    expect(os().wm.windows[0]!.minimized).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Files" }));
    expect(os().wm.windows[0]!.minimized).toBe(false);
  });

  it("O opens the overview, Esc closes it, and it explains an empty desktop", () => {
    renderOs(<Desktop />);
    fireEvent.keyDown(window, { key: "o" });
    const overview = screen.getByRole("dialog", { name: "Overview" });
    expect(overview.textContent).toContain("No windows open. Pick an app from the dock.");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Overview" })).toBeNull();
  });

  it("window shortcuts act on the focused window but not while typing", async () => {
    const { os } = renderOs(<Desktop />);
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    await screen.findByRole("region", { name: "Settings" });
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Sticky note" }), { key: "x" });
    expect(os().wm.windows).toHaveLength(1);
    fireEvent.keyDown(window, { key: "[" });
    expect(os().wm.windows[0]!.mode).toBe("left");
    fireEvent.keyDown(window, { key: "m" });
    expect(os().wm.windows[0]!.mode).toBe("maximized");
    fireEvent.keyDown(window, { key: "x" });
    expect(os().wm.windows).toHaveLength(0);
  });

  it("Start shift opens the Browser, and the page is a critical notification acknowledged with A", async () => {
    const { incident, os } = renderOs(<Desktop />);
    fireEvent.click(screen.getByRole("button", { name: "Practice shift" }));
    expect(await screen.findByRole("region", { name: "Browser" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Skip to the page" }));
    expect(screen.getByRole("alertdialog", { name: "Checkout returning 5xx" })).toBeTruthy();
    fireEvent.keyDown(window, { key: "a" });
    expect(incident().phase).toBe("active");
    // The ack leaves you on your desktop: finding the right tool is part of the job (M2.5 follow-up).
    expect(os().wm.windows.map((w) => w.appId)).toEqual(["browser"]);
    const notice = os().notices.find((n) => n.id === "acked")!;
    expect(notice.title).toBe("You're on it");
    expect(notice.body).toContain("Customers get");
    expect(notice.actions.map((a) => a.label)).toEqual(["Open Monitoring", "Open Incident"]);
    act(() => notice.actions[0]!.run());
    expect(os().wm.windows.find((w) => w.appId === "monitoring")?.mode).toBe("maximized");
  });

  it("P pauses a running incident behind an opaque overlay", () => {
    const { incident } = renderOs(
      <Stage>
        <Desktop />
      </Stage>,
    );
    act(() => incident().start());
    act(() => incident().skipPrepage());
    fireEvent.keyDown(window, { key: "p" });
    expect(screen.getByRole("dialog", { name: "Paused" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Resume/ }));
    expect(screen.queryByRole("dialog", { name: "Paused" })).toBeNull();
  });

  it("? opens Help, but not while typing", async () => {
    const { os } = renderOs(<Desktop />);
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Sticky note" }), { key: "?", shiftKey: true });
    expect(os().wm.windows).toHaveLength(0);
    fireEvent.keyDown(window, { key: "?", shiftKey: true });
    expect(await screen.findByRole("region", { name: "Help" })).toBeTruthy();
  });

  it("? does nothing with single-key shortcuts off", () => {
    const { os } = renderOs(<Desktop />, { prefs: { singleKeyShortcuts: false } });
    fireEvent.keyDown(window, { key: "?", shiftKey: true });
    expect(os().wm.windows).toHaveLength(0);
  });

  it("notes the Browser for the checklist only when the player brings it forward during the incident", async () => {
    const { incident, os } = renderOs(<Desktop />);
    fireEvent.click(screen.getByRole("button", { name: "Practice shift" }));
    await screen.findByRole("region", { name: "Browser" });
    act(() => incident().skipPrepage());
    act(() => incident().acknowledge());
    // The Browser opened by itself before the page, and Monitoring took over at the ack.
    expect(os().seenApps.has("browser")).toBe(false);
    act(() => os().openApp("postmortem"));
    // The postmortem only counts once there is one to read.
    expect(os().seenApps.has("postmortem")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Browser" }));
    expect(os().seenApps.has("browser")).toBe(true);
  });

  it("the System menu locks the screen, and Unlock returns", async () => {
    renderOs(<Desktop />);
    await openSystem();
    fireEvent.click(screen.getByRole("button", { name: "Lock" }));
    expect(screen.getByRole("main", { name: "Lock screen" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Unlock" }));
    expect(screen.getByRole("main", { name: "Desktop" })).toBeTruthy();
  });
  it("stacks windows by rank, focused on top, below the dock layer", async () => {
    const { os } = renderOs(<Desktop />);
    fireEvent.click(screen.getByRole("button", { name: "Files" }));
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    const files = await screen.findByRole("region", { name: "Files" });
    const settings = await screen.findByRole("region", { name: "Settings" });
    expect([files.style.zIndex, settings.style.zIndex]).toEqual(["10", "11"]);
    act(() => os().dispatchWm({ type: "focus", id: os().wm.windows[0]!.id }));
    expect([files.style.zIndex, settings.style.zIndex]).toEqual(["11", "10"]);
  });

  it("tucks the dock under maximized Monitoring after the ack", async () => {
    const { incident } = renderOs(<Desktop />);
    act(() => incident().start());
    act(() => incident().skipPrepage());
    act(() => incident().acknowledge());
    fireEvent.click(screen.getByRole("button", { name: "Open Monitoring" }));
    await screen.findByRole("region", { name: "Monitoring" });
    expect(screen.getByRole("navigation", { name: "Dock" }).className).toContain("hidden");
  });
});
